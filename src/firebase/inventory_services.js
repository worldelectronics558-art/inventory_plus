
// src/firebase/inventory_services.js

import { collection, writeBatch, doc, serverTimestamp, runTransaction, getDocs, query, where } from "firebase/firestore";

/**
 * Processes a batch stock-in operation and adds items to the pending_receivables collection.
 */
export const handleStockIn = async (db, appId, userId, user, operationData) => {
    // The operationData is now the array of items itself.
    if (!operationData || !Array.isArray(operationData) || operationData.length === 0) {
        throw new Error("Invalid operation data: items array is missing or empty.");
    }

    const batch = writeBatch(db);
    // Correcting collection name to 'pending_receivables' for consistency
    const pendingReceivablesCollection = collection(db, `artifacts/${appId}/pending_receivables`);

    operationData.forEach(item => {
        const pendingDocRef = doc(pendingReceivablesCollection);
        if (!item.productId || !item.locationId || !item.quantity) {
            console.error("Skipping invalid item in batch:", item);
            return;
        }

        batch.set(pendingDocRef, {
            productId: item.productId,
            productName: item.productName || 'N/A',
            sku: item.sku || 'N/A',
            isSerialized: item.isSerialized || false,
            locationId: item.locationId,
            quantity: item.quantity,
            cost: item.cost !== undefined ? item.cost : 0,
            serials: item.isSerialized ? item.serials : [],
            status: 'pending', // The status of a receivable, not an inventory item
            batchId: item.batchId, // <-- ADD THE BATCH ID
            createdAt: serverTimestamp(),
            createdBy: {
                uid: userId,
                name: user.displayName || 'System User'
            }
        });
    });

    await batch.commit();
};

/**
 * Finalizes a batch of pending stock items, moving them into the main inventory.
 * This is the crucial step to make received stock available in the system.
 */
export const handleFinalizePurchaseBatch = async (db, appId, userId, user, operationData) => {
    const { pendingItemIds } = operationData;
    if (!pendingItemIds || pendingItemIds.length === 0) {
        throw new Error("No pending items specified for finalization.");
    }

    const pendingStockRef = collection(db, `artifacts/${appId}/pending_stock`);
    const q = query(pendingStockRef, where("__name__", "in", pendingItemIds));
    const pendingDocs = await getDocs(q);

    if (pendingDocs.empty) {
        throw new Error("Could not find any of the specified pending items.");
    }

    const writeBatch = writeBatch(db);
    const historyCollectionRef = collection(db, `artifacts/${appId}/history`);

    for (const docSnapshot of pendingDocs.docs) {
        const pendingItem = docSnapshot.data();
        const inventoryRef = doc(db, `artifacts/${appId}/inventory`, pendingItem.sku);

        await runTransaction(db, async (transaction) => {
            const inventoryDoc = await transaction.get(inventoryRef);
            let newTotalStock = 0;
            let newLocations = {};

            if (!inventoryDoc.exists()) {
                // If inventory record doesn't exist, create it
                newTotalStock = pendingItem.quantity;
                newLocations[pendingItem.locationId] = {
                    quantity: pendingItem.quantity,
                    serials: pendingItem.serials || []
                };
            } else {
                // If record exists, update it
                const currentData = inventoryDoc.data();
                newTotalStock = (currentData.totalStock || 0) + pendingItem.quantity;
                newLocations = { ...currentData.locations };
                const currentLocationData = newLocations[pendingItem.locationId] || { quantity: 0, serials: [] };
                
                currentLocationData.quantity += pendingItem.quantity;
                if (pendingItem.isSerialized) {
                    currentLocationData.serials = [...(currentLocationData.serials || []), ...pendingItem.serials];
                }
                 newLocations[pendingItem.locationId] = currentLocationData;
            }
            
            // Update or set the inventory document
            transaction.set(inventoryRef, {
                ...pendingItem, // Carry over product details
                totalStock: newTotalStock,
                locations: newLocations,
                lastUpdated: serverTimestamp()
            }, { merge: true });
        });

        // Create history record for the stock-in event
        const historyDocRef = doc(historyCollectionRef);
        writeBatch.set(historyDocRef, {
            type: 'STOCK_IN',
            sku: pendingItem.sku,
            quantity: pendingItem.quantity,
            location: pendingItem.locationId,
            isSerialized: pendingItem.isSerialized,
            serials: pendingItem.serials,
            cost: pendingItem.cost,
            timestamp: serverTimestamp(),
            user: { uid: userId, name: user.displayName || 'System User' },
            notes: 'Finalized from pending stock',
        });

        // Mark the pending item as finalized
        writeBatch.update(docSnapshot.ref, { status: 'finalized', finalizedAt: serverTimestamp() });
    }

    await writeBatch.commit();
};

