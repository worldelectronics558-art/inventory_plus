
// src/pages/SalesPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { useSalesOrders } from '../contexts/SalesOrderContext'; // Corrected import
import { FilePlus, Truck, ListChecks, ChevronRight, AlertCircle } from 'lucide-react';

const SalesPage = () => {
    // Corrected hook usage
    const { salesOrders, isLoading, error } = useSalesOrders();

    if (isLoading) {
        return <div className="page-container"><p>Loading sales orders...</p></div>;
    }

    if (error) {
        return <div className="page-container alert alert-error">Error: {error.message}</div>;
    }

    const pendingOrders = salesOrders.filter(o => o.status === 'PENDING');
    const finalizedOrders = salesOrders.filter(o => o.status === 'FINALIZED');

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Sales Module</h1>
            </header>

            <div className="page-content">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <ManagementCard
                        to="/sales/new-order"
                        icon={<FilePlus className="h-8 w-8 text-blue-500" />}
                        title="New Sales Order"
                        description="Create a new order for a customer."
                    />
                    <ManagementCard
                        to="/sales/pending-deliverables"
                        icon={<Truck className="h-8 w-8 text-orange-500" />}
                        title="Pending Deliveries"
                        description="Manage items ready for dispatch."
                    />
                    <ManagementCard
                        to="/sales/finalized-orders"
                        icon={<ListChecks className="h-8 w-8 text-green-500" />}
                        title="Finalized Orders"
                        description="View completed and archived sales."
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <OrderList title="Pending Sales Orders" orders={pendingOrders} emptyMessage="No orders are currently pending." />
                    <OrderList title="Recently Finalized" orders={finalizedOrders} emptyMessage="No orders have been finalized recently." />
                </div>
            </div>
        </div>
    );
};

const ManagementCard = ({ to, icon, title, description }) => (
    <Link to={to} className="card bg-base-100 hover:shadow-lg transition-shadow duration-300 ease-in-out">
        <div className="card-body items-center text-center">
            {icon}
            <h2 className="card-title mt-2">{title}</h2>
            <p>{description}</p>
        </div>
    </Link>
);

const OrderList = ({ title, orders, emptyMessage }) => (
    <div className="card bg-base-100">
        <div className="card-body">
            <h2 className="card-title text-xl mb-4">{title}</h2>
            {orders.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2">{emptyMessage}</p>
                </div>
            ) : (
                <ul className="divide-y divide-gray-200">
                    {orders.map(order => (
                        <li key={order.id} className="py-3 flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{order.customerName}</p>
                                <p className="text-sm text-gray-500">Order ID: {order.id}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </div>
);


export default SalesPage;
