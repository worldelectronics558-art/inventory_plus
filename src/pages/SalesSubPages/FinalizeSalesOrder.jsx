
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDocs, query, where, increment, runTransaction, collection, serverTimestamp, arrayUnion } from 'firebase/firestore';

// --- Contexts ---
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import { useSalesOrders } from '../../contexts/SalesOrderContext';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useLoading } from '../../contexts/LoadingContext';

// --- Constants ---
import { EVENT_TYPES } from '../../constants/eventTypes';

// --- Utils & Components ---
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft, AlertTriangle, PackageCheck, Package, ChevronDown, CheckSquare, Square, MinusCircle, PlusCircle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    'PARTIALLY DELIVERED': 'bg-blue-100 text-blue-700',
    FINALIZED: 'bg-green-100 text-green-700',
    'ARCHIVED': 'bg-gray-100 text-gray-500'
};

const FinalizeSalesOrder = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();

    // --- Hooks ---
    const { db, appId, userId, authReady } = useAuth();
    const { currentUser, isLoading: userLoading } = useUser();
    const { salesOrders, isLoading: ordersLoading, setIsMutationDisabled, isMutationDisabled } = useSalesOrders();
    const { pendingDeliverables, isLoading: deliverablesLoading } = usePendingDeliverables();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations();
    const { setAppProcessing } = useLoading();

    // --- State ---
    const [selectedStock, setSelectedStock] = useState({});
    const [openBatches, setOpenBatches] = useState(new Set());
    const [error, setError] = useState('');

    // --- Memoized Data ---
    const isLoading = !authReady || userLoading || ordersLoading || deliverablesLoading || productsLoading || locationsLoading;
    
    const salesOrderForDisplay = useMemo(() => salesOrders.find(so => so.id === orderId), [orderId, salesOrders]);
    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}), [products]);
    const locationMap = useMemo(() => locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.name }), {}), [locations]);

    // --- Transaction Logic ---
    const handleFinalizeDelivery = useCallback(async () => {
        setError('');
        const selectedUnits = Object.values(selectedStock).filter(sel => sel.quantity > 0).map(sel => ({ ...sel.item, quantity: sel.quantity }));
    
        if (selectedUnits.length === 0) { setError('No items selected for delivery.'); return; }
        if (!db || !appId || !userId || !currentUser) { setError('Critical data missing.'); return; }
    
        setAppProcessing(true, 'Finalizing delivery...');
        setIsMutationDisabled(true);
        
        const operationId = doc(collection(db, 'dummy')).id;

        try {
            await runTransaction(db, async (transaction) => {
                const soRef = doc(db, `artifacts/${appId}/sales_orders`, orderId);
                const deliverablesCollectionRef = collection(db, `artifacts/${appId}/pending_deliverables`);
                const productsCollectionRef = collection(db, `artifacts/${appId}/products`);
                const inventoryCollectionRef = collection(db, `artifacts/${appId}/inventory_items`);
                const salesRecordsRef = collection(db, `artifacts/${appId}/sales_records`);
                const historyCollectionRef = collection(db, `artifacts/${appId}/item_history`);
    
                const soDoc = await transaction.get(soRef);
                if (!soDoc.exists()) throw new Error("Sales order not found.");
                const currentSoData = soDoc.data();

                const invDataMap = {};
                for (const unit of selectedUnits) {
                    if (!unit.inventoryItemId) throw new Error(`Missing inventory ID for ${unit.productName}. Data may be corrupt.`);
                    const invSnap = await transaction.get(doc(inventoryCollectionRef, unit.inventoryItemId));
                    if (!invSnap.exists()) throw new Error(`Inventory item ${unit.inventoryItemId} not found.`);
                    invDataMap[unit.inventoryItemId] = invSnap.data();
                }

                const batchIds = [...new Set(selectedUnits.map(u => u.originalDeliverableDocId))];
                const batchDataMap = {};
                for (const bId of batchIds) {
                    const bSnap = await transaction.get(doc(deliverablesCollectionRef, bId));
                    if (bSnap.exists()) batchDataMap[bId] = bSnap.data();
                }

                const newSoItems = JSON.parse(JSON.stringify(currentSoData.items));
                const stockSummaryUpdates = new Map();
                const jsTimestamp = new Date().toISOString();

                for (const unit of selectedUnits) {
                    const soItem = newSoItems.find(i => i.sku === unit.sku);
                    const invItemData = invDataMap[unit.inventoryItemId];
                    
                    if (!unit.locationId) {
                        throw new Error(`Cannot finalize delivery: Item '${unit.productName}' is missing a location ID.`);
                    }
                    if (invItemData.quantity < unit.quantity) {
                        throw new Error(`Insufficient stock for ${unit.productName}`);
                    }

                    const newQuantity = invItemData.quantity - unit.quantity;
                    let newStatus = 'in_stock';
                    if (newQuantity <= 0) {
                        newStatus = invItemData.isSerialized ? 'delivered' : 'depleted';
                    }

                    transaction.update(doc(inventoryCollectionRef, unit.inventoryItemId), {
                        quantity: increment(-unit.quantity),
                        status: newStatus,
                        deliveryDetails: arrayUnion({
                            salesOrderId: orderId,
                            quantity: unit.quantity,
                            finalizedAt: jsTimestamp,
                            finalizedBy: { uid: userId, name: currentUser.displayName }
                        })
                    });

                    transaction.set(doc(salesRecordsRef), {
                        productId: unit.productId, sku: unit.sku, quantity: unit.quantity,
                        unitSalePrice: soItem.unitSalePrice || 0,
                        unitCostPrice: invItemData.unitCostPrice || 0,
                        salesOrderId: orderId, customerName: currentSoData.customerName,
                        finalizedAt: serverTimestamp()
                    });

                    transaction.set(doc(historyCollectionRef), { 
                        operationId: operationId, 
                        type: EVENT_TYPES.SALE_DISPATCHED.key,
                        timestamp: serverTimestamp(),
                        user: { uid: userId, name: currentUser.displayName },
                        inventoryItemId: unit.inventoryItemId,
                        productId: unit.productId,
                        sku: unit.sku, 
                        locationId: unit.locationId,
                        quantity: unit.quantity,
                        context: { type: "SALES_ORDER", documentId: orderId, documentNumber: currentSoData.orderNumber }
                    });

                    soItem.deliveredQty = (soItem.deliveredQty || 0) + unit.quantity;

                    if (!stockSummaryUpdates.has(unit.productId)) {
                        stockSummaryUpdates.set(unit.productId, { total: 0, byLoc: {} });
                    }
                    const sUpd = stockSummaryUpdates.get(unit.productId);
                    sUpd.total -= unit.quantity;
                    sUpd.byLoc[unit.locationId] = (sUpd.byLoc[unit.locationId] || 0) - unit.quantity;
                }

                stockSummaryUpdates.forEach((upd, pId) => {
                    const pRef = doc(productsCollectionRef, pId);
                    const locUpdates = {};
                    Object.entries(upd.byLoc).forEach(([locId, qty]) => {
                        locUpdates[`stockSummary.byLocation.${locId}`] = increment(qty);
                    });
                    transaction.update(pRef, {
                        'stockSummary.totalInStock': increment(upd.total),
                        ...locUpdates
                    });
                });

                for (const [bId, batchData] of Object.entries(batchDataMap)) {
                    const unitsFromThisBatch = selectedUnits.filter(u => u.originalDeliverableDocId === bId);
                    if (unitsFromThisBatch.length === 0) continue;

                    const updatedItems = JSON.parse(JSON.stringify(batchData.items));

                    for (const unit of unitsFromThisBatch) {
                        const itemToUpdate = updatedItems.find(i => i.productId === unit.productId);
                        if (!itemToUpdate) continue;

                        itemToUpdate.quantity -= unit.quantity;

                        if (itemToUpdate.isSerialized) {
                            const serialIndex = itemToUpdate.serials.indexOf(unit.serial);
                            if (serialIndex > -1) {
                                itemToUpdate.serials.splice(serialIndex, 1);
                                if (itemToUpdate.inventoryItemIds) itemToUpdate.inventoryItemIds.splice(serialIndex, 1);
                            }
                        } else {
                            // --- THE FIX ---
                            // This section ensures stale data is never left behind in the batch document.
                            if (itemToUpdate.inventoryItemIds) {
                                const idIndex = itemToUpdate.inventoryItemIds.indexOf(unit.inventoryItemId);
                                if (idIndex > -1) {
                                    itemToUpdate.inventoryItemIds.splice(idIndex, 1);
                                }
                            }
                            // If the legacy field matches the ID we just used, update it
                            // to point to the next available ID, or null if none are left.
                            if (itemToUpdate.inventoryItemId === unit.inventoryItemId) {
                                 itemToUpdate.inventoryItemId = itemToUpdate.inventoryItemIds && itemToUpdate.inventoryItemIds.length > 0 ? itemToUpdate.inventoryItemIds[0] : null;
                            }
                        }
                    }

                    const finalItems = updatedItems.filter(i => i.quantity > 0);
                    if (finalItems.length === 0) {
                        transaction.delete(doc(deliverablesCollectionRef, bId));
                    } else {
                        transaction.update(doc(deliverablesCollectionRef, bId), { items: finalItems });
                    }
                }

                const isFullyDelivered = newSoItems.every(i => (i.deliveredQty || 0) >= i.quantity);
                transaction.update(soRef, {
                    items: newSoItems,
                    status: isFullyDelivered ? 'FINALIZED' : 'PARTIALLY DELIVERED',
                    lastUpdatedAt: serverTimestamp()
                });
            });

            alert('Delivery finalized successfully!');
            navigate('/sales');
        } catch (err) {
            console.error(err);
            setError(`Error: ${err.message}`);
        } finally {
            setAppProcessing(false);
            setIsMutationDisabled(false);
        }
    }, [db, appId, userId, currentUser, orderId, selectedStock, navigate, setAppProcessing, setIsMutationDisabled]);

    
        const relevantBatches = useMemo(() => {
            if (!salesOrderForDisplay || !pendingDeliverables) return {};
            const orderSkus = new Set(salesOrderForDisplay.items.map(item => item.sku));

            return pendingDeliverables.reduce((acc, batch) => {
                const relevantItemsInBatch = batch.items.filter(item => orderSkus.has(item.sku));
                if (relevantItemsInBatch.length === 0) return acc;

                const bId = batch.batchId || batch.id;
                if (!acc[bId]) {
                    acc[bId] = {
                        id: bId,
                        docId: batch.id,
                        preparedBy: batch.createdBy?.name || 'N/A',
                        items: []
                    };
                }

                relevantItemsInBatch.forEach(item => {
                    const productInfo = productMap[item.productId] || {};
                    const locationId = item.locationId;
                    
                    const common = {
                        ...item,
                        productName: getProductDisplayName(productInfo),
                        locationName: locationMap[locationId] || 'Unknown',
                        originalDeliverableDocId: batch.id,
                        locationId: locationId,
                    };

                    if (item.isSerialized) {
                        item.serials.forEach((sn, idx) => {
                            acc[bId].items.push({
                                ...common,
                                id: `${batch.id}-${sn}`,
                                quantity: 1,
                                serial: sn,
                                inventoryItemId: item.inventoryItemIds[idx]
                            });
                        });
                    } else {
                        if (item.inventoryItemIds && item.inventoryItemIds.length > 0) {
                            // 1. Count occurrences of each inventoryItemId
                            const counts = item.inventoryItemIds.reduce((countAcc, invId) => {
                                countAcc[invId] = (countAcc[invId] || 0) + 1;
                                return countAcc;
                            }, {});

                            // 2. Create one UI item for each unique inventoryItemId with the correct quantity
                            for (const [invId, qty] of Object.entries(counts)) {
                                acc[bId].items.push({
                                    ...common,
                                    id: `${batch.id}-${item.productId}-${invId}`, // This is now unique
                                    quantity: qty, // This is the total available quantity
                                    inventoryItemId: invId
                                });
                            }
                        } 
                        else if (item.inventoryItemId) { // Fallback for legacy data
                            acc[bId].items.push({
                                ...common,
                                id: `${batch.id}-${item.productId}`,
                                quantity: item.quantity,
                                inventoryItemId: item.inventoryItemId,
                            });
                        }
                    }
                });

                return acc;
            }, {});
        }, [salesOrderForDisplay, pendingDeliverables, productMap, locationMap]);
        // --- Data Preparation for UI ---
                

    useEffect(() => {
        const keys = Object.keys(relevantBatches);
        if (keys.length > 0 && openBatches.size === 0) setOpenBatches(new Set([keys[0]]));
    }, [relevantBatches]);

    const fulfillmentSummary = useMemo(() => {
        const summary = {};
        if (!salesOrderForDisplay) return summary;
        salesOrderForDisplay.items.forEach(item => { 
            summary[item.sku] = { needed: item.quantity - (item.deliveredQty || 0), selected: 0, productName: item.productName }; 
        });
        Object.values(selectedStock).forEach(sel => { 
            if (summary[sel.item.sku]) summary[sel.item.sku].selected += sel.quantity; 
        });
        return summary;
    }, [selectedStock, salesOrderForDisplay]);

    const handleQuantityChange = (item, qty) => {
        const summary = fulfillmentSummary[item.sku];
        const currentSelection = selectedStock[item.id]?.quantity || 0;
        const maxSelectable = summary.needed - (summary.selected - currentSelection);
        const newQty = Math.max(0, Math.min(qty, item.quantity, maxSelectable));
        
        setSelectedStock(prev => {
            const next = { ...prev };
            if (newQty > 0) next[item.id] = { item, quantity: newQty };
            else delete next[item.id];
            return next;
        });
    };

    if (isLoading) return <LoadingSpinner>Loading Order Details...</LoadingSpinner>;
    if (!salesOrderForDisplay) return <div className="page-container"><p>Order not found.</p></div>

    return (
        <div className="page-container bg-gray-50">
            <header className="page-header">
                <div>
                    <Link to="/sales" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1">
                        <ArrowLeft size={16} className="mr-1" /> Back to Orders
                    </Link>
                    <h1 className="page-title">Finalize Order Delivery</h1>
                </div>
                <div className="page-actions">
                    <button 
                        onClick={handleFinalizeDelivery} 
                        className="btn btn-primary" 
                        disabled={isMutationDisabled || Object.keys(selectedStock).length === 0}
                    >
                        <PackageCheck size={18} className="mr-2" /> Confirm & Finalize Delivery
                    </button>
                </div>
            </header>

            <div className="page-content md:grid md:grid-cols-5 gap-6">
                {/* Left: Progress Sidebar (Matching Purchase Invoice UI) */}
                <div className="md:col-span-2">
                    <div className="card sticky top-20 bg-white shadow p-4 border">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold text-gray-800">{salesOrderForDisplay.orderNumber}</h2>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[salesOrderForDisplay.status]}`}>
                                {salesOrderForDisplay.status}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4"><strong>Customer:</strong> {salesOrderForDisplay.customerName}</p>
                        
                        {error && <div className="alert alert-error text-sm p-2 mb-4"><span>{error}</span></div>}
                        
                        <div className="divider my-1 text-xs font-bold uppercase text-gray-400">Delivery Progress</div>
                        
                        <ul className="space-y-4 my-4">
                            {salesOrderForDisplay.items.map(item => {
                                const sum = fulfillmentSummary[item.sku] || { needed: 0, selected: 0 };
                                const delivered = item.deliveredQty || 0;
                                const totalCurrent = delivered + sum.selected;
                                return (
                                    <li key={item.sku}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold truncate w-40 text-gray-700">{item.productName}</span>
                                            <span className="font-bold">{totalCurrent} / {item.quantity}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 relative overflow-hidden">
                                            <div className="bg-green-500 h-2" style={{ width: `${(delivered / item.quantity) * 100}%` }}></div>
                                            <div className="bg-blue-400 h-2 absolute top-0" style={{ left: `${(delivered / item.quantity) * 100}%`, width: `${(sum.selected / item.quantity) * 100}%` }}></div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>

                {/* Right: Batch Selection (Matching Purchase Invoice UI) */}
                <div className="md:col-span-3">
                    <div className="card bg-white p-4 border shadow-sm">
                        <h2 className="card-title text-md mb-4 flex items-center gap-2">
                            <Package size={20} className="text-indigo-500" /> Select Items from Prepared Batches
                        </h2>
                        
                        {Object.keys(relevantBatches).length === 0 ? (
                            <div className="text-center py-10">
                                <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={32} />
                                <p className="text-gray-500 font-medium">No pending deliverables found.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {Object.values(relevantBatches).map(batch => (
                                    <div key={batch.id} className="border rounded-lg overflow-hidden">
                                        <header 
                                            onClick={() => {
                                                const next = new Set(openBatches);
                                                next.has(batch.id) ? next.delete(batch.id) : next.add(batch.id);
                                                setOpenBatches(next);
                                            }} 
                                            className="bg-gray-50 p-3 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                                        >
                                            <div>
                                                <p className="font-bold text-gray-700 text-sm">{batch.id}</p>
                                                <p className="text-xs text-gray-500">Prepared by {batch.preparedBy}</p>
                                            </div>
                                            <ChevronDown size={18} className={`transition-transform ${openBatches.has(batch.id) ? 'rotate-180' : ''}`} />
                                        </header>

                                        {openBatches.has(batch.id) && (
                                            <ul className="divide-y">
                                                {batch.items.map(item => {
                                                    const selection = selectedStock[item.id];
                                                    const isSelected = !!selection;
                                                    const summary = fulfillmentSummary[item.sku];
                                                    const maxAdd = summary.needed - (summary.selected - (isSelected ? selection.quantity : 0));
                                                    const isDisabled = maxAdd <= 0 && !isSelected;

                                                    return (
                                                        <li key={item.id} className={`p-3 flex items-center justify-between ${isSelected ? 'bg-blue-50' : ''} ${isDisabled ? 'opacity-50' : ''}`}>
                                                            <div className="flex items-center gap-3">
                                                                <div onClick={() => !isDisabled && handleQuantityChange(item, isSelected ? 0 : 1)} className="cursor-pointer">
                                                                    {isSelected ? <CheckSquare className="text-blue-600" /> : <Square className="text-gray-300" />}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium">{item.productName}</p>
                                                                    <p className="text-xs text-gray-400">SKU: {item.sku}</p>
                                                                    <p className="text-xs text-gray-400">Location: {item.locationName}</p>
                                                                    {item.serial && <p className="text-xs font-mono text-blue-600 mt-1">S/N: {item.serial}</p>}
                                                                </div>
                                                            </div>

                                                            {!item.isSerialized && (
                                                                <div className="flex items-center gap-2">
                                                                    <button className="btn btn-ghost btn-xs" onClick={() => handleQuantityChange(item, (selection?.quantity || 0) - 1)} disabled={!isSelected}>
                                                                        <MinusCircle size={18}/>
                                                                    </button>
                                                                    <input 
                                                                        type="number" 
                                                                        value={selection?.quantity || 0} 
                                                                        onChange={e => handleQuantityChange(item, parseInt(e.target.value) || 0)}
                                                                        className="input input-bordered input-xs w-16 text-center"
                                                                        max={item.quantity}
                                                                    />
                                                                    <button className="btn btn-ghost btn-xs" onClick={() => handleQuantityChange(item, (selection?.quantity || 0) + 1)} disabled={isDisabled || (selection?.quantity >= item.quantity)}>
                                                                        <PlusCircle size={18}/>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalizeSalesOrder;
