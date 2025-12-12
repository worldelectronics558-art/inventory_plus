
// src/pages/SalesSubPages/FinalizeSalesOrder.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSalesOrders } from '../../contexts/SalesOrderContext';
import { useInventory } from '../../contexts/InventoryContext';
import { usePendingDeliverables } from '../../contexts/PendingDeliverablesContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import { useLoading } from '../../contexts/LoadingContext';
import { useSync } from '../../contexts/SyncContext';

const FinalizeSalesOrder = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { order } = state || {};

    const { currentUser: user } = useUser();
    const { removeStockItems, isLoading: isSalesOrderLoading } = useSalesOrders(); // Correct hook and function name
    const { addToQueue, isSyncing } = useSync();
    const { inventoryItems, isLoading: isInventoryLoading } = useInventory();
    const { pendingDeliverables, isLoading: isDeliverablesLoading } = usePendingDeliverables();
    const { setAppProcessing } = useLoading();

    const [orderItems, setOrderItems] = useState([]);
    const [formError, setFormError] = useState('');

    const matchedOrderItems = useMemo(() => {
        if (!order || !order.items || isDeliverablesLoading || isInventoryLoading) return [];

        return order.items.map(orderItem => {
            const matchedDeliverables = pendingDeliverables.filter(d => 
                d.locationId === order.locationId && d.sku === orderItem.sku
            );

            const units = matchedDeliverables.flatMap(d => d.serials.map(serial => {
                const inventoryItem = inventoryItems.find(inv => inv.serial === serial && inv.sku === d.sku);
                return {
                    serial,
                    inventoryItem: inventoryItem || null,
                    pendingDeliverableId: d.id
                };
            }));
            
            return {
                ...orderItem,
                units: units.slice(0, orderItem.quantity)
            };
        });
    }, [order, pendingDeliverables, inventoryItems, isDeliverablesLoading, isInventoryLoading]);

    useEffect(() => {
        if (order) {
            setOrderItems(matchedOrderItems);
        } else {
            navigate('/sales');
        }
    }, [matchedOrderItems, order, navigate]);

    const handleFinalize = async () => {
        setFormError('');
        if (!user) {
            setFormError('User data not available. Please try again.');
            return;
        }

        const allUnitsValid = orderItems.every(item => item.units.length === item.quantity && item.units.every(u => u.inventoryItem));
        if (!allUnitsValid) {
            setFormError("All items must have the correct quantity of verified serial numbers before finalizing.");
            return;
        }

        const itemsForStockOut = orderItems.flatMap(item => item.units.map(u => u.inventoryItem).filter(Boolean));
        const pendingDeliverableIds = [...new Set(orderItems.flatMap(item => item.units.map(u => u.pendingDeliverableId)))];
        
        const updatedOrderData = {
            items: orderItems.map(item => ({
                sku: item.sku,
                name: item.name,
                quantity: item.quantity,
                units: item.units.map(u => ({ serial: u.serial, inventoryId: u.inventoryItem?.id }))
            })),
        };

        setAppProcessing(true, 'Finalizing sales order...');

        try {
            // Use the correctly named function
            await removeStockItems(order.id, updatedOrderData, pendingDeliverableIds);

            await addToQueue('STOCK_OUT', itemsForStockOut, user);
            
            setAppProcessing(false);
            alert('Sales order finalized and queued for syncing!');
            navigate('/sales');

        } catch (error) {
            console.error("Finalization failed:", error);
            setFormError(`Finalization failed: ${error.message}`);
            setAppProcessing(false);
        }
    };

    if (!order) return <div className="page-container"><p>No order data provided. Redirecting...</p></div>;
    const isLoading = isInventoryLoading || isDeliverablesLoading || isSalesOrderLoading;
    if (isLoading) return <div className="page-container"><p>Loading order and inventory data...</p></div>;

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Finalize Sales Order</h1>
                <div className="page-actions">
                    <button onClick={() => navigate(-1)} className="btn btn-ghost"> <ChevronLeft size={20} /> Back </button>
                    <button onClick={handleFinalize} className="btn btn-primary" disabled={isSyncing || isLoading}> <CheckCircle size={20} /> Finalize Order </button>
                </div>
            </header>

            <div className="page-content">
                {formError && <div className="alert alert-error"><span>{formError}</span></div>}

                <div className="card bg-base-100 shadow-lg">
                    <div className="card-body">
                        <h2 className="card-title text-2xl">Order Summary: {order.orderNumber}</h2>
                        <p><strong>Customer:</strong> {order.customerName}</p>
                        <p><strong>Location:</strong> {order.locationId}</p>
                        <div className="divider"></div>
                        <h3 className="text-xl font-semibold">Items to be Delivered</h3>
                        <div className="overflow-x-auto">
                            <table className="table w-full">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>SKU</th>
                                        <th>Required</th>
                                        <th>Assigned Serials</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderItems.map((item, index) => (
                                        <tr key={index}>
                                            <td>{getProductDisplayName(item)}</td>
                                            <td>{item.sku}</td>
                                            <td>{item.quantity}</td>
                                            <td>
                                                {item.units.length > 0 ? (
                                                    <ul className="list-disc list-inside bg-gray-100 p-2 rounded-md">
                                                        {item.units.map((unit, uIndex) => (
                                                            <li key={uIndex} className={unit.inventoryItem ? 'text-green-600' : 'text-red-500'}>
                                                                {unit.serial} {unit.inventoryItem ? '' : ' (Invalid)'}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : <span className='text-yellow-600'>No units assigned</span>}
                                                {item.units.length < item.quantity && <p className='text-red-500 text-xs mt-1'>Missing {item.quantity - item.units.length} unit(s).</p>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalizeSalesOrder;
