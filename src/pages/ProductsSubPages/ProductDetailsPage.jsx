
// src/pages/ProductsSubPages/ProductDetailsPage.jsx

import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProducts } from '../../contexts/ProductContext';
import { useInventory } from '../../contexts/InventoryContext';
import { formatDate } from '../../utils/formatDate';
import { Tag, Bookmark, AlignLeft, Info, Clock, Edit, MapPin, ChevronDown, ChevronRight } from 'lucide-react';

// A new component for displaying expandable location details
const LocationInventory = ({ location, items }) => {
    const [isOpen, setIsOpen] = useState(true);
    const total = items.length;

    return (
        <div className="border rounded-md mb-2 bg-gray-50">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-3 bg-gray-100 hover:bg-gray-200"
            >
                <div className="flex items-center">
                    {isOpen ? <ChevronDown size={20} className="mr-2"/> : <ChevronRight size={20} className="mr-2"/>}
                    <span className="font-semibold text-gray-800">{location}</span>
                </div>
                <span className={`font-bold text-lg px-2 py-0.5 rounded ${total > 0 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'}`}>{total}</span>
            </button>
            {isOpen && (
                <div className="p-2">
                    {total > 0 ? (
                        <table className="min-w-full text-sm mt-1">
                            <thead>
                                <tr>
                                    <th className="p-2 text-left font-semibold">Serial Number</th>
                                    <th className="p-2 text-left font-semibold">Stocked On</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {items.map(item => (
                                    <tr key={item.id}>
                                        <td className="p-2 font-mono">{item.serialNumber} {item.internalSerialNumber && <span className="text-xs text-gray-400">(auto)</span>}</td>
                                        <td className="p-2 text-gray-600">{formatDate(item.stockInDate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="p-4 text-center text-gray-500 italic">No items in stock at this location.</p>
                    )}
                </div>
            )}
        </div>
    );
};


const ProductDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Data Hooks - Now using inventoryItems
    const { products, isLoading: isProductsLoading } = useProducts();
    const { inventoryItems, isLoading: isInventoryLoading } = useInventory();

    const isLoading = isProductsLoading || isInventoryLoading;

    // Memoized Product Data
    const product = useMemo(() => 
        !isLoading ? products.find(p => p.id === id) : null
    , [id, products, isLoading]);

    // --- NEW INVENTORY DATA PROCESSING ---
    const inventoryByLocation = useMemo(() => {
        if (!product) return new Map();

        const grouped = new Map();
        inventoryItems
            .filter(item => item.sku === product.sku && item.status === 'in_stock')
            .forEach(item => {
                const location = item.location || 'Unassigned';
                if (!grouped.has(location)) {
                    grouped.set(location, []);
                }
                grouped.get(location).push(item);
            });
        
        // Sort items within each location by stock-in date (FIFO)
        for (let items of grouped.values()) {
            items.sort((a, b) => (a.stockInDate?.toDate() || 0) - (b.stockInDate?.toDate() || 0));
        }

        return grouped;
    }, [product, inventoryItems]);

    const totalInventory = useMemo(() => {
        let count = 0;
        for (let items of inventoryByLocation.values()) {
            count += items.length;
        }
        return count;
    }, [inventoryByLocation]);
    
    // --- END NEW INVENTORY PROCESSING ---

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
            {/* --- Header (includes new isSerialized flag) --- */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="page-title">{product.model}</h1>
                    <div className="flex items-center gap-4">
                        <p className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block">SKU: {product.sku}</p>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${product.isSerialized ?? true ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {product.isSerialized ?? true ? 'Serialized' : 'Non-Serialized'}
                        </span>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => navigate(`/products/edit/${product.id}`)} className="btn btn-secondary"><Edit size={16} className="mr-2"/>Edit</button>
                    <button onClick={() => navigate('/products')} className="btn btn-outline-primary">Back</button>
                </div>
            </div>

            {/* --- Basic Information Card (Unchanged) --- */}
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

            {/* --- NEW, REDESIGNED Inventory Levels Card --- */}
            <div className="card mb-6">
                <div className="flex justify-between items-center">
                    <h2 className="section-title flex items-center"><MapPin size={20} className="mr-3 text-primary-600"/>Inventory Levels</h2>
                    <p className="font-bold text-xl">Total Stock: {totalInventory}</p>
                </div>
                <div className="mt-4">
                    {inventoryByLocation.size > 0 ? (
                        Array.from(inventoryByLocation.entries()).map(([location, items]) => (
                            <LocationInventory key={location} location={location} items={items} />
                        ))
                    ) : (
                        <p className="text-gray-500 italic p-4 text-center">No inventory recorded for this product.</p>
                    )}
                </div>
            </div>

            {/* Transaction history removed for now, will be replaced by Event Log */}

        </div>
    );
};

export default ProductDetailsPage;
