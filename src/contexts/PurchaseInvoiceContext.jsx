
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
    runTransaction,
} from 'firebase/firestore';

const PurchaseInvoiceContext = createContext();

export const usePurchaseInvoices = () => useContext(PurchaseInvoiceContext);

const generateInvoiceNumber = async (db, appId, invoiceDate) => {
    const d = invoiceDate.toDate ? invoiceDate.toDate() : new Date(invoiceDate);
    if (isNaN(d.getTime())) {
        throw new Error("Invalid date provided for invoice number generation.");
    }

    const counterRef = doc(db, 'artifacts', appId, 'counters', 'purchaseInvoiceCounter');

    try {
        const newInvoiceNumberStr = await runTransaction(db, async (transaction) => {
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
            return `PI-${currentPeriod}-${formattedCount}`;
        });
        return newInvoiceNumberStr;
    } catch (e) {
        console.error("Failed to generate invoice number:", e);
        throw new Error("Could not generate a new invoice number. Please try again.");
    }
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

    const addInvoice = useCallback(async (invoiceData, user) => {
        setIsMutationDisabled(true);
        try {
            // --- Guard Clauses ---
            if (!db || !appId) throw new Error("Database not configured.");
            if (!invoiceData) throw new Error("invoiceData is missing.");
            if (!invoiceData.invoiceDate) throw new Error("Invoice date is required.");
            if (!user?.uid) throw new Error("User data is not available.");

            const invoicesCollectionRef = collection(db, 'artifacts', appId, 'purchaseInvoices');
            const newInvoiceNumber = await generateInvoiceNumber(db, appId, invoiceData.invoiceDate);
            
            const parseAndValidateNumber = (value, defaultValue = 0) => {
                const parsed = Number(value);
                return isNaN(parsed) ? defaultValue : parsed;
            };

            // --- Sanitize Items ---
            const sanitizedItems = Array.isArray(invoiceData.items)
                ? invoiceData.items.map(item => ({
                    productId: item.productId || null,
                    productName: item.productName || 'N/A',
                    quantity: parseAndValidateNumber(item.quantity, 1),
                    unitPrice: parseAndValidateNumber(item.unitPrice),
                    price: parseAndValidateNumber(item.price),
                    tax: parseAndValidateNumber(item.tax),
                }))
                : [];

            // --- Build a clean, explicit newInvoice object ---
            const newInvoice = {
                supplierId: invoiceData.supplierId || null,
                supplierName: invoiceData.supplierName || 'N/A',
                invoiceDate: invoiceData.invoiceDate,
                documentNumber: invoiceData.documentNumber || '',
                notes: invoiceData.notes || '',
                items: sanitizedItems,
                totalPreTax: parseAndValidateNumber(invoiceData.totalPreTax),
                totalTax: parseAndValidateNumber(invoiceData.totalTax),
                totalAmount: parseAndValidateNumber(invoiceData.totalAmount),
                invoiceNumber: newInvoiceNumber,
                status: 'PENDING',
                createdAt: serverTimestamp(),
                createdBy: { 
                    uid: user.uid,
                    name: user.displayName || 'N/A'
                },
            };
            
            await addDoc(invoicesCollectionRef, newInvoice);
        } catch (error) {
            console.error("Failed to create purchase invoice:", error, "Invoice Data:", invoiceData);
            throw error; // Re-throw to be handled by the form
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const updateInvoice = useCallback(async (id, updatedData) => {
        setIsMutationDisabled(true);
        if (!db || !appId) throw new Error("Database not configured");
        const invoiceDocRef = doc(db, 'artifacts', appId, 'purchaseInvoices', id);
        try {
            return await updateDoc(invoiceDocRef, { ...updatedData, updatedAt: serverTimestamp() });
        } finally {
            setIsMutationDisabled(false);
        }
    }, [db, appId]);

    const deleteInvoice = useCallback(async (invoiceId) => {
        setIsMutationDisabled(true);
        if (!db || !appId) throw new Error("Database not configured");
        const invoiceDocRef = doc(db, 'artifacts', appId, 'purchaseInvoices', invoiceId);
        try {
            await deleteDoc(invoiceDocRef);
        } catch (error) {
            console.error("Error deleting invoice:", error);
            throw error; // Re-throw to be caught in the component
        } finally {
            setIsMutationDisabled(false);
        } 
    }, [db, appId]);

    const value = {
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        isLoading,
        isMutationDisabled
    };

    return (
        <PurchaseInvoiceContext.Provider value={value}>
            {children}
        </PurchaseInvoiceContext.Provider>
    );
};
