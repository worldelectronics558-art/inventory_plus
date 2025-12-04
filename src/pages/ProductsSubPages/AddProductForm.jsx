// src/pages/AddProductForm.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import navigate hook
import { useProducts } from '../../contexts/ProductContext';
import { useLookups } from '../../contexts/LookupContext';
import NewLookupModal from '../../components/NewLookupModal.jsx'; // Import the lookup modal

// Available fields for filtering (Uses PLURAL keys for lookup retrieval)
// Keep this if needed for other parts of the app, or define here if only used here
// const FILTERABLE_FIELDS = [ /* ... */ ];

// Utility function to map plural filter keys to singular product keys
// const getProductKeyFromFilterKey = (filterKey) => { /* ... */ };

const AddProductForm = () => {
    const navigate = useNavigate(); // Get the navigate function
    const { products, createProduct, isOnline } = useProducts();
    const { lookups } = useLookups();

    const defaultBrand = lookups?.brands?.[0] || '';
    const defaultCategory = lookups?.categories?.[0] || '';
    const [formData, setFormData] = useState({
        sku: '',
        model: '',
        brand: defaultBrand,
        category: defaultCategory,
        description: '',
        reorderPoint: 5 // Default value
    });

    // State for errors, status, and lookup creation
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ loading: false, error: !isOnline ? 'Cannot add product in Offline Mode.' : null });
    const [newLookupType, setNewLookupType] = useState(null);

    // Update default values if lookups change (e.g., after adding a new brand)
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            brand: prev.brand || defaultBrand,
            category: prev.category || defaultCategory,
        }));
    }, [defaultBrand, defaultCategory]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear specific field error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        // Clear general error, but keep the offline message if needed
        if (status.error && !isOnline) {
             setStatus(prev => ({ ...prev, loading: false, error: 'Cannot add product in Offline Mode.' }));
        } else {
             setStatus(prev => ({ ...prev, loading: false, error: null }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isOnline) {
            setStatus({ loading: false, error: 'Cannot add product in Offline Mode.' });
            return;
        }

        // Basic validation
        const newErrors = {};
        if (!formData.sku.trim()) newErrors.sku = 'SKU is required.';
        if (!formData.model.trim()) newErrors.model = 'Model is required.';
        if (!formData.brand.trim()) newErrors.brand = 'Brand is required.';
        if (!formData.category.trim()) newErrors.category = 'Category is required.';
        if (isNaN(formData.reorderPoint) || formData.reorderPoint < 0) newErrors.reorderPoint = 'Reorder Point must be a number >= 0.';

        // SKU uniqueness check against existing products
        const skuToCheck = formData.sku.trim();
        const existingProduct = products.find(p => p.sku.toLowerCase() === skuToCheck.toLowerCase());
        if (existingProduct) {
            newErrors.sku = `SKU "${skuToCheck}" already exists for product: ${existingProduct.model}. SKU must be unique.`;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setStatus({ loading: false, error: 'Please fix the errors below.' });
            return;
        }

        setStatus({ loading: true, error: null });
        setErrors({});

        try {
            const productDataToSave = {
                ...formData,
                sku: skuToCheck, // Ensure trimmed SKU
                reorderPoint: parseInt(formData.reorderPoint, 10),
            };

            await createProduct(productDataToSave); // Use context function
            setStatus({ loading: false, error: null });
            alert('Product added successfully!'); // Or show success message differently
            // Navigate back to main products page after success
            navigate('/products');
        } catch (error) {
            console.error("Firestore Save Error:", error);
            setStatus({ loading: false, error: error.message || 'Failed to save product. Check console for details.' });
        }
    };

    // Determine if the form/fields should be disabled
    const isDisabled = !isOnline || status.loading;

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Add New Product</h1>
                    <button
                        onClick={() => navigate('/products')} // Navigate back to main products page
                        className="btn btn-outline-primary" // Use themed button
                    >
                        Back to Products
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* SKU */}
                    <div>
                        <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                            SKU *
                        </label>
                        <input
                            type="text"
                            id="sku"
                            name="sku"
                            value={formData.sku}
                            onChange={handleChange}
                            disabled={isDisabled}
                            className={`input-base ${errors.sku ? 'border-red-500' : ''}`} // Use themed input, show error state
                        />
                        {errors.sku && <p className="error-message">{errors.sku}</p>} {/* Use themed error */}
                    </div>

                    {/* Model */}
                    <div>
                        <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                            Model *
                        </label>
                        <input
                            type="text"
                            id="model"
                            name="model"
                            value={formData.model}
                            onChange={handleChange}
                            disabled={isDisabled}
                            className={`input-base ${errors.model ? 'border-red-500' : ''}`} // Use themed input, show error state
                        />
                        {errors.model && <p className="error-message">{errors.model}</p>} {/* Use themed error */}
                    </div>

                    {/* Brand */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Brand *
                        </label>
                        <div className="flex gap-2">
                            <select
                                name="brand"
                                value={formData.brand}
                                onChange={handleChange}
                                disabled={isDisabled}
                                className={`flex-1 input-base ${errors.brand ? 'border-red-500' : ''}`} // Use themed input, show error state
                            >
                                {lookups?.brands?.map(item => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                                {lookups?.brands?.length === 0 && <option value="">No brands available</option>}
                            </select>
                            <button
                                type="button"
                                onClick={() => setNewLookupType('brands')}
                                disabled={isDisabled}
                                className={`p-2 rounded-lg w-10 h-10 flex items-center justify-center shadow-md ${isDisabled ? 'bg-gray-400 cursor-not-allowed' : 'btn-secondary'}`} // Use themed button style
                            >
                                <span className="text-xl">+</span>
                            </button>
                        </div>
                        {errors.brand && <p className="error-message">{errors.brand}</p>} {/* Use themed error */}
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Category *
                        </label>
                        <div className="flex gap-2">
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                disabled={isDisabled}
                                className={`flex-1 input-base ${errors.category ? 'border-red-500' : ''}`} // Use themed input, show error state
                            >
                                {lookups?.categories?.map(item => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                                {lookups?.categories?.length === 0 && <option value="">No categories available</option>}
                            </select>
                            <button
                                type="button"
                                onClick={() => setNewLookupType('categories')}
                                disabled={isDisabled}
                                className={`p-2 rounded-lg w-10 h-10 flex items-center justify-center shadow-md ${isDisabled ? 'bg-gray-400 cursor-not-allowed' : 'btn-secondary'}`} // Use themed button style
                            >
                                <span className="text-xl">+</span>
                            </button>
                        </div>
                        {errors.category && <p className="error-message">{errors.category}</p>} {/* Use themed error */}
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            disabled={isDisabled}
                            rows="3"
                            className="input-base" // Use themed input
                        />
                    </div>

                    {/* Reorder Point */}
                    <div>
                        <label htmlFor="reorderPoint" className="block text-sm font-medium text-gray-700 mb-1">
                            Reorder Point
                        </label>
                        <input
                            type="number"
                            id="reorderPoint"
                            name="reorderPoint"
                            value={formData.reorderPoint}
                            onChange={handleChange}
                            disabled={isDisabled}
                            min="0"
                            className={`input-base w-32 ${errors.reorderPoint ? 'border-red-500' : ''}`} // Use themed input, show error state
                        />
                        {errors.reorderPoint && <p className="error-message">{errors.reorderPoint}</p>} {/* Use themed error */}
                    </div>

                    {/* Status/Error Message */}
                    {status.error && <p className="error-message">{status.error}</p>} {/* Use themed error */}

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isDisabled}
                            className={`btn btn-primary ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} // Use themed button
                        >
                            {status.loading ? 'Saving...' : 'Add Product'}
                        </button>
                    </div>
                </form>

                {/* NewLookupModal */}
                {newLookupType && (
                    <NewLookupModal
                        type={newLookupType} // Pass the type correctly
                        onClose={() => setNewLookupType(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default AddProductForm;