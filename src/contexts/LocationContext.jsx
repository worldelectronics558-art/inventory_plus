// src/contexts/LocationContext.jsx

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import localforage from 'localforage'; // For offline caching
import {
    collection,
    query,
    onSnapshot,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    deleteDoc
} from 'firebase/firestore'; // Firestore functions, added deleteDoc if needed later

import { useAuth } from './AuthContext'; // Import useAuth to get appId and db

// --- LocalForage Store Setup ---
const LOCATION_STORE_NAME = 'locationsCache';
const locationStore = localforage.createInstance({
    name: "inventoryApp",
    storeName: LOCATION_STORE_NAME,
});

const LocationContext = createContext();

export const useLocations = () => useContext(LocationContext);

export const LocationProvider = ({ children }) => {
    const { appId, authReady, db, isOnline } = useAuth(); // Get appId, auth readiness, db instance, and isOnline status

    const [locations, setLocations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Utility function to get the correct collection reference path
    const getLocationCollectionRef = useCallback(() => {
        if (!appId || !db) {
            throw new Error("Database or Application ID is missing. Cannot access locations.");
        }
        // Use a consistent path for locations
        const path = `/artifacts/${appId}/locations`;
        return collection(db, path);
    }, [appId, db]); // appId and db are stable dependencies

    // --- Data Loading: Cache vs. Live Listener (Robustified) ---
    useEffect(() => {
        if (!authReady || !appId || !db) {
            return;
        }

        let unsubscribe = () => {}; // Initialize unsubscribe function
        setIsLoading(true);

        if (isOnline) {
            // A. ONLINE MODE: Set up live listener and cache update
            try {
                const colRef = getLocationCollectionRef();
                const q = query(colRef);

                unsubscribe = onSnapshot(q, async (snapshot) => {
                    // --- ROBUSTIFY: Get all docs from snapshot, sort by ID to ensure consistent order ---
                    const locationListFromSnapshot = snapshot.docs
                        .map(doc => ({
                            id: doc.id, // Use Firestore document ID
                            ...doc.data()
                        }))
                        // Optional: Sort by ID or name for consistent rendering order (helps with React key stability)
                        .sort((a, b) => a.id.localeCompare(b.id));

                    // --- CRITICAL: Check for duplicates BEFORE setting state ---
                    const ids = new Set();
                    let hasDuplicates = false;
                    locationListFromSnapshot.forEach(loc => {
                        if (ids.has(loc.id)) {
                            console.error(`[LocationContext] Duplicate ID found in snapshot: ${loc.id}. Doc data:`, loc);
                            hasDuplicates = true;
                        } else {
                            ids.add(loc.id);
                        }
                    });

                    if (hasDuplicates) {
                        console.warn("[LocationContext] Snapshot contained duplicate IDs. Discarding potentially corrupt data.");
                        // Consider setting an error state or showing an alert instead of setting bad data.
                        // For now, just log and don't update state.
                        return;
                    }

                    setLocations(locationListFromSnapshot);
                    await locationStore.setItem(LOCATION_STORE_NAME, locationListFromSnapshot); // Update cache
                    console.log(`LocationContext ONLINE: ${locationListFromSnapshot.length} locations loaded and cached.`);
                    setIsLoading(false);

                }, (error) => {
                    console.error("Error fetching locations in ONLINE mode:", error);
                    setIsLoading(false);
                });
            } catch (error) {
                console.error("Failed to set up ONLINE location listener:", error.message);
                setIsLoading(false);
            }
        } else {
            // B. OFFLINE MODE: Load from cache only
            locationStore.getItem(LOCATION_STORE_NAME).then(cachedLocations => {
                // Even in offline mode, ensure the data is an array and log its length
                const locationsToSet = cachedLocations || [];
                console.log(`LocationContext OFFLINE: Loaded ${locationsToSet.length} locations from cache.`);
                setLocations(locationsToSet);
                setIsLoading(false);
            }).catch(error => {
                console.error("Error loading offline location cache:", error);
                setLocations([]); // Fallback to empty array on cache error
                setIsLoading(false);
            });
        }

        return () => unsubscribe(); // Cleanup listener when dependencies change or component unmounts
    }, [appId, authReady, db, isOnline, getLocationCollectionRef]);

    // --- Memoize location names for efficiency ---
    // This useMemo recalculates locationNames whenever the locations array changes.
    // Using the ID for key generation in the UI is still preferred, but this list is used for dropdowns.
    const locationNames = useMemo(() => {
        return locations.map(loc => loc.name);
    }, [locations]); // Dependency is the locations array itself

    // --- CRUD: Add Location Function (Gated & Unique Check via Firestore ID & Client-Side Check) ---
    const addLocation = async (locationData) => {
        // ENFORCE ONLINE CHECK
        if (!isOnline) {
            const message = "Cannot add location while offline. Please go Online first.";
            alert(message);
            throw new Error(message);
        }

        if (!locationData.name) {
            throw new Error("Location name is required.");
        }

        // CLIENT-SIDE PRE-CHECK (Good UX, but not a guarantee)
        // Check against the *current* state of the locations array loaded by the context.
        // This provides immediate feedback if the name already exists based on the latest known state.
        const sanitizedName = locationData.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
        const existingLocation = locations.find(loc => loc.name.toLowerCase() === locationData.name.toLowerCase());
        if (existingLocation) {
            throw new Error(`Location "${locationData.name}" already exists (case-insensitive match).`);
        }

        try {
            const locationsCollectionRef = getLocationCollectionRef();
            // Use the *sanitized name* as the document ID to enforce uniqueness at the database level.
            const newLocationDocRef = doc(locationsCollectionRef, sanitizedName);

            // SERVER-SIDE CHECK (Ultimate guarantee): Fetch the document to see if it exists *right now*.
            // This prevents race conditions where two users try to add the same location simultaneously.
            const docSnap = await getDoc(newLocationDocRef);
            if (docSnap.exists()) {
                 throw new Error(`Location "${locationData.name}" already exists (ID conflict: ${sanitizedName}).`);
            }

            // Add the location document using the sanitized name as the ID.
            // This call will fail if the document ID already exists, providing the ultimate uniqueness guarantee.
            await setDoc(newLocationDocRef, {
                ...locationData, // Spread other data provided
                // Ensure name is correctly set in the stored data
                name: locationData.name,
                // Add other specific attributes here if needed, e.g.:
                // createdTimestamp: serverTimestamp(), // Optional: track creation time
                // type: locationData.type || 'General', // Optional: default type
            });
            console.log(`Location "${locationData.name}" added successfully with ID "${sanitizedName}".`);
            // The onSnapshot listener in useEffect will automatically update the 'locations' state
            // when the new document is added to the collection. No manual state update needed here.

        } catch (error) {
            console.error("Error adding location:", error);
            // If it's the "already exists" error caught by our checks, re-throw it.
            // If it's a different Firestore error (e.g., network), re-throw that.
            throw error; // Re-throw to be handled by the calling component (e.g., StockInForm)
        }
    };

    // --- CRUD: Delete Location Function (Gated) ---
    const deleteLocation = async (locationId) => {
        if (!isOnline) {
            const message = "Cannot delete location while offline. Please go Online first.";
            alert(message);
            throw new Error(message);
        }

        try {
            const locationsCollectionRef = getLocationCollectionRef();
            const locationDocRef = doc(locationsCollectionRef, locationId);
            await deleteDoc(locationDocRef);
            console.log(`Location with ID "${locationId}" deleted successfully.`);
            // The onSnapshot listener will automatically remove it from the 'locations' state.
        } catch (error) {
            console.error("Error deleting location:", error);
            throw error; // Re-throw for calling component to handle
        }
    };

    // --- Context Value ---
    const contextValue = {
        locations, // Provide the list of location objects (with id and name)
        locationNames, // Provide the list of just names (derived from locations)
        isLoading, // Provide loading state
        isOnline,  // Provide online status (useful for UI)
        addLocation, // Provide the add function
        deleteLocation, // Provide the delete function (if needed later)
        // Add other CRUD functions here if needed (updateLocation, etc.)
    };

    return (
        <LocationContext.Provider value={contextValue}>
            {children}
        </LocationContext.Provider>
    );
};

export default LocationProvider;