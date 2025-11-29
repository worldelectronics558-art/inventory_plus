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
    getDoc
} from 'firebase/firestore';
import { format } from 'date-fns';

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
    const { appId, userId, authReady, db, isOnline } = useAuth();
    const { isLoading: isUserContextLoading, user: currentUser } = useUser();

    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- UTILITY FUNCTIONS ---
    const getTransactionCollectionRef = useCallback(() => {
        if (!appId || !db) {
            throw new Error("Database or Application context is not ready.");
        }
        return collection(db, `/artifacts/${appId}/inventoryTransactions`);
    }, [appId, db]);

    const getInventoryDocRef = useCallback((sku, location) => {
        if (!appId || !db || !sku || !location) {
            throw new Error("Missing required arguments for inventory doc ref.");
        }
        return doc(db, `/artifacts/${appId}/inventory/${sku}@${location}`);
    }, [appId, db]);

    // New helper to generate the user reference for the transaction ID
    const generateUserRef = (user) => {
        if (!user || !user.firstName) return 'SYSTM'; // System default if no user
        return user.firstName.substring(0, 5).toUpperCase().padEnd(5, 'X');
    };

    // --- DATA LOADING ---
    useEffect(() => {
        if (!authReady || !userId || !appId || !db || isUserContextLoading) return;

        let unsubscribe = () => {};
        setIsLoading(true);

        if (isOnline) {
            try {
                const colRef = getTransactionCollectionRef();
                const q = query(colRef);

                unsubscribe = onSnapshot(q, async (snapshot) => {
                    const transactionList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setTransactions(transactionList);
                    await inventoryStore.setItem(INVENTORY_STORE_NAME, transactionList);
                    setIsLoading(false);
                    console.log(`InventoryContext ONLINE: ${transactionList.length} granular transactions loaded and cached.`);
                }, (error) => {
                    console.error("Error fetching granular transactions:", error);
                    setIsLoading(false);
                });
            } catch (error) {
                console.error("Failed to set up granular transaction listener:", error.message);
                setIsLoading(false);
            }
        } else {
            inventoryStore.getItem(INVENTORY_STORE_NAME).then(cachedTxs => {
                setTransactions(cachedTxs || []);
                console.log(`InventoryContext OFFLINE: Loaded ${cachedTxs?.length || 0} transactions from cache.`);
                setIsLoading(false);
            }).catch(error => {
                console.error("Error loading offline inventory cache:", error);
                setIsLoading(false);
            });
        }

        return () => unsubscribe();
    }, [appId, userId, authReady, db, isOnline, isUserContextLoading, getTransactionCollectionRef]);

    // --- STOCK LEVEL AGGREGATION ---
    const stockLevels = useMemo(() => {
        const levels = {};
        // The logic now directly uses quantityAfter for simplicity and accuracy
        // This requires sorting transactions by timestamp to get the latest state.
        const sortedTransactions = [...transactions].sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : 0;
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : 0;
            return dateA - dateB;
        });

        sortedTransactions.forEach(tx => {
            if (!tx.sku || !tx.quantityAfter === undefined) return; // Skip invalid logs

            if(tx.type === 'TRANSFER') {
                if(tx.fromLocation) {
                    if (!levels[tx.sku]) levels[tx.sku] = {};
                    levels[tx.sku][tx.fromLocation] = tx.quantityAfter;
                }
                if(tx.toLocation) {
                    if (!levels[tx.sku]) levels[tx.sku] = {};
                    levels[tx.sku][tx.toLocation] = tx.quantityAfter; // This might need refinement based on how `quantityAfter` is defined for transfers
                }
            } else if (tx.location) {
                 if (!levels[tx.sku]) levels[tx.sku] = {};
                 levels[tx.sku][tx.location] = tx.quantityAfter;
            }
        });

        return levels;
    }, [transactions]);


    // --- 3. REBUILT: Create Granular Transaction Function ---
    const createTransaction = async (txData) => {
        if (!isOnline) {
            throw new Error("Cannot create transaction while offline.");
        }
        if (!txData.type || !currentUser || !Array.isArray(txData.items) || txData.items.length === 0) {
            throw new Error("Invalid transaction data structure.");
        }

        const batch = writeBatch(db);
        const txCollectionRef = getTransactionCollectionRef();
        const timestamp = serverTimestamp();

        // 1. Generate IDs for the whole operation
        const transactionId = doc(collection(db, 'noop')).id; // Firestore way to get a unique ID
        const userRef = generateUserRef(currentUser);
        const dateStr = format(new Date(), 'yyyyMMddHHmmss');
        const referenceNumber = `${userRef}-${txData.type}-${dateStr}`;

        try {
            // Use a for...of loop to handle async operations correctly
            for (const [index, item] of txData.items.entries()) {
                const newLogRef = doc(txCollectionRef);

                if (txData.type === 'IN') {
                    const { sku, location, quantity, productName } = item;
                    if (!sku || !location || !quantity) throw new Error('Invalid Stock-In item data.');

                    const invDocRef = getInventoryDocRef(sku, location);
                    const invDoc = await getDoc(invDocRef);
                    const quantityBefore = invDoc.exists() ? invDoc.data().quantity || 0 : 0;
                    const quantityAfter = quantityBefore + quantity;

                    // Update inventory document
                    batch.set(invDocRef, { sku, location, quantity: quantityAfter, lastUpdated: timestamp });

                    // Create granular log document
                    batch.set(newLogRef, {
                        transactionId, referenceNumber, itemIndex: index + 1, type: 'IN', timestamp, sku,
                        quantityChange: quantity, quantityBefore, quantityAfter, location,
                        fromLocation: null, toLocation: null,
                        userId: currentUser.uid, userName: currentUser.displayName,
                        productName: productName || '', // Denormalized for history
                        reason: item.reason || null, notes: txData.notes || null, documentNumber: txData.referenceNumber || null
                    });
                } else if (txData.type === 'OUT') {
                    const { sku, location, quantity, productName } = item;
                    if (!sku || !location || !quantity) throw new Error('Invalid Stock-Out item data.');

                    const invDocRef = getInventoryDocRef(sku, location);
                    const invDoc = await getDoc(invDocRef);
                    const quantityBefore = invDoc.exists() ? invDoc.data().quantity || 0 : 0;

                    if (quantityBefore < quantity) {
                        throw new Error(`Insufficient stock for ${sku} at ${location}.`);
                    }
                    const quantityAfter = quantityBefore - quantity;

                    batch.set(invDocRef, { sku, location, quantity: quantityAfter, lastUpdated: timestamp });

                    batch.set(newLogRef, {
                        transactionId, referenceNumber, itemIndex: index + 1, type: 'OUT', timestamp, sku,
                        quantityChange: quantity, quantityBefore, quantityAfter, location,
                        fromLocation: null, toLocation: null,
                        userId: currentUser.uid, userName: currentUser.displayName,
                        productName: productName || '', 
                        reason: item.reason || null, notes: txData.notes || null, documentNumber: txData.referenceNumber || null
                    });

                } else if (txData.type === 'TRANSFER') {
                    const { sku, fromLocation, toLocation, quantity, productName } = item;
                    if (!sku || !fromLocation || !toLocation || !quantity) throw new Error('Invalid Transfer item data.');
                    
                     // FROM Location Handling
                    const fromDocRef = getInventoryDocRef(sku, fromLocation);
                    const fromDoc = await getDoc(fromDocRef);
                    const fromQtyBefore = fromDoc.exists() ? fromDoc.data().quantity : 0;
                    if (fromQtyBefore < quantity) throw new Error(`Insufficient stock for ${sku} at ${fromLocation}.`);
                    const fromQtyAfter = fromQtyBefore - quantity;
                    batch.set(fromDocRef, { sku, location: fromLocation, quantity: fromQtyAfter, lastUpdated: timestamp });

                    // TO Location Handling
                    const toDocRef = getInventoryDocRef(sku, toLocation);
                    const toDoc = await getDoc(toDocRef);
                    const toQtyBefore = toDoc.exists() ? toDoc.data().quantity : 0;
                    const toQtyAfter = toQtyBefore + quantity;
                    batch.set(toDocRef, { sku, location: toLocation, quantity: toQtyAfter, lastUpdated: timestamp });

                    // Create TWO log entries for a transfer
                    const transferLogRefOut = doc(txCollectionRef);
                    const transferLogRefInt = doc(txCollectionRef);

                    batch.set(transferLogRefOut, { // Log for the "OUT" part of the transfer
                        transactionId, referenceNumber, itemIndex: index + 1, type: 'TRANSFER', timestamp, sku, 
                        quantityChange: quantity, quantityBefore: fromQtyBefore, quantityAfter: fromQtyAfter,
                        location: null, fromLocation, toLocation, userId: currentUser.uid, userName: currentUser.displayName,
                        productName: productName || '', reason: item.reason || null, notes: txData.notes || null, documentNumber: txData.referenceNumber || null
                    });
                     batch.set(transferLogRefInt, { // Log for the "IN" part of the transfer
                        transactionId, referenceNumber, itemIndex: index + 1, type: 'TRANSFER', timestamp, sku, 
                        quantityChange: quantity, quantityBefore: toQtyBefore, quantityAfter: toQtyAfter,
                        location: null, fromLocation, toLocation, userId: currentUser.uid, userName: currentUser.displayName,
                        productName: productName || '', reason: item.reason || null, notes: txData.notes || null, documentNumber: txData.referenceNumber || null
                    });
                }
            }

            await batch.commit();
            console.log(`Transaction ${referenceNumber} committed with granular logs.`);
            return referenceNumber;

        } catch (error) {
            console.error("Error creating granular transaction:", error);
            throw error; // Re-throw to be caught by the UI
        }
    };


    const contextValue = {
        transactions,
        stockLevels,
        isLoading,
        isOnline,
        createTransaction,
    };

    return (
        <InventoryContext.Provider value={contextValue}>
            {children}
        </InventoryContext.Provider>
    );
};