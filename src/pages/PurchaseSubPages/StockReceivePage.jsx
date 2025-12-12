
// src/pages/PurchaseSubPages/StockReceivePage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useProducts } from '../../contexts/ProductContext';
import { useLocations } from '../../contexts/LocationContext';
import { useSync } from '../../contexts/SyncContext';
import { getProductDisplayName } from '../../utils/productUtils';
import { Plus, ChevronLeft, Send, Camera, Pencil, X } from 'lucide-react';
import Scanner from '../../components/Scanner';

const customSelectStyles = {
    control: (p, s) => ({ ...p, width: '100%', backgroundColor: '#fff', border: s.isFocused ? '2px solid #059669' : '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.1rem 0', boxShadow: 'none', '&:hover': { borderColor: s.isFocused ? '#059669' : '#9CA3AF'} }),
    menu: (p) => ({...p, zIndex: 20, backgroundColor: '#fff', border: '1px solid #D1D5DB'}),
    option: (p, s) => ({...p, backgroundColor: s.isSelected ? '#059669' : s.isFocused ? '#D1FAE5' : 'transparent', color: s.isSelected ? 'white' : '#111827'}),
    input: (p) => ({...p, color: '#111827'}),
    singleValue: (p) => ({...p, color: '#111827'}),
    menuPortal: (b) => ({ ...b, zIndex: 9999 })
};

const SESSION_STORAGE_KEY = 'stockReceiveForm';

