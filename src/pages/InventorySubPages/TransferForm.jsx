// src/pages/InventorySubPages/TransferForm.jsx

// ===== UPDATE IMPORTS =====
import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select'; // NEW: Import react-select
import { useNavigate } from 'react-router-dom'; // Import useNavigate for routing
import { useInventory } from '../../contexts/InventoryContext';
import { useProducts } from '../../contexts/ProductContext'; // Changed hook name
import { useLocations } from '../../contexts/LocationContext'; // NEW: Use LocationContext
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import { useLoading } from '../../contexts/LoadingContext';
import LoadingOverlay from '../../components/LoadingOverlay';
// Import localforage for caching form state
import localforage from 'localforage';
// Keep export libraries
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // Import the autoTable plugin
// =========================

// --- LocalForage Store Setup for Form State ---
const FORM_STATE_STORE_NAME = 'formStatesCache';
const formStateStore = localforage.createInstance({
    name: "inventoryApp", // Use the same app name as other caches
    storeName: FORM_STATE_STORE_NAME,
});
// Define unique keys for each form's state
const FORM_STATE_KEYS = {
    STOCK_IN: 'formState_stockIn',
    STOCK_OUT: 'formState_stockOut',
    TRANSFER: 'formState_transfer',
};
// =========================

// Helper function to get product details by SKU
const getProductBySku = (products, sku) => {
    return products.find(p => p.sku === sku);
};

// Helper function to get model display name
const getProductDisplayName = (product) => {
    if (product) {
        return `${product.sku} - ${product.model || 'N/A'}`;
    }
    return 'Unknown Product';
};

