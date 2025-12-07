
// src/pages/PurchaseSubPages/EditPurchaseInvoiceForm.jsx

import React, { useState, useMemo, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { usePurchaseInvoices } from '../../contexts/PurchaseInvoiceContext.jsx';
import { useSuppliers } from '../../contexts/SupplierContext.jsx';
import { useProducts } from '../../contexts/ProductContext.jsx';
import { useLoading } from '../../contexts/LoadingContext.jsx';
import { getProductDisplayName } from '../../utils/productUtils.js';

// --- STYLING & CONSTANTS ---
const GST_RATE = 0.18; // 18% GST

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#F9FAFB', border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF'} }),
    menu: (p) => ({...p, zIndex: 20, backgroundColor: '#F9FAFB'}),
    option: (p, s) => ({...p, backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent', color: s.isSelected ? 'white' : '#111827'}),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const EditPurchaseInvoiceForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { invoices, updateInvoice } = usePurchaseInvoices();
    const { suppliers } = useSuppliers();
    const { products } = useProducts();
    const { setAppProcessing } = useLoading();

    // --- STATE MANAGEMENT ---
    const [invoice, setInvoice] = useState(null);
    const [supplierId, setSupplierId] = useState(null);
    const [invoiceDate, setInvoiceDate] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([]);

    // --- MEMOIZED OPTIONS FOR SELECTS ---
    const supplierOptions = useMemo(() => 
        suppliers.map(s => ({ value: s.id, label: s.name })), 
        [suppliers]
    );

    const productOptions = useMemo(() => 
        products.map(p => ({ 
            value: p.sku,
            label: getProductDisplayName(p), 
            purchasePrice: p.purchasePrice ?? 0
        })), 
        [products]
    );
    
    // --- LOAD INVOICE DATA ---
    useEffect(() => {
        const invoiceToEdit = invoices.find(inv => inv.id === id);
        if (invoiceToEdit) {
            setInvoice(invoiceToEdit);
            const supplierOption = supplierOptions.find(s => s.value === invoiceToEdit.supplierId);
            setSupplierId(supplierOption);
            setInvoiceDate(new Date(invoiceToEdit.invoiceDate.seconds * 1000).toISOString().slice(0, 10));
            setDocumentNumber(invoiceToEdit.documentNumber || '');
            setNotes(invoiceToEdit.notes || '');
            
            const loadedItems = invoiceToEdit.items.map(item => {
                const productOption = productOptions.find(p => p.value === item.productId);
                return {
                    ...item,
                    productId: productOption,
                };
            });
            setItems(loadedItems);

        } else if(invoices.length > 0) { // If invoices are loaded but this one is not found
            console.error("Invoice not found");
            navigate('/purchase');
        }
    }, [id, invoices, supplierOptions, productOptions, navigate]);

    // --- HANDLERS ---
    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const currentItem = { ...newItems[index] };

        currentItem[field] = value;

        let unitCost = Number(currentItem.unitCost) || 0;

        if (field === 'productId') {
            unitCost = value?.purchasePrice ?? 0;
            currentItem.unitCost = unitCost;
        }
        
        if (field === 'unitCost') {
            unitCost = Number(value) || 0;
        }

        const price = unitCost / (1 + GST_RATE);
        const tax = price * GST_RATE;

        currentItem.price = price;
        currentItem.tax = tax;

        newItems[index] = currentItem;
        setItems(newItems);
    };

    const addNewItem = () => {
        setItems([...items, { productId: null, quantity: 1, unitCost: 0, price: 0, tax: 0 }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    // --- TOTALS CALCULATION ---
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

    // --- FORM SUBMISSION ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!supplierId || items.some(item => !item.productId || !item.productId.value || Number(item.quantity) <= 0)) {
            alert('Please select a supplier and ensure all items have a selected product and a valid quantity greater than 0.');
            return;
        }

        setAppProcessing(true, 'Updating invoice...');

        const { totalPreTax, totalTax, grandTotal } = totals;

        const updatedInvoiceData = {
            supplierId: supplierId.value,
            supplierName: supplierId.label,
            invoiceDate: new Date(invoiceDate),
            documentNumber,
            notes,
            items: items.map(item => ({
                productId: item.productId.value,
                productName: item.productId.label,
                quantity: Number(item.quantity),
                unitCost: Number(item.unitCost), 
                price: Number(item.price),       
                tax: Number(item.tax),           
            })),
            totalPreTax, 
            totalTax,
            totalAmount: grandTotal,
        };

        try {
            await updateInvoice(id, updatedInvoiceData);
            navigate('/purchase');
        } catch (error) {
            console.error("Failed to update invoice:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };
    
    if (!invoice) {
        return <div className="page-container text-center">Loading invoice data...</div>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                 <div>
                    <Link to="/purchase" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Purchase Invoices
                    </Link>
                    <h1 className="page-title">Edit Purchase Invoice {invoice.invoiceNumber}</h1>
                </div>
            </header>

            <div className="page-content">
                <form onSubmit={handleSubmit}>
                    <div className="card p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                             <div>
                                <label>Invoice Number</label>
                                <input type="text" value={invoice.invoiceNumber} className="input-base bg-gray-100" readOnly />
                            </div>
                            <div>
                                <label htmlFor="supplierId">Supplier *</label>
                                <Select id="supplierId" styles={customSelectStyles} options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder="Select a supplier..." menuPortalTarget={document.body}/>
                            </div>
                            <div>
                                <label htmlFor="invoiceDate">Invoice Date *</label>
                                <input type="date" id="invoiceDate" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input-base" required />
                            </div>
                             <div>
                                <label htmlFor="documentNumber">Document Number</label>
                                <input type="text" id="documentNumber" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className="input-base" placeholder="e.g., INV-123" />
                            </div>
                        </div>
                    </div>

                    <div className="card p-6">
                        <h4 className="text-lg font-semibold mb-2">Invoice Items</h4>
                        <div className="grid grid-cols-12 gap-4 items-center mb-2 px-2 pb-2 border-b font-semibold text-sm text-gray-600">
                            <div className="col-span-3">Product</div>
                            <div className="col-span-1 text-center">Qty</div>
                            <div className="col-span-2 text-right">Unit Cost</div>
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
                                    <input type="number" value={item.unitCost} onChange={(e) => handleItemChange(index, 'unitCost', e.target.value)} min="0" step="0.01" className="input-base w-full text-right" required />
                                </div>
                                <div className="col-span-2">
                                    <input type="text" value={item.price.toFixed(2)} className="input-base w-full text-right bg-gray-100" readOnly disabled/>
                                </div>
                                <div className="col-span-2">
                                     <input type="text" value={item.tax.toFixed(2)} className="input-base w-full text-right bg-gray-100" readOnly disabled/>
                                </div>
                                <div className="col-span-1 text-right font-medium">
                                    Rs {(item.unitCost * (Number(item.quantity) || 0)).toFixed(2)}
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
                            <h4 className="text-lg font-semibold mb-4">Invoice Totals</h4>
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
                                    <span className="font-bold">Total Cost:</span>
                                    <span className="font-bold text-emerald-600">Rs {totals.grandTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end gap-3">
                        <Link to="/purchase" className="btn btn-white">Cancel</Link>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} className="mr-2" />
                            Update Invoice
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPurchaseInvoiceForm;
