
// src/pages/PurchasingPage.jsx

import React from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchaseInvoices } from '../contexts/PurchaseInvoiceContext.jsx';

const PurchasingPage = () => {
    const { invoices, isLoading } = usePurchaseInvoices();
    const navigate = useNavigate();

    const handleRowClick = (id) => {
        // navigate(`/purchasing/invoices/${id}`);
    };

    if (isLoading && invoices.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <p className="text-gray-500">Loading purchase invoices...</p>
            </div>
        );
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Purchase Invoices</h1>
                <div className="page-actions">
                    <Link to="/purchasing/invoices/new" className="btn btn-primary">
                        <Plus size={16} className="mr-2" />
                        New Purchase Invoice
                    </Link>
                </div>
            </header>

            <div className="page-content">
                <div className="card">
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th className="p-3">Reference #</th>
                                    <th className="p-3">Supplier</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3 text-right">Total Amount</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(invoice => (
                                    <tr key={invoice.id} onClick={() => handleRowClick(invoice.id)} className="cursor-pointer hover:bg-gray-50">
                                        <td className="p-3 font-mono text-xs text-gray-500">{invoice.referenceNumber}</td>
                                        <td className="p-3 font-medium text-gray-800">{invoice.supplierName}</td>
                                        <td className="p-3">{new Date(invoice.invoiceDate?.toDate()).toLocaleDateString()}</td>
                                        <td className="p-3 text-right">${invoice.totalAmount?.toFixed(2)}</td>
                                        <td className="p-3 text-center">
                                            <span className={`badge ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {invoice.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            <ChevronRight size={16} className="text-gray-400" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchasingPage;
