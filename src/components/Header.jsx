import React from 'react';
import { Menu, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUser } from '../contexts/UserContext.jsx';

/**
 * Renders the main application header.
 * @param {object} props
 * @param {boolean} props.isSidebarCollapsed - The current collapse state of the sidebar.
 * @param {boolean} props.isDesktop - Whether the current view is desktop size.
 * @param {function} props.onToggleCollapse - Function to toggle the sidebar's collapse state on desktop.
 * @param {function} props.onOpenMobileMenu - Function to open the sidebar drawer on mobile.
 */
const Header = ({ isSidebarCollapsed, isDesktop, onToggleCollapse, onOpenMobileMenu }) => {
    const { currentUser: currentUserProfile } = useUser();
    const { isAuthenticated, userId } = useAuth();

    const userDisplayName = currentUserProfile?.displayName || currentUserProfile?.email || userId;

    // Determine the left padding based on sidebar state on desktop only
    const sidebarWidthClass = isDesktop ? (isSidebarCollapsed ? 'md:pl-16' : 'md:pl-64') : 'pl-0';

    const handleToggleClick = () => {
        if (isDesktop) {
            onToggleCollapse();
        } else {
            onOpenMobileMenu();
        }
    };

    const getToggleIcon = () => {
        if (!isDesktop) {
            return <Menu className="w-6 h-6 text-white" />;
        }
        return isSidebarCollapsed
            ? <ChevronsRight className="w-6 h-6 text-white" />
            : <ChevronsLeft className="w-6 h-6 text-white" />;
    };

    return (
        <header className={`fixed top-0 left-0 right-0 z-30 h-16 bg-primary-900 shadow-md flex items-center justify-between transition-all duration-300 ${sidebarWidthClass}`}>
            <div className="flex items-center space-x-4">
                <button 
                    onClick={handleToggleClick}
                    className="p-2 ml-4 text-secondary-700 rounded-md hover:bg-secondary-700/20 focus:outline-none focus:ring-2 focus:ring-secondary-700 transition-colors"
                    aria-label={isDesktop ? (isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar") : "Open Menu"}
                >
                    {getToggleIcon()}
                </button>
            </div>

            <div className="flex items-center space-x-4 pr-4">
                {isAuthenticated ? (
                    <div className="text-right sm:block">
                        <p className="text-xs text-gray-300">Signed in as:</p>
                        <p title={userDisplayName} className="font-mono text-sm text-action-500 truncate max-w-[150px]">{userDisplayName}</p>
                    </div>
                ) : (
                    <span className="text-sm text-gray-300 sm:block">Not Signed In</span>
                )}
            </div>
        </header>
    );
};

export default Header;
