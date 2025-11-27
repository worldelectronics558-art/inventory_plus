import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';

// Providers
import { useAuth } from './contexts/AuthContext.jsx'; 
import { useUser } from './contexts/UserContext.jsx'; 
import { useProducts } from './contexts/ProductContext.jsx';
import { useInventory } from './contexts/InventoryContext.jsx'; 

// Components & Pages 
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx'; 

// Placeholder Pages for now
const ReportsPage = () => <div className="p-8">Placeholder for Reports</div>;

// Component to handle conditional rendering based on authentication
const AppContent = () => {
    const [showConnectionModal, setShowConnectionModal] = useState(false);

    // Get auth status
    const { 
        isAuthenticated: isAuthContextAuthenticated, 
        authReady 
    } = useAuth(); 
    
    // Get the loading and permission state from the UserContext
    const { userPermissions, isLoading: isUserLoading } = useUser(); 
    
    // Get loading states and isOnline from critical data providers
    const { isLoading: isProductsLoading, isOnline } = useProducts(); 
    const { isLoading: isInventoryLoading } = useInventory();
    
    // Determine the overall application loading state
    
    // FIX: Only wait for Products/Inventory/User data if the user is authenticated.
    const isDataLoading = isAuthContextAuthenticated && (
        isUserLoading || 
        isProductsLoading || 
        isInventoryLoading
    );

    const isAppLoading = !authReady || isDataLoading;
    
    // Determine if the user is authenticated (using the established logic)
    const isAuthenticated = userPermissions.isAuthenticated || isAuthContextAuthenticated;

    // 1. Initial Loading Gate
    if (isAppLoading) { 
        return <div className="flex items-center justify-center min-h-screen text-2xl">Loading application...</div>;
    }

    // 2. Authentication Gate: If loading is false, check auth status.
    if (!isAuthenticated) {
        return (
             <div className="flex items-center justify-center min-h-screen bg-gray-50">
                 <LoginPage /> 
             </div>
        );
    }
    
    // 3. Authenticated Layout
    return (
        <div className="flex min-h-screen bg-gray-100">
            
            {/* 1. Fixed Sidebar: Pass the handler to open the connection modal */}
            <Sidebar/>
            
            {/* 2. Main Content Area */}
            <main className="flex-1 ml-64 p-6 overflow-hidden"> 
                
                
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<div className="p-8 text-2xl text-red-500">404 Page Not Found</div>} />
                </Routes>
            </main>

            {/* CONNECTION MODAL (Using LoginPage component structure as the form) */}
            {showConnectionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <LoginPage 
                        onClose={() => setShowConnectionModal(false)} // Pass a close handler
                        isReconnectMode={true} // Indicate this is a manual connection attempt
                    />
                </div>
            )}
        </div>
    );
};

// Main App component: Only renders AppContent 
const App = () => {
    return <AppContent />;
};

export default App;