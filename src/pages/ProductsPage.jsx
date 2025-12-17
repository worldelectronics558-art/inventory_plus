// src/pages/ProductsPage.jsx

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../contexts/ProductContext';
import { useLookups } from '../contexts/LookupContext';

// Responsive & UI Components
import useMediaQuery from '../hooks/useMediaQuery';
import ProductCard from '../components/ProductCard';

// Export libraries
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// AG Grid Imports
import { AgGridReact } from 'ag-grid-react'; // React Data Grid Component
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'; 

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

// --- ICONS ---
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const DeleteIcon = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const ViewIcon = ({ className = "w-4 h-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);
const HistoryIcon = ({ className = "w-4 h-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
// --- END: ICONS ---

const FILTERABLE_FIELDS = [
  { key: 'brands', label: 'Brand', type: 'lookup' },
  { key: 'categories', label: 'Category', type: 'lookup' },
];
const getProductKeyFromFilterKey = (filterKey) => {
  if (filterKey === 'brands') return 'brand';
  if (filterKey === 'categories') return 'category';
  return filterKey;
};

const OdooSearchBar = ({ searchText, setSearchText, activeFilters, onFilterToggle, onFilterRemove, categorizedFilterOptions }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  const handleMenuClick = (filterOption) => {
    if (!activeFilters.some(f => f.key === filterOption.key && f.value === filterOption.value)) {
      onFilterToggle(filterOption);
    }
    // Keep menu open for multiple filter selections
  };
  
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      setIsMenuOpen(false);
      inputRef.current.blur(); // Remove focus from the input field
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close only if clicking outside the search bar and filter menu container
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchRef]);

  return (
    <div className="relative w-full" ref={searchRef}>
      <div className="flex flex-wrap gap-2 mb-2">
        {activeFilters.map((filter, index) => (
          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            {filter.label}
            <button type="button" className="shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:outline-none focus:bg-indigo-500 focus:text-white" onClick={() => onFilterRemove(filter)}>
              <span className="sr-only">Remove filter</span>
              <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" /></svg>
            </button>
          </span>
        ))}
      </div>
      <div className="relative rounded-md shadow-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
        </div>
        <input 
            type="text" 
            ref={inputRef} 
            value={searchText} 
            onChange={(e) => setSearchText(e.target.value)} 
            onFocus={() => setIsMenuOpen(true)} // Open menu on focus
            onKeyDown={handleKeyDown}
            placeholder="Search SKU, Model..." 
            className="input-base pl-10 pr-10" // Adjusted padding for icons
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
            <button 
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)} // Toggle menu with filter button
                className="h-full px-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Toggle filters"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L16 11.414V17l-4 4v-9.586L4.293 6.707A1 1 0 014 6V4z" /></svg>
            </button>
        </div>
      </div>
      {isMenuOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg overflow-hidden border border-gray-200">
           <div className="flex justify-between items-center bg-gray-50 p-2 border-b">
                <h3 className="text-sm font-semibold text-gray-700 px-2">Filters</h3>
                <button 
                    type="button" 
                    onClick={() => setIsMenuOpen(false)} // Close menu with X button
                    className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    aria-label="Close filters"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
          <div className="max-h-60 overflow-y-auto">
            {categorizedFilterOptions.filter(g => g.options.length > 0).length > 0 ? (
              categorizedFilterOptions.map(group => (
                group.options.length > 0 && (
                  <div key={group.key} className="border-b border-gray-100 py-3 last:border-b-0">
                    <h3 className="text-xs font-bold uppercase text-indigo-700 mb-2 px-4">{group.label}</h3>
                    <div className="flex flex-wrap gap-2 px-4">
                      {group.options.map((option, index) => (
                        <button key={index} type="button" onClick={() => handleMenuClick(option)} className={`px-3 py-1 text-sm rounded-full ${activeFilters.some(f => f.key === option.key && f.value === option.value) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))
            ) : <div className="py-2 px-4 text-sm text-gray-500">No filters available.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const ProductsPage = () => {
  const navigate = useNavigate();
  const { products, isLoading, deleteProduct, isOnline } = useProducts();
  const { lookups } = useLookups();

  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isMutationDisabled = !isOnline;
  const disabledClass = 'opacity-50 cursor-not-allowed';

  const handleDeleteProduct = useCallback(async (productId, sku) => {
    if (isMutationDisabled) return;
    if (window.confirm(`Are you sure you want to delete SKU: ${sku}? This is permanent.`)) {
      try { await deleteProduct(productId); } catch (error) { alert(`Failed to delete: ${error.message}`); }
    }
  }, [isMutationDisabled, deleteProduct]);

  const productsWithStock = useMemo(() => {
    // The 'products' from useProducts now includes a 'stockSummary' object.
    // We just need to use 'inStock' as 'totalStock' for this component's use.
    return products.map(p => ({
        ...p,
        totalStock: p.stockSummary?.inStock || 0
    }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    let currentProducts = productsWithStock;
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      currentProducts = currentProducts.filter(p => 
        Object.values(p).some(val => String(val).toLowerCase().includes(lowerSearch))
      );
    }
    if (activeFilters.length > 0) {
      currentProducts = currentProducts.filter(p => 
        activeFilters.every(f => p[getProductKeyFromFilterKey(f.key)] === f.value)
      );
    }
    return currentProducts;
  }, [productsWithStock, searchText, activeFilters]);

  const categorizedFilterOptions = useMemo(() => {
    if (!lookups) return [];
    return FILTERABLE_FIELDS.map(field => ({
      key: field.key,
      label: field.label,
      options: (lookups[field.key] || []).map(value => ({ key: field.key, label: value, value: value }))
    }));
  }, [lookups]);

  const actionCellRenderer = useCallback((params) => {
    const product = params.data;
    return (
      <div className="flex justify-end space-x-2 h-full items-center">
        <button onClick={() => navigate(`/products/details/${product.id}`)} className="text-blue-600 hover:text-blue-900 p-1" title="View Details"><ViewIcon className="w-5 h-5" /></button>
        <button onClick={() => navigate(`/products/history/${product.sku}`)} className="text-green-600 hover:text-green-900 p-1" title="View History"><HistoryIcon className="w-5 h-5" /></button>
        <button onClick={() => navigate(`/products/edit/${product.id}`)} className={`text-indigo-600 hover:text-indigo-900 p-1 ${isMutationDisabled ? disabledClass : ''}`} disabled={isMutationDisabled} title="Edit Product"><EditIcon className="w-5 h-5" /></button>
        <button onClick={() => handleDeleteProduct(product.id, product.sku)} className={`text-red-600 hover:text-red-900 p-1 ${isMutationDisabled ? disabledClass : ''}`} disabled={isMutationDisabled} title="Delete Product"><DeleteIcon className="w-5 h-5" /></button>
      </div>
    );
  }, [isMutationDisabled, navigate, handleDeleteProduct]);

  const columnDefs = useMemo(() => ([
    { field: 'sku', headerName: 'SKU', minWidth: 120, filter: true },
    { field: 'model', headerName: 'Model', minWidth: 150, filter: true },
    { field: 'brand', headerName: 'Brand', minWidth: 100, filter: true },
    { field: 'category', headerName: 'Category', minWidth: 120, filter: true },
    { field: 'description', headerName: 'Description', filter: true, flex: 3, minWidth: 200, valueFormatter: p => p.value && p.value.length > 50 ? p.value.substring(0, 50) + '...' : p.value },
    { field: 'totalStock', headerName: 'Total Stock', filter: 'agNumberColumnFilter', width: 130, cellStyle: { textAlign: 'center' } },
    { field: 'reorderPoint', headerName: 'Reorder At', filter: 'agNumberColumnFilter', width: 120, cellStyle: { textAlign: 'center' }, cellRenderer: p => p.value ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">{p.value}</span> : null },
    { field: 'actions', headerName: 'Actions', cellRenderer: actionCellRenderer, sortable: false, filter: false, width: 150, minWidth: 150, pinned: 'right' }
  ]), [actionCellRenderer]);

  const defaultColDef = useMemo(() => ({ resizable: true, sortable: true, filter: true, suppressHeaderMenuButton: true, flex: 1, minWidth: 80 }), []);

  const exportTo = (format) => {
    const data = filteredProducts.map(p => ({ SKU: p.sku, Model: p.model, Brand: p.brand, Category: p.category, Description: p.description, TotalStock: p.totalStock, ReorderPoint: p.reorderPoint }));
    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      XLSX.writeFile(wb, "products.xlsx");
    } else {
      const doc = new jsPDF();
      doc.text("Product List", 14, 15);
      doc.autoTable({ head: [Object.keys(data[0])], body: data.map(Object.values) });
      doc.save("products.pdf");
    }
    setIsExportMenuOpen(false);
  };

  if (isLoading) return <div className="text-xl text-center">Loading Products...</div>;

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Product Management</h1>
        <div className="page-actions">
            <button onClick={() => navigate('/products/add')} className="btn btn-primary" disabled={isMutationDisabled}>Add Product</button>
            <button onClick={() => navigate('/products/bulk-import')} className="btn btn-secondary" disabled={isMutationDisabled}>Bulk Import</button>
            <div className="relative inline-block text-left">
              <button type="button" className="btn btn-secondary" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}>Export</button>
              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 z-10 py-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                  <button onClick={() => exportTo('pdf')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">As PDF</button>
                  <button onClick={() => exportTo('excel')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">As Excel</button>
                </div>
              )}
            </div>
        </div>
      </header>
      
      <div className="page-content">
        <div className="mb-6 card p-4">
            <OdooSearchBar 
                lookups={lookups} 
                searchText={searchText} 
                setSearchText={setSearchText} 
                activeFilters={activeFilters} 
                onFilterToggle={(f) => setActiveFilters(p => p.some(pf => pf.key === f.key && pf.value === f.value) ? p.filter(pf => !(pf.key === f.key && pf.value === f.value)) : [...p, f])} 
                onFilterRemove={(f) => setActiveFilters(p => p.filter(pf => !(pf.key === f.key && pf.value === f.value)))} 
                categorizedFilterOptions={categorizedFilterOptions} 
            />
        </div>

        {filteredProducts.length === 0 ? (
            <div className="card text-center p-6">
                <p className="text-gray-500">No products found that match your criteria.</p>
                {products.length === 0 && (
                     <button onClick={() => navigate('/products/add')} className="btn btn-primary mt-4" disabled={isMutationDisabled}>Add Your First Product</button>
                )}
            </div>
        ) : isMobile ? (
            <div className="space-y-4">
                {filteredProducts.map(product => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      onDelete={handleDeleteProduct}
                      isMutationDisabled={isMutationDisabled}
                    />
                ))}
            </div>
        ) : (
            <div className="ag-theme-indigo" style={{ width: '100%', height: '65vh' }}>
                <AgGridReact
                    rowData={filteredProducts}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    pagination={true}
                    paginationPageSize={100}
                    paginationPageSizeSelector={[25, 50, 100, 200]}
                    rowSelection={'single'}
                    onCellClicked={(params) => {
                        // Check if the click was not on an action button before navigating
                        if (params.event.target.closest('.flex.justify-end')) return;
                        navigate(`/products/details/${params.data.id}`);
                    }}
                />
            </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
