
// src/pages/SalesSubPages/PendingDeliverablesPage.jsx

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft, Plus, PackageCheck, User, Calendar, Hash, Check, X } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const DeliverableBatchCard = ({ batch, onFinalize }) => {
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
                    <div className="flex-shrink-0 bg-cyan-100 text-cyan-600 rounded-lg p-2"><Hash size={20} /></div>
                    <div>
                        <h2 className="font-bold text-lg text-cyan-800">{batchId}</h2>
                        <div className="text-xs text-slate-500 flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1.5"><User size={12} /> {createdBy?.name || 'N/A'}</span>
                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {createdAt?.toDate ? createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                <div className="card-actions">
                     <button onClick={() => onFinalize(batchId)} className="btn btn-sm btn-success btn-outline font-bold">
                        <Check size={16} /> Finalize & Deliver
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
    const { pendingDeliverables, isLoading, finalizeDeliverable } = usePendingDeliverables();
    const { products, isLoading: productsLoading } = useProducts();
    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const handleFinalizeBatch = async (batchId) => {
        if (!window.confirm(`Are you sure you want to finalize and deliver batch ${batchId}? This will move the stock out of inventory.`)) return;
        try {
            await finalizeDeliverable(batchId);
            alert(`Batch ${batchId} has been successfully delivered.`);
        } catch (error) {
            console.error("Error finalizing deliverable:", error);
            alert(`Failed to finalize batch: ${error.message}`);
        }
    };

    const groupedBatches = useMemo(() => {
        if (isLoading || productsLoading) return [];
        const grouped = pendingDeliverables.reduce((acc, item) => {
            const batchId = item.batchId;
            if (!acc[batchId]) {
                acc[batchId] = { ...item, items: [] };
            }
            const product = productMap.get(item.productId);
            acc[batchId].items.push({
                ...item,
                productName: product ? getProductDisplayName(product) : (item.productName || `SKU: ${item.sku}`),
            });
            return acc;
        }, {});
        return Object.values(grouped).sort((a, b) => b.batchId.localeCompare(a.batchId));
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
                    <Link to="/sales/create-delivery" className="btn btn-primary"><Plus size={20}/> Create Direct Delivery</Link>
                </div>
            </header>
            <main className="page-content">
                {groupedBatches.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="max-w-5xl mx-auto space-y-6">
                        {groupedBatches.map((batch) => (
                            <DeliverableBatchCard key={batch.batchId} batch={batch} onFinalize={handleFinalizeBatch} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default PendingDeliverablesPage;
