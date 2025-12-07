
// src/contexts/PendingReceivablesContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, writeBatch, doc } from 'firebase/firestore';

const PendingReceivablesContext = createContext();

export const usePendingReceivables = () => useContext(PendingReceivablesContext);

export const PendingReceivablesProvider = ({ children }) => {
    const { db, appId, userId } = useAuth(); // CORRECT DEPENDENCY: Use userId
    const [pendingReceivables, setPendingReceivables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Effect to listen for real-time updates from the 'pending_stock' collection
    useEffect(() => {
        // CORRECT GUARD: Use userId
        if (!userId || !db || !appId) {
            setPendingReceivables([]);
            setIsLoading(false);
            return; 
        }

        setIsLoading(true);
        const pendingStockCollectionRef = collection(db, `/artifacts/${appId}/pending_stock`);

        const unsubscribe = onSnapshot(pendingStockCollectionRef, (snapshot) => {
            const receivedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingReceivables(receivedItems);
            setIsLoading(false);
        }, (err) => {
            console.error("Failed to listen to pending stock collection:", err);
            setError(err);
            setIsLoading(false);
        });

        return () => unsubscribe();

    }, [userId, db, appId]); // Rerun effect if userId, db, or appId changes

    const removeReceivables = useCallback(async (receivableIdsToRemove) => {
        if (!Array.isArray(receivableIdsToRemove) || receivableIdsToRemove.length === 0) return;
        if (!db || !appId) throw new Error("Database connection is not available.");
        
        const batch = writeBatch(db);
        const pendingStockCollectionRef = collection(db, `/artifacts/${appId}/pending_stock`);
        
        receivableIdsToRemove.forEach(id => {
            const docRef = doc(pendingStockCollectionRef, id);
            batch.delete(docRef);
        });
        
        try {
            await batch.commit();
            console.log("Successfully removed receivables from pending_stock.");
        } catch (err) {
            console.error("Error removing receivables from pending stock: ", err);
            throw err;
        }

    }, [db, appId]);

    const value = {
        pendingReceivables,
        isLoading,
        error,
        removeReceivables,
    };

    return (
        <PendingReceivablesContext.Provider value={value}>
            {children}
        </PendingReceivablesContext.Provider>
    );
};
