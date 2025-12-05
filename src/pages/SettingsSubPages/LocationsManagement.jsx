
// src/pages/SettingsSubPages/LocationsManagement.jsx

import React, { useState } from 'react';
import { useLocations } from '../../contexts/LocationContext';
import { useLoading } from '../../contexts/LoadingContext';
import { Plus, Trash2 } from 'lucide-react';

const LocationsManagement = () => {
    const { locations, addLocation, deleteLocation, isLoading } = useLocations();
    const { setAppProcessing } = useLoading();
    const [newLocationName, setNewLocationName] = useState('');
    const [error, setError] = useState('');

    const handleAddLocation = async (e) => {
        e.preventDefault();
        if (!newLocationName.trim()) {
            setError('Location name cannot be empty.');
            return;
        }

        setAppProcessing(true, 'Adding location...');
        setError('');
        try {
            await addLocation({ name: newLocationName });
            setNewLocationName(''); // Clear input on success
        } catch (err) {
            console.error("Failed to add location:", err);
            setError(err.message); // Show error from the context
        } finally {
            setAppProcessing(false);
        }
    };

    const handleDeleteLocation = async (locationId) => {
        if (window.confirm('Are you sure you want to delete this location? This cannot be undone.')) {
            setAppProcessing(true, 'Deleting location...');
            try {
                await deleteLocation(locationId);
            } catch (err) {
                console.error("Failed to delete location:", err);
                alert(`Error: ${err.message}`);
            } finally {
                setAppProcessing(false);
            }
        }
    };

    return (
        <div className="card">
            <div className="p-6">
                <h3 className="section-title">Manage Locations</h3>
                <p className="text-sm text-gray-600 mb-4">These locations appear in the "Point of Contact" dropdown on the customer form.</p>

                {/* Add Location Form */}
                <form onSubmit={handleAddLocation} className="flex items-start gap-2 mb-4">
                    <div className="grow">
                        <input 
                            type="text"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            placeholder="Enter new location name"
                            className="input-base"
                        />
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>
                    <button type="submit" className="btn btn-secondary">
                        <Plus size={16} className="mr-1"/> Add Location
                    </button>
                </form>

                {/* Location List */}
                <div className="mt-4 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location Name</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr><td colSpan="2" className="text-center py-4">Loading...</td></tr>
                            ) : locations.length > 0 ? (
                                locations.map(location => (
                                    <tr key={location.id}>
                                        <td className="px-4 py-3 font-medium">{location.name}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => handleDeleteLocation(location.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="2" className="text-center py-4 text-gray-500">No locations added yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LocationsManagement;
