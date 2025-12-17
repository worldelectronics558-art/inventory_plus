import React, { useState, useMemo, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { usePurchaseInvoices } from '../../contexts/PurchaseInvoiceContext.jsx';
import { useSuppliers } from '../../contexts/SupplierContext.jsx';
import { useProducts } from '../../contexts/ProductContext.jsx';
import { getProductDisplayName } from '../../utils/productUtils.js';
import LoadingOverlay from '../../components/LoadingOverlay';

const GST_RATE = 0.18;
const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#F9FAFB', border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF'} }),
    menu: (p) => ({...p, zIndex: 20, backgroundColor: '#F9FAFB'}),
    option: (p, s) => ({...p, backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent', color: s.isSelected ? 'white' : '#111827'}),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const EditPurchaseInvoiceForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { invoices: purchaseInvoices, updateInvoice, isLoading, isMutationDisabled } = usePurchaseInvoices();
    const { suppliers } = useSuppliers();
    const { products } = useProducts();

    const [invoice, setInvoice] = useState(null);
    const [formState, setFormState] = useState(null);
    const [error, setError] = useState('');

    const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.name })), [suppliers]);
    const productOptions = useMemo(() => products.map(p => ({ value: p.sku, label: getProductDisplayName(p), purchasePrice: p.purchasePrice ?? 0 })), [products]);
    
    useEffect(() => {
        if (!isLoading && purchaseInvoices && purchaseInvoices.length > 0) {
            const invoiceToEdit = purchaseInvoices.find(inv => inv.id === id);
            if (invoiceToEdit) {
                setInvoice(invoiceToEdit);
                
                const items = (invoiceToEdit.items || []).map(item => {
                    const unitCostPrice = item.unitCostPrice ?? item.unitPrice ?? 0;
                    const unitInvoicePrice = item.unitInvoicePrice ?? (unitCostPrice / (1 + GST_RATE));
                    const unitPurchaseGST = item.unitPurchaseGST ?? (unitInvoicePrice * GST_RATE);
                    return {
                        ...item,
                        unitCostPrice,
                        unitInvoicePrice,
                        unitPurchaseGST,
                        // This is the key change: ensure productId is an object for the Select component
                        productId: productOptions.find(p => p.value === item.productId) || null,
                    };
                });

                if (items.length === 0) {
                    items.push({ productId: null, quantity: 1, unitCostPrice: 0, unitInvoicePrice: 0, unitPurchaseGST: 0 });
                }

                setFormState({
                    supplierId: supplierOptions.find(s => s.value === invoiceToEdit.supplierId) || null,
                    invoiceDate: new Date(invoiceToEdit.invoiceDate.seconds * 1000).toISOString().slice(0, 10),
                    documentNumber: invoiceToEdit.documentNumber || '',
                    notes: invoiceToEdit.notes || '',
                    items: items
                });
            } else {
                setError('Invoice not found. It may have been deleted.');
            }
        }
    }, [id, purchaseInvoices, isLoading, supplierOptions, productOptions]);

    const handleItemChange = (index, field, value) => {
        const newItems = [...formState.items];
        const currentItem = { ...newItems[index] };

        currentItem[field] = value;

        let unitCostPrice = Number(currentItem.unitCostPrice) || 0;

        if (field === 'productId') {
            unitCostPrice = value?.purchasePrice ?? 0;
            currentItem.unitCostPrice = unitCostPrice;
            currentItem.productName = value?.label; // Make sure to update the name
        }
        
        if (field === 'unitCostPrice') {
            unitCostPrice = Number(value) || 0;
        }

        const unitInvoicePrice = unitCostPrice / (1 + GST_RATE);
        const unitPurchaseGST = unitInvoicePrice * GST_RATE;

        currentItem.unitInvoicePrice = unitInvoicePrice;
        currentItem.unitPurchaseGST = unitPurchaseGST;

        newItems[index] = currentItem;
        setFormState(prevState => ({ ...prevState, items: newItems }));
    };

    const addNewItem = () => setFormState(prevState => ({ ...prevState, items: [...prevState.items, { productId: null, quantity: 1, unitCostPrice: 0, unitInvoicePrice: 0, unitPurchaseGST: 0 }] }));
    
    const removeItem = (index) => {
        if (formState.items.length > 1) {
            setFormState(prevState => ({ ...prevState, items: prevState.items.filter((_, i) => i !== index) }));
        }
    };

    const totals = useMemo(() => {
        if (!formState) return { totalPreTax: 0, totalTax: 0, grandTotal: 0 };

        return formState.items.reduce((acc, item) => {
            const quantity = Number(item.quantity) || 0;
            acc.totalPreTax += item.unitInvoicePrice * quantity;
            acc.totalTax += item.unitPurchaseGST * quantity;
            acc.grandTotal += (item.unitInvoicePrice + item.unitPurchaseGST) * quantity;
            return acc;
        }, { totalPreTax: 0, totalTax: 0, grandTotal: 0 });
    }, [formState]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formState.supplierId || formState.items.some(item => !item.productId || !item.productId.value || Number(item.quantity) <= 0)) {
            alert('Please select a supplier and ensure all items have a selected product and a valid quantity greater than 0.');
            return;
        }

        const updatedInvoiceData = {
            id: id, // Pass the ID for the update function
            supplierId: formState.supplierId.value,
            supplierName: formState.supplierId.label,
            invoiceDate: new Date(formState.invoiceDate),
            documentNumber: formState.documentNumber,
            notes: formState.notes,
            items: formState.items.map(item => ({
                // Explicitly define the object being saved
                productId: item.productId.value,
                productName: item.productName,
                quantity: Number(item.quantity),
                unitCostPrice: roundToTwo(Number(item.unitCostPrice)),
                unitInvoicePrice: roundToTwo(Number(item.unitInvoicePrice)),
                unitPurchaseGST: roundToTwo(Number(item.unitPurchaseGST)),
                receivedQty: item.receivedQty || 0 // Preserve existing receivedQty
            })),
            totalPreTax: roundToTwo(totals.totalPreTax),
            totalTax: roundToTwo(totals.totalTax),
            totalAmount: roundToTwo(totals.grandTotal),
        };

        try {
            await updateInvoice(id, updatedInvoiceData);
            navigate('/purchase');
        } catch (error) {
            console.error("Failed to update invoice:", error);
            alert(`Error: ${error.message}`);
        }
    };
    
    if (isLoading || !formState) {
        return <LoadingOverlay />;
    }

    if (error) {
        return (
            <div className="page-container text-center">
                <AlertTriangle size={48} className="mx-auto text-red-500" />
                <h2 className="mt-4 text-2xl font-bold text-red-600">Error</h2>
                <p className="mt-2 text-gray-600">{error}</p>
                <Link to="/purchase" className="btn btn-primary mt-6">
                    <ArrowLeft size={20} className="mr-2" />
                    Back to Purchase List
                </Link>
            </div>
        );
    }

    return (
        <div className="page-container">
            {isMutationDisabled && <LoadingOverlay />}
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
                                <Select id="supplierId" styles={customSelectStyles} options={supplierOptions} value={formState.supplierId} onChange={value => setFormState(prev => ({...prev, supplierId: value}))} placeholder="Select a supplier..." menuPortalTarget={document.body}/>
                            </div>
                            <div>
                                <label htmlFor="invoiceDate">Invoice Date *</label>
                                <input type="date" id="invoiceDate" value={formState.invoiceDate} onChange={(e) => setFormState(prev => ({...prev, invoiceDate: e.target.value}))} className="input-base" required />
                            </div>
                             <div>
                                <label htmlFor="documentNumber">Document Number</label>
                                <input type="text" id="documentNumber" value={formState.documentNumber} onChange={(e) => setFormState(prev => ({...prev, documentNumber: e.target.value}))} className="input-base" placeholder="e.g., INV-123" />
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

                        {formState.items.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center mb-2 p-2 rounded-lg hover:bg-gray-50">
                                <div className="col-span-3">
                                    <Select styles={customSelectStyles} options={productOptions} value={item.productId} onChange={v => handleItemChange(index, 'productId', v)} placeholder="Select..." menuPortalTarget={document.body}/>
                                </div>
                                <div className="col-span-1">
                                    <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="1" className="input-base w-full text-center" required />
                                </div>
                                <div className="col-span-2">
                                    <input type="number" value={item.unitCostPrice} onChange={(e) => handleItemChange(index, 'unitCostPrice', e.target.value)} min="0" step="0.01" className="input-base w-full text-right" required />
                                </div>
                                <div className="col-span-2">
                                    <input type="text" value={roundToTwo(item.unitInvoicePrice).toFixed(2)} className="input-base w-full text-right bg-gray-100" readOnly disabled/>
                                </div>
                                <div className="col-span-2">
                                     <input type="text" value={roundToTwo(item.unitPurchaseGST).toFixed(2)} className="input-base w-full text-right bg-gray-100" readOnly disabled/>
                                </div>
                                <div className="col-span-1 text-right font-medium">
                                    Rs {roundToTwo(item.unitCostPrice * (Number(item.quantity) || 0)).toFixed(2)}
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                    {formState.items.length > 1 && (
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
                             <textarea id="notes" value={formState.notes} onChange={(e) => setFormState(prev => ({...prev, notes: e.target.value}))} rows="8" className="input-base"></textarea>
                        </div>
                        <div className="lg:col-span-2 card p-6">
                            <h4 className="text-lg font-semibold mb-4">Invoice Totals</h4>
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
                                    <span className="font-bold">Total Cost:</span>
                                    <span className="font-bold text-emerald-600">Rs {roundToTwo(totals.grandTotal).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end gap-3">
                        <Link to="/purchase" className="btn btn-white">Cancel</Link>
                        <button type="submit" className="btn btn-primary" disabled={isMutationDisabled}>
                           {isMutationDisabled ? (
                                <span className="loading loading-spinner loading-xs"></span>
                           ) : (
                                <Save size={16} className="mr-2" />
                           )}
                           {isMutationDisabled ? 'Saving...' : 'Update Invoice'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPurchaseInvoiceForm;
