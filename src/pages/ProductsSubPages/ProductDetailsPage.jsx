// src/pages/ProductsSubPages/ProductDetailsPage.jsx

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProducts } from '../../contexts/ProductContext';
import { useInventory } from '../../contexts/InventoryContext';
import { formatDate } from '../../utils/formatDate';

// --- Reusable Icon Components ---
const EditIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>;
const HistoryIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const LocationIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

// --- Card Components for the Dashboard Layout ---

const ProductSummaryCard = ({ product, navigate }) => {
    if (!product) return null;
    return (
        <div className="card">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{product.model || 'N/A'}</h2>
                    <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => navigate(`/products/edit/${product.id}`)} className="btn btn-secondary-icon"><EditIcon /><span>Edit</span></button>
                    <button onClick={() => navigate(`/history?sku=${product.sku}`)} className="btn btn-secondary-icon"><HistoryIcon /><span>View History</span></button>
                </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                <div><p className="font-semibold text-gray-600">Brand</p><p className="text-gray-800">{product.brand}</p></div>
                <div><p className="font-semibold text-gray-600">Category</p><p className="text-gray-800">{product.category}</p></div>
                {product.reorderPoint && (<div><p className="font-semibold text-gray-600">Reorder Point</p><p className="text-red-600 font-bold">{product.reorderPoint}</p></div>)}
            </div>
            {product.description && (<div className="mt-4 border-t pt-4"><p className="font-semibold text-gray-600">Description</p><p className="text-gray-700 whitespace-pre-wrap">{product.description}</p></div>)}
        </div>
    );
};

const StockLevelCard = ({ stockByLocation, totalStock }) => (
    <div className="card">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Current Stock</h3>
        <div className="flex items-baseline justify-between mb-4 border-b pb-2"><span className="text-gray-600">Total Units:</span><span className="text-3xl font-bold text-indigo-600">{totalStock}</span></div>
        <div className="space-y-3">
            {Object.keys(stockByLocation).length > 0 ? (
                Object.entries(stockByLocation).map(([location, quantity]) => (
                    <div key={location} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100">
                        <div className="flex items-center"><LocationIcon className="text-gray-400 mr-3" /><span className="font-medium text-gray-700">{location}</span></div>
                        <span className="font-bold text-lg text-gray-800">{quantity}</span>
                    </div>
                ))
            ) : <p className="text-center text-gray-500 py-4">No stock recorded.</p>}
        </div>
    </div>
);

const RecentActivityCard = ({ transactions }) => (
    <div className="card">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Recent Activity</h3>
        <div className="space-y-4">
            {transactions.length > 0 ? (
                transactions.map(tx => (
                    <div key={tx.id} className="flex items-center space-x-4 border-b pb-2 last:border-b-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${tx.type === 'Stock In' ? 'bg-green-500' : tx.type === 'Stock Out' ? 'bg-red-500' : 'bg-blue-500'}`}>
                            {tx.type === 'Stock In' ? 'IN' : tx.type === 'Stock Out' ? 'OUT' : 'T'}
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-700">{tx.type}</p>
                            <p className="text-sm text-gray-500">{tx.type === 'Transfer' ? `From ${tx.fromLocation} to ${tx.toLocation}` : `Location: ${tx.location}`}</p>
                            <p className="text-xs text-gray-400">{formatDate(tx.date)}</p>
                        </div>
                        <div className="text-right"><p className={`font-bold text-xl ${tx.type === 'Stock In' ? 'text-green-600' : tx.type === 'Stock Out' ? 'text-red-600' : 'text-gray-700'}`}>{tx.type === 'Stock In' ? '+' : tx.type === 'Stock Out' ? '-' : ''}{tx.quantity}</p></div>
                    </div>
                ))
            ) : <p className="text-center text-gray-500 py-4">No recent transactions.</p>}
        </div>
    </div>
);

// --- MAIN PAGE COMPONENT ---
const ProductDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getProductById, isLoading: isProductsLoading } = useProducts();
    const { inventory, history, isLoading: isInventoryLoading } = useInventory();

    // --- ROBUST LOADING GATE: Wait for ALL contexts to be ready before proceeding ---
    if (isProductsLoading || isInventoryLoading) {
        return <div className="p-8 text-xl text-center">Loading Product Details...</div>;
    }

    // --- SAFE DATA PROCESSING: Only run after the loading gate has passed ---
    const product = getProductById(id);

    const { stockByLocation, totalStock, recentTransactions } = useMemo(() => {
        if (!product) {
            return { stockByLocation: {}, totalStock: 0, recentTransactions: [] };
        }

        // Use `|| []` as a safeguard in case context value is not yet an array
        const stock = (inventory || []).reduce((acc, item) => {
            if (item.sku === product.sku) {
                acc[item.location] = (acc[item.location] || 0) + 1;
            }
            return acc;
        }, {});

        const total = Object.values(stock).reduce((sum, qty) => sum + qty, 0);

        const transactions = (history || [])
            .filter(tx => tx.sku === product.sku)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        return { stockByLocation: stock, totalStock: total, recentTransactions: transactions };
    }, [product, inventory, history]);

    // Handle case where product is not found after loading is complete
    if (!product) {
        return <div className="p-8 text-2xl text-center text-red-500">Product not found.</div>;
    }

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <h1 className="page-title">Product Dashboard</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <ProductSummaryCard product={product} navigate={navigate} />
                    <RecentActivityCard transactions={recentTransactions} />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <StockLevelCard stockByLocation={stockByLocation} totalStock={totalStock} />
                </div>
            </div>
        </div>
    );
};

export default ProductDetailsPage;
