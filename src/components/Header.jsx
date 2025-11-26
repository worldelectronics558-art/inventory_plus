import React from 'react';
import { Menu, X, ChevronsRight, ChevronsLeft } from 'lucide-react'; 
// Import context hooks to access user state and sign out function
import { useAuth } from '../contexts/AuthContext.jsx'; 
import { useUser } from '../contexts/UserContext.jsx'; 

/**
 * Renders the permanent application header.
 * * @param {object} props
 * @param {boolean} props.isSidebarCollapsed - The current collapse state of the sidebar.
 * @param {function} props.toggleSidebar - Function to toggle the sidebar's state.
 */
const Header = ({ isSidebarCollapsed, toggleSidebar }) => {
    // Get user data and auth status from contexts
    const { user: currentUserProfile } = useUser();
    // Get the core Firebase user object and auth status
    const { isAuthenticated, userId, user: firebaseUser } = useAuth(); 

    // FIX: Define userEmail here so it is available in the JSX below.
    // Determine the email to display: prioritize the profile email, then the firebase user email, then fall back to userId
    const userEmail = currentUserProfile?.email || firebaseUser?.email || userId;
    
    // Determine the left padding based on sidebar state (w-64 or w-16)
    const sidebarWidthClass = isSidebarCollapsed ? 'md:pl-16' : 'md:pl-64'; 

    return (
        // Changed bg-gray-800 to bg-primary-900 for theme consistency
        <header className={`fixed top-0 left-0 right-0 z-10 h-16 bg-primary-900 shadow-md flex items-center justify-between transition-all duration-300 ${sidebarWidthClass}`}>
            
            {/* Left side: Sidebar Toggle Button */}
            <div className="flex items-center space-x-4">
                <button 
                    onClick={toggleSidebar} 
                    className="p-2 ml-4 text-secondary-700 rounded-md hover:bg-secondary-700/20 focus:outline-none focus:ring-2 focus:ring-secondary-700 transition-colors"
                    aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {/* Icons remain white for contrast against the dark background */}
                    {isSidebarCollapsed 
                        ? <ChevronsRight className="w-6 h-6 text-white" /> 
                        : <ChevronsLeft className="w-6 h-6 text-white" />
                    }
                </button>
            </div>

            {/* Right side: User Info (Sign Out button removed) */}
            <div className="flex items-center space-x-4 pr-4">
                
                {isAuthenticated ? (
                    // We are authenticated, so show the user information
                    <div className="text-right sm:block"> 
                        <p className="text-xs text-gray-300">Signed in as:</p>
                        {/* Use the dynamically determined userEmail */}
                        <p title={userEmail} className="font-mono text-sm text-action-500 truncate max-w-[150px]">{userEmail}</p>
                    </div>
                ) : (
                    // Display status when not authenticated
                    <span className="text-sm text-gray-300 sm:block">Not Signed In</span>
                )}

            </div>
        </header>
    );
};

export default Header;