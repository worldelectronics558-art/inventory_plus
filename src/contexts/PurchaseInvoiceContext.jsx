
// src/contexts/PurchaseInvoiceContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';

const PurchaseInvoiceContext = createContext();

export const usePurchaseInvoices = () => useContext(PurchaseInvoiceContext);

export const PurchaseInvoiceProvider = ({ children }) => {
    const { db, appId, user } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !appId) {
            setIsLoading(false);
            return;
        }

        const invoicesCollectionRef = collection(db, 'artifacts', appId, 'purchaseInvoices');
        
        const unsubscribe = onSnapshot(invoicesCollectionRef, (snapshot) => {
            const invoicesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setInvoices(invoicesData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching purchase invoices: ", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, appId]);

    const getNextInvoiceId = async () => {
        if (!db || !appId) throw new Error("Database not configured");
        const counterRef = doc(db, 'artifacts', appId, 'counters', 'purchaseInvoiceCounter');
        const userNickname = user?.displayName?.substring(0, 3).toUpperCase() || 'SYS';
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

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
            return `PI-${userNickname}-${dateStr}-${newIdNumber.toString().padStart(3, '0')}`;
        } catch (error) {
            console.error("Error generating new invoice ID: ", error);
            throw new Error("Failed to generate a unique invoice ID.");
        }
    };

    const addInvoice = useCallback(async (invoiceData) => {
        if (!db || !appId) throw new Error("Database not configured");
        const invoicesCollectionRef = collection(db, 'artifacts', appId, 'purchaseInvoices');
        const newId = await getNextInvoiceId();
        const newInvoice = {
            ...invoiceData,
            referenceNumber: newId,
            status: 'pending',
            createdAt: serverTimestamp(),
        };
        return await addDoc(invoicesCollectionRef, newInvoice);
    }, [db, appId, user]);

    const updateInvoice = useCallback(async (id, updatedData) => {
        if (!db || !appId) throw new Error("Database not configured");
        const invoiceDocRef = doc(db, 'artifacts', appId, 'purchaseInvoices', id);
        return await updateDoc(invoiceDocRef, { ...updatedData, updatedAt: serverTimestamp() });
    }, [db, appId]);

    const deleteInvoice = useCallback(async (id) => {
        if (!db || !appId) throw new Error("Database not configured");
        const invoiceDocRef = doc(db, 'artifacts', appId, 'purchaseInvoices', id);
        return await deleteDoc(invoiceDocRef);
    }, [db, appId]);

    const value = {
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        isLoading,
    };

    return (
        <PurchaseInvoiceContext.Provider value={value}>
            {children}
        </PurchaseInvoiceContext.Provider>
    );
};
