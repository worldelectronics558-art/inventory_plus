// src/pages/InventoryPage.jsx

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../contexts/InventoryContext';
import { useProducts } from '../contexts/ProductContext';
import { useLookups } from '../contexts/LookupContext';
import { useUser } from '../contexts/UserContext';

// UI & Responsive Components
import useMediaQuery from '../hooks/useMediaQuery';
import InventoryCard from '../components/InventoryCard';

// Export libraries
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { getProductBySku, getProductDisplayName } from '../utils/productUtils';
    
ModuleRegistry.registerModules([ AllCommunityModule ]);

// --- Main Inventory Page Component ---
const InventoryPage = () => {
    const navigate = useNavigate();
    const { stockLevels, isLoading: isInventoryLoading } = useInventory();
    const { products, isLoading: isProductsLoading } = useProducts();
    const { lookups, isLoading: isLookupsLoading } = useLookups();
    const { assignedLocations: rawAssignedLocations } = useUser();

    const isMobile = useMediaQuery('(max-width: 767px)');
    const assignedLocations = rawAssignedLocations || [];
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    const allLocationsFromStock = useMemo(() => {
        const locationsSet = new Set();
        Object.values(stockLevels).forEach(locationMap => {
            Object.keys(locationMap).forEach(loc => locationsSet.add(loc));
        });
        return Array.from(locationsSet).sort();
    }, [stockLevels]);

    const displayedLocations = assignedLocations.length > 0
        ? allLocationsFromStock.filter(loc => assignedLocations.includes(loc))
        : allLocationsFromStock;

    const availableProducts = products || [];

    // --- AG GRID & CARD DATA TRANSFORMATION ---
    const [rowData, locationColumns] = useMemo(() => {
        const productRows = [];
        const locationKeys = displayedLocations;

        availableProducts
            .forEach(product => {
                const productLevels = stockLevels[product.sku] || {};
                
                let totalStock = 0;
                const row = {
                    sku: product.sku,
                    productId: product.id, // Important for card navigation
                    model: product.model || 'N/A',
                    displayName: getProductDisplayName(product),
                };

                locationKeys.forEach(loc => {
                    const quantity = productLevels[loc] || 0;
                    row[loc] = quantity;
                    totalStock += quantity;
                });

                row.totalStock = totalStock;
                
                if (totalStock > 0) {
                    productRows.push(row);
                }
            });

        return [productRows, locationKeys];
    }, [stockLevels, availableProducts, displayedLocations]);

    // --- AG GRID COLUMN DEFINITIONS ---
    const columnDefs = useMemo(() => {
        const dynamicLocationColumns = locationColumns.map(loc => ({
            field: loc,
            headerName: loc,
            width: 120,
            maxWidth: 150,
            filter: 'agNumberColumnFilter',
            sortable: true,
            resizable: true,
            cellClassRules: {
                'text-red-600 font-bold': params => params.value !== null && params.value <= 5,
                'text-gray-700': params => params.value !== null && params.value > 5,
                'text-center': () => true,
            },
            valueFormatter: params => params.value || 0,
        }));

        const gridCols = [
            { 
                field: 'displayName', 
                headerName: 'Product (SKU - Model)', 
                minWidth: 250, 
                flex: 1, 
                filter: true, 
                sortable: true,
                pinned: 'left',
                cellClass: 'font-medium',
                onCellClicked: (params) => navigate(`/products/details/${params.data.productId}`),
                cellRenderer: params => <span className="cursor-pointer text-indigo-600 hover:underline">{params.value}</span>
            },
            ...dynamicLocationColumns,
            {
                field: 'totalStock',
                headerName: 'Total Stock',
                width: 120,
                maxWidth: 120,
                filter: 'agNumberColumnFilter',
                sortable: true,
                resizable: true,
                pinned: 'right',
                cellClass: 'text-center font-bold text-blue-600',
                valueFormatter: params => params.value || 0,
            }
        ];
        return gridCols;

    }, [locationColumns, navigate]);
    
    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true,
        suppressHeaderMenuButton: true,
        flex: 1, 
        minWidth: 80,
    }), []);

    // --- Export Functionality ---
    const exportCurrentStock = (format) => {
        const exportData = [];
        Object.entries(stockLevels).forEach(([sku, locationsData]) => {
            const product = getProductBySku(availableProducts, sku);
            const modelName = product ? product.model || 'N/A' : 'N/A';
            Object.entries(locationsData).forEach(([location, quantity]) => {
                if (quantity !== 0) {
                    exportData.push({ SKU: sku, Model: modelName, Location: location, Quantity: quantity });
                }
            });
        });

        if (exportData.length === 0) {
            alert('No stock data to export.');
            return;
        }

        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Current_Stock');
            XLSX.writeFile(wb, 'inventory_current_stock.xlsx');
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.text('Current Inventory Stock', 14, 20);
            const tableData = exportData.map(row => [row.SKU, row.Model, row.Location, row.Quantity]);
            autoTable(doc, {
                head: [['SKU', 'Model', 'Location', 'Quantity']],
                body: tableData,
                startY: 36,
            });
            doc.save('inventory_current_stock.pdf');
        }
        setIsExportMenuOpen(false);
    };

    const isLoading = isInventoryLoading || isProductsLoading || isLookupsLoading || !lookups;

    if (isLoading) {
        return <div className="p-8 text-xl text-center">Loading Inventory Data...</div>;
    }
    
    return (
        <div>
            <h1 className="page-title">Inventory Management</h1>
            <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={() => navigate('/inventory/stock-in')} className="btn btn-primary">Stock In</button>
                <button onClick={() => navigate('/inventory/stock-out')} className="btn btn-danger">Stock Out</button>
                <button onClick={() => navigate('/inventory/transfer')} className="btn btn-secondary">Transfer</button>
                
                <div className="relative inline-block text-left">
                    <button type="button" className="btn btn-outline-primary" onClick={() => setIsExportMenuOpen(prev => !prev)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export
                    </button>
                    {isExportMenuOpen && (
                         <div className="absolute right-0 mt-1 w-48 z-10 py-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                            <button onClick={() => exportCurrentStock('pdf')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">As PDF</button>
                            <button onClick={() => exportCurrentStock('excel')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">As Excel</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Conditional Rendering: Card View or Grid View */}
            <div className="bg-white shadow overflow-hidden rounded-lg">
                <h2 className="section-title">Current Stock Levels</h2>
                {rowData.length === 0 ? (
                    <p className="p-6 text-center text-gray-500">No stock recorded for any product at the assigned locations.</p>
                ) : isMobile ? (
                    <div className="p-4">
                        {rowData.map(item => (
                            <InventoryCard 
                                key={item.sku} 
                                item={item} 
                                locations={locationColumns} 
                                productId={item.productId} 
                            />
                        ))}
                    </div>
                ) : (
                    <div className="ag-theme-indigo" style={{ width: '100%', height: 600 }}>
                        <AgGridReact
                            rowData={rowData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            pagination={true}
                            paginationPageSize={25}
                            paginationPageSizeSelector={[10, 25, 50, 100]}
                            rowSelection={{ mode: 'singleRow' }}
                            enableBrowserTooltips={true}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryPage;
