// src/Contexts/LookupContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage'; // NEW: For offline caching
// Re-import arrayUnion as it might be needed for other lookups (e.g., brands, categories) in the metadata doc
import { arrayUnion, doc, onSnapshot, setDoc } from 'firebase/firestore'; 
import { useAuth } from './AuthContext'; 
import { useUser } from './UserContext.jsx'; 

// --- LocalForage Store Setup ---
const LOOKUP_STORE_NAME = 'lookupsCache'; 
const lookupStore = localforage.createInstance({
    name: "inventoryApp",
    storeName: LOOKUP_STORE_NAME,
});

const LookupContext = createContext();

// Assuming we still want to manage other lookups like brands/categories here
export const useLookups = () => useContext(LookupContext);

export const LookupProvider = ({ children }) => {
    // PULL DB AND isOnline FROM useAuth
    const { appId, authReady, db, isOnline } = useAuth(); // <--- isOnline added
    const { isLoading: isUserContextLoading } = useUser(); 

    const [lookups, setLookups] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // ----------------------------------------------------------------------
    // 1. ADD LOOKUP ITEM FUNCTION (Gated) - ADAPTED FOR OTHER LOOKUPS (e.g., brands, categories)
    //    Assumes brands/categories still use the 'metadata' doc with arrayUnion.
    //    This might need separate handling later for scalability too.
    // ----------------------------------------------------------------------
    const addLookupItem = async (key, newItem) => {
        // ENFORCE ONLINE CHECK
        if (!isOnline) {
             const message = "Cannot add lookup item while offline. Please go Online first.";
             alert(message);
             throw new Error(message);
        }
        
        // ... (check and error handling logic remains the same)
        const sanitizedItem = newItem.trim();
        if (!appId || !db) { 
            throw new Error("Database or Application ID is missing. Cannot save lookups.");
        }

        // Check if it already exists (case-insensitive check)
        if (lookups && lookups[key] && lookups[key].some(item => item.toLowerCase() === sanitizedItem.toLowerCase())) {
            throw new Error(`${key} "${newItem}" already exists (case-insensitive match).`);
        }

        try {
            const lookupPath = `/artifacts/${appId}/lookups`; 
            const docRef = doc(db, lookupPath, 'metadata'); 
            
            await setDoc(docRef, {
                [key]: arrayUnion(sanitizedItem) // Use arrayUnion for other lookups in metadata
            }, { merge: true }); 
    
        } catch (error) {
            console.error(`Error adding new lookup item to ${key}:`, error);
            throw new Error(`Failed to save new ${key} to Firestore.`);
        }
    };

    // ----------------------------------------------------------------------
    // 2. REAL-TIME LISTENER / OFFLINE CACHE LOGIC - REMOVED LOCATIONS LOADING
    // ----------------------------------------------------------------------
    useEffect(() => {
        if (!authReady || !appId || isUserContextLoading) {
            return;
        }
        
        let unsubscribe = () => {};
        setIsLoading(true);

        if (isOnline) {
            // A. ONLINE MODE: Set up live listener and cache update
            if (!db) return; // Need db to run listener
            
            const lookupPath = `/artifacts/${appId}/lookups`;
            const docRef = doc(db, lookupPath, 'metadata'); 

            unsubscribe = onSnapshot(docRef, async (docSnapshot) => {
                const data = docSnapshot.exists() ? docSnapshot.data() : {};
                // Filter out 'locations' from the loaded data as it's now handled separately
                const { locations, ...otherLookups } = data;
                setLookups(otherLookups); // Store only non-location lookups
                await lookupStore.setItem(LOOKUP_STORE_NAME, otherLookups); // Update cache
                console.log("LookupContext ONLINE: Non-location data loaded and cached.");
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching lookup data in ONLINE mode:", error);
                setIsLoading(false);
            });
        } else {
            // B. OFFLINE MODE: Load from cache only
            lookupStore.getItem(LOOKUP_STORE_NAME).then(cachedData => {
                setLookups(cachedData || {});
                console.log("LookupContext OFFLINE: Non-location data loaded from cache.");
                setIsLoading(false);
            }).catch(error => {
                console.error("Error loading offline lookup cache:", error);
                setIsLoading(false);
            });
        }

        return () => unsubscribe(); // Cleanup listener when isOnline changes
    }, [appId, authReady, db, isOnline, isUserContextLoading]);


    // ----------------------------------------------------------------------
    // 3. CONTEXT VALUE
    // ----------------------------------------------------------------------
    const contextValue = {
        lookups, // Now contains only non-location lookups (e.g., brands, categories)
        isLoading,
        isOnline, // Expose isOnline status
        addLookupItem, // Can still be used for brands/categories if they remain in metadata
    };

    return (
        <LookupContext.Provider value={contextValue}>
            {children}
        </LookupContext.Provider>
    );
};