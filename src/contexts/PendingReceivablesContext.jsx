
import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { generateBatchId } from '../firebase/system_services';

const PendingReceivablesContext = createContext();

export const usePendingReceivables = () => useContext(PendingReceivablesContext);

export const PendingReceivablesProvider = ({ children }) => {
    // FIX: Destructure `userId` directly from the `useAuth` hook.
    const { user, db, appId, userId } = useAuth();
    const [pendingReceivables, setPendingReceivables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutationDisabled, setIsMutationDisabled] = useState(false);

    useEffect(() => {
        if (!userId || !db || !appId) { // FIX: Check for userId as well.
            setPendingReceivables([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        
        const receivablesCollectionRef = collection(db, `artifacts/${appId}/pending_receivables`);
        const q = query(receivablesCollectionRef, where('status', '==', 'PENDING'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const receivables = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingReceivables(receivables);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching pending receivables: ", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, db, appId, userId]);

    const createPendingReceivable = async (items, receivingUser) => {
        if (!items || items.length === 0) {
            throw new Error("No items to add to the batch.");
        }
        // FIX: Check for the presence of `userId` from the auth context.
        if (!db || !appId || !receivingUser || !userId) {
             throw new Error("Missing required authentication or configuration data.");
        }

        setIsMutationDisabled(true);
        try {
            const batchId = await generateBatchId(db, appId);

            const newBatch = {
                batchId: batchId,
                createdAt: serverTimestamp(),
                createdBy: {
                    // FIX: Use the reliable `userId` from the auth context for the UID.
                    uid: userId,
                    // FIX: Use the passed-in user object for display name, with a fallback.
                    name: receivingUser.displayName || 'N/A',
                },
                status: 'PENDING',
                supplierName: 'N/A (Direct Stock)',
                invoiceNumber: 'N/A',
                items: items.map(item => ({ ...item, status: 'PENDING' }))
            };

            const batchDocRef = doc(db, `artifacts/${appId}/pending_receivables`, batchId);
            await setDoc(batchDocRef, newBatch);

        } catch (error) {
            console.error("Error creating pending receivable batch:", error);
            throw error; 
        } finally {
            setIsMutationDisabled(false);
        }
    };
    
    const value = {
        pendingReceivables,
        isLoading,
        isMutationDisabled,
        createPendingReceivable,
    };

    return (
        <PendingReceivablesContext.Provider value={value}>
            {children}
        </PendingReceivablesContext.Provider>
    );
};
