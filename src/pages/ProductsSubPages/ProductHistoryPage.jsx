
// src/pages/ProductsSubPages/ProductHistoryPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { subDays, startOfDay, endOfDay } from 'date-fns';

// Contexts & Utils
import { useInventory } from '../../contexts/InventoryContext';
import { useProducts } from '../../contexts/ProductContext';
import { formatDate } from '../../utils/formatDate';
import { getProductDisplayName } from '../../utils/productUtils';
import { processTransactions } from '../../utils/transactionUtils';

// Components
import ReusableDatePicker from '../../components/ReusableDatePicker';
import { ArrowUp, ArrowDown, ArrowRightLeft, Search, Filter } from 'lucide-react';

// --- Reusable Components & Styles ---

const selectStyles = {
    control: (p) => ({ ...p, backgroundColor: '#F9FAFB', borderColor: '#D1D5DB', minHeight: '42px' }),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const getTxIcon = (type) => {
    const style = { size: 18 };
    const icons = {
        IN: <ArrowDown className="text-green-500" {...style} />,
        OUT: <ArrowUp className="text-red-500" {...style} />,
        TRANSFER: <ArrowRightLeft className="text-blue-500" {...style} />,
    };
    return icons[type] || null;
};

// --- Main Component ---

const ProductHistoryPage = () => {
    const { sku } = useParams();
    const navigate = useNavigate();
    const { transactions, isLoading: isInventoryLoading } = useInventory();
    const { products, isLoading: isProductsLoading } = useProducts();

    // State for filters
    const [filterType, setFilterType] = useState('');
    const [dateRange, setDateRange] = useState([startOfDay(subDays(new Date(), 30)), endOfDay(new Date())]);
    const [startDate, endDate] = dateRange || [null, null];

    const isLoading = isInventoryLoading || isProductsLoading;

    // Memoized product information
    const productInfo = useMemo(() => {
        if (!sku || products.length === 0) return { displayName: 'Unknown Product', product: null };
        const product = products.find(p => p.sku === sku);
        if (!product) return { displayName: 'Unknown Product', product: null };
        return { displayName: getProductDisplayName(product), product };
    }, [sku, products]);

    // Centralized processing and filtering logic
    const productLogEntries = useMemo(() => {
        const processed = processTransactions({ transactions, sku });
        
        return processed.filter(tx => {
            if (filterType && tx.type !== filterType) return false;
            // Correctly convert Firestore timestamp to a JS Date object for comparison
            const txDate = tx.timestamp.toDate(); 
            if (startDate && txDate < startDate) return false;
            if (endDate && txDate > endDate) return false;
            return true;
        });
    }, [transactions, sku, filterType, startDate, endDate]);

    if (isLoading) {
        return <div className="p-8 text-center text-xl">Loading product history...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="page-title">History for {productInfo.displayName}</h1>
                <button onClick={() => navigate('/products')} className="btn btn-outline-primary">Back to Products</button>
            </div>

            {/* --- Filter Controls --- */}
            <div className="card mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Filter size={20} className="text-gray-400" />
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-base w-full">
                            <option value="">All Types</option>
                            <option value="IN">Stock In</option>
                            <option value="OUT">Stock Out</option>
                            <option value="TRANSFER">Transfer</option>
                        </select>
                    </div>
                    <div>
                        <ReusableDatePicker dateRange={dateRange} setDateRange={setDateRange} />
                    </div>
                </div>
            </div>

            {/* --- History Table --- */}
            <div className="card-table-wrapper">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 text-left">Date</th>
                            <th className="p-3 text-left">Type</th>
                            <th className="p-3 text-left">Change</th>
                            <th className="p-3 text-left">Qty After</th>
                            <th className="p-3 text-left">Location</th>
                            <th className="p-3 text-left">Reference</th>
                            <th className="p-3 text-left">User</th>
                            <th className="p-3 text-left">Notes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {productLogEntries.length > 0 ? (
                            productLogEntries.map((entry, index) => {
                                const changeColor = entry.isGrouped ? 'text-blue-600' : (entry.quantityChange > 0 ? 'text-green-600' : 'text-red-600');
                                const changePrefix = entry.isGrouped ? '' : (entry.quantityChange > 0 ? '+' : '-');
                                const quantity = Math.abs(entry.quantityChange);
                                
                                return (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="p-3">{formatDate(entry.timestamp)}</td>
                                        <td className="p-3 flex items-center gap-2">{getTxIcon(entry.type)}<span>{entry.type}</span></td>
                                        <td className={`p-3 font-bold ${changeColor}`}>{changePrefix}{quantity}</td>
                                        <td className="p-3 font-bold">{entry.quantityAfter}</td>
                                        <td className="p-3">{entry.isGrouped ? `${entry.fromLocation} → ${entry.toLocation}` : entry.location}</td>
                                        <td className="p-3 font-mono text-cyan-600">{entry.referenceNumber}</td>
                                        <td className="p-3 text-gray-600">{entry.userName || 'System'}</td>
                                        <td className="p-3 text-gray-600 max-w-xs truncate">{entry.notes || '-'}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr><td colSpan="8" className="p-8 text-center text-gray-500">No history found for this product.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductHistoryPage;
