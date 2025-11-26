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
// These constants are now injected by Rust (src-tauri/src/main.rs)
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
    const [db, setDb] = useState(null); 
    
    const [userId, setUserId] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);
    
    // Tracks user's manual online intent (controlled by the explicit connection button)
    // CRITICAL FIX: Defaults to FALSE, enforcing offline-first policy.
    const [isManualOnlineMode, setIsManualOnlineMode] = useState(false); 
    
    // --- 1. Initialization (Run once) ---
    useEffect(() => {
        if (!firebaseConfigRaw) {
            console.error("Firebase Config Error: __firebase_config is missing.");
            setAuthReady(true);
            return;
        }

        let config;
        if (typeof firebaseConfigRaw === 'string') {
            try {
                config = JSON.parse(firebaseConfigRaw); 
            } catch (error) {
                console.error("Firebase Config Error: Failed to parse __firebase_config string as JSON. ", error);
                setAuthReady(true);
                return;
            }
        } 
        else if (typeof firebaseConfigRaw === 'object') {
            config = firebaseConfigRaw;
        } else {
             console.error("Firebase Config Error: __firebase_config is an unexpected type.");
             setAuthReady(true);
             return;
        }

        try {
            const app = initializeApp(config);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app); 
            
            setAuth(authInstance);
            setDb(dbInstance);
            setIsFirebaseInitialized(true);
        } catch (error) {
            console.error("Firebase Initialization Error:", error);
            setAuthReady(true);
        }
    }, []); 

    // --- 2. Initial Session Check and Listener Setup ---
    useEffect(() => {
        if (!isFirebaseInitialized || !auth || !db) return; 

        let isMounted = true;
        
        const checkPersistenceAndAuth = async () => {
             // -----------------------------------------------------
             // 1. Check Tauri for saved offline session
             // -----------------------------------------------------
             let offlineData = null;
             if (isTauriAvailable) { 
                 try {
                     // Call the correct Rust command to load user data from disk
                     offlineData = await tauriInvoke('load_offline_auth'); 
                     // If successful, set offline user immediately
                     setUserId(offlineData.user_id);
                     setIsAuthenticated(true);
                     // CRUCIAL: Load from disk, always start offline
                     setIsManualOnlineMode(false); 
                     console.log("TAURI OFFLINE: Loaded session from disk for UID:", offlineData.user_id);
                 } catch (e) {
                     console.log("TAURI OFFLINE: No valid offline session found or error loading it.");
                 }
             }
             
             // 2. Initial Sign In Logic (Check for token from hosting environment)
             if (!auth.currentUser && initialAuthToken) { 
                 try {
                     await signInWithCustomToken(auth, initialAuthToken);
                     // If custom token sign-in works, we assume we are online, but user must verify.
                     setIsManualOnlineMode(false); // Default to offline even with initial token
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
                    // CRITICAL FIX: DO NOT set setIsManualOnlineMode(true) here. 
                    // The app must start offline after re-opening, even with a valid Firebase session.
                    localStorage.removeItem('auth_user_id'); 
                } else if (!userId) { 
                    // Only run this if we are not already authenticated by Tauri offline check
                    setUserId(null);
                    setIsAuthenticated(false);
                    setIsManualOnlineMode(false); 
                    localStorage.removeItem('auth_user_id'); 
                }
                
                if (!authReady) {
                    // Check localforage for a user profile to enable offline mode immediately
                    const offlineUser = await localforage.getItem(CREDENTIALS_KEY);
                    if (offlineUser && !isAuthenticated) {
                        // If Firebase Auth state is null, we rely on localforage for offline access
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
            
            // Set the online flag only on successful Firebase login
            setIsManualOnlineMode(true);
            return userCredential.user.uid;

        } catch (error) {
            console.error("GO ONLINE FAILED (Firebase login):", error);
            // If login fails, ensure we remain in offline mode
            setIsManualOnlineMode(false); 
            throw new Error(`Connection failed. Check credentials: ${error.message}`);
        }
    }, [auth]);

    const goOffline = useCallback(async () => {
        // We stay authenticated against the local cache, but switch the network mode
        setIsManualOnlineMode(false);
        console.log("App switched to Manual Offline Mode.");
    }, []);

    // --- 4. Sign In Handler (Used for Login Page) ---
    const signIn = useCallback(async (email, password) => {
        if (!authReady) {
            throw new Error("Application is not ready yet.");
        }
        
        // 1. Try going online (live login)
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            // Save minimal data to localforage for general OFFLINE fallback
            await localforage.setItem(CREDENTIALS_KEY, { 
                uid: uid, 
                email: email, 
                lastLogin: Date.now() 
            });
            
            // Also save the custom token to Rust file system for robust Tauri offline login
            if (isTauriAvailable) {
                 // The Firebase user token is the custom token needed for the Rust side.
                const authToken = await userCredential.user.getIdToken();
                try {
                    // Use the correct Rust command
                    await tauriInvoke('save_offline_auth', { userId: uid, authToken: authToken });
                } catch(e) {
                    console.error("Failed to save offline auth to Tauri disk:", e);
                }
            }
            
            // *** CRITICAL FIX: Initial login defaults to OFFLINE mode, as requested. ***
            setIsManualOnlineMode(false); 
            return uid;
            
        } catch (onlineError) {
            // 2. Fallback: Check local cache for credentials (Offline Login via localforage)
            const cachedCreds = await localforage.getItem(CREDENTIALS_KEY);

            if (cachedCreds && cachedCreds.email === email) {
                setUserId(cachedCreds.uid);
                setIsAuthenticated(true);
                setIsManualOnlineMode(false); // Start in Offline Mode
                console.log("OFFLINE LOGIN SUCCESS: Authenticated against local cache.");
                return cachedCreds.uid;
            }
            
            // If online fails AND local fails
            throw new Error("Login failed. Check connection or your previous successful login credentials.");
        }
    }, [authReady, auth]);
    
    // --- 5. Sign Out Handler (Cleaned up) ---
    const signOut = useCallback(async () => {
        try {
            if (auth && auth.currentUser) {
                 await firebaseSignOut(auth);
            }
            // Remove local credentials used for offline fallback
            await localforage.removeItem(CREDENTIALS_KEY);
            
            // Reset state
            setUserId(null);
            setIsAuthenticated(false);
            setIsManualOnlineMode(false);
            console.log("SIGN OUT: User signed out, credentials cache cleared.");
        } catch (error) {
            console.error("SIGN OUT ERROR:", error);
            // We just log the error and proceed with local sign-out state reset
        }
    }, [auth]);
    
    return (
        <AuthContext.Provider value={{ 
            userId, 
            isAuthenticated, 
            authReady, 
            auth, 
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