// src/pages/InventorySubPages/StockOutForm.jsx

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

const StockOutForm = () => {
    const navigate = useNavigate(); // Hook for navigation
    const { stockLevels, createTransaction } = useInventory();
    const { products } = useProducts(); // Changed hook name
    // NEW: Get locations and addLocation from LocationContext
    const { locations, addLocation: rawAddLocation, isLoading: isLocationsLoading } = useLocations(); // NEW: Use LocationContext
    const { userId, currentUser: authUser } = useAuth(); // Get auth user object to get email
    const { assignedLocations: rawAssignedLocations } = useUser();

    const assignedLocations = rawAssignedLocations || []; // Ensure it's always an array

    // --- NEW: State for Export Dropdown Menu ---
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // --- Memoize product options for react-select ---
    // Format products into options { value: sku, label: displayName }
    const productOptions = useMemo(() => {
        return products.map(product => ({
            value: product.sku, // Use SKU as the value
            label: getProductDisplayName(product), // Use formatted display name as the label
            // Optionally, store the full product object if needed later for other fields
            // product: product
        }));
    }, [products]); // Recalculate if the products list changes

    // --- Form State (Now with persistence) ---
    const [referenceNumber, setReferenceNumber] = useState(''); // Will be generated on commit
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [notes, setNotes] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [items, setItems] = useState([{ sku: null, location: '', quantity: 1, reason: 'sale' }]); // Initial empty line, sku is now an object or null
    const [newLocationName, setNewLocationName] = useState('');
    const [addingLocation, setAddingLocation] = useState(false);

    // --- NEW: State for Loading Overlay ---
    const { isAppProcessing, setAppProcessing } = useLoading();

    // --- State for Loading Indicator ---
    const [isLoadingFormState, setIsLoadingFormState] = useState(true); // New state to manage initial load

    // --- Load Saved State on Mount (Effect) ---
    useEffect(() => {
        let isCancelled = false; // Flag to prevent state updates if component unmounts quickly

        const loadSavedState = async () => {
            setIsLoadingFormState(true); // Indicate loading state
            try {
                const savedState = await formStateStore.getItem(FORM_STATE_KEYS.STOCK_OUT); // Use STOCK_OUT key
                if (savedState && !isCancelled) {
                    console.log("[StockOutForm] Loading saved state from cache:", savedState);
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
                    setNewLocationName(savedState.newLocationName || '');
                    setAddingLocation(savedState.addingLocation || false);
                } else {
                    console.log("[StockOutForm] No saved state found for Stock Out form.");
                    // State remains with initial default values if no saved state exists
                }
            } catch (error) {
                console.error("[StockOutForm] Error loading saved form state:", error);
                // If loading fails, proceed with default initial state
                // Optionally, show an alert or log to an error reporting service
            } finally {
                if (!isCancelled) {
                    setIsLoadingFormState(false); // Stop loading indicator
                }
            }
        };

        loadSavedState();

        // Cleanup function to set the cancellation flag if component unmounts
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
                newLocationName,
                addingLocation,
            };
            // ---

            const saveState = async () => {
                try {
                    await formStateStore.setItem(FORM_STATE_KEYS.STOCK_OUT, stateToSave); // Use STOCK_OUT key
                    console.log("[StockOutForm] State saved to cache.");
                } catch (error) {
                    console.error("[StockOutForm] Error saving form state:", error);
                    // Optionally, show an alert or log to an error reporting service
                    // Saving to cache is a convenience; failure shouldn't break the core functionality.
                }
            };

            // Debounce the save operation slightly to avoid saving on every keystroke
            const saveTimer = setTimeout(saveState, 500); // Save 500ms after the last change

            // Cleanup the timer if the effect runs again before the timeout
            return () => clearTimeout(saveTimer);
        }
    }, [referenceNumber, transactionDate, notes, documentNumber, items, newLocationName, addingLocation, isLoadingFormState]); // Watch all state variables that make up the form data AND the loading state


    // --- Generate Reference Number (Client-side, based on email prefix and timestamp) ---
    const generateReferenceNumber = (userEmail) => {
        const userPrefix = (userEmail || 'USER').slice(0, 4).toUpperCase();
        const now = new Date();
        const timestampPart = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        return `${userPrefix}-OUT-${timestampPart}`;
    };

    // --- Handle Item Changes ---
    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        // --- UPDATE: Handle react-select value (object) for 'sku' field ---
        if (field === 'sku') {
            // 'value' is the option object { value: '...', label: '...' } from react-select
            newItems[index][field] = value; // Store the entire option object
        } else {
            // Handle other fields (location, quantity, reason) as strings/numbers
            newItems[index][field] = value;
        }
        // ---
        // If SKU or Location changes, update Current Qty
        if (field === 'sku' || field === 'location') {
            // Extract the SKU string from the react-select object if 'sku' changed, otherwise use the old string
            const skuToCheck = field === 'sku' ? (newItems[index].sku ? newItems[index].sku.value : '') : (newItems[index].sku ? newItems[index].sku.value : newItems[index].sku); // Handle case where sku might be a string (during load/save) or object (during interaction)
            const product = getProductBySku(products, skuToCheck);
            // Use the location *from the specific item being changed* to calculate currentQty
            const currentQty = product ? (stockLevels[skuToCheck] || {})[newItems[index].location] || 0 : 0;
            newItems[index].currentQty = currentQty;
        }
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { sku: null, location: '', quantity: 1, reason: 'sale', currentQty: 0 }]);
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
    const handleAddNewLocation = async () => {
        if (!newLocationName.trim()) {
            alert('Please enter a new location name.');
            return;
        }
        setAppProcessing(true);
        try {
            // Use the new addLocation function from LocationContext
            await rawAddLocation({ name: newLocationName }); // Pass as object
            setNewLocationName(''); // Clear input
            setAddingLocation(false); // Hide input
            // The LocationContext listener should update the locations list automatically
        } catch (error) {
            console.error("Failed to add new location:", error);
            alert(error.message);
        }
        finally{
            setAppProcessing(false);
        }
    };

    // --- Handle Form Submission ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form data
        if (items.some(item => !item.sku?.value || !item.location || item.quantity <= 0)) { // Check if react-select value exists
            alert('Please fill in all SKU, Location, and Quantity fields correctly.');
            return;
        }

        // Optional: Validate sufficient stock before committing
        for (const item of items) {
            const currentQty = (stockLevels[item.sku.value] || {})[item.location] || 0;
            if (currentQty < item.quantity) {
                alert(`Insufficient stock for SKU ${item.sku.label} at location ${item.location}. Requested: ${item.quantity}, Available: ${currentQty}`);
                return;
            }
        }

        // Generate reference number just before commit
        const refNumber = generateReferenceNumber(authUser?.email); // Use email from auth context

        setAppProcessing(true);
        try {
            // Prepare transaction data
            const transactionData = {
                type: 'OUT',
                referenceNumber: refNumber, // Use generated number
                transactionDate: new Date(transactionDate), // Store as Date object or ISO string
                notes: notes,
                documentNumber: documentNumber,
                items: items.map(item => ({
                    sku: item.sku.value, // Extract the SKU string from the react-select object
                    location: item.location, // Ensure location is part of the item if needed by context
                    quantity: item.quantity,
                    reason: item.reason,
                    // currentQty is for display only, not stored in transaction
                })),
                userId: userId,
                // The serverTimestamp will be added by the context
            };

            console.log("Attempting to commit Stock Out:", transactionData); // Debug log

            // Call context function to create transaction
            await createTransaction(transactionData);
            alert('Stock Out transaction recorded successfully!');

            // --- CLEAR SAVED STATE ON SUCCESS ---
            try {
                await formStateStore.removeItem(FORM_STATE_KEYS.STOCK_OUT); // Use STOCK_OUT key
                console.log("[StockOutForm] Saved state cleared after successful submission.");
            } catch (clearError) {
                console.error("[StockOutForm] Error clearing saved state after submission:", clearError);
                // Log the error, but don't prevent navigation. The transaction was successful.
            }
            // --- END: CLEAR SAVED STATE ---

            // Navigate back or reset form
            navigate('/inventory'); // Or reset state to clear form
        } catch (error) {
            console.error('Stock Out failed:', error);
            alert(`Failed to record Stock Out: ${error.message}`);
        }
        finally{
            setAppProcessing(false);
        }
    };

    // --- Handle Form Reset (Clears Saved State Too) ---
    const handleReset = () => {
        // Reset all form fields to their initial state
        setReferenceNumber(''); // Reference number will regenerate on next commit
        setTransactionDate(new Date().toISOString().split('T')[0]); // Reset to today
        setNotes('');
        setDocumentNumber('');
        setItems([{ sku: null, location: '', quantity: 1, reason: 'sale' }]); // Reset to one empty line, sku as null
        setNewLocationName(''); // Clear new location input
        setAddingLocation(false); // Hide add location input
        setIsExportMenuOpen(false); // Close export menu if open
        // No need to reset 'locations' or 'products' state as they come from context

        // --- CLEAR SAVED STATE ON RESET ---
        formStateStore.removeItem(FORM_STATE_KEYS.STOCK_OUT) // Use STOCK_OUT key
            .then(() => console.log("[StockOutForm] Saved state cleared on Reset."))
            .catch(error => console.error("[StockOutForm] Error clearing saved state on Reset:", error));
        // --- END: CLEAR SAVED STATE ---
    };

    // --- Export Current Items List (Before Commit) ---
    const exportCurrentItems = (format) => {
        if (!items || items.length === 0 || items.every(item => !item.sku?.value && !item.location && item.quantity === 1 && item.reason === 'sale')) {
            alert('No items to export.');
            return;
        }

        const exportData = items.map(item => ({
            SKU: item.sku?.label || 'N/A', // Use label for display
            Location: item.location || '',
            Quantity: item.quantity || 0,
            Reason: item.reason || '',
        }));

        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Pending_Stock_Out_Items');
            XLSX.writeFile(wb, 'pending_stock_out_items.xlsx');
            alert("Excel file exported successfully!");
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text("Pending Stock Out Items", 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

            autoTable(doc, {
                head: [['SKU (Display)', 'Location', 'Quantity', 'Reason']],
                body: exportData.map(row => [row.SKU, row.Location, row.Quantity, row.Reason]),
                startY: 36,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [33, 150, 243] },
            });

            doc.save('pending_stock_out_items.pdf');
            alert("PDF file exported successfully!");
        }
        // Close the export menu after export
        setIsExportMenuOpen(false);
    };

    // --- Calculate Available Locations for a specific item (including potentially added one) ---
    const getAvailableLocationsForItem = (itemIndex) => {
        let locs = locations.map(loc => loc.name); // Start with names from the context
        // Apply assigned locations filter if applicable
        if (assignedLocations.length > 0) {
            locs = locs.filter(locName => assignedLocations.includes(locName));
        }
        // Add the new location being created if in the process of adding and it's for the last row
        if (addingLocation && itemIndex === items.length - 1 && newLocationName.trim()) {
             locs = [newLocationName.trim(), ...locs]; // Add new name to the top of the list for this specific item's dropdown
        }
        return locs;
    };

    // --- Render Logic ---
    if (isLoadingFormState || isLocationsLoading) { // Add loading check for locations and form state loading
        return <div className="p-8 text-xl text-center">Loading Stock Out Form...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Stock Out</h1>
                    <div className="flex gap-2"> {/* Container for navigation buttons */}
                        <button
                            onClick={handleReset} // Call the reset function
                            className="btn btn-outline-danger" // Use themed button
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => navigate('/inventory')} // Navigate back
                            className="btn btn-outline-primary" // Use themed button
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

                        {/* Column 2: Transaction Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Date</label>
                            <input
                                type="date"
                                value={transactionDate}
                                onChange={(e) => setTransactionDate(e.target.value)}
                                className="input-base"
                            />
                        </div>

                        {/* Column 3: Document Number */}
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
                        <table className="table-base min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Qty</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
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
                                                // Optional: Customize styles further using the 'styles' prop if needed
                                                // styles={customStyles}
                                            />
                                        </td>
                                        {/* Location Selection Cell (Updated to use new keying logic) */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <select
                                                    value={item.location} // Bind to item.location
                                                    onChange={(e) => handleItemChange(index, 'location', e.target.value)} // Update item.location
                                                    className="flex-1 p-1 border border-gray-300 rounded"
                                                >
                                                    <option value="">Select Location</option>
                                                    {/* Iterate over the calculated effectiveLocationNames */}
                                                    {getAvailableLocationsForItem(index).map(locName => {
                                                        // Find the corresponding location object to get its ID for the key
                                                        const locationObj = locations.find(loc => loc.name === locName);

                                                        // Determine the key
                                                        // If locationObj is found (it's a real location from the context), use its ID.
                                                        // If locationObj is not found (e.g., for the temporary name being added via input), use a unique fallback key.
                                                        const key = locationObj ? locationObj.id : `temp_loc_${index}_${locName}`;

                                                        return (
                                                            <option key={key} value={locName}>{locName}</option> // Use the determined unique key
                                                        );
                                                    })}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAddingLocation(true);
                                                        // Clear error message if it exists when clicking the '+' button
                                                        // Assuming there's an 'error' state variable, which there isn't in this snippet.
                                                        // If you add an error state later, you'd clear it here.
                                                    }}
                                                    className="ml-1 px-2 py-1 btn btn-outline-secondary" // Use themed button
                                                >
                                                    +
                                                </button>
                                            </div>
                                            {addingLocation && index === items.length - 1 && ( // Show input only for the last row if adding
                                                <div className="mt-1 flex gap-1">
                                                    <input
                                                        type="text"
                                                        value={newLocationName}
                                                        onChange={(e) => {
                                                            setNewLocationName(e.target.value);
                                                            // Clear error message if it exists when user starts typing
                                                            // Assuming there's an 'error' state variable, which there isn't in this snippet.
                                                        }}
                                                        placeholder="New Location Name"
                                                        className="flex-1 p-1 border border-gray-300 rounded"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddNewLocation}
                                                        className="ml-1 px-2 py-1 btn btn-success" // Use themed button
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAddingLocation(false);
                                                            setNewLocationName('');
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
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <select
                                                value={item.reason}
                                                onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                                                className="w-full p-1 border border-gray-300 rounded"
                                            >
                                                <option value="sale">Sale</option>
                                                <option value="damage">Damage</option>
                                                <option value="adjustment">Adjustment</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)} // Pass the specific index of THIS item to remove
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
                            className="btn btn-outline-primary" // Use themed button
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
                            className="btn btn-danger" // Use themed button (danger for Stock Out)
                        >
                            Commit Stock Out
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockOutForm;