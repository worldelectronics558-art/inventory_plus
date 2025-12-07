
// src/pages/PurchasingSubPages/NewSupplierForm.jsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useSuppliers } from '../../contexts/SupplierContext.jsx';
import { useLoading } from '../../contexts/LoadingContext.jsx';

const NewSupplierForm = () => {
    const navigate = useNavigate();
    const { addSupplier } = useSuppliers();
    const { setAppProcessing } = useLoading();
    const [supplier, setSupplier] = useState({
        name: '',
        email: '',
        address: '',
        notes: '',
        primaryContactPerson: '',
        primaryContactNumber: '',
        secondaryContactPerson: '',
        secondaryContactNumber: '',
        status: 'Active',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSupplier(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAppProcessing(true, 'Saving supplier...');
        try {
            await addSupplier(supplier);
            navigate('/suppliers');
        } catch (error) {
            console.error("Failed to add supplier:", error);
            // Optionally, show an error message to the user
        } finally {
            setAppProcessing(false);
        }
    };

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/suppliers" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Suppliers
                    </Link>
                    <h1 className="page-title">New Supplier</h1>
                </div>
            </header>

            <div className="page-content">
                <form onSubmit={handleSubmit}>
                    <div className="space-y-8">
                        {/* Supplier Information Section */}
                        <div className="form-section">
                            <div className="form-section-title">
                                <h3>Supplier Information</h3>
                                <p>Provide the main details for the supplier. The Supplier ID will be generated automatically upon saving.</p>
                            </div>
                            <div className="form-section-content">
                                <div className="card p-6">
                                    <div className="grid grid-cols-1 gap-6">
                                        <div>
                                            <label htmlFor="name">Supplier Name</label>
                                            <input type="text" name="name" id="name" value={supplier.name} onChange={handleChange} required />
                                        </div>
                                        <div>
                                            <label htmlFor="email">Email Address</label>
                                            <input type="email" name="email" id="email" value={supplier.email} onChange={handleChange} />
                                        </div>
                                        <div>
                                            <label htmlFor="address">Address</label>
                                            <textarea name="address" id="address" rows="3" value={supplier.address} onChange={handleChange}></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Person Section */}
                        <div className="form-section">
                            <div className="form-section-title">
                                <h3>Contact Persons</h3>
                                <p>Key contact information for communication and orders.</p>
                            </div>
                            <div className="form-section-content">
                                <div className="card p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Additional Information Section */}
                        <div className="form-section">
                            <div className="form-section-title">
                                <h3>Additional Information</h3>
                                <p>Use this section for internal notes or special instructions related to this supplier.</p>
                            </div>
                            <div className="form-section-content">
                                <div className="card p-6">
                                    <div>
                                        <label htmlFor="notes">Notes</label>
                                        <textarea name="notes" id="notes" rows="4" value={supplier.notes} onChange={handleChange}></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end gap-3">
                        <Link to="/suppliers" className="btn btn-white">
                            Cancel
                        </Link>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} className="mr-2" />
                            Save Supplier
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewSupplierForm;
