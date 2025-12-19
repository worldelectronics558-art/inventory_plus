// src/pages/InventoryPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProducts } from '../contexts/ProductContext';
import { useLocations } from '../contexts/LocationContext';
import { useUser } from '../contexts/UserContext';
import useMediaQuery from '../hooks/useMediaQuery';
import { getProductDisplayName } from '../utils/productUtils';
import InventoryCard from '../components/InventoryCard';

// Export libraries & AG Grid
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

import { HardDriveDownload, FileDown, ChevronDown, Search } from 'lucide-react';
import LoadingSpinner from '../components/LoadingOverlay';

// --- Main Inventory Page Component ---
const InventoryPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { products, isLoading: isProductsLoading } = useProducts();
    const { locations, isLoading: isLocationsLoading } = useLocations();
    const { assignedLocations } = useUser();

    const isMobile = useMediaQuery('(max-width: 767px)');
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const sku = searchParams.get('search');
        if (sku) {
            setSearchText(sku);
        }
    }, [location.search]);

    const userLocations = useMemo(() => 
        (assignedLocations?.length > 0 
            ? locations.filter(loc => assignedLocations.includes(loc.id))
            : locations
        ).sort((a,b) => a.name.localeCompare(b.name)), 
    [locations, assignedLocations]);

    const rowData = useMemo(() => {
        if (isProductsLoading || isLocationsLoading) return [];
        return products.map(p => {
            const row = {
                productId: p.id,
                displayName: getProductDisplayName(p),
                sku: p.sku,
                reorderPoint: p.reorderPoint || 0,
                // Use the canonical total stock field from stockSummary
                totalStock: p.stockSummary?.totalInStock ?? p.stockSummary?.inStock ?? 0,
                stockByLocation: userLocations.map(loc => ({
                    ...loc,
                    stock: p.stockSummary?.byLocation?.[loc.id] || 0
                }))
            };
            userLocations.forEach(loc => {
                row[loc.id] = p.stockSummary?.byLocation?.[loc.id] || 0;
            });
            return row;
        });
    }, [products, userLocations, isProductsLoading, isLocationsLoading]);

    const filteredRowData = useMemo(() => {
        if (!searchText) {
            return rowData;
        }
        const lowerCaseSearchText = searchText.toLowerCase();
        return rowData.filter(item =>
            item.displayName.toLowerCase().includes(lowerCaseSearchText) ||
            item.sku.toLowerCase().includes(lowerCaseSearchText)
        );
    }, [rowData, searchText]);

    const columnDefs = useMemo(() => {
        return [
            {
                field: 'displayName',
                headerName: 'Product',
                minWidth: 250, 
                flex: 2,
                pinned: 'left',
                onCellClicked: params => navigate(`/products/details/${params.data.productId}`),
                cellRenderer: params => <span className="font-semibold cursor-pointer text-blue-600 hover:underline">{params.value}</span>,
                valueGetter: params => params.data.displayName + ' ' + params.data.sku, // For filtering
            },
            {
                field: 'totalStock',
                headerName: 'Total Stock',
                type: 'numericColumn',
                width: 120,
                cellStyle: params => ({ fontWeight: 'bold', color: params.value <= params.data.reorderPoint ? '#D32F2F' : '#1976D2' })
            },
            ...userLocations.map(loc => ({
                field: loc.id,
                headerName: loc.name,
                type: 'numericColumn',
                width: 140,
                cellStyle: params => ({ color: params.value > 0 ? '#374151' : '#9CA3AF' })
            })),
        ];
    }, [userLocations, navigate]);

    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: 'agTextColumnFilter',
    }), []);

    const exportData = (format) => {
        const header = columnDefs.map(c => c.headerName);
        const data = filteredRowData.map(row => columnDefs.map(c => row[c.field] || 0));
        const name = `inventory_stock_${new Date().toISOString().split('T')[0]}`;

        if (format === 'xlsx') {
            const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
            XLSX.writeFile(wb, `${name}.xlsx`);
        } else if (format === 'pdf') {
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.text('Current Inventory Stock', 14, 20);
            autoTable(doc, {
                head: [header],
                body: data,
                startY: 25,
            });
            doc.save(`${name}.pdf`);
        }
        setIsExportMenuOpen(false);
    };

    const isLoading = isProductsLoading || isLocationsLoading;
    if (isLoading) return <LoadingSpinner>Loading Inventory...</LoadingSpinner>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Inventory Overview</h1>
                <div className="page-actions">
                    <div className="relative inline-block text-left">
                        <button onClick={() => setIsExportMenuOpen(p => !p)} className="btn btn-secondary">
                            <FileDown size={18} className="mr-2" /> Export <ChevronDown size={16} className='ml-1'/>
                        </button>
                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 z-20 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                                <div className="py-1">
                                    <button onClick={() => exportData('xlsx')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                                        <HardDriveDownload size={16} className="mr-2 text-green-600"/> Excel (.xlsx)
                                    </button>
                                    <button onClick={() => exportData('pdf')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                                        <HardDriveDownload size={16} className="mr-2 text-red-600"/> PDF (.pdf)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={18} className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by product or SKU..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        className="input-base w-full pl-10"
                    />
                </div>
            </div>

            <div className="page-content">
                {isMobile ? (
                    <div className="space-y-4">
                        {filteredRowData.map(item => (
                            <InventoryCard key={item.productId} item={item} />
                        ))}
                    </div>
                ) : (
                    <div className="ag-theme-quartz" style={{ height: '75vh', width: '100%' }}>
                        <AgGridReact
                            rowData={filteredRowData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            pagination={true}
                            paginationPageSize={100}
                            animateRows={true}
                            quickFilterText={searchText}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryPage;
