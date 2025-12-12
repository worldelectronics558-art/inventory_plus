import React, { useState, useMemo, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { useSalesOrders } from '../../contexts/SalesOrderContext.jsx';
import { useCustomers } from '../../contexts/CustomerContext.jsx';
import { useProducts } from '../../contexts/ProductContext.jsx';
import { useLoading } from '../../contexts/LoadingContext.jsx';
import { getProductDisplayName } from '../../utils/productUtils.js';

const GST_RATE = 0.18; // 18% GST

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#F9FAFB', border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF'} }),
    menu: (p) => ({...p, zIndex: 20, backgroundColor: '#F9FAFB'}),
    option: (p, s) => ({...p, backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent', color: s.isSelected ? 'white' : '#111827'}),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const EditSalesOrderForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { orders, updateOrder } = useSalesOrders();
    const { customers } = useCustomers();
    const { products } = useProducts();
    const { setAppProcessing } = useLoading();

    const [order, setOrder] = useState(null);
    const [customerId, setCustomerId] = useState(null);
    const [orderDate, setOrderDate] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([]);

    const customerOptions = useMemo(() => 
        customers.map(c => ({ value: c.id, label: c.name })), 
        [customers]
    );

    const productOptions = useMemo(() => 
        products.map(p => ({ 
            value: p.sku,
            label: getProductDisplayName(p), 
            salePrice: p.salePrice ?? 0
        })), 
        [products]
    );
    
    useEffect(() => {
        const orderToEdit = orders.find(o => o.id === id);
        if (orderToEdit) {
            setOrder(orderToEdit);
            const customerOption = customerOptions.find(c => c.value === orderToEdit.customerId);
            setCustomerId(customerOption);
            setOrderDate(new Date(orderToEdit.orderDate.seconds * 1000).toISOString().slice(0, 10));
            setDocumentNumber(orderToEdit.documentNumber || '');
            setNotes(orderToEdit.notes || '');
            
            const loadedItems = orderToEdit.items.map(item => {
                const productOption = productOptions.find(p => p.value === item.productId);
                return {
                    ...item,
                    productId: productOption,
                };
            });
            setItems(loadedItems);

        } else if(orders.length > 0) { // If orders are loaded but this one is not found
            console.error("Order not found");
            navigate('/sales');
        }
    }, [id, orders, customerOptions, productOptions, navigate]);

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const currentItem = { ...newItems[index] };

        currentItem[field] = value;

        let unitPrice = Number(currentItem.unitPrice) || 0;

        if (field === 'productId') {
            unitPrice = value?.salePrice ?? 0;
            currentItem.unitPrice = unitPrice;
        }
        
        if (field === 'unitPrice') {
            unitPrice = Number(value) || 0;
        }

        const price = unitPrice / (1 + GST_RATE);
        const tax = price * GST_RATE;

        currentItem.price = price;
        currentItem.tax = tax;

        newItems[index] = currentItem;
        setItems(newItems);
    };

    const addNewItem = () => {
        setItems([...items, { productId: null, quantity: 1, unitPrice: 0, price: 0, tax: 0 }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const totals = useMemo(() => {
        const calculated = items.reduce((acc, item) => {
            const quantity = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            const tax = Number(item.tax) || 0;
            
            acc.totalPreTax += price * quantity;
            acc.totalTax += tax * quantity;
            return acc;
        }, { totalPreTax: 0, totalTax: 0 });

        calculated.grandTotal = calculated.totalPreTax + calculated.totalTax;
        return calculated;
    }, [items]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!customerId || items.some(item => !item.productId || !item.productId.value || Number(item.quantity) <= 0)) {
            alert('Please select a customer and ensure all items have a selected product and a valid quantity greater than 0.');
            return;
        }

        setAppProcessing(true, 'Updating order...');

        const { totalPreTax, totalTax, grandTotal } = totals;

        const updatedOrderData = {
            customerId: customerId.value,
            customerName: customerId.label,
            orderDate: new Date(orderDate),
            documentNumber,
            notes,
            items: items.map(item => ({
                productId: item.productId.value,
                productName: item.productId.label,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice), 
                price: Number(item.price),       
                tax: Number(item.tax),           
            })),
            totalPreTax, 
            totalTax,
            totalAmount: grandTotal,
        };

        try {
            await updateOrder(id, updatedOrderData);
            navigate('/sales');
        } catch (error) {
            console.error("Failed to update order:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };
    
    if (!order) {
        return <div className="page-container text-center">Loading order data...</div>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                 <div>
                    <Link to="/sales" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Sales Orders
                    </Link>
                    <h1 className="page-title">Edit Sales Order {order.orderNumber}</h1>
                </div>
            </header>

            <div className="page-content">
                <form onSubmit={handleSubmit}>
                    <div className="card p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                             <div>
                                <label>Order Number</label>
                                <input type="text" value={order.orderNumber} className="input-base bg-gray-100" readOnly />
                            </div>
                            <div>
                                <label htmlFor="customerId">Customer *</label>
                                <Select id="customerId" styles={customSelectStyles} options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Select a customer..." menuPortalTarget={document.body}/>
                            </div>
                            <div>
                                <label htmlFor="orderDate">Order Date *</label>
                                <input type="date" id="orderDate" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="input-base" required />
                            </div>
                             <div>
                                <label htmlFor="documentNumber">Reference Number</label>
                                <input type="text" id="documentNumber" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className="input-base" placeholder="e.g., PO-123" />
                            </div>
                        </div>
                    </div>

                    <div className="card p-6">
                        <h4 className="text-lg font-semibold mb-2">Order Items</h4>
                        <div className="grid grid-cols-12 gap-4 items-center mb-2 px-2 pb-2 border-b font-semibold text-sm text-gray-600">
                            <div className="col-span-3">Product</div>
                            <div className="col-span-1 text-center">Qty</div>
                            <div className="col-span-2 text-right">Unit Price</div>
                            <div className="col-span-2 text-right">Price (pre-tax)</div>
                            <div className="col-span-2 text-right">Tax</div>
                            <div className="col-span-1 text-right">Subtotal</div>
                            <div className="col-span-1"></div>
                        </div>

                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center mb-2 p-2 rounded-lg hover:bg-gray-50">
                                <div className="col-span-3">
                                    <Select styles={customSelectStyles} options={productOptions} value={item.productId} onChange={v => handleItemChange(index, 'productId', v)} placeholder="Select..." menuPortalTarget={document.body}/>
                                </div>
                                <div className="col-span-1">
                                    <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="1" className="input-base w-full text-center" required />
                                </div>
                                <div className="col-span-2">
                                    <input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)} min="0" step="0.01" className="input-base w-full text-right" required />
                                </div>
                                <div className="col-span-2">
                                    <input type="text" value={item.price.toFixed(2)} className="input-base w-full text-right bg-gray-100" readOnly disabled/>
                                </div>
                                <div className="col-span-2">
                                     <input type="text" value={item.tax.toFixed(2)} className="input-base w-full text-right bg-gray-100" readOnly disabled/>
                                </div>
                                <div className="col-span-1 text-right font-medium">
                                    Rs {(item.unitPrice * (Number(item.quantity) || 0)).toFixed(2)}
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(index)} className="btn btn-icon btn-danger"><Trash2 size={16} /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addNewItem} className="btn btn-secondary mt-2">
                            <Plus size={16} className="mr-2" />
                            Add Item
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                        <div className="lg:col-span-1 card p-6">
                             <label htmlFor="notes">Notes</label>
                             <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows="8" className="input-base"></textarea>
                        </div>
                        <div className="lg:col-span-2 card p-6">
                            <h4 className="text-lg font-semibold mb-4">Order Totals</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-lg">
                                    <span className="text-gray-600">Total Pre-Tax Price:</span>
                                    <span className="font-semibold text-gray-800">Rs {totals.totalPreTax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-lg">
                                    <span className="text-gray-600">Total Tax ({GST_RATE * 100}%):</span>
                                    <span className="font-semibold text-gray-800">Rs {totals.totalTax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-2xl border-t pt-3 mt-2">
                                    <span className="font-bold">Total Price:</span>
                                    <span className="font-bold text-emerald-600">Rs {totals.grandTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end gap-3">
                        <Link to="/sales" className="btn btn-white">Cancel</Link>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} className="mr-2" />
                            Update Order
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditSalesOrderForm;
