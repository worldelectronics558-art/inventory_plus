
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSuppliers } from '../contexts/SupplierContext.jsx';
import { usePurchaseInvoices } from '../contexts/PurchaseInvoiceContext.jsx';
import { Plus, Search, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { useLoading } from '../contexts/LoadingContext.jsx';

const SupplierCard = ({ supplier, onEdit, onDelete }) => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMenuToggle = (e) => {
        e.stopPropagation();
        setIsMenuOpen(prev => !prev);
    };

    return (
        <div className="card bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-4">
                <div className="flex justify-between items-start">
                    <div className="flex-grow pr-4">
                        <h3 className="font-bold text-lg text-gray-800">{supplier.name}</h3>
                        <p className="text-sm text-gray-500">{supplier.supplierId}</p>
                    </div>
                    <div className="relative">
                        <button ref={buttonRef} onClick={handleMenuToggle} className="p-2 text-gray-500 rounded-full hover:bg-gray-100">
                            <MoreVertical size={20} />
                        </button>
                        {isMenuOpen && (
                            <div ref={menuRef} className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10 py-1">
                                <button onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/${supplier.id}`); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <Eye size={16} className="mr-3"/> View Details
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onEdit(supplier.id); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <Edit size={16} className="mr-3"/> Edit
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(supplier.id); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                    <Trash2 size={16} className="mr-3"/> Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500">Primary Contact</p>
                        <p className="font-medium">{supplier.primaryContactPerson || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{supplier.primaryContactNumber}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Email</p>
                        <p className="font-medium">{supplier.email}</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                        <p className="text-gray-500">Address</p>
                        <p className="font-medium">{supplier.address}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SuppliersPage = () => {
  const { suppliers, deleteSupplier, isLoading } = useSuppliers();
  const { purchaseInvoices } = usePurchaseInvoices();
  const { setAppProcessing } = useLoading();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleEdit = (supplierId) => {
    navigate(`/suppliers/${supplierId}/edit`);
  };

  const handleDelete = async (supplierId) => {
    const hasPurchases = purchaseInvoices.some(invoice => invoice.supplierId === supplierId);
    if (hasPurchases) {
        alert('Cannot delete this supplier because they have existing purchase invoices. Please delete their invoices first.');
        return;
    }

    if (window.confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) {
        setAppProcessing(true, 'Deleting supplier...');
        try {
            await deleteSupplier(supplierId);
        } catch (error) {
            console.error('Failed to delete supplier:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    }
  };

  const filteredSuppliers = useMemo(() => suppliers.filter(s => {
    const search = searchTerm.toLowerCase();
    return (
        s.name.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search) ||
        (s.supplierId && s.supplierId.toLowerCase().includes(search))
    );
  }), [suppliers, searchTerm]);


  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <Link to="/suppliers/new" className="btn btn-primary">
          <Plus size={16} className="mr-2" />
          New Supplier
        </Link>
      </header>

      <div className="page-content">
        <div className="mb-6">
            <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text"
                    placeholder="Search by Name, Email, or ID..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="input-base pl-10 w-full max-w-md"
                />
            </div>
        </div>

        {isLoading ? (
            <div className="text-center py-10">Loading suppliers...</div>
        ) : filteredSuppliers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSuppliers.map(supplier => (
                    <SupplierCard 
                        key={supplier.id} 
                        supplier={supplier} 
                        onEdit={handleEdit} 
                        onDelete={handleDelete} 
                    />
                ))}
            </div>
        ) : (
            <div className="text-center py-10 text-gray-500">
                <p>No suppliers found.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SuppliersPage;
