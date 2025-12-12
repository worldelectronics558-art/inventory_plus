
// src/pages/SalesSubPages/PendingDeliverablesPage.jsx

import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { useProducts } from '../../contexts/ProductContext';
import { Trash2, Edit, CheckCircle, Plus, ChevronLeft } from 'lucide-react';
import { useSalesOrders } from '../../contexts/SalesOrderContext'; // Corrected import

const PendingDeliverablesPage = () => {
    const navigate = useNavigate();
    const { pendingDeliverables, isLoading, deleteDeliverableBatch } = usePendingDeliverables();
    const { products } = useProducts();
    const { salesOrders } = useSalesOrders(); // Corrected hook usage

    // Group deliverables by batchId, just like in the purchase module
    const groupedDeliverables = useMemo(() => {
        if (!pendingDeliverables) return [];
        const groups = {};
        pendingDeliverables.forEach(d => {
            if (!groups[d.batchId]) {
                groups[d.batchId] = {
                    items: [],
                    batchId: d.batchId,
                    locationId: d.locationId,
                    createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(),
                    // Find a sales order that matches the location and has pending items
                    salesOrder: salesOrders.find(so => so.locationId === d.locationId && so.status === 'PENDING')
                };
            }
            groups[d.batchId].items.push(d);
        });
        return Object.values(groups);
    }, [pendingDeliverables, salesOrders]);

    const handleDelete = async (batchId) => {
        if (window.confirm('Are you sure you want to delete this entire batch?')) {
            try {
                await deleteDeliverableBatch(batchId);
                alert('Batch deleted successfully.');
            } catch (error) {
                alert(`Failed to delete batch: ${error.message}`);
            }
        }
    };

    const handleFinalize = (batch) => {
        if (!batch.salesOrder) {
            alert('No matching PENDING sales order for this location. Please create a sales order first.');
            return;
        }
        // Navigate with the correct sales order data
        navigate('/sales/finalize-order', { state: { order: batch.salesOrder } });
    };

    if (isLoading) return <div className="page-container"><p>Loading pending deliverables...</p></div>;

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Pending Deliveries</h1>
                <div className="page-actions">
                    <Link to="/sales" className="btn btn-ghost">
                        <ChevronLeft size={20}/>
                        Back to Sales
                    </Link>
                    <Link to="/sales/stock-delivery" className="btn btn-primary">
                        <Plus size={20}/>
                        Create New Delivery
                    </Link>
                </div>
            </header>
            <div className="page-content">
                {groupedDeliverables.length === 0 ? (
                    <p>No pending deliveries.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedDeliverables.map(batch => (
                            <div key={batch.batchId} className="card bg-base-100 shadow-xl">
                                <div className="card-body">
                                    <h2 className="card-title text-lg">Batch ID: {batch.batchId}</h2>
                                    <p><strong>Location:</strong> {batch.locationId}</p>
                                    <p><strong>Created:</strong> {batch.createdAt.toLocaleString()}</p>
                                    <p className={`font-bold ${batch.salesOrder ? 'text-green-600' : 'text-red-600'}`}>
                                        {batch.salesOrder ? `Linked to SO: ${batch.salesOrder.id}` : 'No Matching Sales Order'}
                                    </p>
                                    <div className="divider my-2"></div>
                                    <ul className="space-y-1 text-sm">
                                        {batch.items.map(item => {
                                            const product = products.find(p => p.id === item.productId);
                                            return (
                                                <li key={item.id} className="p-1 bg-gray-50 rounded-md">
                                                    <span>{getProductDisplayName(product || { name: item.productName })}</span>
                                                    <span className="font-mono float-right">x{item.quantity}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <div className="card-actions justify-end mt-4">
                                        <button onClick={() => handleDelete(batch.batchId)} className="btn btn-sm btn-error btn-outline">
                                            <Trash2 size={16}/> Delete
                                        </button>
                                        <button onClick={() => handleFinalize(batch)} className="btn btn-sm btn-success" disabled={!batch.salesOrder}>
                                            <CheckCircle size={16}/> Finalize
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingDeliverablesPage;
