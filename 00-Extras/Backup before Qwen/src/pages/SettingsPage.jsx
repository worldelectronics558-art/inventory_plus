// src/pages/SettingsPage.jsx
import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

// Dummy component for Location Management
const LocationManagement = ({ locations }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Location Management 🏢</h3>
            <p className="text-gray-600 mb-4">Define and manage all physical inventory locations.</p>
            
            {/* TODO: Add 'Add New Location' Button/Modal */}

            <div className="space-y-3">
                {locations.length > 0 ? (
                    locations.map(loc => (
                        <div key={loc.id} className="p-3 border rounded-lg flex justify-between items-center bg-gray-50 hover:bg-gray-100">
                            <span className="font-medium">{loc.name} {loc.isDefault && '(Default)'}</span>
                            <span className={`text-sm font-medium px-2 py-1 rounded-full ${loc.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {loc.status}
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

// Dummy component for User Management
const UserManagement = ({ userProfile, locations }) => {
    const assignedLocationName = locations.find(loc => loc.id === userProfile?.assignedLocationId)?.name || 'N/A';
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">User Management 👥</h3>
            <p className="text-gray-600 mb-4">Configure user roles and assign their default transaction location.</p>
            
            <div className="border p-4 rounded-lg bg-yellow-50 text-yellow-800 mb-4">
                <p className="font-semibold">Current User (Mock):</p>
                <p>Role: **{userProfile?.role}**</p>
                <p>Assigned Location: **{assignedLocationName}**</p>
            </div>

            {/* TODO: Add a table/list of all users and controls */}
            <p className="text-gray-500">User table implementation coming next...</p>
        </div>
    );
};


const SettingsPage = () => {
    const { locations, userProfile, isLoading, userPermissions } = useUser();
    const [activeTab, setActiveTab] = useState('locations'); // 'locations' or 'users'

    if (isLoading) {
        return <div className="p-8 text-xl text-center">Loading Settings Data...</div>;
    }
    
    // Safety check: Only Admins can see the Settings Page
    if (!userPermissions.isAdmin) {
        return <div className="p-8 text-xl text-center text-red-600">Access Denied. Only Admins can view settings.</div>;
    }

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Application Settings</h1>
            
            {/* Tab Navigation */}
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
                </nav>
            </div>

            {/* Content Area */}
            <div>
                {activeTab === 'locations' && <LocationManagement locations={locations} />}
                {activeTab === 'users' && <UserManagement userProfile={userProfile} locations={locations} />}
            </div>

        </div>
    );
};

export default SettingsPage;