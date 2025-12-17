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
    serverTimestamp,
    runTransaction
} from 'firebase/firestore';

const PurchaseInvoiceContext = createContext();

export const usePurchaseInvoices = () => useContext(PurchaseInvoiceContext);

// REWRITTEN FROM SCRATCH: This context is now simplified.
// It is ONLY responsible for providing the list of invoices and simple CRUD operations.
// The complex finalization logic has been moved directly into the component
// to prevent the stale data/caching bug that was causing crashes.

const generateInvoiceNumber = async (db, appId, invoiceDate) => {
    const d = invoiceDate.toDate ? invoiceDate.toDate() : new Date(invoiceDate);
    if (isNaN(d.getTime())) throw new Error("Invalid date for invoice number.");

    const counterRef = doc(db, 'artifacts', appId, 'counters', 'purchaseInvoiceCounter');
    return runTransaction(db, async (transaction) => {
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
        return `PI-${currentPeriod}-${nextCount.toString().padStart(3, '0')}`;
    });
};

export const PurchaseInvoiceProvider = ({ children }) => {
    const { db, appId } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutationDisabled, setIsMutationDisabled] = useState(false);

    useEffect(() => {
        if (!db || !appId) {
            setIsLoading(false);
            return;
        }
        const ref = collection(db, 'artifacts', appId, 'purchase_invoices');
        const unsubscribe = onSnapshot(ref, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setInvoices(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching purchase invoices: ", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, appId]);

    const addInvoice = useCallback(async (invoiceData, user) => {
        setIsMutationDisabled(true);
        try {
            if (!db || !appId || !user?.uid) throw new Error("Missing user or DB config.");
            const newInvoiceNumber = await generateInvoiceNumber(db, appId, invoiceData.invoiceDate);
            const newInvoice = {
                ...invoiceData,
                invoiceNumber: newInvoiceNumber,
                items: (invoiceData.items || []).map(item => ({ ...item, receivedQty: 0 })),
                status: 'PENDING',
                createdAt: serverTimestamp(),
                createdBy: { uid: user.uid, name: user.displayName || 'N/A' },
            };
            await addDoc(collection(db, 'artifacts', appId, 'purchase_invoices'), newInvoice);
        } catch (error) {
            console.error("Failed to create purchase invoice:", error);
            throw error;
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const updateInvoice = useCallback(async (id, updatedData) => {
        setIsMutationDisabled(true);
        const docRef = doc(db, 'artifacts', appId, 'purchase_invoices', id);
        try {
            await updateDoc(docRef, { ...updatedData, updatedAt: serverTimestamp() });
        } catch (error) {
            console.error("Error updating invoice:", error);
            throw error;
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const deleteInvoice = useCallback(async (id) => {
        setIsMutationDisabled(true);
        const docRef = doc(db, 'artifacts', appId, 'purchase_invoices', id);
        try {
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting invoice:", error);
            throw error;
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    // The `finalizePurchaseInvoice` function has been removed from this context.
    const value = {
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        isLoading,
        isMutationDisabled,
        // Exposing this setter for the component to use
        setMutationDisabled: setIsMutationDisabled
    };

    return (
        <PurchaseInvoiceContext.Provider value={value}>
            {children}
        </PurchaseInvoiceContext.Provider>
    );
};
