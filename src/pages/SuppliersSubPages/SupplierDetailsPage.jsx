
// src/pages/SuppliersSubPages/SupplierDetailsPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, ShoppingBag, Truck } from 'lucide-react';
import { useSuppliers } from '../../contexts/SupplierContext.jsx';
import { usePurchaseInvoices } from '../../contexts/PurchaseInvoiceContext.jsx';
import { useLoading } from '../../contexts/LoadingContext.jsx';

const SupplierDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { suppliers, deleteSupplier } = useSuppliers();
    const { purchaseInvoices } = usePurchaseInvoices();
    const { setAppProcessing } = useLoading();
    const [supplier, setSupplier] = useState(null);

    useEffect(() => {
        const selectedSupplier = suppliers.find(s => s.id === id);
        if (selectedSupplier) {
            setSupplier(selectedSupplier);
        } else {
            const timer = setTimeout(() => navigate('/suppliers'), 1000);
            return () => clearTimeout(timer);
        }
    }, [id, suppliers, navigate]);

    const handleDelete = async () => {
        const hasPurchases = purchaseInvoices.some(invoice => invoice.supplierId === id);
        if (hasPurchases) {
            alert('Cannot delete this supplier because they have existing purchase invoices. Please delete their invoices first.');
            return;
        }

        if (window.confirm("Are you sure you want to delete this supplier? This action cannot be undone.")) {
            setAppProcessing(true, 'Deleting supplier...');
            try {
                await deleteSupplier(id);
                navigate('/suppliers');
            } catch (error) {
                console.error("Failed to delete supplier:", error);
                alert(`Error: ${error.message}`);
            } finally {
                setAppProcessing(false);
            }
        }
    };

    // Safely filter purchase invoices
    const supplierInvoices = purchaseInvoices ? purchaseInvoices.filter(invoice => invoice.supplierId === id) : [];

    if (!supplier) {
        return <div>Loading supplier details...</div>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/suppliers" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Suppliers
                    </Link>
                    <h1 className="page-title">{supplier.name}</h1>
                </div>
                <div className="page-actions">
                    <Link to={`/suppliers/${id}/edit`} className="btn btn-white">
                        <Edit size={16} className="mr-2" />
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
                            <div className="flex items-center"><Mail size={16} className="mr-3 text-gray-400"/><span>{supplier.email || 'Not provided'}</span></div>
                            <div className="flex items-center"><Phone size={16} className="mr-3 text-gray-400"/><span>{supplier.primaryContactNumber || 'Not provided'}</span></div>
                            <div className="flex items-center"><MapPin size={16} className="mr-3 text-gray-400"/><span>{supplier.address || 'Not provided'}</span></div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="p-6 flex items-center border-b border-gray-200">
                            <ShoppingBag size={20} className="mr-3 text-gray-500" />
                            <h3 className="text-lg font-semibold">Purchase History</h3>
                        </div>
                        {supplierInvoices.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="table w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice ID</th>
                                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                            <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {supplierInvoices.map(invoice => (
                                            <tr key={invoice.id}>
                                                <td className="p-3 whitespace-nowrap">{invoice.documentNumber}</td>
                                                <td className="p-3 whitespace-nowrap">{new Date(invoice.timestamp).toLocaleDateString()}</td>
                                                <td className="p-3 whitespace-nowrap">
                                                    <span className={`badge ${invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {invoice.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right whitespace-nowrap">${(invoice.total || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-6 text-center text-gray-500">
                                <p>No invoices found for this supplier.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold mb-4">Contact Persons</h3>
                        <div className="space-y-4">
                           <div>
                                <p className="text-sm text-gray-500">Primary Contact</p>
                                <p className="font-medium">{supplier.primaryContactPerson || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Secondary Contact</p>
                                <p className="font-medium">{supplier.secondaryContactPerson || 'N/A'}</p>
                                <p className="text-sm text-gray-600">{supplier.secondaryContactNumber || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
                        <p className="text-gray-600">{supplier.notes || 'No notes for this supplier.'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupplierDetailsPage;
