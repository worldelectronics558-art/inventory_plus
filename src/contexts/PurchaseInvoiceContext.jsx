
// src/contexts/PurchaseInvoiceContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    writeBatch, // Import writeBatch for transactions
    serverTimestamp
} from 'firebase/firestore';

const PurchaseInvoiceContext = createContext();

export const usePurchaseInvoices = () => useContext(PurchaseInvoiceContext);

const generateInvoiceNumber = (invoiceDate) => {
    const d = invoiceDate.toDate ? invoiceDate.toDate() : new Date(invoiceDate);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `PI-${year}${month}${day}-${hours}${minutes}`;
};

export const PurchaseInvoiceProvider = ({ children }) => {
    const { db, appId } = useAuth();
    const { currentUser } = useUser();
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

    const addInvoice = useCallback(async (invoiceData) => {
        if (!db || !appId) throw new Error("Database not configured");
        if (!invoiceData.invoiceDate) throw new Error("Invoice date is required");
        
        const invoicesCollectionRef = collection(db, 'artifacts', appId, 'purchaseInvoices');
        const newInvoiceNumber = generateInvoiceNumber(invoiceData.invoiceDate);
        
        const newInvoice = {
            ...invoiceData,
            invoiceNumber: newInvoiceNumber,
            status: 'Pending', // Changed from 'pending' for consistency
            createdAt: serverTimestamp(),
            createdBy: { 
                uid: currentUser?.uid || null,
                name: currentUser?.displayName || 'N/A'
            },
        };
        return await addDoc(invoicesCollectionRef, newInvoice);
    }, [db, appId, currentUser]);

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

    // --- NEW TRANSACTIONAL FUNCTION ---
    const addStockItems = useCallback(async (itemsToAddToStock, invoiceId, updatedInvoiceData) => {
        if (!db || !appId) throw new Error("Database not configured");

        const batch = writeBatch(db);

        // 1. Update the invoice
        const invoiceDocRef = doc(db, 'artifacts', appId, 'purchaseInvoices', invoiceId);
        batch.update(invoiceDocRef, { ...updatedInvoiceData, updatedAt: serverTimestamp() });

        // 2. Add new items to the main inventory collection
        const inventoryCollectionRef = collection(db, 'artifacts', appId, 'inventory');
        itemsToAddToStock.forEach(item => {
            const newItemRef = doc(inventoryCollectionRef); // Creates a new doc with a unique ID
            const { id, ...itemData } = item; // Exclude the temporary pending ID
            batch.set(newItemRef, {
                ...itemData,
                addedAt: serverTimestamp(),
                // Any other final inventory fields can be set here
            });
        });

        // 3. Commit the atomic operation
        await batch.commit();

    }, [db, appId]);

    const value = {
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        addStockItems, // Export the new function
        isLoading,
    };

    return (
        <PurchaseInvoiceContext.Provider value={value}>
            {children}
        </PurchaseInvoiceContext.Provider>
    );
};
