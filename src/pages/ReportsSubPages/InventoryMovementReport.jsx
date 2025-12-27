
import React from 'react';
import ReportViewer from './ReportViewer.jsx';

// This is a placeholder for the Inventory Movement Report.
// The full implementation will require fetching and displaying product transaction history.
const InventoryMovementReport = () => {
    const columns = [
        { header: 'Date', key: 'date' },
        { header: 'Product', key: 'product' },
        { header: 'Transaction Type', key: 'type' },
        { header: 'Quantity In', key: 'qtyIn' },
        { header: 'Quantity Out', key: 'qtyOut' },
        { header: 'Balance', key: 'balance' },
        { header: 'Reference', key: 'reference' },
    ];

    // Placeholder data
    const data = [];

    return (
        <ReportViewer
            title="Inventory Movement Report"
            columns={columns}
            data={data}
            // We would need a product selector here in a full implementation
        />
    );
};

export default InventoryMovementReport;
