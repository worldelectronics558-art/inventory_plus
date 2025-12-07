
// src/pages/PurchasePage.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePurchaseInvoices } from '../contexts/PurchaseInvoiceContext';
import { useAuth } from '../contexts/AuthContext';
import useMediaQuery from '../hooks/useMediaQuery';
import PurchaseInvoiceCard from '../components/PurchaseInvoiceCard';
import { Edit, Trash2, Eye } from 'lucide-react';

import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';


const StatusCellRenderer = (params) => {
    const status = params.value;
    const statusClass = {
        pending: 'bg-yellow-100 text-yellow-800',
        finalized: 'bg-green-100 text-green-800',
        cancelled: 'bg-red-100 text-red-800',
    }[status] || 'bg-gray-100 text-gray-800';

    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
            {status}
        </span>
    );
};

const InvoiceNumberCellRenderer = (params) => {
    if (!params.data) return null;
    return (
        <Link 
            to={`/purchase/view/${params.data.id}`}
            className="text-blue-600 hover:underline font-medium"
        >
            {params.value}
        </Link>
    );
};

const PurchasePage = () => {
    const navigate = useNavigate();
    const { invoices, isLoading, deleteInvoice } = usePurchaseInvoices();
    const { isOnline } = useAuth();
    const [searchText, setSearchText] = useState('');
    const isMobile = useMediaQuery('(max-width: 767px)');

    const isMutationDisabled = !isOnline;

    const filteredInvoices = useMemo(() => {
        if (!searchText) return invoices;
        const lowerSearchText = searchText.toLowerCase();
        return invoices.filter(invoice => 
            (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(lowerSearchText)) ||
            (invoice.supplierName && invoice.supplierName.toLowerCase().includes(lowerSearchText)) ||
            (invoice.status && invoice.status.toLowerCase().includes(lowerSearchText)) ||
            (invoice.createdByName && invoice.createdByName.toLowerCase().includes(lowerSearchText))
        );
    }, [invoices, searchText]);

    const ActionCellRenderer = useCallback((params) => {
        const invoice = params.data;
        const handleDelete = async (id) => {
            if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
                try {
                    await deleteInvoice(id);
                } catch (error) {
                    console.error("Failed to delete invoice:", error);
                    alert(`Error: ${error.message}`);
                }
            }
        };

        return (
             <div className="flex items-center justify-end h-full gap-2">
                 {invoice.status === 'pending' ? (
                     <>
                        <button
                            onClick={() => navigate(`/purchase/edit/${invoice.id}`)}
                            className="btn btn-sm btn-icon btn-secondary"
                            disabled={isMutationDisabled}
                            title="Edit"
                        >
                            <Edit size={16} />
                        </button>
                        <button
                            onClick={() => handleDelete(invoice.id)}
                            className="btn btn-sm btn-icon btn-danger"
                            disabled={isMutationDisabled}
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button 
                            onClick={() => navigate(`/purchase/finalize/${invoice.id}`)} 
                            className="btn btn-sm btn-primary"
                            disabled={isMutationDisabled}
                        >
                            Finalize
                        </button>
                     </>
                 ) : (
                     <button 
                        onClick={() => navigate(`/purchase/view/${invoice.id}`)} 
                        className="btn btn-sm btn-icon btn-outline-secondary"
                        title="View"
                    >
                         <Eye size={16}/>
                     </button>
                 )}
            </div>
        );
    }, [navigate, isMutationDisabled, deleteInvoice]);

    const columnDefs = useMemo(() => ([
        { 
            field: 'invoiceNumber',
            headerName: 'Number',
            filter: 'agTextColumnFilter',
            minWidth: 150, 
            cellRenderer: InvoiceNumberCellRenderer
        },
        { field: 'supplierName', headerName: 'Supplier', filter: 'agTextColumnFilter', minWidth: 200 },
        {
            field: 'invoiceDate',
            headerName: 'Date',
            filter: 'agDateColumnFilter',
            valueFormatter: params => params.value?.seconds ? new Date(params.value.seconds * 1000).toLocaleDateString() : 'N/A',
            minWidth: 120
        },
        {
            field: 'totalAmount',
            headerName: 'Gross Value',
            filter: 'agNumberColumnFilter',
            valueFormatter: params => params.value ? `Rs ${params.value.toFixed(2)}` : 'N/A',
            minWidth: 140,
            cellStyle: { textAlign: 'right' }
        },
        { field: 'status', headerName: 'Status', cellRenderer: StatusCellRenderer, minWidth: 100 },
        { field: 'createdByName', headerName: 'Created By', filter: 'agTextColumnFilter', minWidth: 150 },
        {
            headerName: 'Actions',
            cellRenderer: ActionCellRenderer,
            sortable: false,
            filter: false,
            minWidth: 180, 
            pinned: 'right',
        }
    ]), [ActionCellRenderer]);

    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        suppressHeaderMenuButton: true
    }), []);

    if (isLoading) {
        return <div className="page-container text-center">Loading invoices...</div>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Purchase Invoices</h1>
                <div className="page-actions">
                    <button onClick={() => navigate('/purchase/new')} className="btn btn-primary" disabled={isMutationDisabled}>New Invoice</button>
                    <button onClick={() => navigate('/purchase/receive-stock')} className="btn btn-secondary" disabled={isMutationDisabled}>Receive Stock</button>
                </div>
            </header>

            <div className="card mb-6">
                <div className="card-body">
                    <input 
                        type="text"
                        placeholder="Search by Number, Supplier, Status, or Creator..."
                        className="input-base w-full"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>
            </div>

            {filteredInvoices.length === 0 ? (
                <div className="card text-center p-6">
                    <p className="text-gray-500">No invoices found.</p>
                    {invoices.length === 0 && (
                        <button onClick={() => navigate('/purchase/new')} className="btn btn-primary mt-4" disabled={isMutationDisabled}>
                            Create Your First Purchase Invoice
                        </button>
                    )}
                </div>
            ) : isMobile ? (
                <div>
                    {filteredInvoices.map(invoice => (
                        <PurchaseInvoiceCard 
                            key={invoice.id}
                            invoice={invoice}
                            isMutationDisabled={isMutationDisabled}
                        />
                    ))}
                </div>
            ) : (
                <div className="ag-theme-alpine" style={{ height: '60vh', width: '100%' }}>
                    <AgGridReact
                        theme={themeQuartz}
                        rowData={filteredInvoices}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        pagination={true}
                        paginationPageSize={15}
                        paginationPageSizeSelector={[15, 30, 50]}
                    />
                </div>
            )}
        </div>
    );
};

export default PurchasePage;
