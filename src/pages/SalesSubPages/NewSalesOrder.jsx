
// src/pages/SalesSubPages/NewSalesOrder.jsx

import React, { useState, useEffect } from 'react';
import { useCustomers } from '../../contexts/CustomerContext';
import { useProducts } from '../../contexts/ProductContext';
import { useInventory } from '../../contexts/InventoryContext';
import { useSales } from '../../contexts/SalesContext'; // Import useSales
import { useLoading } from '../../contexts/LoadingContext'; // Import useLoading
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';

const NewSalesOrder = () => {
    const navigate = useNavigate();
    const { customers, isLoading: areCustomersLoading } = useCustomers();
    const { products, isLoading: areProductsLoading } = useProducts();
    const { inventory, isLoading: isInventoryLoading } = useInventory();
    const { createSalesOrder } = useSales(); // Get the create function
    const { setAppProcessing } = useLoading();

    // Form State
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [orderStatus, setOrderStatus] = useState('Pending');
    const [orderItems, setOrderItems] = useState([]);
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState({});

    // Product selection state
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);

    const dataIsLoading = areCustomersLoading || areProductsLoading || isInventoryLoading;

    // CORRECTED: Get available stock for the selected product
    const getAvailableStock = (productId) => {
        if (!productId || !inventory) return 0;
        // Counts the number of individual, serialized items with status 'available'
        return inventory.filter(item => item.productId === productId && item.status === 'available').length;
    };

    const handleAddItem = () => {
        if (!selectedProductId) {
            alert('Please select a product.');
            return;
        }

        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;

        const availableStock = getAvailableStock(selectedProductId);
        if (quantity > availableStock) {
            alert(`Cannot add ${quantity} of ${product.name}. Only ${availableStock} unit(s) available in stock.`);
            return;
        }

        const existingItem = orderItems.find(item => item.productId === selectedProductId);
        if (existingItem) {
             alert('This item is already in the order. You can remove it and re-add with a new quantity.');
             return;
        }
        
        setOrderItems([...orderItems, { 
            productId: product.id, 
            name: product.name,
            sku: product.sku,
            quantity: quantity, 
            price: product.price || 0
        }]);

        // Reset selection
        setSelectedProductId('');
        setQuantity(1);
    };

    const handleRemoveItem = (productId) => {
        setOrderItems(orderItems.filter(item => item.productId !== productId));
    };

    const calculateTotal = () => {
        return orderItems.reduce((total, item) => total + (item.quantity * item.price), 0).toFixed(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};
        if (!selectedCustomerId) newErrors.customer = 'Please select a customer.';
        if (orderItems.length === 0) newErrors.items = 'Please add at least one product to the order.';

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            return;
        }

        setAppProcessing(true, 'Creating sales order...');
        try {
            const customerName = customers.find(c => c.id === selectedCustomerId)?.name || 'Unknown Customer';

            const orderData = {
                customerId: selectedCustomerId,
                customerName: customerName,
                orderDate,
                status: orderStatus,
                items: orderItems,
                totalAmount: parseFloat(calculateTotal()),
                notes
            };

            await createSalesOrder(orderData);

            // TODO: The next step is to update the status of the allocated inventory items.
            // This will be handled in the InventoryContext.

            alert('Sales order created successfully!');
            navigate('/sales');
        } catch (error) {
            console.error("Failed to create sales order:", error);
            alert(`Error creating sales order: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    if (dataIsLoading) {
        return <div className="p-8 text-center">Loading form data...</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="page-container">
             <div className="flex justify-between items-center mb-6">
                <h1 className="page-title">New Sales Order</h1>
                <div className="flex gap-2">
                    <button type="button" onClick={() => navigate('/sales')} className="btn btn-outline-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">Save Order</button>
                </div>
            </div>

            {/* Order Header */}
            <div className="card mb-6">
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label htmlFor="customer" className="block text-sm font-medium mb-1">Customer *</label>
                        <select id="customer" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className={`input-base ${errors.customer ? 'border-red-500' : ''}`}>
                            <option value="">Select a Customer</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {errors.customer && <p className="text-red-500 text-xs mt-1">{errors.customer}</p>}
                    </div>
                    <div>
                        <label htmlFor="orderDate" className="block text-sm font-medium mb-1">Order Date</label>
                        <input type="date" id="orderDate" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="input-base" />
                    </div>
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium mb-1">Status</label>
                        <select id="status" value={orderStatus} onChange={e => setOrderStatus(e.target.value)} className="input-base">
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Add Items Section */}
            <div className="card mb-6">
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Order Items</h3>
                    <div className="flex items-end gap-2">
                        <div className="grow">
                            <label htmlFor="product" className="block text-sm font-medium mb-1">Product</label>
                            <select id="product" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="input-base">
                                <option value="">Select a Product</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                            </select>
                        </div>
                        <div className="w-24">
                            <label htmlFor="quantity" className="block text-sm font-medium mb-1">Quantity</label>
                            <input type="number" id="quantity" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" className="input-base" />
                        </div>
                        <button type="button" onClick={handleAddItem} className="btn btn-secondary">
                            <Plus size={16} className="mr-1" /> Add
                        </button>
                    </div>
                    {errors.items && <p className="text-red-500 text-xs mt-2">{errors.items}</p>}
                </div>
            </div>

            {/* Items Table */}
            <div className="card mb-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">SKU</th>
                                <th className="px-6 py-3">Product</th>
                                <th className="px-6 py-3 text-center">Quantity</th>
                                <th className="px-6 py-3 text-right">Unit Price</th>
                                <th className="px-6 py-3 text-right">Total</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {orderItems.length > 0 ? orderItems.map(item => (
                                <tr key={item.productId} className="border-b">
                                    <td className="px-6 py-4">{item.sku}</td>
                                    <td className="px-6 py-4 font-medium">{item.name}</td>
                                    <td className="px-6 py-4 text-center">{item.quantity}</td>
                                    <td className="px-6 py-4 text-right">${item.price.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-semibold">${(item.quantity * item.price).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button type="button" onClick={() => handleRemoveItem(item.productId)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="6" className="text-center py-10 text-gray-500">No items added yet.</td></tr>
                            )}
                        </tbody>
                         <tfoot>
                            <tr className="font-semibold text-gray-900">
                                <th scope="row" colSpan="4" className="px-6 py-3 text-base text-right">Grand Total</th>
                                <td className="px-6 py-3 text-base text-right">${calculateTotal()}</td>
                                <td className="px-6 py-3"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

             {/* Notes and Final Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                    <div className="p-6">
                        <label htmlFor="notes" className="block text-sm font-medium mb-2">Notes / Instructions</label>
                        <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows="4" className="input-base"></textarea>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default NewSalesOrder;
