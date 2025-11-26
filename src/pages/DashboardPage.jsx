// src/pages/DashboardPage.jsx

import React, { useState } from 'react'; // Import useState
import { useAuth } from '../contexts/AuthContext';
import localforage from 'localforage'; // Import localforage

const DashboardPage = () => {
    const { userId } = useAuth();
    const [isClearingCache, setIsClearingCache] = useState(false); // State for button loading state

    // Function to clear the localforage cache
    const handleClearCache = async () => {
        if (!window.confirm("Are you sure you want to clear the local cache? This will remove all offline data. The app will reload.")) {
            return; // Exit if user cancels
        }

        setIsClearingCache(true); // Show loading state on button
        try {
            await localforage.clear();
            console.log("LocalForage cache cleared successfully!");
            alert("Local cache cleared successfully. The app will now reload.");
            // Optionally, reload the page to ensure all components re-fetch data from the network
            window.location.reload();
        } catch (err) {
            console.error("Failed to clear localforage cache:", err);
            alert(`Failed to clear cache: ${err.message}`);
            setIsClearingCache(false); // Reset loading state on error
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">👋 Welcome to InventoryPlus Dashboard (PLACEHOLDER)</h1>
            <p className="text-gray-600 mb-4">
                This is the main overview of inventory metrics.
            </p>
            <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-lg mb-6"> {/* Added mb-6 for spacing */}
                <p className="font-semibold text-yellow-800">
                    <span className="font-bold">Auth Status:</span> Ready.
                    <span className="ml-2">User ID (for Firestore Path):</span> {userId}
                </p>
            </div>

            {/* NEW: Clear Cache Button */}
            <div className="mb-6"> {/* Added container div with margin for spacing */}
                <button
                    onClick={handleClearCache}
                    disabled={isClearingCache} // Disable button while clearing
                    className={`btn ${isClearingCache ? 'btn-disabled opacity-50' : 'btn-danger'}`} // Use themed button class, change style when disabled
                >
                    {isClearingCache ? 'Clearing Cache...' : 'Clear Local Cache (Dev/Debug)'} {/* Change text based on state */}
                </button>
            </div>
            {/* END NEW: Clear Cache Button */}

            {/* Placeholder for metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="card p-6 rounded-xl shadow-lg">Total Products: 450</div>
                <div className="card p-6 rounded-xl shadow-lg">Low Stock Alerts: 12</div>
                <div className="card p-6 rounded-xl shadow-lg">Recent Transactions: 5</div>
            </div>
        </div>
    );
};

export default DashboardPage;