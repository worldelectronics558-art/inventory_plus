// src/contexts/PendingReceivablesContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, writeBatch, doc, query, where, getDocs } from 'firebase/firestore';

const PendingReceivablesContext = createContext();

export const usePendingReceivables = () => useContext(PendingReceivablesContext);

export const PendingReceivablesProvider = ({ children }) => {
    const { db, appId, userId } = useAuth();
    const [pendingReceivables, setPendingReceivables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!userId || !db || !appId) {
            setPendingReceivables([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const receivablesCollectionRef = collection(db, `/artifacts/${appId}/pending_receivables`);

        const unsubscribe = onSnapshot(receivablesCollectionRef, (snapshot) => {
            const receivedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingReceivables(receivedItems);
            setIsLoading(false);
        }, (err) => {
            console.error("Failed to listen to pending receivables collection:", err);
            setError(err);
            setIsLoading(false);
        });

        return () => unsubscribe();

    }, [userId, db, appId]);

    const removeReceivables = useCallback(async (receivableIdsToRemove) => {
        if (!Array.isArray(receivableIdsToRemove) || receivableIdsToRemove.length === 0) return;
        if (!db || !appId) throw new Error("Database connection is not available.");
        
        const batch = writeBatch(db);
        const receivablesCollectionRef = collection(db, `/artifacts/${appId}/pending_receivables`);
        
        receivableIdsToRemove.forEach(id => {
            const docRef = doc(receivablesCollectionRef, id);
            batch.delete(docRef);
        });
        
        try {
            await batch.commit();
        } catch (err) {
            console.error("Error removing receivables: ", err);
            throw err;
        }
    }, [db, appId]);

    const deleteReceivableBatch = useCallback(async (batchId) => {
        if (!batchId) return;
        if (!db || !appId) throw new Error("Database connection is not available.");

        const receivablesCollectionRef = collection(db, `/artifacts/${appId}/pending_receivables`);
        const q = query(receivablesCollectionRef, where("batchId", "==", batchId));

        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                console.warn(`No receivables found for batchId: ${batchId}`);
                return;
            }
            
            const batch = writeBatch(db);
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log(`Successfully deleted batch: ${batchId}`);
        } catch (err) {
            console.error(`Error deleting batch ${batchId}:`, err);
            throw err;
        }
    }, [db, appId]);

    // --- 2. PLACEHOLDER FUNCTION FOR ITEM UPDATES ---
    const updateReceivableItem = useCallback(async (itemId, updatedData) => {
        console.log('Update receivable item feature is not yet implemented.', { itemId, updatedData });
        // This will be expanded later to allow editing quantity or serials.
        // For now, it does nothing but provides a hook for the UI.
        alert("Editing individual items is not yet supported.");
    }, []);


    const value = {
        pendingReceivables,
        isLoading,
        error,
        removeReceivables,
        deleteReceivableBatch, // <-- 3. EXPORT NEW FUNCTIONS
        updateReceivableItem,  // <-- 3. EXPORT NEW FUNCTIONS
    };

    return (
        <PendingReceivablesContext.Provider value={value}>
            {children}
        </PendingReceivablesContext.Provider>
    );
};
