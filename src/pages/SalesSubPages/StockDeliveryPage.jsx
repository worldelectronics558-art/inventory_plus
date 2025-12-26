import React, { useState, useMemo, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import useLiveInventory from '../../hooks/useLiveInventory';
import { getProductDisplayName } from '../../utils/productUtils';
import { Plus, ChevronLeft, Send, X, CheckCircle } from 'lucide-react';
import { useLoading } from '../../contexts/LoadingContext';
import LoadingSpinner from '../../components/LoadingOverlay';

// Reusing consistent styles from StockReceivePage
const customSelectStyles = {
    control: (p, s) => ({
        ...p,
        width: '100%',
        backgroundColor: '#fff',
        border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB',
        borderRadius: '0.5rem',
        padding: '0.1rem 0',
        boxShadow: 'none',
        '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF' }
    }),
    menu: (p) => ({ ...p, zIndex: 20, backgroundColor: '#fff', border: '1px solid #D1D5DB' }),
    option: (p, s) => ({
        ...p,
        backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent',
        color: s.isSelected ? 'white' : '#111827'
    }),
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

    // Initialize state
    const [formState, setFormState] = useState(() => {
        const savedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
        return savedState ? JSON.parse(savedState) : { locationId: '', batchItems: [] };
    });

    const { locationId, batchItems } = formState;
    const [formError, setFormError] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);

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

    // Add item to the UI list
    const addBatchItem = (item) => {
        if (!item.isSerialized) {
            // Merge quantities for non-serialized
            const existingItem = batchItems.find(bi => bi.productId === item.productId);
            if (existingItem) {
                const newQuantity = existingItem.quantity + item.quantity;
                const updated = batchItems.map(bi =>
                    bi.productId === item.productId ? { ...bi, quantity: newQuantity } : bi
                );
                updateForm('batchItems', updated);
                return;
            }
        } else {
            // Prevent duplicate serialized items
            if (batchItems.some(bi => bi.inventoryItemId === item.inventoryItemId)) {
                return;
            }
        }
        updateForm('batchItems', [...batchItems, item]);
    };

    const removeBatchItem = (id) => {
        updateForm('batchItems', batchItems.filter(item => item.id !== id));
    };
    
    // --- CORE LOGIC UPDATE HERE ---
    const handleSaveBatch = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setFormError('');
        
        if (!user) { setFormError("User profile is not loaded."); setIsSubmitting(false); return; }
        if (!locationId) { setFormError('Please select a delivery location.'); setIsSubmitting(false); return; }
        if (batchItems.length === 0) { setFormError('You must add at least one product.'); setIsSubmitting(false); return; }

        setAppProcessing(true, 'Creating delivery batch...');

        try {
            const productGroups = {};

            // Group items by product to handle quantities and serials
            for (const item of batchItems) {
                if (!productGroups[item.productId]) {
                    productGroups[item.productId] = {
                        productName: item.productName,
                        sku: item.sku,
                        isSerialized: item.isSerialized,
                        items: [], 
                        totalQuantity: 0
                    };
                }
                productGroups[item.productId].items.push(item);
                productGroups[item.productId].totalQuantity += item.quantity;
            }
            
            // Create the final payload to be saved
            const itemsToDeliver = Object.keys(productGroups).map(productId => {
                const group = productGroups[productId];
                
                const payloadItem = {
                    productId: productId,
                    productName: group.productName,
                    sku: group.sku,
                    isSerialized: group.isSerialized,
                    // THE FIX: Use the 'locationId' directly from the component's state,
                    // just like in the working StockReceivePage.jsx file.
                    locationId: locationId,
                    status: "PENDING",
                    quantity: group.totalQuantity,
                    price: 0,
                    cost: 0
                };

                if (group.isSerialized) {
                    payloadItem.serials = group.items.map(i => i.serial); 
                    payloadItem.inventoryItemIds = group.items.map(i => i.inventoryItemId);
                } else {
                    payloadItem.inventoryItemIds = group.items.map(i => i.inventoryItemId);
                    payloadItem.inventoryItemId = group.items[0].inventoryItemId;
                    payloadItem.serials = [];
                }

                return payloadItem;
            });

            if (itemsToDeliver.length === 0) {
                throw new Error("No valid items to deliver.");
            }
            
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
                    <button
                        onClick={handleSaveBatch}
                        className="btn btn-primary"
                        disabled={isMutationDisabled || isSubmitting}
                    >
                        {isSubmitting ? 'Saving...' : <><Send size={18} className="mr-2" /> Save Batch</>}
                    </button>
                </div>
            </header>

            <div className="page-content space-y-4">
                {formError && <div className="alert alert-error text-sm"><span>{formError}</span></div>}

                <div className="form-control">
                    <label className="label"><span className="label-text text-lg font-bold">Select Location</span></label>
                    <select
                        value={locationId}
                        onChange={(e) => updateForm('locationId', e.target.value)}
                        className="input-base"
                        disabled={batchItems.length > 0}
                    >
                        <option value="">-- Select a Location --</option>
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                </div>

                <div className="form-control">
                    <label className="label"><span className="label-text">Select Product</span></label>
                    <Select
                        options={productOptions}
                        value={selectedProduct}
                        onChange={setSelectedProduct}
                        styles={customSelectStyles}
                        placeholder="Search for a product..."
                        menuPortalTarget={document.body}
                        className="grow"
                        isDisabled={!locationId || isMutationDisabled || isSubmitting}
                        isClearable
                    />
                </div>

                {selectedProduct && (
                    <AvailableStockPanel
                        product={selectedProduct.product}
                        locationId={locationId}
                        onItemSelected={addBatchItem}
                        existingBatchItems={batchItems}
                    />
                )}

                <div className="divider"></div>

                <div className="space-y-3">
                    {batchItems.length === 0 ? (
                        <div className="card text-center p-4 text-gray-500">
                            No items added yet. Select a product from stock above.
                        </div>
                    ) : (
                        batchItems.map(item => (
                            <DeliveryItemCard
                                key={item.id}
                                item={item}
                                onRemove={removeBatchItem}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// Sub-components kept similar to ensure logic consistency but adapted for "Selection" rather than "Entry"

const AvailableStockPanel = ({ product, locationId, onItemSelected, existingBatchItems }) => {
    const { inventoryItems: liveStock, isLoading: isStockLoading } = useLiveInventory(locationId, product.sku, product.isSerialized);
    const [quantity, setQuantity] = useState(1);

    // FIX: Aggregate quantity from ALL documents in liveStock
    const nonSerializedStockOnHand = useMemo(() => {
        if (product.isSerialized || !liveStock.length) return 0;
        return liveStock.reduce((acc, item) => acc + (item.quantity || 0), 0);
    }, [liveStock, product.isSerialized]);

    const nonSerializedInBatch = useMemo(() => {
        if (product.isSerialized) return 0;
        const itemInBatch = existingBatchItems.find(item => item.productId === product.id);
        return itemInBatch ? itemInBatch.quantity : 0;
    }, [existingBatchItems, product.id, product.isSerialized]);

    const availableToSelect = nonSerializedStockOnHand - nonSerializedInBatch;
    
    const handleAddNonSerialized = () => {
        if (quantity > availableToSelect || quantity <= 0) return;
        
        // When adding non-serialized, we use the first matching document ID as a reference
        // but because we now pass multiple inventoryItemIds in the payload (above),
        // the backend can perform FIFO deduction across all documents.
        onItemSelected({
            id: `ns_${product.id}`, 
            inventoryItemId: liveStock[0].id, // Reference ID
            productId: product.id,
            sku: product.sku,
            productName: getProductDisplayName(product),
            isSerialized: false,
            quantity: quantity,
            locationId: locationId,
        });
        setQuantity(1);
    };

    const handleAddSerialized = (stockItem) => {
        onItemSelected({
            id: stockItem.id, // Using the inventory item ID as unique key for batch item
            inventoryItemId: stockItem.id,
            productId: product.id,
            sku: product.sku,
            productName: getProductDisplayName(product),
            isSerialized: true,
            serial: stockItem.serial, // Capture singular serial here for display
            quantity: 1,
            locationId: locationId,
        });
    };

    useEffect(() => {
        setQuantity(1);
    }, [product.id]);

    if (isStockLoading) return <div className="text-center p-4"><span className="loading loading-spinner"></span></div>;

    return (
        <div className="mt-4 border-t pt-4">
            <h3 className="font-bold">Available Stock for: <span className="text-primary">{getProductDisplayName(product)}</span></h3>
            {liveStock.length === 0 ? (
                <p className='text-center text-sm text-gray-500 py-4'>No stock available at this location.</p>
            ) : product.isSerialized ? (
                <div className="max-h-60 overflow-y-auto bg-gray-50 p-2 rounded-lg mt-2 space-y-1">
                    {liveStock.map(item => {
                        const isAdded = existingBatchItems.some(bi => bi.inventoryItemId === item.id);
                        return (
                        <div key={item.id} onClick={() => !isAdded && handleAddSerialized(item)} className={`p-2 rounded shadow-sm flex justify-between items-center ${isAdded ? 'bg-gray-200 opacity-60' : 'bg-white cursor-pointer hover:bg-blue-50'}`}>
                            <span>Serial: <span className='font-semibold'>{item.serial}</span></span>
                            {isAdded ? <CheckCircle size={20} className='text-green-500' /> : <button className='btn btn-xs btn-outline btn-primary'><Plus/></button>}
                        </div>
                    )})}
                </div>
            ) : ( 
                <div className="mt-2">
                    {/* UI now reflects the SUM of all matching documents */}
                    <p className='text-sm mb-2'>Available to add: <span className='font-bold'>{availableToSelect}</span> / {nonSerializedStockOnHand}</p>
                    {availableToSelect > 0 ? (
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                value={quantity} 
                                onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} 
                                className="input input-bordered w-24" 
                                max={availableToSelect} 
                                min={1}
                            />
                            <button 
                                onClick={handleAddNonSerialized} 
                                className="btn btn-primary" 
                                disabled={quantity <= 0 || quantity > availableToSelect}
                            >
                                <Plus size={16}/> Add to Batch
                            </button>
                        </div>
                    ) : (
                        <p className='text-sm text-red-500'>This item is fully batched or out of stock.</p>
                    )}
                </div>
            )}
        </div>
    );
};

const DeliveryItemCard = ({ item, onRemove }) => {
    return (
        <div className="card bg-base-100 border shadow-md" data-item-id={item.id}>
            <div className="card-body p-3 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg">{item.productName}</h3>
                    <p className="text-sm text-gray-600 font-mono">SKU: {item.sku}</p>
                    <p className="text-sm text-gray-700 mt-1">
                        {item.isSerialized 
                            ? <span className="badge badge-outline">Serial: {item.serial}</span> 
                            : `Quantity: ${item.quantity}`
                        }
                    </p>
                </div>
                <button
                    onClick={() => onRemove(item.id)}
                    className="btn btn-sm btn-ghost text-red-500"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};

export default StockDeliveryPage;
