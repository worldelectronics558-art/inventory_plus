
// src/contexts/PurchaseInvoiceContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext'; // Correctly import useUser
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';

const PurchaseInvoiceContext = createContext();

export const usePurchaseInvoices = () => useContext(PurchaseInvoiceContext);

// Helper function to generate the invoice number
const generateInvoiceNumber = (invoiceDate) => {
    const d = invoiceDate.toDate ? invoiceDate.toDate() : new Date(invoiceDate);
    
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');

    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const dateStr = `${year}${month}${day}`;
    const timeStr = `${hours}${minutes}`;
    
    return `PI-${dateStr}-${timeStr}`;
};


export const PurchaseInvoiceProvider = ({ children }) => {
    const { db, appId } = useAuth();
    const { currentUser } = useUser(); // Use the currentUser from UserContext
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
        if (!invoiceData.invoiceDate) throw new Error("Invoice date is required to generate an invoice number.");
        
        const invoicesCollectionRef = collection(db, 'artifacts', appId, 'purchaseInvoices');
        
        const newInvoiceNumber = generateInvoiceNumber(invoiceData.invoiceDate);
        
        const newInvoice = {
            ...invoiceData,
            invoiceNumber: newInvoiceNumber,
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: currentUser?.uid || null, // Storing the UID of the creator
            createdByName: currentUser?.displayName || 'N/A' // CORRECT: Using currentUser.displayName
        };
        return await addDoc(invoicesCollectionRef, newInvoice);
    }, [db, appId, currentUser]); // Add currentUser to dependency array

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
