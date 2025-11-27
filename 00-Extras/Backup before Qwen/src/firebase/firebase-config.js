// src/firebase/firebase-config.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// IMPORTANT: Include the necessary auth methods
import { getAuth } from "firebase/auth"; 

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC0Umv5ZJwCaTjFp2yK6OiUeVve8RHqbz8",
    authDomain: "inventoryplus-a2439.firebaseapp.com",
    projectId: "inventoryplus-a2439",
    storageBucket: "inventoryplus-a2439.firebasestorage.app",
    messagingSenderId: "654840001369",
    appId: "1:654840001369:web:21627f25806cc8a4059248"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app); 

// REMOVED: The initialAuth function previously used for anonymous login is now gone.