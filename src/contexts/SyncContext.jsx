
// src/contexts/SyncContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { useAuth } from './AuthContext';
import { handleStockIn, handleFinalizePurchaseBatch, handleStockOut, handleTransfer } from '../firebase/inventory_services';
import { generateBatchId } from '../firebase/system_services'; // <-- 1. IMPORT BATCH ID GENERATOR

const PENDING_WRITES_KEY = 'pending_writes';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
    const { db, appId, isOnline, authReady, userId } = useAuth();
    
    const [pendingWrites, setPendingWrites] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const serviceFunctions = {
        'STOCK_IN': handleStockIn,
        'FINALIZE_PURCHASE': handleFinalizePurchaseBatch,
        'STOCK_OUT': handleStockOut,
        'TRANSFER': handleTransfer,
    };

    useEffect(() => {
        const loadPending = async () => {
            const queue = await localforage.getItem(PENDING_WRITES_KEY) || [];
            setPendingWrites(queue);
        };
        loadPending();
    }, []);

    // --- 2. MODIFY addToQueue TO HANDLE BATCH ID ---
    const addToQueue = async (actionType, data, userProfile) => {
        if (!userId) {
            console.error("Cannot add to queue: userId is null.");
            throw new Error("You must be authenticated to save data.");
        }

        let operationData = data;
        // If the action is stocking in items, generate and assign a batch ID
        if (actionType === 'STOCK_IN') {
            if (!db || !appId) throw new Error("DB is not ready for Batch ID generation.");
            try {
                const batchId = await generateBatchId(db, appId);
                // Add the batchId to every item in the array
                operationData = data.map(item => ({ ...item, batchId }));
                console.log(`Generated and assigned Batch ID: ${batchId}`);
            } catch (error) {
                console.error("Failed to generate Batch ID:", error);
                throw new Error("Could not create a batch ID. Please try again.");
            }
        }

        const action = {
            id: `action_${Date.now()}_${Math.random()}`,
            type: actionType,
            payload: {
                operationData: operationData, // Use the (potentially modified) data
                userId: userId,
                user: { displayName: userProfile.displayName || 'System User' }
            }
        };

        console.log('Queuing action', action);
        const newQueue = [...pendingWrites, action];
        setPendingWrites(newQueue);
        await localforage.setItem(PENDING_WRITES_KEY, newQueue);
        
        // Immediately trigger queue processing if online
        if (isOnline) {
            processQueue(newQueue); // Pass the most recent queue
        }
    };

    const processQueue = useCallback(async (currentQueue) => {
        const queue = currentQueue || pendingWrites;
        if (queue.length === 0 || isSyncing || !isOnline || !authReady || !db || !appId || !userId) {
            return;
        }

        setIsSyncing(true);
        const actionToProcess = queue[0];

        try {
            const serviceFunc = serviceFunctions[actionToProcess.type];
            if (serviceFunc) {
                await serviceFunc(db, appId, actionToProcess.payload.userId, actionToProcess.payload.user, actionToProcess.payload.operationData);

                const newQueue = queue.slice(1);
                setPendingWrites(newQueue);
                await localforage.setItem(PENDING_WRITES_KEY, newQueue);

            } else {
                console.error(`No service function for action: ${actionToProcess.type}. Discarding.`);
                const newQueue = queue.slice(1);
                setPendingWrites(newQueue);
                await localforage.setItem(PENDING_WRITES_KEY, newQueue);
            }
        } catch (error) {
            console.error(`Failed to process action ${actionToProcess.id}. Halting queue.`, error);
        } finally {
            setIsSyncing(false);
        }

    }, [isSyncing, isOnline, authReady, db, appId, userId]);

    useEffect(() => {
        if (isOnline && authReady && pendingWrites.length > 0 && !isSyncing) {
            const timer = setTimeout(() => processQueue(), 1500);
            return () => clearTimeout(timer);
        }
    }, [isOnline, authReady, pendingWrites, isSyncing, processQueue]);

    return (
        <SyncContext.Provider value={{ addToQueue, pendingWritesCount: pendingWrites.length, isSyncing }}>
            {children}
        </SyncContext.Provider>
    );
};
