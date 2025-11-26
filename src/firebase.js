// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

// Get config and token from Tauri-injected globals
const FIREBASE_CONFIG = window.__firebase_config;
const INITIAL_AUTH_TOKEN = window.__initial_auth_token;

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Perform initial sign-in using custom token.
 * Anonymous login is NO LONGER SUPPORTED.
 * Returns UID on success, null on failure.
 */
async function initialAuth() {
  if (!INITIAL_AUTH_TOKEN) {
    console.warn('No initial auth token provided. Authentication cannot proceed.');
    return null;
  }

  try {
    const userCredential = await signInWithCustomToken(auth, INITIAL_AUTH_TOKEN);
    console.log('Signed in with custom token:', userCredential.user.uid);
    return userCredential.user.uid;
  } catch (error) {
    console.error('Custom token sign-in failed:', error);
    return null;
  }
}

export { db, auth, app, initialAuth };