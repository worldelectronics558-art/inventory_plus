
// src/components/AddLocationModal.jsx

import React, { useState } from 'react';
import { useLocations } from '../contexts/LocationContext';
import { X } from 'lucide-react';

/**
 * A modal dialog for adding a new location.
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is currently open.
 * @param {function} props.onClose - Function to call when the modal should be closed.
 */
const AddLocationModal = ({ isOpen, onClose }) => {
    const { addLocation } = useLocations();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [status, setStatus] = useState({ loading: false, error: null, success: null });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setStatus({ loading: false, error: 'Location name is required.', success: null });
            return;
        }

        setStatus({ loading: true, error: null, success: null });
        try {
            await addLocation({ name, address });
            setStatus({ loading: false, error: null, success: 'Location added successfully!' });
            // Reset form and close modal after a short delay
            setTimeout(() => {
                setName('');
                setAddress('');
                onClose();
            }, 1000);
        } catch (error) {
            setStatus({ loading: false, error: `Failed to add location: ${error.message}`, success: null });
        }
    };

    if (!isOpen) {
        return null;
    }

    // The background is a div with a backdrop-blur effect
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md m-4">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">Add New Location</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="location-name" className="block text-sm font-medium text-gray-700 mb-1">
                            Location Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="location-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input-base"
                            placeholder="e.g., Main Warehouse"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="location-address" className="block text-sm font-medium text-gray-700 mb-1">
                            Address (Optional)
                        </label>
                        <textarea
                            id="location-address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            rows="3"
                            className="input-base"
                            placeholder="e.g., 123 Industrial Ave, Suite 100"
                        />
                    </div>
                    <div className="flex justify-end items-center gap-4 pt-4">
                        {status.error && <p className="text-sm text-red-600">{status.error}</p>}
                        {status.success && <p className="text-sm text-green-600">{status.success}</p>}
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-outline"
                            disabled={status.loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={status.loading}
                        >
                            {status.loading ? 'Saving...' : 'Save Location'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddLocationModal;
