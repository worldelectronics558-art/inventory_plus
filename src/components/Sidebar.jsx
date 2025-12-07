
// src/components/Sidebar.jsx

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUser } from '../contexts/UserContext.jsx';
import { Cloud, CloudOff, ChevronRight, LayoutDashboard, Package, Warehouse, Users, Settings, LogOut, X, History, ShoppingCart, Truck } from 'lucide-react';

const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, route: '/' },
    { name: 'Products', icon: Package, route: '/products', permission: 'canViewProducts' },
    { name: 'Inventory', icon: Warehouse, route: '/inventory', permission: 'canViewInventory' },
    { name: 'Purchase', icon: ShoppingCart, route: '/purchase', permission: 'canViewPurchasing' },
    { name: 'Sales', icon: ShoppingCart, route: '/sales', permission: 'canViewSales' },
    { name: 'Suppliers', icon: Users, route: '/suppliers', permission: 'canViewPurchasing' },
    { name: 'Customers', icon: Users, route: '/customers', permission: 'canViewCustomers' },
    { name: 'History', icon: History, route: '/history' },
    { name: 'Settings', icon: Settings, route: './settings' },
];

const Sidebar = ({ isCollapsed, isDesktop, isMobileMenuOpen, onCloseMobileMenu }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const { userPermissions } = useUser();
    const { isOnline, isNetworkAvailable, goOnline, goOffline, signOut, isAuthenticated } = useAuth();
    const [connectionError, setConnectionError] = useState('');
    const [openSubmenu, setOpenSubmenu] = useState(null);

    const handleConnectionClick = async () => {
        if (!isAuthenticated) return;
        setConnectionError('');
        if (isOnline) {
            if (window.confirm("Are you sure you want to switch to OFFLINE mode?")) {
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
            onCloseMobileMenu();
        }
    };

    const toggleSubmenu = (itemName) => {
        setOpenSubmenu(openSubmenu === itemName ? null : itemName);
    };

    const navLinkClass = (route, isSub = false) => {
        const isActive = location.pathname === route || (route !== '/' && location.pathname.startsWith(route));
        const baseClasses = `sidebar-link ${isActive ? 'active' : ''} ${isSub ? 'pl-12' : ''}`;
        const displayClasses = (isDesktop && isCollapsed) ? 'justify-center w-12 mx-auto' : 'w-full';
        return `${baseClasses} ${displayClasses}`;
    };

    const sidebarClasses = `
        fixed top-0 left-0 h-full z-40 sidebar-gradient shadow-xl flex flex-col transition-transform duration-300 ease-in-out
        ${isDesktop ? (isCollapsed ? 'w-16' : 'w-64') : 'w-64'}
        ${isDesktop ? 'translate-x-0' : (isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full')}
    `;

    const finalIsCollapsed = isDesktop && isCollapsed;

    return (
        <>
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
                        <h1 className="text-xl font-bold text-white whitespace-nowrap">
                            <span className="text-white page-title !mb-0 !text-xl">InventoryPlus</span>
                        </h1>
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
                        {!finalIsCollapsed && <div>{isOnline ? 'Go Offline' : 'Go Online'}</div>}
                    </button>
                    {connectionError && !finalIsCollapsed && (
                        <div className="mx-2 my-2 p-2 bg-red-800/90 rounded-lg shadow-inner text-white text-xs">
                            <div className="flex justify-between items-center">
                                <button onClick={() => setConnectionError('')} className="text-gray-300 hover:text-white"><X size={14} /></button>
                                <span>{connectionError}</span>
                            </div>
                        </div>
                    )}
                </div>

                <nav className="sidebar-nav grow p-2">
                    {navItems.map((item) => {
                        if (item.permission && userPermissions && !userPermissions[item.permission]) {
                            return null;
                        }
                        
                        const Icon = item.icon;
                        if (item.subItems) {
                            const isSubmenuOpen = openSubmenu === item.name;
                            return (
                                <div key={item.name}>
                                    <button
                                        onClick={() => toggleSubmenu(item.name)}
                                        className={`sidebar-link w-full flex justify-between items-center mb-1 group relative ${navLinkClass(item.route)}`}
                                    >
                                        <div className="flex items-center">
                                            <Icon className={`w-5 h-5 ${!finalIsCollapsed ? 'mr-3' : ''}`} />
                                            {!finalIsCollapsed && <span>{item.name}</span>}
                                        </div>
                                        {!finalIsCollapsed && <ChevronRight className={`w-4 h-4 transition-transform ${isSubmenuOpen ? 'rotate-90' : ''}`} />}
                                    </button>
                                    {isSubmenuOpen && !finalIsCollapsed && (
                                        <div className="pl-4">
                                            {item.subItems.map(subItem => (
                                                <button
                                                    key={subItem.route}
                                                    onClick={() => handleNavigate(subItem.route)}
                                                    className={`${navLinkClass(subItem.route, true)} mb-1 w-full text-left`}
                                                >
                                                    {subItem.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <button
                                key={item.route}
                                onClick={() => handleNavigate(item.route)}
                                className={`${navLinkClass(item.route)} mb-1 group relative`}
                            >
                                <Icon className={`w-5 h-5 ${!finalIsCollapsed ? 'mr-3' : ''}`} />
                                {!finalIsCollapsed && <span>{item.name}</span>}
                                {finalIsCollapsed && (
                                    <span className="absolute left-full ml-4 whitespace-nowrap px-3 py-1 bg-gray-600 text-white text-sm rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
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
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
