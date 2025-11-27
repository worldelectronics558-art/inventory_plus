// src/components/Sidebar.jsx

import React, { useState } from 'react'; // <-- NEW: Import useState
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx'; 
import { useUser } from '../contexts/UserContext.jsx'; 
import { Cloud, CloudOff, Home, Package, Truck, Settings, LogOut, X } from 'lucide-react'; 

// Data structure for navigation items (unchanged)
const navItems = [
    { name: 'Dashboard', icon: Home, route: '/' }, 
    { name: 'Products', icon: Package, route: '/products', permission: 'canManageProducts' },
    { name: 'Inventory', icon: Truck, route: '/inventory', permission: 'canManageInventory' },
    { name: 'Settings', icon: Settings, route: '/settings' },
];

/**
 * Renders the main application sidebar with navigation and explicit connection button/form.
 */
const Sidebar = () => { // Removed setShowConnectionModal prop
    // React Router Hooks
    const navigate = useNavigate();
    const location = useLocation();

    // Context Hooks
    const { userPermissions, currentUser } = useUser(); 
    const { 
        isOnline, 
        goOnline, // We need this function to call with credentials
        goOffline, 
        signOut, 
        isAuthenticated, 
        userId 
    } = useAuth();

    // Local State for the inline reconnect form
    const [showReconnectForm, setShowReconnectForm] = useState(false);
    const [reconnectEmail, setReconnectEmail] = useState('');
    const [reconnectPassword, setReconnectPassword] = useState('');
    const [reconnectError, setReconnectError] = useState('');
    
    // --- Connection Button Handler ---
    const handleConnectionClick = () => {
        if (!isAuthenticated) return; 

        if (isOnline) {
            // CONFIRMATION STEP: Ask user before disconnecting
            const confirmation = window.confirm("Are you sure you want to switch to OFFLINE mode? This will stop live sync.");
            if (confirmation) {
                goOffline();
            }
        } else {
            // GO ONLINE: Show the inline form
            setShowReconnectForm(true);
            setReconnectError(''); // Clear previous error
        }
    };

    // --- Form Submission Handler ---
    const handleReconnectSubmit = async (e) => {
        e.preventDefault();
        setReconnectError('');

        try {
            await goOnline(reconnectEmail, reconnectPassword);
            // Success: Close the form and clear fields
            setShowReconnectForm(false);
            setReconnectEmail('');
            setReconnectPassword('');
            // Optional: Show a success message briefly
            console.log("Successfully reconnected!");
        } catch (error) {
            // Failure: Show error message
            setReconnectError(error.message);
        }
    };
    // -----------------------------
    
    const navLinkClass = (route) => {
        const isActive = location.pathname === route || 
                         (route === '/' && location.pathname === '/dashboard');
        
        return (
            `flex items-center p-3 rounded-lg w-full text-left transition-colors font-medium
             ${isActive 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
        );
    };

    return (
        <div className="w-64 fixed top-0 left-0 h-full bg-gray-800 p-4 shadow-2xl z-20 flex flex-col">
            
            {/* Header / Logo (unchanged) */}
            <div className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-4">
                Inventory Pro
            </div>
            
            {/* Network Status BUTTON */}
            <button
                onClick={handleConnectionClick} 
                disabled={!isAuthenticated}
                className={`flex justify-between items-center p-3 text-sm rounded-lg w-full transition-all duration-300 font-semibold text-white 
                    ${isOnline ? 'bg-green-700 hover:bg-green-600' : 'bg-red-700 hover:bg-red-600'}
                    ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <div className="flex items-center">
                    {isOnline 
                        ? <Cloud className="w-4 h-4 mr-2 text-green-200" /> 
                        : <CloudOff className="w-4 h-4 mr-2 text-red-200" />}
                    Status: {isOnline ? 'Online' : 'Offline'}
                </div>
                <div>{isOnline ? 'Go Offline' : 'Go Online'}</div>
            </button>

            {/* INLINE RECONNECT FORM */}
            {showReconnectForm && !isOnline && (
                <div className="mt-4 p-3 bg-gray-700 rounded-lg shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-semibold text-white">Connect to Server</p>
                        <button onClick={() => setShowReconnectForm(false)} className="text-gray-400 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleReconnectSubmit} className="space-y-2">
                        <input
                            type="email"
                            placeholder="Email"
                            value={reconnectEmail}
                            onChange={(e) => setReconnectEmail(e.target.value)}
                            required
                            className="w-full p-2 text-sm rounded bg-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={reconnectPassword}
                            onChange={(e) => setReconnectPassword(e.target.value)}
                            required
                            className="w-full p-2 text-sm rounded bg-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            className="w-full p-2 text-sm font-bold rounded bg-blue-600 text-white hover:bg-blue-700 transition duration-150"
                        >
                            Connect
                        </button>
                    </form>
                    
                    {reconnectError && (
                        <p className="text-xs text-red-400 mt-2 break-words">Error: {reconnectError}</p>
                    )}
                </div>
            )}

            {/* Rest of the Sidebar */}
            {!isAuthenticated && (
                <p className="text-xs text-center text-red-300 mt-4">Log in to manage inventory.</p>
            )}

            <nav className="space-y-2 flex-grow mt-4">
                {/* ... Navigation mapping remains the same ... */}
                {navItems.map((item) => {
                    // ... (Navigation logic remains the same)
                    if (item.permission && !userPermissions[item.permission]) {
                        return null;
                    }
                    if (item.route !== '/' && !isAuthenticated) { 
                        return null;
                    }
                    
                    const Icon = item.icon;
                    
                    return (
                        <button
                            key={item.route}
                            onClick={() => navigate(item.route)} 
                            className={navLinkClass(item.route)}
                        >
                            <Icon className="w-5 h-5 mr-3" />
                            <span>{item.name}</span>
                        </button>
                    );
                })}
            </nav>
            
            {/* Settings/Logout Area - pinned to the bottom */}
            <div className="pt-4 mt-6 border-t border-gray-700">
                {isAuthenticated && (
                    <div className="text-sm text-gray-400 mb-4 p-1">
                        Logged in as: 
                        <p className="text-sm font-mono truncate text-white mt-1 pl-1">
                            {currentUser ? `[${userPermissions.role}] ${userId}` : 'Authenticated'}
                        </p>
                    </div>
                )}
                
                {isAuthenticated && (
                    <button
                        onClick={signOut} 
                        className="flex items-center p-3 rounded-lg w-full text-left text-red-300 bg-gray-700 hover:bg-red-700 hover:text-white transition-colors font-medium shadow-md"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        <span>Sign Out</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default Sidebar;