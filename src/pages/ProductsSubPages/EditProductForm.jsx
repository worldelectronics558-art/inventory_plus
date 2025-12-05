
// src/pages/ProductsSubPages/EditProductForm.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProducts } from '../../contexts/ProductContext';
import { useLookups } from '../../contexts/LookupContext';
import NewLookupModal from '../../components/NewLookupModal.jsx';

const EditProductForm = () => {
    const navigate = useNavigate();
    const { id: productId } = useParams();
    const { products, updateProduct, isOnline } = useProducts();
    const { lookups } = useLookups();

    const productToEdit = products.find(p => p.id === productId);

    const [formData, setFormData] = useState({
        sku: '',
        model: '',
        brand: '',
        category: '',
        description: '',
        reorderPoint: 5,
        isSerialized: true, // Add to state
    });
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ loading: false, error: !isOnline ? 'Cannot edit product in Offline Mode.' : null });
    const [newLookupType, setNewLookupType] = useState(null);

    useEffect(() => {
        if (productToEdit) {
            setFormData({
                sku: productToEdit.sku || '',
                model: productToEdit.model || '',
                brand: productToEdit.brand || '',
                category: productToEdit.category || '',
                description: productToEdit.description || '',
                reorderPoint: productToEdit.reorderPoint || 5,
                // Load isSerialized, default to true for older products
                isSerialized: productToEdit.isSerialized ?? true, 
            });
        } else if (products.length > 0 && !productToEdit) {
             setStatus({ loading: false, error: 'Product not found.' });
        }
    }, [productToEdit, products]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        if (status.error && !isOnline) {
             setStatus(prev => ({ ...prev, loading: false, error: 'Cannot edit product in Offline Mode.' }));
        } else {
             setStatus(prev => ({ ...prev, loading: false, error: null }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isOnline) {
            setStatus({ loading: false, error: 'Cannot edit product in Offline Mode.' });
            return;
        }

        const newErrors = {};
        if (!formData.model.trim()) newErrors.model = 'Model is required.';
        if (!formData.brand.trim()) newErrors.brand = 'Brand is required.';
        if (!formData.category.trim()) newErrors.category = 'Category is required.';
        if (isNaN(formData.reorderPoint) || formData.reorderPoint < 0) newErrors.reorderPoint = 'Reorder Point must be a number >= 0.';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setStatus({ loading: false, error: 'Please fix the errors below.' });
            return;
        }

        setStatus({ loading: true, error: null });
        setErrors({});

        try {
            const productDataToSave = {
                // Don't save SKU, it's the identifier
                model: formData.model,
                brand: formData.brand,
                category: formData.category,
                description: formData.description,
                reorderPoint: parseInt(formData.reorderPoint, 10),
                isSerialized: formData.isSerialized, // Save the new field
            };

            await updateProduct(productId, productDataToSave);
            setStatus({ loading: false, error: null });
            alert('Product updated successfully!');
            navigate('/products');
        } catch (error) {
            console.error("Firestore Update Error:", error);
            setStatus({ loading: false, error: error.message || 'Failed to update product. Check console for details.' });
        }
    };

    const isDisabled = !isOnline || status.loading || !productToEdit;

    if (!productToEdit && status.error !== 'Product not found.') {
        return <div className="p-8 text-xl text-center">Loading Product...</div>;
    }

    if (status.error === 'Product not found.') {
        return <div className="p-8 text-xl text-center text-red-500">Error: Product not found.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Edit Product: {formData.sku}</h1>
                    <button onClick={() => navigate('/products')} className="btn btn-outline-secondary">
                        Back to Products
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                        <input type="text" id="sku" name="sku" value={formData.sku} disabled={true} className="input-base bg-gray-100 text-gray-500 cursor-not-allowed" />
                    </div>

                    <div>
                        <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                        <input type="text" id="model" name="model" value={formData.model} onChange={handleChange} disabled={isDisabled} className={`input-base ${errors.model ? 'border-red-500' : ''}`} />
                        {errors.model && <p className="error-message">{errors.model}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                        <div className="flex gap-2">
                            <select name="brand" value={formData.brand} onChange={handleChange} disabled={isDisabled} className={`flex-1 input-base ${errors.brand ? 'border-red-500' : ''}`}>
                                {lookups?.brands?.map(item => <option key={item} value={item}>{item}</option>)}
                                {lookups?.brands?.length === 0 && <option value="">No brands available</option>}
                            </select>
                            <button type="button" onClick={() => setNewLookupType('brands')} disabled={isDisabled} className={`p-2 rounded-lg w-10 h-10 flex items-center justify-center shadow-md ${isDisabled ? 'bg-gray-400 cursor-not-allowed' : 'btn-secondary'}`}>
                                <span className="text-xl">+</span>
                            </button>
                        </div>
                        {errors.brand && <p className="error-message">{errors.brand}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                        <div className="flex gap-2">
                            <select name="category" value={formData.category} onChange={handleChange} disabled={isDisabled} className={`flex-1 input-base ${errors.category ? 'border-red-500' : ''}`}>
                                {lookups?.categories?.map(item => <option key={item} value={item}>{item}</option>)}
                                {lookups?.categories?.length === 0 && <option value="">No categories available</option>}
                            </select>
                            <button type="button" onClick={() => setNewLookupType('categories')} disabled={isDisabled} className={`p-2 rounded-lg w-10 h-10 flex items-center justify-center shadow-md ${isDisabled ? 'bg-gray-400 cursor-not-allowed' : 'btn-secondary'}`}>
                                <span className="text-xl">+</span>
                            </button>
                        </div>
                        {errors.category && <p className="error-message">{errors.category}</p>}
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea id="description" name="description" value={formData.description} onChange={handleChange} disabled={isDisabled} rows="3" className="input-base" />
                    </div>

                    <div>
                        <label htmlFor="reorderPoint" className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                        <input type="number" id="reorderPoint" name="reorderPoint" value={formData.reorderPoint} onChange={handleChange} disabled={isDisabled} min="0" className={`input-base w-32 ${errors.reorderPoint ? 'border-red-500' : ''}`} />
                        {errors.reorderPoint && <p className="error-message">{errors.reorderPoint}</p>}
                    </div>
                    
                    {/* --- NEW isSerialized TOGGLE --- */}
                    <div className="flex items-center justify-between pt-4 border-t mt-6">
                        <span className="flex-grow flex flex-col">
                            <span className="text-sm font-medium text-gray-700">Track with Serial Numbers?</span>
                            <span className="text-xs text-gray-500">Enable if each item has a unique barcode. Disable for bulk items.</span>
                        </span>
                        <label htmlFor="isSerialized" className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="isSerialized"
                                name="isSerialized"
                                checked={formData.isSerialized}
                                onChange={handleChange}
                                disabled={isDisabled} // Add logic here later to disable if product has stock
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                    {/* --- END NEW TOGGLE --- */}

                    {status.error && <p className="error-message mt-4">{status.error}</p>}

                    <div className="flex justify-end pt-6">
                        <button type="submit" disabled={isDisabled} className={`btn btn-primary ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {status.loading ? 'Saving...' : 'Update Product'}
                        </button>
                    </div>
                </form>

                {newLookupType && (
                    <NewLookupModal
                        type={newLookupType}
                        onClose={() => setNewLookupType(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default EditProductForm;
