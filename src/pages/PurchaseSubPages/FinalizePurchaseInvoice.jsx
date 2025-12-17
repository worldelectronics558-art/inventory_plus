
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';

// --- Contexts ---
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import { usePurchaseInvoices } from '../../contexts/PurchaseInvoiceContext';
import { usePendingReceivables } from '../../contexts/PendingReceivablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useLoading } from '../../contexts/LoadingContext';

// --- Utils & Components ---
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft, AlertTriangle, Package, ChevronDown, CheckSquare, Square, MinusCircle, PlusCircle, PackageCheck } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    'PARTIALLY RECEIVED': 'bg-blue-100 text-blue-700',
    FINALIZED: 'bg-green-100 text-green-700',
    'ARCHIVED': 'bg-gray-100 text-gray-500'
};

const FinalizePurchaseInvoice = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();

    // --- Hooks ---
    const { db, appId, userId, authReady } = useAuth();
    const { currentUser, isLoading: userLoading } = useUser();
    const { invoices, isLoading: invoicesLoading, setMutationDisabled, isMutationDisabled } = usePurchaseInvoices();
    const { pendingReceivables, isLoading: receivablesLoading } = usePendingReceivables();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations();
    const { setAppProcessing } = useLoading();

    // --- State ---
    const [selectedStock, setSelectedStock] = useState({});
    const [openBatches, setOpenBatches] = useState(new Set());
    const [error, setError] = useState('');

    // --- Memoized Data for UI Display ---
    const isLoading = !authReady || userLoading || invoicesLoading || receivablesLoading || productsLoading || locationsLoading;
    const invoiceForDisplay = useMemo(() => invoices.find(i => i.id === invoiceId), [invoiceId, invoices]);
    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p, [p.sku]: p }), {}), [products]);
    const locationMap = useMemo(() => locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.name }), {}), [locations]);

    // --- Main Transaction Logic ---
    const handleFinalizeInvoice = useCallback(async () => {
        setError('');
        const selectedUnits = Object.values(selectedStock).map(sel => ({ ...sel.item, quantity: sel.quantity }));

        if (selectedUnits.length === 0) {
            setError('No items have been selected to add to stock.');
            return;
        }
        if (!db || !appId || !userId || !currentUser) {
            setError('Critical data is missing (DB, App, or User). Please refresh and try again.');
            return;
        }

        setAppProcessing(true, 'Authorizing stock...');
        setMutationDisabled(true);

        try {
            await runTransaction(db, async (transaction) => {
                const invoiceRef = doc(db, `artifacts/${appId}/purchase_invoices`, invoiceId);
                const productsCollectionRef = collection(db, `artifacts/${appId}/products`);
                const receivablesCollectionRef = collection(db, `artifacts/${appId}/pending_receivables`);
                const historyCollectionRef = collection(db, `artifacts/${appId}/item_history`);

                // --- PHASE 1: READS ---
                const invoiceDoc = await transaction.get(invoiceRef);
                if (!invoiceDoc.exists()) throw new Error("Invoice not found. It may have been deleted.");

                const productIds = [...new Set(selectedUnits.map(u => u.productId))];
                const receivableIds = [...new Set(selectedUnits.map(u => u.originalReceivableId))];

                const productDocsPromise = productIds.map(id => transaction.get(doc(productsCollectionRef, id)));
                const receivableDocsPromise = receivableIds.map(id => transaction.get(doc(receivablesCollectionRef, id)));
                
                const [productDocs, receivableDocs] = await Promise.all([Promise.all(productDocsPromise), Promise.all(receivableDocsPromise)]);

                const productsData = productDocs.reduce((acc, doc) => {
                    if(doc.exists()) acc[doc.id] = doc.data();
                    return acc;
                }, {});
                
                const receivablesData = receivableDocs.reduce((acc, doc) => {
                    if(doc.exists()) acc[doc.id] = doc.data();
                    return acc;
                }, {});

                // --- PHASE 2: PROCESS & PREPARE WRITES ---
                const currentInvoiceData = invoiceDoc.data();
                const newInvoiceItems = JSON.parse(JSON.stringify(currentInvoiceData.items));

                const stockSummaryUpdates = new Map();
                const receivableUpdates = new Map();

                for (const unit of selectedUnits) {
                    const invoiceItem = newInvoiceItems.find(i => i.productId === unit.sku);
                    if (!invoiceItem) throw new Error(`SKU ${unit.sku} not found in this invoice.`);
                    if (!productsData[unit.productId]) throw new Error(`Product data for ${unit.productId} could not be read.`);
                    
                    const receivableData = receivablesData[unit.originalReceivableId];
                    if (!receivableData) throw new Error(`Pending receivable doc ${unit.originalReceivableId} not found.`);

                    // Create new Inventory Item
                    const inventoryItemRef = doc(collection(db, `artifacts/${appId}/inventory_items`));
                    transaction.set(inventoryItemRef, {
                        sku: unit.sku,
                        productId: unit.productId,
                        productName: unit.productName,
                        isSerialized: unit.isSerialized, 
                        serial: unit.serial || null,
                        quantity: unit.quantity,
                        status: 'in_stock',
                        locationId: unit.locationId,
                        unitCostPrice: invoiceItem.unitCostPrice,
                        invoiceId: invoiceId,
                        invoiceNumber: currentInvoiceData.invoiceNumber,
                        supplierName: currentInvoiceData.supplierName, 
                        receivedAt: receivableData.createdAt, // Correctly use timestamp from batch
                        receivedBy: receivableData.createdBy,
                        authorizedAt: serverTimestamp(),
                        authorizedBy: { uid: userId, name: currentUser.displayName || 'N/A' },
                        ownerId: appId,
                    });

                    // Create History Log
                    const historyDocRef = doc(historyCollectionRef);
                    transaction.set(historyDocRef, {
                        type: "STOCK_AUTHORIZED",
                        timestamp: serverTimestamp(),
                        user: { uid: userId, name: currentUser.displayName || 'N/A' },
                        inventoryItemId: inventoryItemRef.id,
                        productId: unit.productId,
                        sku: unit.sku,
                        serial: unit.serial || null,
                        quantity: unit.quantity,
                        locationId: unit.locationId,
                        context: {
                            type: "PURCHASE_INVOICE",
                            documentId: invoiceId,
                            documentNumber: currentInvoiceData.invoiceNumber,
                            supplierName: currentInvoiceData.supplierName,
                            receivedBy: receivableData.createdBy,
                        }
                    });
                    
                    // Aggregate updates for pending receivables (new logic)
                    if (!receivableUpdates.has(unit.originalReceivableId)) {
                        receivableUpdates.set(unit.originalReceivableId, {
                            doc: receivableData,
                            itemUpdates: new Map()
                        });
                    }
                    const batchUpdate = receivableUpdates.get(unit.originalReceivableId);
                    if (!batchUpdate.itemUpdates.has(unit.productId)) {
                        batchUpdate.itemUpdates.set(unit.productId, { qtyTaken: 0, serialsTaken: new Set() });
                    }
                    const itemUpdate = batchUpdate.itemUpdates.get(unit.productId);
                    if (unit.isSerialized) {
                        itemUpdate.serialsTaken.add(unit.serial);
                    } else {
                        itemUpdate.qtyTaken += unit.quantity;
                    }
                    
                    // Aggregate updates for product stock summaries
                    if (!stockSummaryUpdates.has(unit.productId)) {
                         stockSummaryUpdates.set(unit.productId, { doc: productsData[unit.productId], qtyChange: 0, locationChanges: new Map() });
                    }
                    const stockUpdate = stockSummaryUpdates.get(unit.productId);
                    stockUpdate.qtyChange += unit.quantity;
                    stockUpdate.locationChanges.set(unit.locationId, (stockUpdate.locationChanges.get(unit.locationId) || 0) + unit.quantity);

                    // Update invoice item received quantity
                    invoiceItem.receivedQty = (invoiceItem.receivedQty || 0) + unit.quantity;
                }

                // --- PHASE 3: APPLY AGGREGATED WRITES --- 

                // Update Pending Receivables
                for (const [id, update] of receivableUpdates.entries()) {
                    const receivableRef = doc(receivablesCollectionRef, id);
                    const originalItems = update.doc.items;

                    const newItems = originalItems.map(item => {
                        const itemUpdate = update.itemUpdates.get(item.productId);
                        if (!itemUpdate) return item;

                        if (item.isSerialized) {
                            const newSerials = item.serials.filter(s => !itemUpdate.serialsTaken.has(s));
                            return { ...item, serials: newSerials, quantity: newSerials.length };
                        } else {
                            return { ...item, quantity: item.quantity - itemUpdate.qtyTaken };
                        }
                    }).filter(item => item.quantity > 0);

                    if (newItems.length > 0) {
                        transaction.update(receivableRef, { items: newItems });
                    } else {
                        transaction.delete(receivableRef);
                    }
                }
                
                // Update Product Summaries
                for (const [productId, update] of stockSummaryUpdates.entries()) {
                    const productRef = doc(productsCollectionRef, productId);
                    const newSummary = update.doc.stockSummary || { totalInStock: 0, byLocation: {} };
                    newSummary.totalInStock = (newSummary.totalInStock || 0) + update.qtyChange;
                    for(const [locId, qty] of update.locationChanges.entries()){
                       newSummary.byLocation[locId] = (newSummary.byLocation[locId] || 0) + qty;
                    }
                    transaction.update(productRef, { stockSummary: newSummary });
                }

                // Update Invoice
                const isFullyReceived = newInvoiceItems.every(item => item.receivedQty >= item.quantity);
                transaction.update(invoiceRef, {
                    items: newInvoiceItems,
                    status: isFullyReceived ? 'FINALIZED' : 'PARTIALLY RECEIVED',
                    lastUpdatedAt: serverTimestamp(),
                    lastUpdatedBy: { uid: userId, name: currentUser.displayName || 'N/A' },
                });
            });

            alert('Stock authorized and added to inventory successfully!');
            navigate('/purchase');

        } catch (error) {
            console.error("A critical error occurred during finalization:", error);
            setError(`Error: ${error.message}`);
        } finally {
            setAppProcessing(false);
            setMutationDisabled(false);
        }
    }, [db, appId, userId, currentUser, invoiceId, selectedStock, navigate, setAppProcessing, setMutationDisabled]);
    
    const relevantBatches = useMemo(() => {
        if (!invoiceForDisplay || !pendingReceivables) return {};
        const invoiceSkus = new Set(invoiceForDisplay.items.map(item => item.productId));
    
        const relevantPRs = pendingReceivables.filter(batch => 
            batch.items.some(item => invoiceSkus.has(item.sku))
        );
    
        const grouped = relevantPRs.reduce((acc, batch) => {
            const batchId = batch.batchId;
            if (!acc[batchId]) {
                acc[batchId] = {
                    items: [],
                    receivedBy: batch.createdBy?.name || 'N/A',
                    receivedAt: batch.createdAt?.toDate ? batch.createdAt.toDate().toLocaleDateString() : 'N/A',
                    id: batch.id 
                };
            }
    
            batch.items.forEach(item => {
                if (!invoiceSkus.has(item.sku)) return; // Only include items relevant to the invoice

                const productInfo = productMap[item.productId] || {};
                const commonData = {
                    ...item,
                    productName: getProductDisplayName(productInfo),
                    locationName: locationMap[item.locationId] || 'Unknown Location',
                    originalReceivableId: batch.id, // The ID of the batch document
                    batchId: batchId,
                    createdAt: batch.createdAt // FIX: Pass the timestamp object
                };
    
                if (item.isSerialized) {
                    item.serials.forEach(serial => {
                        acc[batchId].items.push({
                            ...commonData,
                            id: `${batch.id}-${item.productId}-${serial}`,
                            quantity: 1,
                            serial: serial
                        });
                    });
                } else {
                    acc[batchId].items.push({
                        ...commonData,
                        id: `${batch.id}-${item.productId}`
                    });
                }
            });
    
            return acc;
        }, {});
    
        return Object.keys(grouped).sort().reverse().reduce((obj, key) => {
            if (grouped[key].items.length > 0) { // Only include batches that have relevant items
                obj[key] = grouped[key];
            }
            return obj;
        }, {});
    }, [invoiceForDisplay, pendingReceivables, productMap, locationMap]);

    useEffect(() => {
        const keys = Object.keys(relevantBatches);
        if (keys.length > 0 && openBatches.size === 0) { setOpenBatches(new Set([keys[0]])); }
    }, [relevantBatches, openBatches]);

    const fulfillmentSummary = useMemo(() => {
        const summary = {};
        if (!invoiceForDisplay) return summary;
        invoiceForDisplay.items.forEach(item => { summary[item.productId] = { needed: item.quantity - (item.receivedQty || 0), selected: 0 }; });
        Object.values(selectedStock).forEach(sel => {
            if (summary[sel.item.sku]) { summary[sel.item.sku].selected += sel.quantity; }
        });
        return summary;
    }, [selectedStock, invoiceForDisplay]);

    const handleQuantityChange = (item, qty) => {
        const summary = fulfillmentSummary[item.sku];
        if (!summary) return;
        const currentSelection = selectedStock[item.id]?.quantity || 0;
        const maxSelectable = summary.needed - (summary.selected - currentSelection);
        const newQty = Math.max(0, Math.min(qty, item.quantity, maxSelectable));
        setSelectedStock(prev => {
            const next = { ...prev };
            if (newQty > 0) { next[item.id] = { item, quantity: newQty }; } else { delete next[item.id]; }
            return next;
        });
    };
    
    const toggleBatch = (batchId) => {
        setOpenBatches(prev => {
            const next = new Set(prev);
            if (next.has(batchId)) { next.delete(batchId); } else { next.add(batchId); }
            return next;
        });
    };

    if (isLoading) return <LoadingSpinner>Loading Invoice Details...</LoadingSpinner>;
    if (!invoiceForDisplay) return <div className="page-container"><p>Invoice not found.</p></div>

    return (
        <div className="page-container bg-gray-50">
             <header className="page-header">
                 <div>
                    <Link to="/purchase" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1"><ArrowLeft size={16} className="mr-1" /> Back to Invoices</Link>
                    <h1 className="page-title">Authorize Received Stock</h1>
                </div>
                <div className="page-actions">
                    <button onClick={handleFinalizeInvoice} className="btn btn-primary" disabled={isMutationDisabled || Object.keys(selectedStock).length === 0}>
                        <PackageCheck size={18} className="mr-2" /> Confirm & Authorize Stock
                    </button>
                </div>
            </header>
            <div className="page-content md:grid md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2">
                     <div className="card sticky top-20 bg-white shadow p-4 border">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold text-gray-800 truncate" title={invoiceForDisplay.invoiceNumber}>{invoiceForDisplay.invoiceNumber}</h2>
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusStyles[invoiceForDisplay.status] || 'bg-gray-100'}`}>{invoiceForDisplay.status}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4"><strong>Supplier:</strong> {invoiceForDisplay.supplierName || 'N/A'}</p>
                        {error && <div className="alert alert-error text-sm p-2 mb-4"><span>{error}</span></div>}
                        <div className="divider my-1">Fulfillment Progress</div>
                        <ul className="space-y-3 my-4">
                            {invoiceForDisplay.items.map(item => {
                                const summary = fulfillmentSummary[item.productId] || { needed: 0, selected: 0 };
                                const received = item.receivedQty || 0;
                                const finalQty = received + summary.selected;
                                const total = item.quantity;
                                return(
                                <li key={item.productId}>
                                    <p className="font-semibold text-gray-700 truncate" title={productMap[item.productId]?.name || item.productName}>{productMap[item.productId]?.name || item.productName}</p>
                                    <div className="flex items-center justify-between text-sm">
                                        <p className="text-gray-500">Remaining: {Math.max(0, summary.needed - summary.selected)}</p>
                                        <p className="font-bold text-gray-800">{finalQty} / {total}</p>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 mt-1 relative overflow-hidden">
                                        <div className="bg-green-500 h-3" style={{ width: `${(received / total) * 100}%` }}></div>
                                        <div className="bg-blue-400 h-3 absolute top-0" style={{ left: `${(received / total) * 100}%`, width: `${(summary.selected / total) * 100}%`}}></div>
                                    </div>
                                </li>
                            )})}
                        </ul>
                    </div>
                </div>
                <div className="lg:col-span-3 mt-6 md:mt-0">
                    <div className="card bg-white p-4 border">
                        <h2 className="card-title mb-4">Select from Pending Received Stock</h2>
                        {Object.keys(relevantBatches).length === 0 ? (
                            <div className="text-center text-gray-500 py-8 flex flex-col items-center">
                                <AlertTriangle size={24} className="text-yellow-500 mb-2" />
                                <p className="font-semibold">No Matching Stock Found</p>
                                <p className="text-sm">There are no pending received items that match this purchase invoice.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                                {Object.entries(relevantBatches).map(([batchId, batch]) => {
                                    const isOpen = openBatches.has(batchId);
                                    return (
                                    <div key={batch.id} className="border rounded-lg bg-white shadow-sm">
                                        <header onClick={() => toggleBatch(batchId)} className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{batchId}</span>
                                                <span className="text-xs text-gray-500">Received by {batch.receivedBy} on {batch.receivedAt}</span>
                                            </div>
                                            <ChevronDown size={20} className={`transition-transform transform ${isOpen ? 'rotate-180' : ''}`} />
                                        </header>
                                        {isOpen && (
                                            <ul className="divide-y divide-gray-100 p-1">
                                                {batch.items.map(item => {
                                                    const selection = selectedStock[item.id];
                                                    const isSelected = !!selection;
                                                    const summary = fulfillmentSummary[item.sku] || { needed: 0, selected: 0 };
                                                    const maxAdd = summary.needed - (summary.selected - (isSelected ? selection.quantity : 0));
                                                    const isDisabled = maxAdd <= 0 && !isSelected;
                                                    if (item.isSerialized) {
                                                        return (
                                                            <li key={item.id} onClick={() => !isDisabled && handleQuantityChange(item, isSelected ? 0 : 1)} 
                                                                className={`flex items-center p-2 rounded-md ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-50'} ${isSelected ? 'bg-green-100 font-semibold' : ''}`}>
                                                                <div className="mr-3">{isSelected ? <CheckSquare className="text-green-600"/> : <Square className="text-gray-400"/>}</div>
                                                                <Package size={20} className="mr-4 text-gray-500"/>
                                                                <div className="flex-grow">
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
                                                            <div className="flex-grow">
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

export default FinalizePurchaseInvoice;
