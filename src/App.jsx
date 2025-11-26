// src/App.jsx

import React, { useState} from 'react';
import { Routes, Route } from 'react-router-dom';

// Providers
import { useAuth } from './contexts/AuthContext.jsx';
import { useUser } from './contexts/UserContext.jsx';
import { useProducts } from './contexts/ProductContext.jsx';
import { useInventory } from './contexts/InventoryContext.jsx';
// Add LocationProvider import
import { LocationProvider } from './contexts/LocationContext.jsx';
import { useLoading } from './contexts/LoadingContext';
import LoadingOverlay from './components/LoadingOverlay';
import MainLoadingOverlay from './components/MainLoadingOverlay'

// Components & Pages
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx'; 
import DashboardPage from './pages/DashboardPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

// Products Sub-Pages
import AddProductForm from './pages/ProductsSubPages/AddProductForm.jsx'; 
import EditProductForm from './pages/ProductsSubPages/EditProductForm.jsx';
import ProductsImportForm from './pages/ProductsSubPages/ProductsImportForm.jsx';

// Inventory Sub-Pages
import StockInForm from './pages/InventorySubPages/StockInForm.jsx';
import StockOutForm from './pages/InventorySubPages/StockOutForm.jsx';
import TransferForm from './pages/InventorySubPages/TransferForm.jsx';

// Placeholder Pages for now
const ReportsPage = () => <div className="p-8">Placeholder for Reports</div>;

// Component to handle conditional rendering based on authentication
const AppContent = () => {
    const [showConnectionModal, setShowConnectionModal] = useState(false);
    
    // START: COLLAPSE STATE MANAGEMENT (State and handler are defined here)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const toggleSidebar = () => { 
        console.log("Toggling Sidebar state."); // <-- DEBUG LOG ADDED HERE
        setIsSidebarCollapsed(prev => !prev);
    };

    // Dynamically set the left margin for the main content area
    // 'ml-64' for expanded, 'ml-16' for collapsed, and transition for smoothness
    const mainContentClass = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64';
    // END: COLLAPSE STATE MANAGEMENT


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

    // Determine the overall application processing state
    const { isAppProcessing } = useLoading();

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
        return <MainLoadingOverlay isFullScreen={true} />;
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
        // Wrap the main content area (or the part needing locations) with LocationProvider
        <LocationProvider>
            <div className="flex min-h-screen bg-gray-100">

                {/* 1. Fixed Sidebar: Pass collapse state and toggle function (Sidebar still receives it) */}
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    toggleSidebar={toggleSidebar}
                />
                
                {/* 2. Fixed Header: Pass collapse state AND toggle function */}
                <Header 
                    isSidebarCollapsed={isSidebarCollapsed}
                    toggleSidebar={toggleSidebar} // <-- Prop is correctly passed here
                />

                {/* 3. Main Content Area */}
                {/* GLOBAL LOADING OVERLAY: Renders on top of everything when Firebase is busy */}
                    {isAppProcessing && <LoadingOverlay />}
                {/* UPDATE: Use dynamic margin-left and add margin-top (mt-16) to clear the fixed 16-height header */}
                <main className={`flex-1 transition-all duration-300 ${mainContentClass} mt-16 p-6 overflow-hidden`}>

                    
                    <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/products" element={<ProductsPage />} />
                        <Route path="/products/add" element={<AddProductForm />} /> 
                        <Route path="/products/bulk-import" element={<ProductsImportForm />} /> 
                        <Route path="/products/edit/:id" element={<EditProductForm />} />
                        <Route path="/inventory" element={<InventoryPage />} />
                        <Route path="/inventory/stock-in" element={<StockInForm />} />
                        <Route path="/inventory/stock-out" element={<StockOutForm />} />
                        <Route path="/inventory/transfer" element={<TransferForm />} />
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
            
        </LocationProvider>
    );
};

// Main App component: Only renders AppContent
const App = () => {
    return <AppContent />;
};

export default App;