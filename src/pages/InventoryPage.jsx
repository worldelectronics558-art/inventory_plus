// src/pages/InventoryPage.jsx

// ===== UPDATE IMPORTS =====
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for routing
import { useInventory } from '../contexts/InventoryContext';
import { useProducts } from '../contexts/ProductContext'; // Assuming this is the correct hook name based on your structure
import { useLookups } from '../contexts/LookupContext'; // Assuming this is the correct hook name - although we might not need all lookups here anymore
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
// Browser-compatible libraries for export
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
    const { userId } = useAuth(); // Keeping for context usage
    const { user: currentUser, assignedLocations: rawAssignedLocations } = useUser();

    const assignedLocations = rawAssignedLocations || [];

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // Get all unique locations currently present in stockLevels
    const allLocationsFromStock = useMemo(() => {
        const locationsSet = new Set();
        Object.values(stockLevels).forEach(locationMap => {
            Object.keys(locationMap).forEach(loc => locationsSet.add(loc));
        });
        return Array.from(locationsSet).sort();
    }, [stockLevels]);

    // Filter locations based on user's assigned locations
    const displayedLocations = assignedLocations.length > 0
        ? allLocationsFromStock.filter(loc => assignedLocations.includes(loc))
        : allLocationsFromStock;

    const availableProducts = products || [];

    // --- AG GRID DATA TRANSFORMATION ---
    const [rowData, locationColumns] = useMemo(() => {
        const productRows = [];
        const locationKeys = displayedLocations;

        availableProducts
            .filter(product => stockLevels[product.sku])
            .forEach(product => {
                const productLevels = stockLevels[product.sku] || {};
                
                let totalStock = 0;
                const row = {
                    sku: product.sku,
                    model: product.model || 'N/A',
                    displayName: getProductDisplayName(product),
                    // Dynamic location fields added below
                };

                // Populate dynamic location columns and calculate total
                locationKeys.forEach(loc => {
                    const quantity = productLevels[loc] || 0;
                    row[loc] = quantity;
                    totalStock += quantity;
                });

                row.totalStock = totalStock;
                
                // Only add products that have stock in the displayed locations
                if (totalStock > 0) {
                    productRows.push(row);
                }
            });

        return [productRows, locationKeys];
    }, [stockLevels, availableProducts, displayedLocations]);


    // --- AG GRID COLUMN DEFINITIONS ---
    const columnDefs = useMemo(() => {
        // 1. Dynamic Location Columns
        const dynamicLocationColumns = locationColumns.map(loc => ({
            field: loc,
            headerName: loc,
            width: 120,
            maxWidth: 150,
            filter: 'agNumberColumnFilter',
            sortable: true,
            resizable: true,
            // Low Stock Styling (<= 5 units)
            cellClassRules: {
                'text-red-600 font-bold': params => params.value !== null && params.value <= 5,
                'text-gray-700': params => params.value !== null && params.value > 5,
                'text-center': () => true, // Center alignment
            },
            valueFormatter: params => params.value || 0, // Display 0 instead of empty
        }));

        return [
            // 2. Product Identifier Column (Pinned Left)
            { 
                field: 'displayName', 
                headerName: 'Product (SKU - Model)', 
                minWidth: 250, 
                flex: 1, 
                filter: true, 
                sortable: true,
                pinned: 'left',
                cellClass: 'font-medium',
            },
            
            // 3. Dynamic Location Columns
            ...dynamicLocationColumns,

            // 4. Total Stock Column (Pinned Right)
            {
                field: 'totalStock',
                headerName: 'Total Stock',
                width: 120,
                maxWidth: 120,
                filter: 'agNumberColumnFilter',
                sortable: true,
                resizable: true,
                pinned: 'right',
                // Original styling: bold and blue
                cellClass: 'text-center font-bold text-blue-600',
                valueFormatter: params => params.value || 0,
            }
        ];
    }, [locationColumns]);
    
    // Default column properties
    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true,
        suppressHeaderMenuButton: true,
        flex: 1, 
        minWidth: 80,
    }), []);
    // --- END AG GRID CONFIGURATION ---

    // --- Export Functionality (UNCHANGED logic, uses original data structure) ---
    const exportCurrentStock = (format) => {
        // Flatten stockLevels into a list of [SKU, Model, Location, Quantity]
        const exportData = [];
        Object.entries(stockLevels).forEach(([sku, locationsData]) => {
            const product = getProductBySku(availableProducts, sku);
            const modelName = product ? product.model || 'N/A' : 'N/A';
            Object.entries(locationsData).forEach(([location, quantity]) => {
                if (quantity !== 0) { // Only export non-zero stock
                    exportData.push({
                        SKU: sku,
                        Model: modelName,
                        Location: location,
                        Quantity: quantity
                    });
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
            alert("Excel file exported successfully to your default download folder!");
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text('Current Inventory Stock', 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

            const tableData = exportData.map(row => [row.SKU, row.Model, row.Location, row.Quantity]);
            autoTable(doc, {
                head: [['SKU', 'Model', 'Location', 'Quantity']],
                body: tableData,
                startY: 36,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [67, 56, 202] }, // Using an indigo shade
            });

            doc.save('inventory_current_stock.pdf');
            alert("PDF file exported successfully to your default download folder!");
        }
        setIsExportMenuOpen(false);
    };

    if (isInventoryLoading || isProductsLoading || isLookupsLoading || !lookups) {
        return <div className="p-8 text-xl text-center">Loading Inventory Data...</div>;
    }
    
    // --- Render Logic ---
    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <h1 className="page-title">Inventory Management</h1>

            {/* Action Buttons - Using the defined 'btn' classes */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => navigate('/inventory/stock-in')}
                    className="btn btn-primary"
                >
                    Stock In
                </button>
                <button
                    onClick={() => navigate('/inventory/stock-out')}
                    className="btn btn-danger"
                >
                    Stock Out
                </button>
                <button
                    onClick={() => navigate('/inventory/transfer')}
                    className="btn btn-secondary"
                >
                    Transfer
                </button>
                
                {/* Export Button with Dropdown */}
                <div className="relative inline-block text-left">
                    <button
                        type="button"
                        className="btn btn-outline-primary" // Consistent outline style for secondary actions
                        aria-haspopup="true"
                        aria-expanded={isExportMenuOpen}
                        title="Toggle Export Options"
                        onClick={() => setIsExportMenuOpen(prev => !prev)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export
                    </button>
                    <div
                        id="export-dropdown-menu"
                        className={`absolute right-0 mt-1 w-48 z-10 transition-opacity duration-100 ${
                            isExportMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
                        }`}
                    >
                        <ul role="none" className="py-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                            <li>
                                <button
                                    onClick={() => exportCurrentStock('pdf')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    role="menuitem"
                                >
                                    Export as PDF (.pdf)
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => exportCurrentStock('excel')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    role="menuitem"
                                >
                                    Export as Excel (.xlsx)
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* AG Grid Component */}
            <div className="bg-white shadow overflow-hidden rounded-lg">
                <h2 className="section-title">Current Stock Levels</h2>
                {rowData.length === 0 ? (
                    <p className="p-6 text-center text-gray-500">No stock recorded for any product at the assigned locations.</p>
                ) : (
                    <div
                        // Use the custom Indigo theme
                        className="ag-theme-indigo"
                        style={{ width: '100%', height: 600 }} // Fixed height is essential
                    >
                        <AgGridReact
                            rowData={rowData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}

                            // Enable essential features
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