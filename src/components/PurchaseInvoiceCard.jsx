
// src/components/PurchaseInvoiceCard.jsx
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Edit, Trash2, Eye, CheckCircle } from 'lucide-react';

const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    'PARTIALLY RECEIVED': 'bg-blue-100 text-blue-700',
    FINALIZED: 'bg-green-100 text-green-700',
};

const PurchaseInvoiceCard = ({ invoice, deleteInvoice, isMutationDisabled }) => {
    const navigate = useNavigate();

    const handleDelete = async (e) => {
        e.stopPropagation(); // Prevent card click navigation
        if (window.confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}?`)) {
            try {
                await deleteInvoice(invoice.id);
            } catch (error) {
                console.error("Failed to delete invoice:", error);
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleNavigate = (e, path) => {
        e.stopPropagation();
        navigate(path);
    }

    const handleCardClick = () => {
        // Default navigation: finalize if pending, otherwise view
        if (invoice.status === 'Pending' || invoice.status === 'Partially Received') {
            navigate(`/purchase/finalize/${invoice.id}`);
        } else {
            navigate(`/purchase/view/${invoice.id}`);
        }
    }

    const canBeDeleted = invoice.status === 'PENDING';
    const canBeEdited = invoice.status !== 'FINALIZED';
    const canBeFinalized = invoice.status !== 'FINALIZED';

    return (
        <div 
            className="card mb-4 shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow duration-200" 
            onClick={handleCardClick}
        >
            <div className="card-body p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <p 
                           className="font-bold text-lg text-blue-600 hover:underline"
                        >
                            {invoice.invoiceNumber}
                        </p>
                        <p className="text-sm text-gray-600">{invoice.supplierName}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[invoice.status] || 'bg-gray-100 text-gray-800'}`}>
                        {invoice.status}
                    </span>
                </div>
                <div className="mt-4 text-sm text-gray-700 grid grid-cols-2 gap-x-4">
                    <p><strong>Date:</strong> {invoice.invoiceDate?.seconds ? new Date(invoice.invoiceDate.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Total:</strong> <span className="font-semibold">{invoice.totalAmount != null ? `Rs ${invoice.totalAmount.toFixed(2)}` : 'N/A'}</span></p>
                </div>
                <div className="card-actions justify-end items-center mt-4 gap-2">
                    <button 
                        onClick={(e) => handleNavigate(e, `/purchase/view/${invoice.id}`)}
                        className="btn btn-sm btn-ghost text-blue-600" 
                        title="View"
                    >
                        <Eye size={18} />
                    </button>
                     <button 
                        onClick={(e) => handleNavigate(e, `/purchase/edit/${invoice.id}`)}
                        className={`btn btn-sm btn-ghost text-gray-600 ${!canBeEdited || isMutationDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        disabled={!canBeEdited || isMutationDisabled}
                        title={canBeEdited ? "Edit" : "Cannot edit a finalized invoice"}
                    >
                        <Edit size={18} />
                    </button>
                     <button 
                        onClick={handleDelete}
                        className={`btn btn-sm btn-ghost text-red-600 ${!canBeDeleted || isMutationDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        disabled={!canBeDeleted || isMutationDisabled}
                        title={canBeDeleted ? "Delete" : "Can only delete Pending invoices"}
                    >
                        <Trash2 size={18} />
                    </button>
                     <button 
                        onClick={(e) => handleNavigate(e, `/purchase/finalize/${invoice.id}`)}
                        className={`btn btn-sm btn-ghost text-green-600 ${!canBeFinalized || isMutationDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        disabled={!canBeFinalized || isMutationDisabled}
                        title={canBeFinalized ? "Finalize" : "Invoice already finalized"}
                    >
                        <CheckCircle size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseInvoiceCard;
