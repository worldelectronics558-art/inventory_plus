// src/pages/SettingsPage.jsx

import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useLocations } from '../contexts/LocationContext';
import UserManagement from './SettingsSubPages/UserManagement';

const LocationManagement = () => {
    const { locations: allLocations, isLoading: isLocationsLoading } = useLocations();

    if (isLocationsLoading) {
        return <div className="p-6 text-center">Loading Locations...</div>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Location Management 🏢</h3>
            <p className="text-gray-600 mb-4">Define and manage all physical inventory locations.</p>
            <div className="space-y-3">
                {allLocations.length > 0 ? (
                    allLocations.map(loc => (
                        <div key={loc.id} className="p-3 border rounded-lg flex justify-between items-center bg-gray-50 hover:bg-gray-100">
                            <span className="font-medium">{loc.name} {loc.isDefault && '(Default)'}</span>
                            <span className={`text-sm font-medium px-2 py-1 rounded-full ${loc.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {loc.status || 'Active'}
                            </span>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500">No locations found. Start by adding a new one.</p>
                )}
            </div>
        </div>
    );
};

const SettingsPage = () => {
    const { isLoading: isUserLoading, userPermissions } = useUser();
    const { isLoading: isLocationsLoading } = useLocations();
    const [activeTab, setActiveTab] = useState('locations');

    if (isUserLoading || isLocationsLoading) {
        return <div className="p-8 text-xl text-center">Loading Settings Data...</div>;
    }

    const isAdmin = userPermissions.role === 'admin';

    return (
        <div className="bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Application Settings</h1>

            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('locations')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'locations'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Locations
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'users'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            User Management
                        </button>
                    )}
                </nav>
            </div>

            <div>
                {activeTab === 'locations' && <LocationManagement />}
                {activeTab === 'users' && isAdmin && <UserManagement />}
            </div>
        </div>
    );
};

export default SettingsPage;
