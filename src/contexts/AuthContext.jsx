// src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase/firebase-config.js'; 
import { 
    onAuthStateChanged, 
    signOut as firebaseSignOut, 
    signInWithEmailAndPassword 
} from 'firebase/auth';
import localforage from 'localforage'; 

// --- LocalForage Store for Offline Credentials ---
const CREDENTIALS_KEY = 'offlineUserCreds';
const ALL_USERS_KEY = 'allOfflineUsers';

// CORRECT: Define appId at the top level
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const AuthContext = createContext({
    userId: null,
    isAuthenticated: false,
    authReady: false,
    isOnline: false,
    isNetworkAvailable: true,
    // CORRECT: Add back the missing values to the default context
    auth: null,
    db: null,
    appId: appId,
    goOnline: () => {}, 
    signOut: () => {}, 
    signIn: () => {}, 
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [userId, setUserId] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [isNetworkAvailable, setIsNetworkAvailable] = useState(navigator.onLine);

    // --- 1. Network Status Listener ---
    useEffect(() => {
        const handleOnline = () => {
            console.log("NETWORK: Status changed to ONLINE");
            setIsNetworkAvailable(true);
        }
        const handleOffline = () => {
            console.log("NETWORK: Status changed to OFFLINE");
            setIsNetworkAvailable(false);
        }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // --- 2. Initial Auth & Firebase Listener (Runs once on mount) ---
    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            const localUser = await localforage.getItem(CREDENTIALS_KEY);
            if (isMounted && localUser) {
                console.log("AUTH INIT: Found local user. Setting state for offline mode.");
                setUserId(localUser.uid);
                setIsAuthenticated(true);
            }

            if (isMounted) {
                console.log("AUTH INIT: Context is ready. App can now render.");
                setAuthReady(true);
            }
        };

        initializeAuth();

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (!isMounted) return;

            if (firebaseUser) {
                console.log("FIREBASE: User is signed in (ONLINE). UID:", firebaseUser.uid);
                if (!isAuthenticated) setIsAuthenticated(true);
                if (userId !== firebaseUser.uid) setUserId(firebaseUser.uid);
            } else {
                localforage.getItem(CREDENTIALS_KEY).then(user => {
                    if (!user) {
                        console.log("FIREBASE: No user and no local creds. Setting unauthenticated.");
                        setIsAuthenticated(false);
                        setUserId(null);
                    }
                });
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []); // Runs only once.

    // --- 3. Auto Sign-In Effect (Runs when network status changes) ---
    useEffect(() => {
        const autoSignIn = async () => {
            if (isNetworkAvailable && !auth.currentUser) {
                const localUser = await localforage.getItem(CREDENTIALS_KEY);
                if (localUser && localUser.email && localUser.password) {
                    console.log("NETWORK ONLINE: Attempting auto sign-in...");
                    try {
                        await signInWithEmailAndPassword(auth, localUser.email, localUser.password);
                        console.log("NETWORK ONLINE: Auto sign-in successful.");
                    } catch (error) {
                        console.error("NETWORK ONLINE: Auto sign-in failed:", error.message);
                    }
                }
            }
        };

        autoSignIn();
    }, [isNetworkAvailable]);

    // --- 4. Handlers ---
    const goOnline = useCallback(async () => {
        if (!isNetworkAvailable) {
            throw new Error("No network connection available.");
        }
        const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
        if (!offlineUser || !offlineUser.email || !offlineUser.password) {
            throw new Error("No cached credentials to go online.");
        }

        try {
            await signInWithEmailAndPassword(auth, offlineUser.email, offlineUser.password);
        } catch (error) {
            console.error("GO ONLINE FAILED:", error);
            throw new Error(`Connection failed: ${error.message}`);
        }
    }, [isNetworkAvailable]);

    const signIn = useCallback(async (email, password) => {
        if (!authReady) throw new Error("Application not ready.");

        if (isNetworkAvailable) {
            try {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                const userData = { uid: cred.user.uid, email, password };
                await localforage.setItem(CREDENTIALS_KEY, userData);
                let allUsers = await localforage.getItem(ALL_USERS_KEY) || {};
                allUsers[cred.user.uid] = userData;
                await localforage.setItem(ALL_USERS_KEY, allUsers);
                return cred.user.uid;
            } catch (onlineError) {
                console.warn("Online login failed, checking cache.", onlineError);
            }
        }

        const allUsers = await localforage.getItem(ALL_USERS_KEY) || {};
        const cachedUser = Object.values(allUsers).find(u => u.email === email && u.password === password);

        if (cachedUser) {
            setUserId(cachedUser.uid);
            setIsAuthenticated(true);
            await localforage.setItem(CREDENTIALS_KEY, cachedUser);
            console.log("OFFLINE LOGIN: Authenticated against local cache.");
            return cachedUser.uid;
        }
        
        throw new Error("Login failed. Check credentials or internet connection.");
    }, [authReady, isNetworkAvailable]);
    
    const signOut = useCallback(async () => {
        console.log("SIGN OUT: Clearing local credentials.");
        await localforage.removeItem(CREDENTIALS_KEY);
        
        if (auth.currentUser) {
            await firebaseSignOut(auth);
            console.log("SIGN OUT: Firebase sign-out successful.");
        }
    }, []);
    
    const isOnline = isNetworkAvailable && auth.currentUser != null;

    return (
        <AuthContext.Provider value={{
            userId, 
            isAuthenticated, 
            authReady, 
            isOnline,
            isNetworkAvailable,
            goOnline, 
            signOut, 
            signIn, 
            // CORRECT: Added the required values back to the provider
            auth,
            db,
            appId
        }}>
            {children}
        </AuthContext.Provider>
    );
};
