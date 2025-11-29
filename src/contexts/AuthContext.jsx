// src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithCustomToken, 
    signOut as firebaseSignOut, 
    signInWithEmailAndPassword 
} from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore'; 
import { invoke as tauriInvoke } from '@tauri-apps/api/core'; 
import localforage from 'localforage'; 

// --- LocalForage Store for Offline Credentials ---
const CREDENTIALS_KEY = 'offlineUserCreds';
const ALL_USERS_KEY = 'allOfflineUsers';

// ----------------------------------------------------------------------
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfigRaw = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 
const isTauriAvailable = typeof tauriInvoke === 'function' && tauriInvoke !== null;

// 1. Context Setup
const AuthContext = createContext({
    userId: null,
    isAuthenticated: false,
    authReady: false,
    appId: appId,
    auth: null,
    secondaryAuth: null, // For user creation
    db: null,
    isOnline: false,
    isNetworkAvailable: true,
    goOnline: () => {}, 
    goOffline: () => {}, 
    signOut: () => {}, 
    signIn: () => {}, 
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState(null);
    const [secondaryAuth, setSecondaryAuth] = useState(null);
    const [db, setDb] = useState(null); 
    
    const [userId, setUserId] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);
    const [isManualOnlineMode, setIsManualOnlineMode] = useState(true);
    const [isNetworkAvailable, setIsNetworkAvailable] = useState(navigator.onLine);

    // --- 1. Initialization (Run once) ---
    useEffect(() => {
        const handleOnline = () => setIsNetworkAvailable(true);
        const handleOffline = () => setIsNetworkAvailable(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (!firebaseConfigRaw) {
            console.error("Firebase Config Error: __firebase_config is missing.");
            setAuthReady(true);
            return;
        }

        let config;
        try {
            config = typeof firebaseConfigRaw === 'string' ? JSON.parse(firebaseConfigRaw) : firebaseConfigRaw;
        } catch (error) {
            console.error("Firebase Config Error: Failed to parse __firebase_config. ", error);
            setAuthReady(true);
            return;
        }

        try {
            const defaultApp = initializeApp(config);
            const authInstance = getAuth(defaultApp);
            const dbInstance = getFirestore(defaultApp); 
            setAuth(authInstance);
            setDb(dbInstance);

            const secondaryApp = initializeApp(config, 'secondary');
            const secondaryAuthInstance = getAuth(secondaryApp);
            setSecondaryAuth(secondaryAuthInstance);

            setIsFirebaseInitialized(true);
        } catch (error) {
             if (error.code === 'duplicate-app') {
                console.warn("Firebase duplicate app initialization avoided.");
                if (!auth) setAuth(getAuth(initializeApp(config)));
                if (!db) setDb(getFirestore(initializeApp(config)));
                if (!secondaryAuth) {
                     const secondaryApp = initializeApp(config, 'secondary');
                     setSecondaryAuth(getAuth(secondaryApp));
                }
            } else {
                console.error("Firebase Initialization Error:", error);
            }
             if (!isFirebaseInitialized) {
                setIsFirebaseInitialized(true);
            }
        }
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []); 

    // --- 2. Initial Session Check and Listener Setup ---
    useEffect(() => {
        if (!isFirebaseInitialized || !auth || !db) return; 

        let isMounted = true;
        
        const autoSignIn = async () => {
            if (auth.currentUser) return;
            const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
            if (offlineUser && offlineUser.email && offlineUser.password) {
                try {
                    await signInWithEmailAndPassword(auth, offlineUser.email, offlineUser.password);
                    setIsManualOnlineMode(true);
                } catch (error) {
                    console.error("Auto sign-in failed:", error);
                    setIsManualOnlineMode(false);
                }
            }
        };
        
        const checkPersistenceAndAuth = async () => {
            if (isNetworkAvailable) {
                await autoSignIn();
            } else {
                setIsManualOnlineMode(false);
            }
             let offlineData = null;
             if (isTauriAvailable) { 
                 try {
                     offlineData = await tauriInvoke('load_offline_auth'); 
                     setUserId(offlineData.user_id);
                     setIsAuthenticated(true);
                     console.log("TAURI OFFLINE: Loaded session from disk for UID:", offlineData.user_id);
                 } catch (e) {
                     console.log("TAURI OFFLINE: No valid offline session found or error loading it.");
                 }
             }
             
             if (!auth.currentUser && initialAuthToken) { 
                 try {
                     await signInWithCustomToken(auth, initialAuthToken);
                 } catch (e) {
                     console.error("SESSION: Failed to sign in with host-provided token.", e);
                 }
             }
        };

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (isMounted) {
                if (firebaseUser && !firebaseUser.isAnonymous) {
                    setUserId(firebaseUser.uid);
                    setIsAuthenticated(true);
                    setIsManualOnlineMode(true);
                } else { 
                    setUserId(null);
                    setIsAuthenticated(false);
                }
                
                if (!authReady) {
                    const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
                    if (offlineUser && !isAuthenticated) {
                        setUserId(offlineUser.uid);
                        setIsAuthenticated(true);
                    }
                    console.log("USER CONTEXT: Auth check complete. App is ready.");
                    setAuthReady(true);
                }
            }
        });
        
        checkPersistenceAndAuth();

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [isFirebaseInitialized, auth, db, authReady, isAuthenticated, userId, isNetworkAvailable]); 
    
    // --- 3. Manual Online/Offline Handlers ---
    const goOnline = useCallback(async () => {
        if (!auth) throw new Error("Authentication service is not initialized.");
        const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
        if (!offlineUser || !offlineUser.email || !offlineUser.password) {
            throw new Error("No cached credentials available to go online.");
        }

        try {
            await signInWithEmailAndPassword(auth, offlineUser.email, offlineUser.password);
            setIsManualOnlineMode(true);
        } catch (error) {
            console.error("GO ONLINE FAILED (Firebase login):", error);
            throw new Error(`Connection failed: ${error.message}`);
        }
    }, [auth]);

    const goOffline = useCallback(async () => {
        if (auth && auth.currentUser) {
            await firebaseSignOut(auth);
        }
        setIsManualOnlineMode(false);
        console.log("App switched to Manual Offline Mode.");
    }, [auth]);

    // --- 4. Sign In Handler (Used for Login Page) ---
    const signIn = useCallback(async (email, password) => {
        if (!authReady) {
            throw new Error("Application is not ready yet.");
        }
        
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
            
            setIsManualOnlineMode(true); 
            return uid;
            
        } catch (onlineError) {
            const allUsers = await localforage.getItem(ALL_USERS_KEY) || {};
            const cachedUser = Object.values(allUsers).find(u => u.email === email && u.password === password);

            if (cachedUser) {
                setUserId(cachedUser.uid);
                setIsAuthenticated(true);
                setIsManualOnlineMode(false);
                await localforage.setItem(CREDENTIALS_KEY, cachedUser);
                console.log("OFFLINE LOGIN SUCCESS: Authenticated against local cache.");
                return cachedUser.uid;
            }
            
            throw new Error("Login failed. Check connection or your previous successful login credentials.");
        }
    }, [authReady, auth]);
    
    // --- 5. Sign Out Handler (Cleaned up) ---
    const signOut = useCallback(async () => {
        try {
            if (auth && auth.currentUser) {
                 await firebaseSignOut(auth);
            }
            await localforage.removeItem(CREDENTIALS_KEY);
            
            setUserId(null);
            setIsAuthenticated(false);
            console.log("SIGN OUT: User signed out, credentials cache cleared.");
        } catch (error) {
            console.error("SIGN OUT ERROR:", error);
        }
    }, [auth]);
    
    return (
        <AuthContext.Provider value={{ 
            userId, 
            isAuthenticated, 
            authReady, 
            auth, 
            secondaryAuth,
            db, 
            appId: appId,
            isOnline: isNetworkAvailable && isManualOnlineMode,
            isNetworkAvailable,
            goOnline, 
            goOffline, 
            signOut, 
            signIn 
        }}>
            {children}
        </AuthContext.Provider>
    );
};
