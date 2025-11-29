// src/pages/InventorySubPages/StockInForm.jsx

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
const FORM_STATE_KEYS = { STOCK_IN: 'formState_stockIn' };
// --- END: FORM STATE --- 

// --- UTILITY FUNCTIONS ---
const getProductBySku = (products, sku) => products.find(p => p.sku === sku);
const getProductDisplayName = (product) => product ? `${product.sku} - ${product.model || 'N/A'}` : 'Unknown Product';
// --- END: UTILITIES ---

// --- STYLING FOR REACT-SELECT ---
const customSelectStyles = {
    control: (provided, state) => ({
        ...provided,
        width: '100%',
        backgroundColor: '#dff6f4', // bg-secondary-50
        color: '#064E3B', // text-primary-900
        border: state.isFocused ? '2px solid #059669' : '1px solid #CFD9E4',
        borderRadius: '0.5rem',
        padding: '0.3rem 0.25rem', // Roughly py-2.5 and px-3
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        minHeight: '42px',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
            borderColor: state.isFocused ? '#059669' : '#9CA3AF',
        }
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '0 0.5rem',
    }),
    input: (provided) => ({
        ...provided,
        margin: '0px',
        padding: '0px',
        color: '#064E3B',
    }),
    placeholder: (provided) => ({
        ...provided,
        color: '#94A3B8', // placeholder:text-[rgb(148_163_184)]
    }),
    indicatorSeparator: () => ({ 
        display: 'none', 
    }),
    singleValue: (provided) => ({
        ...provided,
        color: '#064E3B',
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 20,
        backgroundColor: '#dff6f4', // bg-secondary-50
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#059669' : state.isFocused ? '#D1FAE5' : 'transparent',
        color: state.isSelected ? 'white' : '#064E3B',
        padding: '0.5rem 1rem',
        '&:hover': {
            backgroundColor: state.isSelected ? '#059669' : '#D1FAE5',
            color: state.isSelected ? 'white' : '#064E3B',
        }
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 })
};
// --- END: STYLING ---

