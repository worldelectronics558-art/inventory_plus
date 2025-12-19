
// src/pages/SalesSubPages/PendingDeliverablesPage.jsx

import React, { useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft, Plus, PackageCheck, User, Calendar, Hash, Trash2 } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const DeliverableBatchCard = ({ batch, onDeleteBatch }) => {
    const { batchId, items, createdBy, createdAt, customerName } = batch;

    const groupedItems = useMemo(() => {
        if (!items) return [];
        const grouped = items.reduce((acc, item) => {
            if (!acc[item.productId]) {
                acc[item.productId] = {
                    ...item,
                    serials: item.isSerialized ? [item.serial] : [],
                    count: 1,
                };
            } else {
                acc[item.productId].count++;
                if (item.isSerialized) {
                    acc[item.productId].serials.push(item.serial);
                }
                acc[item.productId].quantity += item.quantity; 
            }
            return acc;
        }, {});
        return Object.values(grouped);
    }, [items]);

    return (
        <div className="card overflow-hidden shadow-lg border-transparent hover:shadow-xl transition-shadow duration-300">
            <header className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="shrink-0 bg-cyan-100 text-cyan-600 rounded-lg p-2"><Hash size={20} /></div>
                    <div>
                        <h2 className="font-bold text-lg text-cyan-800">{batchId}</h2>
                        <div className="text-xs text-slate-500 flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1.5"><User size={12} /> {createdBy?.name || 'N/A'}</span>
                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {createdAt?.toDate ? createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                <div className="card-actions">
                    <button onClick={() => onDeleteBatch(batch.batchId)} className="btn btn-sm btn-outline-danger" title="Delete Entire Batch">
                        <Trash2 size={16} />
                        <span className="hidden sm:inline ml-2">Delete Batch</span>
                    </button>
                </div>
            </header>

            <div className="p-4 space-y-3 bg-white">
                <h3 className="text-sm font-semibold text-slate-600">Customer: {customerName}</h3>
                <ul className="p-2 space-y-3 bg-slate-50/70 rounded-lg">
                    {groupedItems.map(item => (
                        <li key={item.productId} className="bg-white p-3 rounded-lg border border-slate-200/80 flex items-start justify-between gap-4">
                            <div>
                                <p className="font-semibold text-slate-800">{item.productName}</p>
                                <p className="text-sm text-slate-500">SKU: {item.sku}</p>
                                <p className="font-bold text-slate-800 mt-2">Quantity: {item.isSerialized ? item.count : item.quantity}</p>
                                {item.isSerialized && item.serials?.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs font-medium text-slate-600">Serials:</p>
                                        <p className="text-xs text-slate-500 mt-1 break-all">{item.serials.join(', ')}</p>
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

const EmptyState = () => (
    <div className="text-center bg-white py-16 px-6 rounded-lg shadow-md border border-slate-200/80">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <PackageCheck size={40} className="text-green-600" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-slate-800">No Pending Deliveries</h3>
        <p className="mt-2 text-base text-slate-500">There are no sales orders or direct deliveries waiting to be finalized.</p>
    </div>
);

const PendingDeliverablesPage = () => {
    const { pendingDeliverables, isLoading, deleteDeliverableBatch } = usePendingDeliverables();
    const { products, isLoading: productsLoading } = useProducts();
    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const handleDeleteBatch = useCallback(async (batchId) => {
        if (window.confirm(`Are you sure you want to delete the entire batch "${batchId}"? This cannot be undone.`)) {
            try {
                await deleteDeliverableBatch(batchId);
            } catch (error) {
                console.error("Failed to delete batch:", error);
                alert(`Failed to delete batch: ${error.message}`);
            }
        }
    }, [deleteDeliverableBatch]);

    const groupedBatches = useMemo(() => {
        if (isLoading || productsLoading) return [];

        // Each pendingDeliverables entry is already a batch document (one per Firestore doc),
        // mirroring the structure of pending_receivables.
        return pendingDeliverables
            .map(batch => ({
                ...batch,
                items: (batch.items || []).map(item => {
                    const product = productMap.get(item.productId);
                    return {
                        ...item,
                        productName: product
                            ? getProductDisplayName(product)
                            : (item.productName || `SKU: ${item.sku}`),
                    };
                }),
            }))
            .sort((a, b) => b.batchId.localeCompare(a.batchId));
    }, [pendingDeliverables, isLoading, productsLoading, productMap]);

    if (isLoading || productsLoading) {
        return <LoadingSpinner>Loading pending deliveries...</LoadingSpinner>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/sales" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1"><ArrowLeft size={16} className="mr-1" /> Back to Sales</Link>
                    <h1 className="page-title">Pending Stock Deliveries</h1>
                </div>
                <div className="page-actions">
                    <Link to="/sales/stock-delivery" className="btn btn-secondary"><Plus size={20}/> Create Delivery</Link>
                </div>
                
            </header>
            <main className="page-content">
                {groupedBatches.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="max-w-5xl mx-auto space-y-6">
                        {groupedBatches.map((batch) => (
                            <DeliverableBatchCard
                                key={batch.batchId}
                                batch={batch}
                                onDeleteBatch={handleDeleteBatch}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default PendingDeliverablesPage;
