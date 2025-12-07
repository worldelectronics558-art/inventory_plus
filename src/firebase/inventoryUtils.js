import { doc, writeBatch, runTransaction, collection, getDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

/**
 * Finalizes a pending receivable item.
 * This function performs an atomic operation to:
 * 1. Add the received quantity to the main inventory for the product.
 * 2. Delete the item from the 'pendingReceivables' collection.
 *
 * @param {object} pendingItem The item from the pendingReceivables collection.
 */
export const finalizeReceivable = async (pendingItem) => {
    if (!pendingItem || !pendingItem.id || !pendingItem.sku) {
        throw new Error("Invalid pending item data. Cannot finalize.");
    }

    const inventoryRef = doc(db, 'inventory', pendingItem.sku);
    const pendingRef = doc(db, 'pendingReceivables', pendingItem.id);

    try {
        await runTransaction(db, async (transaction) => {
            const inventoryDoc = await transaction.get(inventoryRef);
            
            let newQuantity = pendingItem.quantity;

            if (inventoryDoc.exists()) {
                // If the item already exists in inventory, add to its quantity
                const currentQuantity = inventoryDoc.data().quantity || 0;
                newQuantity = currentQuantity + pendingItem.quantity;
            }

            // Set/update the inventory document with the new quantity
            // This will create the document if it doesn't exist, or merge if it does.
            transaction.set(inventoryRef, {
                quantity: newQuantity,
                productName: pendingItem.productName, // Ensure product info is carried over
                sku: pendingItem.sku,
                unit: pendingItem.unit,
                lastUpdated: new Date(),
            }, { merge: true });

            // Remove the item from the pending list
            transaction.delete(pendingRef);
        });

        console.log("Transaction successfully committed!");

    } catch (error) {
        console.error("Transaction failed: ", error);
        throw error; // Re-throw the error to be handled by the UI
    }
};