const StockInForm = () => {
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
    const [items, setItems] = useState([{ sku: null, location: null, quantity: 1, reason: { value: 'purchase', label: 'Purchase' } }]);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isAddLocationModalOpen, setAddLocationModalOpen] = useState(false); // State for the modal
    const [isLoadingFormState, setIsLoadingFormState] = useState(true);
    // --- END: STATE ---
    
    const assignedLocations = useMemo(() => rawAssignedLocations || [], [rawAssignedLocations]);

    // --- OPTIONS FOR SELECTS ---
    const productOptions = useMemo(() => products.map(product => ({ value: product.sku, label: getProductDisplayName(product) })), [products]);
    
    const locationOptions = useMemo(() => {
        const { role } = userPermissions;
        let availableLocations = [];
        if (role === 'admin') {
            availableLocations = locations;
        } else if (role === 'manager') {
            availableLocations = locations.filter(loc => assignedLocations.includes(loc.id));
        }
        return availableLocations.map(loc => ({ value: loc.name, label: loc.name }));
    }, [locations, userPermissions, assignedLocations]);

    const reasonOptions = [
        { value: 'purchase', label: 'Purchase' },
        { value: 'return', label: 'Return' },
        { value: 'adjustment', label: 'Adjustment' },
        { value: 'other', label: 'Other' },
    ];
    // --- END: OPTIONS ---

    // --- FORM STATE PERSISTENCE EFFECTS ---
    useEffect(() => {
        let isCancelled = false;
        const loadSavedState = async () => {
            setIsLoadingFormState(true);
            try {
                const savedState = await formStateStore.getItem(FORM_STATE_KEYS.STOCK_IN);
                if (savedState && !isCancelled) {
                    setTransactionDate(savedState.transactionDate || new Date().toISOString().split('T')[0]);
                    setNotes(savedState.notes || '');
                    setDocumentNumber(savedState.documentNumber || '');
                    if (savedState.items && savedState.items.length > 0) {
                        setItems(savedState.items);
                    }
                }
            } catch (error) {
                console.error("[StockInForm] Error loading saved form state:", error);
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
            const saveTimer = setTimeout(() => formStateStore.setItem(FORM_STATE_KEYS.STOCK_IN, stateToSave), 500);
            return () => clearTimeout(saveTimer);
        }
    }, [transactionDate, notes, documentNumber, items, isLoadingFormState]);
    // --- END: PERSISTENCE ---

    // --- HANDLERS ---
    const generateReferenceNumber = (userEmail) => {
        const userPrefix = (userEmail || 'USER').slice(0, 4).toUpperCase();
        const now = new Date();
        const ts = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        return `${userPrefix}-IN-${ts}`;
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        if (field === 'sku' || field === 'location') {
            const skuToCheck = newItems[index].sku?.value || '';
            const product = getProductBySku(products, skuToCheck);
            const currentQty = product ? (stockLevels[skuToCheck] || {})[newItems[index].location?.value] || 0 : 0;
            newItems[index].currentQty = currentQty;
        }
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { sku: null, location: null, quantity: 1, reason: { value: 'purchase', label: 'Purchase' }, currentQty: 0 }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (items.some(item => !item.sku || !item.location || !item.reason || item.quantity <= 0)) {
            alert('Please fill in all SKU, Location, Quantity, and Reason fields correctly.');
            return;
        }

        const refNumber = generateReferenceNumber(authUser?.email);
        setAppProcessing(true);
        try {
            await createTransaction({
                type: 'IN',
                referenceNumber: refNumber,
                transactionDate: new Date(transactionDate),
                notes,
                documentNumber,
                items: items.map(item => ({
                    sku: item.sku.value,
                    location: item.location.value,
                    quantity: item.quantity,
                    reason: item.reason.value,
                })),
                userId,
            });
            alert('Stock In transaction recorded successfully!');
            await formStateStore.removeItem(FORM_STATE_KEYS.STOCK_IN);
            navigate('/inventory');
        } catch (error) {
            alert(`Failed to record Stock In: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    const handleReset = () => {
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setNotes('');
        setDocumentNumber('');
        setItems([{ sku: null, location: null, quantity: 1, reason: { value: 'purchase', label: 'Purchase' } }]);
        formStateStore.removeItem(FORM_STATE_KEYS.STOCK_IN);
    };

    const handleExport = (format) => {
        if (items.every(item => !item.sku && !item.location)) {
            alert('No items to export.');
            return;
        }
        const exportData = items.map(item => ({
            SKU: item.sku?.label || 'N/A',
            Location: item.location?.label || '',
            Quantity: item.quantity || 0,
            Reason: item.reason?.label || '',
        }));
        const commonExport = (wb, doc) => {
            if (format === 'excel') XLSX.writeFile(wb, 'pending_stock_in_items.xlsx');
            else if (format === 'pdf') doc.save('pending_stock_in_items.pdf');
        }
        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Pending_Stock_In_Items');
            commonExport(wb, null);
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.autoTable({ head: [['SKU', 'Location', 'Quantity', 'Reason']], body: exportData.map(Object.values) });
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
                        <h1 className="text-2xl font-bold">Stock In</h1>
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
                            <table className="table-base w-full" style={{borderCollapse: 'separate', borderSpacing: '0.5rem'}}>
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="th-base w-1/3">Model</th>
                                        <th className="th-base">Location</th>
                                        <th className="th-base">Current Qty</th>
                                        <th className="th-base">Quantity</th>
                                        <th className="th-base">Reason</th>
                                        <th className="th-base">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="p-1"><Select styles={customSelectStyles} options={productOptions} value={item.sku} onChange={v => handleItemChange(index, 'sku', v)} placeholder="Select..." isClearable menuPortalTarget={document.body} /></td>
                                            <td className="p-1">
                                                <div className="flex items-center">
                                                    <Select className="flex-grow" styles={customSelectStyles} options={locationOptions} value={item.location} onChange={v => handleItemChange(index, 'location', v)} placeholder="Select..." isClearable={false} menuPortalTarget={document.body} />
                                                    <button type="button" onClick={() => setAddLocationModalOpen(true)} className="btn btn-sm ml-1">+</button>
                                                </div>
                                            </td>
                                            <td className="td-base text-center">{item.currentQty || 0}</td>
                                            <td className="p-1"><input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} min="1" className="input-base w-full text-center" /></td>
                                            <td className="p-1"><Select styles={customSelectStyles} options={reasonOptions} value={item.reason} onChange={v => handleItemChange(index, 'reason', v)} placeholder="Select..." menuPortalTarget={document.body} /></td>
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
                                <button type="submit" className="btn btn-primary">Commit Stock In</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default StockInForm;
