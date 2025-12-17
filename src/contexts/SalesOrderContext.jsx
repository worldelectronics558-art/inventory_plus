
// src/contexts/SalesOrderContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    runTransaction,
} from 'firebase/firestore';

const SalesOrderContext = createContext();

export const useSalesOrders = () => useContext(SalesOrderContext);

// This function generates a unique, sequential, and time-based sales order number.
const generateSalesOrderNumber = async (db, appId, orderDate) => {
    const d = orderDate.toDate ? orderDate.toDate() : new Date(orderDate);
    if (isNaN(d.getTime())) {
        throw new Error("Invalid date provided for order number generation.");
    }

    const counterRef = doc(db, 'artifacts', appId, 'counters', 'salesOrderCounter');

    try {
        const newOrderNumberStr = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            const year = d.getFullYear().toString().slice(-2);
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const currentPeriod = `${year}${month}`;

            let nextCount = 1;
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                if (data.lastResetPeriod === currentPeriod) {
                    nextCount = data.currentCount + 1;
                }
            }

            transaction.set(counterRef, { currentCount: nextCount, lastResetPeriod: currentPeriod }, { merge: true });

            return `SO-${currentPeriod}-${nextCount.toString().padStart(3, '0')}`;
        });
        return newOrderNumberStr;
    } catch (e) {
        console.error("Failed to generate sales order number:", e);
        throw new Error("Could not generate a new sales order number.");
    }
};

export const SalesOrderProvider = ({ children }) => {
    const { db, appId } = useAuth();
    const [salesOrders, setSalesOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutationDisabled, setIsMutationDisabled] = useState(false);

    useEffect(() => {
        if (!db || !appId) {
            setIsLoading(false);
            return;
        }
        const salesOrdersCollectionRef = collection(db, 'artifacts', appId, 'sales_orders');
        const unsubscribe = onSnapshot(salesOrdersCollectionRef, (snapshot) => {
            const ordersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setSalesOrders(ordersData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching sales orders: ", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, appId]);

    const addSalesOrder = useCallback(async (orderData, user) => {
        setIsMutationDisabled(true);
        try {
            if (!db || !appId || !orderData.orderDate || !user?.uid) throw new Error("Missing required data.");

            const collectionRef = collection(db, 'artifacts', appId, 'sales_orders');
            const newOrderNumber = await generateSalesOrderNumber(db, appId, orderData.orderDate);

            const newOrder = {
                ...orderData,
                orderNumber: newOrderNumber,
                items: (orderData.items || []).map(item => ({...item, deliveredQty: 0, returnedQty: 0})),
                status: 'PENDING',
                createdAt: serverTimestamp(),
                createdBy: { uid: user.uid, name: user.displayName || 'N/A' },
            };
            
            await addDoc(collectionRef, newOrder);
        } catch (error) {
            console.error("Failed to create sales order:", error);
            throw error;
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const updateSalesOrder = useCallback(async (id, updatedData) => {
        setIsMutationDisabled(true);
        if (!db || !appId) throw new Error("Database not configured");
        const orderDocRef = doc(db, 'artifacts', appId, 'sales_orders', id);
        try {
            await updateDoc(orderDocRef, { ...updatedData, updatedAt: serverTimestamp() });
        } catch(error){
            console.error("Error updating sales order:", error);
            throw error;
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const deleteSalesOrder = useCallback(async (id) => {
        setIsMutationDisabled(true);
        if (!db || !appId) throw new Error("Database not configured");
        const orderDocRef = doc(db, 'artifacts', appId, 'sales_orders', id);
        try {
            await deleteDoc(orderDocRef);
        } catch(error){
            console.error("Error deleting sales order:", error);
            throw error;
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    // The complex `finalizeSalesOrderDelivery` function has been removed.
    // This logic is now handled directly in the `FinalizeSalesOrder` component
    // using a secure and atomic transaction to ensure data integrity.

    const value = {
        salesOrders,
        addSalesOrder,
        updateSalesOrder,
        deleteSalesOrder,
        isLoading,
        isMutationDisabled,
        setIsMutationDisabled // *** CORRECTED: Was setMutationDisabled ***
    };

    return (
        <SalesOrderContext.Provider value={value}>
            {children}
        </SalesOrderContext.Provider>
    );
};
