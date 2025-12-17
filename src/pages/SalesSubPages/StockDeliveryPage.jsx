import React, { useState, useMemo, useCallback } from 'react';
import Select from 'react-select';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import useLiveInventory from '../../hooks/useLiveInventory';
import { getProductDisplayName } from '../../utils/productUtils';
import { Plus, ChevronLeft, Send, Search, X, Package, CheckCircle } from 'lucide-react';
import { useLoading } from '../../contexts/LoadingContext';
import LoadingSpinner from '../../components/LoadingOverlay';

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#fff', border: s.isFocused ? '2px solid #3B82F6' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#3B82F6' : '#9CA3AF' } }),
    menu: (p) => ({ ...p, zIndex: 20, backgroundColor: '#fff', border: '1px solid #D1D5DB' }),
    option: (p, s) => ({ ...p, backgroundColor: s.isSelected ? '#3B82F6' : s.isFocused ? '#DBEAFE' : 'transparent', color: s.isSelected ? 'white' : '#111827' }),
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

    const productOptions = useMemo(() => products.map(p => ({ value: p.id, label: getProductDisplayName(p), product: p })), [products]);

    const addBatchItem = (item) => {
        // For non-serialized, check if it's already in the batch
        if (!item.isSerialized) {
            const existingItemIndex = batchItems.findIndex(bi => bi.productId === item.productId);
            if (existingItemIndex > -1) {
                // Just update quantity
                const newQuantity = batchItems[existingItemIndex].quantity + item.quantity;
                updateBatchItem(batchItems[existingItemIndex].id, { quantity: newQuantity });
                return;
            }
        }
        
        // For serialized, check if the specific inventory item is already added
        if(item.isSerialized && batchItems.some(bi => bi.inventoryItemId === item.inventoryItemId)){
            return; // Already added
        }

        setBatchItems(prev => [item, ...prev]);
    };

    const updateBatchItem = (id, newValues) => {
        setBatchItems(prev => prev.map(item => item.id === id ? { ...item, ...newValues } : item));
    };

    const removeBatchItem = (id) => {
        setBatchItems(prev => prev.filter(item => item.id !== id));
    };
    
    const handleSaveBatch = async () => {
        setFormError('');
        if (!user) { setFormError("User profile is not loaded."); return; }
        if (!locationId) { setFormError('Please select a delivery location.'); return; }
        if (batchItems.length === 0) { setFormError('You must add at least one product.'); return; }

        setAppProcessing(true, 'Creating delivery batch...');

        try {
            // The batchItems are already in the correct format for `itemsToDeliver`
            // Perform a final validation check
            const itemsToDeliver = batchItems.map(item => {
                 if (item.quantity <= 0) {
                    throw new Error(`Quantity for ${item.productName} must be positive.`);
                }
                return {
                    productId: item.productId,
                    productName: item.productName,
                    sku: item.sku,
                    isSerialized: item.isSerialized,
                    quantity: item.quantity,
                    serial: item.serial || null,
                    inventoryItemId: item.inventoryItemId,
                    locationId: locationId // Ensure location is consistent
                };
            });

            if (itemsToDeliver.length === 0) {
                throw new Error("No valid items to deliver.");
            }
            
            // Dummy order for direct delivery
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
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Create Stock Delivery</h1>
                <div className="page-actions">
                    <Link to="/sales" className="btn btn-ghost"> <ChevronLeft size={20}/> Back </Link>
                    <button onClick={handleSaveBatch} className="btn btn-primary" disabled={isMutationDisabled || batchItems.length === 0}> <Send size={18} /> Create Batch </button>
                </div>
            </header>
            <div className="page-content md:grid md:grid-cols-2 gap-6">
                {/* Left Column: Batch Item List */}
                <div className="card bg-base-100 shadow-lg border">
                    <div className="card-body">
                        <h2 className="card-title">Delivery Batch</h2>
                        {formError && <div className="alert alert-error text-sm p-2"><span>{formError}</span></div>}
                        <div className="divider my-1"></div>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                            {batchItems.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Add products from the right panel.</p>
                            ) : batchItems.map(item => (
                                <div key={item.id} className="p-2 border rounded-lg bg-white flex justify-between items-center">
                                    <div>
                                        <p className="font-bold">{item.productName}</p>
                                        <p className="text-sm text-gray-500 font-mono">{item.isSerialized ? `SN: ${item.serial}` : `QTY: ${item.quantity}`}</p>
                                    </div>
                                    <button onClick={() => removeBatchItem(item.id)} className="btn btn-sm btn-ghost text-red-500"><X size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Product Selection */}
                <div className="card bg-base-100 shadow-lg border mt-6 md:mt-0">
                    <div className="card-body">
                         <div className="form-control">
                            <label className="label"><span className="label-text font-bold text-base">1. Select Delivery Location</span></label>
                            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="input-base" disabled={batchItems.length > 0}>
                                <option value="">-- Select a Location --</option>
                                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                         <div className="form-control mt-4">
                            <label className="label"><span className="label-text font-bold text-base">2. Select Product</span></label>
                            <Select options={productOptions} value={selectedProduct} onChange={setSelectedProduct} styles={customSelectStyles} placeholder="Search for a product..." menuPortalTarget={document.body} className="flex-grow" isDisabled={!locationId} isClearable />
                        </div>
                        
                        {selectedProduct && (
                             <AvailableStockPanel 
                                product={selectedProduct.product}
                                locationId={locationId}
                                onItemSelected={addBatchItem}
                                existingBatchItems={batchItems}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const AvailableStockPanel = ({ product, locationId, onItemSelected, existingBatchItems }) => {
    const { inventoryItems: liveStock, isLoading: isStockLoading } = useLiveInventory(locationId, product.sku);
    const [quantity, setQuantity] = useState(1);

    const nonSerializedStock = useMemo(() => {
        if (product.isSerialized) return 0;
        // Find the single inventory item for this non-serialized product at the location
        return liveStock.length > 0 ? liveStock[0].quantity : 0;
    }, [liveStock, product.isSerialized]);

    const handleAddNonSerialized = () => {
        if (quantity > nonSerializedStock || quantity <= 0) return;
        
        onItemSelected({
            id: `${liveStock[0].id}-${quantity}`, // Temp ID
            inventoryItemId: liveStock[0].id,
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
            id: stockItem.id, // Use inventory item ID as unique ID
            inventoryItemId: stockItem.id,
            productId: product.id,
            sku: product.sku,
            productName: getProductDisplayName(product),
            isSerialized: true,
            serial: stockItem.serial,
            quantity: 1,
            locationId: locationId,
        });
    };

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
            ) : ( // Non-Serialized UI
                <div className="mt-2">
                     <p className='text-sm mb-2'>Available Quantity: <span className='font-bold'>{nonSerializedStock}</span></p>
                    {nonSerializedStock > 0 ? (
                        <div className="flex items-center gap-2">
                            <input type="number" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} className="input input-bordered w-24" max={nonSerializedStock} min={1}/>
                            <button onClick={handleAddNonSerialized} className="btn btn-primary" disabled={quantity <= 0 || quantity > nonSerializedStock}><Plus size={16}/> Add to Batch</button>
                        </div>
                    ) : (
                        <p className='text-sm text-red-500'>Out of stock.</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default StockDeliveryPage;
