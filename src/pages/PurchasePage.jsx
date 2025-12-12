
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseInvoices } from '../contexts/PurchaseInvoiceContext';
import useMediaQuery from '../hooks/useMediaQuery';
import PurchaseInvoiceCard from '../components/PurchaseInvoiceCard';
import { Plus, Eye, Edit, Trash2, CheckCircle, PackagePlus, ListChecks } from 'lucide-react';

// AG Grid Imports
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'; 

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

const defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
};

const statusStyles = {
    PENDING: 'bg-yellow-100 text-red-700',
    'PARTIALLY RECEIVED': 'bg-blue-100 text-blue-700',
    FINALIZED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
};

// Status Cell Renderer
const StatusCellRenderer = ({ value }) => {
    if (!value) return null;
    return (
        <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${statusStyles[value] || 'bg-gray-100 text-gray-800'}`}>
            {value}
        </span>
    );
};

// Invoice Number Link Renderer
const InvoiceLinkRenderer = ({ value, data }) => {
    const navigate = useNavigate();
    if (!value) return null;
    return (
        <div
            onClick={() => navigate(`/purchase/view/${data.id}`)}
            className="font-bold hover:underline cursor-pointer flex items-center h-full"
        >
            {value}
        </div>
    );
};

// Action Buttons Cell Renderer
const ActionsCellRenderer = ({ data, isMutationDisabled, deleteInvoice }) => {
    const navigate = useNavigate();

    const handleView = () => navigate(`/purchase/view/${data.id}`);
    
    const handleEdit = () => {
        if (data.status === 'FINALIZED') {
            alert('Cannot edit a finalized invoice.');
            return;
        }
        navigate(`/purchase/edit/${data.id}`);
    };

    const handleFinalize = () => navigate(`/purchase/finalize/${data.id}`);

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete invoice ${data.invoiceNumber}? This action cannot be undone.`)) {
            try {
                await deleteInvoice(data.id);
            } catch (error) {
                console.error("Failed to delete invoice:", error);
                alert(`Failed to delete invoice: ${error.message}`);
            }
        }
    };

    const canBeDeleted = data.status === 'PENDING';
    const canBeEdited = data.status !== 'FINALIZED';
    const canBeFinalized = data.status !== 'FINALIZED';

    return (
        <div className="flex justify-center items-center h-full gap-1">
            <button onClick={handleView} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="View Invoice">
                <Eye size={16} />
            </button>
            <button 
                onClick={handleEdit} 
                className={`p-2 text-gray-600 hover:bg-gray-100 rounded-full ${!canBeEdited || isMutationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canBeEdited || isMutationDisabled}
                title={!canBeEdited ? 'Cannot edit finalized invoice' : 'Edit Invoice'}
            >
                <Edit size={16} />
            </button>
             <button 
                onClick={handleDelete}
                className={`p-2 text-red-600 hover:bg-red-100 rounded-full ${!canBeDeleted || isMutationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canBeDeleted || isMutationDisabled}
                title={!canBeDeleted ? 'Can only delete Pending invoices' : 'Delete Invoice'}
            >
                <Trash2 size={16} />
            </button>
            <button 
                onClick={handleFinalize} 
                className={`p-2 text-green-600 hover:bg-green-100 rounded-full ${!canBeFinalized || isMutationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canBeFinalized || isMutationDisabled}
                title={!canBeFinalized ? 'Invoice is already finalized' : 'Finalize Invoice'}
            >
                <CheckCircle size={16} />
            </button>
        </div>
    );
};


const PurchasePage = () => {
    const navigate = useNavigate();
    const { invoices, isLoading, error, isMutationDisabled, deleteInvoice } = usePurchaseInvoices();
    const [searchTerm, setSearchTerm] = useState('');
    const isMobile = useMediaQuery('(max-width: 768px)');

    const columnDefs = [
        { headerName: 'Invoice #', field: 'invoiceNumber', flex: 1.2, cellRenderer: InvoiceLinkRenderer },
        { headerName: 'Supplier', field: 'supplierName', flex: 1.5 },
        { 
            headerName: 'Date', 
            field: 'invoiceDate', 
            flex: 1, 
            valueFormatter: p => p.value && p.value.seconds ? new Date(p.value.seconds * 1000).toLocaleDateString() : '' 
        },
        { headerName: 'Total Amount', field: 'totalAmount', flex: 1, valueFormatter: p => p.value != null ? `Rs ${p.value.toFixed(2)}` : '', cellStyle: { textAlign: 'right' } },
        {
            headerName: 'Status',
            field: 'status',
            flex: 1,
            cellRenderer: StatusCellRenderer,
            cellClass: 'flex items-center'
        },
        {
            headerName: 'Actions',
            cellRenderer: (params) => <ActionsCellRenderer {...params} isMutationDisabled={isMutationDisabled} deleteInvoice={deleteInvoice} />,
            sortable: false,
            filter: false,
            width: 150,
            pinned: 'right',
            lockPinned: true,
        }
    ];

    const filteredInvoices = invoices.filter(invoice =>
        (invoice.invoiceNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (invoice.supplierName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const renderInvoices = () => {
        if (isLoading) return <p>Loading invoices...</p>;
        if (error) return <p>Error loading invoices: {error.message}</p>;

        if (filteredInvoices.length === 0) {
            return (
                <div className="card text-center p-6">
                    <p className="text-gray-500">No invoices found.</p>
                    {invoices.length === 0 && (
                        <button onClick={() => navigate('/purchase/new')} className="btn btn-primary mt-4" disabled={isMutationDisabled}>
                            <Plus className="inline-block mr-2" />
                            Create Your First Purchase Invoice
                        </button>
                    )}
                </div>
            );
        }

        if (isMobile) {
            return (
                <div>
                    {filteredInvoices.map(invoice => (
                        <PurchaseInvoiceCard
                            key={invoice.id}
                            invoice={invoice}
                            deleteInvoice={deleteInvoice}
                            isMutationDisabled={isMutationDisabled}
                        />
                    ))}
                </div>
            );
        }

        return (
            <div className="ag-theme-indigo" style={{ height: '60vh', width: '100%' }}>
                <AgGridReact
                    rowData={filteredInvoices}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    pagination={true}
                    paginationPageSize={15}
                    paginationPageSizeSelector={[15, 30, 50]}
                />
            </div>
        );
    }

    return (
        <div className="page-container">
             <header className="page-header">
                 <h1 className="page-title">Manage Purchases</h1>
                  <div className="page-actions">
                        <button onClick={() => navigate('/purchase/pending-receivables')} className="btn btn-accent" disabled={isMutationDisabled}>
                          <ListChecks size={18} className="mr-2"/>
                          Pending Stock
                      </button>
                      <button onClick={() => navigate('/purchase/receive')} className="btn btn-secondary" disabled={isMutationDisabled}>
                          <PackagePlus size={18} className="mr-2"/>
                          Receive Stock
                      </button>
                      <button onClick={() => navigate('/purchase/new')} className="btn btn-primary" disabled={isMutationDisabled}>
                          <Plus size={18} className="mr-2" />
                          New Invoice
                      </button>
                  </div>
            </header>

            <div className="page-content">
                <div className="card">
                    <div className="p-4 border-b">
                        <h3 className="card-title">Purchase Invoices ({filteredInvoices.length})</h3>
                         <input
                            type="text"
                            placeholder="Search by invoice number or supplier..."
                            className="input input-bordered w-full mt-2"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="p-4">
                       {renderInvoices()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchasePage;
