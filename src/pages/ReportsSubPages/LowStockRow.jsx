
import React, { useMemo } from 'react';
import useLiveInventory from '../../hooks/useLiveInventory';

const LowStockRow = ({ product }) => {
    // Assuming a default location for now. 
    const locationId = "default-location"; 
    const { inventoryItems } = useLiveInventory(locationId, product.sku, product.isSerialized);

    const quantity = useMemo(() => {
        if (product.isSerialized) {
            return inventoryItems.length;
        }
        return inventoryItems.reduce((acc, item) => acc + item.quantity, 0);
    }, [inventoryItems, product.isSerialized]);

    const deficit = product.reorderLevel - quantity;

    if (quantity >= product.reorderLevel) {
        return null; // Don't render if stock is not low
    }

    return (
        <tr className="border-b">
            <td className="py-2 px-4">{product.sku}</td>
            <td className="py-2 px-4">{product.name}</td>
            <td className="py-2 px-4">{quantity}</td>
            <td className="py-2 px-4">{product.reorderLevel}</td>
            <td className="py-2 px-4">{deficit}</td>
        </tr>
    );
};

export default LowStockRow;
