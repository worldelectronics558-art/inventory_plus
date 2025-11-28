// src/contexts/UserContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

// 1. Permission Calculation Logic
const calculatePermissions = (role, isAuthenticated) => {
    if (!isAuthenticated) {
        return {
            role: 'guest',
            canViewInventory: false,
            canManageInventory: false,
            canManageUsers: false,
            canViewProducts: false, // Explicitly false for guests
            canManageProducts: false,
            canViewSettings: false,
        };
    }
    // CORRECTED: Added both canViewProducts and canManageProducts
    const permissions = {
        admin: {
            canViewInventory: true,
            canManageInventory: true,
            canManageUsers: true,
            canViewProducts: true,    // Can see the page
            canManageProducts: true, // Can edit/add products
            canViewSettings: true,
        },
        manager: {
            canViewInventory: true,
            canManageInventory: true,
            canManageUsers: false,
            canViewProducts: true,    // Can see the page
            canManageProducts: true, // Can edit/add products
            canViewSettings: true,
        },
        viewer: {
            canViewInventory: true,
            canManageInventory: false,
            canManageUsers: false,
            canViewProducts: true,    // Can see the page
            canManageProducts: false, // CANNOT edit/add products
            canViewSettings: false,
        },
    };
    return { role, ...(permissions[role] || permissions.viewer) };
};

// 2. Context Definition
const UserContext = createContext({
    currentUser: null,
    userPermissions: calculatePermissions('guest', false),
    assignedLocations: [],
    isLoading: true,
    appId: null,
});

export const useUser = () => useContext(UserContext);

// 3. Provider Component
export const UserProvider = ({ children }) => {
    const { userId, isAuthenticated, auth, db, appId, authReady } = useAuth();
    const [currentUser, setCurrentUser] = useState(null);
    const [userPermissions, setUserPermissions] = useState(calculatePermissions('guest', false));
    const [assignedLocations, setAssignedLocations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authReady) {
            setIsLoading(true);
            return;
        }

        if (!isAuthenticated || !userId || !db || !appId) {
            setCurrentUser(null);
            setUserPermissions(calculatePermissions('guest', false));
            setAssignedLocations([]);
            setIsLoading(false);
            return;
        }

        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);

        const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const role = data.role || 'viewer';
                
                setCurrentUser(data);
                setUserPermissions(calculatePermissions(role, isAuthenticated));
                setAssignedLocations(data.assignedLocations || []);

                if (data.lastLogin?.toDate()?.getTime() < Date.now() - 60000) {
                    try {
                        await updateDoc(userDocRef, { lastLogin: new Date() });
                    } catch (error) {
                        console.warn("USER CONTEXT: Failed to update lastLogin:", error.message);
                    }
                }
            } else {
                const email = auth?.currentUser?.email;
                if (email === 'worl@world.com') {
                    const defaultProfile = { 
                        displayName: 'Admin User',
                        email: email,
                        role: 'admin',
                        createdAt: new Date(),
                        lastLogin: new Date(),
                        assignedLocations: [],
                    };
                    
                    try {
                        await setDoc(userDocRef, defaultProfile);
                    } catch (error) {
                        console.error("USER CONTEXT: Failed to create default admin profile:", error);
                        setCurrentUser({ role: 'admin', assignedLocations: [] }); 
                        setUserPermissions(calculatePermissions('admin', isAuthenticated));
                        setAssignedLocations([]);
                    }
                }
            }
            setIsLoading(false);
        }, (error) => {
            console.error("USER CONTEXT: Snapshot listener error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();

    }, [userId, isAuthenticated, db, appId, authReady, auth]);

    return (
        <UserContext.Provider value={{ currentUser, userPermissions, assignedLocations, isLoading, appId }}>
            {children}
        </UserContext.Provider>
    );
};
