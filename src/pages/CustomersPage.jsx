
// src/pages/CustomersPage.jsx

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomers } from '../contexts/CustomerContext';
import { useSales } from '../contexts/SalesContext';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useLoading } from '../contexts/LoadingContext';

const CustomersPage = () => {
    const { customers, deleteCustomer, isLoading } = useCustomers();
    const { salesOrders } = useSales();
    const { setAppProcessing } = useLoading();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const handleEdit = (customerId) => {
        navigate(`/customers/${customerId}`);
    };

    const handleDelete = async (customerId) => {
        const hasSales = salesOrders.some(order => order.customerId === customerId);
        if (hasSales) {
            alert('Cannot delete this customer because they have existing sales orders. Please delete their orders first.');
            return;
        }

        if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
            setAppProcessing(true, 'Deleting customer...');
            try {
                await deleteCustomer(customerId);
            } catch (error) {
                console.error('Failed to delete customer:', error);
                alert(`Error: ${error.message}`);
            } finally {
                setAppProcessing(false);
            }
        }
    };

    const filteredCustomers = customers.filter(c => {
        const search = searchTerm.toLowerCase();
        const phoneDigits = c.phone.replace(/\D/g, '');
        const searchTermDigits = search.replace(/\D/g, '');

        return (
            c.name.toLowerCase().includes(search) ||
            (searchTermDigits && phoneDigits.includes(searchTermDigits)) ||
            (c.cnic && c.cnic.replace(/-/g, '').includes(search.replace(/-/g, ''))) ||
            (c.id && c.id.toLowerCase().includes(search))
        );
    });

    const renderCustomers = () => {
        if (isLoading) {
            return <tr><td colSpan="9" className="text-center py-10">Loading customers...</td></tr>;
        }
        if (filteredCustomers.length === 0) {
            return <tr><td colSpan="9" className="text-center py-10 text-gray-500">No customers found.</td></tr>;
        }
        return filteredCustomers.map(customer => (
            <tr key={customer.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{customer.id}</td>
                <td className="px-4 py-3 font-medium">
                    <Link to={`/customers/${customer.id}`} className="text-indigo-600 hover:text-indigo-900">
                        {customer.name}
                    </Link>
                </td>
                <td className="px-4 py-3">{customer.phone}</td>
                <td className="px-4 py-3">{customer.secondaryContact}</td>
                <td className="px-4 py-3">{customer.cnic}</td>
                <td className="px-4 py-3">{customer.priceType}</td>
                <td className="px-4 py-3 truncate max-w-xs">{customer.address}</td>
                <td className="px-4 py-3 truncate max-w-xs">{customer.notes}</td>
                <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(customer.id)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="Edit Customer">
                            <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Delete Customer">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </td>
            </tr>
        ));
    };

    return (
        <div className="page-container">
            <div className="flex justify-between items-center mb-6">
                <h1 className="page-title">Customers</h1>
                <Link to="/customers/new" className="btn btn-primary">
                    <Plus size={16} className="mr-2" />
                    Add New Customer
                </Link>
            </div>

            <div className="card mb-6">
                 <div className="flex justify-between items-center">
                    <div className="relative w-full max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="Search by ID, Name, Phone, or CNIC..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="input-base pl-10"
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Primary Contact</th>
                                <th className="px-4 py-3">Secondary Contact</th>
                                <th className="px-4 py-3">CNIC</th>
                                <th className="px-4 py-3">Price Type</th>
                                <th className="px-4 py-3">Address</th>
                                <th className="px-4 py-3">Notes</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderCustomers()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CustomersPage;
