import React, { useState, useMemo } from 'react';
import ReportViewer from './ReportViewer.jsx';
import { useSalesOrders } from '../../contexts/SalesOrderContext.jsx';
import { useProducts } from '../../contexts/ProductContext.jsx';
import { subDays, startOfDay, endOfDay } from 'date-fns';

const SalesByPeriodReport = () => {
    const { salesOrders } = useSalesOrders();
    const { products } = useProducts();
    const [dateRange, setDateRange] = useState([startOfDay(subDays(new Date(), 29)), endOfDay(new Date())]);

    const columns = [
        { header: 'Date', key: 'date' },
        { header: 'Order ID', key: 'orderId' },
        { header: 'Customer', key: 'customer' },
        { header: 'Total Items', key: 'totalItems' },
        { header: 'Total Cost', key: 'totalCost' },
        { header: 'Total Revenue', key: 'totalRevenue' },
        { header: 'Gross Profit', key: 'grossProfit' },
    ];

    const reportData = useMemo(() => {
        const [startDate, endDate] = dateRange;
        if (!salesOrders || !products.length) return [];

        return salesOrders
            .filter(order => {
                if (!order.orderDate?.seconds) return false;
                const orderDate = new Date(order.orderDate.seconds * 1000);
                return orderDate >= startDate && orderDate <= endDate && order.status === 'DELIVERED';
            })
            .map(order => {
                const totalCost = order.items.reduce((acc, item) => {
                    const product = products.find(p => p.id === item.productId);
                    return acc + ((product?.cost || 0) * item.quantity);
                }, 0);

                const totalRevenue = order.totalAmount;
                const grossProfit = totalRevenue - totalCost;

                return {
                    date: new Date(order.orderDate.seconds * 1000).toLocaleDateString(),
                    orderId: order.orderNumber,
                    customer: order.customerName,
                    totalItems: order.items.reduce((acc, item) => acc + item.quantity, 0),
                    totalCost: `$${totalCost.toFixed(2)}`,
                    totalRevenue: `$${totalRevenue.toFixed(2)}`,
                    grossProfit: `$${grossProfit.toFixed(2)}`,
                };
            });
    }, [salesOrders, products, dateRange]);

    return (
        <ReportViewer
            title="Sales by Period Report"
            columns={columns}
            data={reportData}
            dateRange={dateRange}
            setDateRange={setDateRange}
        />
    );
};

export default SalesByPeriodReport;