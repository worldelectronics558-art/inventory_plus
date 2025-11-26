// src/contexts/InventoryContext.jsx

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import localforage from 'localforage'; // For offline caching
import {
    collection,
    query,
    onSnapshot,
    doc,
    setDoc,
    serverTimestamp,
    writeBatch,
    getDoc // NEW: Import getDoc to fetch a single document
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
    const { appId, userId, authReady, db, isOnline } = useAuth();
    const { isLoading: isUserContextLoading, user: currentUser } = useUser(); // Get currentUser object

    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Utility function to get the correct collection reference path
    const getTransactionCollectionRef = useCallback(() => {
        if (!appId || !userId || !db) {
            throw new Error("Database or Authentication context is not ready. Cannot access transactions.");
        }
        // Use a path that makes sense for inventory transactions, e.g., per user or per org
        // Assuming a structure like: /organizations/{orgId}/inventoryTransactions/{userId}
        // For now, using a simplified path based on appId and userId as per your original code
        const path = `/artifacts/${appId}/users/${userId}/inventoryTransactions`; // Changed path name for clarity
        return collection(db, path);
    }, [appId, userId, db]);

    const getInventoryDocRef = useCallback((sku, location) => {
        if (!appId || !userId || !db || !sku || !location) {
            throw new Error("Database, Auth, SKU, or Location is missing. Cannot create inventory doc ref.");
        }
        // Assuming inventory is stored per org, per SKU, per location
        // Path: /organizations/{orgId}/inventory/{sku}@{location}
        // For now, using a simplified path based on appId
        const path = `/artifacts/${appId}/inventory/${sku}@${location}`;
        return doc(db, path);
    }, [appId, userId, db]); // appId and userId are constant, db is available


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
                    console.error("Error fetching inventory transactions in ONLINE mode:", error);
                    setIsLoading(false);
                });
            } catch (error) {
                console.error("Failed to set up ONLINE inventory transaction listener:", error.message);
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

    // --- 2. Stock Level Aggregation (Computed Value) ---
    // This useMemo recalculates stockLevels whenever transactions change.
    const stockLevels = useMemo(() => {
        const levels = {};
        transactions.forEach(tx => {
            // tx structure from page: { type, location, items: [{sku, quantity, reason}], userId, timestamp }
            // For TRANSFER: { type, fromLocation, toLocation, items: [{sku, quantity}], userId, timestamp }
            // NEW: tx structure from new forms: { type, referenceNumber, transactionDate, notes, documentNumber, items: [{sku, location, quantity, reason}], userId, timestamp }
            if (tx.type === 'IN' && tx.items) {
                tx.items.forEach(item => {
                    if (!item.location) return; // Skip items without a location
                    if (!levels[item.sku]) levels[item.sku] = {};
                    levels[item.sku][item.location] = (levels[item.sku][item.location] || 0) + item.quantity;
                });
            } else if (tx.type === 'OUT' && tx.items) {
                tx.items.forEach(item => {
                    if (!item.location) return; // Skip items without a location
                    if (!levels[item.sku]) levels[item.sku] = {};
                    levels[item.sku][item.location] = (levels[item.sku][item.location] || 0) - item.quantity;
                });
            } else if (tx.type === 'TRANSFER' && tx.items) {
                tx.items.forEach(item => {
                    if (!item.fromLocation || !item.toLocation) return; // Skip invalid transfer items
                    // Deduct from 'from' location
                    if (!levels[item.sku]) levels[item.sku] = {};
                    levels[item.sku][item.fromLocation] = (levels[item.sku][item.fromLocation] || 0) - item.quantity;
                    // Add to 'to' location
                    levels[item.sku][item.toLocation] = (levels[item.sku][item.toLocation] || 0) + item.quantity;
                });
            }
        });
        return levels;
    }, [transactions]);

    // --- 3. CRUD: Create Transaction Function (Gated & Complex & Updated for new structure & getDoc) ---
    const createTransaction = async (txData) => {
        // ENFORCE ONLINE CHECK
        if (!isOnline) {
            const message = "Cannot create transaction while offline. Please go Online first.";
            alert(message);
            throw new Error(message);
        }

        // Validate basic structure - ensure items array exists and has content
        if (!txData.type || !txData.userId || !Array.isArray(txData.items) || txData.items.length === 0) {
            throw new Error("Invalid transaction data structure: Missing type, userId, or items array.");
        }

        // Get current stock levels for validation (if needed, e.g., for OUT/TRANSFER)
        const currentStockLevels = stockLevels; // Use the memoized value

        try {
            const batch = writeBatch(db); // Use batch for atomicity

            // Add the transaction document itself
            const txCollectionRef = getTransactionCollectionRef();
            const newTxRef = doc(txCollectionRef); // Firestore generates a unique ID

            // Prepare transaction data to be stored
            const transactionToStore = {
                ...txData,
                timestamp: serverTimestamp(), // Overwrite client timestamp with server time
                // userId is already passed from the page and included in txData
            };

            batch.set(newTxRef, transactionToStore);

            // --- Process Items based on transaction type ---
            if (txData.type === 'IN') {
                // Validate items for Stock In: each must have sku, location, quantity
                for (const item of txData.items) {
                    if (!item.sku || !item.location || !item.quantity || item.quantity <= 0) {
                         throw new Error(`Invalid item for Stock In: Missing SKU, Location, or Quantity (must be > 0). Item: ${JSON.stringify(item)}`);
                    }
                    const inventoryDocRef = getInventoryDocRef(item.sku, item.location); // Use item.location
                    // Get current inventory doc using getDoc
                    const inventoryDoc = await getDoc(inventoryDocRef); // <--- Changed from inventoryDocRef.get() to getDoc(inventoryDocRef)
                    const currentQuantity = inventoryDoc.exists() ? inventoryDoc.data().quantity || 0 : 0;
                    // Update quantity
                    batch.set(inventoryDocRef, {
                        sku: item.sku,
                        location: item.location, // Use item.location
                        quantity: currentQuantity + item.quantity,
                        lastUpdated: serverTimestamp(),
                        // Potentially store other info like last transaction ID
                    });
                }
            } else if (txData.type === 'OUT') {
                // Validate items for Stock Out: each must have sku, location, quantity
                 for (const item of txData.items) {
                    if (!item.sku || !item.location || !item.quantity || item.quantity <= 0) {
                         throw new Error(`Invalid item for Stock Out: Missing SKU, Location, or Quantity (must be > 0). Item: ${JSON.stringify(item)}`);
                    }
                    const inventoryDocRef = getInventoryDocRef(item.sku, item.location); // Use item.location
                    // Get current inventory doc using getDoc
                    const inventoryDoc = await getDoc(inventoryDocRef); // <--- Changed from inventoryDocRef.get() to getDoc(inventoryDocRef)
                    const currentQuantity = inventoryDoc.exists() ? inventoryDoc.data().quantity || 0 : 0;

                    if (currentQuantity < item.quantity) {
                        throw new Error(`Insufficient stock for SKU ${item.sku} at location ${item.location}. Requested: ${item.quantity}, Available: ${currentQuantity}`);
                    }

                    batch.set(inventoryDocRef, {
                        sku: item.sku,
                        location: item.location, // Use item.location
                        quantity: currentQuantity - item.quantity,
                        lastUpdated: serverTimestamp(),
                    });
                }
            } else if (txData.type === 'TRANSFER') {
                // Validate items for Transfer: each must have sku, fromLocation, toLocation, quantity
                for (const item of txData.items) {
                    if (!item.sku || !item.fromLocation || !item.toLocation || !item.quantity || item.quantity <= 0) {
                         throw new Error(`Invalid item for Transfer: Missing SKU, From Location, To Location, or Quantity (must be > 0). Item: ${JSON.stringify(item)}`);
                    }
                    if (item.fromLocation === item.toLocation) {
                        throw new Error(`Transfer item error: From and To locations cannot be the same for SKU ${item.sku}.`);
                    }

                    // Deduct from 'from' location
                    const fromInventoryDocRef = getInventoryDocRef(item.sku, item.fromLocation); // Use item.fromLocation
                    // Get current inventory doc using getDoc
                    const fromInventoryDoc = await getDoc(fromInventoryDocRef); // <--- Changed from fromInventoryDocRef.get() to getDoc(fromInventoryDocRef)
                    const fromCurrentQuantity = fromInventoryDoc.exists() ? fromInventoryDoc.data().quantity || 0 : 0;

                    if (fromCurrentQuantity < item.quantity) {
                        throw new Error(`Insufficient stock for SKU ${item.sku} at 'From' location ${item.fromLocation}. Requested: ${item.quantity}, Available: ${fromCurrentQuantity}`);
                    }

                    batch.set(fromInventoryDocRef, {
                        sku: item.sku,
                        location: item.fromLocation, // Use item.fromLocation
                        quantity: fromCurrentQuantity - item.quantity,
                        lastUpdated: serverTimestamp(),
                    });

                    // Add to 'to' location
                    const toInventoryDocRef = getInventoryDocRef(item.sku, item.toLocation); // Use item.toLocation
                    // Get current inventory doc using getDoc
                    const toInventoryDoc = await getDoc(toInventoryDocRef); // <--- Changed from toInventoryDocRef.get() to getDoc(toInventoryDocRef)
                    const toCurrentQuantity = toInventoryDoc.exists() ? toInventoryDoc.data().quantity || 0 : 0;

                    batch.set(toInventoryDocRef, {
                        sku: item.sku,
                        location: item.toLocation, // Use item.toLocation
                        quantity: toCurrentQuantity + item.quantity,
                        lastUpdated: serverTimestamp(),
                    });
                }
            } else {
                throw new Error(`Unsupported transaction type: ${txData.type}`);
            }

            // Commit the batch
            await batch.commit();
            console.log(`Transaction ${txData.type} committed successfully.`);
            // The onSnapshot listener in useEffect will automatically update the 'transactions' state
            return newTxRef.id; // Return the new transaction ID if needed

        } catch (error) {
            console.error("Error creating transaction:", error);
            throw error; // Re-throw to be handled by the calling page
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