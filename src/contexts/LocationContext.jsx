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
    updateDoc, // Import updateDoc
    serverTimestamp,
    deleteDoc
} from 'firebase/firestore'; // Firestore functions, added deleteDoc if needed later

import { useAuth } from './AuthContext'; // Import useAuth to get appId and db
import { useUser } from './UserContext.jsx'; // Import useUser to get user info

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
    const { userId, assignedLocations } = useUser(); // Get user ID and assigned locations

    const [locations, setLocations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Utility function to get the correct collection reference path
    const getLocationCollectionRef = useCallback(() => {
        if (!appId || !db) {
            throw new Error("Database or Application ID is missing. Cannot access locations.");
        }
        const path = `/artifacts/${appId}/locations`;
        return collection(db, path);
    }, [appId, db]);

    // --- Data Loading: Cache vs. Live Listener (Robustified) ---
    useEffect(() => {
        if (!authReady || !appId || !db) {
            return;
        }

        let unsubscribe = () => {};
        setIsLoading(true);

        if (isOnline) {
            try {
                const colRef = getLocationCollectionRef();
                const q = query(colRef);

                unsubscribe = onSnapshot(q, async (snapshot) => {
                    const locationListFromSnapshot = snapshot.docs
                        .map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }))
                        .sort((a, b) => a.id.localeCompare(b.id));

                    const ids = new Set();
                    let hasDuplicates = false;
                    locationListFromSnapshot.forEach(loc => {
                        if (ids.has(loc.id)) {
                            hasDuplicates = true;
                        } else {
                            ids.add(loc.id);
                        }
                    });

                    if (hasDuplicates) {
                        return;
                    }

                    setLocations(locationListFromSnapshot);
                    await locationStore.setItem(LOCATION_STORE_NAME, locationListFromSnapshot);
                    setIsLoading(false);

                }, (error) => {
                    setIsLoading(false);
                });
            } catch (error) {
                setIsLoading(false);
            }
        } else {
            locationStore.getItem(LOCATION_STORE_NAME).then(cachedLocations => {
                const locationsToSet = cachedLocations || [];
                setLocations(locationsToSet);
                setIsLoading(false);
            }).catch(error => {
                setLocations([]);
                setIsLoading(false);
            });
        }

        return () => unsubscribe();
    }, [appId, authReady, db, isOnline, getLocationCollectionRef]);

    const locationNames = useMemo(() => {
        return locations.map(loc => loc.name);
    }, [locations]);

    const addLocation = async (locationData) => {
        if (!isOnline) {
            const message = "Cannot add location while offline. Please go Online first.";
            alert(message);
            throw new Error(message);
        }

        if (!locationData.name) {
            throw new Error("Location name is required.");
        }

        const sanitizedName = locationData.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
        const existingLocation = locations.find(loc => loc.name.toLowerCase() === locationData.name.toLowerCase());
        if (existingLocation) {
            throw new Error(`Location "${locationData.name}" already exists (case-insensitive match).`);
        }

        try {
            const locationsCollectionRef = getLocationCollectionRef();
            const newLocationDocRef = doc(locationsCollectionRef, sanitizedName);

            const docSnap = await getDoc(newLocationDocRef);
            if (docSnap.exists()) {
                 throw new Error(`Location "${locationData.name}" already exists (ID conflict: ${sanitizedName}).`);
            }

            await setDoc(newLocationDocRef, {
                ...locationData,
                name: locationData.name,
            });

            // --- Automatically assign the new location to the creator ---
            if (userId) {
                const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
                const newAssignedLocations = [...assignedLocations, sanitizedName];
                await updateDoc(userDocRef, {
                    assignedLocations: newAssignedLocations
                });
            }


        } catch (error) {
            throw error;
        }
    };

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
        } catch (error) {
            throw error;
        }
    };

    const contextValue = {
        locations,
        locationNames,
        isLoading,
        isOnline,
        addLocation,
        deleteLocation,
    };

    return (
        <LocationContext.Provider value={contextValue}>
            {children}
        </LocationContext.Provider>
    );
};

export default LocationProvider;
