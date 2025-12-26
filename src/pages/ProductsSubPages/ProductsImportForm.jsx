
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../contexts/ProductContext';
import { useLookups } from '../../contexts/LookupContext';
import { useLocations } from '../../contexts/LocationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import LoadingOverlay from '../../components/LoadingOverlay.jsx';
import { useLoading } from '../../contexts/LoadingContext';
import { writeBatch, collection, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const REQUIRED_FIELDS = ['SKU', 'Model', 'isSerialized', 'Brand', 'Category', 'Description', 'ReorderPoint'];

const FIELD_MAPPING = {
    'SKU': 'sku',
    'Model': 'model',
    'isSerialized': 'isSerialized',
    'Brand': 'brand',
    'Category': 'category',
    'Description': 'description',
    'ReorderPoint': 'reorderPoint',
};

const FIELD_VALIDATION = {
    'SKU': { type: 'string', mandatory: true },
    'Model': { type: 'string', mandatory: true },
    'isSerialized': { type: 'boolean', mandatory: true },
    'Brand': { type: 'string', mandatory: true },
    'Category': { type: 'string', mandatory: true },
    'Description': { type: 'string', mandatory: false },
    'ReorderPoint': { type: 'number', mandatory: false }
};

const ProductsImportForm = () => {
    const navigate = useNavigate();
    const { products: existingProducts, isOnline, getProductCollectionRef } = useProducts();
    const { lookups } = useLookups();
    const { locations, addLocation: rawAddLocation } = useLocations();
    const { appId, db } = useAuth();
    const { user: currentUser, assignedLocations: rawAssignedLocations } = useUser();
    const { setAppProcessing } = useLoading();

    const assignedLocations = rawAssignedLocations || [];

    const [fileData, setFileData] = useState(null);
    const [status, setStatus] = useState({ state: 'initial', message: 'Ready to import product master data.' });
    const [errors, setErrors] = useState([]);
    const [newLookups, setNewLookups] = useState({ brands: [], categories: [] });
    const fileInputRef = useRef(null);

    const isReadyToCommit = status.state === 'validated' && errors.length === 0;

    const handleDownloadTemplate = () => {
        const workbook = XLSX.utils.book_new();
        const worksheetData = [
            ['SKU', 'Model', 'isSerialized', 'Brand', 'Category', 'Description', 'ReorderPoint'],
            ['Q-SKU 001', 'Q Product 001', 'FALSE', 'Haier', 'SDA', 'Desc A', 10],
            ['S-SKU 001', 'S Product 002', 'TRUE', 'Dawlance', 'Refrigerator', 'Desc B', 5],
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Product_Template");
        XLSX.writeFile(workbook, "product_import_template.xlsx");
        alert("Import template downloaded to your default downloads folder.");
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStatus({ state: 'loading', message: 'Processing file...' });
        setErrors([]);
        setFileData(null);
        setNewLookups({ brands: [], categories: [] });

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length === 0) {
                    setStatus({ state: 'error', message: 'File is empty.' });
                    return;
                }

                const headers = jsonData[0].map(h => h?.toString().trim()).filter(h => h);
                const dataRows = jsonData.slice(1);

                const missingHeaders = REQUIRED_FIELDS.filter(field => !headers.includes(field));
                if (missingHeaders.length > 0) {
                    setStatus({ state: 'error', message: `Missing required headers: ${missingHeaders.join(', ')}` });
                    return;
                }

                const { productsToImport, validationErrors, tempNewBrands, tempNewCategories } = processData(headers, dataRows, existingProducts, lookups);

                if (validationErrors.length > 0) {
                    setErrors(validationErrors);
                    setStatus({ state: 'error', message: 'File contains errors. Please fix before proceeding.' });
                    setFileData(productsToImport);
                    setNewLookups({ brands: Array.from(tempNewBrands), categories: Array.from(tempNewCategories) });
                } else {
                    setFileData(productsToImport);
                    setErrors([]);
                    setNewLookups({ brands: Array.from(tempNewBrands), categories: Array.from(tempNewCategories) });
                    setStatus({ state: 'validated', message: `${productsToImport.length} products ready for import.` });
                }
            } catch (error) {
                console.error("File processing error:", error);
                setStatus({ state: 'error', message: `Failed to process file: ${error.message}` });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const processData = (headers, dataRows, existingProductsList, lookupData) => {
        const validationErrors = [];
        const productsToImport = [];
        const tempNewBrands = new Set();
        const tempNewCategories = new Set();
        const skuSet = new Set(existingProductsList.map(p => p.sku.toLowerCase()));
        const skuRegex = /^[a-zA-Z0-9-_]+$/;

        dataRows.forEach((row, rowIndex) => {
            if (row.every(cell => cell === null || cell === undefined || cell === '')) return;
    
            const mappedProduct = {};
            let isValid = true;
            const lineNumber = rowIndex + 2;
    
            headers.forEach((header, colIndex) => {
                const value = row[colIndex];
                const fieldDef = FIELD_VALIDATION[header];
    
                if (!fieldDef) {
                    const mappedKey = FIELD_MAPPING[header] || header.toLowerCase();
                    mappedProduct[mappedKey] = value != null ? value.toString().trim() : '';
                    return;
                }
    
                if (fieldDef.mandatory && (value === null || value === undefined || value.toString().trim() === '')) {
                    validationErrors.push(`Row ${lineNumber}, Column "${header}": Value is required.`);
                    isValid = false;
                    return;
                }
    
                // --- SKU VALIDATION LOGIC ---
                if (header === 'SKU' && value) {
                    const skuValue = value.toString().trim();
                    if (!skuRegex.test(skuValue)) {
                        validationErrors.push(`Row ${lineNumber}, SKU "${skuValue}": Spaces and special characters are not allowed (use only letters, numbers, '-' or '_').`);
                        isValid = false;
                    }
                }

                if (value != null && value !== '') {
                    const mappedKey = FIELD_MAPPING[header];
                    if (fieldDef.type === 'string') {
                        mappedProduct[mappedKey] = value.toString().trim();
                    } else if (fieldDef.type === 'number') {
                        const num = parseInt(value, 10);
                        if (isNaN(num)) {
                            validationErrors.push(`Row ${lineNumber}, Column "${header}": Value "${value}" must be a number.`);
                            isValid = false;
                        } else {
                            mappedProduct[mappedKey] = num;
                        }
                    } else if (fieldDef.type === 'boolean') {
                        const strValue = value.toString().toLowerCase();
                        if (strValue === 'true' || strValue === 'false') {
                            mappedProduct[mappedKey] = strValue === 'true';
                        } else {
                            validationErrors.push(`Row ${lineNumber}, Column "${header}": Value must be TRUE or FALSE.`);
                            isValid = false;
                        }
                    }
                } else {
                    const mappedKey = FIELD_MAPPING[header];
                    if (fieldDef.type === 'number') {
                        mappedProduct[mappedKey] = 0;
                    } else {
                        mappedProduct[mappedKey] = '';
                    }
                }
            });

            if (mappedProduct.sku) {
                const skuLower = mappedProduct.sku.toLowerCase();
                if (skuSet.has(skuLower)) {
                    validationErrors.push(`Row ${lineNumber}, SKU "${mappedProduct.sku}": Duplicate SKU found within the file or already in database.`);
                    isValid = false;
                } else {
                    skuSet.add(skuLower);
                }
            }

            if (mappedProduct.brand && !lookupData?.brands?.includes(mappedProduct.brand)) {
                tempNewBrands.add(mappedProduct.brand);
            }
            if (mappedProduct.category && !lookupData?.categories?.includes(mappedProduct.category)) {
                tempNewCategories.add(mappedProduct.category);
            }

            if (isValid) {
                productsToImport.push(mappedProduct);
            }
        });

        return { productsToImport, validationErrors, tempNewBrands, tempNewCategories };
    };

    const handleCommitImport = async () => {
        if (!isReadyToCommit || !fileData || fileData.length === 0) return;
        if (!isOnline) { alert('Cannot import products in Offline Mode.'); return; }

        setAppProcessing(true);
        setStatus({ state: 'processing', message: `Importing ${fileData.length} products...` });

        try {
            const batch = writeBatch(db);
            const productColRef = getProductCollectionRef();

            // 1. Handle Lookup Updates (Brands/Categories)
            if (newLookups.brands.length > 0 || newLookups.categories.length > 0) {
                const lookupDocRef = doc(db, `/artifacts/${appId}/lookups`, 'metadata');
                const updates = {};
                if (newLookups.brands.length > 0) updates.brands = arrayUnion(...newLookups.brands);
                if (newLookups.categories.length > 0) updates.categories = arrayUnion(...newLookups.categories);
                
                if (Object.keys(updates).length > 0) {
                    batch.update(lookupDocRef, updates);
                }
            }

            // 2. Import Products using SKU as Document ID
            fileData.forEach(item => {
                // CHANGE: Use item.sku as the document ID
                const newProductRef = doc(productColRef, item.sku);
                
                const safeReorderPoint = typeof item.reorderPoint === 'number' && !isNaN(item.reorderPoint) ? item.reorderPoint : 0;

                batch.set(newProductRef, {
                    ...item,
                    id: item.sku, // Explicitly include id for consistency with the rest of the app
                    reorderPoint: safeReorderPoint,
                    isSerialized: item.isSerialized || false,
                    stockSummary: { totalInStock: 0, byLocation: {} },
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            });

            await batch.commit();

            setAppProcessing(false);
            alert(`${fileData.length} products imported successfully!`);
            setStatus({ state: 'success', message: `${fileData.length} products imported successfully!` });
            handleReset();

        } catch (error) {
            console.error("Batch import failed:", error);
            setAppProcessing(false);
            setStatus({ state: 'error', message: `Import failed: ${error.message}` });
            alert(`Import failed: ${error.message}`);
        }
    };

    const handleReset = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setFileData(null);
        setErrors([]);
        setNewLookups({ brands: [], categories: [] });
        setStatus({ state: 'initial', message: 'Ready to import product master data.' });
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {status.state === 'processing' && <LoadingOverlay />}

            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Bulk Import Products</h1>
                    <div className="flex gap-2">
                        <button onClick={handleReset} className="btn btn-outline-danger">Reset</button>
                        <button onClick={() => navigate('/products')} className="btn btn-outline-primary" title='Go back to Products'>Back to Products</button>
                    </div>
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h2 className="text-lg font-semibold text-blue-800 mb-2">Instructions</h2>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-blue-700">
                        <li>Download the Excel template below.</li>
                        <li>Fill in the required fields (*). <code>isSerialized</code> must be <code>TRUE</code> or <code>FALSE</code>.</li>
                        <li>Save the file as .xlsx or .csv format.</li>
                        <li>Upload the file using the button below.</li>
                        <li>Review the data and resolve any errors.</li>
                        <li>Click "Commit Import" to add the products.</li>
                    </ol>
                    <button type="button" onClick={handleDownloadTemplate} className="mt-3 btn btn-secondary">Download Import Template</button>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Product File (.xlsx or .csv)</label>
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} ref={fileInputRef} disabled={status.state === 'processing'} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                </div>

                {status.message && status.state !== 'processing' && (
                    <div className={`mb-4 p-3 rounded-md ${status.state === 'error' ? 'bg-red-100 text-red-700' : status.state === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {status.message}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-md font-semibold text-red-600 mb-2">Validation Errors:</h3>
                        <ul className="list-disc pl-5 space-y-1">{errors.map((error, index) => (<li key={index} className="text-sm text-red-600">{error}</li>))}</ul>
                    </div>
                )}

                {(newLookups?.brands?.length > 0 || newLookups?.categories?.length > 0) && (
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
                        <h3 className="text-md font-semibold text-yellow-800 mb-2">New Items to be Added:</h3>
                        {newLookups?.brands?.length > 0 && <div className="mb-2"><span className="font-medium text-yellow-700">Brands:</span><span className="ml-2 text-sm text-yellow-600">{newLookups.brands?.join(', ') || ''}</span></div>}
                        {newLookups?.categories?.length > 0 && <div><span className="font-medium text-yellow-700">Categories:</span><span className="ml-2 text-sm text-yellow-600">{newLookups.categories?.join(', ') || ''}</span></div>}
                    </div>
                )}

                {fileData && errors.length === 0 && (
                    <div className="mb-6 overflow-x-auto">
                        <h3 className="text-md font-semibold text-gray-700 mb-2">Data Preview (First 10 of {fileData.length} items):</h3>
                        <table className="table-base min-w-full">
                            <thead className="bg-gray-50">
                                <tr>{REQUIRED_FIELDS.map(field => (<th key={field} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{FIELD_MAPPING[field] || field}</th>))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {fileData.slice(0, 10).map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50">{
                                        REQUIRED_FIELDS.map(field => {
                                            const mappedKey = FIELD_MAPPING[field] || field.toLowerCase();
                                            return (<td key={`${index}-${field}`} className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{row[mappedKey]?.toString() || ''}</td>);
                                        })}
                                    </tr>
                                ))}
                                {fileData.length > 10 && (<tr><td colSpan={REQUIRED_FIELDS.length} className="px-4 py-2 text-center text-sm text-gray-500 italic">... and {fileData.length - 10} more rows</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex justify-end">
                    <button onClick={handleCommitImport} disabled={!isReadyToCommit || !isOnline || status.state === 'processing'} className={`btn btn-primary ${(!isReadyToCommit || !isOnline || status.state === 'processing') ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {status.state === 'processing' ? 'Importing...' : `Commit Import (${fileData?.length || 0} Items)`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductsImportForm;
