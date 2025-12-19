// src/pages/DashboardPage.jsx

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useProducts } from '../contexts/ProductContext';
import localforage from 'localforage';

const MetricCard = ({ title, value, isLoading }) => (
    <div className="card p-6 rounded-xl shadow-lg">
        <h3 className="text-gray-500 font-semibold mb-2">{title}</h3>
        {isLoading ? (
            <div className="animate-pulse bg-gray-300 h-8 w-1/2 rounded-md"></div>
        ) : (
            <p className="text-3xl font-bold text-gray-800">{value}</p>
        )}
    </div>
);

const DashboardPage = () => {
    const { currentUser } = useUser();
    const { userId } = useAuth();
    const { products, isLoading: isLoadingProducts } = useProducts();
    const [isClearingCache, setIsClearingCache] = React.useState(false);

    const handleClearCache = async () => {
        if (!window.confirm("Are you sure you want to clear the local cache? This will remove all offline data. The app will reload.")) {
            return;
        }

        setIsClearingCache(true);
        try {
            await localforage.clear();
            alert("Local cache cleared successfully. The app will now reload.");
            window.location.reload();
        } catch (err) {
            console.error("Failed to clear localforage cache:", err);
            alert(`Failed to clear cache: ${err.message}`);
            setIsClearingCache(false);
        }
    };

    const totalProducts = products.length;
    const lowStockItems = products.filter(p => {
        if (!p.reorderPoint) return false;
        const totalStock = p.stockSummary?.totalInStock ?? p.stockSummary?.inStock ?? 0;
        return totalStock <= p.reorderPoint;
    }).length;

    return (
        <div className="min-h-screen bg-gray-100">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">👋 Welcome to InventoryPlus</h1>
            <h2 className="text-gray-600 mb-4">
                Here is a real-time overview of your inventory metrics.
            </h2>
            <div className="p-4 bg-blue-100 border border-blue-400 rounded-lg mb-6">
                <p className="font-semibold text-blue-800">
                    <span className="font-bold">Auth Status:</span> Ready. 
                    <span className="ml-4 font-normal text-sm">User ID (for Firestore Path): {userId}</span>
                </p>
                <p className="font-semibold text-blue-800">
                    <span className="font-bold">User Info:</span> Loaded.
                    <span className="ml-4 font-normal text-sm">User Name: {currentUser.displayName}</span>
                </p>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                <MetricCard title="Total Products" value={totalProducts} isLoading={isLoadingProducts} />
                <MetricCard title="Low Stock Items" value={lowStockItems} isLoading={isLoadingProducts} />
                {/* Placeholder for future metrics */}
                 <div className="card p-6 rounded-xl shadow-lg bg-gray-50">
                    <h3 className="text-gray-400 font-semibold mb-2">Upcoming Feature</h3>
                    <p className="text-3xl font-bold text-gray-400">-</p>
                </div>
                <div className="card p-6 rounded-xl shadow-lg bg-gray-50">
                    <h3 className="text-gray-400 font-semibold mb-2">Upcoming Feature</h3>
                    <p className="text-3xl font-bold text-gray-400">-</p>
                </div>
            </div>
            
            {/* Developer Tools Section */}
            <div className="mt-12 p-4 bg-gray-200 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Developer Tools</h2>
                <button
                    onClick={handleClearCache}
                    disabled={isClearingCache}
                    className={`btn ${isClearingCache ? 'btn-disabled opacity-50' : 'btn-danger'}`}
                >
                    {isClearingCache ? 'Clearing Cache...' : 'Clear Local Cache (Debug)'}
                </button>
            </div>
        </div>
    );
};

export default DashboardPage;
