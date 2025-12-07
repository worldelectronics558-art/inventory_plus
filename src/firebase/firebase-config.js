// src/firebase/firebase-config.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// CORRECT: Read the configuration directly from the window object injected by index.html
const firebaseConfig = window.__firebase_config;

// Ensure that firebaseConfig is available before trying to initialize
if (!firebaseConfig) {
  throw new Error("Firebase configuration object (window.__firebase_config) is missing. Check index.html.");
}

// Use a singleton pattern to prevent re-initialization, which is robust and safe.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export the initialized services
export const db = getFirestore(app);
export const auth = getAuth(app);
