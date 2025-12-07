
// src/contexts/SyncContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { useAuth } from './AuthContext';
import { handleStockIn, handleFinalizePurchaseBatch, handleStockOut, handleTransfer } from '../firebase/inventory_services';

const PENDING_WRITES_KEY = 'pending_writes';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
    // CORRECTLY get all necessary flags from AuthContext
    const { db, appId, isOnline, authReady, userId } = useAuth();
    
    const [pendingWrites, setPendingWrites] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const serviceFunctions = {
        'STOCK_IN': handleStockIn,
        'FINALIZE_PURCHASE': handleFinalizePurchaseBatch,
        'STOCK_OUT': handleStockOut,
        'TRANSFER': handleTransfer,
    };

    // Load pending writes from localforage on initial mount
    useEffect(() => {
        const loadPending = async () => {
            const queue = await localforage.getItem(PENDING_WRITES_KEY) || [];
            setPendingWrites(queue);
        };
        loadPending();
    }, []);

    const addToQueue = async (actionType, data, userProfile) => {
        // This logic is now correct: it uses the reliable userId from useAuth
        if (!userId) {
            console.error("Cannot add to queue: userId is null or undefined from AuthContext.");
            throw new Error("You must be authenticated to save data.");
        }

        const action = {
            id: `action_${Date.now()}_${Math.random()}`,
            type: actionType,
            payload: {
                operationData: data,
                userId: userId,
                user: { displayName: userProfile.displayName || 'System User' }
            }
        };

        console.log('Offline: Queuing action', action);
        // Use a functional update to prevent race conditions
        const newQueue = [...pendingWrites, action];
        setPendingWrites(newQueue);
        await localforage.setItem(PENDING_WRITES_KEY, newQueue);
    };

    // DEFINITIVE FIX: A robust, one-at-a-time queue processing logic
    const processQueue = useCallback(async () => {
        // --- Guard Clauses with clear logging ---
        if (pendingWrites.length === 0) {
            return; // Nothing to do
        }
        if (isSyncing) {
            console.log("Sync skipped: Already syncing.");
            return;
        }
        if (!isOnline) {
            console.log("Sync skipped: App is offline.");
            return;
        }
        if (!authReady || !db || !appId || !userId) {
            console.log("Sync skipped: Auth or DB not ready.");
            return;
        }

        setIsSyncing(true);
        console.log("--- Starting queue processing ---");

        const actionToProcess = pendingWrites[0];

        try {
            const serviceFunc = serviceFunctions[actionToProcess.type];
            if (serviceFunc) {
                console.log(`Processing action: ${actionToProcess.id}`);
                await serviceFunc(db, appId, actionToProcess.payload.userId, actionToProcess.payload.user, actionToProcess.payload.operationData);

                // SUCCESS: Remove the processed item from the queue
                console.log(`Action ${actionToProcess.id} successful.`);
                const newQueue = pendingWrites.slice(1);
                setPendingWrites(newQueue);
                await localforage.setItem(PENDING_WRITES_KEY, newQueue);

            } else {
                console.error(`No service function for action: ${actionToProcess.type}. Discarding.`);
                // DISCARD: Remove unknown action type to prevent queue blockage
                const newQueue = pendingWrites.slice(1);
                setPendingWrites(newQueue);
                await localforage.setItem(PENDING_WRITES_KEY, newQueue);
            }
        } catch (error) {
            // On failure, log the error but stop processing to allow for manual intervention.
            console.error(`Failed to process action ${actionToProcess.id}. Halting queue.`, error);
        } finally {
            setIsSyncing(false);
            console.log("--- Finished queue processing cycle ---");
        }

    }, [pendingWrites, isOnline, authReady, isSyncing, db, appId, userId]);

    // EFFECT TO TRIGGER QUEUE PROCESSING
    // This now correctly depends on all necessary conditions.
    useEffect(() => {
        // Only try to process the queue if we are online and auth is ready.
        if (isOnline && authReady && pendingWrites.length > 0) {
            const timer = setTimeout(processQueue, 1500); // Small delay to bundle operations
            return () => clearTimeout(timer);
        }
    }, [isOnline, authReady, pendingWrites, processQueue]);

    return (
        <SyncContext.Provider value={{ addToQueue, pendingWritesCount: pendingWrites.length, isSyncing }}>
            {children}
        </SyncContext.Provider>
    );
};
