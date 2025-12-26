
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

/**
 * A real-time hook to fetch and monitor all documents from the item_history collection.
 * @returns {{logs: Array, isLoading: boolean, error: Error | null}}
 */
const useHistoryLogs = () => {
    const { db, appId } = useAuth();
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!db || !appId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const historyCollectionRef = collection(db, `artifacts/${appId}/item_history`);
        
        // Query for all history logs, ordered by timestamp descending (newest first)
        const q = query(historyCollectionRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const fetchedLogs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setLogs(fetchedLogs);
                setIsLoading(false);
            },
            (err) => {
                console.error("Error fetching history logs:", err);
                setError(err);
                setIsLoading(false);
            }
        );

        // Cleanup subscription on unmount
        return () => unsubscribe();

    }, [db, appId]);

    return { logs, isLoading, error };
};

export default useHistoryLogs;
