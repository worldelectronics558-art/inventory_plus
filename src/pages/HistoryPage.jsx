
// src/pages/HistoryPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { subDays, startOfDay, endOfDay } from 'date-fns';

// Contexts & Utils
import { useProducts } from '../contexts/ProductContext';
import { formatDate } from '../utils/formatDate';
import { getProductDisplayName } from '../utils/productUtils';
import { processTransactions } from '../utils/transactionUtils';

// Components
import useMediaQuery from '../hooks/useMediaQuery';
import ReusableDatePicker from '../components/ReusableDatePicker';
import { ChevronDown, ChevronRight, Filter, Package, ArrowUp, ArrowDown, ArrowRightLeft, Search } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

// --- Reusable Components ---

const selectStyles = {
    control: (p) => ({ ...p, backgroundColor: '#F9FAFB', borderColor: '#D1D5DB', minHeight: '42px' }),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const getTxIcon = (type, size = 18) => {
    const icons = {
        IN: <ArrowDown className="text-green-500" size={size} />,
        OUT: <ArrowUp className="text-red-500" size={size} />,
        TRANSFER: <ArrowRightLeft className="text-blue-500" size={size} />,
    };
    return icons[type] || <Package size={size} />;
};

// --- Main Components ---

const TransactionRow = ({ txGroup, products }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { type, referenceNumber, timestamp, userName, items, notes, documentNumber } = txGroup;

    const getProductInfo = (sku) => {
        const product = products.find(p => p.sku === sku);
        return product ? getProductDisplayName(product) : 'Unknown SKU';
    };

    return (
        <>
            <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-gray-100' : ''}`}>
                <td className="p-3"><button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center">{isExpanded ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}<span className="ml-2">{getTxIcon(type)}</span></button></td>
                <td className="p-3 font-mono text-cyan-600">{referenceNumber}</td>
                <td className="p-3">{formatDate(timestamp)}</td>
                <td className="p-3">{userName}</td>
                <td className="p-3 text-center">{items.length}</td>
            </tr>
            {isExpanded && (
                <tr className="bg-gray-50/50">
                    <td colSpan="5" className="p-4">
                        <div className="bg-white p-3 rounded-lg shadow-inner">
                            <h4 className="font-bold mb-2">Transaction Breakdown</h4>
                            <div className="space-y-2">
                                {items.map((item, index) => {
                                    const isTransfer = item.type === 'TRANSFER' || item.isGrouped;
                                    const changeColor = isTransfer ? 'text-blue-600' : (item.quantityChange > 0 ? 'text-green-600' : 'text-red-600');
                                    const changePrefix = isTransfer ? '' : (item.quantityChange > 0 ? '+' : '-');
                                    const quantity = isTransfer ? item.quantityChange : Math.abs(item.quantityChange);

                                    return (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-x-4 p-2 bg-gray-50 rounded text-sm items-center">
                                            <div><span className="font-semibold">Product:</span> {getProductInfo(item.sku)}</div>
                                            <div><span className="font-semibold">Change:</span> <span className={`${changeColor} font-bold`}>{changePrefix}{quantity}</span></div>
                                            <div className="font-bold">Qty After: {item.quantityAfter}</div>
                                            <div><span className="font-semibold">Location:</span> {isTransfer ? `${item.fromLocation} → ${item.toLocation}` : item.location}</div>
                                        </div>
                                    );
                                })}
                            </div>
                             {(notes || documentNumber) && <div className="mt-3 pt-2 border-t text-xs">
                                {notes && <p><span className="font-semibold">Notes:</span> {notes}</p>}
                                {documentNumber && <p><span className="font-semibold">Doc #:</span> {documentNumber}</p>}
                            </div>}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

const TransactionCard = ({ txGroup, products }) => {
    const { type, referenceNumber, timestamp, userName, items, notes, documentNumber } = txGroup;

    const getProductInfo = (sku) => {
        const product = products.find(p => p.sku === sku);
        return product ? getProductDisplayName(product) : 'Unknown SKU';
    };

    return (
        <div className="card mb-4">
            <div className="p-4 border-b flex justify-between items-start">
                <div>
                    <p className="font-bold flex items-center">{getTxIcon(type, 20)}<span className="ml-2">{type}</span></p>
                    <p className="font-mono text-cyan-600 text-sm mt-1">{referenceNumber}</p>
                </div>
                <div className="text-right text-xs">
                    <p>{formatDate(timestamp)}</p>
                    <p className="text-gray-600">by {userName}</p>
                </div>
            </div>
            <div className="p-4 bg-gray-50">
                <h5 className="font-semibold text-sm mb-2">Items ({items.length})</h5>
                <div className="space-y-3">
                    {items.map((item, index) => {
                        const isTransfer = item.type === 'TRANSFER' || item.isGrouped;
                        const changeColor = isTransfer ? 'text-blue-600' : (item.quantityChange > 0 ? 'text-green-600' : 'text-red-600');
                        const changePrefix = isTransfer ? '' : (item.quantityChange > 0 ? '+' : '-');
                        const quantity = isTransfer ? item.quantityChange : Math.abs(item.quantityChange);

                        return (
                            <div key={index} className="p-2 bg-white rounded-md shadow-sm text-sm">
                                <p className="font-bold">{getProductInfo(item.sku)}</p>
                                <p><span className="font-semibold">Change:</span> <span className={`${changeColor} font-bold`}>{changePrefix}{quantity}</span></p>
                                <p className="font-bold">Qty After: {item.quantityAfter}</p>
                                <p><span className="font-semibold">Location:</span> {isTransfer ? `${item.fromLocation} → ${item.toLocation}` : item.location}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
            {(notes || documentNumber) && <div className="p-4 border-t text-xs">
                {notes && <p><span className="font-semibold">Notes:</span> {notes}</p>}
                {documentNumber && <p><span className="font-semibold">Doc #:</span> {documentNumber}</p>}
            </div>}
        </div>
    );
};

const HistoryPage = () => {
    const { transactions, isLoading } = useInventory();
    const { products } = useProducts();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const navigate = useNavigate();
    const location = useLocation();

    // State for filters and pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [filterType, setFilterType] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [dateRange, setDateRange] = useState([startOfDay(subDays(new Date(), 30)), endOfDay(new Date())]);
    const [startDate, endDate] = dateRange || [null, null];

    // Handle URL param for SKU pre-selection
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const skuFromUrl = params.get('sku');
        if (skuFromUrl && products.length > 0) {
            const product = products.find(p => p.sku === skuFromUrl);
            if (product) setSelectedProduct({ value: product.sku, label: getProductDisplayName(product) });
        }
    }, [location.search, products]);

    const productOptions = useMemo(() =>
        products.map(p => ({ value: p.sku, label: getProductDisplayName(p) }))
    , [products]);

    // Centralized processing and filtering logic
    const filteredTransactions = useMemo(() => {
        const processed = processTransactions({ transactions, groupBy: 'transactionId' });
        
        return processed.filter(group => {
            if (filterType && group.type !== filterType) return false;
            // Correctly convert Firestore timestamp to a JS Date object for comparison
            const groupDate = group.timestamp.toDate();
            if (startDate && groupDate < startDate) return false;
            if (endDate && groupDate > endDate) return false;
            if (selectedProduct && !group.items.some(item => item.sku === selectedProduct.value)) return false;
            return true;
        });
    }, [transactions, filterType, startDate, endDate, selectedProduct]);

    // Pagination logic
    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredTransactions, currentPage]);
    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

    const handleProductChange = (option) => {
        setSelectedProduct(option);
        navigate(option ? `${location.pathname}?sku=${option.value}` : location.pathname, { replace: true });
        setCurrentPage(1);
    };
    
    if (isLoading) return <div className="p-8 text-center text-xl">Loading history...</div>;

    return (
        <div>
            <h1 className="page-title">Transaction History</h1>
            {/* --- Filter Controls --- */}
            <div className="card mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="flex items-center gap-2"><Search size={20} className="text-gray-400" /><Select options={productOptions} value={selectedProduct} onChange={handleProductChange} isClearable placeholder="Filter by Product..." styles={selectStyles} menuPortalTarget={document.body} className="w-full"/></div>
                    <div className="flex items-center gap-2"><Filter size={20} className="text-gray-400" /><select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }} className="input-base w-full"><option value="">All Types</option><option value="IN">Stock In</option><option value="OUT">Stock Out</option><option value="TRANSFER">Transfer</option></select></div>
                    <div><ReusableDatePicker dateRange={dateRange} setDateRange={setDateRange} /></div>
                </div>
            </div>

            {/* --- Transaction Display --- */}
            {paginatedTransactions.length > 0 ? (
                isMobile ? (
                    <div>{paginatedTransactions.map(group => <TransactionCard key={group.transactionId} txGroup={group} products={products} />)}</div>
                ) : (
                    <div className="card-table-wrapper">
                        <table className="min-w-full text-sm"> 
                            <thead className="bg-gray-50"><tr>
                                <th className="p-3 text-left w-20"></th>
                                <th className="p-3 text-left">Reference</th>
                                <th className="p-3 text-left">Date</th>
                                <th className="p-3 text-left">User</th>
                                <th className="p-3 text-center">Items</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-100">{paginatedTransactions.map(group => <TransactionRow key={group.transactionId} txGroup={group} products={products} />)}</tbody>
                        </table>
                    </div>
                )
            ) : (
                <div className="card text-center p-8"><p className="text-gray-500">No transactions found for the selected filters.</p></div>
            )}

            {/* --- Pagination Controls --- */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-secondary">Previous</button>
                    <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn btn-secondary">Next</button>
                </div>
            )}
        </div>
    );
};

export default HistoryPage;