const TransferForm = () => {
    const navigate = useNavigate(); // Hook for navigation
    const { stockLevels, createTransaction } = useInventory();
    const { products } = useProducts(); // Changed hook name
    // NEW: Get locations and addLocation from LocationContext
    const { locations, addLocation: rawAddLocation, isLoading: isLocationsLoading } = useLocations(); // NEW: Use LocationContext
    const { userId, currentUser: authUser } = useAuth(); // Get auth user object to get email
    const { assignedLocations: rawAssignedLocations } = useUser();

    // Locations are now an array of objects: [{id, name, ...}]
    // Extract just the names for the dropdown
    const locationNames = locations.map(loc => loc.name);
    const assignedLocations = rawAssignedLocations || []; // Ensure it's always an array

    // --- Form State (with persistence) ---
    const [referenceNumber, setReferenceNumber] = useState(''); // Will be generated on commit
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [notes, setNotes] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [items, setItems] = useState([{ sku: null, fromLocation: '', toLocation: '', quantity: 1 }]); // Initial empty line, sku is object/null
    const [newFromLocationName, setNewFromLocationName] = useState('');
    const [newToLocationName, setNewToLocationName] = useState('');
    const [addingFromLocation, setAddingFromLocation] = useState(false);
    const [addingToLocation, setAddingToLocation] = useState(false);

    // --- NEW: State for Loading Overlay ---
    const [isAppProcessing, setIsAppProcessing] = useLoading();

    // --- State for Loading Indicator ---
    const [isLoadingFormState, setIsLoadingFormState] = useState(true);

    // --- NEW: State for Export Dropdown Menu ---
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // --- Memoize product options for react-select ---
    const productOptions = useMemo(() => {
        return products.map(product => ({
            value: product.sku,
            label: getProductDisplayName(product),
        }));
    }, [products]); // Recalculate if the products list changes

    // --- Load Saved State on Mount (Effect) ---
    useEffect(() => {
        let isCancelled = false;

        const loadSavedState = async () => {
            setIsLoadingFormState(true);
            try {
                const savedState = await formStateStore.getItem(FORM_STATE_KEYS.TRANSFER); // Use TRANSFER key
                if (savedState && !isCancelled) {
                    console.log("[TransferForm] Loading saved state from cache:", savedState);
                    // --- RESTORE STATE: Need to convert saved SKU strings back to react-select objects ---
                    const restoredItems = savedState.items.map(item => ({
                        ...item,
                        // Find the corresponding option object for the saved SKU string
                        sku: productOptions.find(opt => opt.value === item.sku) || null, // Use the option object or null if not found
                    }));
                    // Restore state from cache
                    setReferenceNumber(savedState.referenceNumber || '');
                    setTransactionDate(savedState.transactionDate || new Date().toISOString().split('T')[0]);
                    setNotes(savedState.notes || '');
                    setDocumentNumber(savedState.documentNumber || '');
                    setItems(restoredItems); // Use the converted items array
                    setNewFromLocationName(savedState.newFromLocationName || '');
                    setNewToLocationName(savedState.newToLocationName || '');
                    setAddingFromLocation(savedState.addingFromLocation || false);
                    setAddingToLocation(savedState.addingToLocation || false);
                } else {
                    console.log("[TransferForm] No saved state found for Transfer form.");
                    // State remains with initial default values if no saved state exists
                }
            } catch (error) {
                console.error("[TransferForm] Error loading saved form state:", error);
                // If loading fails, proceed with default initial state
                // Optionally, show an alert or log to an error reporting service
            } finally {
                if (!isCancelled) {
                    setIsLoadingFormState(false);
                }
            }
        };

        loadSavedState();

        return () => {
            isCancelled = true;
        };
    }, [productOptions]); // Add productOptions as a dependency because the restoration logic uses it

    // --- Save State on Relevant Changes (Effect) ---
    useEffect(() => {
        // Only save if the form state has finished loading initially
        if (!isLoadingFormState) {
            // --- SAVE STATE: Convert react-select SKU objects back to strings ---
            const stateToSave = {
                referenceNumber,
                transactionDate,
                notes,
                documentNumber,
                // Map items to convert react-select objects back to strings for storage
                items: items.map(item => ({
                    ...item,
                    // Extract the SKU string from the react-select value object
                    sku: item.sku ? item.sku.value : '', // Use item.sku.value if sku is an object, otherwise use empty string
                    // Do NOT save currentQty as it's derived from context
                    currentQty: undefined,
                })),
                newFromLocationName,
                newToLocationName,
                addingFromLocation,
                addingToLocation,
            };
            // ---

            const saveState = async () => {
                try {
                    await formStateStore.setItem(FORM_STATE_KEYS.TRANSFER, stateToSave); // Use TRANSFER key
                    console.log("[TransferForm] State saved to cache.");
                } catch (error) {
                    console.error("[TransferForm] Error saving form state:", error);
                    // Optionally, show an alert or log to an error reporting service
                    // Saving to cache is a convenience; failure shouldn't break the core functionality.
                }
            };

            // Debounce the save operation slightly to avoid saving on every keystroke
            const saveTimer = setTimeout(saveState, 500); // Save 500ms after the last change

            // Cleanup the timer if the effect runs again before the timeout
            return () => clearTimeout(saveTimer);
        }
    }, [referenceNumber, transactionDate, notes, documentNumber, items, newFromLocationName, newToLocationName, addingFromLocation, addingToLocation, isLoadingFormState]); // Watch all state variables that make up the form data AND the loading state


    // --- Generate Reference Number (Client-side, based on email prefix and timestamp) ---
    const generateReferenceNumber = (userEmail) => {
        const userPrefix = (userEmail || 'USER').slice(0, 4).toUpperCase();
        const now = new Date();
        const timestampPart = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        return `${userPrefix}-TRF-${timestampPart}`;
    };

    // --- Handle Item Changes ---
    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        // --- UPDATE: Handle react-select value (object) for 'sku' field ---
        if (field === 'sku') {
            // 'value' is the option object { value: '...', label: '...' } from react-select
            newItems[index][field] = value; // Store the entire option object
        } else {
            // Handle other fields (fromLocation, toLocation, quantity) as strings/numbers
            newItems[index][field] = value;
        }
        // ---
        // If SKU or From Location changes, update Current Qty (assuming currentQty relates to 'from' location for transfers)
        if (field === 'sku' || field === 'fromLocation') {
            // Extract the SKU string from the react-select object if 'sku' changed, otherwise use the old string
            const skuToCheck = field === 'sku' ? (newItems[index].sku ? newItems[index].sku.value : '') : (newItems[index].sku ? newItems[index].sku.value : newItems[index].sku); // Handle case where sku might be a string (during load/save) or object (during interaction)
            const product = getProductBySku(products, skuToCheck);
            // Use the 'from' location *from the specific item being changed* to calculate currentQty
            const currentQty = product ? (stockLevels[skuToCheck] || {})[newItems[index].fromLocation] || 0 : 0;
            newItems[index].currentQty = currentQty;
        }
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { sku: null, fromLocation: '', toLocation: '', quantity: 1, currentQty: 0 }]);
    };

    // --- UPDATE: Handle Item Removal (Correctly) ---
    const handleRemoveItem = (indexToRemove) => { // Accept the specific index to remove
        if (items.length <= 1) return; // Prevent removing the last item
        const newItems = [...items];
        newItems.splice(indexToRemove, 1); // Remove the item at the specific index
        setItems(newItems);
    };
    // ---

    // --- Handle Location Creation ---
    const handleAddNewFromLocation = async () => {
        if (!newFromLocationName.trim()) {
            alert('Please enter a new "From" location name.');
            return;
        }
        try {
            // Use the new addLocation function from LocationContext
            await rawAddLocation({ name: newFromLocationName }); // Pass as object
            setNewFromLocationName(''); // Clear input
            setAddingFromLocation(false); // Hide input
            // The LocationContext listener should update the locations list automatically
        } catch (error) {
            console.error("Failed to add new 'From' location:", error);
            alert(error.message);
        }
    };

    const handleAddNewToLocation = async () => {
        if (!newToLocationName.trim()) {
            alert('Please enter a new "To" location name.');
            return;
        }
        try {
            // Use the new addLocation function from LocationContext
            await rawAddLocation({ name: newToLocationName }); // Pass as object
            setNewToLocationName(''); // Clear input
            setAddingToLocation(false); // Hide input
            // The LocationContext listener should update the locations list automatically
        } catch (error) {
            console.error("Failed to add new 'To' location:", error);
            alert(error.message);
        }
    };

    // --- Handle Form Submission ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form data
        if (items.some(item => !item.sku?.value || !item.fromLocation || !item.toLocation || item.quantity <= 0 || item.fromLocation === item.toLocation)) {
            alert('Please fill in all SKU, From Location, To Location, and Quantity fields correctly. "From" and "To" locations must be different.');
            return;
        }

        // Optional: Validate sufficient stock before committing
        for (const item of items) {
            const currentQty = (stockLevels[item.sku.value] || {})[item.fromLocation] || 0;
            if (currentQty < item.quantity) {
                alert(`Insufficient stock for SKU ${item.sku.label} at "From" location ${item.fromLocation}. Requested: ${item.quantity}, Available: ${currentQty}`);
                return;
            }
        }

        // Generate reference number just before commit
        const refNumber = generateReferenceNumber(authUser?.email); // Use email from auth context

        try {
            // Prepare transaction data
            const transactionData = {
                type: 'TRANSFER',
                referenceNumber: refNumber, // Use generated number
                transactionDate: new Date(transactionDate), // Store as Date object or ISO string
                notes: notes,
                documentNumber: documentNumber,
                items: items.map(item => ({
                    sku: item.sku.value, // Extract the SKU string from the react-select object
                    fromLocation: item.fromLocation,
                    toLocation: item.toLocation,
                    quantity: item.quantity,
                    // currentQty is for display only, not stored in transaction
                })),
                userId: userId,
                // The serverTimestamp will be added by the context
            };

            console.log("Attempting to commit Transfer:", transactionData); // Debug log

            // Call context function to create transaction
            await createTransaction(transactionData);
            alert('Transfer transaction recorded successfully!');

            // --- CLEAR SAVED STATE ON SUCCESS ---
            try {
                await formStateStore.removeItem(FORM_STATE_KEYS.TRANSFER); // Use TRANSFER key
                console.log("[TransferForm] Saved state cleared after successful submission.");
            } catch (clearError) {
                console.error("[TransferForm] Error clearing saved state after submission:", clearError);
                // Log the error, but don't prevent navigation. The transaction was successful.
            }
            // --- END: CLEAR SAVED STATE ---

            // Navigate back or reset form
            navigate('/inventory'); // Or reset state to clear form
        } catch (error) {
            console.error('Transfer failed:', error);
            alert(`Failed to record Transfer: ${error.message}`);
        }
    };

    // --- Handle Form Reset (Clears Saved State Too) ---
    const handleReset = () => {
        // Reset all form fields to their initial state
        setReferenceNumber(''); // Reference number will regenerate on next commit
        setTransactionDate(new Date().toISOString().split('T')[0]); // Reset to today
        setNotes('');
        setDocumentNumber('');
        setItems([{ sku: null, fromLocation: '', toLocation: '', quantity: 1 }]); // Reset to one empty line, sku as null
        setNewFromLocationName(''); // Clear new "From" location input
        setNewToLocationName(''); // Clear new "To" location input
        setAddingFromLocation(false); // Hide "From" add input
        setAddingToLocation(false); // Hide "To" add input
        setIsExportMenuOpen(false); // Close export menu if open
        // No need to reset 'locations' or 'products' state as they come from context

        // --- CLEAR SAVED STATE ON RESET ---
        formStateStore.removeItem(FORM_STATE_KEYS.TRANSFER) // Use TRANSFER key
            .then(() => console.log("[TransferForm] Saved state cleared on Reset."))
            .catch(error => console.error("[TransferForm] Error clearing saved state on Reset:", error));
        // --- END: CLEAR SAVED STATE ---
    };

    // --- Export Current Items List (Before Commit) ---
    const exportCurrentItems = (format) => {
        if (!items || items.length === 0 || items.every(item => !item.sku?.value && !item.fromLocation && !item.toLocation && item.quantity === 1)) {
            alert('No items to export.');
            return;
        }

        const exportData = items.map(item => ({
            SKU: item.sku?.label || 'N/A', // Use label for display
            'From Location': item.fromLocation || '',
            'To Location': item.toLocation || '',
            Quantity: item.quantity || 0,
        }));

        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Pending_Transfers');
            XLSX.writeFile(wb, 'pending_transfers.xlsx');
            alert("Excel file exported successfully to your default download folder!");
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text("Pending Transfers", 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

            autoTable(doc, {
                head: [['SKU (Display)', 'From Location', 'To Location', 'Quantity']],
                body: exportData.map(row => [row.SKU, row['From Location'], row['To Location'], row.Quantity]), // Use bracket notation for keys with spaces
                startY: 36,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [33, 150, 243] },
            });

            doc.save('pending_transfers.pdf');
            alert("PDF file exported successfully to your default download folder!");
        }
        // Close the export menu after export
        setIsExportMenuOpen(false);
    };

    // --- Calculate Available Locations for a specific item (from and to) ---
    const getAvailableLocationsForItem = (itemIndex, type) => { // type is 'from' or 'to'
        let locs = locationNames; // Start with the names from the context
        if (type === 'from' && assignedLocations.length > 0) {
            // For "From" location, restrict to assigned locations if any exist
            locs = locs.filter(locName => assignedLocations.includes(locName));
        }
        // "To" location is unrestricted by default for now
        if (type === 'from' && addingFromLocation && itemIndex === items.length - 1) {
             locs = [newFromLocationName.trim(), ...locs]; // Add new "From" name to the top of the list for this specific item's dropdown
        }
        if (type === 'to' && addingToLocation && itemIndex === items.length - 1) {
             locs = [newToLocationName.trim(), ...locs]; // Add new "To" name to the top of the list for this specific item's dropdown
        }
        return locs;
    };

    // --- Render Logic ---
    if (isLoadingFormState || isLocationsLoading) {
        return <div className="p-8 text-xl text-center">Loading Transfer Form...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Transfer</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={handleReset}
                            className="btn btn-outline-danger"
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => navigate('/inventory')} // Navigate back
                            className="btn btn-outline-primary"
                            title='Go back to Inventory'
                        >
                            Back to Inventory
                        </button>
                    </div>
                </div>

                {/* Form Fields */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                            <input
                                type="text"
                                value={referenceNumber || 'Will be generated on commit'} // Show placeholder until commit
                                readOnly // Generated, not user-editable
                                className="input-base bg-gray-100" // Use themed input, make readonly bg obvious
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Date</label>
                            <input
                                type="date"
                                value={transactionDate}
                                onChange={(e) => setTransactionDate(e.target.value)}
                                className="input-base"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Document Number</label>
                            <input
                                type="text"
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                                placeholder="Optional"
                                className="input-base"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2" // Reduced rows for compactness
                            className="input-base"
                        />
                    </div>

                    {/* Item Lines Table */}
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                        <table className="table-base">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Location</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Location</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Qty (From)</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {items.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        {/* Product Selection Cell (NEW: Using react-select) */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {/* Use react-select for searchable product selection */}
                                            {/* Add menuPortalTarget={document.body} to render dropdown outside table boundaries */}
                                            <Select
                                                value={item.sku} // Bind to item.sku (the option object or null)
                                                onChange={(selectedOption) => handleItemChange(index, 'sku', selectedOption)} // Pass the selected option object
                                                options={productOptions} // Pass the formatted options array
                                                placeholder="Select Product..." // Placeholder text
                                                isClearable={true} // Allow clearing the selection
                                                isSearchable={true} // Enable search functionality
                                                className="basic-single" // Base class for styling (optional, react-select provides base styles)
                                                classNamePrefix="select" // Prefix for generated class names (optional)
                                                menuPortalTarget={document.body} // NEW: Render the menu in the body to avoid clipping
                                            />
                                        </td>
                                        {/* From Location Selection Cell (Updated to use new keying logic) */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <select
                                                    value={item.fromLocation} // Bind to item.fromLocation
                                                    onChange={(e) => handleItemChange(index, 'fromLocation', e.target.value)} // Update item.fromLocation
                                                    className="flex-1 p-1 border border-gray-300 rounded"
                                                >
                                                    <option value="">Select From</option>
                                                    {/* Iterate over the calculated effectiveLocationNames for 'from' */}
                                                    {getAvailableLocationsForItem(index, 'from').map(locName => {
                                                        // Find the corresponding location object to get its ID for the key
                                                        const locationObj = locations.find(loc => loc.name === locName);
                                                        // Determine the key
                                                        // If locationObj is found (it's a real location from the context), use its ID.
                                                        // If locationObj is not found (e.g., for the temporary name being added via input), use a unique fallback key.
                                                        const key = locationObj ? locationObj.id : `temp_from_loc_${index}_${locName}`;
                                                        return (
                                                            <option key={key} value={locName}>{locName}</option> // Use the determined unique key
                                                        );
                                                    })}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setAddingFromLocation(true)}
                                                    className="ml-1 px-2 py-1 btn btn-outline-secondary" // Use themed button
                                                >
                                                    +
                                                </button>
                                            </div>
                                            {addingFromLocation && index === items.length - 1 && ( // Show input only for the last row if adding "From"
                                                <div className="mt-1 flex gap-1">
                                                    <input
                                                        type="text"
                                                        value={newFromLocationName}
                                                        onChange={(e) => setNewFromLocationName(e.target.value)}
                                                        placeholder="New From Location"
                                                        className="flex-1 p-1 border border-gray-300 rounded"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddNewFromLocation}
                                                        className="ml-1 px-2 py-1 btn btn-success" // Use themed button
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAddingFromLocation(false);
                                                            setNewFromLocationName('');
                                                        }}
                                                        className="ml-1 px-2 py-1 btn btn-danger" // Use themed button
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        {/* To Location Selection Cell (Updated to use new keying logic) */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <select
                                                    value={item.toLocation} // Bind to item.toLocation
                                                    onChange={(e) => handleItemChange(index, 'toLocation', e.target.value)} // Update item.toLocation
                                                    className="flex-1 p-1 border border-gray-300 rounded"
                                                >
                                                    <option value="">Select To</option>
                                                    {/* Iterate over the calculated effectiveLocationNames for 'to' */}
                                                    {getAvailableLocationsForItem(index, 'to').map(locName => {
                                                        // Find the corresponding location object to get its ID for the key
                                                        const locationObj = locations.find(loc => loc.name === locName);
                                                        // Determine the key
                                                        // If locationObj is found (it's a real location from the context), use its ID.
                                                        // If locationObj is not found (e.g., for the temporary name being added via input), use a unique fallback key.
                                                        const key = locationObj ? locationObj.id : `temp_to_loc_${index}_${locName}`;
                                                        return (
                                                            <option key={key} value={locName}>{locName}</option> // Use the determined unique key
                                                        );
                                                    })}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setAddingToLocation(true)}
                                                    className="ml-1 px-2 py-1 btn btn-outline-secondary" // Use themed button
                                                >
                                                    +
                                                </button>
                                            </div>
                                            {addingToLocation && index === items.length - 1 && ( // Show input only for the last row if adding "To"
                                                <div className="mt-1 flex gap-1">
                                                    <input
                                                        type="text"
                                                        value={newToLocationName}
                                                        onChange={(e) => setNewToLocationName(e.target.value)}
                                                        placeholder="New To Location"
                                                        className="flex-1 p-1 border border-gray-300 rounded"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddNewToLocation}
                                                        className="ml-1 px-2 py-1 btn btn-success" // Use themed button
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAddingToLocation(false);
                                                            setNewToLocationName('');
                                                        }}
                                                        className="ml-1 px-2 py-1 btn btn-danger" // Use themed button
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                            {item.currentQty || 0}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                                min="1"
                                                className="w-20 p-1 border border-gray-300 rounded"
                                            />
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)} // Pass the specific index
                                                className="btn btn-outline-danger btn-sm" // Use themed button, small size
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="btn btn-outline-primary"
                        >
                            + Add Line
                        </button>

                        {/* NEW: Export Dropdown Button */}
                        <div className="relative inline-block text-left">
                            <button
                                type="button"
                                className="btn btn-outline-secondary mr-2" // Use themed button
                                aria-haspopup="true"
                                aria-expanded={isExportMenuOpen} // Reflect state for accessibility
                                title="Export Current Items List"
                                onClick={() => setIsExportMenuOpen(prev => !prev)} // Toggle menu on click
                            >
                                Export List
                            </button>
                            {/* Dropdown Menu - Positioned absolutely relative to the container */}
                            {/* Show based on isExportMenuOpen state */}
                            {/* Add z-index to ensure it appears above other elements */}
                            {/* Add shadow and border for visual distinction */}
                            <div
                                id="export-list-menu" // Give it an ID for potential external closing logic
                                className={`absolute right-0 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-10 transition-opacity duration-100 ${
                                    isExportMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
                                }`}
                                // Optional: Add onClick handler to the menu itself to prevent closing if clicking inside
                                // onClick={(e) => e.stopPropagation()} // This stops the click from bubbling up to the document
                            >
                                {/* Use a list for semantic structure */}
                                <ul role="none" className="py-1">
                                    {/* Export to PDF Option - Default */}
                                    <li>
                                        <button
                                            onClick={() => { exportCurrentItems('pdf'); setIsExportMenuOpen(false); }} // Execute export and close menu
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" // Apply themed styling to the button
                                            role="menuitem"
                                        >
                                            Export as PDF (.pdf)
                                        </button>
                                    </li>
                                    {/* Export to Excel Option */}
                                    <li>
                                        <button
                                            onClick={() => { exportCurrentItems('excel'); setIsExportMenuOpen(false); }} // Execute export and close menu
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" // Apply themed styling to the button
                                            role="menuitem"
                                        >
                                            Export as Excel (.xlsx)
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/* End of NEW: Export Dropdown Button */}

                        <button
                            type="submit"
                            className="btn btn-secondary" // Use themed button (secondary for Transfer)
                        >
                            Commit Transfer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransferForm;