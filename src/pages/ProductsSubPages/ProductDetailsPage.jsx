// src/pages/ProductsSubPages/ProductDetailsPage.jsx

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { formatDate } from '../../utils/formatDate';
import InventoryCard from '../../components/InventoryCard';
import { Tag, Bookmark, AlignLeft, Info, Clock, Edit } from 'lucide-react';

const ProductDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const { products, isLoading: isProductsLoading } = useProducts();
    const { locations, isLoading: isLocationsLoading } = useLocations();

    const isLoading = isProductsLoading || isLocationsLoading;

    const product = useMemo(() => 
        !isLoading ? products.find(p => p.id === id) : null
    , [id, products, isLoading]);

    const inventoryCardData = useMemo(() => {
        if (!product) return null;

        const stockByLocation = locations.map(loc => ({
            ...loc,
            stock: product.stockSummary?.byLocation?.[loc.id] || 0
        }));

        return {
            productId: product.id,
            displayName: getProductDisplayName(product),
            totalStock: product.stockSummary?.inStock || 0,
            reorderPoint: product.reorderPoint || 0,
            stockByLocation: stockByLocation,
        };
    }, [product, locations]);

    if (isLoading) {
        return <div className="p-8 text-center text-xl">Loading Product Details...</div>;
    }

    if (!product) {
        return (
            <div className="details-card text-center p-8">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Product Not Found</h1>
                <p>The product with ID "{id}" could not be found.</p>
                <button onClick={() => navigate('/products')} className="btn btn-primary mt-6">Back to Products</button>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{product.model}</h1>
                    <div className="flex items-center gap-4">
                        <p className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block">SKU: {product.sku}</p>
                        <span className={`badge ${product.isSerialized ? 'badge-success' : 'badge-info'}`}>
                            {product.isSerialized ? 'Serialized' : 'Non-Serialized'}
                        </span>
                    </div>
                </div>
                <div className="page-actions">
                    <button onClick={() => navigate(`/products/edit/${product.id}`)} className="btn btn-secondary"><Edit size={16} className="mr-2"/>Edit</button>
                    <button onClick={() => navigate('/products')} className="btn btn-outline-primary">Back</button>
                </div>
            </div>

            <div className="details-card mb-6">
                <h2 className="section-title">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                    <div className="flex items-center"><Bookmark size={16} className="mr-3 text-primary-600"/><strong>Brand:</strong><span className="ml-2">{product.brand || 'N/A'}</span></div>
                    <div className="flex items-center"><Tag size={16} className="mr-3 text-primary-600"/><strong>Category:</strong><span className="ml-2">{product.category || 'N/A'}</span></div>
                    <div className="flex items-center"><Info size={16} className="mr-3 text-primary-600"/><strong>Reorder At:</strong><span className={`ml-2 font-bold ${product.reorderPoint > 0 ? 'text-red-600' : 'text-gray-600'}`}>{product.reorderPoint > 0 ? product.reorderPoint : 'Not set'}</span></div>
                    {product.updatedAt && (<div className="flex items-center"><Clock size={16} className="mr-3 text-primary-600"/><strong>Last Updated:</strong><span className="ml-2">{formatDate(product.updatedAt)}</span></div>)}
                    <div className="md:col-span-2 mt-2 flex items-start"><AlignLeft size={16} className="mr-3 mt-1 text-primary-600"/><strong>Description:</strong><p className="ml-2 text-gray-700 italic text-sm">{product.description || 'No description provided.'}</p></div>
                </div>
            </div>

            <div>
                <h2 className="section-title">Inventory</h2>
                {inventoryCardData ? (
                    <InventoryCard 
                        item={inventoryCardData} 
                        navigateTo={`/inventory?search=${product.sku}`}
                    />
                ) : (
                    <div className="details-card text-center text-gray-500 italic p-4">
                        Inventory data could not be loaded.
                    </div>
                )}
                 {product.isSerialized && (
                    <div className="text-xs text-center text-gray-500 p-2 mt-2">Detailed serial numbers are now visible on the main Inventory page.</div>
                )}
            </div>
        </div>
    );
};

export default ProductDetailsPage;
