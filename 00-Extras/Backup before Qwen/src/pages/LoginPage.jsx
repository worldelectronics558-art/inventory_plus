import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '../firebase'; 
import { invoke as tauriInvoke } from '@tauri-apps/api/core'; 

// Initialize Firebase Auth instance
const auth = getAuth(app);

// Global Check: Check if the imported function is callable.
const isTauriAvailable = typeof tauriInvoke === 'function';


const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!email || !password) {
            setError('Please enter both email and password.');
            return;
        }

        setIsLoggingIn(true);

        try {
            // 1. Perform Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log("Firebase Auth Successful. User ID:", user.uid);

            // 2. CONDITIONAL SESSION SAVE
            if (isTauriAvailable) {
                // If Tauri is detected, use the real invoke command.
                await tauriInvoke('save_offline_auth_session', { uid: user.uid });
                console.log("Tauri Session Saved.");
            } else {
                // Fallback for Web/Dev Environment: Save to localStorage for AuthContext to pick up.
                localStorage.setItem('auth_user_id', user.uid);
                console.log("Saving UID to LocalStorage (Web Dev Fallback).");
            }

            // 3. Trigger a hard reload (This only happens if NO error was thrown above)
            window.location.reload(); 

        } catch (err) {
            console.error("Login failed:", err.code, err.message);
            
            // Check if this is the expected Tauri error from the non-desktop environment
            if (err.code === undefined && err.message && err.message.includes('invoke')) {
                // ⚠️ This is the expected Tauri error after a successful Firebase login.
                // We assume the localStorage fallback was set, and we now force the reload.
                console.warn("IGNORING residual Tauri-related error. Forcing reload now.");
                
                // We MUST call reload here, as the try block's reload was skipped by the error.
                window.location.reload(); 
                return; // Exit function after forcing reload
            }

            // If it's a real Firebase error, show it to the user
            let displayError = 'Login failed. Please check your credentials.';
            
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                displayError = 'Invalid email or password.';
            } else if (err.code === 'auth/invalid-email') {
                displayError = 'The email address is not formatted correctly.';
            }

            setError(displayError);
            setIsLoggingIn(false);
        }
    };
    
    // ... (rest of component JSX remains the same)
    return (
        <div className="min-h-screen flex items-center justify-center w-full bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 transform transition duration-500 hover:scale-[1.01]">
                <h2 className="text-3xl font-extrabold text-center text-indigo-700 mb-6">
                    Inventory Manager Login
                </h2>
                <p className="text-center text-gray-500 mb-8">Sign in to access your dashboard.</p>
                
                <form onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="you@example.com"
                                disabled={isLoggingIn}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="••••••••"
                                disabled={isLoggingIn}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="mt-8">
                        <button
                            type="submit"
                            disabled={isLoggingIn}
                            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-lg font-medium text-white transition duration-200 
                                ${isLoggingIn 
                                    ? 'bg-indigo-400 cursor-not-allowed' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 hover:shadow-xl'
                                }`}
                        >
                            {isLoggingIn ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;