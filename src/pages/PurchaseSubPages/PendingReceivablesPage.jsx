
// src/pages/PurchaseSubPages/PendingReceivablesPage.jsx
import React, { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { usePendingReceivables } from '../../contexts/PendingReceivablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import useMediaQuery from '../../hooks/useMediaQuery';
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft, Edit, Trash2, Box, User, Calendar, Hash } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingOverlay';

// --- MOBILE CARD VIEW (with corrected data) ---
const ReceivableBatchCard = ({ batchId, batch, onEdit, onDelete }) => (
    <div className="card shadow-md border border-gray-200/80 mb-4">
        <header className="card-header bg-gray-100 p-3 border-b">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-md text-indigo-700 flex items-center"><Hash size={16} className="mr-2" /> {batchId}</h2>
                <button onClick={() => onDelete(batchId)} className="p-1 text-red-500 hover:text-red-700" title="Delete Batch"><Trash2 size={20} /></button>
            </div>
            <div className="text-xs text-gray-500 flex items-center space-x-3 mt-1">
                <span className="flex items-center"><User size={12} className="mr-1" /> {batch.receivedBy}</span>
                <span className="flex items-center"><Calendar size={12} className="mr-1" /> {batch.receivedAt}</span>
            </div>
        </header>
        <div className="p-2">
            <table className="table w-full text-sm">
                <tbody>
                    {batch.items.map(item => (
                        <tr key={item.id} className="border-b last:border-b-0">
                            <td className="p-2">
                                <div className="font-semibold">{item.productName}</div>
                                <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                {item.isSerialized && item.serials.length > 0 && (
                                    <div className="text-xs text-gray-500 mt-1">Serials: {item.serials.join(', ')}</div>
                                )}
                            </td>
                            <td className="p-2 text-right">
                                <div className="font-bold">{item.quantity}</div>
                                <div className="text-xs">Qty</div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const PendingReceivablesPage = () => {
    const { pendingReceivables, isLoading: receivablesLoading, deleteReceivableBatch, updateReceivableItem } = usePendingReceivables();
    const { products, isLoading: productsLoading } = useProducts();
    const { locations, isLoading: locationsLoading } = useLocations();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const isLoading = receivablesLoading || productsLoading || locationsLoading;

    const productMap = useMemo(() => products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}), [products]);
    const locationMap = useMemo(() => locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.name }), {}), [locations]);

    // --- FIX: FLATTENED & ENRICHED ROW DATA FOR AG-GRID ---
    const flatRowData = useMemo(() => {
        if (isLoading) return [];
        return pendingReceivables.flatMap(item => {
            const product = productMap[item.productId];
            const productName = product ? getProductDisplayName(product) : 'Unknown Product';
            const locationName = locationMap[item.locationId] || item.locationId;
            const commonData = {
                originalId: item.id,
                batchId: item.batchId,
                productId: item.productId,
                productName,
                sku: item.sku,
                locationName,
                isSerialized: item.isSerialized,
                cost: item.cost,
                receivedBy: item.createdBy?.name || 'N/A',
                receivedAt: item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'N/A',
            };

            if (item.isSerialized && item.serials && item.serials.length > 0) {
                return item.serials.map(serial => ({
                    ...commonData,
                    id: `${item.id}-${serial}`, // Unique ID for AgGrid row
                    serialNumber: serial,
                    quantity: 1,
                }));
            } else {
                return [{
                    ...commonData,
                    id: item.id,
                    serialNumber: 'N/A',
                    quantity: item.quantity,
                }];
            }
        });
    }, [pendingReceivables, productMap, locationMap, isLoading]);


    // --- FIX: ENRICHED DATA FOR MOBILE VIEW ---
     const groupedAndSortedBatches = useMemo(() => {
        if (isLoading || !pendingReceivables.length) return {};
        const grouped = pendingReceivables.reduce((acc, item) => {
            const batchId = item.batchId || `unknown-batch-${item.id}`;
            if (!acc[batchId]) {
                acc[batchId] = {
                    items: [],
                    receivedBy: item.createdBy?.name || 'N/A',
                    receivedAt: item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'N/A',
                };
            }
            const product = productMap[item.productId];
            acc[batchId].items.push({
                ...item,
                productName: product ? getProductDisplayName(product) : 'Unknown Product',
            });
            return acc;
        }, {});
        
        return Object.keys(grouped).sort().reverse().reduce((obj, key) => { 
            obj[key] = grouped[key]; 
            return obj; 
        }, {});

    }, [pendingReceivables, isLoading, productMap]);

    const handleDelete = useCallback(async (batchId) => {
        if (window.confirm(`Are you sure you want to delete the entire batch "${batchId}"? This cannot be undone.`)) {
            try {
                await deleteReceivableBatch(batchId);
            } catch (error) {
                alert(`Failed to delete batch: ${error.message}`);
            }
        }
    }, [deleteReceivableBatch]);

    const [columnDefs] = React.useState([
        { headerName: 'Batch ID', field: 'batchId', filter: 'agTextColumnFilter', sort: 'desc', width: 180, pinned: 'left', checkboxSelection: true, headerCheckboxSelection: true },
        { headerName: 'Product', field: 'productName', filter: 'agTextColumnFilter', flex: 2, minWidth: 250 },
        { headerName: 'SKU', field: 'sku', filter: 'agTextColumnFilter', width: 150 },
        { headerName: 'Serial Number', field: 'serialNumber', width: 180 },
        { headerName: 'Qty', field: 'quantity', width: 80 },
        { headerName: 'Location', field: 'locationName', width: 150 },
        { headerName: 'Received By', field: 'receivedBy', width: 150 },
        { headerName: 'Received At', field: 'receivedAt', width: 180, sort: 'desc' },
        { 
            headerName: 'Actions', 
            width: 100, 
            cellRenderer: (params) => (
                 <div className="flex items-center justify-center h-full">
                    <button onClick={() => handleDelete(params.data.batchId)} className="p-1 text-red-600 hover:text-red-800" title="Delete Entire Batch">
                        <Trash2 size={18} />
                    </button>
                </div>
            ),
            pinned: 'right',
            sortable: false,
            filter: false,
        }
    ]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        resizable: true,
        suppressHeaderMenuButton: true,
    }), []);

    if (isLoading) {
        return <LoadingSpinner>Loading pending items...</LoadingSpinner>;
    }

    return (
        <div className="page-container bg-gray-50">
            <header className="page-header">
                <div>
                    <Link to="/purchase" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1">
                        <ArrowLeft size={16} className="mr-1" /> Back to Purchase
                    </Link>
                    <h1 className="page-title">Pending Stock Receivables</h1>
                </div>
            </header>
            <div className="page-content">
                {flatRowData.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                        <Box size={48} className="mx-auto text-gray-400" />
                        <h3 className="mt-4 text-lg font-semibold">No Pending Items</h3>
                        <p>All received stock has been finalized.</p>
                    </div>
                ) : isMobile ? (
                    <div>
                        {Object.entries(groupedAndSortedBatches).map(([batchId, batch]) => (
                            <ReceivableBatchCard key={batchId} batchId={batchId} batch={batch} onDelete={handleDelete} />
                        ))}
                    </div>
                ) : (
                    <div className="card shadow-sm">
                        <div className="ag-theme-indigo" style={{ height: '70vh', width: '100%' }}>
                            <AgGridReact
                                rowData={flatRowData}
                                columnDefs={columnDefs}
                                defaultColDef={defaultColDef}
                                pagination={true}
                                paginationPageSize={100}
                                animateRows={true}
                                rowSelection="multiple"
                                getRowId={params => params.data.id}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingReceivablesPage;
