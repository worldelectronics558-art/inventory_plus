// src/components/Sidebar.jsx

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUser } from '../contexts/UserContext.jsx';
import { Cloud, CloudOff, LayoutDashboard, Package, Warehouse, Users, Settings, LogOut, X, History } from 'lucide-react';

const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, route: '/' },
    { name: 'Products', icon: Package, route: '/products', permission: 'canViewProducts' },
    { name: 'Inventory', icon: Warehouse, route: '/inventory', permission: 'canViewInventory' },
    { name: 'History', icon: History, route: '/history' },
    { name: 'Settings', icon: Settings, route: '/settings' },
];

/**
 * Renders the responsive main application sidebar.
 *
 * @param {object} props
 * @param {boolean} props.isCollapsed - Whether the sidebar is collapsed on desktop.
 * @param {boolean} props.isDesktop - Whether the view is currently desktop size.
 * @param {boolean} props.isMobileMenuOpen - Whether the sidebar should be visible on mobile.
 * @param {function} props.onCloseMobileMenu - Function to close the mobile menu.
 */
const Sidebar = ({ isCollapsed, isDesktop, isMobileMenuOpen, onCloseMobileMenu }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const { userPermissions } = useUser();
    const { isOnline, isNetworkAvailable, goOnline, goOffline, signOut, isAuthenticated } = useAuth();
    const [connectionError, setConnectionError] = useState('');

    const handleConnectionClick = async () => {
        if (!isAuthenticated) return;
        setConnectionError('');
        if (isOnline) {
            if (window.confirm("Are you sure you want to switch to OFFLINE mode? This will stop live sync.")) {
                goOffline();
            }
        } else {
            if (isNetworkAvailable) {
                try { await goOnline(); } catch (error) { setConnectionError(error.message); }
            } else {
                setConnectionError("No network connection available.");
            }
        }
    };

    const handleNavigate = (route) => {
        navigate(route);
        if (!isDesktop) {
            onCloseMobileMenu(); // Close mobile menu on navigation
        }
    };

    const navLinkClass = (route) => {
        const isActive = location.pathname === route || (route === '/' && location.pathname === '/dashboard');
        const baseClasses = `sidebar-link ${isActive ? 'active' : ''}`;
        // On mobile, the sidebar is never collapsed, so we don't need collapsed styles.
        const displayClasses = (isDesktop && isCollapsed) ? 'justify-center w-12 mx-auto' : 'w-full';
        return `${baseClasses} ${displayClasses}`;
    };

    // Determine sidebar visibility and style based on screen size and state
    const sidebarClasses = `
        fixed top-0 left-0 h-full z-40 bg-gray-900 shadow-xl flex flex-col transition-transform duration-300 ease-in-out
        ${isDesktop ? (isCollapsed ? 'w-16' : 'w-64') : 'w-64'}
        ${isDesktop ? 'translate-x-0' : (isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full')}
    `;

    // Use a ternary for the final collapsed state to ensure mobile is never collapsed
    const finalIsCollapsed = isDesktop && isCollapsed;

    return (
        <>
            {/* Backdrop for mobile */} 
            {!isDesktop && isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-30" 
                    onClick={onCloseMobileMenu} 
                    aria-hidden="true"
                ></div>
            )}

            <div className={sidebarClasses} role="menu">
                <div className="flex items-center justify-start h-16 px-4 border-b border-gray-700 sidebar-header">
                    {finalIsCollapsed ? (
                        <img src="/src/assets/logo.svg" alt="Logo" className="w-8 h-8 rounded-full" />
                    ) : (
                        <h1 className="text-xl font-bold text-white whitespace-nowrap">InventoryPlus</h1>
                    )}
                </div>

                <div className={`p-2 ${finalIsCollapsed ? 'px-1' : ''}`}>
                    <button
                        onClick={handleConnectionClick}
                        disabled={!isAuthenticated}
                        className={`flex items-center w-full py-3 text-sm rounded-lg transition-all duration-300 font-semibold text-white
                            ${isOnline ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                            ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            ${finalIsCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}
                    >
                        <div className="flex items-center">
                            {isOnline ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
                            {!finalIsCollapsed && <span className='ml-2'>Status: {isOnline ? 'Online' : 'Offline'}</span>}
                        </div>
                        {!finalIsCollapsed && <div>{isOnline ? 'Go Offline' : (isNetworkAvailable ? 'Go Online' : 'Offline')}</div>}
                    </button>
                    {connectionError && !finalIsCollapsed && (
                        <div className="mx-2 my-2 p-2 bg-red-800/90 rounded-lg shadow-inner text-white text-xs">
                            <div className="flex justify-between items-center">
                                <span>{connectionError}</span>
                                <button onClick={() => setConnectionError('')} className="text-gray-300 hover:text-white"><X size={14} /></button>
                            </div>
                        </div>
                    )}
                </div>

                <nav className="sidebar-nav grow p-2">
                    {navItems.map((item) => {
                        if (item.permission && !userPermissions[item.permission]) return null;

                        const Icon = item.icon;
                        return (
                            <button
                                key={item.route}
                                onClick={() => handleNavigate(item.route)}
                                className={`${navLinkClass(item.route)} mb-1 group relative`}
                            >
                                <Icon className={`w-5 h-5 ${!finalIsCollapsed ? 'mr-3' : ''}`} />
                                {!finalIsCollapsed && <span>{item.name}</span>}
                                {finalIsCollapsed && (
                                    <span className="absolute left-full ml-4 whitespace-nowrap px-3 py-1 bg-gray-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                        {item.name}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className={`sidebar-footer mt-auto p-2 ${finalIsCollapsed ? 'px-1' : ''}`}>
                    {isAuthenticated && (
                        <button
                            onClick={signOut}
                            className={`btn btn-danger w-full py-3 text-sm font-medium ${finalIsCollapsed ? 'justify-center' : 'flex px-4'}`}
                        >
                            <LogOut className={`w-5 h-5 ${!finalIsCollapsed ? 'mr-3' : ''}`} />
                            {!finalIsCollapsed && <span>Sign Out</span>}
                            {finalIsCollapsed && (
                                <span className="absolute left-full ml-4 whitespace-nowrap px-3 py-1 bg-gray-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                    Sign Out
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
