// src/contexts/PendingDeliverablesContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, writeBatch, doc, query, where, getDocs } from 'firebase/firestore';

const PendingDeliverablesContext = createContext();

export const usePendingDeliverables = () => useContext(PendingDeliverablesContext);

export const PendingDeliverablesProvider = ({ children }) => {
    const { db, appId, userId } = useAuth();
    const [pendingDeliverables, setPendingDeliverables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!userId || !db || !appId) {
            setPendingDeliverables([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const deliverablesCollectionRef = collection(db, `/artifacts/${appId}/pending_deliverables`);

        const unsubscribe = onSnapshot(deliverablesCollectionRef, (snapshot) => {
            const deliverableItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingDeliverables(deliverableItems);
            setIsLoading(false);
        }, (err) => {
            console.error("Failed to listen to pending deliverables collection:", err);
            setError(err);
            setIsLoading(false);
        });

        return () => unsubscribe();

    }, [userId, db, appId]);

    const removeDeliverables = useCallback(async (deliverableIdsToRemove) => {
        if (!Array.isArray(deliverableIdsToRemove) || deliverableIdsToRemove.length === 0) return;
        if (!db || !appId) throw new Error("Database connection is not available.");
        
        const batch = writeBatch(db);
        const deliverablesCollectionRef = collection(db, `/artifacts/${appId}/pending_deliverables`);
        
        deliverableIdsToRemove.forEach(id => {
            const docRef = doc(deliverablesCollectionRef, id);
            batch.delete(docRef);
        });
        
        try {
            await batch.commit();
        } catch (err) {
            console.error("Error removing deliverables: ", err);
            throw err;
        }
    }, [db, appId]);

    const deleteDeliverableBatch = useCallback(async (batchId) => {
        if (!batchId) return;
        if (!db || !appId) throw new Error("Database connection is not available.");

        const deliverablesCollectionRef = collection(db, `/artifacts/${appId}/pending_deliverables`);
        const q = query(deliverablesCollectionRef, where("batchId", "==", batchId));

        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                console.warn(`No deliverables found for batchId: ${batchId}`);
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

    const updateDeliverableItem = useCallback(async (itemId, updatedData) => {
        console.log('Update deliverable item feature is not yet implemented.', { itemId, updatedData });
        alert("Editing individual items is not yet supported.");
    }, []);


    const value = {
        pendingDeliverables,
        isLoading,
        error,
        removeDeliverables,
        deleteDeliverableBatch,
        updateDeliverableItem,
    };

    return (
        <PendingDeliverablesContext.Provider value={value}>
            {children}
        </PendingDeliverablesContext.Provider>
    );
};
