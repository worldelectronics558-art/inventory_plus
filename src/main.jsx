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
import { CustomerProvider } from './contexts/CustomerContext.jsx';
import { PurchaseInvoiceProvider } from './contexts/PurchaseInvoiceContext.jsx';
import { SalesOrderProvider } from './contexts/SalesOrderContext.jsx';
import { SupplierProvider } from './contexts/SupplierContext.jsx';
import { LocationProvider } from './contexts/LocationContext.jsx';
import { PendingReceivablesProvider } from './contexts/PendingReceivablesContext.jsx';
import { PendingDeliverablesProvider } from './contexts/PendingDeliverablesContext.jsx';


// Correct Provider Nesting
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LoadingProvider>
      <BrowserRouter>
        <AuthProvider>
          <UserProvider>
            <LookupProvider>
              <ProductProvider>
                <LocationProvider>
                  <SupplierProvider>
                    <CustomerProvider>
                      <PendingReceivablesProvider>
                        <PurchaseInvoiceProvider>
                          <SalesOrderProvider>
                            <PendingDeliverablesProvider>
                              <App />
                            </PendingDeliverablesProvider>
                          </SalesOrderProvider>
                        </PurchaseInvoiceProvider>
                      </PendingReceivablesProvider>
                    </CustomerProvider>
                  </SupplierProvider>
                </LocationProvider>
              </ProductProvider>
            </LookupProvider>
          </UserProvider>
        </AuthProvider>
      </BrowserRouter>
    </LoadingProvider>
  </React.StrictMode>,
);
