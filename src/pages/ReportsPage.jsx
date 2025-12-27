
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, BarChart2 } from 'lucide-react';

const reportList = [
  {
    category: 'Inventory Reports',
    reports: [
      { name: 'Inventory Summary', description: 'View current stock levels and values for all products.', path: '/reports/inventory-summary' },
      { name: 'Inventory Movement', description: 'Track the movement history of specific products.', path: '/reports/inventory-movement' },
      { name: 'Low Stock Report', description: 'Identify products that are below their reorder point.', path: '/reports/low-stock' },
    ],
  },
    {
        category: 'Sales Reports',
        reports: [
            { name: 'Sales by Period', description: 'Analyze sales revenue and profit over a selected date range.', path: '/reports/sales-by-period' },
            { name: 'Sales by Product', description: 'Rank products by sales performance.', path: '/reports/sales-by-product' },
        ],
    },
];

const ReportsPage = () => {
  return (
    <div className="page-container">
      <header className="page-header">
        <div className="flex items-center space-x-3">
          <BarChart2 size={24} className="text-gray-500" />
          <h1 className="page-title">Reports</h1>
        </div>
      </header>
      <div className="page-content">
        <div className="space-y-8">
          {reportList.map((group) => (
            <div key={group.category}>
              <h2 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b">{group.category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.reports.map((report) => (
                  <Link to={report.path} key={report.name} className="card hover:shadow-lg transition-shadow duration-300 group">
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-gray-800">{report.name}</h3>
                          <p className="text-sm text-gray-500">{report.description}</p>
                        </div>
                        <FileText className="w-10 h-10 text-gray-300 group-hover:text-primary-500 transition-colors" />
                      </div>
                      <div className="mt-6 text-sm font-medium text-primary-600 flex items-center group-hover:underline">
                        View Report
                        <ChevronRight size={16} className="ml-1" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 p-6 bg-blue-50 rounded-lg text-center">
            <h3 className="text-lg font-semibold text-blue-800">More Reports Coming Soon!</h3>
            <p className="text-blue-600 mt-2">We're actively developing more insightful reports, including Purchasing and Auditing. Stay tuned!</p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
