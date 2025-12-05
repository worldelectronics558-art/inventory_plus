
// src/pages/PurchasingSubPages/EditSupplierForm.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useSuppliers } from '../../contexts/SupplierContext.jsx';
import { useLoading } from '../../contexts/LoadingContext.jsx';

const EditSupplierForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { suppliers, updateSupplier } = useSuppliers();
    const { setAppProcessing } = useLoading();
    const [supplier, setSupplier] = useState(null);

    useEffect(() => {
        const supplierToEdit = suppliers.find(s => s.id === id);
        if (supplierToEdit) {
            setSupplier(supplierToEdit);
        } else {
            navigate('/purchasing/suppliers');
        }
    }, [id, suppliers, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSupplier(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAppProcessing(true, 'Updating supplier...');
        try {
            await updateSupplier(id, supplier);
            navigate(`/purchasing/suppliers/${id}`);
        } catch (error) {
            console.error("Failed to update supplier:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    if (!supplier) {
        return <div>Loading...</div>; // Or a proper loading spinner
    }

    return (
        <div className="page-container">
            <header className="page-header">
                 <div>
                    <Link to={`/purchasing/suppliers/${id}`} className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Supplier Details
                    </Link>
                    <h1 className="page-title">Edit Supplier</h1>
                </div>
            </header>

            <div className="page-content">
                <form onSubmit={handleSubmit}>
                    <div className="card p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* All fields from NewSupplierForm, pre-filled with supplier data */}
                            <div>
                                <label htmlFor="name">Supplier Name</label>
                                <input type="text" name="name" id="name" value={supplier.name} onChange={handleChange} required />
                            </div>
                             <div>
                                <label htmlFor="email">Email</label>
                                <input type="email" name="email" id="email" value={supplier.email} onChange={handleChange} />
                            </div>
                            <div>
                                <label htmlFor="primaryContactPerson">Primary Contact Person</label>
                                <input type="text" name="primaryContactPerson" id="primaryContactPerson" value={supplier.primaryContactPerson} onChange={handleChange} />
                            </div>
                            <div>
                                <label htmlFor="primaryContactNumber">Primary Contact #</label>
                                <input type="tel" name="primaryContactNumber" id="primaryContactNumber" value={supplier.primaryContactNumber} onChange={handleChange} />
                            </div>
                           <div>
                                <label htmlFor="secondaryContactPerson">Secondary Contact Person</label>
                                <input type="text" name="secondaryContactPerson" id="secondaryContactPerson" value={supplier.secondaryContactPerson} onChange={handleChange} />
                            </div>
                            <div>
                                <label htmlFor="secondaryContactNumber">Secondary Contact #</label>
                                <input type="tel" name="secondaryContactNumber" id="secondaryContactNumber" value={supplier.secondaryContactNumber} onChange={handleChange} />
                            </div>
                             <div>
                                <label htmlFor="address">Address</label>
                                <textarea name="address" id="address" rows="3" value={supplier.address} onChange={handleChange}></textarea>
                            </div>
                            <div>
                                <label htmlFor="notes">Notes</label>
                                <textarea name="notes" id="notes" rows="3" value={supplier.notes} onChange={handleChange}></textarea>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end gap-3">
                         <Link to={`/purchasing/suppliers/${id}`} className="btn btn-white">
                            Cancel
                        </Link>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} className="mr-2" />
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditSupplierForm;
