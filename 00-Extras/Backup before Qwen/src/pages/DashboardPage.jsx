// src/pages/DashboardPage.jsx (FIXED)
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
// You might also want to import useProducts, useInventory, etc. here if you use their data!

const DashboardPage = () => {
    // We can still pull userId, but we REMOVE the isAuthReady check.
    const { userId } = useAuth(); 

    // REMOVED: The unnecessary if (!isAuthReady) { return ... } check.
    // The main App component ensures all critical contexts are loaded before
    // DashboardPage is even rendered.

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">👋 Welcome to InventoryPlus Dashboard</h1>
            <p className="text-gray-600 mb-4">
                This is the main overview of inventory metrics.
            </p>
            <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
                <p className="font-semibold text-yellow-800">
                    <span className="font-bold">Auth Status:</span> Ready. 
                    <span className="ml-2">User ID (for Firestore Path):</span> {userId}
                </p>
            </div>
            {/* Placeholder for metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-white p-6 rounded-xl shadow-lg">Total Products: 450</div>
                <div className="bg-white p-6 rounded-xl shadow-lg">Low Stock Alerts: 12</div>
                <div className="bg-white p-6 rounded-xl shadow-lg">Recent Transactions: 5</div>
            </div>
        </div>
    );
};

export default DashboardPage;