// src/pages/ProductsPage.jsx

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../contexts/ProductContext';
import { useLookups } from '../contexts/LookupContext';
// Export libraries
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
// AG Grid Imports
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModules } from 'ag-grid-community';

ModuleRegistry.registerModules(AllCommunityModules);


// --- START: ICONS ---
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
    if (inputRef.current) inputRef.current.focus();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setIsMenuOpen(false);
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
              <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8"><path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" /></svg>
            </button>
          </span>
        ))}
      </div>
      <div className="relative rounded-md shadow-sm">
        <input type="text" ref={inputRef} value={searchText} onChange={(e) => setSearchText(e.target.value)} onFocus={() => setIsMenuOpen(true)} placeholder="Search SKU, Model, Brand, Category..." className="input-base" />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
        </div>
      </div>
      {isMenuOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg overflow-hidden border border-gray-200">
          <div className="max-h-60 overflow-y-auto">
            {categorizedFilterOptions.filter(g => g.options.length > 0).length > 0 ? (
              categorizedFilterOptions.map(group => (
                group.options.length > 0 && (
                  <div key={group.key} className="border-b border-gray-100 py-3 last:border-b-0">
                    <h3 className="text-xs font-bold uppercase text-indigo-700 mb-2 px-4">{group.label} Filters</h3>
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
  
  const isMutationDisabled = !isOnline;
  const disabledClass = 'opacity-50 cursor-not-allowed';

  const handleDeleteProduct = async (productId, sku) => {
    if (isMutationDisabled) return;
    if (window.confirm(`Are you sure you want to delete SKU: ${sku}? This is permanent.`)) {
      try { await deleteProduct(productId); } catch (error) { alert(`Failed to delete: ${error.message}`); }
    }
  };

  const filteredProducts = useMemo(() => {
    let currentProducts = products;
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
  }, [products, searchText, activeFilters]);

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
        <button onClick={() => navigate(`/history?sku=${product.sku}`)} className="text-green-600 hover:text-green-900 p-1" title="View History"><HistoryIcon className="w-5 h-5" /></button>
        <button onClick={() => navigate(`/products/edit/${product.id}`)} className={`text-indigo-600 hover:text-indigo-900 p-1 ${isMutationDisabled ? disabledClass : ''}`} disabled={isMutationDisabled} title="Edit Product"><EditIcon className="w-5 h-5" /></button>
        <button onClick={() => handleDeleteProduct(product.id, product.sku)} className={`text-red-600 hover:text-red-900 p-1 ${isMutationDisabled ? disabledClass : ''}`} disabled={isMutationDisabled} title="Delete Product"><DeleteIcon className="w-5 h-5" /></button>
      </div>
    );
  }, [isOnline, navigate]);

  const columnDefs = useMemo(() => ([
    { field: 'sku', headerName: 'SKU', minWidth: 120, filter: true },
    { field: 'model', headerName: 'Model', minWidth: 150, filter: true },
    { field: 'brand', headerName: 'Brand', minWidth: 100, filter: true },
    { field: 'category', headerName: 'Category', minWidth: 120, filter: true },
    { field: 'description', headerName: 'Description', filter: true, flex: 3, minWidth: 200, valueFormatter: p => p.value && p.value.length > 50 ? p.value.substring(0, 50) + '...' : p.value },
    { field: 'reorderPoint', headerName: 'Reorder At', filter: 'agNumberColumnFilter', width: 120, cellStyle: { textAlign: 'center' }, cellRenderer: p => p.value ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">{p.value}</span> : null },
    { field: 'actions', headerName: 'Actions', cellRenderer: actionCellRenderer, sortable: false, filter: false, width: 150, minWidth: 150, pinned: 'right' }
  ]), [actionCellRenderer]);

  const defaultColDef = useMemo(() => ({ resizable: true, sortable: true, filter: true, suppressHeaderMenuButton: true, flex: 1, minWidth: 80 }), []);

  const exportTo = (format) => {
    const data = filteredProducts.map(p => ({ SKU: p.sku, Model: p.model, Brand: p.brand, Category: p.category, Description: p.description, ReorderPoint: p.reorderPoint }));
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

  if (isLoading) return <div className="p-8 text-xl text-center">Loading Products...</div>;

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="page-title">Product Management</h1>
      <div className="flex flex-wrap gap-2 mb-6">
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
      <div className="mb-6 card">
        <OdooSearchBar lookups={lookups} searchText={searchText} setSearchText={setSearchText} activeFilters={activeFilters} onFilterToggle={(f) => setActiveFilters(p => p.some(pf => pf.key === f.key && pf.value === f.value) ? p.filter(pf => !(pf.key === f.key && pf.value === f.value)) : [...p, f])} onFilterRemove={(f) => setActiveFilters(p => p.filter(pf => !(pf.key === f.key && pf.value === f.value)))} categorizedFilterOptions={categorizedFilterOptions} />
      </div>
      <div className="bg-white shadow overflow-hidden rounded-lg">
        {products.length === 0 ? (
          <p className="p-6 text-center text-gray-500">No products found. Add one to begin.</p>
        ) : (
          <div className="ag-theme-indigo" style={{ width: '100%', height: 600 }}>
            <AgGridReact
              rowData={filteredProducts}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              rowSelection={{ mode: 'multiple' }} // <-- FIX APPLIED
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
