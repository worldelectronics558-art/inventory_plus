
// src/pages/Sales.jsx

import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

const Sales = () => {
    const navigate = useNavigate();

    return (
        <div className="page-container">
            <div className="flex justify-between items-center mb-6">
                <h1 className="page-title">Sales & Orders</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => navigate('/sales/new')} 
                        className="btn btn-primary"
                    >
                        New Sales Order
                    </button>
                </div>
            </div>

            {/* This Outlet will render sub-pages like the sales order list or the 'new order' form */}
            <Outlet />
        </div>
    );
};

export default Sales;
