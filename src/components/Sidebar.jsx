// src/components/Sidebar.jsx

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// --- IMPORT CONTEXT HOOKS ---
import { useAuth } from '../contexts/AuthContext.jsx'; 
import { useUser } from '../contexts/UserContext.jsx'; 
// --- END: IMPORTS ---

// --- ICONS ---
import { Cloud, CloudOff, LayoutDashboard, Package, Warehouse, Users, Settings, LogOut, X } from 'lucide-react'; 
// NOTE: ChevronLeft removed as the toggle button is now in the Header
// --- END: ICONS ---

// Data structure for navigation items
const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, route: '/' },
    { name: 'Products', icon: Package, route: '/products', permission: 'canManageProducts' },
    { name: 'Inventory', icon: Warehouse, route: '/inventory', permission: 'canManageInventory' },
    { name: 'Users', icon: Users, route: '/users', permission: 'canManageUsers' }, 
    { name: 'Settings', icon: Settings, route: '/settings' },
];

/**
 * Renders the main application sidebar with navigation and connection status.
 *
 * @param {object} props
 * @param {boolean} props.isCollapsed - Whether the sidebar is collapsed (icons only).
 * @param {function} props.toggleSidebar - Function to toggle the collapse state.
 */
const Sidebar = ({ isCollapsed, toggleSidebar }) => { 
    const navigate = useNavigate();
    const location = useLocation();

    // --- GET DATA FROM CONTEXTS ---
    const { user: currentUser, userPermissions, assignedLocations: rawAssignedLocations } = useUser(); 
    const { isOnline, userId, goOnline, goOffline, signOut, isAuthenticated } = useAuth(); 
    // --- END: GET CONTEXT DATA ---

    const assignedLocations = rawAssignedLocations || [];

    // --- STATE FOR RECONNECT FORM ---
    const [showReconnectForm, setShowReconnectForm] = useState(false);
    const [reconnectEmail, setReconnectEmail] = useState('');
    const [reconnectPassword, setReconnectPassword] = useState('');
    const [reconnectError, setReconnectError] = useState('');
    // --- END: STATE ---

    // --- HANDLE CONNECTION BUTTON CLICK ---
    const handleConnectionClick = () => {
        if (!isAuthenticated) return;

        if (isOnline) {
            const confirmation = window.confirm("Are you sure you want to switch to OFFLINE mode? This will stop live sync.");
            if (confirmation) {
                goOffline(); 
            }
        } else {
            if (!isCollapsed) { 
                setShowReconnectForm(true);
            } else {
                setShowReconnectForm(true); 
            }
            setReconnectError('');
        }
    };
    // --- END: HANDLER ---

    // --- HANDLE RECONNECT FORM SUBMISSION ---
    const handleReconnectSubmit = async (e) => {
        e.preventDefault();
        setReconnectError('');

        if (!reconnectEmail.trim() || !reconnectPassword.trim()) {
             setReconnectError("Email and Password are required.");
             return;
        }

        try {
            await goOnline(reconnectEmail.trim(), reconnectPassword.trim()); 
            console.log("Successfully reconnected!");
            setShowReconnectForm(false);
            setReconnectEmail('');
            setReconnectPassword('');
            setReconnectError(''); 
        } catch (error) {
            setReconnectError(error.message); 
        }
    };
    // --- END: HANDLER ---

    // --- CALCULATE ACTIVE NAV LINK CLASS ---
    const navLinkClass = (route) => {
        const isActive = location.pathname === route ||
                         (route === '/' && location.pathname === '/dashboard');

        // Preserve original classes, add collapse adjustments
        const baseClasses = `sidebar-link ${isActive ? 'active' : ''}`;
        
        // Add classes for centering/width when collapsed
        const collapseClasses = isCollapsed ? 'justify-center w-12 mx-auto' : 'w-full';

        return `${baseClasses} ${collapseClasses}`;
    };
    // --- END: LOGIC ---

    return (
        // 1. Sidebar Container: Apply fixed position and change width based on state
        <div className={`fixed top-0 left-0 h-full z-20 bg-gray-900 shadow-xl flex flex-col transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} sidebar`}> 
            
            {/* 2. Header / Title Section: Removed the toggle button */}
            <div className="flex items-center justify-start h-16 px-4 border-b border-gray-700 sidebar-header"> 
                {/* Logo/Title */}
                {isCollapsed ? (
                    // COLLAPSED: Display the logo
                    <img 
                        src="/src/assets/logo.svg" // Path provided by the user
                        alt="InventoryPlus Logo" 
                        className="w-8 h-8 rounded-full" 
                        // Fallback to a placeholder icon
                        onError={(e) => {
                            e.target.onerror = null; 
                            e.target.style.backgroundColor = '#4f46e5'; 
                            e.target.style.display = 'block';
                            e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M12 2L2 22h20L12 2zm0 18l-5-10h10l-5 10z"/></svg>';
                        }}
                    />
                ) : (
                    // EXPANDED: Full Title
                    <h1 className="text-xl font-bold text-white whitespace-nowrap">InventoryPlus</h1>
                )}
                
                {/* REMOVED: Collapse Button */}
            </div>

            {/* 3. User Info Section - HIDE WHEN COLLAPSED - DELETED*/}
            

            {/* 4. Network Status BUTTON */}
            <div className={`p-2 ${isCollapsed ? 'px-1' : ''}`}> {/* Adjust padding when collapsed */}
                <button
                    onClick={handleConnectionClick}
                    disabled={!isAuthenticated}
                    className={`flex items-center w-full py-3 text-sm rounded-lg transition-all duration-300 font-semibold text-white
                        ${isOnline ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                        ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}` // <-- COLLAPSE ADJUSTMENTS
                    }
                >
                    <div className="flex items-center">
                        {isOnline
                            ? <Cloud className="w-4 h-4" /> 
                            : <CloudOff className="w-4 h-4" />}
                        {!isCollapsed && <span className='ml-2'>Status: {isOnline ? 'Online' : 'Offline'}</span>} {/* <-- HIDE TEXT */}
                    </div>
                    {!isCollapsed && <div>{isOnline ? 'Go Offline' : 'Go Online'}</div>} {/* <-- HIDE TEXT */}
                </button>
            </div>

            {/* 5. INLINE RECONNECT FORM - HIDE COMPLETELY WHEN COLLAPSED */}
            {showReconnectForm && !isOnline && !isCollapsed && ( // <-- CHECK isCollapsed
                <div className="mx-2 mb-2 p-3 bg-indigo-900/80 rounded-lg shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-semibold text-white">Connect to Server</p>
                        <button onClick={() => setShowReconnectForm(false)} className="text-gray-300 hover:text-white">
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
                            className="input-base w-full" 
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={reconnectPassword}
                            onChange={(e) => setReconnectPassword(e.target.value)}
                            required
                            className="input-base w-full" 
                        />
                        <button
                            type="submit"
                            className="btn btn-accent w-full" 
                        >
                            Connect
                        </button>
                    </form>

                    {reconnectError && (
                        <p className="error-message mt-2"> 
                            Error: {reconnectError}
                        </p>
                    )}
                </div>
            )}

            {/* 6. Navigation Links */}
            <nav className="sidebar-nav grow p-2">
                {navItems.map((item) => {
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
                            className={`${navLinkClass(item.route)} mb-1 group relative`} // Added group/relative for tooltip
                        >
                            {/* Icon placement adjustment */}
                            <Icon className={`w-5 h-5 ${!isCollapsed ? 'mr-3' : ''}`} /> 
                            {!isCollapsed && <span>{item.name}</span>} {/* <-- HIDE TEXT */}

                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                                <span className="absolute left-full ml-4 whitespace-nowrap px-3 py-1 bg-gray-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                    {item.name}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* 7. Footer Section (Sign Out) */}
            <div className={`sidebar-footer mt-auto p-2 ${isCollapsed ? 'px-1' : ''}`}>
                {isAuthenticated ? ( 
                    <button
                        onClick={signOut}
                        // Preserve original button classes. Change justification/padding for collapse.
                        className={`btn btn-danger w-full py-3 text-sm font-medium ${isCollapsed ? 'justify-center' : 'flex px-4'}`}
                    >
                        <LogOut className={`w-5 h-5 ${!isCollapsed ? 'mr-3' : ''}`} />
                        {!isCollapsed && <span>Sign Out</span>}
                        {isCollapsed && ( // Tooltip for collapsed Sign Out
                             <span className="absolute left-full ml-4 whitespace-nowrap px-3 py-1 bg-gray-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                Sign Out
                            </span>
                        )}
                    </button>
                ) : (
                    null
                )}
            </div>
        </div>
    );
};

export default Sidebar;