// src/App.jsx

import React, { useState} from 'react';
import { Routes, Route } from 'react-router-dom';

// Providers
import { useAuth } from './contexts/AuthContext.jsx';
import { useUser } from './contexts/UserContext.jsx';
import { useProducts } from './contexts/ProductContext.jsx';
import { useInventory } from './contexts/InventoryContext.jsx';
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
import HistoryPage from './pages/HistoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

// Products Sub-Pages
import AddProductForm from './pages/ProductsSubPages/AddProductForm.jsx'; 
import EditProductForm from './pages/ProductsSubPages/EditProductForm.jsx';
import ProductsImportForm from './pages/ProductsSubPages/ProductsImportForm.jsx';
import ProductDetailsPage from './pages/ProductsSubPages/ProductDetailsPage.jsx'; // <-- IMPORT ADDED

// Inventory Sub-Pages
import StockInForm from './pages/InventorySubPages/StockInForm.jsx';
import StockOutForm from './pages/InventorySubPages/StockOutForm.jsx';
import TransferForm from './pages/InventorySubPages/TransferForm.jsx';

// Placeholder Pages for now
const ReportsPage = () => <div className="p-8">Placeholder for Reports</div>;

// Component to handle conditional rendering based on authentication
const AppContent = () => {
    const [showConnectionModal, setShowConnectionModal] = useState(false);
    
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const toggleSidebar = () => { 
        setIsSidebarCollapsed(prev => !prev);
    };

    const mainContentClass = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64';

    const { isAuthenticated: isAuthContextAuthenticated, authReady } = useAuth();
    const { userPermissions, isLoading: isUserLoading } = useUser();
    const { isLoading: isProductsLoading, isOnline } = useProducts();
    const { isLoading: isInventoryLoading } = useInventory();
    const { isAppProcessing } = useLoading();

    const isDataLoading = isAuthContextAuthenticated && (
        isUserLoading ||
        isProductsLoading ||
        isInventoryLoading
    );

    const isAppLoading = !authReady || isDataLoading;
    const isAuthenticated = userPermissions.isAuthenticated || isAuthContextAuthenticated;

    if (isAppLoading) {
        return <MainLoadingOverlay isFullScreen={true} />;
    }

    if (!isAuthenticated) {
        return (
             <div className="flex items-center justify-center min-h-screen bg-gray-50">
                 <LoginPage />
             </div>
        );
    }
    
    return (
        <LocationProvider>
            <div className="flex min-h-screen bg-gray-100">
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    toggleSidebar={toggleSidebar}
                />
                <Header 
                    isSidebarCollapsed={isSidebarCollapsed}
                    toggleSidebar={toggleSidebar}
                />
                {isAppProcessing && <LoadingOverlay />}
                <main className={`flex-1 transition-all duration-300 ${mainContentClass} mt-16 p-6 overflow-hidden`}>
                    <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/products" element={<ProductsPage />} />
                        <Route path="/products/add" element={<AddProductForm />} /> 
                        <Route path="/products/bulk-import" element={<ProductsImportForm />} /> 
                        <Route path="/products/edit/:id" element={<EditProductForm />} />
                        <Route path="/products/details/:id" element={<ProductDetailsPage />} /> {/* <-- ROUTE ADDED */}
                        <Route path="/inventory" element={<InventoryPage />} />
                        <Route path="/inventory/stock-in" element={<StockInForm />} />
                        <Route path="/inventory/stock-out" element={<StockOutForm />} />
                        <Route path="/inventory/transfer" element={<TransferForm />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<div className="p-8 text-2xl text-red-500">404 Page Not Found</div>} />
                    </Routes>
                </main>
                {showConnectionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                        <LoginPage
                            onClose={() => setShowConnectionModal(false)}
                            isReconnectMode={true}
                        />
                    </div>
                )}
            </div>
        </LocationProvider>
    );
};

const App = () => {
    return <AppContent />;
};

export default App;
