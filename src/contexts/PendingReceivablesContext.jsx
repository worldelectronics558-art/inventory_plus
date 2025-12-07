
// src/contexts/PendingReceivablesContext.jsx

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const PendingReceivablesContext = createContext();

export const usePendingReceivables = () => useContext(PendingReceivablesContext);

export const PendingReceivablesProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [pendingReceivables, setPendingReceivables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const getStorageKey = () => `pendingReceivables_${currentUser.uid}`;

    useEffect(() => {
        if (currentUser) {
            setIsLoading(true);
            try {
                const storedData = localStorage.getItem(getStorageKey());
                if (storedData) {
                    setPendingReceivables(JSON.parse(storedData));
                }
            } catch (err) {
                console.error("Failed to load pending receivables from storage:", err);
                setError(err);
            } finally {
                setIsLoading(false);
            }
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
            try {
                localStorage.setItem(getStorageKey(), JSON.stringify(pendingReceivables));
            } catch (err) {
                console.error("Failed to save pending receivables to storage:", err);
                setError(err);
            }
        }
    }, [pendingReceivables, currentUser]);

    const addPendingReceivables = (receivedItems) => {
        if (!Array.isArray(receivedItems) || receivedItems.length === 0) return;
        const batchId = `batch_${Date.now()}`;
        const newReceivables = {
            id: batchId,
            receivedAt: new Date(),
            items: receivedItems.map(item => ({ ...item, batchId, isConsumed: false, key: item.key || `${item.productId}_${Date.now()}` })),
            status: 'pending',
        };
        setPendingReceivables(prev => [...prev, newReceivables]);
    };

    const removePendingReceivableBatch = (batchId) => {
        setPendingReceivables(prev => prev.filter(batch => batch.id !== batchId));
    };

    const consumeItemsFromPendingReceivables = (itemsToConsume) => {
        const itemKeysToConsume = new Set(itemsToConsume.map(i => i.key));
        
        setPendingReceivables(prevBatches => {
            const updatedBatches = prevBatches.map(batch => {
                // Mark consumed items
                const newItems = batch.items.map(item => {
                    if (itemKeysToConsume.has(item.key)) {
                        return { ...item, isConsumed: true };
                    }
                    return item;
                });

                // Filter out fully consumed items
                const remainingItems = newItems.filter(item => !item.isConsumed);
                
                // If a batch has no remaining items, we can filter it out entirely.
                if (remainingItems.length === 0) {
                    return null; 
                }

                return { ...batch, items: remainingItems };
            }).filter(Boolean); // The .filter(Boolean) will remove the null batches
            
            return updatedBatches;
        });
    };
    
    const getReceivableBatchById = (batchId) => {
        return pendingReceivables.find(batch => batch.id === batchId);
    };

    const value = {
        pendingReceivables,
        isLoading,
        error,
        addPendingReceivables,
        removePendingReceivableBatch,
        consumeItemsFromPendingReceivables, // New granular function
        getReceivableBatchById,
    };

    return (
        <PendingReceivablesContext.Provider value={value}>
            {children}
        </PendingReceivablesContext.Provider>
    );
};
