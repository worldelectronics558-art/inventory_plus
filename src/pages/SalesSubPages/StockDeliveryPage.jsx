
// src/pages/SalesSubPages/StockDeliveryPage.jsx

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import useLiveInventory from '../../hooks/useLiveInventory';
import { getProductDisplayName } from '../../utils/productUtils';
import { Plus, ChevronLeft, Send, Camera, List, X, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { useLoading } from '../../contexts/LoadingContext';
import Scanner from '../../components/Scanner';
import LoadingSpinner from '../../components/LoadingOverlay';

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#fff', border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF' } }),
    menu: (p) => ({ ...p, zIndex: 20, backgroundColor: '#fff', border: '1px solid #D1D5DB' }),
    option: (p, s) => ({ ...p, backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent', color: s.isSelected ? 'white' : '#111827' }),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const StockDeliveryPage = () => {
    const navigate = useNavigate();
    const { currentUser: user, isLoading: isUserLoading } = useUser();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations();
    const { createPendingDeliverable, isMutationDisabled } = usePendingDeliverables();
    const { setAppProcessing } = useLoading();

    const [locationId, setLocationId] = useState('');
    const [batchItems, setBatchItems] = useState([]);
    const [formError, setFormError] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanContext, setScanContext] = useState({ itemIndex: null, unitIndex: null });

    const productOptions = useMemo(() => products.map(p => ({ value: p.id, label: getProductDisplayName(p), product: p })), [products]);

    const handleAddProduct = () => {
        if (!selectedProduct) return;
        const product = selectedProduct.product;
        if (!product.isSerialized && batchItems.some(item => item.productId === product.id)) {
            setFormError('This non-serialized product is already in the batch. Please edit the existing quantity.');
            return;
        }
        setFormError('');
        const newItem = {
            id: `item_${Date.now()}`,
            productId: product.id,
            sku: product.sku,
            productName: getProductDisplayName(product),
            isSerialized: product.isSerialized,
            quantity: 1,
            inventoryItemId: null, // This will be populated by ItemCard's useEffect for non-serialized
            units: product.isSerialized ? [{ id: `unit_${Date.now()}`, serial: '', inventoryItem: null, error: null, isValid: false }] : []
        };
        setBatchItems(prev => [newItem, ...prev]);
        setSelectedProduct(null);
    };

    const updateBatchItem = (id, newValues) => {
        setBatchItems(prev => prev.map(item => item.id === id ? { ...item, ...newValues } : item));
    };

    const updateItemUnit = (itemIndex, unitIndex, newValues) => {
        setBatchItems(prevBatch =>
            prevBatch.map((item, idx) => {
                if (idx === itemIndex) {
                    const newUnits = [...item.units];
                    newUnits[unitIndex] = { ...newUnits[unitIndex], ...newValues };
                    return { ...item, units: newUnits };
                }
                return item;
            })
        );
    };

    const removeItemUnit = (itemIndex, unitIndex) => {
        setBatchItems(prev => prev.map((item, idx) => {
            if (idx === itemIndex) {
                const newUnits = item.units.filter((_, uIdx) => uIdx !== unitIndex);
                if (newUnits.length === 0 && item.isSerialized) return null; // Mark for removal
                return { ...item, units: newUnits };
            }
            return item;
        }).filter(Boolean));
    };

    const removeItem = (itemIndex) => {
        setBatchItems(prev => prev.filter((_, idx) => idx !== itemIndex));
    };

    const addUnit = (itemIndex, newUnit = { id: `unit_${Date.now()}`, serial: '', inventoryItem: null, error: null, isValid: false }) => {
        setBatchItems(prev => prev.map((item, idx) => {
            if (idx === itemIndex) {
                return { ...item, units: [...item.units, newUnit] };
            }
            return item;
        }));
    };
    
    const openScanner = (itemIndex, unitIndex) => {
        setScanContext({ itemIndex, unitIndex });
        setIsScannerOpen(true);
    };

    const handleScanSuccess = (decodedText) => {
        const { itemIndex, unitIndex } = scanContext;
        updateItemUnit(itemIndex, unitIndex, { serial: decodedText.trim() });
        setIsScannerOpen(false);
    };

    const handleSaveBatch = async () => {
        setFormError('');
        if (!user) { setFormError("User profile is not loaded."); return; }
        if (!locationId) { setFormError('Please select a delivery location.'); return; }
        if (batchItems.length === 0) { setFormError('You must add at least one product.'); return; }

        setAppProcessing(true, 'Validating and creating delivery...');

        try {
            const itemsToDeliver = [];
            
            for (const item of batchItems) {
                if (item.isSerialized) {
                    const validUnits = item.units.filter(u => u.isValid && u.inventoryItem);
                    if (item.units.some(u => u.serial && !u.isValid)) {
                        throw new Error(`One or more serials for ${item.productName} are invalid or not in stock. Please correct them.`);
                    }
                    if (validUnits.length < item.units.length || (item.units.length === 0 && item.isSerialized)) {
                        throw new Error(`Not all serial fields for ${item.productName} have been filled and validated.`);
                    }

                    for (const unit of validUnits) {
                        itemsToDeliver.push({
                            productId: item.productId, productName: item.productName, sku: item.sku, isSerialized: true, 
                            quantity: 1, 
                            serial: unit.serial, 
                            inventoryItemId: unit.inventoryItem.id, 
                            locationId
                        });
                    }
                } else { // Non-serialized
                    const quantity = Number(item.quantity);
                    if (!Number.isInteger(quantity) || quantity <= 0) {
                        throw new Error(`A valid quantity is required for ${item.productName}.`);
                    }
                    if (!item.inventoryItemId) { // This ID is now set by the ItemCard's useEffect
                        throw new Error(`No available stock source could be found for ${item.productName}. Check available quantity.`);
                    }
                    
                    itemsToDeliver.push({
                        productId: item.productId, productName: item.productName, sku: item.sku, isSerialized: false, 
                        quantity: quantity, 
                        serial: null, 
                        inventoryItemId: item.inventoryItemId, 
                        locationId
                    });
                }
            }
            
            if (itemsToDeliver.length === 0) {
                throw new Error("No valid items to deliver. Please add products and ensure all serials are validated.");
            }

            const dummyOrder = { 
                id: 'direct-delivery', orderNumber: 'N/A', 
                customerName: 'Direct Delivery', customerId: null
            };

            await createPendingDeliverable(dummyOrder, itemsToDeliver, user);

            setAppProcessing(false);
            alert('Delivery batch has been created successfully!');
            navigate('/sales/pending-deliverables');

        } catch (error) {
            console.error("Error saving batch:", error);
            setFormError(`Failed to save batch: ${error.message}`);
            setAppProcessing(false);
        } 
    };

    const isLoading = isUserLoading || productsLoading || locationsLoading;
    if (isLoading) return <LoadingSpinner>Loading delivery data...</LoadingSpinner>;

    return (
        <div className="page-container mobile-form-optimized">
            {isScannerOpen && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />}
            <header className="page-header">
                <h1 className="page-title">Create Stock Delivery</h1>
                <div className="page-actions">
                    <Link to="/sales/pending-deliverables" className="btn btn-ghost"> <ChevronLeft size={20}/> Back </Link>
                    <button onClick={handleSaveBatch} className="btn btn-primary" disabled={isMutationDisabled || batchItems.length === 0}> <Send size={18} /> Create Batch </button>
                </div>
            </header>
            <div className="page-content space-y-4">
                {formError && <div className="alert alert-error text-sm"><span>{formError}</span></div>}
                <div className="form-control">
                    <label className="label"><span className="label-text text-lg font-bold">Delivery Location</span></label>
                    <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="input-base" disabled={batchItems.length > 0}>
                        <option value="">-- Select a Location --</option>
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                </div>
                <div className="form-control">
                    <label className="label"><span className="label-text text-lg font-bold">Add Product</span></label>
                    <div className="flex gap-2">
                        <Select options={productOptions} value={selectedProduct} onChange={setSelectedProduct} styles={customSelectStyles} placeholder="Search for a product..." menuPortalTarget={document.body} className="flex-grow" isDisabled={!locationId} isClearable />
                        <button onClick={handleAddProduct} className="btn btn-primary" disabled={!locationId || !selectedProduct}><Plus size={20}/></button>
                    </div>
                </div>
                <div className="divider">Delivery Items</div>
                <div className="space-y-3">
                    {batchItems.map((item, itemIndex) => (
                        <ItemCard 
                            key={item.id} item={item} itemIndex={itemIndex} locationId={locationId} batchItems={batchItems}
                            onItemUpdate={updateBatchItem} onUpdateUnit={updateItemUnit} onAddUnit={addUnit}
                            onRemoveUnit={removeItemUnit} onRemoveItem={removeItem} onOpenScanner={openScanner}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const ItemCard = ({ item, itemIndex, locationId, batchItems, onItemUpdate, onUpdateUnit, onAddUnit, onRemoveUnit, onRemoveItem, onOpenScanner }) => {
    const [showStockList, setShowStockList] = useState(false);
    const { inventoryItems: liveStock, isLoading: isStockLoading } = useLiveInventory(locationId, item.sku);

    // FIX: For non-serialized items, automatically find and set the inventoryItemId from available stock.
    useEffect(() => {
        if (!item.isSerialized && liveStock.length > 0) {
            // Find the first inventory item with enough quantity.
            const availableStock = liveStock.find(stock => stock.quantity >= item.quantity);
            if (availableStock && availableStock.id !== item.inventoryItemId) {
                onItemUpdate(item.id, { inventoryItemId: availableStock.id });
            } else if (!availableStock && item.inventoryItemId) {
                 onItemUpdate(item.id, { inventoryItemId: null });
            }
        }
    }, [item.isSerialized, item.quantity, item.id, liveStock, onItemUpdate, item.inventoryItemId]);

    const validateAndSetSerial = useCallback((serial, unitIndex) => {
        const trimmedSerial = serial.trim();
        if (!trimmedSerial) { onUpdateUnit(itemIndex, unitIndex, { serial: '', inventoryItem: null, isValid: false, error: null }); return; }
        
        const existingInvItem = liveStock.find(inv => inv.serial === trimmedSerial);
        const isAlreadySelected = batchItems.some(batchItem => 
            batchItem.units.some(unit => 
                existingInvItem && unit.inventoryItem?.id === existingInvItem.id && unit.id !== item.units[unitIndex].id
            )
        );
        
        if (existingInvItem && !isAlreadySelected) {
            onUpdateUnit(itemIndex, unitIndex, { serial: trimmedSerial, inventoryItem: existingInvItem, isValid: true, error: null });
        } else if (isAlreadySelected) {
            onUpdateUnit(itemIndex, unitIndex, { serial: trimmedSerial, inventoryItem: null, isValid: false, error: 'Already in batch.' });
        } else {
            onUpdateUnit(itemIndex, unitIndex, { serial: trimmedSerial, inventoryItem: null, isValid: false, error: 'Not in stock.' });
        }
    }, [liveStock, batchItems, item.units, itemIndex, onUpdateUnit]);

    const handleStockSelected = (inventoryItem) => {
        if (item.units.some(u => u.inventoryItem?.id === inventoryItem.id)) return;

        const firstEmptyUnitIndex = item.units.findIndex(u => !u.serial);
        const newUnitData = { serial: inventoryItem.serial, inventoryItem, isValid: true, error: null };

        if (firstEmptyUnitIndex !== -1) {
            onUpdateUnit(itemIndex, firstEmptyUnitIndex, newUnitData);
        } else {
            onAddUnit(itemIndex, {id: `unit_${Date.now()}`, ...newUnitData});
        }
    };

    const handleQuantityChange = (e) => {
        const newQuantity = Math.max(0, parseInt(e.target.value, 10) || 0);
        onItemUpdate(item.id, { quantity: newQuantity });
    };

    const nonSerializedStock = useMemo(() => liveStock.reduce((acc, stockItem) => acc + (stockItem.quantity || 0), 0), [liveStock]);
    const isQuantityInvalid = !item.isSerialized && item.quantity > nonSerializedStock;

    return (
        <div className={`card bg-base-100 border shadow-md ${isQuantityInvalid ? 'border-error' : ''}`}>
            <div className="card-body p-3">
                <div className='flex justify-between items-start'>
                    <div>
                        <h3 className="font-bold text-lg">{item.productName}</h3>
                        <p className="text-md text-gray-600 font-mono">SKU: {item.sku}</p>
                    </div>
                    <button onClick={() => onRemoveItem(itemIndex)} className="btn btn-sm btn-ghost text-red-500"><X size={20}/></button>
                </div>
                <div className="space-y-2 mt-2">
                    {item.isSerialized ? (
                        <>
                            <label className="label-text font-semibold">Serials ({item.units.filter(u => u.isValid).length} / {item.units.length})</label>
                            {item.units.map((unit, unitIndex) => (
                                <div key={unit.id} className="flex gap-1.5 items-center">
                                    <input type="text" value={unit.serial} onChange={(e) => onUpdateUnit(itemIndex, unitIndex, { serial: e.target.value, isValid: false, error: null })} onBlur={(e) => validateAndSetSerial(e.target.value, unitIndex)} placeholder={`Serial #${unitIndex + 1}`} className={`input-base flex-grow ${unit.error ? 'border-red-500' : unit.isValid ? 'border-green-500' : ''}`} />
                                    <button onClick={() => onOpenScanner(itemIndex, unitIndex)} className="btn btn-sm btn-outline"><Camera size={16}/></button>
                                    {unit.isValid ? <CheckCircle size={20} className="text-green-500"/> : (unit.error ? <AlertCircle title={unit.error} size={20} className="text-red-500"/> : null) }
                                    <button onClick={() => onRemoveUnit(itemIndex, unitIndex)} className="btn btn-sm btn-ghost text-gray-500"><X size={16}/></button>
                                </div>
                            ))}
                            <div className='flex gap-2'>
                                <button onClick={() => onAddUnit(itemIndex)} className="btn btn-outline btn-sm mt-2"><Plus size={16}/> Add Manually</button>
                                <button onClick={() => setShowStockList(p => !p)} className="btn btn-outline btn-sm mt-2" disabled={isStockLoading}><List size={16}/> {showStockList ? 'Hide' : 'Select from'} Stock</button>
                            </div>
                            {showStockList && <AvailableStockPanel batchItems={batchItems} onStockSelected={handleStockSelected} liveStock={liveStock} isStockLoading={isStockLoading} /> }
                        </>
                    ) : (
                         <div className="form-control mt-2 w-48">
                            <label className="label"><span className="label-text">Quantity</span></label>
                            <input type="number" value={item.quantity} onChange={handleQuantityChange} className="input-base" min="1" />
                            <label className="label-text-alt mt-1">Available: {isStockLoading ? '...' : nonSerializedStock}</label>
                            {isQuantityInvalid && <label className="label-text-alt text-error mt-1">Cannot deliver more than available stock.</label>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const AvailableStockPanel = ({ batchItems, onStockSelected, liveStock, isStockLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const selectedSerials = useMemo(() => new Set(batchItems.flatMap(i => i.units.map(u => u.serial)).filter(Boolean)), [batchItems]);
    const availableStock = useMemo(() => liveStock.filter(item => !selectedSerials.has(item.serial)), [liveStock, selectedSerials]);
    const filteredStock = useMemo(() => availableStock.filter(item => item.serial?.toLowerCase().includes(searchTerm.toLowerCase())), [availableStock, searchTerm]);

    if (isStockLoading) return <div className="text-center p-4">Loading stock...</div>;
    if (availableStock.length === 0) return <p className='text-center text-sm text-gray-500 py-4'>No available serials for this item at this location.</p>;

    return (
        <div className="mt-2 border-t pt-2">
            <div className="relative my-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Search available serials..." className="input input-bordered w-full pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="max-h-48 overflow-y-auto bg-gray-50 p-2 rounded-lg">
                <ul className='space-y-1'>
                    {filteredStock.length > 0 ? (
                        filteredStock.map(item => (
                            <li key={item.id} onClick={() => onStockSelected(item)} className='p-2 bg-white rounded shadow-sm cursor-pointer hover:bg-green-50 flex justify-between items-center'>
                                <span>Serial: <span className='font-semibold'>{item.serial}</span></span>
                                <button className='btn btn-xs btn-outline btn-success'><Plus/></button>
                            </li>
                        ))
                    ) : (
                        <p className='text-center text-sm text-gray-500 py-2'>No matching serials found.</p>
                    )}
                </ul>
            </div>
        </div>
    );
}

export default StockDeliveryPage;
