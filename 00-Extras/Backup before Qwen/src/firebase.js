// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';

// 1. Get configuration from the global environment variables
const FIREBASE_CONFIG = window.__firebase_config;
const INITIAL_AUTH_TOKEN = window.__initial_auth_token;

// 2. Initialize Firebase App
const app = initializeApp(FIREBASE_CONFIG);

// 3. Initialize services
const db = getFirestore(app);
const auth = getAuth(app);

// 4. Authentication Logic
async function initialAuth() {
  try {
    if (INITIAL_AUTH_TOKEN) {
      // Preferred method: Use the provided custom token
      const userCredential = await signInWithCustomToken(auth, INITIAL_AUTH_TOKEN);
      return userCredential.user.uid;
    } else {
      // Fallback: Use anonymous sign-in if no token is available
      const userCredential = await signInAnonymously(auth);
      return userCredential.user.uid;
    }
  } catch (error) {
    console.error("Firebase Authentication failed:", error);
    // In a real app, you would show an error screen here
    return null;
  }
}

export { db, auth, initialAuth, app };