
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft, Edit, AlertTriangle } from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

const statusStyles = {
    PENDING: 'text-red-700',
    'PARTIALLY SHIPPED': 'text-blue-700',
    FINALIZED: 'text-green-700',
    CANCELLED: 'text-red-700',
};

const statusBgStyles = {
    PENDING: 'bg-yellow-100',
    'PARTIALLY SHIPPED': 'bg-blue-100',
    FINALIZED: 'bg-green-100',
    CANCELLED: 'bg-red-100',
};

const ViewSalesOrderPage = () => {
    const { id } = useParams(); 
    const navigate = useNavigate();
    const { db, appId } = useAuth();
    
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchOrderById = async () => {
            if (!id) {
                setError('No order ID provided in the URL.');
                setIsLoading(false);
                return;
            }
            
            if (!db || !appId) {
                return;
            }

            setIsLoading(true);
            try {
                const orderDocRef = doc(db, 'artifacts', appId, 'sales_orders', id);
                
                const docSnap = await getDoc(orderDocRef);
                
                if (docSnap.exists()) {
                    setOrder({ ...docSnap.data(), id: docSnap.id });
                } else {
                    setError('Order not found in the database.');
                }
            } catch (err) {
                console.error("Error fetching order:", err);
                setError('Failed to fetch order. A network error may have occurred.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrderById();
    }, [id, db, appId]);

    if (isLoading) {
        return <LoadingOverlay />;
    }

    if (error || !order) {
        return (
            <div className="page-container text-center">
                <AlertTriangle size={48} className="mx-auto text-red-500" />
                <h2 className="mt-4 text-2xl font-bold text-red-600">Order Not Found</h2>
                <p className="mt-2 text-gray-600">{error || 'The order you are looking for does not exist.'}</p>
                <Link to="/sales" className="btn btn-primary mt-6">
                    <ChevronLeft size={20} className="mr-2" />
                    Back to Sales List
                </Link>
            </div>
        );
    }
    
    const canBeEdited = order.status !== 'FINALIZED' && order.status !== 'CANCELLED';

    // Helper to safely get a numeric value, supporting old and new data structures
    const getItemValue = (item, newKey, oldKey) => {
        if (item[newKey] !== undefined) return item[newKey];
        if (item[oldKey] !== undefined) return item[oldKey];
        return 0;
    };

    const GST_RATE = 0.18; // Assuming a constant rate for display calculation if needed

    return (
        <div className="page-container">
            <header className="page-header">
                 <div className="flex items-center gap-4">
                     <button onClick={() => navigate('/sales')} className="btn btn-ghost btn-circle">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="page-title">{order.orderNumber}</h1>
                        <p className="text-sm text-gray-500">Details for sales order</p>
                    </div>
                </div>
                <div className="page-actions">
                     <button 
                        onClick={() => navigate(`/sales/edit/${order.id}`)}
                        className="btn btn-secondary"
                        disabled={!canBeEdited}
                        title={canBeEdited ? "Edit Order" : "Cannot edit a finalized or cancelled order"}
                    >
                        <Edit size={18} className="mr-2" />
                        Edit Order
                    </button>
                </div>
            </header>

            <div className="page-content">
                <div className="card max-w-5xl mx-auto">
                    <div className="p-6 border-b">
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                             <div>
                                <label className="stat-title">Customer</label>
                                <div className="stat-value text-lg">{order.customerName}</div>
                            </div>
                             <div>
                                <label className="stat-title">Order Date</label>
                                <div className="stat-value text-lg">
                                    {order.orderDate?.seconds ? new Date(order.orderDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="stat-title">Status</label>
                                <div className={`stat-value text-lg font-semibold ${statusStyles[order.status] || ''}`}>
                                     <span className={`px-3 py-1 rounded-full ${statusBgStyles[order.status] || ''}`}>{order.status}</span>
                                </div>
                            </div>
                             <div>
                                <label className="stat-title">Reference #</label>
                                <div className="stat-value text-lg">{order.documentNumber || 'N/A'}</div>
                            </div>
                             <div>
                                <label className="stat-title">Created By</label>
                                <div className="stat-value text-lg">{order.createdBy?.name || 'N/A'}</div>
                            </div>
                         </div>
                    </div>
                    
                    <div className="p-6">
                        <h3 className="text-xl font-bold mb-4">Order Items</h3>
                        <div className="overflow-x-auto">
                            <table className="table w-full">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th className="text-right">Ordered</th>
                                        <th className="text-right">Shipped</th>
                                        <th className="text-right">Unit Price (Inc. Tax)</th>
                                        <th className="text-right">Pre-Tax Price</th>
                                        <th className="text-right">Tax</th>
                                        <th className="text-right">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items && order.items.map((item, index) => {
                                        const unitSalePrice = getItemValue(item, 'unitSalePrice', 'unitPrice');
                                        const quantity = item.quantity || 0;
                                        // For backward compatibility, calculate if new fields don't exist
                                        const unitRetailPrice = getItemValue(item, 'unitRetailPrice', unitSalePrice / (1 + GST_RATE));
                                        const unitSaleGST = getItemValue(item, 'unitSaleGST', unitRetailPrice * GST_RATE);
                                        const lineTotal = unitSalePrice * quantity;

                                        return (
                                            <tr key={index}>
                                                <td>
                                                    <div className="font-bold">{item.productName}</div>
                                                    <div className="text-sm opacity-70">SKU: {item.productId}</div>
                                                </td>
                                                <td className="text-right">{quantity}</td>
                                                <td className="text-right font-semibold">{item.deliveredQty || 0}</td>
                                                <td className="text-right">Rs {unitSalePrice.toFixed(2)}</td>
                                                <td className="text-right">Rs {unitRetailPrice.toFixed(2)}</td>
                                                <td className="text-right">Rs {unitSaleGST.toFixed(2)}</td>
                                                <td className="text-right font-bold">Rs {lineTotal.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 border-t rounded-b-lg">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2">
                                <h4 className="font-semibold text-gray-700">Notes</h4>
                                <p className="text-gray-600 mt-1">{order.notes || 'No notes for this order.'}</p>
                            </div>
                            <div className="md:col-span-2 space-y-3">
                                 <div className="flex justify-between items-center text-lg">
                                    <span className="text-gray-600">Subtotal (Pre-Tax):</span>
                                    <span className="font-semibold text-gray-800">Rs {(order.totalPreTax ?? 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-lg">
                                    <span className="text-gray-600">Total Tax:</span>
                                    <span className="font-semibold text-gray-800">Rs {(order.totalTax ?? 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-2xl border-t pt-3 mt-2">
                                    <span className="font-bold">Total Amount:</span>
                                    <span className="font-bold text-emerald-600">Rs {(order.totalAmount ?? 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewSalesOrderPage;
