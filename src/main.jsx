// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css'; // Make sure this line is present
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
// Import the UserProvider here
import { LoadingProvider } from './contexts/LoadingContext';
import { UserProvider } from './contexts/UserContext.jsx';
import { LookupProvider } from './contexts/LookupContext';
import { ProductProvider } from './contexts/ProductContext.jsx';
import { InventoryProvider } from './contexts/InventoryContext.jsx';




// Call the initialization function after React renders the app
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LoadingProvider>
      <BrowserRouter>
        {/* 1. AuthProvider must be the root for authentication state */}
        <AuthProvider>
          {/* 2. UserProvider MUST be nested directly inside AuthProvider because it uses useAuth() */}
          <UserProvider>
            {/* 3. All other data providers follow, relying on the finalized User and Auth state */}
            <LookupProvider>
              <ProductProvider>
                <InventoryProvider>
                  <App />
                </InventoryProvider>
              </ProductProvider>
            </LookupProvider>
          </UserProvider>
        </AuthProvider>
      </BrowserRouter>
    </LoadingProvider>
  </React.StrictMode>,
);