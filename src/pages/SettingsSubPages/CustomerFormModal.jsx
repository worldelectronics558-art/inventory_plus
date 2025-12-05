
// src/pages/SettingsSubPages/CustomerFormModal.jsx

import React, { useState, useEffect } from 'react';
import { useCustomers } from '../../contexts/CustomerContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useLocations } from '../../contexts/LocationContext';

// --- Helper functions for formatting ---
const formatCnic = (value) => {
    if (!value) return '';
    const digits = value.replace(/[^0-9]/g, '').substring(0, 13);
    if (digits.length > 5 && digits.length <= 12) {
        return `${digits.substring(0, 5)}-${digits.substring(5)}`;
    } else if (digits.length > 12) {
        return `${digits.substring(0, 5)}-${digits.substring(5, 12)}-${digits.substring(12)}`;
    }
    return digits;
};

const formatPhoneNumber = (value) => {
    if (!value) return '';
    let digits = value.replace(/[^0-9-]/g, ''); // Allow hyphens
    if (digits.length > 3 && digits.charAt(3) !== '-') {
        digits = `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }
    return digits.substring(0, 11); // e.g., 333-1234567
};


const CustomerFormModal = ({ isOpen, onClose, customer }) => {
    const { addCustomer, updateCustomer } = useCustomers();
    const { setAppProcessing } = useLoading();
    const { locations } = useLocations();

    const getInitialFormData = () => ({
        id: '',
        firstName: '',
        lastName: '',
        primaryContactPrefix: '+92',
        primaryContact: '',
        secondaryContactPrefix: '+92',
        secondaryContact: '',
        address: '',
        pointOfContact: '',
        cnic: '',
        priceType: 'Retail',
        notes: '',
    });

    const [formData, setFormData] = useState(getInitialFormData());
    const [errors, setErrors] = useState({});

    const isEditMode = !!customer;

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && customer) {
                const nameParts = customer.name ? customer.name.split(' ') : ['', ''];
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                const splitPhone = (phoneStr) => {
                    if (!phoneStr) return { prefix: '+92', number: '' };
                    const parts = phoneStr.split('-');
                    if (parts.length > 1) {
                         const prefix = parts[0];
                         const number = parts.slice(1).join('-');
                         return { prefix, number };
                    }
                    return { prefix: '+92', number: phoneStr };
                };
                
                const primary = splitPhone(customer.phone);
                const secondary = splitPhone(customer.secondaryContact);

                setFormData({
                    id: customer.id || '',
                    firstName: firstName,
                    lastName: lastName,
                    primaryContactPrefix: primary.prefix,
                    primaryContact: primary.number,
                    secondaryContactPrefix: secondary.prefix,
                    secondaryContact: secondary.number,
                    address: customer.address || '',
                    pointOfContact: customer.pointOfContact || '',
                    cnic: customer.cnic === '00000-0000000-0' ? '' : formatCnic(customer.cnic),
                    priceType: customer.priceType || 'Retail',
                    notes: customer.notes || '',
                });
            } else {
                setFormData(getInitialFormData());
            }
            setErrors({});
        }
    }, [isOpen, customer, isEditMode]);

    if (!isOpen) return null;

    const validate = () => {
        const newErrors = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required.';
        if (!formData.primaryContact.trim()) newErrors.primaryContact = 'Primary contact number is required.';
        if (!formData.priceType) newErrors.priceType = 'Price Type is required.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let processedValue = value;

        if (name === 'primaryContact' || name === 'secondaryContact') {
            processedValue = formatPhoneNumber(value);
        } else if (name === 'cnic') {
            processedValue = formatCnic(value);
        }
        
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setAppProcessing(true, isEditMode ? 'Saving changes...' : 'Adding customer...');
        try {
            const submissionData = {
                ...formData,
                name: `${formData.firstName} ${formData.lastName}`.trim(),
                phone: `${formData.primaryContactPrefix}-${formData.primaryContact}`,
                secondaryContact: formData.secondaryContact ? `${formData.secondaryContactPrefix}-${formData.secondaryContact}` : '',
                cnic: formData.cnic.trim() === '' ? '00000-0000000-0' : formData.cnic,
            };
            
            // Clean up temporary fields
            delete submissionData.firstName;
            delete submissionData.lastName;
            delete submissionData.primaryContactPrefix;
            delete submissionData.primaryContact;

            if (isEditMode) {
                await updateCustomer(customer.id, submissionData);
            } else {
                // For new customers, the ID is generated by the context/backend
                delete submissionData.id;
                await addCustomer(submissionData);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save customer:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setAppProcessing(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-container max-w-3xl"> {/* Increased width */}
                <div className="modal-header">
                    <h2 className="text-xl font-bold">{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2>
                    <button onClick={onClose} className="modal-close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {isEditMode && (
                             <div className="md:col-span-1">
                                <label htmlFor="customerId" className="block text-sm font-medium mb-1">Customer ID</label>
                                <input id="customerId" name="id" type="text" value={formData.id} disabled className="input-base bg-gray-100" />
                            </div>
                        )}
                        <div className={isEditMode ? "md:col-span-3" : "md:col-span-4"}>
                            <label htmlFor="priceType" className="block text-sm font-medium mb-1">Price Type *</label>
                            <select id="priceType" name="priceType" value={formData.priceType} onChange={handleChange} className={`input-base ${errors.priceType ? 'border-red-500' : ''}`}>
                                <option value="Retail">Retail</option>
                                <option value="Wholesale">Wholesale</option>
                            </select>
                            {errors.priceType && <p className="text-red-500 text-xs mt-1">{errors.priceType}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium mb-1">First Name *</label>
                            <input id="firstName" name="firstName" type="text" value={formData.firstName} onChange={handleChange} className={`input-base ${errors.firstName ? 'border-red-500' : ''}`} />
                            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                        </div>
                        <div>
                            <label htmlFor="lastName" className="block text-sm font-medium mb-1">Last Name</label>
                            <input id="lastName" name="lastName" type="text" value={formData.lastName} onChange={handleChange} className="input-base" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="primaryContact" className="block text-sm font-medium mb-1">Primary Contact # *</label>
                            <div className="flex items-center">
                                <input name="primaryContactPrefix" type="text" value={formData.primaryContactPrefix} onChange={handleChange} className="input-base w-20 rounded-r-none" />
                                <input id="primaryContact" name="primaryContact" type="tel" placeholder="333-1234567" value={formData.primaryContact} onChange={handleChange} className={`input-base rounded-l-none ${errors.primaryContact ? 'border-red-500' : ''}`} />
                            </div>
                            {errors.primaryContact && <p className="text-red-500 text-xs mt-1">{errors.primaryContact}</p>}
                        </div>
                        <div>
                            <label htmlFor="secondaryContact" className="block text-sm font-medium mb-1">Secondary Contact #</label>
                            <div className="flex items-center">
                                <input name="secondaryContactPrefix" type="text" value={formData.secondaryContactPrefix} onChange={handleChange} className="input-base w-20 rounded-r-none" />
                                <input id="secondaryContact" name="secondaryContact" type="tel" placeholder="300-7654321" value={formData.secondaryContact} onChange={handleChange} className="input-base rounded-l-none" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="cnic" className="block text-sm font-medium mb-1">CNIC</label>
                            <input id="cnic" name="cnic" type="text" placeholder="XXXXX-XXXXXXX-X" value={formData.cnic} onChange={handleChange} className="input-base" />
                        </div>
                        <div>
                            <label htmlFor="pointOfContact" className="block text-sm font-medium mb-1">Point of Contact (Store)</label>
                            <select id="pointOfContact" name="pointOfContact" value={formData.pointOfContact} onChange={handleChange} className="input-base">
                                <option value="">Select a location</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="address" className="block text-sm font-medium mb-1">Address</label>
                        <textarea id="address" name="address" rows="2" value={formData.address} onChange={handleChange} className="input-base" />
                    </div>
                     <div>
                        <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes</label>
                        <textarea id="notes" name="notes" rows="2" value={formData.notes} onChange={handleChange} className="input-base" />
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-outline-secondary">Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Save Changes' : 'Add Customer'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CustomerFormModal;
