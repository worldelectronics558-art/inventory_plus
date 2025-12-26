
import React, { useState, useMemo, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { useSalesOrders } from '../../contexts/SalesOrderContext.jsx';
import { useCustomers } from '../../contexts/CustomerContext.jsx';
import { useProducts } from '../../contexts/ProductContext.jsx';
import { useUser } from '../../contexts/UserContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getProductDisplayName } from '../../utils/productUtils.js';
import LoadingOverlay from '../../components/LoadingOverlay';

const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
const GST_RATE = 0.18;
const SESSION_STORAGE_KEY = 'newSalesOrderForm';

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#dff6f4', border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF'} }),
    menu: (p) => ({...p, zIndex: 20, backgroundColor: '#dff6f4'}),
    option: (p, s) => ({...p, backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent', color: s.isSelected ? 'white' : '#111827'}),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const NewSalesOrderForm = () => {
    const navigate = useNavigate();
    const { addSalesOrder, isMutationDisabled } = useSalesOrders();
    const { customers } = useCustomers();
    const { products } = useProducts();
    const { currentUser } = useUser();
    const { userId } = useAuth();

    const [formState, setFormState] = useState(() => {
        const savedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
                     parsed.items = [{ productId: null, quantity: 1, unitSalePrice: 0, unitRetailPrice: 0, unitSaleGST: 0 }];
                }
                return parsed;
            } catch (e) {
                return { customerId: null, orderDate: new Date().toISOString().slice(0, 10), documentNumber: '', notes: '', items: [{ productId: null, quantity: 1, unitSalePrice: 0, unitRetailPrice: 0, unitSaleGST: 0 }] };
            }
        } 
        return { customerId: null, orderDate: new Date().toISOString().slice(0, 10), documentNumber: '', notes: '', items: [{ productId: null, quantity: 1, unitSalePrice: 0, unitRetailPrice: 0, unitSaleGST: 0 }] };
    });

    const { customerId, orderDate, documentNumber, notes, items } = formState;

    useEffect(() => {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(formState));
    }, [formState]);

    const updateForm = (field, value) => {
        setFormState(prevState => ({ ...prevState, [field]: value }));
    };

    const customerOptions = useMemo(() => customers.map(c => ({ value: c.id, label: c.name })), [customers]);
    const productOptions = useMemo(() => products.map(p => ({ 
        value: p.id, 
        label: getProductDisplayName(p),
        sku: p.sku,
        salePrice: p.salePrice ?? 0 
    })), [products]);
    const productsMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const currentItem = { ...newItems[index] };

        currentItem[field] = value;

        let unitSalePrice = Number(currentItem.unitSalePrice) || 0;

        if (field === 'productId') {
            unitSalePrice = value?.salePrice ?? 0;
            currentItem.unitSalePrice = unitSalePrice;
        }
        
        if (field === 'unitSalePrice') {
            unitSalePrice = Number(value) || 0;
        }

        const unitRetailPrice = unitSalePrice / (1 + GST_RATE);
        const unitSaleGST = unitRetailPrice * GST_RATE;

        currentItem.unitRetailPrice = unitRetailPrice;
        currentItem.unitSaleGST = unitSaleGST;

        newItems[index] = currentItem;
        updateForm('items', newItems);
    };

    const addNewItem = () => updateForm('items', [...items, { productId: null, quantity: 1, unitSalePrice: 0, unitRetailPrice: 0, unitSaleGST: 0 }]);
    const removeItem = (index) => {
        if (items.length > 1) updateForm('items', items.filter((_, i) => i !== index));
    };

    const totals = useMemo(() => {
        return items.reduce((acc, item) => {
            const quantity = Number(item.quantity) || 0;
            const itemTotal = (item.unitRetailPrice + item.unitSaleGST) * quantity;
            acc.totalPreTax += item.unitRetailPrice * quantity;
            acc.totalTax += item.unitSaleGST * quantity;
            acc.grandTotal += itemTotal;
            return acc;
        }, { totalPreTax: 0, totalTax: 0, grandTotal: 0 });
    }, [items]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!userId) {
            alert('Authentication error: User ID not found. Please try logging in again.');
            return;
        }

        if (!customerId || items.some(item => !item.productId || !item.productId.value || Number(item.quantity) <= 0)) {
            alert('Please select a customer and ensure all items have a selected product and a valid quantity greater than 0.');
            return;
        }

        try {
            const orderData = {
                customerId: customerId.value,
                customerName: customerId.label,
                orderDate: new Date(orderDate),
                documentNumber,
                notes,
                items: items.map(item => {
                    const product = productsMap.get(item.productId.value);
                    if (!product) throw new Error(`Product details not found.`);
                    
                    return {
                        productId: item.productId.value, // Now the Document ID [cite: 631]
                        sku: product.sku,                // Explicitly adding SKU
                        productName: getProductDisplayName(product),
                        quantity: Number(item.quantity),
                        unitSalePrice: roundToTwo(Number(item.unitSalePrice)),
                        unitRetailPrice: roundToTwo(Number(item.unitRetailPrice)),
                        unitSaleGST: roundToTwo(Number(item.unitSaleGST)),
                    };
                }),
                totalPreTax: roundToTwo(totals.totalPreTax), 
                totalTax: roundToTwo(totals.totalTax),
                totalAmount: roundToTwo(totals.grandTotal),
            };
            
            const userForAction = { ...currentUser, uid: userId };

            await addSalesOrder(orderData, userForAction);
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            navigate('/sales');
        } catch (error) {
            console.error("Failed to create order:", error);
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <div className="page-container">
            {isMutationDisabled && <LoadingOverlay />}
            <header className="page-header">
                 <div>
                    <Link to="/sales" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Sales Orders
                    </Link>
                    <h1 className="page-title">New Sales Order</h1>
                </div>
            </header>

            <div className="page-content">
                <form onSubmit={handleSubmit}>
                     <div className="card p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                             <div>
                                <label htmlFor="orderNumber">Order Number</label>
                                <input type="text" id="orderNumber" className="input-base bg-gray-100" placeholder='Generated on save' readOnly />
                            </div>
                            <div>
                                <label htmlFor="customerId">Customer *</label>
                                <Select id="customerId" styles={customSelectStyles} options={customerOptions} value={customerId} onChange={value => updateForm('customerId', value)} placeholder="Select a customer..." menuPortalTarget={document.body}/>
                            </div>
                            <div>
                                <label htmlFor="orderDate">Order Date *</label>
                                <input type="date" id="orderDate" value={orderDate} onChange={(e) => updateForm('orderDate', e.target.value)} className="input-base" required />
                            </div>
                             <div>
                                <label htmlFor="documentNumber">Reference Number</label>
                                <input type="text" id="documentNumber" value={documentNumber} onChange={(e) => updateForm('documentNumber', e.target.value)} className="input-base" placeholder="e.g., PO-123" />
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
                                    <input type="number" value={item.unitSalePrice} onChange={(e) => handleItemChange(index, 'unitSalePrice', e.target.value)} min="0" step="0.01" className="input-base w-full text-right" required />
                                </div>
                                <div className="col-span-2">
                                    <input type="text" value={roundToTwo(item.unitRetailPrice).toFixed(2)} className="input-base w-full text-right bg-gray-100" readOnly disabled/>
                                </div>
                                <div className="col-span-2">
                                     <input type="text" value={roundToTwo(item.unitSaleGST).toFixed(2)} className="input-base w-full text-right bg-gray-100" readOnly disabled/>
                                </div>
                                <div className="col-span-1 text-right font-medium">
                                    Rs {roundToTwo(item.unitSalePrice * (Number(item.quantity) || 0)).toFixed(2)}
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
                             <textarea id="notes" value={notes} onChange={(e) => updateForm('notes', e.target.value)} rows="8" className="input-base"></textarea>
                        </div>
                        <div className="lg:col-span-2 card p-6">
                            <h4 className="text-lg font-semibold mb-4">Order Totals</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-lg">
                                    <span className="text-gray-600">Total Pre-Tax Price:</span>
                                    <span className="font-semibold text-gray-800">Rs {roundToTwo(totals.totalPreTax).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-lg">
                                    <span className="text-gray-600">Total Tax ({GST_RATE * 100}%):</span>
                                    <span className="font-semibold text-gray-800">Rs {roundToTwo(totals.totalTax).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-2xl border-t pt-3 mt-2">
                                    <span className="font-bold">Total Price:</span>
                                    <span className="font-bold text-emerald-600">Rs {roundToTwo(totals.grandTotal).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end gap-3">
                        <Link to="/sales" className="btn btn-white">Cancel</Link>
                        <button type="submit" className="btn btn-primary" disabled={isMutationDisabled || !userId}>
                            {isMutationDisabled ? (
                                <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                                <Save size={16} className="mr-2" />
                            )}
                            {isMutationDisabled ? 'Saving...' : 'Save Order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewSalesOrderForm;
