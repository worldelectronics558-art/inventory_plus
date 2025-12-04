// src/components/InventoryCard.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Warehouse } from 'lucide-react';

/**
 * A mobile-friendly card to display inventory levels for a single product.
 *
 * @param {object} props
 * @param {object} props.item - The inventory data item for a product.
 * @param {string[]} props.locations - An array of location names.
 * @param {string} props.productId - The ID of the product for navigation.
 */
const InventoryCard = ({ item, locations, productId }) => {
    const navigate = useNavigate();

    if (!item) return null;

    const handleCardClick = () => {
        if (productId) {
            navigate(`/products/details/${productId}`);
        }
    };

    return (
        <div 
            className="bg-white rounded-lg border border-gray-200 shadow-sm mb-3 transition-all duration-200 active:shadow-inner active:bg-gray-50 cursor-pointer"
            onClick={handleCardClick}
        >
            {/* --- CARD HEADER --- */}
            <div className="p-4 flex justify-between items-start">
                <div className="flex-grow pr-4">
                    <h3 className="font-bold text-base text-primary-900 truncate">{item.displayName}</h3>
                    <p className="text-sm text-gray-500">Total Stock: <span className="font-bold text-lg text-blue-600">{item.totalStock}</span></p>
                </div>
                {productId && (
                    <div className="flex items-center text-gray-400 shrink-0">
                        <ChevronRight size={20} />
                    </div>
                )}
            </div>

            {/* --- LOCATIONS BREAKDOWN --- */}
            <div className="px-4 pb-4 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-2">Stock by Location</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                    {locations.map(loc => {
                        const quantity = item[loc] || 0;
                        if (quantity === 0) return null; // Don't show locations with zero stock
                        
                        // Highlight low stock
                        const quantityColor = quantity > 5 ? 'text-gray-800' : 'text-red-600';

                        return (
                            <div key={loc} className="flex items-center">
                                <Warehouse size={14} className="text-gray-400 mr-2 shrink-0"/>
                                <span className="text-gray-600 truncate">{loc}:</span>
                                <span className={`font-bold ml-1 ${quantityColor}`}>{quantity}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default InventoryCard;
