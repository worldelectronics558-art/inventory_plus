// src/pages/ProductsPage.jsx

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// FIX: Corrected relative path for context imports (assuming structure: src/pages/ProductsPage.jsx -> src/contexts)
import { useProducts } from '../contexts/ProductContext';
import { useLookups } from '../contexts/LookupContext';

// Keep export libraries
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable'; 

// AG Grid Imports
import { AgGridReact } from 'ag-grid-react';
// FIX: Ensure AG Grid CSS theme is imported for the 'ag-theme-alpine' class to work
import 'ag-grid-community/styles/ag-grid.css'; 
import 'ag-grid-community/styles/ag-theme-alpine.css'; 

// The modern AG Grid component handles modules internally, so the manual
// ModuleRegistry registration can usually be removed unless you're using a complex bundle setup.

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

// --- START: Icon Placeholders (KEPT AS IS) ---
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
// --- END: Icon Placeholders ---


// --- OdooSearchBar Component (KEPT AS IS, added themed input class) ---
const OdooSearchBar = ({ lookups, searchText, setSearchText, activeFilters, onFilterToggle, onFilterRemove, categorizedFilterOptions }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

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
      {/* 1. Active Filter Tags */}
      <div className="flex flex-wrap gap-2 mb-2">
        {activeFilters.map((filter, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
         >
            {filter.label}
            <button
              type="button"
              className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:outline-none focus:bg-indigo-500 focus:text-white"
              onClick={() => onFilterRemove(filter)}
            >
             <span className="sr-only">Remove filter</span>
              <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* 2. Search Input */}
      <div className="relative rounded-md shadow-sm">
        <input
          type="text"
          ref={inputRef}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onFocus={() => setIsMenuOpen(true)}
          placeholder="Search SKU, Model, Brand, Category..."
          className="input-base" // Apply themed input class
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* 3. Filter Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg overflow-hidden border border-gray-200">
          <div className="max-h-60 overflow-y-auto">
            {categorizedFilterOptions.filter(group => group.options.length > 0).length > 0 ?
            (
              categorizedFilterOptions.map(group => (
                group.options.length > 0 && (
                  <div key={group.key} className="border-b border-gray-100 py-3 last:border-b-0">
                    <h3 className="text-xs font-bold uppercase text-indigo-700 mb-2 px-4">{group.label} Filters ({group.options.length})</h3>
                    <div className="flex flex-wrap gap-2 px-4">
                      {group.options.map((filterOption, index) => {
                        const isActive = activeFilters.some(f => f.key === filterOption.key && f.value === filterOption.value);
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleMenuClick(filterOption)}
                            className={`px-3 py-1 text-sm rounded-full ${
                              isActive
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {filterOption.label}
                          </button>
                        );
                      })}
                  </div>
                  </div>
                )
              ))
            ) : (
              <div className="py-2 px-4 text-sm text-gray-500">No filters available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
// --- END: OdooSearchBar Component ---


// - MAIN PAGE COMPONENT -
const ProductsPage = () => {
  const navigate = useNavigate();
  const { products, isLoading, deleteProduct, isOnline } = useProducts();
  const { lookups } = useLookups();
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const isMutationDisabled = !isOnline;
  const disabledClass = 'opacity-50 cursor-not-allowed';

  const toggleExportMenu = () => {
    setIsExportMenuOpen(prev => !prev);
  };

  const closeExportMenu = () => {
    setIsExportMenuOpen(false);
  };

  // - START: DELETE LOGIC -
  const handleDeleteProduct = async (productId, sku) => {
    if (!isOnline) {
      alert('Cannot delete product in Offline Mode. Please connect to the internet.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete SKU: ${sku}? This action is permanent.`)) {
      try {
        await deleteProduct(productId);
      } catch (error) {
        alert(`Failed to delete product: ${error.message}`);
        console.error("Deletion Error:", error);
      }
    }
  };
  // - END: DELETE LOGIC -
  
  // --- START: EXPORT LOGIC ---
  const exportToExcel = () => {
    if (!filteredProducts.length) {
      alert("No products to export in the current view.");
      return;
    }

    const worksheetData = filteredProducts.map(p => ({
      SKU: p.sku,
      Model: p.model || "",
      Brand: p.brand || "",
      Category: p.category || "",
      Description: p.description || "", 
      ReorderPoint: p.reorderPoint || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Current_View_Products");
    XLSX.writeFile(wb, "products_export.xlsx");
  };

  const exportToPdf = () => {
    if (!filteredProducts.length) {
      alert("No products to export in the current view.");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Products Export (Current View)", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      head: [["SKU", "Model", "Brand", "Category", "Description", "Reorder Point"]],
      body: filteredProducts.map(p => [
        p.sku,
        p.model || "",
        p.brand || "",
        p.category || "",
        p.description || "",
        p.reorderPoint || 0
      ]),
      startY: 36,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 150, 243] },
    });
    doc.save("products_export.pdf");
  };
   
  const handleExport = (format) => {
    if (format === 'excel') {
      exportToExcel();
    } else if (format === 'pdf') {
      exportToPdf();
    }
    setIsExportMenuOpen(false);
  };
  // --- END: EXPORT LOGIC ---


  /*** Memoized list of products filtered by search text and active filters. */
  const filteredProducts = useMemo(() => {
    let currentProducts = products;

    // 1. Apply global text search 
    if (searchText) {
      const searchTerms = searchText.toLowerCase().split(/\s+/).filter(term => term.length > 0); 

      if (searchTerms.length > 0) { 
        currentProducts = currentProducts.filter(product => {
          return searchTerms.every(term => {
            const searchableText = [
              product.sku,
              product.model,
              product.brand,
              product.category,
              product.description 
            ]
            .filter(field => field) 
            .join(' ') 
            .toLowerCase(); 

            return searchableText.includes(term);
          });
        });
      }
    }

    // 2. Apply active filters
    if (activeFilters.length > 0) {
      const groupedFilters = activeFilters.reduce((acc, filter) => {
        if (!acc[filter.key]) {
          acc[filter.key] = [];
        }
        acc[filter.key].push(filter.value);
        return acc;
      }, {});
      const filterKeys = Object.keys(groupedFilters);
      
      currentProducts = currentProducts.filter(product => {
        return filterKeys.every(filterKey => {
          const productKey = getProductKeyFromFilterKey(filterKey); 
          const allowedValues = groupedFilters[filterKey]; 

          return allowedValues.includes(product[productKey]);
        });
      });
    }
    
    return currentProducts;
  }, [products, searchText, activeFilters]);

  /*** Toggles a filter on/off.*/
  const handleFilterToggle = (filter) => {
    setActiveFilters(prev => {
      const exists = prev.some(f => f.key === filter.key && f.value === filter.value);
      if (exists) {
        return prev.filter(f => !(f.key === filter.key && f.value === filter.value));
      } else {
        return [...prev, filter];
      }
    });
  };

  /*** Removes a filter.*/
  const handleFilterRemove = (filterToRemove) => {
    setActiveFilters(prev => prev.filter(f => !(f.key === filterToRemove.key && f.value === filterToRemove.value)));
  };

  // Categorize filter options for the search bar
  const categorizedFilterOptions = useMemo(() => {
    if (!lookups || Object.keys(lookups).length === 0) return [];

    return FILTERABLE_FIELDS.map(field => {
      const lookupItems = lookups[field.key] || [];
      return {
        key: field.key,
        label: field.label,
        options: lookupItems.map(value => ({
          key: field.key,
          label: value,
          value: value,
        })),
      };
    });
  }, [lookups]);


  // --- START: AG Grid Configuration ---
  
  // Custom Cell Renderer for the Actions column
  const actionCellRenderer = useCallback((params) => {
      const product = params.data;
      // Variables from the outer scope are accessible via closure (isOnline, navigate, handleDeleteProduct)
     
      const handleViewClick = () => {
        navigate(`/products/summary/${product.id}`); 
      };

      const handleEditClick = () => {
        if (!isMutationDisabled) {
            navigate(`/products/edit/${product.id}`);
        }
      };

      const handleDeleteClick = () => {
        if (!isMutationDisabled) {
            handleDeleteProduct(product.id, product.sku);
        }
      };

      return (
        <div className="flex justify-end space-x-2 h-full items-center">
          {/* View Icon (Summary Page) */}
          <button 
            onClick={handleViewClick}
            className="text-blue-600 hover:text-blue-900 p-1" // Updated color for View button
            title="View Summary"
          >
            <ViewIcon className="w-5 h-5" />
          </button>
          
          {/* Existing Edit Icon */}
          <button 
            onClick={handleEditClick} 
            className={`text-indigo-600 hover:text-indigo-900 p-1 ${isMutationDisabled ? disabledClass : ''}`} // Updated color and added padding
            disabled={isMutationDisabled}
            title="Edit Product"
          >
            <EditIcon className="w-5 h-5" />
          </button>

          {/* Existing Delete Icon */}
          <button
            onClick={handleDeleteClick}
            className={`text-red-600 hover:text-red-900 p-1 ${isMutationDisabled ? disabledClass : ''}`} // Added padding
            disabled={isMutationDisabled}
            title="Delete Product"
          >
            <DeleteIcon className="w-5 h-5" />
          </button>
        </div>
      );
  }, [isOnline, navigate, isMutationDisabled, disabledClass, handleDeleteProduct]); // Added dependencies to useCallback


  // Column Definitions
  const columnDefs = useMemo(() => ([
    { field: 'sku', headerName: 'SKU', width: 120, filter: true }, // Removed flex: 1, to prevent SKU from taking up too much space
    { field: 'model', headerName: 'Model', width: 150, filter: true }, // Removed flex: 2
    { field: 'brand', headerName: 'Brand', width: 100, filter: true },
    { field: 'category', headerName: 'Category', width: 120, filter: true },
    { 
      field: 'description', 
      headerName: 'Description', 
      filter: true, 
      flex: 3, 
      minWidth: 200,
      // FIX: Use valueFormatter for truncation instead of wrap/autoHeight
      valueGetter: (params) => params.data.description || '', 
      valueFormatter: (params) => {
        const desc = params.value;
        return desc ? (desc.length > 50 ? desc.substring(0, 50) + '...' : desc) : '';
      }
    },
    { 
      field: 'reorderPoint', 
      headerName: 'Reorder Point', 
      filter: 'agNumberColumnFilter', 
      width: 150, 
      cellStyle: { textAlign: 'center' }, // Centered text for number column
      cellRenderer: (params) => { // Use custom cell renderer for badge styling
        if (params.value === undefined || params.value === null) return null;
        const isLow = params.value <= 5; // Assuming reorder point is low if <= 5
        const badgeClass = isLow ? 'badge-danger' : 'badge-success'; // Use themed badge classes
        return <span className={`badge ${badgeClass}`}>{params.value}</span>;
      }
    },
    { 
      field: 'actions', 
      headerName: 'Actions', 
      cellRenderer: actionCellRenderer, 
      sortable: false, 
      filter: false, 
      width: 150, 
      minWidth: 150,
      maxWidth: 150,
      pinned: 'right', 
      cellClass: 'ag-cell-actions', 
    }
  ]), [actionCellRenderer]);

  // Default configuration for all columns
  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    // FIX DEPRECATION: Replaces deprecated 'suppressMenu'
    suppressHeaderMenuButton: true,
    flex: 1, // Let columns naturally flex
    minWidth: 80, // Minimum width for a column
  }), []);
  
  // --- END: AG Grid Configuration ---

  if (isLoading) {
    return <div className="p-8 text-xl text-center">Loading Products...</div>;
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      {/* FIX: Apply the custom 'page-title' class for consistent styling */}
      <h1 className="page-title">Product Management</h1>

      {/* Action Buttons (Navigation) */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => navigate('/products/add')}
          className="btn btn-primary"
          disabled={isMutationDisabled}
        >
          Add Product
        </button>
        <button
          onClick={() => navigate('/products/bulk-import')} 
          className="btn btn-secondary" 
          disabled={isMutationDisabled}
        >
          Bulk Import
        </button>

        {/* Export Button with Click-Triggered Dropdown */}
        <div className="relative inline-block text-left">
          <button
            type="button"
            className="btn btn-secondary" 
            aria-haspopup="true"
            aria-expanded={isExportMenuOpen} 
            title="Toggle Export Options"
            onClick={toggleExportMenu} 
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          
          <div
            id="export-dropdown-menu" 
            className={`absolute right-0 mt-1 w-48 z-10 transition-opacity duration-100 ${
              isExportMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
            }`}
          >
            <ul role="none" className="py-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
              <li>
                <button
                  onClick={() => handleExport('pdf')} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" 
                  role="menuitem"
                >
                  Export as PDF (.pdf)
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleExport('excel')} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" 
                  role="menuitem"
                >
                  Export as Excel (.xlsx)
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>


      {/* Search and Filter Bar - Uses themed class 'card' */}
      <div className="mb-6 card"> 
        <OdooSearchBar
          lookups={lookups}
          searchText={searchText}
          setSearchText={setSearchText}
          activeFilters={activeFilters}
          onFilterToggle={handleFilterToggle}
          onFilterRemove={handleFilterRemove}
          categorizedFilterOptions={categorizedFilterOptions}
        />
      </div>


      {/* AG Grid Component */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        {products.length === 0 ? (
          <p className="p-6 text-center text-gray-500">No products found. Add some products to get started.</p>
        ) : (
          <div 
            className="ag-theme-alpine" // Applies the Alpine theme via class name
            style={{ width: '100%', height: 600 }} // Grid is set to a fixed height
          >
            <AgGridReact
              rowData={filteredProducts} 
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}

              pagination={true} // Enables pagination
              paginationPageSize={25} 
              paginationPageSizeSelector={[10, 25, 50, 100]} 
              
              rowSelection="singleRow" 
              
              ensureDomOrder={true}
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default ProductsPage;