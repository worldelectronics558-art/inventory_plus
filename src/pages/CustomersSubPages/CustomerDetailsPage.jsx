
// src/pages/customersSubPages/CustomerDetailsPage.jsx

import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCustomers } from '../../contexts/CustomerContext';
import { useSalesOrders } from '../../contexts/SalesOrderContext';
import { useLoading } from '../../contexts/LoadingContext';
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, User, Star, ShoppingBag } from 'lucide-react';

const CustomerDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { customers, deleteCustomer } = useCustomers();
    const { salesOrders } = useSalesOrders();
    const { setAppProcessing } = useLoading();

    const customer = customers.find(c => c.id === id);
    const customerOrders = salesOrders.filter(order => order.customerId === id);

    const totalOrders = customerOrders.length;
    const lifetimeValue = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0);

    const handleDelete = async () => {
        const hasSales = salesOrders.some(order => order.customerId === id);
        if (hasSales) {
            alert('Cannot delete this customer because they have existing sales orders. Please delete their orders first.');
            return;
        }

        if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
            setAppProcessing(true, 'Deleting customer...');
            try {
                await deleteCustomer(id);
                navigate('/customers');
            } catch (error) {
                console.error('Failed to delete customer:', error);
                alert(`Error: ${error.message}`);
            } finally {
                setAppProcessing(false);
            }
        }
    };

    if (!customer) {
        return (
            <div className="page-container text-center">
                <h1 className="page-title">Customer Not Found</h1>
                <p className="mb-4">We couldn't find a customer with the ID: {id}</p>
                <Link to="/customers" className="btn btn-primary">
                    <ArrowLeft size={16} className="mr-2" />
                    Back to All Customers
                </Link>
            </div>
        );
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/customers" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Customers
                    </Link>
                    <h1 className="page-title">{customer.name}</h1>
                </div>
                <div className="page-actions">
                    <Link to={`/customers/${id}/edit`} className="btn btn-white">
                        <Edit size={16} className="mr-2"/>
                        Edit
                    </Link>
                    <button className="btn btn-danger" onClick={handleDelete}>
                        <Trash2 size={16} className="mr-2" />
                        Delete
                    </button>
                </div>
            </header>

            <div className="page-content grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
                        <div className="space-y-4">
                            <div className="flex items-center"><Mail size={16} className="mr-3 text-gray-400"/><span>{customer.email || 'Not provided'}</span></div>
                            <div className="flex items-center"><Phone size={16} className="mr-3 text-gray-400"/><span>{customer.phone}</span></div>
                            <div className="flex items-center"><MapPin size={16} className="mr-3 text-gray-400"/><span>{customer.address || 'Not provided'}</span></div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="p-6 flex items-center border-b border-gray-200">
                            <ShoppingBag size={20} className="mr-3 text-gray-500" />
                            <h3 className="text-lg font-semibold">Order History</h3>
                        </div>
                        {customerOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="table w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order ID</th>
                                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                            <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {customerOrders.map(order => (
                                            <tr key={order.id}>
                                                <td className="p-3 whitespace-nowrap">{order.documentNumber}</td>
                                                <td className="p-3 whitespace-nowrap">{new Date(order.timestamp).toLocaleDateString()}</td>
                                                <td className="p-3 whitespace-nowrap">
                                                    <span className={`badge ${order.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right whitespace-nowrap">${(order.total || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-6 text-center text-gray-500">
                                <p>No orders found for this customer.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold mb-4">Customer Overview</h3>
                        <div className="space-y-4">
                            <div className="flex items-center"><User size={16} className="mr-3 text-gray-400"/>Customer Type: <span className="ml-2 font-medium">{customer.priceType}</span></div>
                            <div className="flex items-center"><ShoppingBag size={16} className="mr-3 text-gray-400"/>Total Orders: <span className="ml-2 font-medium">{totalOrders}</span></div>
                            <div className="flex items-center"><Star size={16} className="mr-3 text-gray-400"/>Lifetime Value: <span className="ml-2 font-medium">${lifetimeValue.toFixed(2)}</span></div>
                        </div>
                    </div>
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
                        <p className="text-gray-600">{customer.notes || 'No notes for this customer.'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDetailsPage;
