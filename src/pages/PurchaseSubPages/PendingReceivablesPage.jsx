
// src/pages/PurchaseSubPages/PendingReceivablesPage.jsx
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

// AG Grid Community Imports
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';

import { usePendingReceivables } from '../../contexts/PendingReceivablesContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { ArrowLeft } from 'lucide-react';

// Register AG Grid Community modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

const PendingReceivablesPage = () => {
    const { pendingReceivables, isLoading: isReceivablesLoading } = usePendingReceivables();
    const { products, isLoading: isProductsLoading } = useProducts();
    const { locations, isLoading: isLocationsLoading } = useLocations();

    const productMap = useMemo(() =>
        products.reduce((acc, p) => ({ ...acc, [p.id]: getProductDisplayName(p) }), {}),
    [products]);

    const locationMap = useMemo(() =>
        locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.name }), {}),
    [locations]);

    const isLoading = isReceivablesLoading || isProductsLoading || isLocationsLoading;

    // Flatten data for a flat AG Grid table
    const rowData = useMemo(() => {
        if (isLoading) return [];
        return pendingReceivables.flatMap(batch => {
            const commonData = {
                batchId: batch.id,
                productName: productMap[batch.productId] || 'Unknown Product',
                sku: batch.sku,
                location: locationMap[batch.locationId] || 'Unknown Location',
                receivedBy: batch.createdBy?.name || 'Unknown User',
                receivedAt: batch.createdAt?.toDate ? batch.createdAt.toDate().toLocaleString() : 'N/A',
            };

            if (batch.isSerialized && batch.serials?.length > 0) {
                return batch.serials.map(serial => ({
                    ...commonData,
                    id: `${batch.id}-${serial}`,
                    serialNumber: serial,
                    quantity: 1,
                }));
            } else {
                return [{
                    ...commonData,
                    id: batch.id,
                    serialNumber: 'N/A',
                    quantity: batch.quantity,
                }];
            }
        });
    }, [pendingReceivables, productMap, locationMap, isLoading]);

    // Define columns for the flat table
    const [columnDefs] = useState([
        { headerName: 'Batch #', field: 'batchId', filter: 'agTextColumnFilter', sort: 'desc' },
        { headerName: 'Product', field: 'productName', filter: 'agTextColumnFilter' },
        { headerName: 'SKU', field: 'sku', filter: 'agTextColumnFilter' },
        { headerName: 'Serial Number', field: 'serialNumber' },
        { headerName: 'Qty', field: 'quantity', maxWidth: 100 },
        { headerName: 'Received Location', field: 'location', filter: 'agTextColumnFilter' },
        { headerName: 'Received By', field: 'receivedBy', filter: 'agTextColumnFilter' },
        { headerName: 'Received At', field: 'receivedAt', filter: 'agDateColumnFilter' },
    ]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        resizable: true,
        flex: 1,
        minWidth: 120,
        suppressHeaderMenuButton: true,
    }), []);

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/purchase" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Purchase
                    </Link>
                    <h1 className="page-title">Pending Stock Receivables</h1>
                </div>
            </header>
            <div className="page-content">
                <div className="card">
                    <div className="card-body">
                        <p className="mb-4 text-gray-600">This list shows all stock that has been received and is waiting to be linked to a purchase invoice. You can sort by the 'Batch #' column to group items.</p>
                        {isLoading ? (
                            <p>Loading pending items...</p>
                        ) : rowData.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">There are no pending receivables at the moment.</p>
                        ) : (
                            <div className="ag-theme-indigo" style={{ height: '65vh', width: '100%' }}>
                                <AgGridReact
                                    rowData={rowData}
                                    columnDefs={columnDefs}
                                    defaultColDef={defaultColDef}
                                    pagination={true}
                                    paginationPageSize={50}
                                    paginationPageSizeSelector={[50, 100, 200]}
                                    animateRows={true}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PendingReceivablesPage;
