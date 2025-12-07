
// src/components/PurchaseInvoiceCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseInvoices } from '../contexts/PurchaseInvoiceContext';
import { Edit, Trash2, Eye } from 'lucide-react';

const getStatusChipClass = (status) => {
    switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'finalized': return 'bg-green-100 text-green-800';
        case 'cancelled': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const PurchaseInvoiceCard = ({ invoice, isMutationDisabled }) => {
    const navigate = useNavigate();
    const { deleteInvoice } = usePurchaseInvoices();

    const handleDelete = async (e, id) => {
        e.stopPropagation(); // Prevent card click navigation
        if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
            try {
                await deleteInvoice(id);
            } catch (error) {
                console.error("Failed to delete invoice:", error);
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleCardClick = () => {
        if (invoice.status === 'pending') {
            navigate(`/purchase/finalize/${invoice.id}`);
        } else {
            navigate(`/purchase/view/${invoice.id}`);
        }
    }

    return (
        <div 
            className="card mb-4 shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow duration-200" 
            onClick={handleCardClick}
        >
            <div className="card-body p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">{invoice.invoiceNumber}</h3>
                        <p className="text-sm text-gray-600">{invoice.supplierName}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusChipClass(invoice.status)}`}>
                        {invoice.status}
                    </span>
                </div>
                <div className="mt-4 text-sm text-gray-700 grid grid-cols-2 gap-x-4">
                    <p><strong>Date:</strong> {invoice.invoiceDate?.seconds ? new Date(invoice.invoiceDate.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Gross Value:</strong> <span className="font-semibold">{invoice.totalAmount ? `Rs ${invoice.totalAmount.toFixed(2)}` : 'N/A'}</span></p>
                    <p><strong>Created By:</strong> {invoice.createdByName || 'N/A'}</p>
                </div>
                <div className="card-actions justify-end mt-4 gap-2">
                     {invoice.status === 'pending' ? (
                         <>
                             <button 
                                 onClick={(e) => { e.stopPropagation(); navigate(`/purchase/edit/${invoice.id}`); }}
                                 className="btn btn-sm btn-secondary"
                                 disabled={isMutationDisabled}
                             >
                                 <Edit size={16} className="mr-1"/> Edit
                             </button>
                             <button 
                                 onClick={(e) => handleDelete(e, invoice.id)}
                                 className="btn btn-sm btn-danger"
                                 disabled={isMutationDisabled}
                             >
                                 <Trash2 size={16} className="mr-1"/> Delete
                             </button>
                             <button 
                                 onClick={(e) => { e.stopPropagation(); navigate(`/purchase/finalize/${invoice.id}`); }}
                                 className="btn btn-sm btn-primary"
                                 disabled={isMutationDisabled}
                             >
                                 Finalize
                             </button>
                         </>
                     ) : (
                         <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/purchase/view/${invoice.id}`); }}
                            className="btn btn-sm btn-outline-secondary"
                        >
                             <Eye size={16} className="mr-1"/> View
                         </button>
                     )}
                </div>
            </div>
        </div>
    );
};

export default PurchaseInvoiceCard;
