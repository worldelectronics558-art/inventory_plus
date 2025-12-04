
// src/pages/ProductsSubPages/ProductDetailsPage.jsx

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Contexts & Utils
import { useProducts } from '../../contexts/ProductContext';
import { useInventory } from '../../contexts/InventoryContext';
import { formatDate } from '../../utils/formatDate';
import { processTransactions } from '../../utils/transactionUtils';

// Components
import useMediaQuery from '../../hooks/useMediaQuery';
import TransactionCard from '../../components/TransactionCard';
import { Tag, Bookmark, AlignLeft, Info, Clock, Edit, History, MapPin } from 'lucide-react';

const ProductDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    // Data Hooks
    const { products, isLoading: isProductsLoading } = useProducts();
    const { transactions, stockLevels, isLoading: isInventoryLoading } = useInventory();

    const isLoading = isProductsLoading || isInventoryLoading;

    // Memoized Product Data
    const product = useMemo(() => 
        !isLoading ? products.find(p => p.id === id) : null
    , [id, products, isLoading]);

    // Memoized Inventory & Transaction Data using Central Utility
    const totalTransactionCount = useMemo(() => 
        product ? transactions.filter(tx => tx.sku === product.sku).length : 0
    , [product, transactions]);

    const recentLogs = useMemo(() => {
        if (!product) return [];
        const processed = processTransactions({ transactions, sku: product.sku });
        return processed.slice(0, 5);
    }, [product, transactions]);

    const currentInventoryByLocation = useMemo(() => 
        product && stockLevels[product.sku] ? Object.entries(stockLevels[product.sku]) : []
    , [product, stockLevels]);
    
    const totalInventory = useMemo(() => 
        currentInventoryByLocation.reduce((sum, [, quantity]) => sum + quantity, 0)
    , [currentInventoryByLocation]);

    if (isLoading) {
        return <div className="p-8 text-center text-xl">Loading Product Details...</div>;
    }

    if (!product) {
        return (
            <div className="card text-center p-8">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Product Not Found</h1>
                <p>The product with ID "{id}" could not be found.</p>
                <button onClick={() => navigate('/products')} className="btn btn-primary mt-6">Back to Products</button>
            </div>
        );
    }

    return (
        <div>
            {/* --- Header --- */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="page-title">{product.model}</h1>
                    <p className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block">SKU: {product.sku}</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => navigate(`/products/edit/${product.id}`)} className="btn btn-secondary"><Edit size={16} className="mr-2"/>Edit</button>
                    <button onClick={() => navigate('/products')} className="btn btn-outline-primary">Back</button>
                </div>
            </div>

            {/* --- Basic Information Card --- */}
            <div className="card mb-6">
                <h2 className="section-title">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center"><Bookmark size={16} className="mr-3 text-primary-600"/><strong>Brand:</strong><span className="ml-2">{product.brand || 'N/A'}</span></div>
                    <div className="flex items-center"><Tag size={16} className="mr-3 text-primary-600"/><strong>Category:</strong><span className="ml-2">{product.category || 'N/A'}</span></div>
                    <div className="flex items-center"><Info size={16} className="mr-3 text-primary-600"/><strong>Reorder At:</strong><span className={`ml-2 font-bold ${product.reorderPoint > 0 ? 'text-red-600' : 'text-gray-600'}`}>{product.reorderPoint > 0 ? product.reorderPoint : 'Not set'}</span></div>
                    {product.updatedAt && (<div className="flex items-center"><Clock size={16} className="mr-3 text-primary-600"/><strong>Last Updated:</strong><span className="ml-2">{formatDate(product.updatedAt)}</span></div>)}
                    <div className="col-span-full mt-2 flex items-start"><AlignLeft size={16} className="mr-3 mt-1 text-primary-600"/><strong>Description:</strong><span className="ml-2 text-gray-700 italic">{product.description || 'No description provided.'}</span></div>
                </div>
            </div>

            {/* --- Inventory Levels Card --- */}
            <div className="card mb-6">
                <h2 className="section-title flex items-center"><MapPin size={20} className="mr-3 text-primary-600"/>Inventory Levels</h2>
                {currentInventoryByLocation.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm"><thead><tr><th className="p-2 text-left font-semibold">Location</th><th className="p-2 text-center font-semibold">Quantity</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {currentInventoryByLocation.map(([loc, qty]) => (<tr key={loc}><td className="p-2">{loc}</td><td className="p-2 text-center font-bold">{qty}</td></tr>))}
                                <tr className="font-bold bg-gray-50"><td className="p-2">Total</td><td className="p-2 text-center">{totalInventory}</td></tr>
                            </tbody>
                        </table>
                    </div>
                ) : <p className="text-gray-500 italic">No inventory recorded for this product.</p>}
            </div>

            {/* --- Transaction History Card --- */}
            <div className="card">
                <h2 className="section-title flex items-center"><History size={20} className="mr-3 text-primary-600"/>Recent Transaction History</h2>
                {recentLogs.length === 0 ? (
                    <p className="text-gray-500 italic">No transaction history for this product.</p>
                ) : isMobile ? (
                    <div className="-mx-4 -mb-4 mt-4 bg-gray-50 p-4 rounded-b-lg">
                        {recentLogs.map(tx => <TransactionCard key={tx.id} transaction={tx} product={product} />)}
                    </div>
                ) : (
                    <div className="overflow-x-auto mt-4">
                         <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50"><tr>
                                <th className="p-2 text-left">Type</th>
                                <th className="p-2 text-left">Change</th>
                                <th className="p-2 text-left">Qty After</th>
                                <th className="p-2 text-left">Location</th>
                                <th className="p-2 text-left">Date</th>
                                <th className="p-2 text-left">User</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentLogs.map(tx => {
                                    const changeColor = tx.isGrouped ? 'text-blue-600' : (tx.quantityChange > 0 ? 'text-green-600' : 'text-red-600');
                                    const changePrefix = tx.isGrouped ? '' : (tx.quantityChange > 0 ? '+' : '-');
                                    const quantity = Math.abs(tx.quantityChange);
                                    return (
                                        <tr key={tx.id}>
                                            <td className="p-2 font-semibold">{tx.type}</td>
                                            <td className={`p-2 font-bold ${changeColor}`}>{changePrefix}{quantity}</td>
                                            <td className="p-2 font-bold">{tx.quantityAfter}</td>
                                            <td className="p-2">{tx.isGrouped ? `${tx.fromLocation} → ${tx.toLocation}` : tx.location}</td>
                                            <td className="p-2">{formatDate(tx.timestamp)}</td>
                                            <td className="p-2 text-gray-500">{tx.userEmail || 'System'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {totalTransactionCount > 5 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 text-right">
                        <button onClick={() => navigate(`/products/history/${product.sku}`)} className="btn btn-secondary">View All History</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductDetailsPage;
