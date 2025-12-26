
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Sliders, ChevronDown, ChevronRight, FileText, AlertTriangle } from 'lucide-react';

// --- Hooks & Contexts ---
import useHistoryLogs from '../hooks/useHistoryLogs';
import { useProducts } from '../contexts/ProductContext';
import { useLocations } from '../contexts/LocationContext'; // Import useLocations
import LoadingSpinner from '../components/LoadingOverlay';
import ReusableDatePicker from '../components/ReusableDatePicker';

// --- Constants & Utils ---
import { EVENT_TYPES } from '../constants/eventTypes';
import { getProductDisplayName } from '../utils/productUtils';
import { endOfDay } from 'date-fns';

const formatTimestamp = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleString();
};

const EventTypeBadge = ({ type }) => {
    const typeDetails = Object.values(EVENT_TYPES).find(t => t.key === type);
    const label = typeDetails ? typeDetails.label : type.replace('_', ' ');
    const typeStyles = {
        PURCHASE_RECEIVED: 'bg-green-100 text-green-700',
        SALE_DISPATCHED: 'bg-blue-100 text-blue-700',
        STOCK_ADJUSTED: 'bg-yellow-100 text-yellow-700',
        DEFAULT: 'bg-gray-100 text-gray-700'
    };
    const style = typeStyles[type] || typeStyles.DEFAULT;
    return <span className={`badge ${style}`}>{label}</span>;
};

