import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { generateDeliveryBatchId } from '../firebase/system_services';

const PendingDeliverablesContext = createContext();

export const usePendingDeliverables = () => useContext(PendingDeliverablesContext);

export const PendingDeliverablesProvider = ({ children }) => {
    const { db, appId, userId } = useAuth();
    const [pendingDeliverables, setPendingDeliverables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutationDisabled, setIsMutationDisabled] = useState(false);

    // 1. Unified Listener logic (Matches Receivables pattern)
    useEffect(() => {
        if (!userId || !db || !appId) {
            setPendingDeliverables([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const deliverablesCollectionRef = collection(db, `artifacts/${appId}/pending_deliverables`);
        const q = query(deliverablesCollectionRef, where('status', '==', 'PENDING'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const deliverableBatches = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingDeliverables(deliverableBatches);
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching pending deliverables: ", err);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, appId, userId]);

    // 2. Creation logic (Aligned with Receivables, but specific to Sales Orders)
    const createPendingDeliverable = async (order, items, deliveringUser) => {
        if (!items || items.length === 0) {
            throw new Error("No items to add to the delivery batch.");
        }

        if (!db || !appId || !userId || !order || !deliveringUser) {
            throw new Error("Missing required data to create a pending deliverable.");
        }

        setIsMutationDisabled(true);
        try {
            const batchId = await generateDeliveryBatchId(db, appId);

            const newBatch = {
                batchId: batchId,
                salesOrderNumber: order.documentNumber || order.orderNumber || 'NA',
                customerName: order.customerName || 'NA',
                salesOrderId: order.id,
                status: 'PENDING',
                createdAt: serverTimestamp(),
                createdBy: { 
                    uid: userId, 
                    name: deliveringUser.displayName || 'N/A' 
                },
                // Clean mapping to ensure SKU and ID are explicitly saved
                items: items.map(item => ({
                    productId: item.productId, 
                    sku: item.sku || '',
                    productName: item.productName || 'Unknown Product',
                    quantity: Number(item.quantity),
                    isSerialized: !!item.isSerialized,
                    status: 'PENDING',
                    ...(item.isSerialized ? {
                        serials: item.serials || [],
                        inventoryItemIds: item.inventoryItemIds || []
                    } : {
                        inventoryItemId: item.inventoryItemId || null
                    })
                }))
            };

            const batchDocRef = doc(db, `artifacts/${appId}/pending_deliverables`, batchId);
            await setDoc(batchDocRef, newBatch);

        } catch (err) {
            console.error("Failed to create pending deliverable:", err);
            throw err;
        } finally {
            setIsMutationDisabled(false);
        }
    };

    // 3. Deletion logic
    const deleteDeliverableBatch = async (batchId) => {
        if (!batchId || !db || !appId) return;

        setIsMutationDisabled(true);
        try {
            const deliverablesCollectionRef = collection(db, `artifacts/${appId}/pending_deliverables`);
            const q = query(deliverablesCollectionRef, where("batchId", "==", batchId));
            const querySnapshot = await getDocs(q);
            
            const batch = writeBatch(db);
            querySnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (err) {
            console.error(`Error deleting batch ${batchId}:`, err);
            throw err;
        } finally {
            setIsMutationDisabled(false);
        }
    };

    const value = {
        pendingDeliverables,
        isLoading,
        isMutationDisabled,
        createPendingDeliverable,
        deleteDeliverableBatch,
    };

    return (
        <PendingDeliverablesContext.Provider value={value}>
            {children}
        </PendingDeliverablesContext.Provider>
    );
};