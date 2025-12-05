
// src/pages/CustomersSubPages/NewCustomerForm.jsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useCustomers } from '../../contexts/CustomerContext.jsx';
import { useLoading } from '../../contexts/LoadingContext.jsx';

const NewCustomerForm = () => {
    const navigate = useNavigate();
    const { addCustomer } = useCustomers();
    const { setAppProcessing } = useLoading();
    const [customer, setCustomer] = useState({
        name: '',
        phone: '',
        secondaryContact: '',
        cnic: '',
        priceType: 'Retail', // Default value
        address: '',
        notes: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCustomer(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAppProcessing(true, 'Saving customer...');
        try {
            await addCustomer(customer);
            navigate('/customers');
        } catch (error) {
            console.error("Failed to add customer:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/customers" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Customers
                    </Link>
                    <h1 className="page-title">New Customer</h1>
                </div>
            </header>

            <div className="page-content">
                <form onSubmit={handleSubmit}>
                    <div className="space-y-8">
                        {/* Customer Information Section */}
                        <div className="form-section">
                             <div className="form-section-title">
                                <h3>Customer Information</h3>
                                <p>Provide the main details for the new customer.</p>
                            </div>
                           <div className="form-section-content">
                                <div className="card p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label htmlFor="name">Full Name</label>
                                            <input type="text" name="name" id="name" value={customer.name} onChange={handleChange} required />
                                        </div>
                                        <div>
                                            <label htmlFor="phone">Primary Contact #</label>
                                            <input type="tel" name="phone" id="phone" value={customer.phone} onChange={handleChange} required />
                                        </div>
                                        <div>
                                            <label htmlFor="secondaryContact">Secondary Contact #</label>
                                            <input type="tel" name="secondaryContact" id="secondaryContact" value={customer.secondaryContact} onChange={handleChange} />
                                        </div>
                                        <div>
                                            <label htmlFor="cnic">CNIC</label>
                                            <input type="text" name="cnic" id="cnic" value={customer.cnic} onChange={handleChange} />
                                        </div>
                                        <div>
                                            <label htmlFor="priceType">Price Type</label>
                                            <select name="priceType" id="priceType" value={customer.priceType} onChange={handleChange}>
                                                <option value="Retail">Retail</option>
                                                <option value="Wholesale">Wholesale</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="address">Address</label>
                                            <textarea name="address" id="address" rows="3" value={customer.address} onChange={handleChange}></textarea>
                                        </div>
                                         <div>
                                            <label htmlFor="notes">Notes</label>
                                            <textarea name="notes" id="notes" rows="3" value={customer.notes} onChange={handleChange}></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end gap-3">
                        <Link to="/customers" className="btn btn-white">
                            Cancel
                        </Link>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} className="mr-2" />
                            Save Customer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewCustomerForm;
