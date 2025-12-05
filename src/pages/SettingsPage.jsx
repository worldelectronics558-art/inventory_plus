
// src/pages/SettingsPage.jsx

import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useLocations } from '../contexts/LocationContext';
import UserManagement from './SettingsSubPages/UserManagement';
import LocationsManagement from './SettingsSubPages/LocationsManagement'; // Import the new component

const SettingsPage = () => {
    const { isLoading: isUserLoading, userPermissions } = useUser();
    const { isLoading: isLocationsLoading } = useLocations();
    const [activeTab, setActiveTab] = useState('locations');

    if (isUserLoading || isLocationsLoading) {
        return <div className="p-8 text-xl text-center">Loading Settings Data...</div>;
    }

    const isAdmin = userPermissions.role === 'admin';

    return (
        <div className="page-container">
            <h1 className="page-title">Application Settings</h1>

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
                {/* Render the new, full-featured LocationsManagement component */}
                {activeTab === 'locations' && <LocationsManagement />}
                {activeTab === 'users' && isAdmin && <UserManagement />}
            </div>
        </div>
    );
};

export default SettingsPage;
