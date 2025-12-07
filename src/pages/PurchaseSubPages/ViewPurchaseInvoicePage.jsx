
// src/pages/PurchaseSubPages/ViewPurchaseInvoicePage.jsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ViewPurchaseInvoicePage = () => {
    const { id } = useParams();

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <Link to="/purchase" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Purchase Invoices
                    </Link>
                    <h1 className="page-title">Invoice Details</h1>
                </div>
            </header>
            <div className="card">
                <div className="card-body text-center p-12">
                    <h2 className="text-xl font-semibold text-gray-700">Detailed View Under Construction</h2>
                    <p className="text-gray-500 mt-2">
                        This page will soon display the complete details for invoice ID: <span className="font-mono bg-gray-100 p-1 rounded">{id}</span>.
                    </p>
                    <p className="mt-1 text-gray-500">
                        You will be able to see the finalized items and quantities received against this invoice here.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ViewPurchaseInvoicePage;
