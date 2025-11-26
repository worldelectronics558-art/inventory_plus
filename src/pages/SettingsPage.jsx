// src/pages/SettingsPage.jsx

// ===== UPDATE IMPORTS =====
import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext'; // Import useUser to get current user profile and permissions
import { useLocations } from '../contexts/LocationContext'; // NEW: Import useLocations to get all locations
// =========================

// --- Location Management Component (Uses LocationContext data) ---
const LocationManagement = () => { // Remove 'locations' prop as it now comes from the context
    const { locations: allLocations, isLoading: isLocationsLoading } = useLocations(); // Get locations from LocationContext

    if (isLocationsLoading) {
        return <div className="p-6 text-center">Loading Locations...</div>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Location Management 🏢</h3>
            <p className="text-gray-600 mb-4">Define and manage all physical inventory locations.</p>

            {/* TODO: Add 'Add New Location' Button/Modal */}
            {/* Example placeholder for add button */}
            {/* <button className="btn btn-primary mb-4">+ Add New Location</button> */}

            <div className="space-y-3">
                {allLocations.length > 0 ? ( // Use allLocations from context
                    allLocations.map(loc => (
                        <div key={loc.id} className="p-3 border rounded-lg flex justify-between items-center bg-gray-50 hover:bg-gray-100">
                            <span className="font-medium">{loc.name} {loc.isDefault && '(Default)'}</span>
                            <span className={`text-sm font-medium px-2 py-1 rounded-full ${loc.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {loc.status || 'Active'} {/* Assume 'Active' if status is not defined */}
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

// --- User Management Component (Uses UserContext data) ---
const UserManagement = () => { // Remove props as it gets data from context
    const { user: currentUserProfile, assignedLocations: rawAssignedLocations } = useUser(); // Get current user profile and their assigned locations
    const { locations: allLocations } = useLocations(); // Get all locations from LocationContext

    // Ensure assignedLocations is always an array
    const assignedLocations = rawAssignedLocations || [];

    // Find the name of the assigned location for display
    // This assumes 'assignedLocations' in UserContext contains the *names* of the locations.
    // If it contains IDs, you'd need to match against loc.id instead of loc.name.
    const assignedLocationNames = assignedLocations
        .map(assignedName => {
            const loc = allLocations.find(loc => loc.name === assignedName); // Match by name
            return loc ? loc.name : assignedName; // Return name if found, otherwise return the assignedName (in case it's an ID or not found)
        })
        .filter(name => name !== undefined); // Filter out undefined names if loc wasn't found

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">User Management 👥</h3>
            <p className="text-gray-600 mb-4">Configure user roles and assign their default transaction location.</p>

            {currentUserProfile ? (
                <div className="border p-4 rounded-lg bg-blue-50 text-blue-800 mb-4">
                    <p className="font-semibold">Current User:</p>
                    <p>Name: <strong>{currentUserProfile.displayName || currentUserProfile.email || 'N/A'}</strong></p>
                    <p>Email: <strong>{currentUserProfile.email || 'N/A'}</strong></p>
                    <p>Role: <strong>{currentUserProfile.role || 'N/A'}</strong></p>
                    <p>Assigned Locations: <strong>{assignedLocationNames.join(', ') || 'N/A'}</strong></p>
                </div>
            ) : (
                <div className="border p-4 rounded-lg bg-red-50 text-red-800 mb-4">
                    <p className="font-semibold">Error:</p>
                    <p>Current user profile could not be loaded.</p>
                </div>
            )}

            {/* TODO: Add a table/list of all users and controls */}
            <p className="text-gray-500">User list and management controls implementation coming next...</p>
        </div>
    );
};

const SettingsPage = () => {
    // Get data from UserContext (current user profile, permissions)
    const { isLoading: isUserLoading, userPermissions } = useUser();
    // Get loading state from LocationContext if needed separately, otherwise rely on its internal loading
    const { isLoading: isLocationsLoading } = useLocations(); // NEW: Get location loading state if needed for overall page loading indicator

    const [activeTab, setActiveTab] = useState('locations'); // 'locations' or 'users'

    // Overall loading check: Wait for both User and Location contexts if necessary
    if (isUserLoading || isLocationsLoading) { // Check loading states from both contexts
        return <div className="p-8 text-xl text-center">Loading Settings Data...</div>;
    }

    // Safety check: Only Admins can see the Settings Page (uncomment if needed later)
    // if (!userPermissions.isAdmin) {
    //    return <div className="p-8 text-xl text-center text-red-600">Access Denied. Only Admins can view settings.</div>;
    // }

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Application Settings (UNDER DEVELOPMENT)</h1>

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
                {activeTab === 'locations' && <LocationManagement />} {/* No props needed, gets data from LocationContext */}
                {activeTab === 'users' && <UserManagement />} {/* No props needed, gets data from UserContext and LocationContext */}
            </div>
        </div>
    );
};

export default SettingsPage;