
// src/pages/PurchaseSubPages/PurchaseFinalizationPage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePurchaseInvoices } from '../../contexts/PurchaseInvoiceContext';
import { usePendingReceivables } from '../../contexts/PendingReceivablesContext';
import { useInventory } from '../../contexts/InventoryContext';
import { useLoading } from '../../contexts/LoadingContext';
import { Plus, Trash2, Save, AlertTriangle, CheckCircle } from 'lucide-react';

const PurchaseFinalizationPage = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const { setAppProcessing } = useLoading();

    const { invoices, updateInvoice } = usePurchaseInvoices();
    const { pendingReceivables, consumeItemsFromPendingReceivables } = usePendingReceivables();
    const { addBatchToInventory } = useInventory();

    const [originalInvoice, setOriginalInvoice] = useState(null);
    const [editableInvoice, setEditableInvoice] = useState(null);
    const [reconciliationMap, setReconciliationMap] = useState({}); // { productId: [receivedItem, ...] }
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const invoiceData = invoices.find(i => i.id === invoiceId);
        if (invoiceData) {
            if (invoiceData.status !== 'pending') {
                alert('This invoice has already been processed.');
                navigate('/purchase');
            } else {
                setOriginalInvoice(invoiceData);
                setEditableInvoice(JSON.parse(JSON.stringify(invoiceData))); // Deep copy for editing
            }
        } else if (!isLoading && invoices.length > 0) {
            alert("Invoice not found.");
            navigate('/purchase');
        }
        setIsLoading(invoices.length === 0);
    }, [invoiceId, invoices, navigate, isLoading]);

    const availableReceivedItems = useMemo(() => {
        return pendingReceivables.flatMap(batch => batch.items.filter(item => !item.isConsumed));
    }, [pendingReceivables]);

    const handleInvoiceItemChange = (productId, field, value) => {
        const newItems = editableInvoice.items.map(item => {
            if (item.productId === productId) {
                return { ...item, [field]: Number(value) };
            }
            return item;
        });
        setEditableInvoice({ ...editableInvoice, items: newItems });
    };

    const addReconciledItem = (receivedItem, targetProductId) => {
        setReconciliationMap(prevMap => {
            const newMap = { ...prevMap };
            if (!newMap[targetProductId]) {
                newMap[targetProductId] = [];
            }
            newMap[targetProductId].push(receivedItem);
            return newMap;
        });
    };
    
    const removeReconciledItem = (itemToRemove) => {
        setReconciliationMap(prevMap => {
            const newMap = { ...prevMap };
            for (const productId in newMap) {
                newMap[productId] = newMap[productId].filter(item => item.key !== itemToRemove.key);
            }
            return newMap;
        });
    };

    const handleSaveInvoiceChanges = async () => {
        setAppProcessing(true, 'Saving invoice changes...');
        try {
            await updateInvoice(editableInvoice.id, { items: editableInvoice.items });
            setOriginalInvoice(editableInvoice);
            alert('Invoice changes saved!');
        } catch (error) {
            alert(`Error saving invoice: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    const handleFinalize = async () => {
        if (!window.confirm("Are you sure you want to finalize this purchase?")) return;

        setAppProcessing(true, 'Finalizing purchase...');
        try {
            const reconciledItems = Object.values(reconciliationMap).flat();
            
            // 1. Update Inventory
            await addBatchToInventory(reconciledItems, originalInvoice.id, originalInvoice.supplierId);
            
            // 2. Consume the items from pending receivables
            consumeItemsFromPendingReceivables(reconciledItems);
            
            // 3. Update invoice status to 'finalized'
            await updateInvoice(originalInvoice.id, { status: 'finalized' });

            alert('Purchase finalized successfully! Inventory updated.');
            navigate('/purchase');

        } catch (error) {
            console.error("Finalization error:", error);
            alert(`Error finalizing purchase: ${error.message}`);
            setAppProcessing(false);
        }
    };

    const reconciliationStatus = useMemo(() => {
        if (!editableInvoice) return { canFinalize: false, issues: [] };
        
        let canFinalize = true;
        const issues = [];

        editableInvoice.items.forEach(item => {
            const reconciledQty = (reconciliationMap[item.productId] || []).reduce((sum, ri) => sum + ri.quantity, 0);
            if (reconciledQty !== item.quantity) {
                canFinalize = false;
                issues.push(`${item.productName}: Expected ${item.quantity}, but reconciled ${reconciledQty}.`);
            }
        });
        
        if (Object.values(reconciliationMap).flat().length === 0) {
            canFinalize = false;
        }

        return { canFinalize, issues };
    }, [editableInvoice, reconciliationMap]);

    if (isLoading || !editableInvoice) {
        return <div className="page-container"><p>Loading Workbench...</p></div>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                 <h1 className="page-title">Reconciliation Workbench</h1>
                 <div className="flex items-center gap-4">
                    <button onClick={handleSaveInvoiceChanges} className="btn btn-outline-primary"><Save size={16} className="mr-2"/>Save Invoice Changes</button>
                    <button onClick={handleFinalize} disabled={!reconciliationStatus.canFinalize} className="btn btn-success"><CheckCircle size={16} className="mr-2"/>Finalize Purchase</button>
                 </div>
            </header>

            {!reconciliationStatus.canFinalize && (
                <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 mb-6">
                    <h4 className="font-bold">Cannot Finalize Yet</h4>
                    <ul className="list-disc list-inside text-sm">
                        {reconciliationStatus.issues.length > 0 
                            ? reconciliationStatus.issues.map((issue, i) => <li key={i}>{issue}</li>) 
                            : <li>No items have been reconciled against the invoice.</li>}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Invoice Items */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Invoice: #{originalInvoice.invoiceNumber}</h3></div>
                    <div className="card-body space-y-4">
                        {editableInvoice.items.map(item => {
                            const reconciledItems = reconciliationMap[item.productId] || [];
                            const reconciledQty = reconciledItems.reduce((sum, ri) => sum + ri.quantity, 0);
                            const isMatched = reconciledQty === item.quantity;

                            return (
                                <div key={item.productId} className={`p-4 rounded-lg ${isMatched ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold">{item.productName}</h4>
                                        <div className={`font-bold text-lg ${isMatched ? 'text-green-600' : 'text-red-600'}`}>
                                            {reconciledQty} / {item.quantity}
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600">SKU: {item.productSku}</div>
                                    <div className="flex items-center gap-4 mt-2">
                                        <label className="text-sm">Expected Qty:</label>
                                        <input 
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => handleInvoiceItemChange(item.productId, 'quantity', e.target.value)}
                                            className="input-base w-24"
                                        />
                                    </div>
                                    <div className="mt-2 text-sm">
                                        <h5 className="font-semibold">Reconciled Items:</h5>
                                        {reconciledItems.length === 0 ? <p className="text-gray-500">None</p> : (
                                            <ul className="list-disc list-inside pl-4">
                                                {reconciledItems.map(ri => (
                                                    <li key={ri.key}>{ri.quantity}x {ri.isSerialized ? `(SN: ${ri.serialNumber})` : ''} <button onClick={() => removeReconciledItem(ri)} className="text-red-500 hover:underline ml-2">(remove)</button></li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Available Received Items */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Available Received Stock</h3></div>
                    <div className="card-body">
                        <div className="overflow-y-auto max-h-[600px]">
                            <table className="table-auto w-full text-sm">
                                <thead className="sticky top-0 bg-gray-100">
                                    <tr>
                                        <th className="px-2 py-2 text-left">Product</th>
                                        <th className="px-2 py-2">Info</th>
                                        <th className="px-2 py-2">Qty</th>
                                        <th className="px-2 py-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {availableReceivedItems
                                    .filter(availItem => !Object.values(reconciliationMap).flat().some(recItem => recItem.key === availItem.key))
                                    .map(item => (
                                        <tr key={item.key} className="border-b">
                                            <td className="px-2 py-2">{item.productName}</td>
                                            <td className="px-2 py-2 text-gray-500">{item.isSerialized ? `SN: ${item.serialNumber}` : 'Non-Serialized'}</td>
                                            <td className="px-2 py-2 text-center">{item.quantity}</td>
                                            <td className="px-2 py-2 text-center">
                                                <button onClick={() => {
                                                    const targetProductId = prompt(`Which product on the invoice does this belong to?\n${editableInvoice.items.map((i, idx) => `${idx + 1}. ${i.productName}`).join('\n')}`);
                                                    if (targetProductId && editableInvoice.items[Number(targetProductId) - 1]) {
                                                        addReconciledItem(item, editableInvoice.items[Number(targetProductId) - 1].productId)
                                                    }
                                                }} className="btn btn-sm btn-outline-primary">
                                                   <Plus size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PurchaseFinalizationPage;
