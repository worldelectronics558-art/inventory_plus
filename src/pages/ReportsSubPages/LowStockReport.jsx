
import React from 'react';
import ReportViewer from './ReportViewer.jsx';
import { useProducts } from '../../contexts/ProductContext.jsx';
import LowStockRow from './LowStockRow.jsx';

const LowStockReport = () => {
    const { products } = useProducts();

    const columns = [
        { header: 'SKU', key: 'sku' },
        { header: 'Product Name', key: 'name' },
        { header: 'Quantity on Hand', key: 'quantity' },
        { header: 'Reorder Level', key: 'reorderLevel' },
        { header: 'Deficit', key: 'deficit' },
    ];

    const lowStockProducts = products.filter(p => p.reorderLevel != null && p.reorderLevel > 0);

    return (
        <ReportViewer
            title="Low Stock Report"
            columns={columns}
        >
            <tbody>
                {lowStockProducts.map(product => (
                    <LowStockRow key={product.id} product={product} />
                ))}
            </tbody>n        </ReportViewer>
    );
};

export default LowStockReport;
