
import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, runTransaction, collection, serverTimestamp, increment } from 'firebase/firestore';

// --- Contexts ---
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import { useSalesOrders, } from '../../contexts/SalesOrderContext';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLoading } from '../../contexts/LoadingContext';

// --- Utils & Components ---
import { getProductDisplayName } from '../../utils/productUtils';
import { ChevronLeft, CheckCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const FinalizeSalesOrder = () => {
    const navigate = useNavigate();
    const { deliverableId } = useParams();

    // --- Hooks ---
    const { db, appId, userId, authReady } = useAuth();
    const { currentUser, isLoading: isUserLoading } = useUser();
    const { setMutationDisabled, isMutationDisabled } = useSalesOrders();
    const { pendingDeliverables, isLoading: isDeliverablesLoading } = usePendingDeliverables();
    const { products, isLoading: isProductsLoading } = useProducts();
    const { setAppProcessing } = useLoading();

    // --- State ---
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    // --- Memoized Data ---
    const deliverable = useMemo(() => pendingDeliverables.find(d => d.id === deliverableId), [pendingDeliverables, deliverableId]);
    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}), [products]);

    // --- Main Transaction Logic (Aligned with FinalizePurchaseInvoice) ---
    const handleFinalizeDelivery = useCallback(async () => {
        setError('');
        if (!userId || !currentUser) { setError('User data not available. Please try again.'); return; }
        if (pin !== '1234') { setError('Invalid PIN. Delivery cannot be confirmed.'); return; }
        if (!db || !appId || !deliverable) { setError('Critical data is missing. Please refresh and try again.'); return; }

        setAppProcessing(true, 'Finalizing delivery...');
        setMutationDisabled(true);

        const isDirectDelivery = deliverable.salesOrderId === 'direct-delivery';

        try {
            await runTransaction(db, async (transaction) => {
                // --- Reference Definitions ---
                const deliverableRef = doc(db, `artifacts/${appId}/pending_deliverables`, deliverable.id);
                const salesRecordsRef = collection(db, `artifacts/${appId}/sales_records`);
                const historyCollectionRef = collection(db, `artifacts/${appId}/item_history`);
                const productsCollectionRef = collection(db, `artifacts/${appId}/products`);
                const soRef = isDirectDelivery ? null : doc(db, `artifacts/${appId}/sales_orders`, deliverable.salesOrderId);

                // --- PHASE 1: READS ---
                const deliverableDoc = await transaction.get(deliverableRef);
                if (!deliverableDoc.exists()) throw new Error("Deliverable not found. It may have been processed already.");

                const soDoc = soRef ? await transaction.get(soRef) : null;
                if (soRef && !soDoc.exists()) throw new Error("The associated Sales Order could not be found.");
                
                const inventoryItemIds = [...new Set(deliverable.items.map(item => item.inventoryItemId))];
                const productIds = [...new Set(deliverable.items.map(item => item.productId))];

                const inventoryDocsPromise = inventoryItemIds.map(id => transaction.get(doc(db, `artifacts/${appId}/inventory_items`, id)));
                const productDocsPromise = productIds.map(id => transaction.get(doc(productsCollectionRef, id)));

                const [inventoryDocs, productDocs] = await Promise.all([Promise.all(inventoryDocsPromise), Promise.all(productDocsPromise)]);
                
                const inventoryDataMap = inventoryDocs.reduce((acc, doc) => {
                    if (doc.exists()) acc[doc.id] = doc.data();
                    return acc;
                }, {});

                // This read is not strictly necessary for the transaction writes, but good for validation
                // const productsDataMap = productDocs.reduce((acc, doc) => {
                //     if (doc.exists()) acc[doc.id] = doc.data();
                //     return acc;
                // }, {});

                // --- PHASE 2: PROCESS & PREPARE WRITES ---
                const salesOrderData = soDoc ? soDoc.data() : null;
                const updatedSoItems = soDoc ? JSON.parse(JSON.stringify(salesOrderData.items)) : null;
                const stockSummaryUpdates = new Map();
                
                for (const item of deliverable.items) {
                    const invItemData = inventoryDataMap[item.inventoryItemId];
                    if (!invItemData) throw new Error(`Inventory item ${item.inventoryItemId} could not be found.`);
                    if (invItemData.status !== 'in_stock') throw new Error(`Stock for ${item.productName} (${item.serial || 'N/A'}) is no longer available.`);
                    
                    const invItemRef = doc(db, `artifacts/${appId}/inventory_items`, item.inventoryItemId);
                    const soItemForPrice = updatedSoItems?.find(i => i.productId === item.productId);

                    // 1. Prepare Inventory Item Update
                    const deliveryDetails = {
                        finalizedBy: { uid: userId, name: currentUser.displayName || 'N/A' },
                        finalizedAt: serverTimestamp(),
                        ...(isDirectDelivery 
                            ? { customerName: 'Direct Delivery' } 
                            : { salesOrderId: deliverable.salesOrderId, salesOrderNumber: deliverable.salesOrderNumber, customerId: salesOrderData.customerId, customerName: salesOrderData.customerName })
                    };
                    
                    if (item.isSerialized) {
                        transaction.update(invItemRef, { status: 'delivered', deliveryDetails });
                    } else {
                        if (invItemData.quantity < item.quantity) throw new Error(`Not enough quantity for ${item.productName}. Available: ${invItemData.quantity}, Needed: ${item.quantity}.`);
                        const newQuantity = invItemData.quantity - item.quantity;
                        transaction.update(invItemRef, { 
                            quantity: newQuantity, 
                            ...(newQuantity === 0 && { status: 'delivered' }), // Only change status if quantity is zero
                            deliveryDetails: { ...(invItemData.deliveryDetails || {}), ...deliveryDetails } // Merge details
                        });
                    }

                    // 2. Prepare Sales Record Creation
                    transaction.set(doc(salesRecordsRef), {
                        productId: item.productId, productName: item.productName, quantity: item.quantity, isSerialized: item.isSerialized, serial: item.serial || null,
                        salesOrderId: deliverable.salesOrderId, salesOrderNumber: deliverable.salesOrderNumber || 'N/A',
                        customerId: isDirectDelivery ? null : salesOrderData.customerId,
                        customerName: isDirectDelivery ? 'Direct Delivery' : salesOrderData.customerName,
                        locationId: item.locationId,
                        unitSalePrice: soItemForPrice?.unitSalePrice || 0,
                        unitCostPrice: invItemData.unitCostPrice || 0,
                        finalizedAt: serverTimestamp(),
                        finalizedBy: { uid: userId, name: currentUser.displayName || 'N/A' }, appId: appId,
                    });

                    // 3. Prepare History Log Creation
                    transaction.set(doc(historyCollectionRef), {
                        type: "STOCK_DELIVERED", timestamp: serverTimestamp(), user: { uid: userId, name: currentUser.displayName || 'N/A' },
                        inventoryItemId: item.inventoryItemId, productId: item.productId, sku: item.sku, serial: item.serial || null,
                        quantity: item.quantity, locationId: item.locationId,
                        context: isDirectDelivery
                            ? { type: "DIRECT_DELIVERY", documentId: deliverable.id, customerName: 'Direct Delivery' }
                            : { type: "SALES_ORDER", documentId: deliverable.salesOrderId, documentNumber: deliverable.salesOrderNumber, customerId: salesOrderData.customerId, customerName: salesOrderData.customerName }
                    });
                    
                    // 4. Aggregate Sales Order and Stock Summary Updates
                    if (updatedSoItems) {
                        const soItemToUpdate = updatedSoItems.find(i => i.productId === item.productId);
                        if (soItemToUpdate) soItemToUpdate.deliveredQty = (soItemToUpdate.deliveredQty || 0) + item.quantity;
                    }
                    
                    if (!stockSummaryUpdates.has(item.productId)) {
                        stockSummaryUpdates.set(item.productId, { qtyChange: 0, locationChanges: new Map() });
                    }
                    const stockUpdate = stockSummaryUpdates.get(item.productId);
                    stockUpdate.qtyChange -= item.quantity; // Decrement stock
                    const locChanges = stockUpdate.locationChanges;
                    locChanges.set(item.locationId, (locChanges.get(item.locationId) || 0) - item.quantity);
                }

                // --- PHASE 3: WRITES ---
                for (const [productId, update] of stockSummaryUpdates.entries()) {
                    const productRef = doc(productsCollectionRef, productId);
                    const updates = { 'stockSummary.totalInStock': increment(update.qtyChange) };
                    for (const [locId, qty] of update.locationChanges.entries()) {
                        updates[`stockSummary.byLocation.${locId}`] = increment(qty);
                    }
                    transaction.update(productRef, updates);
                }

                if (soRef && updatedSoItems) {
                    const isFullyDelivered = updatedSoItems.every(item => item.deliveredQty >= item.quantity);
                    transaction.update(soRef, { items: updatedSoItems, status: isFullyDelivered ? 'FINALIZED' : 'PARTIALLY DELIVERED', lastUpdatedAt: serverTimestamp() });
                }

                transaction.delete(deliverableRef);
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
    }, [db, appId, userId, currentUser, deliverable, pin, navigate, setAppProcessing, setMutationDisabled]);

    const isLoading = !authReady || isDeliverablesLoading || isProductsLoading || isUserLoading;
    if (isLoading) return <LoadingSpinner>Loading delivery details...</LoadingSpinner>;
    if (!deliverable && !isLoading) return (
        <div className="page-container text-center">
            <p className="text-lg">This delivery is no longer available.</p>
            <Link to="/sales/pending-deliverables" className="btn btn-primary mt-4">Return to Deliveries</Link>
        </div>
    );

    return (
        <div className="page-container bg-gray-50">
            <header className="page-header">
                 <div>
                    <Link to="/sales/pending-deliverables" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1"><ChevronLeft size={16} className="mr-1" /> Back to Pending Deliveries</Link>
                    <h1 className="page-title">Confirm Delivery</h1>
                </div>
                <div className="page-actions">
                    <button onClick={handleFinalizeDelivery} className="btn btn-primary" disabled={isMutationDisabled || !pin}>
                        <CheckCircle size={20} className="mr-2" /> Finalize Delivery
                    </button>
                </div>
            </header>

            <div className="page-content max-w-4xl mx-auto">
                {error && (
                    <div className="alert alert-error mb-4">
                         <AlertTriangle size={20} />
                        <span>{error}</span>
                    </div>
                )}
                {deliverable && (
                <div className="card bg-base-100 shadow-lg">
                    <div className="card-body">
                        <h2 className="card-title text-2xl">Batch: {deliverable.batchId}</h2>
                        <p className="text-gray-600"><strong>Sales Order:</strong> {deliverable.salesOrderNumber}</p>
                        <p className="text-gray-600"><strong>Customer:</strong> {deliverable.customerName}</p>
                        
                        <div className="divider my-4"></div>
                        
                        <h3 className="text-xl font-semibold mb-3">Items for Delivery</h3>
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="table w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className='p-3'>Product</th>
                                        <th className='p-3'>Quantity</th>
                                        <th className='p-3'>Serial(s)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deliverable.items.map((item, index) => {
                                        const productInfo = productMap[item.productId];
                                        return (
                                            <tr key={index} className="border-b last:border-b-0">
                                                <td className='p-3 font-medium'>{getProductDisplayName(productInfo || { name: item.productName })}</td>
                                                <td className='p-3'>{item.quantity}</td>
                                                <td className='p-3 font-mono text-sm'>
                                                    {item.isSerialized ? item.serial : 'N/A'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="divider my-4"></div>

                        <div className="max-w-sm mx-auto bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <label className="label justify-center">
                                <ShieldCheck size={24} className="mr-2 text-blue-600"/>
                                <span className="label-text text-lg font-bold text-blue-800">Driver Confirmation PIN</span>
                            </label>
                            <input 
                                type="password" 
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="input input-bordered w-full text-center text-xl tracking-widest mt-2" 
                                placeholder="****"
                                maxLength={4}
                            />
                             <p className='text-xs text-center text-gray-500 mt-2'>Enter the 4-digit PIN to finalize this delivery.</p>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};

export default FinalizeSalesOrder;
