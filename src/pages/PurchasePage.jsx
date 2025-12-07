
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseInvoices } from '../contexts/PurchaseInvoiceContext';
import useMediaQuery from '../hooks/useMediaQuery';
import PurchaseInvoiceCard from '../components/PurchaseInvoiceCard';
import { Plus, Eye, Edit, CheckCircle, PackagePlus, ListChecks } from 'lucide-react';

// AG Grid Imports
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
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
const ActionsCellRenderer = ({ data, isMutationDisabled }) => {
    const navigate = useNavigate();

    const handleView = () => {
        navigate(`/purchase/view/${data.id}`);
    };

    const handleEdit = () => {
        if (data.status === 'Finalized') {
            alert('Cannot edit a finalized invoice.');
            return;
        }
        navigate(`/purchase/edit/${data.id}`);
    };

    const handleFinalize = () => {
        navigate(`/purchase/finalize/${data.id}`);
    };

    return (
        <div className="flex justify-center items-center h-full">
            <button onClick={handleView} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="View Invoice">
                <Eye size={16} />
            </button>
            <button 
                onClick={handleEdit} 
                className={`p-2 text-gray-600 hover:bg-gray-100 rounded-full ${data.status === 'Finalized' || isMutationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={data.status === 'Finalized' || isMutationDisabled}
                title={data.status === 'Finalized' ? 'Cannot edit finalized invoice' : 'Edit Invoice'}
            >
                <Edit size={16} />
            </button>
            <button 
                onClick={handleFinalize} 
                className={`p-2 text-green-600 hover:bg-green-100 rounded-full ${data.status === 'Finalized' || isMutationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={data.status === 'Finalized' || isMutationDisabled}
                title={data.status === 'Finalized' ? 'Invoice is already finalized' : 'Finalize Invoice'}
            >
                <CheckCircle size={16} />
            </button>
        </div>
    );
};


const PurchasePage = () => {
    const navigate = useNavigate();
    const { invoices, loading, error, isMutationDisabled } = usePurchaseInvoices();
    const [searchTerm, setSearchTerm] = useState('');
    const isMobile = useMediaQuery('(max-width: 768px)');

    const columnDefs = [
        { 
            headerName: 'Invoice #', 
            field: 'invoiceNumber', 
            flex: 1,
            cellRenderer: InvoiceLinkRenderer
        },
        { headerName: 'Supplier', field: 'supplierName', flex: 1 },
        { 
            headerName: 'Date', 
            field: 'invoiceDate', 
            flex: 1, 
            valueFormatter: p => p.value && p.value.seconds ? new Date(p.value.seconds * 1000).toLocaleDateString() : '' 
        },
        { headerName: 'Total Amount', field: 'totalAmount', flex: 1, valueFormatter: p => p.value ? `$${p.value.toFixed(2)}` : '', cellStyle: { textAlign: 'right' } },
        { headerName: 'Status', field: 'status', flex: 1 },
        {
            headerName: 'Actions',
            cellRenderer: (params) => <ActionsCellRenderer {...params} isMutationDisabled={isMutationDisabled} />,
            sortable: false,
            filter: false,
            width: 120,
            pinned: 'right'
        }
    ];

    const filteredInvoices = invoices.filter(invoice =>
        (invoice.invoiceNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (invoice.supplierName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const renderInvoices = () => {
        if (loading) return <p>Loading invoices...</p>;
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
        <div className="container mx-auto p-4">
            <div className="card mb-4">
                <div className="flex justify-between items-center p-4">
                  <h2 className="text-xl font-bold">Manage Purchases</h2>
                  <div className="flex items-center gap-2">
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
                </div>

                <div className="mt-4 p-4">
                    <h3 className="text-lg font-bold mb-2">Purchase Invoices ({filteredInvoices.length})</h3>
                    <input
                        type="text"
                        placeholder="Search by invoice number or supplier..."
                        className="input input-bordered w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="p-4">
                   {renderInvoices()}
                </div>
            </div>
        </div>
    );
};

export default PurchasePage;
