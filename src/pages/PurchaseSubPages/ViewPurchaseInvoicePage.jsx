
// src/pages/PurchaseSubPages/ViewPurchaseInvoicePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePurchaseInvoices } from '../../contexts/PurchaseInvoiceContext';
import { ChevronLeft, Edit } from 'lucide-react';

const statusStyles = {
    Pending: 'text-yellow-700',
    'Partially Received': 'text-blue-700',
    Finalized: 'text-green-700',
};

const statusBgStyles = {
    Pending: 'bg-yellow-100',
    'Partially Received': 'bg-blue-100',
    Finalized: 'bg-green-100',
};

const ViewPurchaseInvoicePage = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const { invoices, isLoading } = usePurchaseInvoices();
    
    // --- STATE TO HOLD THE INVOICE ---
    const [invoice, setInvoice] = useState(null);

    useEffect(() => {
        if (!isLoading && invoices.length > 0) {
            const foundInvoice = invoices.find(inv => inv.id === invoiceId);
            setInvoice(foundInvoice);
        }
    }, [isLoading, invoices, invoiceId]);

    // --- RENDER LOGIC RESTRUCTURED ---

    // 1. Show loading state first
    if (isLoading) {
        return <div className="page-container flex justify-center items-center"><p>Loading invoice details...</p></div>;
    }

    // 2. After loading, if no invoice is found, show the error
    if (!invoice) {
        return (
            <div className="page-container text-center">
                <h2 className="text-2xl font-bold text-red-600">Invoice Not Found</h2>
                <p className="mt-4">The invoice you are looking for does not exist or may have been deleted.</p>
                <Link to="/purchase" className="btn btn-primary mt-6">
                    <ChevronLeft size={20} className="mr-2" />
                    Back to Purchase List
                </Link>
            </div>
        );
    }
    
    // 3. If loading is false and an invoice is found, render the page
    const canBeEdited = invoice.status !== 'Finalized';

    return (
        <div className="page-container">
            <header className="page-header">
                <div className="flex items-center gap-4">
                     <button onClick={() => navigate('/purchase')} className="btn btn-ghost btn-circle">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="page-title">{invoice.invoiceNumber}</h1>
                        <p className="text-sm text-gray-500">Details for purchase invoice</p>
                    </div>
                </div>
                <div className="page-actions">
                     <button 
                        onClick={() => navigate(`/purchase/edit/${invoice.id}`)}
                        className="btn btn-secondary"
                        disabled={!canBeEdited}
                        title={canBeEdited ? "Edit Invoice" : "Cannot edit a finalized invoice"}
                    >
                        <Edit size={18} className="mr-2" />
                        Edit Invoice
                    </button>
                </div>
            </header>

            <div className="page-content">
                <div className="card max-w-4xl mx-auto">
                    <div className="p-6 border-b">
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                             <div>
                                <label className="stat-title">Supplier</label>
                                <div className="stat-value text-lg">{invoice.supplierName}</div>
                            </div>
                             <div>
                                <label className="stat-title">Invoice Date</label>
                                <div className="stat-value text-lg">
                                    {invoice.invoiceDate?.seconds ? new Date(invoice.invoiceDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="stat-title">Status</label>
                                <div className={`stat-value text-lg font-semibold ${statusStyles[invoice.status] || ''}`}>
                                     <span className={`px-3 py-1 rounded-full ${statusBgStyles[invoice.status] || ''}`}>{invoice.status}</span>
                                </div>
                            </div>
                             <div>
                                <label className="stat-title">Reference #</label>
                                <div className="stat-value text-lg">{invoice.referenceNumber || 'N/A'}</div>
                            </div>
                             <div>
                                <label className="stat-title">Created By</label>
                                <div className="stat-value text-lg">{invoice.createdBy?.name || 'N/A'}</div>
                            </div>
                         </div>
                    </div>
                    
                    <div className="p-6">
                        <h3 className="text-xl font-bold mb-4">Invoice Items</h3>
                        <div className="overflow-x-auto">
                            <table className="table w-full">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th className="text-right">Ordered</th>
                                        <th className="text-right">Received</th>
                                        <th className="text-right">Unit Cost</th>
                                        <th className="text-right">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.items && invoice.items.map((item, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className="font-bold">{item.productName}</div>
                                                <div className="text-sm opacity-70">SKU: {item.sku}</div>
                                            </td>
                                            <td className="text-right">{item.quantity}</td>
                                            <td className="text-right font-semibold">{item.receivedQty || 0}</td>
                                            <td className="text-right">${item.cost?.toFixed(2) || '0.00'}</td>
                                            <td className="text-right font-bold">${(item.quantity * item.cost).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colSpan="4" className="text-right text-lg">Total Amount</th>
                                        <th className="text-right text-lg">${invoice.totalAmount?.toFixed(2) || '0.00'}</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewPurchaseInvoicePage;
