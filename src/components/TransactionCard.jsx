// src/components/TransactionCard.jsx

import React from 'react';
import { ArrowUp, ArrowDown, ArrowRightLeft } from 'lucide-react';
import { formatDate } from '../utils/formatDate';
import { getProductDisplayName } from '../utils/productUtils';

const TransactionCard = ({ transaction, product }) => {
    const { type, quantityChange, location, timestamp, userEmail, isGrouped, fromLocation, toLocation } = transaction;

    const getTxIcon = () => {
        const style = { size: 24 };
        switch (type) {
            case 'IN': return <ArrowDown className="text-green-500" {...style} />;
            case 'OUT': return <ArrowUp className="text-red-500" {...style} />;
            case 'TRANSFER': return <ArrowRightLeft className="text-blue-500" {...style} />;
            default: return null;
        }
    };

    const renderTitle = () => {
        const productName = getProductDisplayName(product);
        if (isGrouped) {
            return `Moved ${productName}`;
        }
        return type === 'IN' ? `Stocked In ${productName}` : `Stocked Out ${productName}`;
    };

    const renderDetails = () => {
        if (isGrouped) {
            return <p>From <strong>{fromLocation}</strong> to <strong>{toLocation}</strong></p>;
        }
        return <p>At <strong>{location}</strong></p>;
    };

    return (
        <div className="card mb-3">
            <div className="flex items-start p-4">
                <div className="mr-4 pt-1">{getTxIcon()}</div>
                <div className="flex-grow">
                    <p className="font-bold text-md">{renderTitle()}</p>
                    <div className="text-sm text-gray-700 mt-1">
                        {renderDetails()}
                        <p>Quantity: <strong className={type === 'IN' || isGrouped ? 'text-green-600' : 'text-red-600'}>{quantityChange > 0 ? '+' : ''}{quantityChange}</strong></p>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                        <span>{formatDate(timestamp)}</span> by <span>{userEmail || 'System'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionCard;
