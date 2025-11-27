// src/components/BulkImportModal.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useProducts } from '../contexts/ProductContext';
import { useLookups } from '../contexts/LookupContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { writeBatch, collection, doc, arrayUnion, updateDoc } from 'firebase/firestore';


// Defines the required columns for the template and validation
const REQUIRED_FIELDS = [
    'SKU', 'Model', 'Brand', 'Category', 'Description', 'ReorderPoint'
];
const FIELD_VALIDATION = {
    'SKU': { type: 'string', mandatory: true }, 
    'Model': { type: 'string', mandatory: true }, 
    'Brand': { type: 'string', mandatory: true }, 
    'Category': { type: 'string', mandatory: true }, 
    'Description': { type: 'string', mandatory: false }, 
    'ReorderPoint': { type: 'number', mandatory: false } // ReorderPoint is highly recommended, but we can allow default 0/null if user leaves it empty
};

// --- Component: BulkImportModal ---
const BulkImportModal = ({ onClose }) => {
    const { appId } = useAuth(); 
    const { lookups } = useLookups();
    // Get existing product list and collection ref from ProductContext
    const { products: existingProducts, getProductCollectionRef } = useProducts(); 
    
    const [fileData, setFileData] = useState(null);
    const [status, setStatus] = useState({ state: 'initial', message: 'Ready to import product master data.' });
    const [errors, setErrors] = useState([]);
    const [newLookups, setNewLookups] = useState({});

    const isReadyToCommit = status.state === 'validated' && errors.length === 0;

    // --- Template Download Function ---
    const handleDownloadTemplate = () => {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([REQUIRED_FIELDS]);
        
        // Add one example row for guidance
        XLSX.utils.sheet_add_aoa(worksheet, [
            ['SAMPLE-001', 'Smart LED 55 Inch', 'Samsung', 'Electronics', 'High resolution LED TV', 5],
        ], {origin: -1});

        XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
        XLSX.writeFile(workbook, "InventoryPlus_Product_Import_Template.xlsx");
    };

    // 1. File Upload and Parsing
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStatus({ state: 'parsing', message: 'Parsing file...' });
        setErrors([]);
        setNewLookups({});
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (json.length < 2) {
                setStatus({ state: 'error', message: 'File is empty or only contains headers.' });
                return;
            }

            const headers = json[0].map(h => h.trim());
            const dataRows = json.slice(1);
            
            processData(headers, dataRows);
        };
        reader.readAsArrayBuffer(file);
    };

    // 2. Data Validation and Pre-processing
    const processData = (headers, dataRows) => {
        const validationErrors = [];
        const productsToImport = [];
        const tempNewBrands = new Set();
        const tempNewCategories = new Set();

        const skuSet = new Set(existingProducts.map(p => p.sku));
        
        const requiredHeadersPresent = REQUIRED_FIELDS.every(field => headers.includes(field));
        if (!requiredHeadersPresent) {
             validationErrors.push(`Missing required headers: ${REQUIRED_FIELDS.filter(f => !headers.includes(f)).join(', ')}`);
             setStatus({ state: 'errors', message: 'File is missing required column headers. Please use the template.' });
             setErrors(validationErrors);
             return;
        }

        dataRows.forEach((row, index) => {
            let product = {};
            let isValid = true;
            const lineNumber = index + 2; 

            Object.keys(FIELD_VALIDATION).forEach(field => {
                const { type, mandatory } = FIELD_VALIDATION[field];
                const headerIndex = headers.indexOf(field);
                let value = headerIndex !== -1 ? row[headerIndex] : undefined;
                
                if (typeof value === 'string') value = value.trim();

                // Validation 1: Mandatory Field Check (SKU, Model, Brand, Category)
                if (mandatory && (value === undefined || value === '')) {
                    validationErrors.push(`Row ${lineNumber}: Mandatory field missing: ${field}`);
                    isValid = false;
                    return;
                }

                // Validation 2: Type Check
                if (type === 'number') {
                    if (value === undefined || value === '') {
                        // Default ReorderPoint to 0 if left blank (since it's not strictly mandatory)
                        value = 0; 
                    } else {
                        value = Number(value);
                        if (isNaN(value) || value < 0) {
                            validationErrors.push(`Row ${lineNumber}: ${field} must be a non-negative number.`);
                            isValid = false;
                            return;
                        }
                    }
                }
                
                // --- FIX 1: Standardize object keys ---
                let key = field.charAt(0).toLowerCase() + field.slice(1).replace(/ /g, ''); 
                if (field === 'SKU') {
                    key = 'sku'; 
                } else if (field === 'ReorderPoint') {
                    key = 'reorderPoint'; 
                } else if (field === 'Description') {
                    key = 'description'; 
                }

                product[key] = value; 
            });
            
            if (!isValid) return; 

            // Validation 3: SKU Unique Check
            if (skuSet.has(product.sku)) {
                validationErrors.push(`Row ${lineNumber}: SKU "${product.sku}" already exists in the database.`);
                return;
            }
            
            // Validation 4: Identify New Lookups (Case-Insensitive Check)
            const cleanBrand = product.brand.trim().charAt(0).toUpperCase() + product.brand.trim().slice(1);
            const cleanCategory = product.category.trim().charAt(0).toUpperCase() + product.category.trim().slice(1);
            
            if (!lookups?.brands?.some(b => b.toLowerCase() === cleanBrand.toLowerCase())) {
                tempNewBrands.add(cleanBrand);
            }
            if (!lookups?.categories?.some(c => c.toLowerCase() === cleanCategory.toLowerCase())) {
                tempNewCategories.add(cleanCategory);
            }

            productsToImport.push({
                ...product,
                // Use the existing clean value (case-insensitive match) or the new clean value
                brand: lookups?.brands?.find(b => b.toLowerCase() === cleanBrand.toLowerCase()) || cleanBrand,
                category: lookups?.categories?.find(c => c.toLowerCase() === cleanCategory.toLowerCase()) || cleanCategory,
            });
        });

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            setStatus({ state: 'errors', message: 'File contains errors. Please fix before proceeding.' });
            setFileData(productsToImport);
        } else {
            setFileData(productsToImport);
            setErrors([]);
            setNewLookups({
                brands: Array.from(tempNewBrands),
                categories: Array.from(tempNewCategories)
            });
            setStatus({ state: 'validated', message: `${productsToImport.length} products ready for import.` });
        }
    };
    
    // 3. Commit Data (Batch Write)
    const commitImport = async () => {
        if (!isReadyToCommit) return;

        setStatus({ state: 'committing', message: 'Committing data...' });
        const batch = writeBatch(db);
        
        try {
            // A. Commit New Lookups (Single write operation)
            const lookupPath = `/artifacts/${appId}/lookups`;
            const lookupDocRef = doc(db, lookupPath, 'metadata');
            
            if (newLookups.brands.length > 0) {
                batch.update(lookupDocRef, {
                    brands: arrayUnion(...newLookups.brands)
                });
            }
            if (newLookups.categories.length > 0) {
                batch.update(lookupDocRef, {
                    categories: arrayUnion(...newLookups.categories)
                });
            }

            // B. Commit New Products (Batch operation)
            const productColRef = getProductCollectionRef();
            fileData.forEach(product => {
                const newProductRef = doc(productColRef);
                batch.set(newProductRef, {
                    ...product,
                    reorderPoint: parseInt(product.reorderPoint, 10), // Ensure it's stored as number
                    createdAt: new Date(), 
                    updatedAt: new Date(), 
                });
            });

            await batch.commit();
            setStatus({ state: 'success', message: `${fileData.length} products imported successfully!` });
            
            setTimeout(onClose, 2000); 

        } catch (error) {
            console.error("Batch commit failed:", error);
            setStatus({ state: 'error', message: 'Import failed during database commit.' });
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6">Bulk Product Import (CSV/Excel)</h2>
                
                {/* File Input & Actions */}
                <div className="border-b pb-4 mb-4 flex items-center space-x-4">
                    <button onClick={handleDownloadTemplate} className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shrink-0">
                        ⬇️ Download Template
                    </button>
                    <input type="file" onChange={handleFileUpload} accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                           className="flex-1 p-2 border border-gray-300 rounded-lg" />
                    
                    {isReadyToCommit && (
                        <button onClick={commitImport} disabled={!isReadyToCommit} 
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors shrink-0">
                            Commit Import ({fileData.length} Items)
                        </button>
                    )}
                    <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 shrink-0">Close</button>
                </div>

                {/* Status and Errors (Issue 2 Fix: Prominent Error Display) */}
                <div className="min-h-[50px]">
                    <p className={`font-semibold ${status.state === 'errors' || status.state === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                        Status: {status.message}
                    </p>
                    
                    {errors.length > 0 && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-lg max-h-40 overflow-y-auto text-sm">
                            <p className="font-bold mb-1">Found {errors.length} Errors. **Please fix these rows in your file and re-upload**:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                {errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Summary Table (Visible only when validated and error-free) */}
                {fileData && errors.length === 0 && (
                    <div className="mt-4 border-t pt-4">
                        <h3 className="text-lg font-semibold mb-2">Import Summary (Showing first 5 of {fileData.length} clean items)</h3>
                        
                        {/* New Lookups Summary */}
                        {(newLookups.brands.length > 0 || newLookups.categories.length > 0) && (
                            <div className="p-3 mb-4 bg-yellow-50 border border-yellow-300 rounded-lg text-sm">
                                <p className="font-bold text-yellow-800">New Data Will Be Created:</p>
                                {newLookups.brands.length > 0 && <p>Brands: {newLookups.brands.join(', ')}</p>}
                                {newLookups.categories.length > 0 && <p>Categories: {newLookups.categories.join(', ')}</p>}
                            </div>
                        )}

                        {/* Data Preview */}
                        <div className="max-h-64 overflow-y-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        {REQUIRED_FIELDS.map(header => (
                                            <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {fileData.slice(0, 5).map((product, index) => (
                                        <tr key={index}>
                                            <td className="px-3 py-2 whitespace-nowrap">{product.sku}</td>
                                            <td className="px-3 py-2">{product.model}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{product.brand}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{product.category}</td>
                                            <td className="px-3 py-2">{product.reorderPoint}</td>
                                            <td className="px-3 py-2 text-xs truncate max-w-xs">{product.description}</td>
                                        </tr>
                                    ))}
                                    {fileData.length > 5 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-2 text-gray-500">... {fileData.length - 5} more items not shown.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkImportModal;