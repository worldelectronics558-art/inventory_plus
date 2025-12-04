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
    // writeBatch, // No longer needed for batching, as runTransaction handles atomicity per item
    getDoc,
    runTransaction // Import runTransaction
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
    const { isLoading: isUserContextLoading } = useUser();

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
            // For IN/OUT transactions, update stock at the specific location
            if (tx.type === 'IN' || tx.type === 'OUT') {
                if (tx.sku && tx.location !== undefined && tx.quantityAfter !== undefined) {
                    if (!levels[tx.sku]) levels[tx.sku] = {};
                    levels[tx.sku][tx.location] = tx.quantityAfter;
                }
            } else if (tx.type === 'TRANSFER') {
                // Transfers log two entries internally now: TRANSFER_OUT and TRANSFER_IN
                // Each log entry has its 'location' field specifying where the change occurred.
                if (tx.sku && tx.location !== undefined && tx.quantityAfter !== undefined) {
                    if (!levels[tx.sku]) levels[tx.sku] = {};
                    levels[tx.sku][tx.location] = tx.quantityAfter;
                }
            }
        });
        return levels;
    }, [transactions]);


    // --- 3. REBUILT: Create Granular Transaction Function ---
    const createTransaction = async (txData, firebaseUserId, userNameForLog) => {
        if (!isOnline) {
            throw new Error("Cannot create transaction while offline.");
        }
        if (!txData.type || !firebaseUserId || !Array.isArray(txData.items) || txData.items.length === 0) {
            throw new Error("Invalid transaction data structure or missing user ID.");
        }
    
        const txCollectionRef = getTransactionCollectionRef();
        const timestamp = serverTimestamp(); // Use server timestamp for consistency
        const dateStr = format(new Date(), 'yyyyMMddHHmmss'); // Client-side timestamp for ref number
    
        const userRefPrefix = (userNameForLog && userNameForLog.length > 0) 
            ? userNameForLog.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase().padEnd(5, 'X')
            : 'SYSTM';

        const referenceNumber = `${userRefPrefix}-${txData.type}-${dateStr}`;

        const transactionPromises = txData.items.map(async (item, index) => {
            const { sku, quantity, productName } = item;
            const itemTransactionId = doc(collection(db, 'noop')).id; // Unique ID for each item's operation

            const commonLogData = {
                transactionId: itemTransactionId, // Each item operation gets its own transactionId here
                referenceNumber,
                itemIndex: index + 1,
                timestamp,
                sku,
                quantityChange: quantity,
                userId: firebaseUserId,
                userName: userNameForLog,
                productName: productName || '',
                reason: item.reason || null,
                notes: txData.notes || null,
                documentNumber: txData.documentNumber || null,
            };

            try {
                await runTransaction(db, async (firestoreTransaction) => {
                    if (txData.type === 'IN') {
                        const { location } = item;
                        if (!sku || !location || !quantity) throw new Error('Invalid Stock-In item data.');
        
                        const invDocRef = getInventoryDocRef(sku, location);
                        const invDoc = await firestoreTransaction.get(invDocRef);
                        const quantityBefore = invDoc.exists() ? invDoc.data().quantity || 0 : 0;
                        const quantityAfter = quantityBefore + quantity;
        
                        firestoreTransaction.set(invDocRef, { sku, location, quantity: quantityAfter, lastUpdated: timestamp });
                        firestoreTransaction.set(doc(txCollectionRef), {
                            ...commonLogData,
                            type: 'IN', // Log type for display
                            quantityBefore,
                            quantityAfter,
                            location, // Specific location for IN
                            fromLocation: null,
                            toLocation: null,
                        });
        
                    } else if (txData.type === 'OUT') {
                        const { location } = item;
                        if (!sku || !location || !quantity) throw new Error('Invalid Stock-Out item data.');
        
                        const invDocRef = getInventoryDocRef(sku, location);
                        const invDoc = await firestoreTransaction.get(invDocRef);
                        const quantityBefore = invDoc.exists() ? invDoc.data().quantity || 0 : 0;
        
                        if (quantityBefore < quantity) {
                            throw new Error(`Insufficient stock for ${sku} at ${location}. Available: ${quantityBefore}, Requested: ${quantity}`);
                        }
                        const quantityAfter = quantityBefore - quantity;
        
                        firestoreTransaction.set(invDocRef, { sku, location, quantity: quantityAfter, lastUpdated: timestamp });
                        firestoreTransaction.set(doc(txCollectionRef), {
                            ...commonLogData,
                            type: 'OUT', // Log type for display
                            quantityBefore,
                            quantityAfter,
                            location, // Specific location for OUT
                            fromLocation: null,
                            toLocation: null,
                        });
        
                    } else if (txData.type === 'TRANSFER') {
                        const { fromLocation, toLocation } = item;
                        if (!sku || !fromLocation || !toLocation || !quantity) throw new Error('Invalid Transfer item data.');
        
                        // Read both documents within the same transaction
                        const fromDocRef = getInventoryDocRef(sku, fromLocation);
                        const toDocRef = getInventoryDocRef(sku, toLocation);
        
                        const fromDoc = await firestoreTransaction.get(fromDocRef);
                        const toDoc = await firestoreTransaction.get(toDocRef);
        
                        const fromQtyBefore = fromDoc.exists() ? fromDoc.data().quantity || 0 : 0;
                        if (fromQtyBefore < quantity) {
                            throw new Error(`Insufficient stock for ${sku} at ${fromLocation}. Available: ${fromQtyBefore}, Requested: ${quantity}`);
                        }
                        const fromQtyAfter = fromQtyBefore - quantity;
        
                        const toQtyBefore = toDoc.exists() ? toDoc.data().quantity || 0 : 0;
                        const toQtyAfter = toQtyBefore + quantity;
        
                        // Update both documents within the same transaction
                        firestoreTransaction.set(fromDocRef, { sku, location: fromLocation, quantity: fromQtyAfter, lastUpdated: timestamp });
                        firestoreTransaction.set(toDocRef, { sku, location: toLocation, quantity: toQtyAfter, lastUpdated: timestamp });
        
                        // Log for "OUT" part of the transfer
                        firestoreTransaction.set(doc(txCollectionRef), {
                            ...commonLogData,
                            type: 'TRANSFER', // Log as TRANSFER
                            quantityBefore: fromQtyBefore,
                            quantityAfter: fromQtyAfter,
                            location: fromLocation, // Log the specific location for this leg (OUT)
                            fromLocation,
                            toLocation,
                        });
        
                        // Log for "IN" part of the transfer
                        firestoreTransaction.set(doc(txCollectionRef), {
                            ...commonLogData,
                            type: 'TRANSFER', // Log as TRANSFER
                            quantityBefore: toQtyBefore,
                            quantityAfter: toQtyAfter,
                            location: toLocation, // Log the specific location for this leg (IN)
                            fromLocation,
                            toLocation,
                        });
                    }
                }); // End of runTransaction for an item
            } catch (error) {
                if (error.message.includes('Insufficient stock')) {
                    console.warn(`Transaction failed for item ${sku} due to: ${error.message}`);
                    throw error; // Re-throw to propagate the specific error up
                } else {
                    console.error("Firestore transaction failed unexpectedly:", error);
                    throw new Error(`Error processing item ${sku}: ${error.message}`); // Wrap and re-throw
                }
            }
        }); // End of map over txData.items
    
        await Promise.all(transactionPromises);
        console.log(`All items for transaction ${referenceNumber} committed with granular logs.`);
        return referenceNumber; // Return the overall reference number
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
