
// src/pages/PurchaseSubPages/FinalizePurchaseInvoice.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

// --- Contexts ---
import { usePurchaseInvoices } from '../../contexts/PurchaseInvoiceContext';
import { usePendingReceivables } from '../../contexts/PendingReceivablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useSync } from '../../contexts/SyncContext.jsx';

// --- Utils & Components ---
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft, Edit, Link2, AlertTriangle, Package, ChevronDown, CheckSquare, Square } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    'PARTIALLY RECEIVED': 'bg-blue-100 text-blue-700',
    FINALIZED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100',
};

const FinalizePurchaseInvoice = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();

    // --- Data from Contexts ---
    const { invoices, isLoading: invoicesLoading } = usePurchaseInvoices();
    const { pendingReceivables, isLoading: receivablesLoading } = usePendingReceivables();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations();
    const { setAppProcessing } = useLoading();
    const { currentUser, isLoading: userLoading } = useUser();
    const { userId } = useAuth();
    const { addToQueue } = useSync();

    // --- Local State ---
    const [invoice, setInvoice] = useState(null);
    const [selectedStock, setSelectedStock] = useState({});
    const [openBatches, setOpenBatches] = useState(new Set());

    const isLoading = invoicesLoading || receivablesLoading || productsLoading || locationsLoading || userLoading;

    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}), [products]);
    const locationMap = useMemo(() => locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.name }), {}), [locations]);

    useEffect(() => {
        if (!isLoading) {
            const inv = invoices.find(i => i.id === invoiceId);
            if (inv) {
                const initializedItems = (inv.items || []).map(item => ({...item, receivedQty: item.receivedQty || 0 }));
                setInvoice({ ...inv, items: initializedItems });
            }
        }
    }, [invoiceId, invoices, isLoading]);

    const relevantBatches = useMemo(() => {
        if (isLoading || !invoice) return {};
        const invoiceSkus = new Set(invoice.items.map(item => item.productId));
        const relevantReceivables = pendingReceivables.filter(pr => invoiceSkus.has(pr.sku));
        
        const grouped = relevantReceivables.reduce((acc, receivable) => {
            const batchId = receivable.batchId || `nobatch_${receivable.id}`;
            if (!acc[batchId]) {
                acc[batchId] = {
                    items: [],
                    receivedBy: receivable.createdBy?.name || 'N/A',
                    receivedAt: receivable.createdAt?.toDate ? receivable.createdAt.toDate().toLocaleDateString() : 'N/A',
                };
            }

            const productInfo = productMap[receivable.productId] || {};
            const commonItemData = {
                ...receivable,
                productName: getProductDisplayName(productInfo),
                locationName: locationMap[receivable.locationId] || 'N/A',
                originalReceivableId: receivable.id,
            };

            if (receivable.isSerialized && receivable.serials?.length > 0) {
                receivable.serials.forEach(serial => {
                    acc[batchId].items.push({
                        ...commonItemData,
                        id: `${receivable.id}-${serial}`,
                        quantity: 1,
                        serial: serial, 
                    });
                });
            } else {
                 acc[batchId].items.push({
                    ...commonItemData,
                    id: receivable.id,
                });
            }
            return acc;
        }, {});

        return Object.keys(grouped).sort().reverse().reduce((obj, key) => { 
            obj[key] = grouped[key]; 
            return obj; 
        }, {});
    }, [isLoading, invoice, pendingReceivables, productMap, locationMap]);

    useEffect(() => {
        const firstBatchKey = Object.keys(relevantBatches)[0];
        if (firstBatchKey) {
            setOpenBatches(new Set([firstBatchKey]));
        }
    }, [relevantBatches]);

    const fulfillmentSummary = useMemo(() => {
        const summary = {};
        if (!invoice) return summary;
        invoice.items.forEach(item => {
            summary[item.productId] = { needed: item.quantity - (item.receivedQty || 0), selected: 0 };
        });

        Object.values(selectedStock).forEach(selectedItem => {
            if (summary[selectedItem.sku]) {
                summary[selectedItem.sku].selected += selectedItem.quantity;
            }
        });
        return summary;
    }, [selectedStock, invoice]);

    const isItemDisabled = useCallback((item) => {
        const summary = fulfillmentSummary[item.sku];
        if (!summary) return true;
        const isSelected = !!selectedStock[item.id];
        return !isSelected && summary.selected >= summary.needed;
    }, [fulfillmentSummary, selectedStock]);

    const handleSelectionChange = useCallback((item) => {
        if (isItemDisabled(item) && !selectedStock[item.id]) return;
        setSelectedStock(prev => {
            const newSelection = { ...prev };
            if (newSelection[item.id]) {
                delete newSelection[item.id];
            } else {
                newSelection[item.id] = item;
            }
            return newSelection;
        });
    }, [isItemDisabled, selectedStock]);

    const handleBatchSelectionChange = useCallback((batch) => {
        const selectableItems = batch.items.filter(item => !isItemDisabled(item) || selectedStock[item.id]);
        const areAllSelected = selectableItems.every(item => selectedStock[item.id]);

        setSelectedStock(prev => {
            const newSelection = { ...prev };
            selectableItems.forEach(item => {
                if (areAllSelected) {
                    delete newSelection[item.id];
                } else {
                    const summary = fulfillmentSummary[item.sku];
                    if (summary && (summary.selected < summary.needed || selectedStock[item.id])) {
                         newSelection[item.id] = item;
                    }
                }
            });
            return newSelection;
        });
    }, [isItemDisabled, selectedStock, fulfillmentSummary]);

    const handleAttachItems = async () => {
        const selectedItems = Object.values(selectedStock);
        if (selectedItems.length === 0) return alert('No items selected.');
        if (!userId || !currentUser) return alert("Authentication error: User not found. Please log in again.");

        setAppProcessing(true, 'Queuing stock finalization...');

        // Prepare updated invoice data
        const updatedInvoiceItems = JSON.parse(JSON.stringify(invoice.items));
        selectedItems.forEach(item => {
            const invoiceItem = updatedInvoiceItems.find(invItem => invItem.productId === item.sku);
            if (invoiceItem) {
                invoiceItem.receivedQty = (invoiceItem.receivedQty || 0) + item.quantity;
            }
        });

        const isFullyReceived = updatedInvoiceItems.every(item => item.receivedQty >= item.quantity);
        const newStatus = isFullyReceived ? 'FINALIZED' : 'PARTIALLY RECEIVED';
        
        const updatedInvoiceData = {
            items: updatedInvoiceItems,
            status: newStatus
        };

        // Prepare IDs of pending receivables to be deleted
        const pendingReceivableIds = [...new Set(selectedItems.map(item => item.originalReceivableId))];

        // Prepare items to be added to main inventory
        const itemsToStockIn = selectedItems.map(item => {
            const { id, originalReceivableId, productName, locationName, ...restOfItem } = item;
            return {
                ...restOfItem,
                cost: item.cost || 0,
                receivedBy: item.createdBy,
                authorizedBy: { uid: userId, name: currentUser.displayName || 'N/A' },
            };
        });

        try {
            // Queue the actions
            await addToQueue('EXECUTE_STOCK_IN', itemsToStockIn, currentUser);
            await addToQueue('FINALIZE_PURCHASE_INVOICE', {
                invoiceId: invoice.id,
                updatedInvoiceData,
                pendingReceivableIds,
            }, currentUser);

            alert(`Invoice update has been queued! Status will be: ${newStatus}`);
            navigate('/purchase');

        } catch (error) {
            console.error("Failed to queue finalization tasks:", error);
            alert(`An error occurred while queueing the tasks: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    if (isLoading || !invoice) {
        return <LoadingSpinner>Loading invoice and stock details...</LoadingSpinner>;
    }

    const totalSelectedCount = Object.keys(selectedStock).length;

    return (
        <div className="page-container bg-gray-50">
             <header className="page-header">
                 <div>
                    <Link to="/purchase" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1"><ArrowLeft size={16} className="mr-1" /> Back to Purchases</Link>
                    <h1 className="page-title">Attach Stock to Invoice</h1>
                </div>
                <div className="page-actions">
                    <Link to={`/purchase/edit/${invoiceId}`} className="btn btn-secondary mr-2"><Edit size={16} className="mr-2"/> Edit Invoice</Link>
                    <button onClick={handleAttachItems} className="btn btn-primary" disabled={!userId || invoice.status === 'FINALIZED' || totalSelectedCount === 0}>
                        <Link2 size={18} className="mr-2" /> Attach {totalSelectedCount} Line(s)
                    </button>
                </div>
            </header>
            <div className="page-content md:grid md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2">
                    <div className="card sticky top-20 shadow-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold text-gray-800 truncate" title={invoice.invoiceNumber}>{invoice.invoiceNumber}</h2>
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusStyles[invoice.status] || 'bg-gray-100'}`}>{invoice.status}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4"><strong>Supplier:</strong> {invoice.supplierName || 'N/A'}</p>
                        <div className="divider my-1">Invoice Fulfillment</div>
                        <ul className="space-y-3 my-4">
                            {invoice.items.map(item => {
                                const productInfo = products.find(p => p.sku === item.productId);
                                if (!productInfo) return null;
                                const summary = fulfillmentSummary[item.productId] || { needed: item.quantity, selected: 0 };
                                const received = (item.receivedQty || 0);
                                const finalQty = received + summary.selected;
                                return(
                                <li key={item.productId}>
                                    <p className="font-semibold text-gray-700 truncate">{getProductDisplayName(productInfo)}</p>
                                    <div className="flex items-center justify-between text-sm">
                                        <p className="text-gray-500">Needed: {summary.needed - summary.selected < 0 ? 0 : summary.needed - summary.selected}</p>
                                        <p className="font-bold text-gray-800">{finalQty} / {item.quantity}</p>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 mt-1 relative overflow-hidden">
                                        <div className="bg-green-500 h-3" style={{ width: `${(received / item.quantity) * 100}%` }}></div>
                                        <div className="bg-blue-300 h-3 absolute top-0" style={{ left: `${(received / item.quantity) * 100}%`, width: `${(summary.selected / item.quantity) * 100}%`}}></div>
                                    </div>
                                </li>
                            )})}
                        </ul>
                    </div>
                </div>
                <div className="lg:col-span-3 mt-6 md:mt-0">
                    <div className="card p-4">
                        <h2 className="card-title mb-4">Select Pending Stock to Attach</h2>
                        {Object.keys(relevantBatches).length === 0 ? (
                            <div className="text-center text-gray-500 py-8"><AlertTriangle size={20} className="mx-auto text-yellow-500 mb-2" /> No matching pending stock found for this invoice.</div>
                        ) : (
                            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                                {Object.entries(relevantBatches).map(([batchId, batch]) => {
                                    const isBatchOpen = openBatches.has(batchId);
                                    const selectableInBatch = batch.items.filter(i => !isItemDisabled(i) || selectedStock[i.id]);
                                    const selectedInBatchCount = batch.items.filter(i => selectedStock[i.id]).length;
                                    const isAllSelected = selectableInBatch.length > 0 && selectedInBatchCount === selectableInBatch.length;
                                    
                                    return (
                                    <div key={batchId} className="border rounded-lg bg-white shadow-sm">
                                        <header onClick={() => setOpenBatches(prev => { const newSet = new Set(prev); if(newSet.has(batchId)) newSet.delete(batchId); else newSet.add(batchId); return newSet; })} className="p-3 flex justify-between items-center cursor-pointer border-b bg-gray-50 hover:bg-gray-100 rounded-t-lg">
                                            <div className="flex items-center flex-grow min-w-0">
                                                 <div onClick={e => {e.stopPropagation(); handleBatchSelectionChange(batch);}} className="mr-4 p-1">
                                                    {isAllSelected ? <CheckSquare className="text-blue-600"/> : (selectedInBatchCount > 0 ? <div className="w-4 h-4 border-2 border-blue-500 bg-blue-200 rounded-sm"/> : <Square className="text-gray-400"/>)}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-gray-800 truncate">{batchId}</span>
                                                    <span className="text-xs text-gray-500 truncate">Received by {batch.receivedBy} on {batch.receivedAt}</span>
                                                </div>
                                            </div>
                                            <ChevronDown size={20} className={`transition-transform transform ${isBatchOpen ? 'rotate-180' : ''}`} />
                                        </header>
                                        {isBatchOpen && (
                                            <ul className="divide-y divide-gray-100 p-1">
                                                {batch.items.map(item => {
                                                    const isDisabled = isItemDisabled(item);
                                                    const isSelected = !!selectedStock[item.id];
                                                    return (
                                                        <li key={item.id} onClick={() => handleSelectionChange(item)} className={`flex items-center p-2 rounded-md transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-50'} ${isSelected ? 'bg-green-50 font-semibold' : ''}`}>
                                                            <div className="mr-3 p-1">
                                                                {isSelected ? <CheckSquare className="text-green-600"/> : <Square className="text-gray-400"/>}
                                                            </div>
                                                            <Package size={20} className="mr-4 text-gray-500 flex-shrink-0"/>
                                                            <div className="flex-grow min-w-0">
                                                                <p className="font-semibold text-sm truncate">{item.productName}</p>
                                                                {item.isSerialized ? (
                                                                    <p className="text-xs text-gray-500 font-mono truncate">Serial: {item.serial}</p>
                                                                ) : (
                                                                    <p className="text-xs text-gray-600 truncate">Qty: {item.quantity}</p>
                                                                )}
                                                            </div>
                                                            {isDisabled && !isSelected && <span className="badge badge-sm badge-warning ml-2 flex-shrink-0">Not Needed</span>}
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
