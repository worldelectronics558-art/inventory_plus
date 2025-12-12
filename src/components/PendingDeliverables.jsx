import React, { useState } from 'react';
import { usePendingDeliverables } from '../contexts/PendingDeliverablesContext'; 
import { finalizeDeliverable } from '../firebase/inventoryUtils';

const PendingDeliverables = () => {
    const { pendingDeliverables, isLoading, error } = usePendingDeliverables();
    const [finalizingId, setFinalizingId] = useState(null);

    const handleFinalize = async (item) => {
        if (finalizingId) return; 
        setFinalizingId(item.key); 
        try {
            await finalizeDeliverable(item);
        } catch (e) {
            console.error("Failed to finalize item:", e);
            alert(`Error: ${e.message}`);
        } finally {
            setFinalizingId(null);
        }
    };

    if (isLoading) {
        return <p>Loading pending items...</p>;
    }

    if (error) {
        return <p>Error loading items: {error.message}</p>;
    }

    const allItems = pendingDeliverables.flatMap(batch => batch.items.map(item => ({ ...item, batchId: batch.id, deliveredAt: batch.deliveredAt })));

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title">Pending Items to be Delivered ({allItems.length})</h2>
                
                {allItems.length === 0 ? (
                    <p>There are no items waiting to be delivered.</p>
                ) : (
                    <div className="space-y-4">
                        {allItems.map(item => {
                            const isFinalizing = finalizingId === item.key; 
                            const deliveredDate = item.deliveredAt?.toDate ? item.deliveredAt.toDate() : (item.deliveredAt ? new Date(item.deliveredAt) : null);

                            return (
                                <div key={item.key} className="p-4 border rounded-lg">
                                    <p><strong>Product:</strong> {item.productName || 'N/A'}</p>
                                    <p><strong>SKU:</strong> {item.sku || 'N/A'}</p>
                                    <p><strong>Quantity to Deliver:</strong> {item.quantity} {item.unit}</p>
                                    <p><strong>Date:</strong> {deliveredDate ? deliveredDate.toLocaleDateString() : 'N/A'}</p>
                                    <div className="card-actions justify-end mt-2">
                                        <button 
                                            className={`btn btn-primary ${isFinalizing ? 'loading' : ''}`}
                                            onClick={() => handleFinalize(item)}
                                            disabled={isFinalizing}
                                        >
                                            {isFinalizing ? 'Finalizing...' : 'Finalize'}
                                        </button>
                                        <button className="btn btn-secondary" disabled={isFinalizing}>View Details</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingDeliverables;
