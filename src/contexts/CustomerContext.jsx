
// src/contexts/CustomerContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';

// --- LocalForage Store Setup ---
const CUSTOMER_STORE_NAME = 'customersCache';
const customerStore = localforage.createInstance({
    name: "inventoryApp",
    storeName: CUSTOMER_STORE_NAME,
});

const CustomerContext = createContext();

export const useCustomers = () => useContext(CustomerContext);

export const CustomerProvider = ({ children }) => {
    const { appId, db, isOnline, authReady } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const getCustomersCollectionRef = useCallback(() => {
        if (!appId || !db) throw new Error("Database or Application context is not ready.");
        return collection(db, `/artifacts/${appId}/customers`);
    }, [appId, db]);

    // --- DATA LOADING ---
    useEffect(() => {
        if (!authReady || !appId || !db) return;

        let unsubscribe = () => {};
        setIsLoading(true);

        if (isOnline) {
            try {
                const colRef = getCustomersCollectionRef();
                const q = query(colRef);

                unsubscribe = onSnapshot(q, async (snapshot) => {
                    const customerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setCustomers(customerList);
                    await customerStore.setItem(CUSTOMER_STORE_NAME, customerList);
                    setIsLoading(false);
                }, (error) => {
                    console.error("Error fetching customers:", error);
                    setIsLoading(false);
                });
            } catch (error) {
                console.error("Failed to set up customer listener:", error.message);
                setIsLoading(false);
            }
        } else {
            customerStore.getItem(CUSTOMER_STORE_NAME).then(cachedCustomers => {
                setCustomers(cachedCustomers || []);
                setIsLoading(false);
            }).catch(error => {
                console.error("Error loading offline customers cache:", error);
                setIsLoading(false);
            });
        }

        return () => unsubscribe();
    }, [appId, authReady, db, isOnline, getCustomersCollectionRef]);
    
    // --- ID GENERATION ---
    const getNextCustomerId = async () => {
        if (!db || !appId) throw new Error("Database not configured");
        const counterRef = doc(db, 'artifacts', appId, 'counters', 'customerCounter');

        try {
            const newIdNumber = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextId = 1;
                if (counterDoc.exists()) {
                    nextId = counterDoc.data().currentId + 1;
                }
                transaction.set(counterRef, { currentId: nextId }, { merge: true });
                return nextId;
            });
            return `CUS-${newIdNumber.toString().padStart(3, '0')}`;
        } catch (error) {
            console.error("Error generating new customer ID: ", error);
            throw new Error("Failed to generate a unique customer ID.");
        }
    };


    // --- CRUD FUNCTIONS ---
    const addCustomer = async (customerData) => {
        if (!isOnline) throw new Error("Customers can only be added while online.");
        const colRef = getCustomersCollectionRef();
        const customerId = await getNextCustomerId();
        const docRef = doc(colRef, customerId);

        await setDoc(docRef, {
            ...customerData,
            customerId: customerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    };

    const updateCustomer = async (customerId, updatedData) => {
        if (!isOnline) throw new Error("Customers can only be updated while online.");
        const docRef = doc(getCustomersCollectionRef(), customerId);
        await updateDoc(docRef, {
            ...updatedData,
            updatedAt: serverTimestamp(),
        });
    };

    const deleteCustomer = async (customerId) => {
        if (!isOnline) throw new Error("Customers can only be deleted while online.");
        const docRef = doc(getCustomersCollectionRef(), customerId);
        await deleteDoc(docRef);
    };

    const contextValue = {
        customers,
        isLoading,
        addCustomer,
        updateCustomer,
        deleteCustomer,
    };

    return (
        <CustomerContext.Provider value={contextValue}>
            {children}
        </CustomerContext.Provider>
    );
};
