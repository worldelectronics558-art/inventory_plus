import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { Trash2, User, Calendar, Hash, Plus, PackageCheck, X } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

const DeliverableBatchCard = ({ batch, onDeleteBatch, onDeleteItem }) => {
    const { batchId, items, createdBy, createdAt, customerName, salesOrderNumber } = batch;

    return (
        <div className="card overflow-hidden shadow-lg border-transparent hover:shadow-xl transition-shadow duration-300">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border-b border-slate-200 gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 bg-emerald-100 text-emerald-600 rounded-lg p-2">
                        <Hash size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-emerald-800">{batchId}</h2>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                            <span className="flex items-center gap-1.5"><User size={12} /> {createdBy?.name}</span>
                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {createdAt}</span>
                        </div>
                    </div>
                </div>
                <div className="card-actions self-end sm:self-center">
                    <button 
                        onClick={() => onDeleteBatch(batchId)} 
                        className="btn btn-sm btn-outline btn-error" 
                        title="Delete Entire Batch"
                    >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline ml-2">Delete Batch</span>
                    </button>
                </div>
            </header>

            <ul className="p-4 space-y-3 bg-white">
                {items.map((item, index) => (
                    <li key={item.id || index} className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 flex items-start justify-between gap-4">
                        <div className="flex-grow">
                            <p className="font-semibold text-slate-800">{item.productName}</p>
                            <p className="text-sm text-slate-500 font-mono">SKU: {item.sku}</p>
                            <p className="font-bold text-slate-800 mt-2">Location: {item.locationName}</p>
                            <p className="font-bold text-slate-800 mt-2">Quantity: {item.quantity}</p>
                            
                            {item.isSerialized && item.serials && item.serials.length > 0 && (
                                <div className="mt-2 bg-white/50 p-2 rounded border border-slate-100">
                                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">Selected Serials:</p>
                                    <p className="text-xs text-slate-500 mt-1 break-all leading-relaxed">
                                        {item.serials.join(', ')}
                                    </p>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => onDeleteItem(item.id || index, batchId, items.length)} 
                            className="btn btn-icon text-slate-400 hover:text-red-600 hover:bg-red-50" 
                            title="Remove Item"
                        >
                            <X size={18} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const EmptyState = () => (
    <div className="text-center bg-white py-16 px-6 rounded-lg shadow-md border border-slate-200/80">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
            <PackageCheck size={40} className="text-blue-600" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-slate-800">No Pending Deliveries</h3>
        <p className="mt-2 text-base text-slate-500">All delivery batches have been processed or none have been created.</p>
    </div>
);

const PendingDeliverablesPage = () => {
    const navigate = useNavigate();
    const { pendingDeliverables, isLoading: deliverablesLoading, deleteDeliverableBatch, error } = usePendingDeliverables();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations();
    
    const isLoading = deliverablesLoading || productsLoading || locationsLoading;
    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
    const locationMap = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations]);

    const groupedAndSortedBatches = useMemo(() => {
        if (isLoading || !pendingDeliverables.length) return [];
        
        return pendingDeliverables
            .map(batch => ({
                ...batch,
                items: (batch.items || []).map(item => {
                    const product = productMap.get(item.productId);
                    const locationName = locationMap.get(item.locationId) || 'Unknown Location';
                    return {
                        ...item,
                        productName: product ? getProductDisplayName(product) : (item.productName || `SKU: ${item.sku}`),
                        locationName: locationName,
                    };
                }),
                displayDate: batch.createdAt?.seconds 
                    ? new Date(batch.createdAt.seconds * 1000).toLocaleDateString() 
                    : 'Pending...',
            }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [pendingDeliverables, isLoading, productMap, locationMap]);

    const handleDeleteBatch = useCallback(async (batchId) => {
        if (window.confirm(`Are you sure you want to delete delivery batch "${batchId}"? This will return units to stock selection.`)) {
            try {
                await deleteDeliverableBatch(batchId);
            } catch (err) {
                alert("Failed to delete batch: " + err.message);
            }
        }
    }, [deleteDeliverableBatch]);

    const handleDeleteItem = useCallback(async (itemId, batchId, batchSize) => {
        alert("Individual item deletion is not yet supported. Please delete the entire batch to make corrections.");
    }, []);

    if (isLoading) return <LoadingSpinner>Loading pending deliveries...</LoadingSpinner>;

    return (
        <div className="page-container">
            {error && (
                <div className="alert alert-error mb-4 shadow-sm">
                    <span>Error: {error.message}</span>
                </div>
            )}

            <header className="page-header">
                <div>
                    <h1 className="page-title">Pending Stock Deliveries</h1>
                </div>
                <div className="page-actions">
                    <button 
                        onClick={() => navigate('/sales/stock-delivery')} 
                        className="btn btn-secondary"
                    >
                        <Plus size={20} className="mr-2"/>
                        Create Delivery
                    </button>
                </div>
            </header>
            
            <main className="page-content">
                {groupedAndSortedBatches.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="max-w-5xl mx-auto space-y-6">
                        {groupedAndSortedBatches.map((batch) => (
                            <DeliverableBatchCard 
                                key={batch.id} 
                                batch={{...batch, createdAt: batch.displayDate}} 
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
