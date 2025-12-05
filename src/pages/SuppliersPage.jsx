
// src/pages/SuppliersPage.jsx

import React from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSuppliers } from '../contexts/SupplierContext.jsx';

const SuppliersPage = () => {
  const { suppliers, isLoading } = useSuppliers();
  const navigate = useNavigate();

  const handleRowClick = (id) => {
    navigate(`/purchasing/suppliers/${id}`);
  };

  if (isLoading && suppliers.length === 0) {
    return (
        <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">Loading suppliers...</p>
        </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <div className="page-actions">
          <Link to="/purchasing/suppliers/new" className="btn btn-primary">
            <Plus size={16} className="mr-2" />
            New Supplier
          </Link>
        </div>
      </header>

      <div className="page-content">
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="p-3">Supplier ID</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3 text-center">Products</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(supplier => (
                  <tr key={supplier.id} onClick={() => handleRowClick(supplier.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs text-gray-500">{supplier.displayId}</td>
                    <td className= "p-3 font-medium text-gray-800">{supplier.name}</td>
                    <td className="p-3">
                      <div className="text-sm">{supplier.primaryContactPerson || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{supplier.primaryContactNumber || supplier.email}</div>
                    </td>
                    <td className="p-3 text-center">{supplier.products || 0}</td>
                    <td className="p-3 text-center">
                      <span className={`badge ${supplier.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {supplier.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                        <ChevronRight size={16} className="text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuppliersPage;
