
// src/contexts/InventoryContext.jsx

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import localforage from 'localforage';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const ITEMS_STORE_NAME = 'inventoryItemsCache';
const inventoryItemsStore = localforage.createInstance({ name: "inventoryApp", storeName: ITEMS_STORE_NAME });

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
    const { appId, db, authReady, isOnline } = useAuth();
    const [inventoryItems, setInventoryItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const getInventoryItemsCollectionRef = useCallback(() => {
        if (!appId || !db) return null;
        return collection(db, `artifacts/${appId}/inventory_items`);
    }, [appId, db]);

    useEffect(() => {
        if (!authReady || !appId || !db) return;
        
        setIsLoading(true);

        const loadFromCache = async () => {
            try {
                const cachedItems = await inventoryItemsStore.getItem(ITEMS_STORE_NAME);
                if (cachedItems) {
                    setInventoryItems(cachedItems);
                }
            } catch (error) {
                console.error("Error loading inventory from cache:", error);
            }
        };

        if (!isOnline) {
            loadFromCache().finally(() => setIsLoading(false));
            return;
        }

        const colRef = getInventoryItemsCollectionRef();
        if (!colRef) return; // Don't proceed if the collection ref is not available

        const unsubscribe = onSnapshot(colRef, async (snapshot) => {
            const itemsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInventoryItems(itemsList);
            await inventoryItemsStore.setItem(ITEMS_STORE_NAME, itemsList);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching inventory items:", error);
            loadFromCache().finally(() => setIsLoading(false));
        });

        return () => unsubscribe();
    }, [appId, authReady, db, isOnline, getInventoryItemsCollectionRef]);

    // --- REFACTORED stockLevels LOGIC ---
    const stockLevels = useMemo(() => {
        const levels = {};
        // The new `inventory_items` collection is flat. We need to aggregate it.
        // An item in this collection IS in stock. There is no status field.
        inventoryItems.forEach(item => {
            const { sku, locationId, isSerialized, quantity } = item;

            if (!sku || !locationId) return; // Skip items without essential data

            if (!levels[sku]) {
                levels[sku] = {};
            }
            if (!levels[sku][locationId]) {
                levels[sku][locationId] = 0;
            }

            // For serialized items, each document is one unit.
            // For non-serialized items, the document contains a quantity.
            const amountToAdd = isSerialized ? 1 : (quantity || 0);
            levels[sku][locationId] += amountToAdd;
        });
        return levels;
    }, [inventoryItems]);

    const contextValue = {
        inventoryItems, // The raw, un-aggregated list of items
        stockLevels,    // The aggregated stock counts for display
        isLoading,
        isOnline,
    };

    return (
        <InventoryContext.Provider value={contextValue}>
            {children}
        </InventoryContext.Provider>
    );
};
