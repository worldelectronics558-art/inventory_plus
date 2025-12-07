import React, { useState } from 'react';
import { usePendingReceivables } from '../contexts/PendingReceivablesContext'; // CORRECTED IMPORT
import { finalizeReceivable } from '../firebase/inventoryUtils';

const PendingReceivables = () => {
    const { pendingReceivables, isLoading, error, removePendingReceivableBatch } = usePendingReceivables();
    const [finalizingId, setFinalizingId] = useState(null);

    const handleFinalize = async (item) => {
        if (finalizingId) return; // Prevent multiple clicks if already finalizing
        setFinalizingId(item.key); // Use unique item key
        try {
            // The `finalizeReceivable` function is designed to handle individual items with SKU and quantity
            // We need to find the specific item to finalize from the batches
            await finalizeReceivable(item);
            // After finalization, the context's snapshot listener should refresh the data.
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

    // The context provides batches, so we need to flatten them into a single list of items
    const allItems = pendingReceivables.flatMap(batch => batch.items.map(item => ({ ...item, batchId: batch.id, receivedAt: batch.receivedAt })));

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title">Pending Items to be Finalized ({allItems.length})</h2>
                
                {allItems.length === 0 ? (
                    <p>There are no items waiting to be finalized.</p>
                ) : (
                    <div className="space-y-4">
                        {allItems.map(item => {
                            const isFinalizing = finalizingId === item.key; // Use a unique key for the item
                            // Ensure receivedAt is a valid Date object before calling toLocaleDateString
                            const receivedDate = item.receivedAt?.toDate ? item.receivedAt.toDate() : (item.receivedAt ? new Date(item.receivedAt) : null);

                            return (
                                <div key={item.key} className="p-4 border rounded-lg">
                                    <p><strong>Product:</strong> {item.productName || 'N/A'}</p>
                                    <p><strong>SKU:</strong> {item.sku || 'N/A'}</p>
                                    <p><strong>Quantity Received:</strong> {item.quantity} {item.unit}</p>
                                    <p><strong>Date:</strong> {receivedDate ? receivedDate.toLocaleDateString() : 'N/A'}</p>
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

export default PendingReceivables;
