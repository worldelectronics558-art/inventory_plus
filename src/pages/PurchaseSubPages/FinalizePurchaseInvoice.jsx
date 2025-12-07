
// src/pages/PurchaseSubPages/FinalizePurchaseInvoice.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

import { usePurchaseInvoices } from '../../contexts/PurchaseInvoiceContext';
import { usePendingReceivables } from '../../contexts/PendingReceivablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useLoading } from '../../contexts/LoadingContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft, Edit, Link2, AlertTriangle, Package, ChevronDown, ClipboardList, CheckSquare, Square } from 'lucide-react';

const statusStyles = {
    Pending: 'bg-red-100 text-red-700',
    'Partially Received': 'bg-blue-100 text-blue-700',
    Finalized: 'bg-green-100 text-green-700',
};

const FinalizePurchaseInvoice = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();

    const { invoices, addStockItems } = usePurchaseInvoices();
    const { pendingReceivables, removeReceivables } = usePendingReceivables();
    const { products } = useProducts();
    const { locations } = useLocations();
    const { setAppProcessing } = useLoading();

    const [invoice, setInvoice] = useState(null);
    const [selectedStock, setSelectedStock] = useState({});
    const [openBatches, setOpenBatches] = useState(new Set());

    const productSkuToIdMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.sku]: p.id }), {}), [products]);
    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: getProductDisplayName(p) }), {}), [products]);
    const locationMap = useMemo(() => locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.name }), {}), [locations]);

    // --- ROBUST INVOICE INITIALIZATION ---
    useEffect(() => {
        const inv = invoices.find(i => i.id === invoiceId);
        if (inv) {
            // Ensure inv.items is an array, preventing crashes from malformed data.
            const initializedItems = (inv.items || []).map(item => ({ ...item, id: item.id || item.productId, receivedQty: item.receivedQty || 0 }));
            setInvoice({ ...inv, items: initializedItems });
        }
    }, [invoiceId, invoices]);

    // --- ROBUST STOCK CALCULATION with STRONGER GUARDS ---
    const flattenedAndGroupedStock = useMemo(() => {
        // CRASH FIX: Add explicit guards for invoice and invoice.items to prevent render errors.
        if (!invoice || !invoice.items || !products.length) {
            return [];
        }

        const invoiceProductIds = new Set(invoice.items.map(item => productSkuToIdMap[item.productId]).filter(Boolean));

        const flattenedStock = pendingReceivables.flatMap(batch => {
            if (!invoiceProductIds.has(batch.productId)) return [];

            const commonData = {
                ...batch,
                originalId: batch.id,
                productName: productMap[batch.productId] || 'N/A',
                locationName: locationMap[batch.locationId] || 'N/A',
            };

            if (batch.isSerialized) {
                return batch.serials.map(serial => ({
                    ...commonData,
                    id: `${batch.id}-${serial}`,
                    serialNumber: serial,
                    quantity: 1,
                }));
            } else {
                return Array.from({ length: batch.quantity }, (_, i) => ({
                    ...commonData,
                    id: `${batch.id}-unit-${i}`,
                    serialNumber: null,
                    quantity: 1,
                }));
            }
        });

        const groups = flattenedStock.reduce((acc, item) => {
            const batchId = item.batchId;
            if (!acc[batchId]) {
                acc[batchId] = { items: [], receivedBy: item.createdBy?.name || 'N/A', receivedAt: item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'N/A' };
            }
            acc[batchId].items.push(item);
            return acc;
        }, {});
        
        const batchKeys = Object.keys(groups);
        if(batchKeys.length > 0) setOpenBatches(new Set([batchKeys[0]]));

        return Object.entries(groups).map(([batchId, data]) => ({ batchId, ...data }));
    }, [invoice, pendingReceivables, products, productSkuToIdMap, productMap, locationMap]);
    
    const selectionSummary = useMemo(() => {
        const summary = {};
        for(const item of Object.values(selectedStock)) {
            summary[item.productId] = (summary[item.productId] || 0) + 1;
        }
        return summary;
    }, [selectedStock]);

    const toggleBatch = batchId => setOpenBatches(prev => {
        const newSet = new Set(prev);
        if (newSet.has(batchId)) newSet.delete(batchId); else newSet.add(batchId);
        return newSet;
    });
    
    const handleSelectionChange = (item, isDisabled) => {
        if (isDisabled) return;
        setSelectedStock(prev => {
            const newSelection = { ...prev };
            if (newSelection[item.id]) delete newSelection[item.id]; else newSelection[item.id] = item;
            return newSelection;
        });
    };
    
    const handleBatchSelectionChange = (batchItems) => {
        if (!invoice) return; // Guard against no invoice
        setSelectedStock(prev => {
            const newSelection = { ...prev };
            const areAllSelected = batchItems.every(item => !!newSelection[item.id]);
            
            batchItems.forEach(item => {
                const invoiceItem = invoice.items.find(invItem => productSkuToIdMap[invItem.productId] === item.productId);
                if (!invoiceItem) return;

                const neededQty = invoiceItem.quantity - invoiceItem.receivedQty;
                const alreadySelectedForProduct = (selectionSummary[item.productId] || 0) - (newSelection[item.id] ? 1 : 0);

                if (areAllSelected) {
                    delete newSelection[item.id];
                } else if (alreadySelectedForProduct < neededQty) {
                    newSelection[item.id] = item;
                }
            });
            return newSelection;
        });
    };

    const handleAttachItems = async () => {
        const selectedItems = Object.values(selectedStock);
        if (selectedItems.length === 0) return alert('No items selected.');

        setAppProcessing(true, 'Attaching items...');

        const updatedInvoiceItems = JSON.parse(JSON.stringify(invoice.items));
        const itemsToAddToStock = [];
        const consumedOriginalReceivables = new Set();

        for (const receivedItem of selectedItems) {
            consumedOriginalReceivables.add(receivedItem.originalId);
            itemsToAddToStock.push({ ...receivedItem, invoiceId: invoice.id });
            const invoiceItemIndex = updatedInvoiceItems.findIndex(item => productSkuToIdMap[item.productId] === receivedItem.productId);
            if (invoiceItemIndex !== -1) {
                 updatedInvoiceItems[invoiceItemIndex].receivedQty += 1;
            }
        }

        const isFullyReceived = updatedInvoiceItems.every(item => item.receivedQty >= item.quantity);
        const newStatus = isFullyReceived ? 'Finalized' : 'Partially Received';

        try {
            await addStockItems(itemsToAddToStock, invoice.id, { items: updatedInvoiceItems, status: newStatus });
            await removeReceivables(Array.from(consumedOriginalReceivables));
            alert(`Invoice updated to ${newStatus}`);
            navigate('/purchase');
        } catch (error) {
            console.error("Failed to attach items:", error);
            alert(`An error occurred: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    if (!invoice) return <div className="page-container text-center"><p>Loading Invoice...</p></div>;

    return (
        <div className="page-container bg-gray-50">
            <header className="page-header">
                <div>
                    <Link to="/purchase" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1">
                        <ArrowLeft size={16} className="mr-1" /> Back to Purchases
                    </Link>
                    <h1 className="page-title">Attach Stock to Invoice</h1>
                </div>
                <div className="page-actions">
                    <Link to={`/purchase/edit/${invoiceId}`} className="btn btn-secondary mr-2">
                        <Edit size={16} className="mr-2"/> Edit Invoice
                    </Link>
                    <button onClick={handleAttachItems} className="btn btn-primary" disabled={invoice.status === 'Finalized' || Object.keys(selectedStock).length === 0}>
                        <Link2 size={18} className="mr-2" /> Attach {Object.keys(selectedStock).length} Units
                    </button>
                </div>
            </header>

            <div className="page-content md:grid md:grid-cols-2 lg:grid-cols-5 gap-6">
                {/* --- Left Panel --- */}
                <div className="lg:col-span-2">
                    <div className="card sticky top-20 shadow-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold text-gray-800 truncate" title={invoice.invoiceNumber}>{invoice.invoiceNumber}</h2>
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusStyles[invoice.status] || 'bg-gray-100 text-gray-800'}`}>{invoice.status}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4"><strong>Supplier:</strong> {invoice.supplierName}</p>

                        <div className="divider my-1">Invoice Fulfillment</div>
                        <ul className="space-y-3 my-4">
                            {invoice.items.map(item => {
                                const needed = item.quantity - item.receivedQty;
                                const selectedForThis = selectionSummary[productSkuToIdMap[item.productId]] || 0;
                                return(
                                <li key={item.id}>
                                    <p className="font-semibold text-gray-700 truncate">{getProductDisplayName(item)}</p>
                                    <div className="flex items-center justify-between text-sm">
                                        <p className="text-gray-500">Needed: {needed < 0 ? 0 : needed}</p>
                                        <p className="font-bold text-gray-800">{item.receivedQty} / {item.quantity}</p>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 mt-1 relative">
                                        <div className="bg-green-500 h-3 rounded-full" style={{ width: `${(item.receivedQty / item.quantity) * 100}%` }}></div>
                                        <div className="bg-blue-300 h-3 rounded-full absolute top-0" style={{ left: `${(item.receivedQty / item.quantity) * 100}%`, width: `${(selectedForThis / item.quantity) * 100}%`}}></div>
                                    </div>
                                </li>
                            )})
                            }
                        </ul>
                    </div>
                </div>

                {/* --- Right Panel --- */}
                <div className="lg:col-span-3 mt-6 md:mt-0">
                    <div className="card p-4">
                        <h2 className="card-title mb-4">Select Pending Stock to Attach</h2>
                        {flattenedAndGroupedStock.length === 0 ? (
                            <div className="text-center text-gray-500 py-8 flex items-center justify-center"><AlertTriangle size={20} className="mr-2 text-yellow-500" /> No matching pending stock found.</div>
                        ) : (
                            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                                {flattenedAndGroupedStock.map(batch => {
                                    const selectedInBatch = batch.items.filter(item => selectedStock[item.id]);
                                    const isAnythingSelectable = batch.items.some(item => {
                                        const invoiceItem = invoice.items.find(invItem => productSkuToIdMap[invItem.productId] === item.productId);
                                        if (!invoiceItem) return false;
                                        const neededQty = invoiceItem.quantity - invoiceItem.receivedQty;
                                        return neededQty > 0;
                                    });
                                    const batchCheckboxState = selectedInBatch.length === 0 ? 'none' : selectedInBatch.length >= batch.items.length ? 'all' : 'partial';
                                    return (
                                    <div key={batch.batchId} className="border rounded-lg bg-white shadow-sm transition-all duration-200 ease-in-out">
                                        <header onClick={() => toggleBatch(batch.batchId)} className={`p-3 flex justify-between items-center cursor-pointer border-b bg-gray-50 rounded-t-lg ${!isAnythingSelectable ? 'opacity-60' : ''}`}>
                                            <div className="flex items-center flex-grow min-w-0">
                                                <div onClick={e => {e.stopPropagation(); handleBatchSelectionChange(batch.items);}} className={`mr-3 p-1 rounded ${isAnythingSelectable ? 'hover:bg-gray-200' : 'cursor-not-allowed'}`}>
                                                    {batchCheckboxState === 'all' ? <CheckSquare className="text-blue-600"/> : batchCheckboxState === 'partial' ? <div className="w-4 h-4 bg-blue-600 border border-blue-700 rounded-sm" style={{transform: 'scale(0.8)', margin: '2px'}}/> : <Square className="text-gray-400"/>}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-gray-800 truncate">{batch.batchId}</span>
                                                    <span className="text-xs text-gray-500 truncate">by {batch.receivedBy}</span>
                                                </div>
                                            </div>
                                            <ChevronDown size={20} className={`transition-transform transform ${openBatches.has(batch.batchId) ? 'rotate-180' : ''}`} />
                                        </header>
                                        {openBatches.has(batch.batchId) && (
                                            <ul className="p-2 space-y-1 bg-white rounded-b-lg">
                                                {batch.items.map(item => {
                                                    const invoiceItem = invoice.items.find(invItem => productSkuToIdMap[invItem.productId] === item.productId);
                                                    const neededQty = (invoiceItem?.quantity || 0) - (invoiceItem?.receivedQty || 0);
                                                    const alreadySelectedForProduct = selectionSummary[item.productId] || 0;
                                                    const isSelected = !!selectedStock[item.id];
                                                    const isDisabled = !isSelected && alreadySelectedForProduct >= neededQty;

                                                    return (
                                                        <li key={item.id} onClick={() => handleSelectionChange(item, isDisabled)} className={`flex items-center p-2 rounded-md transition-colors ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-50'} ${isSelected ? 'bg-green-100 font-semibold' : ''}`}>
                                                            <Package size={16} className="mr-3 text-gray-500 flex-shrink-0"/>
                                                            <div className="flex-grow min-w-0">
                                                                <p className="font-semibold text-sm truncate">{item.productName}</p>
                                                                <p className="text-xs text-gray-600 truncate">{item.serialNumber ? `Serial: ${item.serialNumber}` : `Unit from ${item.locationName}`}</p>
                                                            </div>
                                                            {isDisabled && !isSelected && <span className="badge badge-sm badge-outline ml-2 flex-shrink-0">Fulfilled</span>}
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
