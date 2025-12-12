
// src/components/SalesOrderCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Eye, CheckCircle } from 'lucide-react';

const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    'PARTIALLY SHIPPED': 'bg-blue-100 text-blue-700',
    FINALIZED: 'bg-green-100 text-green-700',
};

const SalesOrderCard = ({ order, deleteSalesOrder, isMutationDisabled }) => {
    const navigate = useNavigate();

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete order ${order.orderNumber}?`)) {
            try {
                await deleteSalesOrder(order.id);
            } catch (error) {
                console.error("Failed to delete sales order:", error);
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleNavigate = (e, path) => {
        e.stopPropagation();
        navigate(path);
    }

    const handleCardClick = () => {
        if (order.status === 'PENDING') {
            navigate(`/sales/finalize-order/${order.id}`);
        } else {
            navigate(`/sales/view/${order.id}`);
        }
    }

    const canBeDeleted = order.status === 'PENDING';
    const canBeEdited = order.status !== 'FINALIZED';
    const canBeFinalized = order.status !== 'FINALIZED';

    return (
        <div 
            className="card mb-4 shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow duration-200" 
            onClick={handleCardClick}
        >
            <div className="card-body p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-blue-600 hover:underline">{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">{order.customerName}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[order.status] || 'bg-gray-100 text-gray-800'}`}>
                        {order.status}
                    </span>
                </div>
                <div className="mt-4 text-sm text-gray-700 grid grid-cols-2 gap-x-4">
                    <p><strong>Date:</strong> {order.orderDate?.seconds ? new Date(order.orderDate.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Total:</strong> <span className="font-semibold">{order.totalAmount != null ? `Rs ${order.totalAmount.toFixed(2)}` : 'N/A'}</span></p>
                </div>
                <div className="card-actions justify-end items-center mt-4 gap-2">
                    <button 
                        onClick={(e) => handleNavigate(e, `/sales/view/${order.id}`)}
                        className="btn btn-sm btn-ghost text-blue-600" 
                        title="View"
                    >
                        <Eye size={18} />
                    </button>
                     <button 
                        onClick={(e) => handleNavigate(e, `/sales/edit/${order.id}`)}
                        className={`btn btn-sm btn-ghost text-gray-600 ${!canBeEdited || isMutationDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        disabled={!canBeEdited || isMutationDisabled}
                        title={canBeEdited ? "Edit" : "Cannot edit a finalized order"}
                    >
                        <Edit size={18} />
                    </button>
                     <button 
                        onClick={handleDelete}
                        className={`btn btn-sm btn-ghost text-red-600 ${!canBeDeleted || isMutationDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        disabled={!canBeDeleted || isMutationDisabled}
                        title={canBeDeleted ? "Delete" : "Can only delete PENDING orders"}
                    >
                        <Trash2 size={18} />
                    </button>
                     <button 
                        onClick={(e) => handleNavigate(e, `/sales/finalize-order/${order.id}`)}
                        className={`btn btn-sm btn-ghost text-green-600 ${!canBeFinalized || isMutationDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        disabled={!canBeFinalized || isMutationDisabled}
                        title={canBeFinalized ? "Finalize" : "Order already finalized"}
                    >
                        <CheckCircle size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesOrderCard;
