// src/pages/ProductsSubPages/ProductsImportForm.jsx

// ===== UPDATE IMPORTS =====
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for routing
import { useProducts } from '../../contexts/ProductContext'; // Changed hook name
import { useLookups } from '../../contexts/LookupContext'; // Assuming this is the correct hook name
import { useLocations } from '../../contexts/LocationContext'; // NEW: Use LocationContext
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth to get appId and db
import { useUser } from '../../contexts/UserContext';
// NEW: Import LoadingOverlay and useLoading
import LoadingOverlay from '../../components/LoadingOverlay.jsx'; // Adjust path if necessary
import { useLoading } from '../../contexts/LoadingContext'; // Adjust path if necessary
// Import Firestore functions needed for batch write
import { writeBatch, collection, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
// =========================

// Defines the required columns for the template and validation
const REQUIRED_FIELDS = ['SKU', 'Model', 'Brand', 'Category', 'Description', 'ReorderPoint'];

// Defines the mapping from Excel/Uppercase keys to Firestore/Lowercase keys
// This ensures the data stored in Firestore matches the schema expected by other parts of the app
const FIELD_MAPPING = {
    'SKU': 'sku',
    'Model': 'model',
    'Brand': 'brand',
    'Category': 'category',
    'Description': 'description',
    'ReorderPoint': 'reorderPoint',
    // Add other mappings if your Excel template has more columns
};

// Defines the validation rules for each field (using UPPERCASE keys as they appear in the Excel template)
const FIELD_VALIDATION = {
    'SKU': { type: 'string', mandatory: true },
    'Model': { type: 'string', mandatory: true },
    'Brand': { type: 'string', mandatory: true },
    'Category': { type: 'string', mandatory: true },
    'Description': { type: 'string', mandatory: false },
    'ReorderPoint': { type: 'number', mandatory: false } // Optional, defaults to 0 later
};

const ProductsImportForm = () => {
    const navigate = useNavigate(); // Get the navigate function
    const { products: existingProducts, isOnline, getProductCollectionRef } = useProducts(); // Get existing products list, isOnline status, and collection ref function
    const { lookups } = useLookups(); // Get lookups (if needed for initial validation/checks, but locations come from LocationContext now)
    const { locations, addLocation: rawAddLocation } = useLocations(); // NEW: Get locations and addLocation from LocationContext
    const { appId, db } = useAuth(); // Get appId and db instance from AuthContext
    const { user: currentUser, assignedLocations: rawAssignedLocations } = useUser(); // Get current user info if needed later
    // NEW: Get the global loading state setter
    const { setAppProcessing } = useLoading(); // Get the function to control global loading state

    // Ensure assignedLocations is always an array
    const assignedLocations = rawAssignedLocations || [];

    // --- Form State ---
    const [fileData, setFileData] = useState(null); // Holds the parsed data from the file
    const [status, setStatus] = useState({ state: 'initial', message: 'Ready to import product master data.' });
    const [errors, setErrors] = useState([]); // Holds validation errors
    const [newLookups, setNewLookups] = useState({ brands: [], categories: [] }); // Holds new items found in the file
    const fileInputRef = useRef(null); // Ref for the file input element

    const isReadyToCommit = status.state === 'validated' && errors.length === 0;

    // --- Template Download Function ---
    const handleDownloadTemplate = () => {
        const workbook = XLSX.utils.book_new();
        const worksheetData = [
            ['SKU', 'Model', 'Brand', 'Category', 'Description', 'ReorderPoint'], // Header row
            // Example data row (optional)
            // ['ABC001', 'Widget A', 'Brand X', 'Electronics', 'A useful widget', '10'],
        ];
        const worksheet = XLSX.utils.json_to_sheet(worksheetData, { skipHeader: true });
        XLSX.utils.book_append_sheet(workbook, worksheet, "Product_Template");
        XLSX.writeFile(workbook, "product_import_template.xlsx");
        alert("Import template downloaded to your default downloads folder.");
    };

    // --- File Processing and Validation Function ---
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

                const headers = jsonData[0].map(h => h?.toString().trim()).filter(h => h); // Get headers, ensure strings
                const dataRows = jsonData.slice(1); // Get data rows

                // Validate headers
                const missingHeaders = REQUIRED_FIELDS.filter(field => !headers.includes(field));
                if (missingHeaders.length > 0) {
                    setStatus({ state: 'error', message: `Missing required headers: ${missingHeaders.join(', ')}` });
                    return;
                }

                // Process data rows (PASS existingProductsList AND lookups AS ARGUMENTS)
                const { productsToImport, validationErrors, tempNewBrands, tempNewCategories } = processData(headers, dataRows, existingProducts, lookups);

                if (validationErrors.length > 0) {
                    setErrors(validationErrors);
                    setStatus({ state: 'error', message: 'File contains errors. Please fix before proceeding.' });
                    setFileData(productsToImport); // Show data with errors for review
                    setNewLookups({
                        brands: Array.from(tempNewBrands),
                        categories: Array.from(tempNewCategories)
                    });
                } else {
                    setFileData(productsToImport);
                    setErrors([]);
                    setNewLookups({
                        brands: Array.from(tempNewBrands),
                        categories: Array.from(tempNewCategories)
                    });
                    setStatus({ state: 'validated', message: `${productsToImport.length} products ready for import.` });
                }
            } catch (error) {
                console.error("File processing error:", error);
                setStatus({ state: 'error', message: `Failed to process file: ${error.message}` });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // --- Data Validation and Pre-processing (Updated to accept existingProductsList and lookupData) ---
    // The function now receives existingProductsList and lookupData as arguments to perform checks against them.
    const processData = (headers, dataRows, existingProductsList, lookupData) => { // Receive existingProductsList and lookupData as arguments
        const validationErrors = [];
        const productsToImport = [];
        const tempNewBrands = new Set();
        const tempNewCategories = new Set();
        // Use a Set for efficient duplicate SKU checking within the file AND against existing database products
        const skuSet = new Set(existingProductsList.map(p => p.sku.toLowerCase())); // Initialize with existing product SKUs (case-insensitive comparison)

        // 1. Validate required headers (already done before this function is called by handleFileUpload, but kept for robustness if called elsewhere)
        const missingHeaders = REQUIRED_FIELDS.filter(field => !headers.includes(field));
        if (missingHeaders.length > 0) {
            validationErrors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
            return { productsToImport: [], validationErrors, tempNewBrands, tempNewCategories };
        }

        // 2. Process data rows
        dataRows.forEach((row, rowIndex) => {
            // Skip empty rows
            if (row.every(cell => cell === null || cell === undefined || cell === '')) {
                return;
            }

            const product = {}; // Object to hold the validated row data *before* key mapping
            const mappedProduct = {}; // NEW: Object to hold the data with mapped (lowercase) keys
            let isValid = true; // Assume valid until proven otherwise
            const lineNumber = rowIndex + 2; // +2 because row index starts at 0, and header is row 1

            // Validate each required field against the data in the row
            headers.forEach((header, colIndex) => {
                const value = row[colIndex];
                const fieldDef = FIELD_VALIDATION[header];

                if (!fieldDef) {
                    // Header exists in file but is not defined in FIELD_VALIDATION - treat as optional string or ignore
                    // Map the key to lowercase using FIELD_MAPPING or default to lowercase if not in mapping
                    const mappedKey = FIELD_MAPPING[header] || header.toLowerCase();
                    mappedProduct[mappedKey] = value != null ? value.toString().trim() : '';
                    return; // Skip further validation for unknown fields
                }

                // Mandatory field check
                if (fieldDef.mandatory && (value === null || value === undefined || value.toString().trim() === '')) {
                    validationErrors.push(`Row ${lineNumber}, Column "${header}": Value is required.`);
                    isValid = false; // Mark row as invalid
                    return; // Stop validating other fields for this invalid row if mandatory check fails
                }

                // Type check
                if (value != null && value !== '') { // Only validate type if value exists and is not empty string
                    if (fieldDef.type === 'string') {
                        // Map the key to lowercase using FIELD_MAPPING
                        const mappedKey = FIELD_MAPPING[header];
                        mappedProduct[mappedKey] = value.toString().trim(); // Ensure it's a string and trim
                    } else if (fieldDef.type === 'number') {
                        const num = parseInt(value, 10);
                        if (isNaN(num)) {
                            validationErrors.push(`Row ${lineNumber}, Column "${header}": Value "${value}" must be a number.`);
                            isValid = false;
                        } else {
                            // Map the key to lowercase using FIELD_MAPPING
                            const mappedKey = FIELD_MAPPING[header];
                            mappedProduct[mappedKey] = num; // Store as number
                        }
                    } else {
                        // Future: Handle other types like boolean, date if needed
                        const mappedKey = FIELD_MAPPING[header] || header.toLowerCase();
                        mappedProduct[mappedKey] = value; // Store as-is for now if type is unknown
                    }
                } else {
                    // Value is empty/null/undefined
                    if (fieldDef.type === 'number') {
                        // Map the key to lowercase using FIELD_MAPPING
                        const mappedKey = FIELD_MAPPING[header];
                        mappedProduct[mappedKey] = 0; // Default number to 0 if not provided
                    } else {
                        // Map the key to lowercase using FIELD_MAPPING (or default to lowercase)
                        const mappedKey = FIELD_MAPPING[header] || header.toLowerCase();
                        mappedProduct[mappedKey] = ''; // Default string to empty string if not provided
                    }
                }
            });

            // --- Additional Validation Post-Field Mapping (using mappedProduct keys) ---
            if (mappedProduct.sku) { // Check the lowercase key
                const skuLower = mappedProduct.sku.toLowerCase(); // Use the lowercase key's value
                // Check for duplicate SKU within the *file* being imported
                if (skuSet.has(skuLower)) {
                    validationErrors.push(`Row ${lineNumber}, SKU "${mappedProduct.sku}": Duplicate SKU found within the file.`);
                    isValid = false;
                } else {
                    skuSet.add(skuLower); // Add to set if unique so far within this import session
                }

                // Check for duplicate SKU against *existing* products in the database (loaded via context)
                // Note: existingProductsList is the list passed as an argument, representing the state *at the time this function runs*.
                // If products are added elsewhere while this import page is open, they won't be reflected here unless the context updates.
                // For ultimate accuracy, the check would happen during the batch write using Firestore transactions,
                // but a client-side check provides good UX.
                if (existingProductsList.some(existingProduct => existingProduct.sku.toLowerCase() === skuLower)) {
                     validationErrors.push(`Row ${lineNumber}, SKU "${mappedProduct.sku}": SKU already exists in the database for product "${existingProductsList.find(p => p.sku.toLowerCase() === skuLower).model}".`);
                     isValid = false;
                }
            } else {
                // This should ideally be caught by the mandatory check for SKU, but just in case
                validationErrors.push(`Row ${lineNumber}, Column "SKU": Value is required.`);
                isValid = false;
            }

            // --- Collect New Lookups (Brands, Categories) (using mapped keys) ---
            // Check against existing lookups loaded by LookupContext (passed as argument)
            if (mappedProduct.brand && !lookupData?.brands?.includes(mappedProduct.brand)) { // Use lowercase key 'brand'
                tempNewBrands.add(mappedProduct.brand);
            }
            if (mappedProduct.category && !lookupData?.categories?.includes(mappedProduct.category)) { // Use lowercase key 'category'
                tempNewCategories.add(mappedProduct.category);
            }
            // --- End: Collect New Lookups ---

            // Add to import list if valid
            if (isValid) {
                productsToImport.push(mappedProduct); // Push the object with LOWERCASE keys (e.g., { sku: '...', model: '...', brand: '...' })
            }
        });

        return { productsToImport, validationErrors, tempNewBrands, tempNewCategories };
    };

    // --- Commit Import Function (Batch Write using Firestore SDK) ---
    const handleCommitImport = async () => {
        if (!isReadyToCommit || !fileData || fileData.length === 0) {
            console.error("Cannot commit import: Not ready, no data, or data is empty.");
            return;
        }

        if (!isOnline) {
            alert('Cannot import products in Offline Mode. Please connect to the internet.');
            return;
        }

        // --- NEW: Set Global Loading State ---
        setAppProcessing(true); // Show the global LoadingOverlay
        setStatus({ state: 'processing', message: `Importing ${fileData.length} products...` });
        // --- END: Set Global Loading State ---

        try {
            const batch = writeBatch(db); // Create a Firestore batch operation using the db instance from AuthContext
            const productColRef = getProductCollectionRef(); // Use the function from ProductContext to get the correct collection path

            // A. Update Lookup Collections (if new items were found) - This happens *before* adding products
            // so that products can reference the new lookups if needed (though unlikely for brand/cat just added in this batch).
            // It's safer to update lookups first.
            if (newLookups.brands.length > 0 || newLookups.categories.length > 0) {
                // Assuming lookups are stored in /artifacts/{appId}/lookups/metadata
                const lookupDocRef = doc(db, `/artifacts/${appId}/lookups`, 'metadata');
                const updates = {};
                if (newLookups.brands.length > 0) {
                    updates.brands = arrayUnion(...newLookups.brands);
                }
                if (newLookups.categories.length > 0) {
                    updates.categories = arrayUnion(...newLookups.categories);
                }
                // Only update if there are fields to update
                if (Object.keys(updates).length > 0) {
                    batch.update(lookupDocRef, updates);
                }
            }

            // B. Add New Products (Batch operation)
            fileData.forEach(item => { // item here now has lowercase keys (e.g., { sku: '...', model: '...', brand: '...' })
                const newProductRef = doc(productColRef); // Firestore generates a unique ID

                // Ensure ReorderPoint is a number (should already be from processData, but ensure here too)
                // Use the lowercase key 'reorderPoint'
                const safeReorderPoint = typeof item.reorderPoint === 'number' && !isNaN(item.reorderPoint) ? item.reorderPoint : 0;

                batch.set(newProductRef, {
                    ...item, // Spread the validated item data with LOWERCASE keys (e.g., { sku: '...', model: '...', brand: '...' })
                    // Override reorderPoint with the safe, validated value (using lowercase key)
                    reorderPoint: safeReorderPoint,
                    // Add timestamps if needed by your schema
                    createdAt: serverTimestamp(), // Requires import { serverTimestamp } from 'firebase/firestore'
                    updatedAt: serverTimestamp(), // Requires import { serverTimestamp } from 'firebase/firestore'
                    // Add other specific attributes here if needed, e.g.:
                    // createdBy: userId, // Optional: track creator
                });
            });

            await batch.commit(); // Execute the batch write
            console.log(`Batch import of ${fileData.length} products committed successfully.`);

            // --- NEW: Clear Global Loading State (Success Path) ---
            setAppProcessing(false); // Hide the global LoadingOverlay
            // --- END: Clear Global Loading State ---

            // Show success message
            alert(`${fileData.length} products imported successfully!`);
            setStatus({ state: 'success', message: `${fileData.length} products imported successfully!` });

            // Clear the form state after successful import
            setFileData(null);
            setErrors([]);
            setNewLookups({ brands: [], categories: [] });
            setStatus({ state: 'initial', message: 'Ready to import product master data.' });
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Clear the file input field
            }

            // Navigate back after a short delay or on user action
            // setTimeout(() => navigate('/products'), 2000); // Example auto-navigate after success
            // Or let user click 'Back to Products' button

        } catch (error) {
            console.error("Batch import (via writeBatch) failed:", error);
            // --- NEW: Clear Global Loading State (Error Path) ---
            setAppProcessing(false); // Hide the global LoadingOverlay even on error
            // --- END: Clear Global Loading State ---

            setStatus({ state: 'error', message: `Import failed: ${error.message}` });
            alert(`Import failed: ${error.message}`);
        }
    };

    // --- Reset Form Function (Clears File Input and States) ---
    const handleReset = () => {
        // Clear file input field in the DOM
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Reset all state related to the import process
        setFileData(null);
        setErrors([]);
        setNewLookups({ brands: [], categories: [] });
        setStatus({ state: 'initial', message: 'Ready to import product master data.' });
        // Do NOT reset 'existingProducts', 'lookups', or 'locations' state as they come from context
    };

    // --- Render Logic ---
    return (
        <div className="min-h-screen bg-gray-100">
            {/* NEW: Render Global LoadingOverlay if global state indicates loading */}
            {/* This should ideally be in App.jsx, but if rendered here, it's only for this form's processing state */}
            {/* {status.state === 'processing' && <LoadingOverlay />} */}

            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Bulk Import Products</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={handleReset} // Call the reset function
                            className="btn btn-outline-danger" // Use themed button
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => navigate('/products')} // Navigate back
                            className="btn btn-outline-primary" // Use themed button
                            title='Go back to Products'
                        >
                            Back to Products
                        </button>
                    </div>
                </div>

                {/* Instructions and Download Template */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h2 className="text-lg font-semibold text-blue-800 mb-2">Instructions</h2>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-blue-700">
                        <li>Download the Excel template below.</li>
                        <li>Fill in the required fields (*). Ensure SKUs are unique within the file and do not already exist in the database.</li>
                        <li>Save the file as .xlsx or .csv format.</li>
                        <li>Upload the file using the button below.</li>
                        <li>Review the data and resolve any errors.</li>
                        <li>Click "Commit Import" to add the products.</li>
                    </ol>
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="mt-3 btn btn-secondary" // Use themed button
                    >
                        Download Import Template
                    </button>
                </div>

                {/* File Upload */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Product File (.xlsx or .csv)
                    </label>
                    <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        ref={fileInputRef} // Attach ref
                        disabled={status.state === 'processing'} // Disable input while processing (optional, good UX)
                        className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-indigo-50 file:text-indigo-700
                            hover:file:bg-indigo-100
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                </div>

                {/* Status Message */}
                {status.message && status.state !== 'processing' && ( // Don't show local status message if global overlay is active (state is 'processing')
                    <div className={`mb-4 p-3 rounded-md ${
                        status.state === 'error' ? 'bg-red-100 text-red-700' :
                        status.state === 'success' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                    }`}>
                        {status.message}
                    </div>
                )}

                {/* Errors Display */}
                {errors.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-md font-semibold text-red-600 mb-2">Validation Errors:</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            {errors.map((error, index) => (
                                <li key={index} className="text-sm text-red-600">{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* New Lookups Preview */}
                {(newLookups?.brands?.length > 0 || newLookups?.categories?.length > 0) && (
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
                        <h3 className="text-md font-semibold text-yellow-800 mb-2">New Items to be Added:</h3>
                        {newLookups?.brands?.length > 0 && (
                            <div className="mb-2">
                                <span className="font-medium text-yellow-700">Brands:</span>
                                <span className="ml-2 text-sm text-yellow-600">{newLookups.brands?.join(', ') || ''}</span>
                            </div>
                        )}
                        {newLookups?.categories?.length > 0 && (
                            <div>
                                <span className="font-medium text-yellow-700">Categories:</span>
                                <span className="ml-2 text-sm text-yellow-600">{newLookups.categories?.join(', ') || ''}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Data Preview Table (only if processed and no errors) */}
                {fileData && errors.length === 0 && (
                    <div className="mb-6 overflow-x-auto">
                        <h3 className="text-md font-semibold text-gray-700 mb-2">Data Preview (First 10 of {fileData.length} items):</h3>
                        <table className="table-base min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    {REQUIRED_FIELDS.map(field => (
                                        <th key={field} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {FIELD_MAPPING[field] || field} {/* Display mapped lowercase name or original if not mapped */}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {fileData.slice(0, 10).map((row, index) => ( // Show first 10
                                    <tr key={index} className="hover:bg-gray-50">
                                        {REQUIRED_FIELDS.map(field => {
                                            const mappedKey = FIELD_MAPPING[field] || field.toLowerCase(); // Get the mapped key
                                            return (
                                                <td key={`${index}-${field}`} className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                                    {row[mappedKey]?.toString() || ''} {/* Access the row using the mapped key and ensure display as string */}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {fileData.length > 10 && (
                                    <tr>
                                        <td colSpan={REQUIRED_FIELDS.length} className="px-4 py-2 text-center text-sm text-gray-500 italic">
                                            ... and {fileData.length - 10} more rows
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Action Buttons (Top buttons already present) */}
                {/* Removed duplicate Reset and Back to Products buttons from the bottom */}
                <div className="flex justify-end"> {/* Align the commit button to the right, keeping top buttons */}
                    <button
                        onClick={handleCommitImport}
                        disabled={!isReadyToCommit || !isOnline || status.state === 'processing'}
                        className={`btn btn-primary ${(!isReadyToCommit || !isOnline || status.state === 'processing') ? 'opacity-50 cursor-not-allowed' : ''}`} // Use themed button
                    >
                        {status.state === 'processing' ? 'Importing...' : `Commit Import (${fileData?.length || 0} Items)`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductsImportForm;