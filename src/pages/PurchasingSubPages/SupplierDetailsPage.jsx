
// src/pages/PurchasingSubPages/SupplierDetailsPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useSuppliers } from '../../contexts/SupplierContext.jsx';
import { useLoading } from '../../contexts/LoadingContext.jsx';

const SupplierDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { suppliers, deleteSupplier } = useSuppliers();
    const { setAppProcessing } = useLoading();
    const [supplier, setSupplier] = useState(null);

    useEffect(() => {
        const selectedSupplier = suppliers.find(s => s.id === id);
        if (selectedSupplier) {
            setSupplier(selectedSupplier);
        } else {
            // Optional: A small delay before navigating back can prevent jarring user experience
            // if the data is just loading.
            const timer = setTimeout(() => {
                navigate('/purchasing/suppliers');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [id, suppliers, navigate]);

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this supplier? This action cannot be undone.")) {
            setAppProcessing(true, 'Deleting supplier...');
            try {
                await deleteSupplier(id);
                navigate('/purchasing/suppliers');
            } catch (error) {
                console.error("Failed to delete supplier:", error);
                alert(`Error: ${error.message}`);
            } finally {
                setAppProcessing(false);
            }
        }
    };

    if (!supplier) {
        return <div>Loading supplier details...</div>;
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/purchasing/suppliers" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Suppliers
                    </Link>
                    <h1 className="page-title">{supplier.name}</h1>
                </div>
                <div className="page-actions">
                    <Link to={`/purchasing/suppliers/${id}/edit`} className="btn btn-white">
                        <Edit size={16} className="mr-2" />
                        Edit
                    </Link>
                    <button className="btn btn-danger" onClick={handleDelete}>
                        <Trash2 size={16} className="mr-2" />
                        Delete
                    </button>
                </div>
            </header>

            <div className="page-content">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <div className="card">
                            <div className="card-header">
                                <h4>Supplier Details</h4>
                            </div>
                            <div className="card-body">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Supplier ID</p>
                                        <p>{supplier.displayId}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Email</p>
                                        <p>{supplier.email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Address</p>
                                        <p>{supplier.address || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Status</p>
                                        <span className={`badge ${supplier.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {supplier.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="card mb-6">
                            <div className="card-header">
                                <h4>Contact Persons</h4>
                            </div>
                            <div className="card-body space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500">Primary Contact</p>
                                    <p className="font-medium">{supplier.primaryContactPerson || 'N/A'}</p>
                                    <p className="text-sm text-gray-600">{supplier.primaryContactNumber || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Secondary Contact</p>
                                    <p className="font-medium">{supplier.secondaryContactPerson || 'N/A'}</p>
                                    <p className="text-sm text-gray-600">{supplier.secondaryContactNumber || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-header">
                                <h4>Notes</h4>
                            </div>
                            <div className="card-body">
                                <p className="text-sm text-gray-600">{supplier.notes || 'No notes for this supplier.'}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card mt-6">
                    <div className="card-header">
                        <h4>Associated Products</h4>
                    </div>
                    <div className="card-body">
                        <p className="text-sm text-gray-500">Product listing functionality will be implemented soon.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupplierDetailsPage;
