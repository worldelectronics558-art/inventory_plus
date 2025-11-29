// src/pages/HistoryPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useInventory } from '../contexts/InventoryContext';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Filter, Calendar as CalendarIcon, Package, ArrowUp, ArrowDown, ArrowRightLeft, Search, X } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

// A more detailed and polished TransactionRow component
const TransactionRow = ({ txGroup }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { type, referenceNumber, timestamp, userName, items, notes, documentNumber } = txGroup;

    const getTxIcon = (type) => {
        const style = { size: 18 };
        switch (type) {
            case 'IN': return <ArrowUp className="text-green-500" {...style} />;
            case 'OUT': return <ArrowDown className="text-red-500" {...style} />;
            case 'TRANSFER': return <ArrowRightLeft className="text-blue-500" {...style} />;
            default: return <Package {...style} />;
        }
    };

    const formatDate = (ts) => ts ? format(ts.toDate ? ts.toDate() : new Date(ts), 'MMM dd, yyyy HH:mm') : 'N/A';

    return (
        <>
            <tr className={`hover:bg-gray-700 transition-colors duration-200 ${isExpanded ? 'bg-gray-700' : ''}`}>
                <td className="p-4 whitespace-nowrap">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-white">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        <span className="ml-3">{getTxIcon(type)}</span>
                    </button>
                </td>
                <td className="p-4 whitespace-nowrap font-mono text-sm text-cyan-400">{referenceNumber}</td>
                <td className="p-4 whitespace-nowrap">{formatDate(timestamp)}</td>
                <td className="p-4 whitespace-nowrap">{userName}</td>
                <td className="p-4 whitespace-nowrap text-center">{items.length}</td>
            </tr>
            {isExpanded && (
                <tr className="bg-gray-800">
                    <td colSpan="5" className="p-4">
                        <div className="bg-gray-850 p-4 rounded-lg">
                            <h4 className="font-bold text-lg mb-3 text-white">Transaction Breakdown</h4>
                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-2 bg-gray-750 rounded-md text-sm">
                                        <div className="font-bold">SKU: <span className="font-normal text-yellow-400">{item.sku}</span></div>
                                        <div><span className="font-bold">Item:</span> {item.productName || '-'}</div>
                                        <div className={item.type === 'IN' ? 'text-green-400' : item.type === 'OUT' ? 'text-red-400' : 'text-blue-400'}>
                                            <span className="font-bold">Change:</span> {item.type === 'IN' ? '+' : '-'}{item.quantityChange}
                                        </div>
                                        <div><span className="font-bold">Stock:</span> {item.quantityBefore} → {item.quantityAfter}</div>
                                        <div><span className="font-bold">Location:</span> {item.location || `${item.fromLocation} to ${item.toLocation}`}</div>
                                    </div>
                                ))}
                            </div>
                            {(notes || documentNumber) && <div className="mt-4 pt-3 border-t border-gray-700 text-sm">
                               {notes && <p><span className="font-bold">Notes:</span> {notes}</p>}
                               {documentNumber && <p><span className="font-bold">Document #:</span> {documentNumber}</p>}
                            </div>}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

// Main HistoryPage component with enhanced filtering
const HistoryPage = () => {
    const { transactions, isLoading } = useInventory();
    const navigate = useNavigate();
    const location = useLocation();

    const [currentPage, setCurrentPage] = useState(1);
    const [filterType, setFilterType] = useState('');
    const [skuSearch, setSkuSearch] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Effect to read SKU from URL and set filter on load
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const skuFromUrl = params.get('sku');
        if (skuFromUrl) {
            setSkuSearch(skuFromUrl);
        }
    }, [location.search]);

    const groupedTransactions = useMemo(() => {
        const groups = {};
        transactions.forEach(tx => {
            if (!groups[tx.transactionId]) {
                groups[tx.transactionId] = {
                    id: tx.transactionId, referenceNumber: tx.referenceNumber, type: tx.type, timestamp: tx.timestamp,
                    userName: tx.userName, notes: tx.notes, documentNumber: tx.documentNumber, items: []
                };
            }
            groups[tx.transactionId].items.push(tx);
        });
        return Object.values(groups).sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        return groupedTransactions.filter(group => {
            if (filterType && group.type !== filterType) return false;
            if (dateRange.start && (group.timestamp?.toDate() || new Date()) < new Date(dateRange.start)) return false;
            if (dateRange.end && (group.timestamp?.toDate() || new Date()) > new Date(dateRange.end)) return false;
            if (skuSearch && !group.items.some(item => item.sku.toLowerCase().includes(skuSearch.toLowerCase()))) return false;
            return true;
        });
    }, [groupedTransactions, filterType, dateRange, skuSearch]);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredTransactions, currentPage]);

    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
    
    const handleSkuSearchChange = (e) => {
        const newSku = e.target.value;
        setSkuSearch(newSku);
        // Update URL to reflect search without reloading page
        if (newSku) {
            navigate(`${location.pathname}?sku=${newSku}`, { replace: true });
        } else {
            navigate(location.pathname, { replace: true });
        }
    };

    if (isLoading) {
        return <div className="p-8 text-white">Loading history...</div>;
    }

    return (
        <div className="p-6 bg-gray-900 text-white min-h-screen">
            <h1 className="text-4xl font-bold mb-8">Transaction History</h1>

            <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                        <Search size={20} className="text-gray-400"/>
                        <input 
                            type="text" 
                            placeholder="Filter by SKU..." 
                            value={skuSearch}
                            onChange={handleSkuSearchChange}
                            className="input-base w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={20} className="text-gray-400"/>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-base w-full">
                            <option value="">All Types</option>
                            <option value="IN">Stock In</option>
                            <option value="OUT">Stock Out</option>
                            <option value="TRANSFER">Transfer</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarIcon size={20} className="text-gray-400"/>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="input-base w-full"/>
                        <span className="mx-2">to</span>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="input-base w-full"/>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="p-4 text-left text-xs font-medium uppercase tracking-wider w-16"></th>
                            <th className="p-4 text-left text-xs font-medium uppercase tracking-wider">Reference</th>
                            <th className="p-4 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                            <th className="p-4 text-left text-xs font-medium uppercase tracking-wider">User</th>
                            <th className="p-4 text-left text-xs font-medium uppercase tracking-wider text-center">Items</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {paginatedTransactions.map(group => <TransactionRow key={group.id} txGroup={group} />)}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                 <div className="flex justify-between items-center mt-6">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary">Previous</button>
                    <span className="text-sm text-gray-400">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary">Next</button>
                </div>
            )}
        </div>
    );
};

export default HistoryPage;