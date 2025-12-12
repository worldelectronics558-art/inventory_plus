
import React, { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft, Trash2, User, Calendar, Hash, Plus, X, Truck } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const DeliverableBatchCard = ({ batch, onDeleteBatch, onDeleteItem }) => {
    const { batchId, items, createdBy, createdAt } = batch;

    return (
        <div className="card overflow-hidden shadow-lg border-transparent hover:shadow-xl transition-shadow duration-300">
            <header className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 bg-teal-100 text-teal-600 rounded-lg p-2">
                        <Hash size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-teal-800">{batchId}</h2>
                        <div className="text-xs text-slate-500 flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1.5"><User size={12} /> {createdBy}</span>
                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {createdAt}</span>
                        </div>
                    </div>
                </div>
                <div className="card-actions">
                    <button onClick={() => onDeleteBatch(batchId)} className="btn btn-sm btn-outline-danger" title="Delete Entire Batch">
                        <Trash2 size={16} />
                        <span className="hidden sm:inline ml-2">Delete Batch</span>
                    </button>
                </div>
            </header>

            <ul className="p-4 space-y-3 bg-white">
                {items.map(item => (
                    <li key={item.id} className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 flex items-start justify-between gap-4">
                        <div>
                            <p className="font-semibold text-slate-800">{item.productName}</p>
                            <p className="text-sm text-slate-500">SKU: {item.sku}</p>
                            <p className="font-bold text-slate-800 mt-2">Quantity: {item.quantity}</p>
                            {item.isSerialized && item.serials?.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs font-medium text-slate-600">Serials:</p>
                                    <p className="text-xs text-slate-500 mt-1 break-all">{item.serials.join(', ')}</p>
                                </div>
                            )}
                        </div>
                        <button onClick={() => onDeleteItem(item.id, batchId, items.length)} className="btn btn-icon text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete Item">
                            <X size={18} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const EmptyState = () => (
    <div className="text-center bg-white py-16 px-6 rounded-lg shadow-md border border-slate-200/80">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <Truck size={40} className="text-green-600" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-slate-800">No Pending Units</h3>
        <p className="mt-2 text-base text-slate-500">All delivered stock has been finalized. Ready for the next shipment!</p>
    </div>
);

const PendingDeliverablesPage = () => {
    const { pendingDeliverables, isLoading: deliverablesLoading, deleteDeliverableBatch, removeDeliverables } = usePendingDeliverables();
    const { products, isLoading: productsLoading } = useProducts();

    const isLoading = deliverablesLoading || productsLoading;

    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const groupedAndSortedBatches = useMemo(() => {
        if (isLoading || !pendingDeliverables.length) return [];
        const grouped = pendingDeliverables.reduce((acc, item) => {
            const batchId = item.batchId;
            if (!acc[batchId]) {
                acc[batchId] = {
                    batchId,
                    items: [],
                    createdBy: item.createdBy?.name || 'N/A',
                    createdAt: item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'N/A',
                };
            }
            const product = productMap.get(item.productId);
            acc[batchId].items.push({
                ...item,
                productName: product ? getProductDisplayName(product) : (item.productName || `SKU: ${item.sku}`),
            });
            return acc;
        }, {});

        return Object.values(grouped).sort((a, b) => b.batchId.localeCompare(a.batchId));

    }, [pendingDeliverables, isLoading, productMap]);

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

    const handleDeleteItem = useCallback(async (itemId, batchId, batchSize) => {
        const isLastItem = batchSize === 1;
        const message = isLastItem
            ? `This is the last item in the batch. Deleting it will remove the entire batch "${batchId}". Are you sure?`
            : `Are you sure you want to delete this item?`;

        if (window.confirm(message)) {
            try {
                await removeDeliverables([itemId]);
            } catch (error) {
                console.error("Failed to delete item:", error);
                alert(`Failed to delete item: ${error.message}`);
            }
        }
    }, [removeDeliverables]);

    if (isLoading) {
        return <LoadingSpinner>Loading pending items...</LoadingSpinner>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/sales" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1">
                        <ArrowLeft size={16} className="mr-1" /> Back to Sales
                    </Link>
                    <h1 className="page-title">Pending Stock Deliveries</h1>
                </div>
                <div className="page-actions">
                    <Link to="/sales/stock-delivery" className="btn btn-primary">
                        <Plus size={20} />
                        Create New Delivery
                    </Link>
                </div>
            </header>
            <main className="page-content">
                {groupedAndSortedBatches.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="max-w-5xl mx-auto space-y-6">
                        {groupedAndSortedBatches.map((batch) => (
                            <DeliverableBatchCard
                                key={batch.batchId}
                                batch={batch}
                                onDeleteBatch={handleDeleteBatch}
                                onDeleteItem={handleDeleteItem}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default PendingDeliverablesPage;
