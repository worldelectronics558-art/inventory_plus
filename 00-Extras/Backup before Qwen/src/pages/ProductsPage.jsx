// src/pages/ProductsPage.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react'; 
import { useProducts } from '../contexts/ProductContext';
import { useLookups } from '../contexts/LookupContext';
import BulkImportModal from '../components/BulkImportModal.jsx';
import NewLookupModal from '../components/NewLookupModal.jsx';

// Available fields for filtering (Uses PLURAL keys for lookup retrieval)
const FILTERABLE_FIELDS = [
    { key: 'brands', label: 'Brand', type: 'lookup' },
    { key: 'categories', label: 'Category', type: 'lookup' },
];
// Utility function to map plural filter keys to singular product keys
const getProductKeyFromFilterKey = (filterKey) => {
    if (filterKey === 'brands') return 'brand';
    if (filterKey === 'categories') return 'category';
    return filterKey;
};

// --- START: Icon Placeholders for better visualization ---
const EditIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
);
const DeleteIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
);
// --- END: Icon Placeholders ---


// ----------------------------------------------------------------------
// Odoo-Style Search Bar Component (No Change)
// ----------------------------------------------------------------------
const OdooSearchBar = ({ searchText, onSearchChange, activeFilters, onFilterToggle, onFilterRemove, lookups }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const searchRef = useRef(null); 
    const inputRef = useRef(null); 

    const categorizedFilterOptions = useMemo(() => {
        if (!lookups || Object.keys(lookups).length === 0) return []; 
        // Logic remains the same...
        return FILTERABLE_FIELDS.map(field => {
            const lookupItems = lookups[field.key] || []; 
            return {
                key: field.key, 
                label: field.label,
                options: lookupItems.map(value => ({
                    key: field.key,
                    label: `${field.label}: ${value}`,
                    value: value,
                })),
            };
        });
    }, [lookups]);


    const handleMenuClick = (filterOption) => {
        const existingFilter = activeFilters.find(f => f.key === filterOption.key && f.value === filterOption.value);
        if (!existingFilter) {
            onFilterToggle(filterOption);
        }
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };
    
    // Handle clicks outside the component to close the menu
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [searchRef]);
    
    return (
        <div className="relative w-full" ref={searchRef}>
            
            {/* 1. Active Filter Tags - DEEPER BLUE (No change needed inside dark card) */}
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center mb-3 gap-2 p-3 border border-indigo-400 rounded-xl bg-indigo-100/70 shadow-inner">
                    <span className="text-sm font-semibold text-indigo-900 mr-1">Current Filters:</span>
                    {activeFilters.map((filter, index) => (
                        <div 
                            key={index} 
                            // Stronger indigo chip with a subtle elevation
                            className="bg-indigo-700 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center shadow-md cursor-pointer hover:bg-indigo-800 transition-colors"
                            onClick={() => onFilterRemove(filter)}
                        >
                            {filter.label}
                            <span className="ml-2 text-white font-bold text-sm">×</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 2. Search Input */}
            <div className="relative">
                <input
                    ref={inputRef} 
                    type="text"
                    value={searchText}
                    onChange={(e) => { onSearchChange(e.target.value); setIsMenuOpen(true); }}
                    onFocus={() => setIsMenuOpen(true)}
                    placeholder="Search products by SKU, Model, Brand, or Category. Click to filter..."
                    // Styling remains bright white for high contrast
                    className="w-full p-3 pl-10 border border-gray-300 rounded-xl shadow-inner bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 transition-all text-gray-900" 
                />
                    {/* Search Icon */}
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            
            {/* Filter Dropdown Menu (Odoo Style) - Kept white for contrast/readability */}
            {isMenuOpen && (
                <div 
                    className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl" 
                >
                    <div className="p-4 space-y-4"> 
                        {categorizedFilterOptions.filter(group => group.options.length > 0).length > 0 ? (
                            categorizedFilterOptions.map(group => (
                                group.options.length > 0 && (
                                    <div key={group.key} className="border-b border-gray-100 pb-3 last:border-b-0">
                                        <h3 className="text-xs font-bold uppercase text-indigo-700 mb-2">{group.label} Filters ({group.options.length})</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {group.options.map((filterOption, index) => {
                                                const isActive = activeFilters.some(f => f.key === filterOption.key && f.value === filterOption.value);
                                                return (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => handleMenuClick(filterOption)}
                                                        className={`px-3 py-1 text-sm rounded-full transition-colors border ${
                                                            isActive
                                                                ? 'bg-indigo-700 text-white border-indigo-700 hover:bg-indigo-800 shadow-sm' 
                                                                : 'bg-blue-50 hover:bg-blue-100 text-indigo-700 border-blue-200' // Subtle blue for inactive filters
                                                        }`}
                                                    >
                                                        {filterOption.value}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 py-2">
                                ⚠️ No Brand or Category filters available. Use the **"+"** buttons in the "Add New Product" modal to create lookups.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


// ----------------------------------------------------------------------
// MODAL FOR ADD/EDIT PRODUCTS (SKU Validation Implemented)
// ----------------------------------------------------------------------
const ProductModal = ({ productToEdit, onClose }) => {
    // MODIFICATION 1: Get isOnline status
    const { products, createProduct, updateProduct, isOnline } = useProducts();
    const { lookups } = useLookups(); 
    
    // Logic remains the same...
    const defaultBrand = lookups?.brands?.[0] || '';
    const defaultCategory = lookups?.categories?.[0] || '';
    
    const initialState = productToEdit || { 
        sku: '', model: '', brand: defaultBrand, 
        category: defaultCategory, description: '', reorderPoint: 5 
    };
    
    const [formData, setFormData] = useState(initialState);
    // Added a local state for specific offline error messaging
    const [status, setStatus] = useState({ loading: false, error: !isOnline && (productToEdit ? 'Cannot edit product in Offline Mode.' : 'Cannot add product in Offline Mode.') });
    const [newLookupType, setNewLookupType] = useState(null); 

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear general error, but keep the offline message if needed
        setStatus(prev => ({ ...prev, loading: false, error: prev.error && !isOnline ? prev.error : null }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // --- NEW OFFLINE GUARD ---
        if (!isOnline) {
            setStatus({ loading: false, error: "Cannot save changes in Offline Mode. Please connect to the internet." });
            return;
        }
        // --- END OFFLINE GUARD ---
        
        setStatus({ loading: true, error: null });
        
        const skuToCheck = formData.sku.toUpperCase().trim();

        // MODIFICATION 2: Check SKU Uniqueness
        const existingProduct = products.find(p => p.sku.toUpperCase() === skuToCheck);
        
        if (existingProduct) {
            // Check if we are editing the same product (allowed)
            const isEditingSelf = productToEdit && existingProduct.id === productToEdit.id;
            
            if (!isEditingSelf) {
                setStatus({ 
                    loading: false, 
                    error: `SKU "${skuToCheck}" already exists for product: ${existingProduct.model}. SKU must be unique.` 
                });
                return;
            }
        }
        // END MODIFICATION 2

        const productDataToSave = {
            sku: skuToCheck, // Ensure SKU is saved as validated/normalized
            model: formData.model,
            brand: formData.brand,
            category: formData.category,
            description: formData.description,
            reorderPoint: parseInt(formData.reorderPoint, 10), 
        };

        try {
            const action = productToEdit 
                ? updateProduct(productToEdit.id, productDataToSave) 
                : createProduct(productDataToSave);
            await action;

            setStatus({ loading: false, error: null });
            onClose();

        } catch (error) {
            console.error("Firestore Save Error:", error); 
            // The context throws a specific offline error, so we can catch it here if it happens unexpectedly
            setStatus({ loading: false, error: error.message || 'Failed to save product. Check console for details.' });
        }
    };

    // Determine if the form/fields should be disabled
    const isDisabled = !isOnline || status.loading;

    return (
        <>
            {/* Modal Container */}
            <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4"> 
                {/* Modal Content */}
                <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all scale-100 duration-200"> 
                    <h2 className="text-2xl font-bold mb-6 border-b pb-3 text-indigo-700">{productToEdit ? 'Edit Product' : 'Add New Product'}</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Input Fields */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">SKU</label>
                            <input type="text" name="sku" value={formData.sku} onChange={handleChange} placeholder="SKU" required 
                                className={`w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 ${isDisabled || productToEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} disabled={isDisabled || !!productToEdit} />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Model Name</label>
                            <input type="text" name="model" value={formData.model} onChange={handleChange} placeholder="Model Name" required 
                                className={`w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`} disabled={isDisabled} />
                        </div>

                        {/* Brand (Select + Button) */}
                        <div className="flex items-end space-x-2">
                            <div className="flex-grow">
                                <label className="block text-sm font-medium text-gray-700">Brand</label>
                                <select name="brand" value={formData.brand} onChange={handleChange} required 
                                    className={`w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`} disabled={isDisabled}>
                                    {lookups?.brands?.map(item => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </div>
                            <button type="button" onClick={() => setNewLookupType('brands')} 
                                className={`p-2 text-white rounded-lg w-10 h-10 flex items-center justify-center shadow-md ${isDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`} disabled={isDisabled}>
                                <span className="text-xl">+</span>
                            </button>
                        </div>
                        
                        {/* Category (Select + Button) */}
                        <div className="flex items-end space-x-2">
                            <div className="flex-grow">
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <select name="category" value={formData.category} onChange={handleChange} required 
                                    className={`w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`} disabled={isDisabled}>
                                    {lookups?.categories?.map(item => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </div>
                            <button type="button" onClick={() => setNewLookupType('categories')} 
                                className={`p-2 text-white rounded-lg w-10 h-10 flex items-center justify-center shadow-md ${isDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`} disabled={isDisabled}>
                                <span className="text-xl">+</span>
                            </button>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Reorder Point</label>
                            <input type="number" name="reorderPoint" value={formData.reorderPoint} onChange={handleChange} placeholder="Reorder Point (Min Stock)" required min="1"
                                className={`w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`} disabled={isDisabled} />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" rows="3"
                                className={`w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`} disabled={isDisabled}></textarea>
                        </div>
                        
                        {status.error && <p className="text-red-600 font-medium bg-red-100 p-2 rounded-lg border border-red-300">{status.error}</p>}
                        
                        <div className="flex justify-end space-x-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isDisabled} 
                                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                    isDisabled 
                                    ? 'bg-indigo-300 text-indigo-100 cursor-not-allowed' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                                }`}
                            >
                                {status.loading ? 'Saving...' : (productToEdit ? 'Save Changes' : 'Add Product')}
                            </button>
                        </div>
                    </form>
                    
                    {/* NewLookupModal remains here */}
                    {newLookupType && (
                        <NewLookupModal lookupType={newLookupType} onClose={() => setNewLookupType(null)} />
                    )}
                </div>
            </div>
        </>
    );
};

// ----------------------------------------------------------------------
// MAIN PAGE COMPONENT
// ----------------------------------------------------------------------
const ProductsPage = () => {
    const { products, isLoading, deleteProduct, isOnline } = useProducts();
    const { lookups } = useLookups(); 

    const [searchText, setSearchText] = useState('');
    const [activeFilters, setActiveFilters] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

    // ----------------------------------------------------------------------
    // START: FILTERING LOGIC (ADDED BACK)
    // ----------------------------------------------------------------------

    /**
     * Memoized list of products filtered by search text and active filters.
     */
    const filteredProducts = useMemo(() => {
        let currentProducts = products;
        
        // 1. Apply text search (SKU, Model, Brand, Category)
        if (searchText) {
            const searchLower = searchText.toLowerCase();
            currentProducts = currentProducts.filter(p => 
                p.sku.toLowerCase().includes(searchLower) ||
                p.model.toLowerCase().includes(searchLower) ||
                (p.brand && p.brand.toLowerCase().includes(searchLower)) ||
                (p.category && p.category.toLowerCase().includes(searchLower))
            );
        }

        // 2. Apply filters (Brand and Category)
        if (activeFilters.length > 0) {
            currentProducts = currentProducts.filter(product => 
                // All active filters must match a field on the product
                activeFilters.every(filter => {
                    const key = getProductKeyFromFilterKey(filter.key); // e.g., 'brands' -> 'brand'
                    // Check if the product's field value matches the filter's value
                    return product[key] === filter.value;
                })
            );
        }
        
        // Note: You may want to add sorting logic here if needed
        return currentProducts;
    }, [products, searchText, activeFilters]);


    /**
     * Toggles a filter on/off. Used by the OdooSearchBar dropdown.
     */
    const handleFilterToggle = (filter) => {
        setActiveFilters(prev => {
            const exists = prev.some(f => f.key === filter.key && f.value === filter.value);
            if (exists) {
                // Remove the filter if it already exists
                return prev.filter(f => !(f.key === filter.key && f.value === filter.value));
            } else {
                // Add the new filter
                return [...prev, filter];
            }
        });
    };

    /**
     * Removes a filter. Used by the active filter tags above the search bar.
     */
    const handleFilterRemove = (filterToRemove) => {
        setActiveFilters(prev => prev.filter(f => 
            !(f.key === filterToRemove.key && f.value === filterToRemove.value)
        ));
    };

    // ----------------------------------------------------------------------
    // END: FILTERING LOGIC
    // ----------------------------------------------------------------------

    // Deletion Handler: Added Offline Guard
    const handleDelete = async (productId, sku) => {
        if (!isOnline) {
            alert('Cannot delete product in Offline Mode. Please connect to the internet.');
            return;
        }
        if (window.confirm(`Are you sure you want to delete SKU: ${sku}? This action is permanent.`)) {
            try {
                await deleteProduct(productId);
            } catch (error) {
                // If deletion fails (e.g., Firestore error), alert the user
                alert(`Failed to delete product: ${error.message}`);
                console.error("Deletion Error:", error);
            }
        }
    };
    
    // Determine if mutation buttons should be disabled
    const isMutationDisabled = !isOnline;
    const disabledClass = 'opacity-50 cursor-not-allowed';

    return (
        <div className="flex flex-col min-h-screen bg-sky-50/50">
        
        {/* Header Area - Sticky for only the title */}
        <div className="sticky top-0 z-10 bg-white shadow-md px-6 pt-2 pb-4 border-b border-indigo-200">
            <div>
                <h1 className="text-3xl font-extrabold text-indigo-800">📦 Product Catalog</h1>

            </div>
            {/* The action buttons are REMOVED from here and moved below */}
        </div>

            <div className="p-6"> 
            
            {/* NEW: Control Row (Search Bar + Action Buttons) */}
            <div className="flex space-x-4 mb-6 items-start"> 
                {/* Odoo Search Bar - takes up maximum available width (flex-1) */}
                <div className="flex-1">
                    <OdooSearchBar 
                        searchText={searchText} 
                        onSearchChange={setSearchText} 
                        activeFilters={activeFilters} 
                        onFilterToggle={handleFilterToggle} 
                        onFilterRemove={handleFilterRemove} 
                        lookups={lookups} 
                    /> 
                </div> 
                
                {/* Action Buttons (MOVED here) - grouped on the right */}
                <div className="flex space-x-3 mt-1"> 
                    <button
                        onClick={() => setIsBulkImportOpen(true)}
                        disabled={isMutationDisabled}
                        title={isMutationDisabled ? "Requires internet connection" : "Bulk Import Products"}
                        className={`px-4 py-3 text-sm rounded-xl font-semibold transition-colors flex items-center space-x-2 ${
                            isMutationDisabled
                                ? `bg-gray-300 text-gray-500 ${disabledClass}`
                                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'
                        }`}
                    >
                        <span>⬆️ Bulk Import</span>
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        disabled={isMutationDisabled}
                        title={isMutationDisabled ? "Requires internet connection" : "Add New Product"}
                        className={`px-4 py-3 text-sm rounded-xl font-semibold transition-colors flex items-center space-x-2 ${
                            isMutationDisabled
                                ? `bg-gray-300 text-gray-500 ${disabledClass}`
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                        }`}
                    >
                        <span>➕ Add New Product</span>
                    </button>
                </div> 
            </div> 
            
            {/* Product Table - remains below the new Control Row */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                {/* ... existing table code ... */}
            </div>
        
                {/* Product Table (Assuming this uses filteredProducts) */}
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold text-gray-700 mb-4">
                        Products ({filteredProducts.length} of {products.length})
                    </h2>
                    
                    {/* Table Structure Placeholder */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Point</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {isLoading && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-4 text-center text-indigo-600">Loading products...</td>
                                    </tr>
                                )}
                                {!isLoading && products.length > 0 && filteredProducts.map(product => (
                                    <tr key={product.id} className="hover:bg-indigo-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.sku}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{product.model}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{product.brand}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{product.category}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{product.reorderPoint}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button 
                                                onClick={() => setProductToEdit(product)} 
                                                disabled={isMutationDisabled}
                                                title={isMutationDisabled ? "Requires internet connection" : "Edit Product"}
                                                className={`text-blue-600 hover:text-blue-800 p-2 ${isMutationDisabled ? disabledClass : ''}`}
                                            >
                                                <EditIcon />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(product.id, product.sku)} 
                                                disabled={isMutationDisabled}
                                                title={isMutationDisabled ? "Requires internet connection" : "Delete Product"}
                                                className={`text-red-600 hover:text-red-800 p-2 ml-2 ${isMutationDisabled ? disabledClass : ''}`}
                                            >
                                                <DeleteIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))} 
                                {!isLoading && products.length === 0 && !isOnline && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No cached products available. Connect to the internet to load data.</td>
                                    </tr>
                                )}
                                {!isLoading && products.length === 0 && isOnline && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No products found. Click 'Add New Product' to get started.</td>
                                    </tr>
                                )}
                                {!isLoading && products.length > 0 && filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No products match your current search/filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isAddModalOpen && (
                <ProductModal onClose={() => setIsAddModalOpen(false)} productToEdit={null} />
            )}
            {productToEdit && (
                <ProductModal productToEdit={productToEdit} onClose={() => setProductToEdit(null)} />
            )}
            {isBulkImportOpen && (
                <BulkImportModal onClose={() => setIsBulkImportOpen(false)} />
            )}
        </div>
    );
};

export default ProductsPage;