
import React, { useState, useMemo } from 'react';
import ReportViewer from './ReportViewer.jsx';
import { useSalesOrders } from '../../contexts/SalesOrderContext.jsx';
import { useProducts } from '../../contexts/ProductContext.jsx';
import { subDays, startOfDay, endOfDay } from 'date-fns';

const SalesByProductReport = () => {
    const { salesOrders } = useSalesOrders();
    const { products } = useProducts();
    const [dateRange, setDateRange] = useState([startOfDay(subDays(new Date(), 29)), endOfDay(new Date())]);

    const columns = [
        { header: 'SKU', key: 'sku' },
        { header: 'Product Name', key: 'name' },
        { header: 'Units Sold', key: 'unitsSold' },
        { header: 'Total Revenue', key: 'totalRevenue' },
    ];

    const reportData = useMemo(() => {
        const [startDate, endDate] = dateRange;
        if (!salesOrders || !products.length) return [];

        const productSales = {};

        salesOrders
            .filter(order => {
                if (!order.orderDate?.seconds) return false;
                const orderDate = new Date(order.orderDate.seconds * 1000);
                return orderDate >= startDate && orderDate <= endDate && order.status === 'DELIVERED';
            })
            .forEach(order => {
                order.items.forEach(item => {
                    if (!productSales[item.productId]) {
                        productSales[item.productId] = { unitsSold: 0, totalRevenue: 0 };
                    }
                    productSales[item.productId].unitsSold += item.quantity;
                    productSales[item.productId].totalRevenue += item.quantity * item.unitPrice;
                });
            });

        return Object.keys(productSales)
            .map(productId => {
                const product = products.find(p => p.id === productId);
                return {
                    sku: product ? product.sku : 'N/A',
                    name: product ? product.name : 'Unknown Product',
                    unitsSold: productSales[productId].unitsSold,
                    totalRevenue: `$${productSales[productId].totalRevenue.toFixed(2)}`,
                };
            })
            .sort((a, b) => b.unitsSold - a.unitsSold); // Sort by units sold descending

    }, [salesOrders, products, dateRange]);

    return (
        <ReportViewer
            title="Sales by Product Report"
            columns={columns}
            data={reportData}
            dateRange={dateRange}
            setDateRange={setDateRange}
        />
    );
};

export default SalesByProductReport;
