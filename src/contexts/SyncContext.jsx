
// src/contexts/SyncContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { useAuth } from './AuthContext';
import { 
    // Staging functions
    handleStockReceipt, 
    handleStockDelivery,
    // Finalization functions
    handleStockIn, 
    handleStockOut, 
    // Document management
    handleFinalizePurchaseInvoice,
    handleFinalizeSalesOrder,
} from '../firebase/inventory_services';

const PENDING_WRITES_KEY = 'pending_writes';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
    const { db, appId, isOnline, authReady, userId } = useAuth();
    
    const [pendingWrites, setPendingWrites] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Symmetrical and clear service function mapping
    const serviceFunctions = {
        // Staging actions
        'CREATE_PENDING_RECEIVABLE': handleStockReceipt,
        'CREATE_PENDING_DELIVERABLE': handleStockDelivery,

        // Finalization actions
        'FINALIZE_PURCHASE_INVOICE': handleFinalizePurchaseInvoice,
        'FINALIZE_SALES_ORDER': handleFinalizeSalesOrder,
        'EXECUTE_STOCK_IN': handleStockIn,
        'EXECUTE_STOCK_OUT': handleStockOut,
    };

    useEffect(() => {
        const loadPending = async () => {
            const queue = await localforage.getItem(PENDING_WRITES_KEY) || [];
            setPendingWrites(queue);
        };
        loadPending();
    }, []);

    const addToQueue = async (actionType, data, userProfile) => {
        if (!userId) {
            console.error("Cannot add to queue: userId is null.");
            throw new Error("You must be authenticated to save data.");
        }

        // No more special logic. All actions are treated uniformly.
        const actions = (Array.isArray(data) ? data : [data]).map((item, index) => ({
            id: `action_${Date.now()}_${index}`,
            type: actionType,
            payload: { 
                operationData: item, 
                userId, 
                user: { displayName: userProfile.displayName || 'System User' } 
            }
        }));

        if (actions.length > 0) {
            console.log(`Queuing ${actions.length} action(s) of type ${actionType}`);
            const newQueue = [...pendingWrites, ...actions];
            setPendingWrites(newQueue);
            await localforage.setItem(PENDING_WRITES_KEY, newQueue);
            
            if (isOnline) {
                processQueue(newQueue);
            }
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
    }, [isSyncing, isOnline, authReady, db, appId, userId, serviceFunctions]);

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
