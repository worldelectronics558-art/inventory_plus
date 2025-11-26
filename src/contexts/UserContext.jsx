// src/contexts/UserContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx'; 
import { doc, onSnapshot, setDoc } from 'firebase/firestore'; 

// --- CONSTANTS AND UTILITY FUNCTIONS (Defined First) ---
const DEFAULT_PERMISSIONS = {
    isAuthenticated: false,
    canManageProducts: false,
    canManageInventory: false,
    role: 'anonymous',
};

const calculatePermissions = (role, isAuth) => {
    if (!isAuth) {
        return DEFAULT_PERMISSIONS;
    }

    switch (role) {
        case 'admin':
            return {
                isAuthenticated: true,
                canManageProducts: true,
                canManageInventory: true,
                role: 'admin',
            };
        case 'manager':
            return {
                isAuthenticated: true,
                canManageProducts: false,
                canManageInventory: true,
                role: 'manager',
            };
        case 'viewer':
        default:
            return {
                isAuthenticated: true,
                canManageProducts: false,
                canManageInventory: false,
                role: role || 'viewer',
            };
    }
};
// --------------------------------------------------------

const UserContext = createContext({
    currentUser: null,
    
    userPermissions: DEFAULT_PERMISSIONS,
    
    isLoading: true, 
    
    appId: typeof __app_id !== 'undefined' ? __app_id : 'default-app-id',
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
    // Note: isOnline is NOT pulled here as profile data fetching is essential for both modes.
    const { userId, isAuthenticated, authReady, db } = useAuth(); 
    
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    const [currentUser, setCurrentUser] = useState(null);
    const [userPermissions, setUserPermissions] = useState(DEFAULT_PERMISSIONS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let unsubscribe = () => {};
        
        if (!authReady || !db) {
            setIsLoading(true); 
            return;
        }

        // If not authenticated (either live or offline), clear state and stop loading
        if (!isAuthenticated) { 
            console.log("USER CONTEXT: Unauthenticated. Setting loading=false to show login screen.");
            setCurrentUser(null);
            setUserPermissions(DEFAULT_PERMISSIONS);
            setIsLoading(false); 
            return;
        }
        
        console.log(`USER CONTEXT: Fetching user profile for UID: ${userId}`);

        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');

        unsubscribe = onSnapshot(userDocRef, async (docSnap) => { 
            if (docSnap.exists()) {
                const data = docSnap.data();
                const role = data.role || 'viewer'; 
                
                setCurrentUser(data);
                setUserPermissions(calculatePermissions(role, isAuthenticated));
                
                console.log(`USER CONTEXT: Profile loaded. Role: ${role}`);
            } else {
                // --- CRITICAL FIX: Create the default 'admin' profile here ---
                console.log("USER CONTEXT: Profile not found. Creating default 'admin' role.");
                
                const defaultProfile = { 
                    role: 'admin',
                    createdAt: new Date(),
                    lastLogin: new Date(),
                };
                
                try {
                    await setDoc(userDocRef, defaultProfile); 
                    console.log("USER CONTEXT: Default 'admin' profile created successfully.");
                } catch (error) {
                    console.error("USER CONTEXT: Failed to create default profile:", error);
                    setCurrentUser({ role: 'admin' }); 
                    setUserPermissions(calculatePermissions('admin', isAuthenticated));
                    setIsLoading(false);
                }
                return; 
            }
            
            setIsLoading(false); 
        }, (error) => {
            console.error("USER CONTEXT: Error fetching user profile:", error);
            setCurrentUser(null);
            setUserPermissions(DEFAULT_PERMISSIONS);
            setIsLoading(false); 
        });

        return () => {
            console.log("USER CONTEXT: Cleaning up listener.");
            unsubscribe();
        };

    }, [authReady, db, userId, isAuthenticated, appId]);

    const contextValue = {
        currentUser,
        userPermissions,
        isLoading,
        appId,
    };

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
};