
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
    writeBatch,
    serverTimestamp,
    runTransaction,
} from 'firebase/firestore';

const SalesOrderContext = createContext();

export const useSalesOrders = () => useContext(SalesOrderContext);

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

            transaction.set(counterRef, {
                currentCount: nextCount,
                lastResetPeriod: currentPeriod
            }, { merge: true });

            const formattedCount = nextCount.toString().padStart(3, '0');
            return `SO-${currentPeriod}-${formattedCount}`;
        });
        return newOrderNumberStr;
    } catch (e) {
        console.error("Failed to generate sales order number:", e);
        throw new Error("Could not generate a new sales order number. Please try again.");
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
            // --- Guard Clauses ---
            if (!db || !appId) throw new Error("Database not configured.");
            if (!orderData) throw new Error("orderData is missing.");
            if (!orderData.orderDate) throw new Error("Order date is required.");
            if (!user?.uid) throw new Error("User data is not available.");

            const collectionRef = collection(db, 'artifacts', appId, 'sales_orders');
            const newOrderNumber = await generateSalesOrderNumber(db, appId, orderData.orderDate);
            
            const parseAndValidateNumber = (value, defaultValue = 0) => {
                const parsed = Number(value);
                return isNaN(parsed) ? defaultValue : parsed;
            };

            // --- Sanitize Items ---
            const sanitizedItems = Array.isArray(orderData.items)
                ? orderData.items.map(item => ({
                    productId: item.productId || null,
                    productName: item.productName || 'N/A',
                    quantity: parseAndValidateNumber(item.quantity, 1),
                    unitPrice: parseAndValidateNumber(item.unitPrice),
                    price: parseAndValidateNumber(item.price),
                    tax: parseAndValidateNumber(item.tax),
                }))
                : [];

            // --- Build a clean, explicit newOrder object ---
            const newOrder = {
                customerId: orderData.customerId || null,
                customerName: orderData.customerName || 'N/A',
                orderDate: orderData.orderDate,
                documentNumber: orderData.documentNumber || '',
                notes: orderData.notes || '',
                items: sanitizedItems,
                totalPreTax: parseAndValidateNumber(orderData.totalPreTax),
                totalTax: parseAndValidateNumber(orderData.totalTax),
                totalAmount: parseAndValidateNumber(orderData.totalAmount),
                orderNumber: newOrderNumber,
                status: 'PENDING',
                createdAt: serverTimestamp(),
                createdBy: { 
                    uid: user.uid,
                    name: user.displayName || 'N/A'
                },
            };
            
            await addDoc(collectionRef, newOrder);
        } catch (error) {
            console.error("Failed to create sales order:", error, "Order Data:", orderData);
            throw error; // Re-throw to be handled by the form
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const updateSalesOrder = useCallback(async (id, updatedData) => {
        setIsMutationDisabled(true);
        if (!db || !appId) throw new Error("Database not configured");
        const orderDocRef = doc(db, 'artifacts', appId, 'sales_orders', id);
        try {
            return await updateDoc(orderDocRef, { ...updatedData, updatedAt: serverTimestamp() });
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const deleteSalesOrder = useCallback(async (orderId) => {
        setIsMutationDisabled(true);
        if (!db || !appId) throw new Error("Database not configured");
        const orderDocRef = doc(db, 'artifacts', appId, 'sales_orders', orderId);
        try {
            await deleteDoc(orderDocRef);
        } catch (error) {
            console.error("Error deleting sales order:", error);
            throw error;
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const removeStockItems = useCallback(async (orderId, updatedOrderData, pendingDeliverableIds) => {
        if (!db || !appId) throw new Error("Database not configured");

        const batch = writeBatch(db);

        const orderDocRef = doc(db, 'artifacts', appId, 'sales_orders', orderId);
        batch.update(orderDocRef, { ...updatedOrderData, status: 'FINALIZED', updatedAt: serverTimestamp() });

        const deliverablesCollectionRef = collection(db, 'artifacts', appId, 'pending_deliverables');
        pendingDeliverableIds.forEach(id => {
            const docRef = doc(deliverablesCollectionRef, id);
            batch.delete(docRef);
        });

        await batch.commit();
    }, [db, appId]);

    const value = {
        salesOrders,
        addSalesOrder,
        updateSalesOrder,
        deleteSalesOrder,
        removeStockItems,
        isLoading,
        isMutationDisabled,
    };

    return (
        <SalesOrderContext.Provider value={value}>
            {children}
        </SalesOrderContext.Provider>
    );
};
