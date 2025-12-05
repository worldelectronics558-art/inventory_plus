
// src/contexts/SupplierContext.jsx

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

const SupplierContext = createContext();

export const useSuppliers = () => useContext(SupplierContext);

export const SupplierProvider = ({ children }) => {
    const { db, appId } = useAuth(); // Use db and appId from AuthContext
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !appId) {
            setIsLoading(false);
            return;
        }

        const suppliersCollectionRef = collection(db, 'artifacts', appId, 'suppliers');
        
        const unsubscribe = onSnapshot(suppliersCollectionRef, (snapshot) => {
            const suppliersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setSuppliers(suppliersData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching suppliers: ", error);
            setIsLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener on component unmount
    }, [db, appId]);

    const getNextSupplierId = async () => {
        if (!db || !appId) throw new Error("Database not configured");
        const counterRef = doc(db, 'artifacts', appId, 'counters', 'supplierCounter');

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
            return `SUP-${newIdNumber.toString().padStart(3, '0')}`;
        } catch (error) {
            console.error("Error generating new supplier ID: ", error);
            throw new Error("Failed to generate a unique supplier ID.");
        }
    };

    const addSupplier = useCallback(async (supplierData) => {
        if (!db || !appId) throw new Error("Database not configured");
        const suppliersCollectionRef = collection(db, 'artifacts', appId, 'suppliers');
        const newId = await getNextSupplierId();
        const newSupplier = {
            ...supplierData,
            displayId: newId,
            createdAt: serverTimestamp(),
        };
        return await addDoc(suppliersCollectionRef, newSupplier);
    }, [db, appId]);

    const updateSupplier = useCallback(async (id, updatedData) => {
        if (!db || !appId) throw new Error("Database not configured");
        const supplierDocRef = doc(db, 'artifacts', appId, 'suppliers', id);
        const updatePayload = {
            ...updatedData,
            updatedAt: serverTimestamp(),
        };
        return await updateDoc(supplierDocRef, updatePayload);
    }, [db, appId]);

    const deleteSupplier = useCallback(async (id) => {
        if (!db || !appId) throw new Error("Database not configured");
        const supplierDocRef = doc(db, 'artifacts', appId, 'suppliers', id);
        return await deleteDoc(supplierDocRef);
    }, [db, appId]);

    const value = {
        suppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        isLoading,
    };

    return (
        <SupplierContext.Provider value={value}>
            {children}
        </SupplierContext.Provider>
    );
};
