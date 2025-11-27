// src/pages/InventoryPage.jsx
import React, { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useProducts } from '../contexts/ProductContext';
import { useLookups } from '../contexts/LookupContext';

// Helper function to find product name by ID
const getProductName = (products, productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
};

// --- Component: Stock Level Display ---
const StockLevelTable = ({ stockLevels, products, locations }) => {
    // Get a list of all unique product IDs currently in stock
    const productIdsInStock = Object.keys(stockLevels);

    return (
        <div className="bg-white shadow overflow-hidden rounded-lg">
            <h2 className="text-2xl font-semibold p-4 border-b">Current Inventory Stock</h2>
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        {/* Dynamically create location columns */}
                        {locations.map(loc => (
                            <th key={loc} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {loc}
                            </th>
                        ))}
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Stock</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {productIdsInStock.map(productId => {
                        const productLevels = stockLevels[productId];
                        const totalStock = locations.reduce((sum, loc) => sum + (productLevels[loc] || 0), 0);

                        return (
                            <tr key={productId}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {getProductName(products, productId)}
                                </td>
                                {locations.map(loc => (
                                    <td key={loc} className={`px-6 py-4 whitespace-nowrap text-center text-sm ${
                                        (productLevels[loc] || 0) <= 5 ? 'text-red-600 font-bold' : 'text-gray-700'
                                    }`}>
                                        {productLevels[loc] || 0}
                                    </td>
                                ))}
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-blue-600">
                                    {totalStock}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {productIdsInStock.length === 0 && (
                 <p className="p-6 text-center text-gray-500">No transactions recorded yet.</p>
            )}
        </div>
    );
};

// --- Component: Stock Movement Form (IN/OUT) ---
const StockMovementForm = ({ products, locations }) => {
    const { createTransaction } = useInventory();
    const [transactionType, setTransactionType] = useState('IN');
    const [formData, setFormData] = useState({
        productId: products[0]?.id || '',
        locationId: locations[0] || '',
        quantity: 0,
        notes: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const finalData = {
            ...formData,
            type: transactionType,
            quantity: parseInt(formData.quantity, 10), // Ensure quantity is a number
        };

        if (finalData.quantity <= 0) {
            return alert("Quantity must be greater than zero.");
        }
        
        try {
            await createTransaction(finalData);
            alert(`${transactionType === 'IN' ? 'Stock In' : 'Stock Out'} transaction recorded successfully!`);
            setFormData(prev => ({ ...prev, quantity: 0, notes: '' })); // Reset form
        } catch (error) {
            alert(`Failed to record transaction: ${error.message}`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
            <h3 className="text-xl font-semibold mb-4">Stock Movement</h3>
            
            {/* IN/OUT Selector */}
            <div className="flex space-x-4">
                <button
                    type="button"
                    onClick={() => setTransactionType('IN')}
                    className={`flex-1 py-2 rounded-lg transition-colors ${
                        transactionType === 'IN' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    }`}
                >
                    STOCK IN (Add)
                </button>
                <button
                    type="button"
                    onClick={() => setTransactionType('OUT')}
                    className={`flex-1 py-2 rounded-lg transition-colors ${
                        transactionType === 'OUT' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                    }`}
                >
                    STOCK OUT (Remove)
                </button>
            </div>

            {/* Product Selector */}
            <select name="productId" value={formData.productId} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-lg">
                <option value="" disabled>Select Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
            
            {/* Location Selector */}
            <select name="locationId" value={formData.locationId} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-lg">
                <option value="" disabled>Select Location</option>
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>

            {/* Quantity */}
            <input
                type="number"
                name="quantity"
                value={formData.quantity || ''}
                onChange={handleChange}
                placeholder="Quantity"
                required
                min="1"
                className="w-full p-2 border border-gray-300 rounded-lg"
            />
             {/* Notes */}
            <input
                type="text"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Notes (optional)"
                className="w-full p-2 border border-gray-300 rounded-lg"
            />

            <button
                type="submit"
                className={`w-full py-2 rounded-lg font-semibold text-white transition-colors ${
                    transactionType === 'IN' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
            >
                Record {transactionType === 'IN' ? 'Stock In' : 'Stock Out'}
            </button>
        </form>
    );
};


// --- Main Inventory Page Component ---
const InventoryPage = () => {
    const { stockLevels, isLoading: isInventoryLoading } = useInventory();
    const { products, isLoading: isProductsLoading } = useProducts();
    const { lookups, isLoading: isLookupsLoading } = useLookups();

    if (isInventoryLoading || isProductsLoading || isLookupsLoading || !lookups) {
        return <div className="p-8 text-xl text-center">Loading Inventory Data...</div>;
    }

    const locations = lookups.locations || [];
    
    // Ensure products is an array, not a loading placeholder
    const availableProducts = products || [];

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Warehouse & Store Inventory</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Column 1: Stock Movement Form */}
                <div className="lg:col-span-1">
                    <StockMovementForm 
                        products={availableProducts}
                        locations={locations}
                    />
                </div>
                
                {/* Column 2/3: Stock Level Table */}
                <div className="lg:col-span-2">
                    <StockLevelTable 
                        stockLevels={stockLevels} 
                        products={availableProducts}
                        locations={locations}
                    />
                </div>
                
            </div>
        </div>
    );
};

export default InventoryPage;