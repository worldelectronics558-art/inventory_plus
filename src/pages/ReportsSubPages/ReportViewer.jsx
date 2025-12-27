
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { utils, writeFile } from 'xlsx';
import { Printer, Download } from 'lucide-react';
import ReusableDatePicker from '../../components/ReusableDatePicker.jsx';

const ReportViewer = ({ title, columns, data, children, dateRange, setDateRange }) => {
    const componentRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `${title} Report`,
    });

    const handleExport = () => {
        // Note: Export will only work for reports that pass the `data` prop.
        // Custom rendering with `children` will not be exported.
        if (data) {
            const ws = utils.json_to_sheet(data);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Report");
            writeFile(wb, `${title.replace(/ /g, "_")}_Report.xlsx`);
        }
    };

    const formattedStartDate = dateRange?.[0] ? new Date(dateRange[0]).toLocaleDateString() : null;
    const formattedEndDate = dateRange?.[1] ? new Date(dateRange[1]).toLocaleDateString() : null;

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">{title}</h1>
                <div className="page-actions">
                    <button onClick={handlePrint} className="btn btn-white">
                        <Printer size={16} className="mr-2" />
                        Print
                    </button>
                    <button onClick={handleExport} className="btn btn-white" disabled={!data}>
                        <Download size={16} className="mr-2" />
                        Export
                    </button>
                </div>
            </header>

            <div className="page-content">
                {setDateRange && (
                    <div className="card p-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            <div className="md:col-span-1">
                            <label className="font-semibold text-gray-700 block mb-1">Date Range</label>
                                <ReusableDatePicker dateRange={dateRange} setDateRange={setDateRange} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={componentRef} className="card p-6 printable-content">
                    <div className="print-header hidden print:block mb-6">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        {formattedStartDate && formattedEndDate && (
                            <p className="text-sm text-gray-600">Date Range: {formattedStartDate} to {formattedEndDate}</p>
                        )}
                        <p className="text-sm text-gray-600">Generated On: {new Date().toLocaleString()}</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    {columns.map((col) => (
                                        <th key={col.key} className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{col.header}</th>
                                    ))}
                                </tr>
                            </thead>
                            {children || (
                                <tbody className="divide-y divide-gray-200">
                                    {data && data.map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {columns.map((col) => (
                                                <td key={col.key} className="p-3 whitespace-nowrap">{row[col.key]}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            )}
                        </table>
                    </div>
                    {(!children && data?.length === 0) && (
                         <div className="text-center py-10 text-gray-500">
                            <p>No data available for the selected criteria.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportViewer;
