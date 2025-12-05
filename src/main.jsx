
// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { UserProvider } from './contexts/UserContext.jsx';
import { LookupProvider } from './contexts/LookupContext';
import { ProductProvider } from './contexts/ProductContext.jsx';
import { InventoryProvider } from './contexts/InventoryContext.jsx';
import { SyncProvider } from './contexts/SyncContext.jsx';
import { CustomerProvider } from './contexts/CustomerContext.jsx';
import { SalesProvider } from './contexts/SalesContext.jsx';
import { SupplierProvider } from './contexts/SupplierContext.jsx'; // Import SupplierProvider

// Correct Provider Nesting
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LoadingProvider>
      <BrowserRouter>
        <AuthProvider>
          <UserProvider>
            <SyncProvider>
              <LookupProvider>
                <ProductProvider>
                  <InventoryProvider>
                    <SupplierProvider> {/* Add SupplierProvider */}
                      <CustomerProvider>
                        <SalesProvider>
                          <App />
                        </SalesProvider>
                      </CustomerProvider>
                    </SupplierProvider>
                  </InventoryProvider>
                </ProductProvider>
              </LookupProvider>
            </SyncProvider>
          </UserProvider>
        </AuthProvider>
      </BrowserRouter>
    </LoadingProvider>
  </React.StrictMode>,
);
