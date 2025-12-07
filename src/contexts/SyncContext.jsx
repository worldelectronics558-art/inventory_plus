
// src/contexts/SyncContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage';
import { useAuth } from './AuthContext';
import { useLoading } from './LoadingContext';
import { handleStockOut, handleTransfer } from '../firebase/inventory_services.js';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

const PENDING_WRITES_KEY = 'pendingWritesQueue';

export const SyncProvider = ({ children }) => {
    const { db, appId, isOnline } = useAuth();
    const { setAppProcessing } = useLoading();
    const [pendingWrites, setPendingWrites] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Load queue from localforage on initial app load
    useEffect(() => {
        const loadQueue = async () => {
            try {
                const savedQueue = await localforage.getItem(PENDING_WRITES_KEY);
                if (savedQueue && Array.isArray(savedQueue)) {
                    setPendingWrites(savedQueue);
                }
            } catch (error) {
                console.error("Failed to load pending writes from localforage:", error);
            }
        };
        loadQueue();
    }, []);

    // Effect to trigger sync process when the app comes online
    useEffect(() => {
        if (isOnline && pendingWrites.length > 0 && !isSyncing) {
            processQueue();
        }
    }, [isOnline, pendingWrites.length, isSyncing]);

    const addToQueue = async (action) => {
        console.log('Offline: Queuing action', action);
        const newQueue = [...pendingWrites, { ...action, id: `action_${Date.now()}_${Math.random()}` }];
        setPendingWrites(newQueue);
        await localforage.setItem(PENDING_WRITES_KEY, newQueue);
    };

    const processQueue = async () => {
        if (isSyncing || !isOnline || pendingWrites.length === 0 || !db || !appId) {
            return;
        }

        setIsSyncing(true);
        setAppProcessing(true, `Syncing ${pendingWrites.length} offline change(s)...`);

        let remainingActions = [...pendingWrites];
        console.log(`Starting synchronization for ${remainingActions.length} item(s)...`);

        for (const action of pendingWrites) {
            try {
                console.log(`SYNCING: Processing action ${action.id} of type ${action.type}`);
                
                const { operationData, userId, user } = action.payload;

                switch (action.type) {
                    case 'STOCK_OUT':
                        await handleStockOut(db, appId, userId, user, operationData);
                        break;
                    case 'TRANSFER':
                        await handleTransfer(db, appId, userId, user, operationData);
                        break;
                    default:
                        console.warn(`Unknown action type in sync queue: ${action.type}`);
                        break;
                }

                remainingActions = remainingActions.filter(item => item.id !== action.id);
                
            } catch (error) { 
                console.error(`SYNC FAILED for action ${action.id}:`, error);
                setAppProcessing(false, `Sync failed: ${error.message}. Please check console.`);
                break; 
            }
        }
        
        const successfullySyncedCount = pendingWrites.length - remainingActions.length;

        setPendingWrites(remainingActions);
        await localforage.setItem(PENDING_WRITES_KEY, remainingActions);

        setIsSyncing(false);
        if (successfullySyncedCount > 0) {
            setAppProcessing(false, `Successfully synced ${successfullySyncedCount} item(s).`);
        } else {
             setAppProcessing(false);
        }
       
        console.log('Synchronization finished.');

        if (successfullySyncedCount > 0) {
            console.log(`${successfullySyncedCount} item(s) synced. Reloading to refresh data.`);
            setTimeout(() => window.location.reload(), 1500);
        }
    };

    const value = {
        pendingWrites,
        addToQueue,
        isSyncing,
        queueCount: pendingWrites.length,
    };

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    );
};
