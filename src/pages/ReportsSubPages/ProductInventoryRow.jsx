
import React, { useMemo } from 'react';
import useLiveInventory from '../../hooks/useLiveInventory';

const ProductInventoryRow = ({ product }) => {
    // Assuming a default location for now. This might need to be dynamic in a real app.
    const locationId = "default-location"; 
    const { inventoryItems } = useLiveInventory(locationId, product.sku, product.isSerialized);

    const quantity = useMemo(() => {
        if (product.isSerialized) {
            return inventoryItems.length;
        }
        return inventoryItems.reduce((acc, item) => acc + item.quantity, 0);
    }, [inventoryItems, product.isSerialized]);

    const cost = product.cost || 0;
    const totalValue = quantity * cost;

    return (
        <tr className="border-b">
            <td className="py-2 px-4">{product.sku}</td>
            <td className="py-2 px-4">{product.name}</td>
            <td className="py-2 px-4">{product.location || 'N/A'}</td>
            <td className="py-2 px-4">{quantity}</td>
            <td className="py-2 px-4">${cost.toFixed(2)}</td>
            <td className="py-2 px-4">${totalValue.toFixed(2)}</td>
        </tr>
    );
};

export default ProductInventoryRow;
