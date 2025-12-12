
// src/pages/SalesSubPages/StockDeliveryPage.jsx

import React, { useState, useMemo, useCallback } from 'react';
import Select from 'react-select';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useInventory } from '../../contexts/InventoryContext';
import { useSync } from '../../contexts/SyncContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { Plus, ChevronLeft, Send, Camera, List, X, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { useLoading } from '../../contexts/LoadingContext';
import Scanner from '../../components/Scanner';

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#fff', border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF' } }),
    menu: (p) => ({ ...p, zIndex: 20, backgroundColor: '#fff', border: '1px solid #D1D5DB' }),
    option: (p, s) => ({ ...p, backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent', color: s.isSelected ? 'white' : '#111827' }),
    input: (p) => ({ ...p, color: '#111827' }),
    singleValue: (p) => ({ ...p, color: '#111827' }),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const StockDeliveryPage = () => {
    const navigate = useNavigate();
    const { currentUser: user, isLoading: isUserLoading } = useUser();
    const { userId } = useAuth();
    const { products } = useProducts();
    const { locations } = useLocations();
    const { inventoryItems } = useInventory();
    const { addToQueue, isSyncing } = useSync();
    const { setAppProcessing } = useLoading();

    const [locationId, setLocationId] = useState('');
    const [batchItems, setBatchItems] = useState([]);
    const [formError, setFormError] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanContext, setScanContext] = useState({ itemIndex: null, unitIndex: null });

    const productsMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
    const productOptions = useMemo(() => products.map(p => ({ value: p.id, label: getProductDisplayName(p), product: p })), [products]);

    const handleAddProduct = () => {
        if (!selectedProduct) return;
        const product = selectedProduct.product;
        const newItem = {
            id: `item_${Date.now()}`,
            productId: product.id,
            units: product.isSerialized ? [{ id: `unit_${Date.now()}`, serial: '', inventoryItem: null, error: null, isValid: false }] : []
        };
        setBatchItems(prev => [newItem, ...prev]);
        setSelectedProduct(null);
    };

    const handleUpdateItemUnit = (itemIndex, unitIndex, newValues) => {
        setBatchItems(prevBatch => 
            prevBatch.map((item, idx) => {
                if (idx === itemIndex) {
                    const newUnits = item.units.map((unit, uIdx) => {
                        if (uIdx === unitIndex) {
                            return { ...unit, ...newValues };
                        }
                        return unit;
                    });
                    return { ...item, units: newUnits };
                }
                return item;
            })
        );
    };

    const validateAndSetSerial = useCallback((serial, itemIndex, unitIndex) => {
        if (!serial) {
            handleUpdateItemUnit(itemIndex, unitIndex, { serial, inventoryItem: null, isValid: false, error: null });
            return;
        }
        const item = batchItems[itemIndex];
        const product = productsMap.get(item.productId);
        if (!product) return; 

        const existingInvItem = inventoryItems.find(inv => inv.serial === serial && inv.sku === product.sku);
        const isAlreadySelected = batchItems.some((bi, bi_idx) => bi.units.some((u, u_idx) => u.inventoryItem?.id === existingInvItem?.id && (bi_idx !== itemIndex || u_idx !== unitIndex)));

        if (existingInvItem && !isAlreadySelected) {
            handleUpdateItemUnit(itemIndex, unitIndex, { serial, inventoryItem: existingInvItem, isValid: true, error: null });
        } else if (isAlreadySelected) {
            handleUpdateItemUnit(itemIndex, unitIndex, { serial, inventoryItem: null, isValid: false, error: 'Already selected.' });
        } else {
            handleUpdateItemUnit(itemIndex, unitIndex, { serial, inventoryItem: null, isValid: false, error: 'Not in stock.' });
        }
    }, [batchItems, inventoryItems, productsMap]);

    const handleRemoveUnit = (itemIndex, unitIndex) => {
        setBatchItems(prev => {
            const newBatch = prev.map((item, idx) => {
                if (idx === itemIndex) {
                    const newUnits = item.units.filter((_, uIdx) => uIdx !== unitIndex);
                    return { ...item, units: newUnits };
                }
                return item;
            });
            return newBatch.filter(item => item.units.length > 0);
        });
    };

    const handleRemoveItem = (itemIndex) => {
        setBatchItems(prev => prev.filter((_, idx) => idx !== itemIndex));
    };

    const handleAddUnit = (itemIndex) => {
        setBatchItems(prev => prev.map((item, idx) => {
            if (idx === itemIndex) {
                const newUnits = [...item.units, { id: `unit_${Date.now()}`, serial: '', inventoryItem: null, error: null, isValid: false }];
                return { ...item, units: newUnits };
            }
            return item;
        }));
    };

    const handleStockSelected = (inventoryItem, itemIndex) => {
        const newUnit = {
            id: `unit_${Date.now()}`,
            serial: inventoryItem.serial,
            inventoryItem: inventoryItem,
            isValid: true,
            error: null
        };
        setBatchItems(prevBatch =>
            prevBatch.map((item, idx) => 
                idx === itemIndex ? { ...item, units: [newUnit] } : item
            )
        );
    };

    const openScanner = (itemIndex, unitIndex) => {
        setScanContext({ itemIndex, unitIndex });
        setIsScannerOpen(true);
    };

    const handleScanSuccess = (decodedText) => {
        const { itemIndex, unitIndex } = scanContext;
        validateAndSetSerial(decodedText.trim(), itemIndex, unitIndex);
        setIsScannerOpen(false);
    };

    const handleSaveBatch = async () => {
        setFormError('');
        if (!user || !userId) { setFormError("User profile not loaded."); return; }
        if (!locationId) { setFormError('Please select a delivery location.'); return; }
        if (batchItems.length === 0) { setFormError('You must add at least one product.'); return; }
        if (!batchItems.every(item => item.units.every(u => u.isValid))) { setFormError('Please correct all serial number errors before saving.'); return; }

        setAppProcessing(true, 'Queuing delivery...');

        try {
            const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const itemsToDeliver = batchItems.flatMap(item => 
                item.units.map(unit => unit.inventoryItem).filter(Boolean)
            );

            const deliverySummaries = itemsToDeliver.reduce((acc, item) => {
                const product = productsMap.get(item.productId);
                if (!product) {
                     console.error(`Product details for ID ${item.productId} not found. Skipping item.`);
                     return acc;
                }

                if (!acc[product.sku]) {
                    acc[product.sku] = {
                        batchId,
                        sku: product.sku,
                        productId: product.id,
                        productName: product.name,
                        isSerialized: product.isSerialized,
                        locationId: locationId,
                        serials: []
                    };
                }
                acc[product.sku].serials.push(item.serial);
                return acc;
            }, {});

            const deliverySummaryList = Object.values(deliverySummaries);
            if (deliverySummaryList.length === 0) throw new Error("Could not form a valid delivery. Product details might be missing.");

            await addToQueue('CREATE_PENDING_DELIVERABLE', deliverySummaryList, user);

            setAppProcessing(false);
            alert('Delivery batch has been queued!');
            navigate('/sales/pending-deliverables');

        } catch (error) {
            console.error("Error saving batch:", error);
            setFormError(`Failed to save batch: ${error.message}`);
            setAppProcessing(false);
        } 
    };

    if (isUserLoading) return <div className="page-container"><p>Loading...</p></div>;

    return (
        <div className="page-container mobile-form-optimized">
            {isScannerOpen && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />}
            <header className="page-header">
                <h1 className="page-title">Create Stock Delivery</h1>
                <div className="page-actions">
                    <Link to="/sales/pending-deliverables" className="btn btn-ghost"> <ChevronLeft size={20}/> Back </Link>
                    <button onClick={handleSaveBatch} className="btn btn-primary" disabled={isSyncing}> <Send size={18} /> Queue Batch </button>
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
                    <label className="label"><span className="label-text text-lg font-bold">Add Product to Delivery</span></label>
                    <div className="flex gap-2">
                        <Select options={productOptions} value={selectedProduct} onChange={setSelectedProduct} styles={customSelectStyles} placeholder="Search for a product..." menuPortalTarget={document.body} className="flex-grow" isDisabled={!locationId} isClearable />
                        <button onClick={handleAddProduct} className="btn btn-primary" disabled={!locationId || !selectedProduct}><Plus size={20}/></button>
                    </div>
                </div>
                <div className="divider">Delivery Items</div>
                <div className="space-y-3">
                    {batchItems.map((item, itemIndex) => (
                        <ItemCard 
                            key={item.id} 
                            item={item} 
                            itemIndex={itemIndex}
                            productsMap={productsMap}
                            locationId={locationId}
                            batchItems={batchItems}
                            onUpdateUnit={handleUpdateItemUnit}
                            onAddUnit={handleAddUnit}
                            onRemoveUnit={handleRemoveUnit}
                            onRemoveItem={handleRemoveItem}
                            onOpenScanner={openScanner}
                            onValidateSerial={validateAndSetSerial}
                            onStockSelected={onStockSelected}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const ItemCard = ({ item, itemIndex, productsMap, locationId, batchItems, onUpdateUnit, onAddUnit, onRemoveUnit, onRemoveItem, onOpenScanner, onValidateSerial, onStockSelected }) => {
    const [showStockList, setShowStockList] = useState(false);
    const product = productsMap.get(item.productId);

    if (!product) return null;

    return (
        <div className="card bg-base-100 border shadow-md">
            <div className="card-body p-3">
                <div className='flex justify-between items-start'>
                    <div>
                        <h3 className="font-bold text-lg">{product.name}</h3>
                        <p className="text-md text-gray-600 font-mono">SKU: {product.sku}</p>
                    </div>
                    <button onClick={() => onRemoveItem(itemIndex)} className="btn btn-sm btn-ghost text-red-500"><X size={20}/></button>
                </div>
                <div className="space-y-2 mt-2">
                    {product.isSerialized ? (
                        <>
                            <label className="label-text font-semibold">Serials</label>
                            {item.units.map((unit, unitIndex) => (
                                <div key={unit.id} className="flex gap-1.5 items-center">
                                    <input type="text" value={unit.serial} onChange={(e) => onUpdateUnit(itemIndex, unitIndex, { serial: e.target.value, isValid: false, error: null })} onBlur={(e) => onValidateSerial(e.target.value, itemIndex, unitIndex)} placeholder={`Serial #${unitIndex + 1}`} className={`input-base flex-grow ${unit.error ? 'border-red-500' : unit.isValid ? 'border-green-500' : ''}`} />
                                    <button onClick={() => onOpenScanner(itemIndex, unitIndex)} className="btn btn-sm btn-outline"><Camera size={16}/></button>
                                    {unit.isValid ? <CheckCircle size={20} className="text-green-500"/> : (unit.error ? <AlertCircle title={unit.error} size={20} className="text-red-500"/> : null) }
                                    {item.units.length > 1 && <button onClick={() => onRemoveUnit(itemIndex, unitIndex)} className="btn btn-xs btn-ghost text-gray-500"><X size={16}/></button>}
                                </div>
                            ))}
                            <div className='flex gap-2'>
                                <button onClick={() => onAddUnit(itemIndex)} className="btn btn-outline btn-sm mt-2"><Plus size={16}/> Add Manually</button>
                                <button onClick={() => setShowStockList(p => !p)} className="btn btn-outline btn-sm mt-2"><List size={16}/> {showStockList ? 'Hide Stock' : 'Select from Stock'}</button>
                            </div>
                            {showStockList && <AvailableStockPanel itemIndex={itemIndex} product={product} locationId={locationId} batchItems={batchItems} onStockSelected={onStockSelected} /> }
                        </>
                    ) : (
                        <p className='text-sm text-gray-500'>Non-serialized stock delivery is not yet supported.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const AvailableStockPanel = ({ itemIndex, product, locationId, batchItems, onStockSelected }) => {
    const { inventoryItems, isLoading } = useInventory();
    const [searchTerm, setSearchTerm] = useState('');
    
    const selectedUnitIds = useMemo(() => new Set(batchItems.flatMap(i => i.units.map(u => u.inventoryItem?.id))), [batchItems]);

    const availableStock = useMemo(() => {
        if (isLoading || !inventoryItems) return [];
        return inventoryItems.filter(item => item.sku === product.sku && item.locationId === locationId && !selectedUnitIds.has(item.id));
    }, [inventoryItems, isLoading, product.sku, locationId, selectedUnitIds]);

    const filteredStock = useMemo(() => {
        if (!searchTerm) return availableStock;
        return availableStock.filter(item => item.serial?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [availableStock, searchTerm]);

    return (
        <div className="mt-2 border-t pt-2">
            <div className="relative my-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Search available serials..." className="input input-bordered w-full pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="max-h-48 overflow-y-auto bg-gray-50 p-2 rounded-lg">
                {filteredStock.length > 0 ? (
                    <ul className='space-y-1'>
                        {filteredStock.map(item => (
                            <li key={item.id} onClick={() => onStockSelected(item, itemIndex)} className='p-2 bg-white rounded shadow-sm cursor-pointer hover:bg-green-50'>
                                Serial: <span className='font-semibold'>{item.serial}</span>
                            </li>
                        ))}
                    </ul>
                ): <p className='text-center text-sm text-gray-500 py-4'>No stock available for this product at the selected location.</p>}
            </div>
        </div>
    );
}

export default StockDeliveryPage;
