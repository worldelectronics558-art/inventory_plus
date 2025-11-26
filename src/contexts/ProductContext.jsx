// src/contexts/ProductContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage'; 
import { 
    collection, 
    query, 
    onSnapshot, 
    doc, 
    setDoc, 
    updateDoc,
    deleteDoc,
    serverTimestamp,
} from 'firebase/firestore';

import { useAuth } from './AuthContext';
import { useUser } from './UserContext.jsx'; 


// --- LocalForage Store Setup ---
const PRODUCT_STORE_NAME = 'productsCache'; 

const productStore = localforage.createInstance({
    name: "inventoryApp",
    storeName: PRODUCT_STORE_NAME,
});

const ProductContext = createContext();

export const useProducts = () => useContext(ProductContext);

export const ProductProvider = ({ children }) => {
    // isOnline is now the manual switch state
    const { appId, authReady, db, isOnline, isAuthenticated } = useAuth(); 
    const { isLoading: isUserContextLoading } = useUser();
    
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // --- Utility: Get Shared Collection Reference ---
    const getProductCollectionRef = useCallback(() => {
        if (!appId || !db) {
            throw new Error("Database or Authentication context is not ready. Cannot access products.");
        }
        const path = `/artifacts/${appId}/products`;
        return collection(db, path);
    }, [appId, db]);


    // 1. Initial Load (Offline Cache/Authentication Check)
    useEffect(() => {
        // Load cache ONLY when authenticated and the system is ready, and we're NOT in online mode.
        if (isAuthenticated && authReady && !isOnline && !isUserContextLoading) { 
            setIsLoading(true);
            productStore.getItem(PRODUCT_STORE_NAME).then(cachedProducts => {
                setProducts(cachedProducts || []);
                console.log(`OFFLINE MODE: Loaded ${cachedProducts?.length || 0} items from LocalForage.`);
                setIsLoading(false);
            }).catch(error => {
                console.error("Error loading initial LocalForage data:", error);
                setIsLoading(false);
            });
        }
        
        // Clear products when logging out
        if (!isAuthenticated) {
            setProducts([]);
        }

    }, [isAuthenticated, authReady, isOnline, isUserContextLoading]);


    // 2. Real-time Listener (ONLY runs when isOnline is TRUE)
    useEffect(() => {
        // Listener only runs if the user has manually enabled online mode
        if (!isOnline || !authReady || !db || !appId || isUserContextLoading) {
            // When going offline, the previous useEffect handles loading the cache.
            return; 
        }

        setIsLoading(true);
        let unsubscribe;

        try {
            const colRef = getProductCollectionRef();
            const q = query(colRef);

            unsubscribe = onSnapshot(q, async (snapshot) => {
                const firestoreProducts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // When online, Firebase is the source of truth AND cache is updated
                setProducts(firestoreProducts);
                await productStore.setItem(PRODUCT_STORE_NAME, firestoreProducts);
                console.log(`ONLINE MODE: Synced ${firestoreProducts.length} products and updated cache.`);
                
                setIsLoading(false);
                
            }, (error) => {
                console.error("Error fetching products during ONLINE MODE:", error);
                setIsLoading(false);
                // Important: On severe error, we might want to automatically switch back to offline mode
                // (This is a complex edge case, but for now we log and stop loading.)
            });

            return () => {
                console.log("ONLINE MODE: Listener unsubscribed.");
                unsubscribe();
            }
        } catch (error) {
            console.error("Failed to set up ONLINE product listener:", error.message);
            setIsLoading(false); 
        }
    }, [appId, authReady, db, isOnline, isUserContextLoading, getProductCollectionRef]);
    
    
    // --- Utility to enforce online status for write actions ---
    const ensureOnline = (action) => {
        // Checks the manual online mode state
        if (!isOnline) { 
            const message = `Cannot ${action} while offline. Please go Online first.`;
            console.error(`OFFLINE ACTION BLOCKED: ${message}`);
            alert(message); 
            return false;
        }
        return true;
    };


    // ... (CRUD implementations (createProduct, updateProduct, deleteProduct) remain the same, 
    // relying on the ensureOnline guard) ...

    const createProduct = async (productData) => {
        if (!ensureOnline("create a new product")) return; 
        // ... (rest of function)
        try {
            const colRef = getProductCollectionRef();
            const newProductRef = doc(colRef);
            await setDoc(newProductRef, {
                ...productData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return newProductRef.id;
        } catch (error) {
            console.error("Error creating product:", error);
            throw error;
        }
    };

    const updateProduct = async (productId, updateData) => {
        if (!ensureOnline("edit a product")) return; 
        // ... (rest of function)
        try {
            const productDocRef = doc(getProductCollectionRef(), productId);
            await updateDoc(productDocRef, {
                ...updateData,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error updating product:", error);
            throw error;
        }
    };

    const deleteProduct = async (productId) => {
        if (!ensureOnline("delete a product")) return; 
        // ... (rest of function)
        try {
            const productDocRef = doc(getProductCollectionRef(), productId);
            await deleteDoc(productDocRef);
        } catch (error) {
            console.error("Error deleting product:", error);
            throw error;
        }
    };

    // ----------------------------------------------------------------
    // CONTEXT VALUE
    // ----------------------------------------------------------------

    const contextValue = {
        products,
        isLoading,
        isOnline, 
        createProduct,
        updateProduct,
        deleteProduct,
        getProductCollectionRef,
    };

    return (
        <ProductContext.Provider value={contextValue}>
            {children}
        </ProductContext.Provider>
    );
};