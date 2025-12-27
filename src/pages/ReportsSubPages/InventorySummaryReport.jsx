
import React from 'react';
import ReportViewer from './ReportViewer.jsx';
import { useProducts } from '../../contexts/ProductContext.jsx';
import ProductInventoryRow from './ProductInventoryRow.jsx';

const InventorySummaryReport = () => {
    const { products } = useProducts();

    const columns = [
        { header: 'SKU', key: 'sku' },
        { header: 'Product Name', key: 'name' },
        { header: 'Location', key: 'location' },
        { header: 'Quantity on Hand', key: 'quantity' },
        { header: 'Unit Cost', key: 'cost' },
        { header: 'Total Value', key: 'totalValue' },
    ];

    return (
        <ReportViewer
            title="Inventory Summary Report"
            columns={columns}
        >
            <tbody>
                {products.map(product => (
                    <ProductInventoryRow key={product.id} product={product} />
                ))}
            </tbody>
        </ReportViewer>
    );
};

export default InventorySummaryReport;