/**
 * Handles stock out operations, reducing inventory levels.
 */
export const handleStockOut = async (db, appId, userId, user, operationData) => {
    const { items, notes, referenceNumber } = operationData;
    const batch = writeBatch(db);
    const historyRef = collection(db, `artifacts/${appId}/history`);

    for (const item of items) {
        const inventoryRef = doc(db, `artifacts/${appId}/inventory`, item.sku);
        await runTransaction(db, async (transaction) => {
            const inventoryDoc = await transaction.get(inventoryRef);
            if (!inventoryDoc.exists()) throw new Error(`SKU ${item.sku} not found.`);
            const inventoryData = inventoryDoc.data();
            const locationStock = inventoryData.locations[item.location];
            if (!locationStock) throw new Error(`No stock for ${item.sku} at ${item.location}.`);

            if (item.isSerialized) {
                const updatedSerials = locationStock.serials.filter(s => !item.serials.includes(s));
                if (locationStock.serials.length - updatedSerials.length !== item.serials.length) throw new Error(`Serials for ${item.sku} not found.`);
                transaction.update(inventoryRef, { 
                    [`locations.${item.location}.serials`]: updatedSerials, 
                    [`locations.${item.location}.quantity`]: updatedSerials.length, 
                    totalStock: inventoryData.totalStock - item.quantity 
                });
            } else {
                if (locationStock.quantity < item.quantity) throw new Error(`Insufficient stock for ${item.sku}.`);
                transaction.update(inventoryRef, { 
                    [`locations.${item.location}.quantity`]: locationStock.quantity - item.quantity, 
                    totalStock: inventoryData.totalStock - item.quantity 
                });
            }
        });
        const historyDocRef = doc(historyRef);
        batch.set(historyDocRef, { type: 'STOCK_OUT', sku: item.sku, quantity: item.quantity, location: item.location, isSerialized: item.isSerialized, serials: item.serials, timestamp: serverTimestamp(), user: { uid: userId, name: user.displayName }, notes, referenceNumber });
    }
    await batch.commit();
};

/**
 * Handles inventory transfers between two locations.
 */
export const handleTransfer = async (db, appId, userId, user, operationData) => {
    const { items, notes } = operationData;
    const batch = writeBatch(db);
    const historyRef = collection(db, `artifacts/${appId}/history`);

    for (const item of items) {
        const inventoryRef = doc(db, `artifacts/${appId}/inventory`, item.sku);
        await runTransaction(db, async (transaction) => {
            const inventoryDoc = await transaction.get(inventoryRef);
            if (!inventoryDoc.exists()) throw new Error(`Inventory for ${item.sku} not found.`);
            const inventoryData = inventoryDoc.data();
            const fromLocationStock = inventoryData.locations[item.fromLocation];
            const toLocationStock = inventoryData.locations[item.toLocation] || { quantity: 0, serials: [] };
            if (!fromLocationStock || fromLocationStock.quantity < item.quantity) throw new Error(`Insufficient stock for ${item.sku} at ${item.fromLocation}.`);

            if (item.isSerialized) {
                const movingSerials = new Set(item.serials);
                const remainingSerials = fromLocationStock.serials.filter(s => !movingSerials.has(s));
                if (fromLocationStock.serials.length - remainingSerials.length !== movingSerials.size) throw new Error(`Serials for ${item.sku} not found at ${item.fromLocation}.`);
                transaction.update(inventoryRef, {
                    [`locations.${item.fromLocation}.serials`]: remainingSerials,
                    [`locations.${item.fromLocation}.quantity`]: remainingSerials.length,
                    [`locations.${item.toLocation}.serials`]: [...(toLocationStock.serials || []), ...item.serials],
                    [`locations.${item.toLocation}.quantity`]: (toLocationStock.quantity || 0) + item.serials.length,
                });
            } else {
                transaction.update(inventoryRef, {
                    [`locations.${item.fromLocation}.quantity`]: fromLocationStock.quantity - item.quantity,
                    [`locations.${item.toLocation}.quantity`]: toLocationStock.quantity + item.quantity,
                });
            }
        });
        const historyDocRef = doc(historyRef);
        batch.set(historyDocRef, { type: 'TRANSFER', sku: item.sku, quantity: item.quantity, fromLocation: item.fromLocation, toLocation: item.toLocation, isSerialized: item.isSerialized, serials: item.serials || [], timestamp: serverTimestamp(), user: { uid: userId, name: user.displayName }, notes });
    }
    await batch.commit();
};
