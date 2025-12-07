
// src/pages/PurchaseSubPages/StockReceivePage.jsx
import React, { useState, useMemo, useCallback } from 'react';
import Select from 'react-select';
import { useProducts } from '../../contexts/ProductContext';
import { usePendingReceivables } from '../../contexts/PendingReceivablesContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { Plus, Trash2, Camera, Link as LinkIcon, Save, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Scanner from '../../components/Scanner'; // Import the new Scanner component
import { v4 as uuidv4 } from 'uuid';

const StockReceivePage = () => {
    const { products, isLoading: isProductsLoading } = useProducts();
    const { addPendingReceivables } = usePendingReceivables();

    const [receivedProducts, setReceivedProducts] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [activeProductForScan, setActiveProductForScan] = useState(null);

    const productOptions = useMemo(() =>
        products.map(p => ({
            value: p.id,
            label: getProductDisplayName(p),
            product: p
        })), [products]
    );

    const handleAddProduct = () => {
        const newProduct = {
            id: uuidv4(), // Unique key for the list item
            productDetails: null,
            units: []
        };
        setReceivedProducts(prev => [...prev, newProduct]);
    };

    const handleRemoveProduct = (productId) => {
        setReceivedProducts(prev => prev.filter(p => p.id !== productId));
    };

    const handleProductSelect = (selectedOption, productId) => {
        setReceivedProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, productDetails: selectedOption.product, units: [] } : p
        ));
    };

    const handleAddUnit = (productId) => {
        setReceivedProducts(prev => prev.map(p => {
            if (p.id === productId) {
                const newUnit = { id: uuidv4(), serialNumber: '' };
                return { ...p, units: [...p.units, newUnit] };
            }
            return p;
        }));
    };

    const handleUnitChange = (value, productId, unitId) => {
        setReceivedProducts(prev => prev.map(p => {
            if (p.id === productId) {
                const updatedUnits = p.units.map(u => u.id === unitId ? { ...u, serialNumber: value } : u);
                return { ...p, units: updatedUnits };
            }
            return p;
        }));
    };
    
    const handleRemoveUnit = (productId, unitId) => {
        setReceivedProducts(prev => prev.map(p => {
            if (p.id === productId) {
                return { ...p, units: p.units.filter(u => u.id !== unitId) };
            }
            return p;
        }));
    };

    const openScanner = (productId) => {
        setActiveProductForScan(productId);
        setIsScanning(true);
    };

    const handleScanSuccess = useCallback((decodedText) => {
        if (!activeProductForScan) return;
        
        const scannedValue = decodedText.trim();
        if (!scannedValue) return;

        setReceivedProducts(prev => prev.map(p => {
            if (p.id === activeProductForScan) {
                if (p.units.some(u => u.serialNumber === scannedValue)) {
                    console.warn(`Duplicate scan for ${scannedValue}. Ignoring.`);
                    return p;
                }
                const newUnit = { id: uuidv4(), serialNumber: scannedValue };
                return { ...p, units: [...p.units, newUnit] };
            }
            return p;
        }));
        
        // The scanner now closes itself after confirmation, so we just need to update our state
        setIsScanning(false);
        setActiveProductForScan(null);

    }, [activeProductForScan]);

    const handleSubmit = async () => {
        const itemsToSave = receivedProducts.flatMap(p => {
            if (!p.productDetails) return [];
            if (p.productDetails.isSerialized) {
                return p.units
                    .filter(u => u.serialNumber.trim() !== '')
                    .map(u => ({ 
                        productId: p.productDetails.id, 
                        serialNumber: u.serialNumber.trim(),
                        quantity: 1,
                    }));
            } else {
                const totalQuantity = p.units.reduce((sum, u) => sum + (Number(u.quantity) || 0), 0);
                if (totalQuantity <= 0) return [];
                return [{ 
                    productId: p.productDetails.id, 
                    serialNumber: null,
                    quantity: totalQuantity,
                }];
            }
        });

        if (itemsToSave.length === 0) {
            alert("No valid items to save. Please add products and their units/quantities.");
            return;
        }

        try {
            await addPendingReceivables(itemsToSave);
            alert("Stock successfully received and saved as a pending batch!");
            setReceivedProducts([]);
        } catch (error) {
            console.error("Error saving pending receivables:", error);
            alert(`Failed to save: ${error.message}`);
        }
    };

    return (
        <div className="page-container bg-gray-50">
             {isScanning && <Scanner onScanSuccess={handleScanSuccess} onClose={() => { setIsScanning(false); setActiveProductForScan(null); }} />}

            <header className="page-header">
                 <div>
                     <Link to="/purchase" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-1">
                         <ArrowLeft size={16} className="mr-1" />
                         Back to Purchase
                     </Link>
                     <h1 className="page-title">Receive Stock</h1>
                 </div>
                 <div className="page-actions">
                     <button onClick={handleSubmit} className="btn btn-success">
                         <Save size={18} className="mr-2" />
                         Finish & Save Batch
                     </button>
                 </div>
            </header>

            <div className="page-content max-w-4xl mx-auto">
                 <div className="flex flex-col gap-4">
                    {receivedProducts.map((prod, index) => (
                        <div key={prod.id} className="card border-t-4 border-blue-500 shadow-md">
                            <div className="card-body p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-bold text-lg text-gray-700">Product #{index + 1}</span>
                                    <button onClick={() => handleRemoveProduct(prod.id)} className="btn btn-sm btn-icon btn-ghost text-red-500"><Trash2 size={20}/></button>
                                </div>

                                <Select
                                    options={productOptions}
                                    value={prod.productDetails ? productOptions.find(opt => opt.value === prod.productDetails.id) : null}
                                    onChange={(opt) => handleProductSelect(opt, prod.id)}
                                    placeholder="Search and select a product..."
                                    isLoading={isProductsLoading}
                                    styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                                    menuPortalTarget={document.body}
                                    classNamePrefix="react-select"
                                />
                                
                                {prod.productDetails && (
                                    <div className="mt-4 pt-4 border-t">
                                         <h3 className="font-semibold text-md mb-2">Units</h3>
                                         {prod.productDetails.isSerialized ? (
                                            <div className="flex flex-col gap-2">
                                                {prod.units.map(unit => (
                                                    <div key={unit.id} className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            className="input-base flex-grow"
                                                            placeholder="Enter or scan serial number..."
                                                            value={unit.serialNumber}
                                                            onChange={(e) => handleUnitChange(e.target.value, prod.id, unit.id)}
                                                        />
                                                         <button onClick={() => handleRemoveUnit(prod.id, unit.id)} className="btn btn-sm btn-icon btn-ghost text-gray-500"><Trash2 size={16}/></button>
                                                    </div>
                                                ))}
                                                <div className="flex gap-2 mt-2">
                                                     <button onClick={() => handleAddUnit(prod.id)} className="btn btn-sm btn-secondary">
                                                         <Plus size={16} className="mr-1" /> Manual Entry
                                                     </button>
                                                     <button onClick={() => openScanner(prod.id)} className="btn btn-sm btn-primary">
                                                         <Camera size={16} className="mr-1" /> Scan Unit
                                                     </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <label className="font-medium">Quantity:</label>
                                                <input 
                                                    type="number"
                                                    className="input-base w-32"
                                                    min="1"
                                                    placeholder="Total Qty..."
                                                    value={prod.units[0]?.quantity || ''}
                                                    onChange={(e) => {
                                                        const newUnits = [{ id: prod.units[0]?.id || uuidv4(), quantity: e.target.value }];
                                                        setReceivedProducts(prev => prev.map(p => p.id === prod.id ? { ...p, units: newUnits } : p));
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6">
                    <button onClick={handleAddProduct} className="btn btn-lg btn-secondary w-full border-dashed">
                        <Plus size={20} className="mr-2" />
                        Add Another Product
                    </button>
                </div>
                 {receivedProducts.length > 0 && (
                     <div className="mt-8 flex justify-end">
                         <button onClick={handleSubmit} className="btn btn-success btn-lg">
                             <Save size={20} className="mr-2" />
                             Finish & Save Batch
                         </button>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default StockReceivePage;
