
// src/contexts/PendingDeliverablesContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, writeBatch, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { generateDeliveryBatchId } from '../firebase/system_services';

const PendingDeliverablesContext = createContext();

export const usePendingDeliverables = () => useContext(PendingDeliverablesContext);

export const PendingDeliverablesProvider = ({ children }) => {
    const { db, appId, userId } = useAuth();
    const [pendingDeliverables, setPendingDeliverables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isMutationDisabled, setIsMutationDisabled] = useState(false);

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

    const createPendingDeliverable = useCallback(async (order, items, user) => {
        setIsMutationDisabled(true);
        try {
            if (!db || !appId || !userId || !order || !items?.length || !user) {
                throw new Error("Missing required data to create a pending deliverable.");
            }

            const batchId = await generateDeliveryBatchId(db, appId);
            const deliverablesCollectionRef = collection(db, `artifacts/${appId}/pending_deliverables`);

            const allItems = items.map(item => ({ 
                productId: item.productId,
                productName: item.productName,
                isSerialized: item.isSerialized,
                sku: item.sku, // Pass SKU for easier lookup
                serial: item.serial || null,
                quantity: item.quantity,
                inventoryItemId: item.inventoryItemId || null,
                locationId: item.locationId
            }));
            
            // This function NO LONGER updates the sales order status.
            // It only creates the deliverable document.
            // The SO status is now updated ONLY upon finalization in FinalizeSalesOrder.jsx
            await addDoc(deliverablesCollectionRef, {
                salesOrderId: order.id,
                salesOrderNumber: order.orderNumber,
                customerName: order.customerName,
                customerId: order.customerId,
                batchId: batchId,
                items: allItems,
                status: 'PENDING_DELIVERY',
                createdAt: serverTimestamp(),
                createdBy: { uid: userId, name: user.displayName || 'N/A' }
            });

        } catch (error) {
            console.error("Failed to create pending deliverable:", error);
            throw error;
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId, userId]);

    const deleteDeliverableBatch = useCallback(async (batchId) => {
        if (!batchId || !db || !appId) throw new Error("Missing required data.");

        const deliverablesCollectionRef = collection(db, `/artifacts/${appId}/pending_deliverables`);
        const q = query(deliverablesCollectionRef, where("batchId", "==", batchId));

        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return;
            
            const batch = writeBatch(db);
            querySnapshot.forEach(doc => batch.delete(doc.ref));
            
            await batch.commit();
        } catch (err) {
            console.error(`Error deleting batch ${batchId}:`, err);
            throw err;
        }
    }, [db, appId]);

    const value = {
        pendingDeliverables,
        isLoading,
        error,
        createPendingDeliverable,
        deleteDeliverableBatch,
        isMutationDisabled,
    };

    return (
        <PendingDeliverablesContext.Provider value={value}>
            {children}
        </PendingDeliverablesContext.Provider>
    );
};
