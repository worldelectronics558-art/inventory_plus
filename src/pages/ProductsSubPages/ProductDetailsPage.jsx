
import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

// --- Contexts & Hooks ---
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import useHistoryLogs from '../../hooks/useHistoryLogs'; // Import the history hook

// --- Components & Utils ---
import { getProductDisplayName } from '../../utils/productUtils';
import { formatDate } from '../../utils/formatDate';
import InventoryCard from '../../components/InventoryCard';
import LoadingSpinner from '../../components/LoadingOverlay';
import { EVENT_TYPES } from '../../constants/eventTypes'; 
import { Tag, Bookmark, AlignLeft, Info, Clock, Edit, History, ArrowRight } from 'lucide-react';

const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return 'N/A';
    return timestamp.toDate().toLocaleString();
};

// A smaller, more concise badge for the details page
const MiniEventTypeBadge = ({ type }) => {
    const label = EVENT_TYPES[type]?.label || type.replace('_', ' ');
    const styles = {
        PURCHASE_RECEIVED: 'bg-green-100 text-green-700',
        SALE_DISPATCHED: 'bg-blue-100 text-blue-700',
        STOCK_ADJUSTED: 'bg-yellow-100 text-yellow-700',
        DEFAULT: 'bg-gray-100 text-gray-700'
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[type] || styles.DEFAULT}`}>{label}</span>;
};

const ProductDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // --- Data Fetching ---
    const { products, isLoading: isProductsLoading } = useProducts();
    const { locations, isLoading: isLocationsLoading } = useLocations();
    const { logs: allHistoryLogs, isLoading: isHistoryLoading } = useHistoryLogs();

    const isLoading = isProductsLoading || isLocationsLoading || isHistoryLoading;

    // --- Memoized Data ---
    const product = useMemo(() => !isLoading ? products.find(p => p.id === id) : null, [id, products, isLoading]);

    const productHistory = useMemo(() => {
        if (!product || !allHistoryLogs) return [];
        // Filter logs for this specific product and take the most recent 5
        return allHistoryLogs
            .filter(log => log.productId === product.id)
            .slice(0, 5);
    }, [product, allHistoryLogs]);

    const inventoryCardData = useMemo(() => {
        if (!product) return null;
        const stockByLocation = locations.map(loc => ({ ...loc, stock: product.stockSummary?.byLocation?.[loc.id] || 0 }));
        return {
            productId: product.id,
            displayName: getProductDisplayName(product),
            totalStock: product.stockSummary?.totalInStock ?? product.stockSummary?.inStock ?? 0,
            reorderPoint: product.reorderPoint || 0,
            stockByLocation: stockByLocation,
        };
    }, [product, locations]);

    // --- Render Logic ---
    if (isLoading) {
        return <LoadingSpinner>Loading Product Details...</LoadingSpinner>;
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
            {/* --- Header -- */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">{product.model}</h1>
                    <div className="flex items-center gap-4">
                        <p className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">SKU: {product.sku}</p>
                        <span className={`badge ${product.isSerialized ? 'badge-success' : 'badge-info'}`}>{product.isSerialized ? 'Serialized' : 'Non-Serialized'}</span>
                    </div>
                </div>
                <div className="page-actions">
                    <button onClick={() => navigate(`/products/edit/${product.id}`)} className="btn btn-secondary"><Edit size={16} className="mr-2"/>Edit</button>
                    <button onClick={() => navigate('/products')} className="btn btn-outline-primary">Back</button>
                </div>
            </div>

            <div className="page-content grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info Card */}
                    <div className="card">
                        <h2 className="section-title p-4 border-b">Basic Information</h2>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                            <div className="flex items-center"><Bookmark size={16} className="mr-3 text-gray-500"/><strong>Brand:</strong><span className="ml-2">{product.brand || 'N/A'}</span></div>
                            <div className="flex items-center"><Tag size={16} className="mr-3 text-gray-500"/><strong>Category:</strong><span className="ml-2">{product.category || 'N/A'}</span></div>
                            <div className="flex items-center"><Info size={16} className="mr-3 text-gray-500"/><strong>Reorder At:</strong><span className={`ml-2 font-bold ${product.reorderPoint > 0 ? 'text-red-600' : 'text-gray-600'}`}>{product.reorderPoint > 0 ? product.reorderPoint : 'Not set'}</span></div>
                            {product.updatedAt && (<div className="flex items-center"><Clock size={16} className="mr-3 text-gray-500"/><strong>Last Updated:</strong><span className="ml-2">{formatDate(product.updatedAt)}</span></div>)}
                            <div className="md:col-span-2 mt-2 flex items-start"><AlignLeft size={16} className="mr-3 mt-1 text-gray-500"/><strong>Description:</strong><p className="ml-2 text-gray-700 text-sm">{product.description || 'No description provided.'}</p></div>
                        </div>
                    </div>

                    {/* NEW: Recent History Card */}
                    <div className="card">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="section-title flex items-center gap-2"><History size={18} /> Recent History</h2>
                            <Link to={`/history?search=${product.sku}`} className="btn btn-sm btn-outline-primary flex items-center gap-1">
                                View Full History <ArrowRight size={14}/>
                            </Link>
                        </div>
                        {productHistory.length > 0 ? (
                            <ul className="divide-y divide-gray-100">
                                {productHistory.map(log => (
                                    <li key={log.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                        <div>
                                            <MiniEventTypeBadge type={log.type} />
                                            <p className="text-sm text-gray-600 mt-1">{log.user?.name || 'System'} recorded a change of <span className={`font-bold ${log.type === 'SALE_DISPATCHED' ? 'text-blue-600' : 'text-green-600'}`}>{log.quantity}</span> units.</p>
                                        </div>
                                        <div className="text-right text-xs text-gray-400">{formatTimestamp(log.timestamp)}</div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-6 text-center text-gray-500 italic">No history recorded for this product yet.</div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card">
                        <h2 className="section-title p-4 border-b">Inventory Stock</h2>
                        {inventoryCardData ? (
                            <div className="p-4">
                                <InventoryCard item={inventoryCardData} navigateTo={`/inventory?search=${product.sku}`} />
                            </div>
                        ) : (
                            <div className="p-6 text-center text-gray-500 italic">Inventory data could not be loaded.</div>
                        )}
                    </div>
                    {product.isSerialized && (
                        <div className="text-xs text-center text-gray-500 p-2">Detailed serial numbers are visible on the main Inventory page.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductDetailsPage;
