import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, runTransaction, collection, serverTimestamp, increment } from 'firebase/firestore';

// --- Contexts ---
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import { useSalesOrders } from '../../contexts/SalesOrderContext';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useLoading } from '../../contexts/LoadingContext';

// --- Utils & Components ---
import { getProductDisplayName } from '../../utils/productUtils';
import { ChevronLeft, AlertTriangle, PackageCheck, Package, ChevronDown, CheckSquare, Square, MinusCircle, PlusCircle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    'PARTIALLY DELIVERED': 'bg-blue-100 text-blue-700',
    FINALIZED: 'bg-green-100 text-green-700',
    'ARCHIVED': 'bg-gray-100 text-gray-500'
};

const FinalizeSalesOrder = () => {
    const navigate = useNavigate();
    const { orderId } = useParams();

    const { db, appId, userId, authReady } = useAuth();
    const { currentUser, isLoading: isUserLoading } = useUser();
    const { salesOrders, isLoading: ordersLoading, setMutationDisabled, isMutationDisabled } = useSalesOrders();
    const { pendingDeliverables, isLoading: deliverablesLoading } = usePendingDeliverables();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations();
    const { setAppProcessing } = useLoading();

    const [error, setError] = useState('');
    const [selectedStock, setSelectedStock] = useState({});
    const [openBatches, setOpenBatches] = useState(new Set());

    const isLoading = !authReady || isUserLoading || ordersLoading || deliverablesLoading || productsLoading || locationsLoading;
    
    const salesOrderForDisplay = useMemo(() => salesOrders.find(so => so.id === orderId), [salesOrders, orderId]);
    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p, [p.sku]: p }), {}), [products]);
    const locationMap = useMemo(() => locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.name }), {}), [locations]);

    const relevantDeliveryBatches = useMemo(() => {
        if (!salesOrderForDisplay || !pendingDeliverables.length) return {};
        const orderProductIds = new Set(salesOrderForDisplay.items?.map(item => item.productId) || []);
        
        const relevantBatches = pendingDeliverables.filter(batch => {
            if (batch.salesOrderId === salesOrderForDisplay.id) return true;
            return batch.items?.some(item => orderProductIds.has(item.productId));
        });

        const grouped = relevantBatches.reduce((acc, batch) => {
            const batchId = batch.batchId;
            if (!acc[batchId]) {
                acc[batchId] = {
                    items: [],
                    createdBy: batch.createdBy?.name || 'N/A',
                    createdAt: batch.createdAt?.toDate ? batch.createdAt.toDate().toLocaleDateString() : 'N/A',
                    id: batch.id,
                };
            }

            batch.items.forEach(item => {
                if (!orderProductIds.has(item.productId)) return;
                const productInfo = productMap[item.productId] || {};

                if (item.isSerialized && item.serials) {
                    item.serials.forEach((serial, index) => {
                        const inventoryItemId = item.inventoryItemIds?.[index];
                        if (!inventoryItemId) return; 

                        acc[batchId].items.push({
                            ...item,
                            id: `${batch.id}-${inventoryItemId}`,
                            productName: getProductDisplayName(productInfo),
                            locationName: locationMap[item.locationId] || 'Unknown',
                            originalDeliverableId: batch.id,
                            batchId: batchId,
                            serial: serial,
                            inventoryItemId: inventoryItemId,
                            quantity: 1,
                        });
                    });
                } else if (!item.isSerialized) {
                    acc[batchId].items.push({
                        ...item,
                        id: `${batch.id}-${item.inventoryItemId}`,
                        productName: getProductDisplayName(productInfo),
                        locationName: locationMap[item.locationId] || 'Unknown',
                        originalDeliverableId: batch.id,
                        batchId: batchId,
                    });
                }
            });
            return acc;
        }, {});

        return Object.keys(grouped).sort().reverse().reduce((obj, key) => {
            if (grouped[key].items.length > 0) obj[key] = grouped[key];
            return obj;
        }, {});
    }, [salesOrderForDisplay, pendingDeliverables, productMap, locationMap]);

    const fulfillmentSummary = useMemo(() => {
        const summary = {};
        if (!salesOrderForDisplay) return summary;
        salesOrderForDisplay.items.forEach(item => { 
            summary[item.productId] = { needed: item.quantity - (item.deliveredQty || 0), selected: 0 }; 
        });
        Object.values(selectedStock).forEach(sel => {
            if (summary[sel.item.productId]) { 
                summary[sel.item.productId].selected += sel.quantity; 
            }
        });
        return summary;
    }, [selectedStock, salesOrderForDisplay]);

    useEffect(() => {
        const keys = Object.keys(relevantDeliveryBatches);
        if (keys.length > 0 && openBatches.size === 0) { 
            setOpenBatches(new Set([keys[0]])); 
        }
    }, [relevantDeliveryBatches, openBatches]);

    const handleQuantityChange = (item, qty) => {
        const summary = fulfillmentSummary[item.productId];
        if (!summary) return;
        const currentSelection = selectedStock[item.id]?.quantity || 0;
        const maxSelectable = summary.needed - (summary.selected - currentSelection);
        const newQty = Math.max(0, Math.min(qty, item.quantity, maxSelectable));
        
        setSelectedStock(prev => {
            const next = { ...prev };
            if (newQty > 0) { 
                next[item.id] = { item, quantity: newQty }; 
            } else { 
                delete next[item.id]; 
            }
            return next;
        });
    };

    const toggleBatch = (batchId) => {
        setOpenBatches(prev => {
            const next = new Set(prev);
            if (next.has(batchId)) next.delete(batchId); 
            else next.add(batchId);
            return next;
        });
    };

    const handleFinalizeDelivery = useCallback(async () => {
        setError('');
        const selectedUnits = Object.values(selectedStock).map(sel => ({ ...sel.item, quantity: sel.quantity }));

        if (selectedUnits.length === 0) { setError('No items have been selected for delivery.'); return; }
        if (!userId || !currentUser) { setError('User data not available.'); return; }
        if (!db || !appId || !salesOrderForDisplay) { setError('Critical data is missing.'); return; }

        setAppProcessing(true, 'Finalizing delivery...');
        setMutationDisabled(true);

        try {
            await runTransaction(db, async (transaction) => {
                const soRef = doc(db, `artifacts/${appId}/sales_orders`, salesOrderForDisplay.id);
                const salesRecordsRef = collection(db, `artifacts/${appId}/sales_records`);
                const historyCollectionRef = collection(db, `artifacts/${appId}/item_history`);
                const productsCollectionRef = collection(db, `artifacts/${appId}/products`);
                const deliverablesCollectionRef = collection(db, `artifacts/${appId}/pending_deliverables`);

                const soDoc = await transaction.get(soRef);
                if (!soDoc.exists()) throw new Error("Sales order not found.");

                const inventoryItemIds = [...new Set(selectedUnits.map(u => u.inventoryItemId).filter(Boolean))];
                const deliverableIds = [...new Set(selectedUnits.map(u => u.originalDeliverableId))];
                
                const inventoryDocs = await Promise.all(inventoryItemIds.map(id => transaction.get(doc(db, `artifacts/${appId}/inventory_items`, id))));
                const deliverableDocs = await Promise.all(deliverableIds.map(id => transaction.get(doc(deliverablesCollectionRef, id))));

                const inventoryDataMap = inventoryDocs.reduce((acc, doc) => doc.exists() ? ({...acc, [doc.id]: doc.data()}) : acc, {});
                const deliverablesData = deliverableDocs.reduce((acc, doc) => doc.exists() ? ({...acc, [doc.id]: doc.data()}) : acc, {});

                const salesOrderData = soDoc.data();
                const updatedSoItems = JSON.parse(JSON.stringify(salesOrderData.items));
                const stockSummaryUpdates = new Map();
                const deliverableUpdates = new Map();

                for (const unit of selectedUnits) {
                    const invItemData = inventoryDataMap[unit.inventoryItemId];
                    if (!invItemData) throw new Error(`Inventory item ${unit.inventoryItemId} could not be found.`);
                    if (invItemData.status !== 'in_stock') throw new Error(`Stock for ${unit.productName} (${unit.serial || 'N/A'}) is no longer available.`);
                    
                    const deliverableData = deliverablesData[unit.originalDeliverableId];
                    if (!deliverableData) throw new Error(`Deliverable batch ${unit.originalDeliverableId} not found.`);

                    const soItemForPrice = updatedSoItems.find(i => i.productId === unit.productId);
                    const unitSalePrice = soItemForPrice?.unitSalePrice || 0;

                    const invItemRef = doc(db, `artifacts/${appId}/inventory_items`, unit.inventoryItemId);
                    const deliveryDetails = {
                        finalizedBy: { uid: userId, name: currentUser.displayName || 'N/A' },
                        finalizedAt: serverTimestamp(),
                        salesOrderId: salesOrderForDisplay.id,
                        salesOrderNumber: salesOrderForDisplay.orderNumber,
                        customerId: salesOrderData.customerId,
                        customerName: salesOrderData.customerName
                    };
                    
                    if (unit.isSerialized) {
                        transaction.update(invItemRef, { status: 'delivered', deliveryDetails });
                    } else {
                        if (invItemData.quantity < unit.quantity) throw new Error(`Not enough quantity for ${unit.productName}.`);
                        const newQuantity = invItemData.quantity - unit.quantity;
                        transaction.update(invItemRef, { 
                            quantity: newQuantity, 
                            ...(newQuantity === 0 && { status: 'delivered' }),
                            deliveryDetails: { ...(invItemData.deliveryDetails || {}), ...deliveryDetails }
                        });
                    }

                    transaction.set(doc(salesRecordsRef), {
                        productId: unit.productId, productName: unit.productName, quantity: unit.quantity,
                        isSerialized: unit.isSerialized, serial: unit.serial || null, salesOrderId: salesOrderForDisplay.id,
                        salesOrderNumber: salesOrderForDisplay.orderNumber, customerId: salesOrderData.customerId,
                        customerName: salesOrderData.customerName, locationId: unit.locationId,
                        unitSalePrice: unitSalePrice, unitCostPrice: invItemData.unitCostPrice || 0,
                        finalizedAt: serverTimestamp(), finalizedBy: { uid: userId, name: currentUser.displayName || 'N/A' }, appId: appId,
                    });

                    transaction.set(doc(historyCollectionRef), {
                        type: "STOCK_DELIVERED", timestamp: serverTimestamp(), user: { uid: userId, name: currentUser.displayName || 'N/A' },
                        inventoryItemId: unit.inventoryItemId, productId: unit.productId, sku: unit.sku,
                        serial: unit.serial || null, quantity: unit.quantity, locationId: unit.locationId, unitSalePrice: unitSalePrice,
                        context: { type: "SALES_ORDER", documentId: salesOrderForDisplay.id, documentNumber: salesOrderForDisplay.orderNumber,
                            customerId: salesOrderData.customerId, customerName: salesOrderData.customerName }
                    });

                    const soItemToUpdate = updatedSoItems.find(i => i.productId === unit.productId);
                    if (soItemToUpdate) soItemToUpdate.deliveredQty = (soItemToUpdate.deliveredQty || 0) + unit.quantity;

                    if (!deliverableUpdates.has(unit.originalDeliverableId)) {
                        deliverableUpdates.set(unit.originalDeliverableId, {
                            doc: deliverableData,
                            itemUpdates: new Map()
                        });
                    }
                    const batchUpdate = deliverableUpdates.get(unit.originalDeliverableId);
                    if (!batchUpdate.itemUpdates.has(unit.productId)) {
                        batchUpdate.itemUpdates.set(unit.productId, { qtyTaken: 0, serialsTaken: [], price: unitSalePrice });
                    }
                    const itemUpdate = batchUpdate.itemUpdates.get(unit.productId);
                    itemUpdate.qtyTaken += unit.quantity;
                    if(unit.isSerialized) itemUpdate.serialsTaken.push(unit.serial);

                    if (!stockSummaryUpdates.has(unit.productId)) {
                        stockSummaryUpdates.set(unit.productId, { qtyChange: 0, locationChanges: new Map() });
                    }
                    const stockUpdate = stockSummaryUpdates.get(unit.productId);
                    stockUpdate.qtyChange -= unit.quantity;
                    stockUpdate.locationChanges.set(unit.locationId, (stockUpdate.locationChanges.get(unit.locationId) || 0) - unit.quantity);
                }

                for (const [id, update] of deliverableUpdates.entries()) {
                    const deliverableRef = doc(deliverablesCollectionRef, id);
                    const newItems = update.doc.items.map(item => {
                        const itemUpdate = update.itemUpdates.get(item.productId);
                        if (!itemUpdate) return item;

                        const newItem = {...item, price: itemUpdate.price};
                        if (newItem.isSerialized) {
                            const serialsTakenSet = new Set(itemUpdate.serialsTaken);
                            const newSerials = [];
                            const newInventoryItemIds = [];
                            newItem.serials.forEach((s, i) => {
                                if(!serialsTakenSet.has(s)){
                                    newSerials.push(s);
                                    newInventoryItemIds.push(newItem.inventoryItemIds[i]);
                                }
                            });
                            newItem.serials = newSerials;
                            newItem.inventoryItemIds = newInventoryItemIds;
                            newItem.quantity = newSerials.length;
                        } else {
                            newItem.quantity -= itemUpdate.qtyTaken;
                        }
                        return newItem.quantity > 0 ? newItem : null;
                    }).filter(Boolean);

                    if (newItems.length > 0) {
                        transaction.update(deliverableRef, { items: newItems });
                    } else {
                        transaction.delete(deliverableRef);
                    }
                }

                for (const [productId, update] of stockSummaryUpdates.entries()) {
                    const productRef = doc(productsCollectionRef, productId);
                    const updates = { 'stockSummary.totalInStock': increment(update.qtyChange) };
                    for (const [locId, qty] of update.locationChanges.entries()) {
                        updates[`stockSummary.byLocation.${locId}`] = increment(qty);
                    }
                    transaction.update(productRef, updates);
                }

                const isFullyDelivered = updatedSoItems.every(item => item.deliveredQty >= item.quantity);
                transaction.update(soRef, {
                    items: updatedSoItems,
                    status: isFullyDelivered ? 'FINALIZED' : 'PARTIALLY DELIVERED',
                    lastUpdatedAt: serverTimestamp(),
                    lastUpdatedBy: { uid: userId, name: currentUser.displayName || 'N/A' },
                });
            });

            alert('Delivery finalized successfully!');
            navigate('/sales');
        } catch (error) {
            console.error("Finalization failed:", error);
            setError(`Finalization failed: ${error.message}`);
        } finally {
            setAppProcessing(false);
            setMutationDisabled(false);
        }
    }, [db, appId, userId, currentUser, salesOrderForDisplay, selectedStock, navigate, setAppProcessing, setMutationDisabled, fulfillmentSummary]);

    if (isLoading) return <LoadingSpinner>Loading order details...</LoadingSpinner>;
    
    if (!salesOrderForDisplay && !isLoading) {
        return (
            <div className="page-container text-center">
                <p className="text-lg">Sales order not found.</p>
                <Link to="/sales" className="btn btn-primary mt-4">Return to Sales</Link>
            </div>
        );
    }

    return (
        <div className="page-container bg-gray-50">
            <header className="page-header">
                <div>
                    <Link to="/sales" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1">
                        <ChevronLeft size={16} className="mr-1" /> Back to Sales Orders
                    </Link>
                    <h1 className="page-title">Finalize Delivery</h1>
                </div>
                <div className="page-actions">
                    <button onClick={handleFinalizeDelivery} className="btn btn-primary" disabled={isMutationDisabled || Object.keys(selectedStock).length === 0}>
                        <PackageCheck size={18} className="mr-2" /> Confirm & Finalize Delivery
                    </button>
                </div>
            </header>

            <div className="page-content md:grid md:grid-cols-2 lg:grid-cols-5 gap-6">
                {/* Left Column: Order Summary */}
                <div className="lg:col-span-2">
                    <div className="card sticky top-20 bg-white shadow p-4 border">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold text-gray-800 truncate" title={salesOrderForDisplay?.orderNumber}>
                                {salesOrderForDisplay?.orderNumber}
                            </h2>
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusStyles[salesOrderForDisplay?.status] || 'bg-gray-100'}`}>
                                {salesOrderForDisplay?.status}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            <strong>Customer:</strong> {salesOrderForDisplay?.customerName || 'N/A'}
                        </p>
                        {error && (
                            <div className="alert alert-error text-sm p-2 mb-4">
                                <span>{error}</span>
                            </div>
                        )}
                        <div className="divider my-1">Fulfillment Progress</div>
                        <ul className="space-y-3 my-4">
                            {salesOrderForDisplay?.items?.map(item => {
                                const summary = fulfillmentSummary[item.productId] || { needed: 0, selected: 0 };
                                const delivered = item.deliveredQty || 0;
                                const finalQty = delivered + summary.selected;
                                const total = item.quantity;
                                return (
                                    <li key={item.productId}>
                                        <p className="font-semibold text-gray-700 truncate" title={productMap[item.productId]?.name || item.productName}>
                                            {productMap[item.productId]?.name || item.productName}
                                        </p>
                                        <div className="flex items-center justify-between text-sm">
                                            <p className="text-gray-500">Remaining: {Math.max(0, summary.needed - summary.selected)}</p>
                                            <p className="font-bold text-gray-800">{finalQty} / {total}</p>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3 mt-1 relative overflow-hidden">
                                            <div className="bg-green-500 h-3" style={{ width: `${(delivered / total) * 100}%` }}></div>
                                            <div className="bg-blue-400 h-3 absolute top-0" style={{ left: `${(delivered / total) * 100}%`, width: `${(summary.selected / total) * 100}%`}}></div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>

                {/* Right Column: Delivery Batches */}
                <div className="lg:col-span-3 mt-6 md:mt-0">
                    <div className="card bg-white p-4 border">
                        <h2 className="card-title mb-4">Select from Pending Delivery Batches</h2>
                        {Object.keys(relevantDeliveryBatches).length === 0 ? (
                            <div className="text-center text-gray-500 py-8 flex flex-col items-center">
                                <AlertTriangle size={24} className="text-yellow-500 mb-2" />
                                <p className="font-semibold">No Matching Delivery Batches Found</p>
                                <p className="text-sm">There are no pending delivery batches that match this sales order.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                                {Object.entries(relevantDeliveryBatches).map(([batchId, batch]) => {
                                    const isOpen = openBatches.has(batchId);
                                    return (
                                        <div key={batch.id} className="border rounded-lg bg-white shadow-sm">
                                            <header onClick={() => toggleBatch(batchId)} className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-800">{batchId}</span>
                                                    <span className="text-xs text-gray-500">Created by {batch.createdBy} on {batch.createdAt}</span>
                                                </div>
                                                <ChevronDown size={20} className={`transition-transform transform ${isOpen ? 'rotate-180' : ''}`} />
                                            </header>
                                            {isOpen && (
                                                <ul className="divide-y divide-gray-100 p-1">
                                                    {batch.items.map(item => {
                                                        const selection = selectedStock[item.id];
                                                        const isSelected = !!selection;
                                                        const summary = fulfillmentSummary[item.productId] || { needed: 0, selected: 0 };
                                                        const maxAdd = summary.needed - (summary.selected - (isSelected ? selection.quantity : 0));
                                                        const isDisabled = maxAdd <= 0 && !isSelected;
                                                        if (item.isSerialized) {
                                                            return (
                                                                <li key={item.id} onClick={() => !isDisabled && handleQuantityChange(item, isSelected ? 0 : 1)} 
                                                                    className={`flex items-center p-2 rounded-md ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-50'} ${isSelected ? 'bg-green-100 font-semibold' : ''}`}>
                                                                    <div className="mr-3">{isSelected ? <CheckSquare className="text-green-600"/> : <Square className="text-gray-400"/>}</div>
                                                                    <Package size={20} className="mr-4 text-gray-500"/>
                                                                    <div className="grow">
                                                                        <p>{item.productName}</p>
                                                                        <p className="text-xs text-gray-500 font-mono">Serial: {item.serial}</p>
                                                                    </div>
                                                                    {isDisabled && !isSelected && <span className="badge badge-sm badge-warning ml-2">Not Needed</span>}
                                                                </li>
                                                            );
                                                        }
                                                        return (
                                                            <li key={item.id} className={`flex items-center p-2 rounded-md ${isDisabled && !isSelected ? 'opacity-50' : ''} ${isSelected ? 'bg-green-100' : ''}`}>
                                                                <Package size={20} className="mr-4 text-gray-500"/>
                                                                <div className="grow">
                                                                    <p>{item.productName}</p>
                                                                    <p className="text-xs text-gray-600">Available Qty: {item.quantity}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button disabled={isDisabled || !isSelected} onClick={() => handleQuantityChange(item, (selection?.quantity || 0) - 1)}><MinusCircle size={18}/></button>
                                                                    <input type="number" value={selection?.quantity || 0} onChange={e => handleQuantityChange(item, parseInt(e.target.value, 10) || 0)} className="input input-bordered input-xs w-16 text-center" disabled={isDisabled} max={Math.min(item.quantity, maxAdd)} />
                                                                    <button disabled={isDisabled || (selection?.quantity || 0) >= item.quantity} onClick={() => handleQuantityChange(item, (selection?.quantity || 0) + 1)}><PlusCircle size={18}/></button>
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalizeSalesOrder;
