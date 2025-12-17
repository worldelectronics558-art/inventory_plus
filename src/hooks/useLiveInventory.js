import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

/**
 * A real-time hook to fetch and monitor inventory items for a specific product at a specific location.
 * @param {string} locationId - The ID of the location to filter by.
 * @param {string} sku - The SKU of the product to filter by.
 * @returns {{inventoryItems: Array, isLoading: boolean, error: Error | null}}
 */
const useLiveInventory = (locationId, sku) => {
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
        
        const q = query(
            inventoryCollectionRef,
            where('locationId', '==', locationId),
            where('sku', '==', sku),
            where('status', '==', 'in_stock')
        );

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

    }, [db, appId, locationId, sku]);

    return { inventoryItems, isLoading, error };
};

export default useLiveInventory;
