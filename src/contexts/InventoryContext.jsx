
// src/contexts/InventoryContext.jsx

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import localforage from 'localforage';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext.jsx';
import { useSync } from './SyncContext.jsx';
import { handleStockOut, handleTransfer, handleFinalizePurchaseBatch } from '../firebase/inventory_services.js';

const ITEMS_STORE_NAME = 'inventoryItemsCache';
const inventoryItemsStore = localforage.createInstance({ name: "inventoryApp", storeName: ITEMS_STORE_NAME });

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
    const { appId, userId, authReady, db, isOnline } = useAuth();
    const { user, isLoading: isUserContextLoading } = useUser();
    const { addToQueue } = useSync();

    const [inventoryItems, setInventoryItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const getInventoryItemsCollectionRef = useCallback(() => {
        if (!appId || !db) throw new Error("Database context is not ready.");
        return collection(db, `/artifacts/${appId}/inventory_items`);
    }, [appId, db]);

    useEffect(() => {
        if (!authReady || !userId || !appId || !db || isUserContextLoading) return;
        setIsLoading(true);

        const loadFromCache = async () => {
            try {
                const cachedItems = await inventoryItemsStore.getItem(ITEMS_STORE_NAME);
                if (cachedItems) setInventoryItems(cachedItems);
            } catch (error) {
                console.error("Error loading inventory from cache:", error);
            }
        };

        if (!isOnline) {
            loadFromCache().finally(() => setIsLoading(false));
            return;
        }

        const colRef = getInventoryItemsCollectionRef();
        const q = query(colRef);

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const itemsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInventoryItems(itemsList);
            await inventoryItemsStore.setItem(ITEMS_STORE_NAME, itemsList);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching inventory items:", error);
            loadFromCache().finally(() => setIsLoading(false));
        });

        return () => unsubscribe();
    }, [appId, userId, authReady, db, isOnline, isUserContextLoading, getInventoryItemsCollectionRef]);

    const stockLevels = useMemo(() => {
        const levels = {};
        inventoryItems.forEach(item => {
            if (item.status === 'in_stock') {
                if (!levels[item.sku]) levels[item.sku] = {};
                if (!levels[item.sku][item.location]) levels[item.sku][item.location] = 0;
                levels[item.sku][item.location]++;
            }
        });
        return levels;
    }, [inventoryItems]);

    const stockOut = async (operationData) => {
        if (!isOnline) {
            return addToQueue({ type: 'STOCK_OUT', payload: { operationData, userId, user } });
        } else {
            return handleStockOut(db, appId, userId, user, operationData);
        }
    };
    
    const transfer = async (operationData) => {
        if (!isOnline) {
            return addToQueue({ type: 'TRANSFER', payload: { operationData, userId, user } });
        } else {
            return handleTransfer(db, appId, userId, user, operationData);
        }
    };

    const addBatchToInventory = async (items, purchaseInvoiceId, supplierId) => {
        if (!isOnline) {
            throw new Error("Finalizing a purchase can only be done online.");
        }
        // We pass the full user object to the service
        return handleFinalizePurchaseBatch(db, appId, userId, user, items, purchaseInvoiceId, supplierId);
    };

    const contextValue = {
        inventoryItems,
        stockLevels,
        isLoading,
        isOnline,
        stockOut,
        transfer,
        addBatchToInventory,
    };

    return (
        <InventoryContext.Provider value={contextValue}>
            {children}
        </InventoryContext.Provider>
    );
};