const StockReceivePage = () => {
    const navigate = useNavigate();
    const { currentUser: user, isLoading } = useUser(); 
    const { products } = useProducts();
    const { locations } = useLocations();
    const { addToQueue } = useSync();

    const [formState, setFormState] = useState(() => {
        const savedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
        return savedState ? JSON.parse(savedState) : { locationId: '', batchItems: [] };
    });

    const { locationId, batchItems } = formState;
    const productsMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    useEffect(() => {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(formState));
    }, [formState]);

    const updateForm = (field, value) => {
        setFormState(prevState => ({ ...prevState, [field]: value }));
    };

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [formError, setFormError] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanContext, setScanContext] = useState({ itemIndex: null, serialIndex: null });

    const productOptions = useMemo(() => products.map(p => ({ value: p.id, label: getProductDisplayName(p), product: p })), [products]);

    const handleAddProduct = () => {
        if (!selectedProduct) return;
        const product = selectedProduct.product;
        if (batchItems.some(item => item.productId === product.id)) {
            setFormError('This product is already in the batch.');
            return;
        }
        const newItem = { id: `item_${Date.now()}`, productId: product.id, quantity: 1, serials: product.isSerialized ? [''] : [] };
        updateForm('batchItems', [newItem, ...batchItems]);
        setSelectedProduct(null);
        setFormError('');
    };

    const handleItemUpdate = (itemId, newValues) => {
        const newBatchItems = batchItems.map(item => item.id === itemId ? { ...item, ...newValues } : item);
        updateForm('batchItems', newBatchItems);
    };

    const handleScanSuccess = (decodedText) => {
        setIsScannerOpen(false);
        const code = decodedText.trim();
        if (!code || scanContext.itemIndex === null || scanContext.serialIndex === null) return;
        const item = batchItems[scanContext.itemIndex];
        const newSerials = [...item.serials];
        newSerials[scanContext.serialIndex] = code;
        handleItemUpdate(item.id, { serials: newSerials });
    };

    const openScannerForSerial = (itemIndex, serialIndex) => {
        setScanContext({ itemIndex, serialIndex });
        setIsScannerOpen(true);
    };

    const handleSaveBatch = async () => {
        setFormError('');
        if (!user) { setFormError("Cannot save batch: User profile is not loaded."); return; }
        if (!locationId) { setFormError('You must select a receiving location.'); return; }
        if (batchItems.length === 0) { setFormError('You must add at least one product.'); return; }

        try {
            const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const itemsToQueue = batchItems.map(item => {
                const product = productsMap.get(item.productId);
                if (!product) throw new Error(`Product details for ID ${item.productId} could not be found.`);

                const finalSerials = product.isSerialized ? item.serials.map(s => s.trim()).filter(Boolean) : [];
                if (product.isSerialized && finalSerials.length === 0) {
                    throw new Error(`Product ${product.name} requires at least one serial number.`);
                }

                return {
                    batchId,
                    productId: product.id,
                    productName: product.name, // Guaranteed to be correct
                    sku: product.sku,           // Guaranteed to be correct
                    isSerialized: product.isSerialized, // Guaranteed to be correct
                    locationId: locationId,
                    cost: product.cost || 0,   // Guaranteed to be correct
                    quantity: product.isSerialized ? finalSerials.length : item.quantity,
                    serials: finalSerials
                };
            });
            
            await addToQueue('CREATE_PENDING_RECEIVABLE', itemsToQueue, user);
            
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            alert('Batch successfully queued. It will appear in "Pending Receivables" shortly.');
            navigate('/purchase/pending-receivables');
        } catch (error) {
            setFormError(`An error occurred: ${error.message}`);
        }
    };

    if (isLoading) {
        return <div className="page-container flex justify-center items-center"><p>Loading user profile...</p></div>;
    }
    
    if (!user) {
        return <div className="page-container flex justify-center items-center"><p className="text-red-500">Error: Could not load user profile.</p></div>;
    }

    return (
        <div className="page-container mobile-form-optimized">
            {isScannerOpen && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />}

            <header className="page-header">
                <h1 className="page-title">Receive Stock</h1>
                <div className="page-actions">
                    <Link to="/purchase" className="btn btn-ghost"> <ChevronLeft size={20}/> Back </Link>
                    <button onClick={handleSaveBatch} className="btn btn-primary"> <Send size={18} className="mr-2" /> Save Batch </button>
                </div>
            </header>

            <div className="page-content space-y-4">
                {formError && <div className="alert alert-error text-sm"><span>{formError}</span></div>}
                
                <div className="form-control">
                    <label className="label"><span className="label-text text-lg font-bold">Select Location</span></label>
                    <select value={locationId} onChange={(e) => updateForm('locationId', e.target.value)} className="input-base">
                        <option value="">-- Select a Location --</option>
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                </div>

                <div className="form-control">
                    <label className="label"><span className="label-text">Select Product</span></label>
                    <div className="flex gap-2">
                        <Select options={productOptions} value={selectedProduct} onChange={setSelectedProduct} styles={customSelectStyles} placeholder="Search for a product..." menuPortalTarget={document.body} className="flex-grow" isClearable />
                        <button onClick={handleAddProduct} className="btn btn-primary"><Plus size={20}/></button>
                    </div>
                </div>

                <div className="divider"></div>

                <div className="space-y-3">
                    {batchItems.map((item, index) => (
                        <ItemCard key={item.id} item={item} productsMap={productsMap} onUpdate={handleItemUpdate} onScan={(serialIndex) => openScannerForSerial(index, serialIndex)} />
                    ))}
                </div>

                {batchItems.length > 0 && (
                    <div className="mt-6">
                        <button onClick={handleSaveBatch} className="btn btn-primary btn-lg w-full"><Send size={18} className="mr-2" /> Save Batch</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ItemCard = ({ item, productsMap, onUpdate, onScan }) => {
    const product = productsMap.get(item.productId);

    if (!product) return null; // Or some fallback UI

    const handleQuantityChange = (e) => onUpdate(item.id, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) });
    const handleSerialChange = (index, value) => {
        const newSerials = [...item.serials];
        newSerials[index] = value;
        onUpdate(item.id, { serials: newSerials });
    };
    const addSerialField = () => onUpdate(item.id, { serials: [...item.serials, ''] });
    const removeSerialField = (index) => onUpdate(item.id, { serials: item.serials.filter((_, i) => i !== index) });

    return (
        <div className="card bg-base-100 border shadow-md" data-item-id={item.id}>
            <div className="card-body p-3">
                <h3 className="font-bold text-lg">{product.name}</h3>
                <p className="text-md text-gray-600 font-mono">SKU: {product.sku}</p>
                {product.isSerialized ? (
                    <div className="space-y-2 mt-2">
                        <label className="label-text font-semibold">Serial Numbers</label>
                        {item.serials.map((serial, index) => (
                             <div key={index} className="flex gap-1.5 items-center">
                                <input type="text" value={serial} onChange={(e) => handleSerialChange(index, e.target.value)} placeholder={`Serial #${index + 1}`} className="input-base flex-grow" />
                                <button onClick={() => onScan(index)} className="btn btn-sm btn-outline"><Camera size={16}/></button>
                                <button onClick={(e) => e.currentTarget.previousElementSibling.previousElementSibling.focus()} className="btn btn-sm btn-outline"><Pencil size={16}/></button>
                                <button onClick={() => removeSerialField(index)} className="btn btn-sm btn-ghost text-red-500"><X size={20}/></button>
                            </div>
                        ))}
                        <button onClick={addSerialField} className="btn btn-outline btn-sm mt-2"><Plus size={16}/> Add Serial</button>
                    </div>
                ) : (
                    <div className="form-control mt-2 w-32">
                        <label className="label"><span className="label-text">Quantity</span></label>
                        <input type="number" value={item.quantity} onChange={handleQuantityChange} className="input-base" min="1" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockReceivePage;
