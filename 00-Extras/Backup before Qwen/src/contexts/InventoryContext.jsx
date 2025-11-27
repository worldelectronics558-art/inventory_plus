// src/contexts/InventoryContext.jsx

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import localforage from 'localforage'; // NEW: For offline caching
import { 
    collection, 
    query, 
    onSnapshot, 
    doc, 
    setDoc, 
    serverTimestamp 
} from 'firebase/firestore';

import { useAuth } from './AuthContext';
import { useUser } from './UserContext.jsx'; 

// --- LocalForage Store Setup ---
const INVENTORY_STORE_NAME = 'inventoryCache'; 
const inventoryStore = localforage.createInstance({
    name: "inventoryApp",
    storeName: INVENTORY_STORE_NAME,
});

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
    // GET db INSTANCE AND isOnline FROM useAuth
    const { appId, userId, authReady, db, isOnline } = useAuth(); // <--- isOnline added
    const { isLoading: isUserContextLoading } = useUser();
    
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Utility function to get the correct collection reference path
    const getTransactionCollectionRef = useCallback(() => { // Made useCallback
        if (!appId || !userId || !db) {
            throw new Error("Database or Authentication context is not ready. Cannot access transactions.");
        }
        const path = `/artifacts/${appId}/users/${userId}/transactions`;
        return collection(db, path);
    }, [appId, userId, db]); // Added dependencies

    // --- 1. Data Loading: Cache vs. Live Listener ---
    useEffect(() => {
        if (!authReady || !userId || !appId || !db || isUserContextLoading) {
            return;
        }

        let unsubscribe = () => {};
        setIsLoading(true);

        if (isOnline) {
            // A. ONLINE MODE: Set up live listener and cache update
            try {
                const colRef = getTransactionCollectionRef();
                const q = query(colRef);

                unsubscribe = onSnapshot(q, async (snapshot) => {
                    const transactionList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setTransactions(transactionList);
                    await inventoryStore.setItem(INVENTORY_STORE_NAME, transactionList); // Update cache
                    setIsLoading(false); 
                    console.log(`InventoryContext ONLINE: ${transactionList.length} transactions loaded and cached.`);
                }, (error) => {
                    console.error("Error fetching transactions in ONLINE mode:", error);
                    setIsLoading(false);
                });
            } catch (error) {
                console.error("Failed to set up ONLINE transaction listener:", error.message);
                setIsLoading(false);
            }
        } else {
            // B. OFFLINE MODE: Load from cache only
            inventoryStore.getItem(INVENTORY_STORE_NAME).then(cachedTxs => {
                setTransactions(cachedTxs || []);
                console.log(`InventoryContext OFFLINE: Loaded ${cachedTxs?.length || 0} transactions from cache.`);
                setIsLoading(false);
            }).catch(error => {
                console.error("Error loading offline inventory cache:", error);
                setIsLoading(false);
            });
        }

        return () => unsubscribe(); // Cleanup listener when isOnline changes or unmounts
    }, [appId, userId, authReady, db, isOnline, isUserContextLoading, getTransactionCollectionRef]); 

    // --- 2. Stock Level Aggregation (Computed Value) --- (No change needed)
    const stockLevels = useMemo(() => {
        const levels = {};
        // ... (logic remains the same)
        transactions.forEach(tx => {
            if (!tx.productId) return; 
            if (!levels[tx.productId]) {
                levels[tx.productId] = {};
            }
            
            if (tx.type === 'IN' && tx.locationId) {
                levels[tx.productId][tx.locationId] = (levels[tx.productId][tx.locationId] || 0) + tx.quantity;
            } else if (tx.type === 'OUT' && tx.locationId) {
                levels[tx.productId][tx.locationId] = (levels[tx.productId][tx.locationId] || 0) - tx.quantity;
            } else if (tx.type === 'TRANSFER' && tx.locationId && tx.destinationLocationId) {
                levels[tx.productId][tx.locationId] = (levels[tx.productId][tx.locationId] || 0) - tx.quantity; 
                levels[tx.productId][tx.destinationLocationId] = (levels[tx.productId][tx.destinationLocationId] || 0) + tx.quantity;
            }
        });
        return levels;
    }, [transactions]);


    // --- 3. CRUD: Create Transaction Function (Gated) ---
    const createTransaction = async (txData) => {
        // ENFORCE ONLINE CHECK
        if (!isOnline) {
             const message = "Cannot create transaction while offline. Please go Online first.";
             alert(message);
             throw new Error(message);
        }

        try {
            const colRef = getTransactionCollectionRef(); 
            const newTxRef = doc(colRef);

            await setDoc(newTxRef, {
                ...txData,
                timestamp: serverTimestamp(),
                userId: userId, 
            });
            return newTxRef.id;
        } catch (error) {
            console.error("Error creating transaction:", error);
            throw error;
        }
    };

    const contextValue = {
        transactions,
        stockLevels,
        isLoading,
        isOnline, // Expose isOnline status (useful for UI)
        createTransaction,
    };

    return (
        <InventoryContext.Provider value={contextValue}>
            {children}
        </InventoryContext.Provider>
    );
};