const HistoryPage = () => {
    const location = useLocation();
    const { logs, isLoading: logsLoading, error } = useHistoryLogs();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations(); // Use locations hook

    // --- STATE MANAGEMENT ---
    const [searchTerm, setSearchTerm] = useState('');
    const [eventTypeFilter, setEventTypeFilter] = useState('');
    const [dateRange, setDateRange] = useState([null, null]);
    const [expandedOperations, setExpandedOperations] = useState(new Set());

    // --- DATA TRANSFORMATION & FILTERING ---
    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}), [products]);
    const locationMap = useMemo(() => locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.name }), {}), [locations]); // Create location map

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const searchQuery = params.get('search');
        if (searchQuery) {
            setSearchTerm(searchQuery);
        }
    }, [location.search]);

    const groupedAndFilteredOperations = useMemo(() => {
        const groupedByOp = logs.reduce((acc, log) => {
            const opId = log.operationId || log.id;
            if (!acc[opId]) {
                acc[opId] = {
                    operationId: opId,
                    timestamp: log.timestamp,
                    user: log.user,
                    type: log.type,
                    context: log.context,
                    items: [],
                    totalQuantity: 0,
                    involvedSkus: new Set(),
                };
            }
            acc[opId].items.push({
                ...log,
                productName: log.productId ? getProductDisplayName(productMap[log.productId] || { name: 'Unknown' }) : 'N/A',
                locationName: locationMap[log.locationId] || log.locationId || 'N/A',
            });
            acc[opId].totalQuantity += log.quantity;
            if (log.sku) acc[opId].involvedSkus.add(log.sku);
            return acc;
        }, {});

        const [startDate, endDate] = dateRange;
        return Object.values(groupedByOp).filter(op => {
            if (startDate && op.timestamp?.toDate() < startDate) return false;
            if (endDate && op.timestamp?.toDate() > endOfDay(endDate)) return false;
            if (eventTypeFilter && op.type !== eventTypeFilter) return false;

            const term = searchTerm.toLowerCase();
            if (term) {
                const opMatch = 
                    (op.user?.name?.toLowerCase().includes(term)) ||
                    (op.context?.documentNumber?.toLowerCase().includes(term)) ||
                    (op.operationId?.toLowerCase().includes(term));

                const itemMatch = op.items.some(item => 
                    item.productName.toLowerCase().includes(term) ||
                    item.sku?.toLowerCase().includes(term)
                );

                if (!opMatch && !itemMatch) return false;
            }
            return true;
        });
    }, [logs, searchTerm, eventTypeFilter, dateRange, productMap, locationMap]);

    const toggleOperation = (opId) => {
        setExpandedOperations(prev => {
            const next = new Set(prev);
            if (next.has(opId)) next.delete(opId); else next.add(opId);
            return next;
        });
    };

    const isLoading = logsLoading || productsLoading || locationsLoading; // Add locations loading

    if (isLoading) return <LoadingSpinner>Loading History...</LoadingSpinner>;
    if (error) return <div className="page-container"><p className="text-red-500">Error: {error.message}</p></div>;

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Inventory History</h1>
            </header>

            <div className="card">
                <div className="p-4 bg-gray-50/80 border-b grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-1">
                        <div className="search-input-container">
                            <Search size={18} className="search-input-icon" />
                            <input type="text" placeholder="Search Product, SKU, User, Document..." className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">
                        <ReusableDatePicker dateRange={dateRange} setDateRange={setDateRange} />
                        <div className="flex items-center gap-2">
                            <Sliders size={18} className="text-gray-400"/>
                            <select className="input-base w-full" value={eventTypeFilter} onChange={e => setEventTypeFilter(e.target.value)}>
                                <option value="">All Event Types</option>
                                {Object.values(EVENT_TYPES).map(type => (
                                    <option key={type.key} value={type.key}>{type.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th className="w-12"></th>
                                <th>Operation</th>
                                <th>SKUs</th>
                                <th>Total Qty</th>
                                <th>User</th>
                                <th>Timestamp</th>
                                <th>Document</th>
                                <th className="w-24"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedAndFilteredOperations.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-12 text-gray-500">
                                    <div className="flex flex-col items-center">
                                        <AlertTriangle className="mb-2" />
                                        <p className="font-semibold">No History Found</p>
                                        <p className="text-sm">No records match your current filters.</p>
                                    </div>
                                </td></tr>
                            ) : (
                                groupedAndFilteredOperations.map(op => {
                                    const isExpanded = expandedOperations.has(op.operationId);
                                    return (
                                        <React.Fragment key={op.operationId}>
                                            <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleOperation(op.operationId)}>
                                                <td className="text-center"><div className="p-1 rounded-full hover:bg-gray-200">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div></td>
                                                <td><EventTypeBadge type={op.type} /></td>
                                                <td className="font-mono text-xs max-w-xs truncate" title={[...op.involvedSkus].join(', ')}>{ [...op.involvedSkus].join(', ') }</td>
                                                <td className={`font-bold text-center text-lg ${op.type === 'SALE_DISPATCHED' ? 'text-red-500' : 'text-green-600'}`}>
                                                    {op.type === 'SALE_DISPATCHED' ? '-' : '+'}{op.totalQuantity}
                                                </td>
                                                <td>{op.user?.name || 'System'}</td>
                                                <td>{formatTimestamp(op.timestamp)}</td>
                                                <td>
                                                    {op.context?.documentId ? (
                                                        <Link to={`/${op.context.type === 'SALES_ORDER' ? 'sales/view' : 'purchase/view'}/${op.context.documentId}`} className="text-blue-600 hover:underline">{op.context.documentNumber}</Link>
                                                    ) : 'N/A'}
                                                </td>
                                                <td className="text-right">
                                                    <button onClick={(e) => { e.stopPropagation(); toggleOperation(op.operationId); }} className="btn btn-sm btn-outline-primary">{isExpanded ? 'Hide' : 'Show'}</button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan="8" className="p-0">
                                                        <div className="p-3">
                                                            <table className="w-full text-sm">
                                                                <thead><tr className="bg-gray-100">
                                                                    <th className="p-2 text-left font-semibold">Product</th>
                                                                    <th className="p-2 text-left font-semibold">SKU</th>
                                                                    <th className="p-2 text-left font-semibold">Location</th>
                                                                    <th className="p-2 text-center font-semibold">Quantity</th>
                                                                    <th className="p-2 text-right font-semibold">Actions</th>
                                                                </tr></thead>
                                                                <tbody>{op.items.map(item => (
                                                                    <tr key={item.id} className="border-b border-gray-200 last:border-b-0 hover:bg-white">
                                                                        <td className="p-2">{item.productName}</td>
                                                                        <td className="p-2 font-mono">{item.sku}</td>
                                                                        <td className="p-2 text-gray-600">{item.locationName}</td>
                                                                        <td className={`p-2 font-bold text-center ${op.type === 'SALE_DISPATCHED' ? 'text-red-500' : 'text-green-600'}`}>
                                                                            {op.type === 'SALE_DISPATCHED' ? '-' : '+'}{item.quantity}
                                                                        </td>
                                                                        <td className="p-2 text-right">
                                                                            <Link to={`/history/${item.id}`} className="btn btn-xs btn-secondary">
                                                                                <FileText size={14} className="mr-1"/> View Log
                                                                            </Link>
                                                                        </td>
                                                                    </tr>
                                                                ))}</tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HistoryPage;
