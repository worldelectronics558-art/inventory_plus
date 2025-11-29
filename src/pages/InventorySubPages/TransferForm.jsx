// src/pages/InventorySubPages/TransferForm.jsx

import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../contexts/InventoryContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import { useLoading } from '../../contexts/LoadingContext';
import localforage from 'localforage';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import AddLocationModal from '../../components/AddLocationModal'; // Import the modal

// --- FORM STATE PERSISTENCE ---
const FORM_STATE_STORE_NAME = 'formStatesCache';
const formStateStore = localforage.createInstance({
    name: "inventoryApp",
    storeName: FORM_STATE_STORE_NAME,
});
const FORM_STATE_KEYS = { TRANSFER: 'formState_transfer' };
// --- END: FORM STATE --- 

// --- UTILITY FUNCTIONS ---
const getProductBySku = (products, sku) => products.find(p => p.sku === sku);
const getProductDisplayName = (product) => product ? `${product.sku} - ${product.model || 'N/A'}` : 'Unknown Product';
// --- END: UTILITIES ---

// --- STYLING FOR REACT-SELECT ---
const customSelectStyles = {
    control: (provided, state) => ({
        ...provided,
        backgroundColor: '#dff6f4', // secondary-50
        border: 'none',
        boxShadow: 'none', // Remove focus shadow
        minHeight: '38px',
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '0 8px',
    }),
    input: (provided) => ({
        ...provided,
        margin: '0px',
        padding: '0px',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    singleValue: (provided) => ({ // This removes the box around the selected value
        ...provided,
        backgroundColor: 'transparent',
        color: 'inherit',
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 20, // Ensure dropdown appears over other elements
        backgroundColor: '#dff6f4', // secondary-50
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 })
};
// --- END: STYLING ---

const TransferForm = () => {
    const navigate = useNavigate();
    const { stockLevels, createTransaction } = useInventory();
    const { products } = useProducts();
    const { locations, isLoading: isLocationsLoading } = useLocations();
    const { userId, currentUser: authUser } = useAuth();
    const { userPermissions, assignedLocations: rawAssignedLocations } = useUser();
    const { setAppProcessing } = useLoading();

    // --- STATE MANAGEMENT ---
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [items, setItems] = useState([{ sku: null, fromLocation: null, toLocation: null, quantity: 1 }]);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isAddLocationModalOpen, setAddLocationModalOpen] = useState(false); // State for the modal
    const [isLoadingFormState, setIsLoadingFormState] = useState(true);
    // --- END: STATE ---

    const assignedLocations = useMemo(() => rawAssignedLocations || [], [rawAssignedLocations]);

    // --- OPTIONS FOR SELECTS ---
    const productOptions = useMemo(() => products.map(product => ({ value: product.sku, label: getProductDisplayName(product) })), [products]);

    const fromLocationOptions = useMemo(() => {
        const { role } = userPermissions;
        let availableLocations = [];
        if (role === 'admin') {
            availableLocations = locations;
        } else if (role === 'manager') {
            availableLocations = locations.filter(loc => assignedLocations.includes(loc.id));
        }
        return availableLocations.map(loc => ({ value: loc.name, label: loc.name }));
    }, [locations, userPermissions, assignedLocations]);

    const toLocationOptions = useMemo(() => locations.map(loc => ({ value: loc.name, label: loc.name })), [locations]);
    // --- END: OPTIONS ---

    // --- FORM STATE PERSISTENCE EFFECTS ---
    useEffect(() => {
        let isCancelled = false;
        const loadSavedState = async () => {
            setIsLoadingFormState(true);
            try {
                const savedState = await formStateStore.getItem(FORM_STATE_KEYS.TRANSFER);
                if (savedState && !isCancelled) {
                    setTransactionDate(savedState.transactionDate || new Date().toISOString().split('T')[0]);
                    setNotes(savedState.notes || '');
                    setDocumentNumber(savedState.documentNumber || '');
                    if (savedState.items && savedState.items.length > 0) {
                        setItems(savedState.items);
                    }
                }
            } catch (error) {
                console.error("[TransferForm] Error loading saved form state:", error);
            } finally {
                if (!isCancelled) setIsLoadingFormState(false);
            }
        };
        loadSavedState();
        return () => { isCancelled = true; };
    }, []);

    useEffect(() => {
        if (!isLoadingFormState) {
            const stateToSave = { transactionDate, notes, documentNumber, items };
            const saveTimer = setTimeout(() => formStateStore.setItem(FORM_STATE_KEYS.TRANSFER, stateToSave), 500);
            return () => clearTimeout(saveTimer);
        }
    }, [transactionDate, notes, documentNumber, items, isLoadingFormState]);
    // --- END: PERSISTENCE ---

    // --- HANDLERS ---
    const generateReferenceNumber = (userEmail) => {
        const userPrefix = (userEmail || 'USER').slice(0, 4).toUpperCase();
        const now = new Date();
        const ts = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        return `${userPrefix}-TRF-${ts}`;
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;

        // If we change the 'from' location or the SKU, we must update the current quantity
        if (field === 'sku' || field === 'fromLocation') {
            const skuToCheck = newItems[index].sku?.value || '';
            const product = getProductBySku(products, skuToCheck);
            const currentQty = product ? (stockLevels[skuToCheck] || {})[newItems[index].fromLocation?.value] || 0 : 0;
            newItems[index].currentQty = currentQty;
        }
        
        // Prevent to and from being the same
        if (field === 'toLocation' && value?.value === newItems[index].fromLocation?.value) {
            alert('"From" and "To" locations cannot be the same.');
            newItems[index].toLocation = null; // Reset selection
        }
        if (field === 'fromLocation' && value?.value === newItems[index].toLocation?.value) {
            alert('"From" and "To" locations cannot be the same.');
            newItems[index].fromLocation = null; // Reset selection
            newItems[index].currentQty = 0;
        }

        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { sku: null, fromLocation: null, toLocation: null, quantity: 1, currentQty: 0 }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (items.some(item => !item.sku || !item.fromLocation || !item.toLocation || item.quantity <= 0)) {
            alert('Please fill in all SKU, From/To Location, and Quantity fields correctly.');
            return;
        }

        for (const item of items) {
            const currentQty = (stockLevels[item.sku.value] || {})[item.fromLocation.value] || 0;
            if (currentQty < item.quantity) {
                alert(`Insufficient stock for ${item.sku.label} at ${item.fromLocation.label}. Requested: ${item.quantity}, Available: ${currentQty}`);
                return;
            }
        }

        const refNumber = generateReferenceNumber(authUser?.email);
        setAppProcessing(true);
        try {
            await createTransaction({
                type: 'TRANSFER',
                referenceNumber: refNumber,
                transactionDate: new Date(transactionDate),
                notes,
                documentNumber,
                items: items.map(item => ({
                    sku: item.sku.value,
                    fromLocation: item.fromLocation.value,
                    toLocation: item.toLocation.value,
                    quantity: item.quantity,
                })),
                userId,
            });
            alert('Transfer transaction recorded successfully!');
            await formStateStore.removeItem(FORM_STATE_KEYS.TRANSFER);
            navigate('/inventory');
        } catch (error) {
            alert(`Failed to record Transfer: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    const handleReset = () => {
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setNotes('');
        setDocumentNumber('');
        setItems([{ sku: null, fromLocation: null, toLocation: null, quantity: 1, currentQty: 0 }]);
        formStateStore.removeItem(FORM_STATE_KEYS.TRANSFER);
    };

    const handleExport = (format) => {
        if (items.every(item => !item.sku && !item.fromLocation && !item.toLocation)) {
            alert('No items to export.');
            return;
        }
        const exportData = items.map(item => ({
            SKU: item.sku?.label || 'N/A',
            'From Location': item.fromLocation?.label || '',
            'To Location': item.toLocation?.label || '',
            Quantity: item.quantity || 0,
        }));
        const commonExport = (wb, doc) => {
            if (format === 'excel') XLSX.writeFile(wb, 'pending_transfers.xlsx');
            else if (format === 'pdf') doc.save('pending_transfers.pdf');
        }
        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Pending_Transfers');
            commonExport(wb, null);
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.autoTable({ head: [['SKU', 'From Location', 'To Location', 'Quantity']], body: exportData.map(Object.values) });
            commonExport(null, doc);
        }
    };
    // --- END: HANDLERS ---

    if (!userPermissions.canManageInventory) {
        return <div className="p-8 text-center text-red-600">Access Denied.</div>;
    }

    if (isLoadingFormState || isLocationsLoading) {
        return <div className="p-8 text-center">Loading Form...</div>;
    }

    return (
        <>
            <AddLocationModal isOpen={isAddLocationModalOpen} onClose={() => setAddLocationModalOpen(false)} />
            <div className="min-h-screen bg-gray-100 p-4">
                <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold">Transfer</h1>
                        <div className="flex gap-2">
                            <button onClick={handleReset} className="btn btn-outline-danger">Reset</button>
                            <button onClick={() => navigate('/inventory')} className="btn btn-outline-primary">Back</button>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Reference Number</label>
                                <input type="text" value='Will be generated on commit' readOnly className="input-base bg-gray-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Transaction Date</label>
                                <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="input-base" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Document Number</label>
                                <input type="text" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Optional" className="input-base" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Notes</label>
                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" className="input-base" />
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="table-base w-full">
                                <thead className="bg-gray-50">
                                    <tr className="gap-2">
                                        <th className="th-base w-1/3">Model</th>
                                        <th className="th-base">From Location</th>
                                        <th className="th-base">To Location</th>
                                        <th className="th-base">Current Qty</th>
                                        <th className="th-base">Quantity</th>
                                        <th className="th-base">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="td-base"><Select styles={customSelectStyles} options={productOptions} value={item.sku} onChange={v => handleItemChange(index, 'sku', v)} placeholder="Select..." isClearable menuPortalTarget={document.body} /></td>
                                            <td className="td-base">
                                                <div className="flex items-center">
                                                    <Select className="flex-grow" styles={customSelectStyles} options={fromLocationOptions} value={item.fromLocation} onChange={v => handleItemChange(index, 'fromLocation', v)} placeholder="Select..." isClearable={false} menuPortalTarget={document.body} />
                                                    <button type="button" onClick={() => setAddLocationModalOpen(true)} className="btn btn-sm ml-1">+</button>
                                                </div>
                                            </td>
                                            <td className="td-base">
                                                <div className="flex items-center">
                                                    <Select className="flex-grow" styles={customSelectStyles} options={toLocationOptions.filter(opt => opt.value !== item.fromLocation?.value)} value={item.toLocation} onChange={v => handleItemChange(index, 'toLocation', v)} placeholder="Select..." isClearable={false} menuPortalTarget={document.body} />
                                                    <button type="button" onClick={() => setAddLocationModalOpen(true)} className="btn btn-sm ml-1">+</button>
                                                </div>
                                            </td>
                                            <td className="td-base text-center">{item.currentQty || 0}</td>
                                            <td className="td-base"><input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} min="1" className="input-base w-full text-center" /></td>
                                            <td className="td-base text-center"><button type="button" onClick={() => handleRemoveItem(index)} className="btn btn-outline-danger btn-sm">X</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-between items-center">
                            <button type="button" onClick={handleAddItem} className="btn btn-outline-primary">+ Add Line</button>
                            <div className="flex items-center gap-2">
                                <div className="relative inline-block text-left">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setIsExportMenuOpen(p => !p)}>Export</button>
                                    {isExportMenuOpen && (
                                        <div className="absolute right-0 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                                            <ul role="none" className="py-1">
                                                <li><button type="button" onClick={() => { handleExport('pdf'); setIsExportMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">As PDF</button></li>
                                                <li><button type="button" onClick={() => { handleExport('excel'); setIsExportMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">As Excel</button></li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <button type="submit" className="btn btn-secondary">Commit Transfer</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default TransferForm;
