
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useProducts } from '../../contexts/ProductContext';
import { getProductDisplayName } from '../../utils/productUtils';
import LoadingSpinner from '../../components/LoadingOverlay';
import { ArrowLeft, FileText, Package, User, Clock } from 'lucide-react';

const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return 'Invalid Date';
    return timestamp.toDate().toLocaleString();
};

const DetailCard = ({ title, icon, children }) => (
    <div className="card">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-3">
            {icon}
            <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="p-4 space-y-2">{children}</div>
    </div>
);

const DetailRow = ({ label, value, className }) => (
    <div className={`flex justify-between items-center text-sm ${className}`}>
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-800 font-mono text-right">{value}</span>
    </div>
);


const LogDetailsPage = () => {
    const { logId } = useParams();
    const { db, appId } = useAuth();
    const { products, isLoading: productsLoading } = useProducts();

    const [log, setLog] = useState(null);
    const [contextDoc, setContextDoc] = useState(null);
    const [inventoryItem, setInventoryItem] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!db || !appId || !logId) return;

        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch the primary history log document
                const logRef = doc(db, `artifacts/${appId}/item_history`, logId);
                const logSnap = await getDoc(logRef);

                if (!logSnap.exists()) {
                    throw new Error('History log not found.');
                }
                const logData = { id: logSnap.id, ...logSnap.data() };
                setLog(logData);

                let fetchedContextDoc = null;
                let fetchedInventoryItem = null;

                // 2. Fetch the associated context document (e.g., Sales Order)
                if (logData.context?.documentId) {
                    let docPath = '';
                    if (logData.context.type === 'SALES_ORDER') {
                        docPath = `artifacts/${appId}/sales_orders/${logData.context.documentId}`;
                    } else if (logData.context.type === 'PURCHASE_INVOICE') {
                        docPath = `artifacts/${appId}/purchase_invoices/${logData.context.documentId}`;
                    }
                    
                    if (docPath) {
                        const contextRef = doc(db, docPath);
                        const contextSnap = await getDoc(contextRef);
                        if(contextSnap.exists()) fetchedContextDoc = { id: contextSnap.id, ...contextSnap.data() };
                    }
                }
                setContextDoc(fetchedContextDoc);

                // 3. Fetch the inventory item document to show its own history
                if (logData.inventoryItemId) {
                    const invItemRef = doc(db, `artifacts/${appId}/inventory_items`, logData.inventoryItemId);
                    const invItemSnap = await getDoc(invItemRef);
                    if(invItemSnap.exists()) fetchedInventoryItem = { id: invItemSnap.id, ...invItemSnap.data() };
                }
                setInventoryItem(fetchedInventoryItem);

            } catch (err) {
                console.error("Error fetching log details:", err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [db, appId, logId]);

    const product = useMemo(() => {
        if (!log || !products.length) return null;
        return products.find(p => p.id === log.productId);
    }, [log, products]);

    if (isLoading || productsLoading) {
        return <LoadingSpinner>Loading Log Details...</LoadingSpinner>;
    }

    if (error) {
        return <div className="page-container text-center"><p className="text-red-500">{error}</p></div>;
    }
    
    if (!log) {
        return <div className="page-container text-center"><p>No log data found.</p></div>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/history" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" /> Back to History
                    </Link>
                    <h1 className="page-title">History Log Detail</h1>
                </div>
            </header>

            <div className="page-content grid md:grid-cols-3 gap-6">
                {/* Left Column: Core Log Info */}
                <div className="md:col-span-1 space-y-6">
                    <DetailCard title="Event Details" icon={<FileText className="text-gray-500" />}>
                        <DetailRow label="Log ID" value={log.id} />
                        <DetailRow label="Event Type" value={<span className='font-bold'>{log.type.replace('_', ' ')}</span>} />
                        <DetailRow label="Timestamp" value={formatTimestamp(log.timestamp)} />
                    </DetailCard>

                    <DetailCard title="Product" icon={<Package className="text-gray-500" />}>
                        <DetailRow label="Name" value={product ? getProductDisplayName(product) : 'N/A'} />
                        <DetailRow label="SKU" value={product?.sku || 'N/A'} />
                        <DetailRow label="Quantity Change" value={
                            <span className={`font-bold ${log.type === 'STOCK_DELIVERED' ? 'text-red-500' : 'text-green-600'}`}>
                                {log.type === 'STOCK_DELIVERED' ? '-' : '+'}{log.quantity}
                            </span>
                        } />
                        <DetailRow label="Location" value={log.locationId || 'N/A'} />
                    </DetailCard>

                     <DetailCard title="User" icon={<User className="text-gray-500" />}>
                        <DetailRow label="User Name" value={log.user?.name || 'System'} />
                        <DetailRow label="User ID" value={log.user?.uid || 'N/A'} />
                    </DetailCard>
                </div>

                {/* Right Column: Contextual Details */}
                <div className="md:col-span-2 space-y-6">
                   {contextDoc && (
                        <DetailCard title={`Context: ${log.context.type.replace('_', ' ')}`}>
                           <DetailRow label="Document ID" value={contextDoc.id} />
                           <DetailRow label="Document Number" value={contextDoc.orderNumber || contextDoc.invoiceNumber || 'N/A'} />
                           <DetailRow label="Customer/Supplier" value={contextDoc.customerName || contextDoc.supplierName || 'N/A'} />
                            <div className="pt-2 text-right">
                                 <Link 
                                    to={log.context.type === 'SALES_ORDER' ? `/sales/orders/${contextDoc.id}` : `/purchases/invoices/${contextDoc.id}`}
                                    className="btn btn-sm btn-secondary"
                                >
                                    View Full Document
                                </Link>
                            </div>
                        </DetailCard>
                   )}

                    {inventoryItem && (
                         <DetailCard title="Inventory Lot History" icon={<Clock className="text-gray-500" />}>
                            <DetailRow label="Lot ID" value={inventoryItem.id} />
                            <DetailRow label="Lot Received" value={formatTimestamp(inventoryItem.receivedAt)} />
                            <DetailRow label="Initial Quantity" value={inventoryItem.initialQuantity} />
                            <DetailRow label="Unit Cost" value={`$${inventoryItem.unitCostPrice?.toFixed(2)}`} />
                            <DetailRow label="Current Quantity" value={<span className='font-bold text-xl'>{inventoryItem.quantity}</span>} />
                            
                            <div className="pt-4">
                                <h4 className="font-semibold text-sm mb-2">Delivery Log for this Lot:</h4>
                                {inventoryItem.deliveryDetails?.length > 0 ? (
                                    <div className='space-y-2 text-xs border rounded-lg p-2 bg-gray-50 max-h-60 overflow-y-auto'>
                                        {inventoryItem.deliveryDetails.map((delivery, index) => (
                                            <div key={index} className='p-2 bg-white rounded shadow-sm'>
                                                <p><strong>SO:</strong> <Link to={`/sales/orders/${delivery.salesOrderId}`} className='text-blue-600'>{delivery.salesOrderNumber}</Link></p>
                                                <p><strong>Qty:</strong> -{delivery.quantityDeducted}</p>
                                                <p><strong>Date:</strong> {formatTimestamp(delivery.finalizedAt)}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className='text-xs text-gray-500 italic'>No deliveries have been made from this lot yet.</p>
                                )}
                            </div>
                        </DetailCard>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LogDetailsPage;
