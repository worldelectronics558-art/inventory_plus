
// src/pages/InventorySubPages/StockOutForm.jsx

import React, { useState, useMemo } from 'react';
import Select from 'react-select';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../contexts/InventoryContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useLoading } from '../../contexts/LoadingContext';
import { getProductDisplayName } from '../../utils/productUtils';

// Reusing the same select styles for a consistent look and feel
const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#F9FAFB', border: s.isFocused ? '2px solid #D97706' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#D97706' : '#9CA3AF'} }),
    menu: (p) => ({...p, zIndex: 20, backgroundColor: '#F9FAFB'}),
    option: (p, s) => ({...p, backgroundColor: s.isSelected ? '#D97706' : s.isFocused ? '#FEF3C7' : 'transparent', color: s.isSelected ? 'white' : '#111827'}),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const StockOutForm = () => {
    const navigate = useNavigate();
    const { stockOut, stockLevels } = useInventory(); // Get the stockOut function
    const { products } = useProducts();
    const { locations } = useLocations();
    const { setAppProcessing } = useLoading();

    // --- STATE MANAGEMENT ---
    const [notes, setNotes] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [items, setItems] = useState([{ 
        sku: null, 
        location: null, 
        quantity: 1, 
        isSerialized: false,
        serials: [] 
    }]);

    // --- OPTIONS FOR SELECTS ---
    const productOptions = useMemo(() => products.map(p => ({ value: p.sku, label: getProductDisplayName(p), isSerialized: p.isSerialized ?? true })), [products]);
    const locationOptions = useMemo(() => locations.map(l => ({ value: l.name, label: l.name })), [locations]);

    // --- HANDLERS ---
    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const currentItem = { ...newItems[index] };
        currentItem[field] = value;

        if (field === 'sku') {
            currentItem.isSerialized = value ? value.isSerialized : false;
            currentItem.quantity = 1;
            currentItem.serials = currentItem.isSerialized ? [''] : [];
        }

        if (field === 'quantity' && currentItem.isSerialized) {
            const newQuantity = parseInt(value, 10) || 0;
            currentItem.serials = Array.from({ length: newQuantity }, (_, i) => currentItem.serials[i] || '');
        }

        newItems[index] = currentItem;
        setItems(newItems);
    };

    const handleSerialChange = (itemIndex, serialIndex, value) => {
        const newItems = [...items];
        newItems[itemIndex].serials[serialIndex] = value;
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { sku: null, location: null, quantity: 1, isSerialized: false, serials: [] }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        for (const item of items) {
            if (!item.sku || !item.location || item.quantity <= 0) {
                alert('Please fill in SKU, Location, and Quantity for all items.');
                return;
            }
            if (item.isSerialized) {
                if (item.serials.length !== item.quantity || item.serials.some(s => !s.trim())) {
                    alert(`Please enter all ${item.quantity} serial numbers for ${item.sku.label}.`);
                    return;
                }
            } else {
                 const availableStock = stockLevels[item.sku.value]?.[item.location.value] || 0;
                 if (item.quantity > availableStock) {
                     alert(`Cannot stock out ${item.quantity} units of ${item.sku.label}. Only ${availableStock} available at ${item.location.label}.`);
                     return;
                 }
            }
        }

        setAppProcessing(true);
        try {
            const operationData = {
                notes: notes,
                referenceNumber: referenceNumber,
                items: items.map(item => ({
                    sku: item.sku.value,
                    location: item.location.value,
                    quantity: item.quantity,
                    isSerialized: item.isSerialized,
                    serials: item.isSerialized ? item.serials.map(s => s.trim()) : [],
                }))
            };

            await stockOut(operationData);
            alert('Stock Out Successful!');
            navigate('/inventory');

        } catch (error) {
            console.error("Stock-out failed:", error);
            alert(`Stock-out failed: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Stock Out (Dispatch)</h1>
                    <button onClick={() => navigate('/inventory')} className="btn btn-outline-primary">Back</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Reference / Document Number</label>
                            <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="e.g., Delivery Note #, SO #" className="input-base" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Notes</label>
                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="1" className="input-base" placeholder="Optional notes for this dispatch" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {items.map((item, index) => {
                            const availableStock = item.sku && item.location ? (stockLevels[item.sku.value]?.[item.location.value] || 0) : 0;
                            return (
                                <div key={index} className="border rounded-lg p-4 space-y-4 bg-gray-50">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium mb-1">Product *</label>
                                            <Select styles={customSelectStyles} options={productOptions} value={item.sku} onChange={v => handleItemChange(index, 'sku', v)} placeholder="Select a product..." menuPortalTarget={document.body} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Location *</label>
                                            <Select styles={customSelectStyles} options={locationOptions} value={item.location} onChange={v => handleItemChange(index, 'location', v)} placeholder="Select..." menuPortalTarget={document.body} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Quantity *</label>
                                            <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)} min="1" max={!item.isSerialized ? availableStock : undefined} className="input-base w-full" />
                                            {!item.isSerialized && <p className='text-xs text-gray-500 text-center mt-1'>Available: {availableStock}</p>}
                                        </div>
                                        <div className="flex items-end h-full">
                                            <button type="button" onClick={() => handleRemoveItem(index)} className="btn btn-outline-danger w-full">Remove</button>
                                        </div>
                                    </div>

                                    {item.isSerialized && item.quantity > 0 && (
                                        <div className="pt-4 mt-4 border-t">
                                            <h3 className="text-md font-semibold text-gray-700 mb-2">Enter Serial Numbers for Dispatch</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                {item.serials.map((serial, serialIndex) => (
                                                    <input
                                                        key={serialIndex}
                                                        type="text"
                                                        value={serial}
                                                        onChange={(e) => handleSerialChange(index, serialIndex, e.target.value)}
                                                        placeholder={`Serial #${serialIndex + 1}`}
                                                        className="input-base"
                                                        required
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t">
                        <button type="button" onClick={handleAddItem} className="btn btn-outline-primary">+ Add Another Product</button>
                        <button type="submit" className="btn btn-primary">Commit Stock Out</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockOutForm;
