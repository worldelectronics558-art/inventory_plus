
// src/contexts/SalesContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const SalesContext = createContext();

export const useSales = () => useContext(SalesContext);

export const SalesProvider = ({ children }) => {
    const { appId, db, isOnline } = useAuth();
    const [salesOrders, setSalesOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const getSalesCollectionRef = useCallback(() => {
        if (!appId || !db) {
            throw new Error("Database or Application ID is missing.");
        }
        return collection(db, `/artifacts/${appId}/sales`);
    }, [appId, db]);

    useEffect(() => {
        if (!appId || !db) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const colRef = getSalesCollectionRef();
        const q = query(colRef); // You can add ordering here, e.g., orderBy('createdAt', 'desc')

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setSalesOrders(orders);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching sales orders:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [appId, db, getSalesCollectionRef]);

    const createSalesOrder = async (orderData) => {
        if (!isOnline) {
            throw new Error("Cannot create sales order while offline.");
        }

        try {
            const colRef = getSalesCollectionRef();
            const newOrder = {
                ...orderData,
                createdAt: serverTimestamp(),
                status: 'Pending', // or a default status
            };
            const docRef = await addDoc(colRef, newOrder);
            return docRef.id;
        } catch (error) {
            console.error("Error creating sales order:", error);
            throw error;
        }
    };

    const contextValue = {
        salesOrders,
        isLoading,
        createSalesOrder,
    };

    return (
        <SalesContext.Provider value={contextValue}>
            {children}
        </SalesContext.Provider>
    );
};
