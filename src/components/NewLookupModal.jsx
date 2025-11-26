// src/components/NewLookupModal.jsx
import React, { useState } from 'react';
import { useLookups } from '../contexts/LookupContext';

const NewLookupModal = ({ type, onClose }) => {
    const { addLookupItem } = useLookups();
    const [newItem, setNewItem] = useState('');
    const fieldName = type.charAt(0).toUpperCase() + type.slice(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newItem.trim()) return;

        setLoading(true);
        setError(null);
        try {
            await addLookupItem(type, newItem);
            alert(`${fieldName} "${newItem.trim()}" created successfully!`);
            onClose();
        } catch (err) {
            // Display the specific error message (e.g., "Brand already exists")
            setError(err.message || `Failed to create ${fieldName}. Check console.`);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">Add New {fieldName}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder={`Enter new ${fieldName} name`}
                        required
                        className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                            {loading ? 'Adding...' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewLookupModal;