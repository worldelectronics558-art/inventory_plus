
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
    writeBatch,
    serverTimestamp,
    runTransaction,
    query,
    where,
    getDocs,
} from 'firebase/firestore';

const PurchaseInvoiceContext = createContext();

export const usePurchaseInvoices = () => useContext(PurchaseInvoiceContext);

const generateInvoiceNumber = async (db, appId, invoiceDate) => {
    const d = invoiceDate.toDate ? invoiceDate.toDate() : new Date(invoiceDate);
    if (isNaN(d.getTime())) {
        throw new Error("Invalid date provided for invoice number generation.");
    }

    const year = d.getFullYear().toString().slice(-2);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    
    const counterId = `pi_counter_${year}${month}`;
    const counterRef = doc(db, 'artifacts', appId, 'counters', counterId);

    let nextNumber;
    try {
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                nextNumber = 1;
                transaction.set(counterRef, { count: nextNumber });
            } else {
                nextNumber = counterDoc.data().count + 1;
                transaction.update(counterRef, { count: nextNumber });
            }
        });
    } catch (e) {
        console.error("Transaction failed: ", e);
        throw new Error("Could not generate new invoice number.");
    }

    const formattedNumber = nextNumber.toString().padStart(3, '0');
    return `PI-${year}${month}-${formattedNumber}`;
};

export const PurchaseInvoiceProvider = ({ children }) => {
    const { db, appId } = useAuth();
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

    const addInvoice = useCallback(async (invoiceData, user) => {
        if (!db || !appId) throw new Error("Database not configured");
        if (!invoiceData.invoiceDate) throw new Error("Invoice date is required");
        if (!user?.uid) throw new Error("User data is not available. Please wait and try again.");
        
        const invoicesCollectionRef = collection(db, 'artifacts', appId, 'purchaseInvoices');
        const newInvoiceNumber = await generateInvoiceNumber(db, appId, invoiceData.invoiceDate);
        
        const newInvoice = {
            ...invoiceData,
            invoiceNumber: newInvoiceNumber,
            status: 'Pending',
            createdAt: serverTimestamp(),
            createdBy: { 
                uid: user.uid,
                name: user.displayName || 'N/A'
            },
        };
        return await addDoc(invoicesCollectionRef, newInvoice);
    }, [db, appId]);

    const updateInvoice = useCallback(async (id, updatedData) => {
        if (!db || !appId) throw new Error("Database not configured");
        const invoiceDocRef = doc(db, 'artifacts', appId, 'purchaseInvoices', id);
        return await updateDoc(invoiceDocRef, { ...updatedData, updatedAt: serverTimestamp() });
    }, [db, appId]);

    const deleteInvoiceByNumber = useCallback(async (invoiceNumber) => {
        if (!db || !appId) throw new Error("Database not configured");
        const invoicesCollectionRef = collection(db, 'artifacts', appId, 'purchaseInvoices');
        const q = query(invoicesCollectionRef, where("invoiceNumber", "==", invoiceNumber));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log(`Invoice with number ${invoiceNumber} not found.`);
            return;
        }
        const deletePromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
        console.log(`Successfully deleted invoice(s) with number ${invoiceNumber}`);
    }, [db, appId]);

    const addStockItems = useCallback(async (itemsToAddToStock, invoiceId, updatedInvoiceData, user) => {
        if (!db || !appId) throw new Error("Database not configured");
        if (!user || !user.uid) throw new Error("User not authenticated or UID is missing");

        const batch = writeBatch(db);

        const invoiceDocRef = doc(db, 'artifacts', appId, 'purchaseInvoices', invoiceId);
        batch.update(invoiceDocRef, { ...updatedInvoiceData, updatedAt: serverTimestamp() });

        const inventoryCollectionRef = collection(db, 'artifacts', appId, 'inventory_items');
        itemsToAddToStock.forEach(item => {
            const newItemRef = doc(inventoryCollectionRef);
            const { id, createdBy, status, ...restOfItem } = item;
            batch.set(newItemRef, {
                ...restOfItem,
                cost: item.cost,
                receivedBy: createdBy,
                authorizedBy: { 
                    uid: user.uid,
                    name: user.displayName || 'N/A'
                },
                addedAt: serverTimestamp(),
            });
        });

        await batch.commit();
    }, [db, appId]);

    const value = {
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice: deleteInvoiceByNumber,
        addStockItems,
        isLoading,
    };

    return (
        <PurchaseInvoiceContext.Provider value={value}>
            {children}
        </PurchaseInvoiceContext.Provider>
    );
};
