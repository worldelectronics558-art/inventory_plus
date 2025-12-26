import React, { useState, useMemo, useEffect, useRef } from 'react';
import Select from 'react-select';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import useLiveInventory from '../../hooks/useLiveInventory';
import { getProductDisplayName } from '../../utils/productUtils';
import { Plus, ChevronLeft, Send, X, Camera, List, CheckCircle, XCircle, Pencil } from 'lucide-react';
import { useLoading } from '../../contexts/LoadingContext';
import LoadingSpinner from '../../components/LoadingOverlay';
import Scanner from '../../components/Scanner';

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#fff', border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF' } }),
    menu: (p) => ({ ...p, zIndex: 20, backgroundColor: '#fff', border: '1px solid #D1D5DB' }),
    option: (p, s) => ({ ...p, backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent', color: s.isSelected ? 'white' : '#111827' }),
    input: (p) => ({ ...p, color: '#111827' }),
    singleValue: (p) => ({ ...p, color: '#111827' }),
    menuPortal: (b) => ({ ...b, zIndex: 9999 }),
};

const SESSION_STORAGE_KEY = 'stockDeliveryForm';

const StockDeliveryPage = () => {
    const navigate = useNavigate();
    const { currentUser: user, isLoading: isUserLoading } = useUser();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations();
    const { createPendingDeliverable, isMutationDisabled } = usePendingDeliverables();
    const { setAppProcessing } = useLoading();

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formState, setFormState] = useState(() => {
        const savedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
        return savedState ? JSON.parse(savedState) : { locationId: '', batchItems: [] };
    });

    const { locationId, batchItems } = formState;
    const [formError, setFormError] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);

    const productsMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const updateForm = (field, value) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(formState));
    }, [formState]);

    const productOptions = useMemo(
        () => products.map(p => ({ value: p.id, label: getProductDisplayName(p), product: p })),
        [products]
    );

    const handleAddProduct = () => {
        if (!selectedProduct) return;
        const product = selectedProduct.product;
        if (batchItems.some(item => item.productId === product.id)) {
            setFormError('This product is already in the batch.');
            return;
        }
        const newItem = { 
            id: `item_${Date.now()}`, 
            productId: product.id, 
            quantity: 0,
            serials: product.isSerialized ? [{ serial: '', status: 'unchecked', inventoryItemId: null }] : [],
            inventoryItemIds: [], 
        };
        updateForm('batchItems', [newItem, ...batchItems]);
        setSelectedProduct(null);
        setFormError('');
    };
    
    const handleItemUpdate = (itemId, newValues) => {
        updateForm('batchItems', batchItems.map(item => item.id === itemId ? { ...item, ...newValues } : item));
    };
    
    const removeBatchItem = (itemId) => {
        updateForm('batchItems', batchItems.filter(item => item.id !== itemId));
    };
    
    const handleSaveBatch = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setFormError('');
    
        if (!user) { setFormError("User profile is not loaded."); setIsSubmitting(false); return; }
        if (!locationId) { setFormError('Please select a delivery location.'); setIsSubmitting(false); return; }
    
        // --- Strict Validation --- 
        for (const item of batchItems) {
            const product = productsMap.get(item.productId);
            if (product?.isSerialized) {
                for (const serial of item.serials) {
                    // If a serial field has text but is NOT valid, block submission.
                    if (serial.serial && serial.status !== 'valid') {
                        setFormError('Please fix or remove all invalid serial numbers before saving. Invalid serials are marked with a red or yellow X.');
                        setIsSubmitting(false);
                        return;
                    }
                }
            }
        }

        const itemsToDeliver = batchItems.map(item => {
            const product = productsMap.get(item.productId);
            const payloadItem = {
                productId: product.id,
                productName: getProductDisplayName(product),
                sku: product.sku,
                isSerialized: product.isSerialized,
                locationId: locationId,
                status: "PENDING",
                price: 0,
                cost: 0,
            };

            if (product.isSerialized) {
                // Second line of defense: Only include explicitly valid serials in the payload.
                const validSerials = item.serials.filter(s => s.status === 'valid');
                payloadItem.serials = validSerials.map(s => s.serial);
                payloadItem.inventoryItemIds = validSerials.map(s => s.inventoryItemId);
                payloadItem.quantity = validSerials.length;
            } else {
                payloadItem.inventoryItemIds = item.inventoryItemIds;
                payloadItem.inventoryItemId = item.inventoryItemIds.length > 0 ? item.inventoryItemIds[0] : null;
                payloadItem.serials = [];
                payloadItem.quantity = item.quantity;
            }
            return payloadItem;
        }).filter(item => item.quantity > 0); // Filter out any items that ended up with zero quantity.

        if (itemsToDeliver.length === 0) {
            setFormError('You must add at least one product with a quantity or a valid serial.');
            setIsSubmitting(false);
            return;
        }

        setAppProcessing(true, 'Creating delivery batch...');
    
        try {
            const dummyOrder = { id: 'direct-delivery', orderNumber: 'N/A', customerName: 'Direct Delivery', customerId: null };
            await createPendingDeliverable(dummyOrder, itemsToDeliver, user);
            
            alert('Delivery batch has been created successfully!');
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            setAppProcessing(false);
            navigate('/sales/pending-deliverables');
    
        } catch (error) {
            console.error("Error saving batch:", error);
            setFormError(`Failed to save batch: ${error.message}`);
            setAppProcessing(false);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const isLoading = isUserLoading || productsLoading || locationsLoading;
    if (isLoading) return <LoadingSpinner>Loading delivery data...</LoadingSpinner>;

    if (!user) {
        return <div className="page-container flex justify-center items-center"><p className="text-red-500">Error: Could not load user profile.</p></div>;
    }

    return (
        <div className="page-container mobile-form-optimized">
            <header className="page-header">
                <h1 className="page-title">Deliver Stock</h1>
                <div className="page-actions">
                    <Link to="/sales" className="btn btn-ghost"> <ChevronLeft size={20}/> Back </Link>
                    <button onClick={handleSaveBatch} className="btn btn-primary" disabled={isMutationDisabled || isSubmitting}>
                        {isSubmitting ? 'Saving...' : <><Send size={18} className="mr-2" /> Save Batch</>}
                    </button>
                </div>
            </header>

            <div className="page-content space-y-4">
                {formError && <div className="alert alert-error text-sm"><span>{formError}</span></div>}
                <div className="form-control">
                    <label className="label"><span className="label-text text-lg font-bold">Select Location</span></label>
                    <select value={locationId} onChange={(e) => updateForm('locationId', e.target.value)} className="input-base" disabled={batchItems.length > 0}>
                        <option value="">-- Select a Location --</option>
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                </div>
                <div className="form-control">
                    <label className="label"><span className="label-text">Select Product</span></label>
                    <div className="flex gap-2">
                        <Select options={productOptions} value={selectedProduct} onChange={setSelectedProduct} styles={customSelectStyles} placeholder="Search for a product..." menuPortalTarget={document.body} className="flex-grow" isDisabled={!locationId || isMutationDisabled || isSubmitting} isClearable />
                        <button onClick={handleAddProduct} className="btn btn-primary" disabled={!locationId || !selectedProduct || isMutationDisabled || isSubmitting}><Plus size={20}/></button>
                    </div>
                </div>
                <div className="divider"></div>
                <div className="space-y-3">
                    {batchItems.map((item) => (
                        <ItemCard key={item.id} item={item} productsMap={productsMap} onUpdate={handleItemUpdate} onRemove={removeBatchItem} locationId={locationId} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const ItemCard = ({ item, productsMap, onUpdate, onRemove, locationId }) => {
    const product = productsMap.get(item.productId);
    const { inventoryItems: liveStock, isLoading: isStockLoading } = useLiveInventory(locationId, product?.sku, product?.isSerialized);
    
    const [isStockListVisible, setIsStockListVisible] = useState(false);
    const serialInputRefs = useRef({});

    const nonSerializedStockOnHand = useMemo(() => {
        if (product?.isSerialized || !liveStock.length) return 0;
        return liveStock.reduce((acc, stockItem) => acc + (stockItem.quantity || 0), 0);
    }, [liveStock, product?.isSerialized]);

    if (!product) return null;

    const updateSerials = (newSerials) => {
        const validSerials = newSerials.filter(s => s.status === 'valid');
        onUpdate(item.id, { serials: newSerials, quantity: validSerials.length });
    };

    const handleSerialChange = (index, value) => {
        const newSerials = [...item.serials];
        newSerials[index] = { ...newSerials[index], serial: value, status: 'unchecked', inventoryItemId: null };
        updateSerials(newSerials);
    };

    const handleSerialValidation = (index) => {
        const newSerials = [...item.serials];
        const serialToValidate = newSerials[index];
        if (!serialToValidate.serial) {
            serialToValidate.status = 'unchecked';
            updateSerials(newSerials);
            return;
        }

        const trimmedSerial = serialToValidate.serial.trim();
        const stockItem = liveStock.find(s => s.serial === trimmedSerial);
        const isDuplicate = newSerials.some((s, i) => i !== index && s.serial === trimmedSerial && s.status === 'valid');

        if (isDuplicate) {
            serialToValidate.status = 'duplicate';
        } else if (stockItem) {
            serialToValidate.status = 'valid';
            serialToValidate.inventoryItemId = stockItem.id;
        } else {
            serialToValidate.status = 'invalid';
        }
        updateSerials(newSerials);
    };

    const addSerialField = () => {
        const newSerials = [...item.serials, { serial: '', status: 'unchecked', inventoryItemId: null }];
        updateSerials(newSerials);
    };

    const removeSerialField = (index) => {
        const newSerials = item.serials.filter((_, i) => i !== index);
        updateSerials(newSerials);
        if(newSerials.length === 0 && product.isSerialized) { addSerialField(); }
    };

    const addSelectedItem = (stockItem) => {
        if (item.serials.some(s => s.inventoryItemId === stockItem.id)) return;
        const newSerials = [...item.serials.filter(s => s.serial), { serial: stockItem.serial, status: 'valid', inventoryItemId: stockItem.id }];
        updateSerials(newSerials);
    }

    const handleQuantityChange = (e) => {
        const newQuantity = Math.max(0, Math.min(parseInt(e.target.value, 10) || 0, nonSerializedStockOnHand));
        let quantityToGather = newQuantity;
        const idsToBatch = [];
        for (const stockDoc of liveStock) {
            if (quantityToGather === 0) break;
            const canTakeFromDoc = Math.min(quantityToGather, stockDoc.quantity);
            if (canTakeFromDoc > 0) {
                for (let i = 0; i < canTakeFromDoc; i++) idsToBatch.push(stockDoc.id);
                quantityToGather -= canTakeFromDoc;
            }
        }
        onUpdate(item.id, { quantity: newQuantity, inventoryItemIds: idsToBatch });
    };

    return (
        <div className="card bg-base-100 border shadow-md">
            <div className="card-body p-3">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg">{getProductDisplayName(product)}</h3>
                        <p className="text-md text-gray-600 font-mono">SKU: {product.sku}</p>
                    </div>
                    <button onClick={() => onRemove(item.id)} className="btn btn-sm btn-ghost text-red-500"><X size={20}/></button>
                </div>

                {product.isSerialized ? (
                    <div className="space-y-2 mt-2">
                        <label className="label-text font-semibold">Serial Numbers ({item.serials.filter(s => s.status === 'valid').length})</label>
                        {item.serials.map((serial, index) => {
                            const inputId = `serial-${item.id}-${index}`;
                            return (
                                <div key={index} className="flex gap-1.5 items-center">
                                    
                                    <input 
                                        ref={el => serialInputRefs.current[inputId] = el}
                                        type="text" 
                                        value={serial.serial} 
                                        onChange={(e) => handleSerialChange(index, e.target.value)}
                                        onBlur={() => handleSerialValidation(index)}
                                        placeholder={`Serial #${index + 1}`}
                                        className="input-base flex-grow" 
                                    />
                                    {serial.status === 'valid' && <CheckCircle size={20} className="text-green-500" />}
                                    {serial.status === 'invalid' && <XCircle size={20} className="text-red-500" />}
                                    {serial.status === 'duplicate' && <XCircle size={20} className="text-yellow-500" />}
                                    <button onClick={() => alert("Scanner not implemented")} className="btn btn-sm btn-outline"><Camera size={16}/></button>
                                    <button onClick={() => serialInputRefs.current[inputId]?.focus()} className="btn btn-sm btn-outline"><Pencil size={16}/></button>
                                    <button onClick={() => removeSerialField(index)} className="btn btn-sm btn-ghost text-red-500"><X size={20}/></button>
                                </div>
                            )
                        })}

                        <div className="flex gap-2 pt-2">
                           <button onClick={addSerialField} className="btn btn-outline btn-sm"><Plus size={16}/> Add Serial</button>
                           <button onClick={() => setIsStockListVisible(!isStockListVisible)} className="btn btn-outline btn-sm">
                                <List size={16}/> {isStockListVisible ? 'Hide' : 'Select from'} Stock
                            </button>
                        </div>
                        
                        {isStockListVisible && (
                            <div className="pt-2">
                                <h4 className="font-semibold text-sm">Available at this location</h4>
                                {isStockLoading ? (
                                    <div className="text-center p-4"><span className="loading loading-spinner"></span></div>
                                ) : liveStock.length === 0 ? (
                                    <p className="text-sm text-gray-500 py-2">No serialized stock found.</p>
                                ) : (
                                    <div className="max-h-60 overflow-y-auto space-y-2 border-t mt-2 pt-2">
                                        {liveStock.map(stockItem => {
                                            const isAdded = item.serials.some(s => s.inventoryItemId === stockItem.id);
                                            return (
                                                <div key={stockItem.id} onClick={() => !isAdded && addSelectedItem(stockItem)} className={`p-2 rounded shadow-sm flex justify-between items-center ${isAdded ? 'bg-gray-200 opacity-60' : 'bg-white cursor-pointer hover:bg-blue-50'}`}>
                                                    <span>Serial: <span className='font-semibold'>{stockItem.serial}</span></span>
                                                    {isAdded ? <CheckCircle size={20} className='text-green-500' /> : <button className='btn btn-xs btn-outline btn-primary'><Plus/></button>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="form-control mt-2 w-48">
                        <label className="label"><span className="label-text">Quantity</span></label>
                        <input type="number" value={item.quantity} onChange={handleQuantityChange} className="input-base" min="0" max={nonSerializedStockOnHand} />
                        {isStockLoading ? <span className="loading loading-spinner loading-xs"></span> : <p className="text-xs mt-1">Available: {nonSerializedStockOnHand}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockDeliveryPage;
