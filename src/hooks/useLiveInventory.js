import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

/**
 * A real-time hook to fetch and monitor inventory items for a specific product at a specific location.
 * @param {string} locationId - The ID of the location to filter by.
 * @param {string} sku - The SKU of the product to filter by.
 * @param {boolean} isSerialized - Flag to determine the query logic for serialized vs. non-serialized items.
 * @returns {{inventoryItems: Array, isLoading: boolean, error: Error | null}}
 */
const useLiveInventory = (locationId, sku, isSerialized) => {
    const { db, appId } = useAuth();
    const [inventoryItems, setInventoryItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!db || !appId || !locationId || !sku) {
            setInventoryItems([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        
        const inventoryCollectionRef = collection(db, `artifacts/${appId}/inventory_items`);
        
        let q;
        if (isSerialized) {
            // For serialized items, status is the source of truth.
            q = query(
                inventoryCollectionRef,
                where('locationId', '==', locationId),
                where('sku', '==', sku),
                where('status', '==', 'in_stock')
            );
        } else {
            // For non-serialized, we find active lots with available quantity.
            // We order by receivedAt to ensure FIFO logic can be applied easily by the consumer of this hook.
            q = query(
                inventoryCollectionRef,
                where('locationId', '==', locationId),
                where('sku', '==', sku),
                where('status', '==', 'in_stock'),
                where('quantity', '>', 0),
                orderBy('receivedAt', 'asc') 
            );
        }

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setInventoryItems(items);
                setIsLoading(false);
            },
            (err) => {
                console.error(`Error fetching live inventory for SKU ${sku} at location ${locationId}:`, err);
                setError(err);
                setIsLoading(false);
            }
        );

        // Cleanup subscription on unmount or when dependencies change
        return () => unsubscribe();

    }, [db, appId, locationId, sku, isSerialized]);

    return { inventoryItems, isLoading, error };
};

export default useLiveInventory;
