
// src/pages/PurchaseSubPages/StockReceivePage.jsx

import React, { useState, useMemo } from 'react';
import Select from 'react-select';
import { useProducts } from '../../contexts/ProductContext';
import { usePendingReceivables } from '../../contexts/PendingReceivablesContext'; // Import the new context hook
import { getProductDisplayName } from '../../utils/productUtils';
import { Plus, Trash2 } from 'lucide-react';

const StockReceivePage = () => {
    const { products, isLoading: isProductsLoading } = useProducts();
    const { addPendingReceivables } = usePendingReceivables(); // Get the function from the context
    
    // State for the form
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [serialNumber, setSerialNumber] = useState('');
    const [quantity, setQuantity] = useState(1);
    
    // State for the list of received items
    const [receivedItems, setReceivedItems] = useState([]);

    const productOptions = useMemo(() => 
        products.map(p => ({
            value: p.id,
            label: getProductDisplayName(p),
            isSerialized: p.isSerialized 
        })), 
        [products]
    );
    
    const handleAddItem = () => {
        if (!selectedProduct) {
            alert('Please select a product first.');
            return;
        }

        const productDetails = products.find(p => p.id === selectedProduct.value);

        if (productDetails.isSerialized) {
            if (!serialNumber.trim()) {
                alert('Please enter a serial number for this serialized product.');
                return;
            }
            if (receivedItems.some(item => item.serialNumber === serialNumber.trim())) {
                alert('This serial number has already been added.');
                return;
            }
            setReceivedItems(prevItems => [
                ...prevItems,
                {
                    key: `${selectedProduct.value}-${serialNumber.trim()}`,
                    productId: selectedProduct.value,
                    productName: selectedProduct.label,
                    isSerialized: true,
                    serialNumber: serialNumber.trim(),
                    quantity: 1,
                }
            ]);
            setSerialNumber('');
        } else {
            const existingItemIndex = receivedItems.findIndex(item => item.productId === selectedProduct.value);
            
            if (existingItemIndex > -1) {
                const updatedItems = [...receivedItems];
                updatedItems[existingItemIndex].quantity += Number(quantity);
                setReceivedItems(updatedItems);
            } else {
                setReceivedItems(prevItems => [
                    ...prevItems,
                    {
                        key: selectedProduct.value,
                        productId: selectedProduct.value,
                        productName: selectedProduct.label,
                        isSerialized: false,
                        serialNumber: null,
                        quantity: Number(quantity),
                    }
                ]);
            }
            setQuantity(1);
        }
    };

    const handleRemoveItem = (key) => {
        setReceivedItems(prevItems => prevItems.filter(item => item.key !== key));
    };
    
    const handleSaveReceivables = () => {
        if (receivedItems.length === 0) {
            alert("There are no items to save.");
            return;
        }
        
        // Use the context function to save the batch
        addPendingReceivables(receivedItems);
        
        alert(`Saved ${receivedItems.length} line item(s) to a new pending receivable batch. This can now be finalized against a purchase invoice.`);
        
        // Clear the form and list for the next batch
        setReceivedItems([]);
        setSelectedProduct(null);
        setSerialNumber('');
        setQuantity(1);
    };

    if (isProductsLoading) {
        return <div className="page-container"><p>Loading products...</p></div>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Receive Stock</h1>
            </header>
            
            <div className="page-content">
                <div className="card p-6 mb-6">
                    <h4 className="text-lg font-semibold mb-4">Add Received Item</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label htmlFor="product-select">Product *</label>
                            <Select
                                id="product-select"
                                options={productOptions}
                                value={selectedProduct}
                                onChange={setSelectedProduct}
                                placeholder="Search and select a product..."
                                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                                menuPortalTarget={document.body}
                            />
                        </div>
                        {selectedProduct && (
                            <>
                                {selectedProduct.isSerialized ? (
                                    <div>
                                        <label htmlFor="serialNumber">Serial Number *</label>
                                        <input 
                                            type="text" 
                                            id="serialNumber"
                                            value={serialNumber}
                                            onChange={e => setSerialNumber(e.target.value)}
                                            className="input-base"
                                            placeholder="Enter or scan serial #"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="quantity">Quantity *</label>
                                        <input 
                                            type="number" 
                                            id="quantity"
                                            value={quantity}
                                            onChange={e => setQuantity(e.target.value)}
                                            min="1"
                                            className="input-base"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                        <div className="flex items-end">
                             <button onClick={handleAddItem} className="btn btn-primary w-full md:w-auto" disabled={!selectedProduct}>
                                <Plus size={16} className="mr-2"/>
                                Add Item
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card p-6">
                    <h4 className="text-lg font-semibold mb-2">Pending Received Items ({receivedItems.length})</h4>
                     <div className="overflow-x-auto">
                        <table className="table-auto w-full">
                            <thead>
                                <tr className="text-left bg-gray-50">
                                    <th className="px-4 py-2">Product</th>
                                    <th className="px-4 py-2">Serial Number</th>
                                    <th className="px-4 py-2 text-center">Quantity</th>
                                    <th className="px-4 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {receivedItems.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="text-center py-8 text-gray-500">No items added yet.</td>
                                    </tr>
                                )}
                                {receivedItems.map((item) => (
                                    <tr key={item.key} className="border-b">
                                        <td className="px-4 py-2 font-medium">{item.productName}</td>
                                        <td className="px-4 py-2 text-gray-600">{item.isSerialized ? item.serialNumber : 'N/A'}</td>
                                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => handleRemoveItem(item.key)} className="btn btn-icon btn-danger">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {receivedItems.length > 0 && (
                        <div className="mt-6 pt-4 border-t flex justify-end">
                            <button onClick={handleSaveReceivables} className="btn btn-success">
                                Save Pending Receivables
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockReceivePage;
