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
    const [isManualOnlineMode, setIsManualOnlineMode] = useState(false); 
    
    // --- 1. Initialization (Run once) ---
    useEffect(() => {
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
            // Primary App ([DEFAULT])
            const defaultApp = initializeApp(config);
            const authInstance = getAuth(defaultApp);
            const dbInstance = getFirestore(defaultApp); 
            setAuth(authInstance);
            setDb(dbInstance);

            // Secondary App for user management
            const secondaryApp = initializeApp(config, 'secondary');
            const secondaryAuthInstance = getAuth(secondaryApp);
            setSecondaryAuth(secondaryAuthInstance);

            setIsFirebaseInitialized(true);
        } catch (error) {
             if (error.code === 'duplicate-app') {
                console.warn("Firebase duplicate app initialization avoided.");
                // This can happen with React's StrictMode, it's generally safe to ignore
                // but we should ensure state is correctly set.
                if (!auth) setAuth(getAuth(initializeApp(config)));
                if (!db) setDb(getFirestore(initializeApp(config)));
                if (!secondaryAuth) {
                     const secondaryApp = initializeApp(config, 'secondary');
                     setSecondaryAuth(getAuth(secondaryApp));
                }

            } else {
                console.error("Firebase Initialization Error:", error);
            }
            // Ensure app proceeds even if initialization has issues
             if (!isFirebaseInitialized) {
                setIsFirebaseInitialized(true);
            }
        }
    }, []); 

    // --- 2. Initial Session Check and Listener Setup ---
    useEffect(() => {
        if (!isFirebaseInitialized || !auth || !db) return; 

        let isMounted = true;
        
        const checkPersistenceAndAuth = async () => {
             let offlineData = null;
             if (isTauriAvailable) { 
                 try {
                     offlineData = await tauriInvoke('load_offline_auth'); 
                     setUserId(offlineData.user_id);
                     setIsAuthenticated(true);
                     setIsManualOnlineMode(false); 
                     console.log("TAURI OFFLINE: Loaded session from disk for UID:", offlineData.user_id);
                 } catch (e) {
                     console.log("TAURI OFFLINE: No valid offline session found or error loading it.");
                 }
             }
             
             if (!auth.currentUser && initialAuthToken) { 
                 try {
                     await signInWithCustomToken(auth, initialAuthToken);
                     setIsManualOnlineMode(false);
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
                    localStorage.removeItem('auth_user_id'); 
                } else if (!userId) { 
                    setUserId(null);
                    setIsAuthenticated(false);
                    setIsManualOnlineMode(false); 
                    localStorage.removeItem('auth_user_id'); 
                }
                
                if (!authReady) {
                    const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
                    if (offlineUser && !isAuthenticated) {
                        setUserId(offlineUser.uid);
                        setIsAuthenticated(true);
                        setIsManualOnlineMode(false); 
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
    }, [isFirebaseInitialized, auth, db, authReady, isAuthenticated, userId]); 
    
    // --- 3. Manual Online/Offline Handlers ---
    const goOnline = useCallback(async (email, password) => {
        if (!auth) throw new Error("Authentication service is not initialized.");
        if (!email || !password) throw new Error("Credentials required to go online.");

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            setIsManualOnlineMode(true);
            return userCredential.user.uid;
        } catch (error) {
            console.error("GO ONLINE FAILED (Firebase login):", error);
            setIsManualOnlineMode(false); 
            throw new Error(`Connection failed. Check credentials: ${error.message}`);
        }
    }, [auth]);

    const goOffline = useCallback(async () => {
        setIsManualOnlineMode(false);
        console.log("App switched to Manual Offline Mode.");
    }, []);

    // --- 4. Sign In Handler (Used for Login Page) ---
    const signIn = useCallback(async (email, password) => {
        if (!authReady) {
            throw new Error("Application is not ready yet.");
        }
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            await localforage.setItem(CREDENTIALS_KEY, { uid, email, lastLogin: Date.now() });
            
            if (isTauriAvailable) {
                const authToken = await userCredential.user.getIdToken();
                try {
                    await tauriInvoke('save_offline_auth', { userId: uid, authToken: authToken });
                } catch(e) {
                    console.error("Failed to save offline auth to Tauri disk:", e);
                }
            }
            
            setIsManualOnlineMode(false); 
            return uid;
            
        } catch (onlineError) {
            const cachedCreds = await localforage.getItem(CREDENTIALS_KEY);
            if (cachedCreds && cachedCreds.email === email) {
                setUserId(cachedCreds.uid);
                setIsAuthenticated(true);
                setIsManualOnlineMode(false);
                console.log("OFFLINE LOGIN SUCCESS: Authenticated against local cache.");
                return cachedCreds.uid;
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
            setIsManualOnlineMode(false);
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
            secondaryAuth, // Provide secondary auth context
            db, 
            appId: appId,
            isOnline: isManualOnlineMode, 
            goOnline, 
            goOffline, 
            signOut, 
            signIn 
        }}>
            {children}
        </AuthContext.Provider>
    );
};