
// src/App.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';

// Providers
import { useAuth } from './contexts/AuthContext.jsx';
import { useUser } from './contexts/UserContext.jsx';
import { useProducts } from './contexts/ProductContext.jsx';
import { useCustomers } from './contexts/CustomerContext.jsx';
import { useLoading } from './contexts/LoadingContext';
import LoadingOverlay from './components/LoadingOverlay';
import MainLoadingOverlay from './components/MainLoadingOverlay';

// Components & Pages
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

// Purchase Pages
import PurchasePage from './pages/PurchasePage.jsx'; 
import SuppliersPage from './pages/SuppliersPage.jsx';
import NewSupplierForm from './pages/suppliersSubPages/NewSupplierForm.jsx';
import SupplierDetailsPage from './pages/suppliersSubPages/SupplierDetailsPage.jsx';
import EditSupplierForm from './pages/suppliersSubPages/EditSupplierForm.jsx';
import NewPurchaseInvoiceForm from './pages/PurchaseSubPages/NewPurchaseInvoiceForm.jsx';
import EditPurchaseInvoiceForm from './pages/PurchaseSubPages/EditPurchaseInvoiceForm.jsx';
import ViewPurchaseInvoicePage from './pages/PurchaseSubPages/ViewPurchaseInvoicePage.jsx';
import StockReceivePage from './pages/PurchaseSubPages/StockReceivePage.jsx';
import FinalizePurchaseInvoice from './pages/PurchaseSubPages/FinalizePurchaseInvoice.jsx';
import PendingReceivablesPage from './pages/PurchaseSubPages/PendingReceivablesPage.jsx';

// Sales Pages
import SalesPage from './pages/SalesPage.jsx';
import NewSalesOrderForm from './pages/SalesSubPages/NewSalesOrderForm.jsx';
import EditSalesOrderForm from './pages/SalesSubPages/EditSalesOrderForm.jsx';
import ViewSalesOrderPage from './pages/SalesSubPages/ViewSalesOrderPage.jsx';
import StockDeliveryPage from './pages/SalesSubPages/StockDeliveryPage.jsx';
import FinalizeSalesOrder from './pages/SalesSubPages/FinalizeSalesOrder.jsx';
import PendingDeliverablesPage from './pages/SalesSubPages/PendingDeliverablesPage.jsx';

// Customer Sub-Pages
import CustomerDetailsPage from './pages/CustomersSubPages/CustomerDetailsPage.jsx';
import NewCustomerForm from './pages/CustomersSubPages/NewCustomerForm.jsx';

// Products Sub-Pages
import AddProductForm from './pages/ProductsSubPages/AddProductForm.jsx';
import EditProductForm from './pages/ProductsSubPages/EditProductForm.jsx';
import ProductsImportForm from './pages/ProductsSubPages/ProductsImportForm.jsx';
import ProductDetailsPage from './pages/ProductsSubPages/ProductDetailsPage.jsx';
import ProductHistoryPage from './pages/ProductsSubPages/ProductHistoryPage.jsx';

const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);
    return matches;
};

const AppContent = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isDesktop = useMediaQuery('(min-width: 768px)');

    const toggleSidebarCollapse = useCallback(() => setIsSidebarCollapsed(prev => !prev), []);
    const openMobileMenu = useCallback(() => setMobileMenuOpen(true), []);
    const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

    useEffect(() => { if (isDesktop) setMobileMenuOpen(false); }, [isDesktop]);
    
    const mainContentClass = isDesktop ? (isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64') : 'md:ml-64';

    const { isAuthenticated: isAuthContextAuthenticated, authReady } = useAuth();
    const { userPermissions, isLoading: isUserLoading } = useUser();
    const { isLoading: isProductsLoading } = useProducts();
    const { isLoading: isCustomersLoading } = useCustomers();
    const { isAppProcessing } = useLoading();

    const isDataLoading = isAuthContextAuthenticated && (isUserLoading || isProductsLoading || isCustomersLoading);
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
        <div className="min-h-screen bg-gray-100">
            <Sidebar isCollapsed={isSidebarCollapsed} isDesktop={isDesktop} isMobileMenuOpen={isMobileMenuOpen} onCloseMobileMenu={closeMobileMenu} />
            <Header isSidebarCollapsed={isSidebarCollapsed} isDesktop={isDesktop} onToggleCollapse={toggleSidebarCollapse} onOpenMobileMenu={openMobileMenu} />
            {isAppProcessing && <LoadingOverlay />}
            <main className={`flex-1 transition-all duration-300 ${mainContentClass} mt-16 p-3 md:p-6 overflow-hidden`}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/products/add" element={<AddProductForm />} />
                    <Route path="/products/bulk-import" element={<ProductsImportForm />} />
                    <Route path="/products/edit/:id" element={<EditProductForm />} />
                    <Route path="/products/details/:id" element={<ProductDetailsPage />} />
                    <Route path="/products/history/:sku" element={<ProductHistoryPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    
                    <Route path="/purchase" element={<PurchasePage />} />
                    <Route path="/purchase/new" element={<NewPurchaseInvoiceForm />} />
                    <Route path="/purchase/edit/:id" element={<EditPurchaseInvoiceForm />} />
                    <Route path="/purchase/view/:id" element={<ViewPurchaseInvoicePage />} />
                    <Route path="/purchase/receive" element={<StockReceivePage />} />
                    <Route path="/purchase/finalize/:invoiceId" element={<FinalizePurchaseInvoice />} />
                    <Route path="/purchase/pending-receivables" element={<PendingReceivablesPage />} />
                    
                    <Route path="/suppliers" element={<SuppliersPage />} />
                    <Route path="/suppliers/new" element={<NewSupplierForm />} />
                    <Route path="/suppliers/:id" element={<SupplierDetailsPage />} />
                    <Route path="/suppliers/:id/edit" element={<EditSupplierForm />} />

                    <Route path="/sales" element={<SalesPage />} />
                    <Route path="/sales/new" element={<NewSalesOrderForm />} />
                    <Route path="/sales/edit/:id" element={<EditSalesOrderForm />} />
                    <Route path="/sales/view/:id" element={<ViewSalesOrderPage />} />
                    <Route path="/sales/stock-delivery" element={<StockDeliveryPage />} />
                    <Route path="/sales/finalize-order/:orderId" element={<FinalizeSalesOrder />} />
                    <Route path="/sales/pending-deliverables" element={<PendingDeliverablesPage />} />

                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/customers/new" element={<NewCustomerForm />} />
                    <Route path="/customers/:id" element={<CustomerDetailsPage />} />
                    
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<div className="p-8 text-2xl text-red-500">404 Page Not Found</div>} />
                </Routes>
            </main>
        </div>
    );
};

const App = () => <AppContent />;

export default App;
