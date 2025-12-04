// src/components/ProductCard.jsx

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Edit, History, Trash2 } from 'lucide-react';

/**
 * A mobile-friendly card component to display comprehensive product information and actions.
 *
 * @param {object} props
 * @param {object} props.product - The product data to display.
 * @param {function} props.onDelete - The function to call to delete the product.
 * @param {boolean} props.isMutationDisabled - Whether mutation actions (edit, delete) are disabled.
 */
const ProductCard = ({ product, onDelete, isMutationDisabled }) => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!product) return null;

    const { id, sku, model, brand, category, description, reorderPoint, totalStock } = product;

    const handleNavigation = (e, path) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        navigate(path);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        onDelete(id, sku);
    };
    
    const handleMenuToggle = (e) => {
        e.stopPropagation();
        setIsMenuOpen(prev => !prev);
    };

    // Determine stock color based on thresholds
    const stockColor = totalStock > (reorderPoint || 5) ? 'text-green-600' : totalStock > 0 ? 'text-yellow-600' : 'text-red-600';
    const disabledClass = 'opacity-50 cursor-not-allowed';

    return (
        <div 
            className="bg-white rounded-lg border border-gray-200 shadow-sm mb-3 transition-all duration-200 active:shadow-inner active:bg-gray-50 cursor-pointer"
            onClick={() => navigate(`/products/details/${id}`)}
        >
            {/* --- CARD HEADER --- */}
            <div className="p-4 flex justify-between items-start">
                <div className="flex-grow pr-4">
                    <h3 className="font-bold text-base text-primary-900">{sku} - {model || 'N/A'}</h3>
                    <p className="text-sm text-gray-500 truncate">{brand || 'Unknown Brand'}</p>
                </div>
                <div className="relative shrink-0">
                    <button 
                        ref={buttonRef}
                        onClick={handleMenuToggle}
                        className="p-2 text-gray-500 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                        <MoreVertical size={20} />
                    </button>
                    {isMenuOpen && (
                        <div ref={menuRef} className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10 py-1">
                            <button onClick={(e) => handleNavigation(e, `/products/edit/${id}`)} disabled={isMutationDisabled} className={`w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${isMutationDisabled ? disabledClass : ''}`}>
                                <Edit size={16} className="mr-3"/> Edit
                            </button>
                            <button onClick={(e) => handleNavigation(e, `/products/history/${sku}`)} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <History size={16} className="mr-3"/> History
                            </button>
                            <div className="border-t my-1 border-gray-100"></div>
                            <button onClick={handleDelete} disabled={isMutationDisabled} className={`w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 ${isMutationDisabled ? disabledClass : ''}`}>
                                <Trash2 size={16} className="mr-3"/> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- CARD BODY --- */}
            <div className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
                    {/* Total Stock */}
                    <div className="col-span-1">
                        <p className="text-gray-500 text-xs">Stock</p>
                        <p className={`font-bold text-2xl ${stockColor}`}>{totalStock ?? '0'}</p>
                    </div>
                    {/* Reorder Point */}
                    <div className="col-span-1">
                        <p className="text-gray-500 text-xs">Reorder At</p>
                        <p className="font-bold text-2xl text-primary-800">{reorderPoint || '-'}</p>
                    </div>
                    {/* Category */}
                    <div className="col-span-1">
                        <p className="text-gray-500 text-xs">Category</p>
                        <p className="font-medium text-primary-800 truncate">{category || 'N/A'}</p>
                    </div>
                     {/* Description */}
                    <div className="col-span-3 pt-2 mt-2 border-t border-gray-100">
                        <p className="text-gray-500 text-xs">Description</p>
                        <p className="text-primary-800 italic">{description || 'No description provided.'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductCard;
