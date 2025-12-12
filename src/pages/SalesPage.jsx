
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSalesOrders } from '../contexts/SalesOrderContext';
import useMediaQuery from '../hooks/useMediaQuery';
import SalesOrderCard from '../components/SalesOrderCard';
import { Plus, Eye, Edit, Trash2, CheckCircle, Truck, ListChecks } from 'lucide-react';

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
    'PARTIALLY SHIPPED': 'bg-blue-100 text-blue-700',
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

// Order Number Link Renderer
const OrderLinkRenderer = ({ value, data }) => {
    const navigate = useNavigate();
    if (!value) return null;
    return (
        <div
            onClick={() => navigate(`/sales/view/${data.id}`)}
            className="font-bold hover:underline cursor-pointer flex items-center h-full"
        >
            {value}
        </div>
    );
};

// Action Buttons Cell Renderer
const ActionsCellRenderer = ({ data, isMutationDisabled, deleteSalesOrder }) => {
    const navigate = useNavigate();

    const handleView = () => navigate(`/sales/view/${data.id}`);
    
    const handleEdit = () => {
        if (data.status === 'FINALIZED') {
            alert('Cannot edit a finalized order.');
            return;
        }
        navigate(`/sales/edit/${data.id}`);
    };

    const handleFinalize = () => navigate(`/sales/finalize-order/${data.id}`);

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete order ${data.orderNumber}? This action cannot be undone.`)) {
            try {
                await deleteSalesOrder(data.id);
            } catch (error) {
                console.error("Failed to delete sales order:", error);
                alert(`Failed to delete order: ${error.message}`);
            }
        }
    };

    const canBeDeleted = data.status === 'PENDING';
    const canBeEdited = data.status !== 'FINALIZED';
    const canBeFinalized = data.status !== 'FINALIZED';

    return (
        <div className="flex justify-center items-center h-full gap-1">
            <button onClick={handleView} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="View Order">
                <Eye size={16} />
            </button>
            <button 
                onClick={handleEdit} 
                className={`p-2 text-gray-600 hover:bg-gray-100 rounded-full ${!canBeEdited || isMutationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canBeEdited || isMutationDisabled}
                title={!canBeEdited ? 'Cannot edit finalized order' : 'Edit Order'}
            >
                <Edit size={16} />
            </button>
             <button 
                onClick={handleDelete}
                className={`p-2 text-red-600 hover:bg-red-100 rounded-full ${!canBeDeleted || isMutationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canBeDeleted || isMutationDisabled}
                title={!canBeDeleted ? 'Can only delete PENDING orders' : 'Delete Order'}
            >
                <Trash2 size={16} />
            </button>
            <button 
                onClick={handleFinalize} 
                className={`p-2 text-green-600 hover:bg-green-100 rounded-full ${!canBeFinalized || isMutationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canBeFinalized || isMutationDisabled}
                title={!canBeFinalized ? 'Order is already finalized' : 'Finalize Order'}
            >
                <CheckCircle size={16} />
            </button>
        </div>
    );
};

const SalesPage = () => {
    const navigate = useNavigate();
    const { salesOrders, isLoading, error, isMutationDisabled, deleteSalesOrder } = useSalesOrders();
    const [searchTerm, setSearchTerm] = useState('');
    const isMobile = useMediaQuery('(max-width: 768px)');

    const columnDefs = [
        { headerName: 'Order #', field: 'orderNumber', flex: 1.2, cellRenderer: OrderLinkRenderer },
        { headerName: 'Customer', field: 'customerName', flex: 1.5 },
        { 
            headerName: 'Date', 
            field: 'orderDate', 
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
            cellRenderer: (params) => <ActionsCellRenderer {...params} isMutationDisabled={isMutationDisabled} deleteSalesOrder={deleteSalesOrder} />,
            sortable: false,
            filter: false,
            width: 150,
            pinned: 'right',
            lockPinned: true,
        }
    ];

    const filteredSalesOrders = salesOrders.filter(order =>
        (order.orderNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (order.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const renderSalesOrders = () => {
        if (isLoading) return <p>Loading sales orders...</p>;
        if (error) return <p>Error loading orders: {error.message}</p>;

        if (filteredSalesOrders.length === 0) {
            return (
                <div className="card text-center p-6">
                    <p className="text-gray-500">No sales orders found.</p>
                    {salesOrders.length === 0 && (
                        <button onClick={() => navigate('/sales/new')} className="btn btn-primary mt-4" disabled={isMutationDisabled}>
                            <Plus className="inline-block mr-2" />
                            Create Your First Sales Order
                        </button>
                    )}
                </div>
            );
        }

        if (isMobile) {
            return (
                <div className="space-y-4">
                    {filteredSalesOrders.map(order => (
                        <SalesOrderCard
                            key={order.id}
                            order={order}
                            deleteSalesOrder={deleteSalesOrder}
                            isMutationDisabled={isMutationDisabled}
                        />
                    ))}
                </div>
            );
        }

        return (
            <div className="ag-theme-indigo" style={{ height: '60vh', width: '100%' }}>
                <AgGridReact
                    rowData={filteredSalesOrders}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    pagination={true}
                    paginationPageSize={15}
                    paginationPageSizeSelector={[15, 30, 50]}
                    rowHeight={48}
                />
            </div>
        );
    }

    return (
        <div className="page-container">
             <header className="page-header">
                 <h1 className="page-title">Manage Sales</h1>
                  <div className="page-actions">
                      <button onClick={() => navigate('/sales/pending-deliverables')} className="btn btn-accent" disabled={isMutationDisabled}>
                          <ListChecks size={18} className="mr-2"/>
                          Pending Deliveries
                      </button>
                      <button onClick={() => navigate('/sales/stock-delivery')} className="btn btn-secondary" disabled={isMutationDisabled}>
                          <Truck size={18} className="mr-2"/>
                          Create Delivery
                      </button>
                      <button onClick={() => navigate('/sales/new')} className="btn btn-primary" disabled={isMutationDisabled}>
                          <Plus size={18} className="mr-2" />
                          New Order
                      </button>
                  </div>
            </header>

            <div className="page-content">
                <div className="card bg-base-100 shadow-sm">
                    <div className="p-4 border-b">
                        <h3 className="card-title">Sales Orders ({filteredSalesOrders.length})</h3>
                         <input
                            type="text"
                            placeholder="Search by order number or customer..."
                            className="input input-bordered w-full mt-2"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="p-4">
                       {renderSalesOrders()}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default SalesPage;
