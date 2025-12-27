// src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase/firebase-config.js'; 
import { 
    onAuthStateChanged, 
    signInWithCustomToken, 
    signOut as firebaseSignOut, 
    signInWithEmailAndPassword 
} from 'firebase/auth';
import { invoke as tauriInvoke } from '@tauri-apps/api/core'; 
import localforage from 'localforage'; 

// --- LocalForage Store for Offline Credentials ---
const CREDENTIALS_KEY = 'offlineUserCreds';
const ALL_USERS_KEY = 'allOfflineUsers';

// ----------------------------------------------------------------------
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 
const isTauriAvailable = typeof tauriInvoke === 'function' && tauriInvoke !== null;

// 1. Context Setup
const AuthContext = createContext({
    userId: null,
    isAuthenticated: false,
    authReady: false,
    appId: appId,
    isOnline: false,
    isNetworkAvailable: true,
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

    // --- 1. Network Listener ---
    // This effect now solely manages the network availability flag.
    useEffect(() => {
        const handleOnline = () => setIsNetworkAvailable(true);
        const handleOffline = () => setIsNetworkAvailable(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []); 

    // --- 2. Core Auth Logic ---
    useEffect(() => {
        let isMounted = true;

        // Function to automatically sign in when network is available
        const autoSignIn = async () => {
            if (isNetworkAvailable && !auth.currentUser) {
                const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
                if (offlineUser && offlineUser.email && offlineUser.password) {
                    try {
                        console.log("Network is back. Attempting auto sign-in...");
                        await signInWithEmailAndPassword(auth, offlineUser.email, offlineUser.password);
                    } catch (error) {
                        console.error("Auto sign-in failed:", error);
                    }
                }
            }
        };
        
        // Automatically try to sign in when the network comes online
        autoSignIn();

        // This is the primary listener for Firebase's auth state.
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!isMounted) return;

            if (firebaseUser) {
                // Scenario: User is authenticated with Firebase. We are online.
                setUserId(firebaseUser.uid);
                setIsAuthenticated(true);
            } else {
                // Scenario: User is not authenticated with Firebase.
                // This could be because we are offline OR the user truly signed out.
                const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
                if (offlineUser) {
                    // If we have cached credentials, the user is authenticated for offline use.
                    setUserId(offlineUser.uid);
                    setIsAuthenticated(true);
                } else {
                    // No cached credentials means the user is fully signed out.
                    setUserId(null);
                    setIsAuthenticated(false);
                }
            }

            // Ensure the app readiness is set only once.
            if (!authReady) {
                 // On first load, also check for Tauri offline data
                 if (isTauriAvailable) { 
                    try {
                        const offlineData = await tauriInvoke('load_offline_auth');
                        if(offlineData && offlineData.user_id) {
                            setUserId(offlineData.user_id);
                            setIsAuthenticated(true);
                            console.log("TAURI OFFLINE: Loaded session from disk for UID:", offlineData.user_id);
                        }
                    } catch (e) {
                        console.log("TAURI OFFLINE: No valid offline session found or error loading it.");
                    }
                }
                console.log("USER CONTEXT: Auth check complete. App is ready.");
                setAuthReady(true);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [isNetworkAvailable, authReady]); // Re-run when network status changes
    
    // --- 3. Manual "Go Online" Handler ---
    // This is now the only manual connection function.
    const goOnline = useCallback(async () => {
        if (!isNetworkAvailable) {
            throw new Error("No network connection available.");
        }
        const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
        if (!offlineUser || !offlineUser.email || !offlineUser.password) {
            throw new Error("No cached credentials available to go online.");
        }

        try {
            await signInWithEmailAndPassword(auth, offlineUser.email, offlineUser.password);
        } catch (error) {
            console.error("GO ONLINE FAILED (Firebase login):", error);
            throw new Error(`Connection failed: ${error.message}`);
        }
    }, [isNetworkAvailable]);

    // --- 4. Sign In Handler (Used for Login Page) ---
    const signIn = useCallback(async (email, password) => {
        if (!authReady) {
            throw new Error("Application is not ready yet.");
        }
        
        // Always try to sign in online first if network is available
        if (isNetworkAvailable) {
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;
    
                const userData = { uid, email, password, lastLogin: Date.now() };
                await localforage.setItem(CREDENTIALS_KEY, userData);
    
                let allUsers = await localforage.getItem(ALL_USERS_KEY) || {};
                allUsers[uid] = userData;
                await localforage.setItem(ALL_USERS_KEY, allUsers);
                
                if (isTauriAvailable) {
                    const authToken = await userCredential.user.getIdToken();
                    try {
                        await tauriInvoke('save_offline_auth', { userId: uid, authToken: authToken });
                    } catch(e) {
                        console.error("Failed to save offline auth to Tauri disk:", e);
                    }
                }
                
                return uid;
            } catch (onlineError) {
                 // If online fails, proceed to offline check
                 console.warn("Online login failed, checking offline cache.", onlineError);
            }
        }

        // Offline login check
        const allUsers = await localforage.getItem(ALL_USERS_KEY) || {};
        const cachedUser = Object.values(allUsers).find(u => u.email === email && u.password === password);

        if (cachedUser) {
            setUserId(cachedUser.uid);
            setIsAuthenticated(true);
            await localforage.setItem(CREDENTIALS_KEY, cachedUser); // Set as current user
            console.log("OFFLINE LOGIN SUCCESS: Authenticated against local cache.");
            return cachedUser.uid;
        }
        
        throw new Error("Login failed. Check credentials or internet connection.");
    }, [authReady, isNetworkAvailable]);
    
    // --- 5. Sign Out Handler ---
    const signOut = useCallback(async () => {
        // Crucially, remove credentials first. This tells the onAuthStateChanged
        // listener that this is a deliberate sign-out.
        await localforage.removeItem(CREDENTIALS_KEY);
        
        try {
            if (auth.currentUser) {
                 await firebaseSignOut(auth);
            }
        } catch (error) {
            console.error("SIGN OUT ERROR:", error);
        }
        
        // The onAuthStateChanged listener will handle setting user/auth state to null/false
        console.log("SIGN OUT: User signed out, credentials cache cleared.");
    }, []);
    
    // The app is "online" if the network is available AND we have an active Firebase user.
    const isOnline = isNetworkAvailable && auth.currentUser != null;

    return (
        <AuthContext.Provider value={{ 
            userId, 
            isAuthenticated, 
            authReady, 
            auth, 
            db, 
            appId,
            isOnline,
            isNetworkAvailable,
            goOnline, 
            signOut, 
            signIn 
        }}>
            {children}
        </AuthContext.Provider>
    );
};
