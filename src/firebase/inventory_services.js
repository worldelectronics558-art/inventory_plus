
// src/firebase/inventory_services.js

import {
    collection,
    writeBatch,
    doc,
    serverTimestamp,
    runTransaction,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from 'firebase/firestore';

/**
 * Creates inventory item records when stock is received by a warehouse worker.
 */
export const handleStockIn = async (db, appId, userId, user, operationData) => {
    if (!operationData.items?.length) throw new Error("No items for stock-in.");

    const batch = writeBatch(db);
    const itemsCollectionRef = collection(db, `/artifacts/${appId}/inventory_items`);
    const eventCollectionRef = collection(db, `/artifacts/${appId}/inventory_events`);
    const timestamp = serverTimestamp();
    const allSerials = [];

    operationData.items.forEach(item => {
        const { sku, quantity, location, isSerialized, serials, costPrice } = item;
        if (!operationData.invoiceId) throw new Error("An invoice ID is required to receive stock.");

        if (isSerialized) {
            if (serials.length !== quantity) throw new Error(`Mismatched quantity and serials for ${sku}.`);
            serials.forEach(serial => {
                const newItemRef = doc(itemsCollectionRef);
                batch.set(newItemRef, { 
                    sku, serialNumber: serial, internalSerialNumber: false, location, 
                    status: 'received', receivedDate: timestamp, costPrice: costPrice || null, 
                    purchaseInvoiceId: operationData.invoiceId 
                });
                allSerials.push(serial);
            });
        } else {
            for (let i = 0; i < quantity; i++) {
                const newItemRef = doc(itemsCollectionRef);
                const internalSerial = `${sku}-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
                batch.set(newItemRef, { 
                    sku, serialNumber: internalSerial, internalSerialNumber: true, location, 
                    status: 'received', receivedDate: timestamp, costPrice: costPrice || null, 
                    purchaseInvoiceId: operationData.invoiceId 
                });
                allSerials.push(internalSerial);
            }
        }
    });

    const eventRef = doc(eventCollectionRef);
    batch.set(eventRef, {
        type: 'RECEIVE_STOCK', timestamp, userId, userName: user?.firstName || 'N/A',
        itemCount: allSerials.length, involvedSerials: allSerials,
        location: operationData.items.length === 1 ? operationData.items[0].location : 'multiple',
        referenceNumber: operationData.referenceNumber || null, notes: operationData.notes || null,
        purchaseInvoiceId: operationData.invoiceId
    });

    await batch.commit();
};

/**
 * Finalizes a purchase by moving all 'received' items for a specific invoice into 'in_stock' status.
 */
export const handleFinalizePurchase = async (db, appId, purchaseInvoiceId) => {
    if (!purchaseInvoiceId) throw new Error("A purchaseInvoiceId is required.");

    const itemsCollectionRef = collection(db, `/artifacts/${appId}/inventory_items`);
    const q = query(itemsCollectionRef, where("purchaseInvoiceId", "==", purchaseInvoiceId), where("status", "==", "received"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        console.warn(`No 'received' items found for invoice ${purchaseInvoiceId} to finalize.`);
        return;
    }

    const batch = writeBatch(db);
    const stockInTimestamp = serverTimestamp();

    snapshot.docs.forEach(itemDoc => {
        batch.update(itemDoc.ref, { status: 'in_stock', stockInDate: stockInTimestamp });
    });

    const eventCollectionRef = collection(db, `/artifacts/${appId}/inventory_events`);
    const eventRef = doc(eventCollectionRef);
    batch.set(eventRef, {
        type: 'FINALIZE_PURCHASE', timestamp: stockInTimestamp, purchaseInvoiceId: purchaseInvoiceId,
        itemCount: snapshot.docs.length,
    });

    await batch.commit();
};

/**
 * Sells stock using a transaction, ensuring atomicity.
 */
export const handleStockOut = async (db, appId, userId, user, operationData) => {
    if (!operationData.items?.length) throw new Error("No items for stock-out.");

    const itemsCollectionRef = collection(db, `/artifacts/${appId}/inventory_items`);
    const eventCollectionRef = collection(db, `/artifacts/${appId}/inventory_events`);

    await runTransaction(db, async (transaction) => {
        const allSerialsDispatched = [];
        const timestamp = serverTimestamp();

        for (const item of operationData.items) {
            const { sku, quantity, location, isSerialized, serials } = item;
            
            if (isSerialized) {
                if (serials.length !== quantity) throw new Error(`Mismatched quantity and serials for ${sku}.`);
                for (const serial of serials) {
                    const q = query(itemsCollectionRef, where("sku", "==", sku), where("serialNumber", "==", serial));
                    const snapshot = await getDocs(q);
                    if (snapshot.empty) throw new Error(`Item with SKU ${sku} and Serial ${serial} not found.`);
                    const itemDoc = snapshot.docs[0];
                    if (itemDoc.data().status !== 'in_stock') throw new Error(`Item ${sku} with serial ${serial} is not in stock.`);
                    transaction.update(itemDoc.ref, { status: 'sold', stockOutDate: timestamp, salesInvoiceId: operationData.invoiceId || null });
                    allSerialsDispatched.push(serial);
                }
            } else {
                const q = query(itemsCollectionRef, where("sku", "==", sku), where("location", "==", location), where("status", "==", 'in_stock'), orderBy("stockInDate"), limit(quantity));
                const snapshot = await getDocs(q);
                if (snapshot.docs.length < quantity) throw new Error(`Insufficient stock for ${sku} at ${location}.`);
                snapshot.docs.forEach(doc => {
                    transaction.update(doc.ref, { status: 'sold', stockOutDate: timestamp, salesInvoiceId: operationData.invoiceId || null });
                    allSerialsDispatched.push(doc.data().serialNumber);
                });
            }
        }

        const eventRef = doc(eventCollectionRef);
        transaction.set(eventRef, {
            type: 'SALE', timestamp, userId, userName: user?.firstName || 'N/A', 
            itemCount: allSerialsDispatched.length, involvedSerials: allSerialsDispatched,
            referenceNumber: operationData.referenceNumber || null, notes: operationData.notes || null,
            salesInvoiceId: operationData.invoiceId || null
        });
    });
};

/**
 * Transfers stock between locations using a transaction.
 */
export const handleTransfer = async (db, appId, userId, user, operationData) => {
    if (!operationData.items?.length) throw new Error("No items for transfer.");

    const itemsCollectionRef = collection(db, `/artifacts/${appId}/inventory_items`);
    const eventCollectionRef = collection(db, `/artifacts/${appId}/inventory_events`);

    await runTransaction(db, async (transaction) => {
        const allSerialsTransferred = [];
        const timestamp = serverTimestamp();

        for (const item of operationData.items) {
            const { sku, quantity, fromLocation, toLocation, isSerialized, serials } = item;
            if (fromLocation === toLocation) throw new Error(`From and To locations cannot be the same for ${sku}.`);

            if (isSerialized) {
                if (serials.length !== quantity) throw new Error(`Mismatched quantity and serials for ${sku}.`);
                for (const serial of serials) {
                    const q = query(itemsCollectionRef, where("sku", "==", sku), where("serialNumber", "==", serial), where("location", "==", fromLocation));
                    const snapshot = await getDocs(q);
                    if (snapshot.empty) throw new Error(`Item ${sku} / ${serial} not found at ${fromLocation}.`);
                    const itemDoc = snapshot.docs[0];
                    if (itemDoc.data().status !== 'in_stock') throw new Error(`Item ${sku} / ${serial} is not in stock.`);
                    transaction.update(itemDoc.ref, { location: toLocation });
                    allSerialsTransferred.push(serial);
                }
            } else {
                const q = query(itemsCollectionRef, where("sku", "==", sku), where("location", "==", fromLocation), where("status", "==", 'in_stock'), orderBy("stockInDate"), limit(quantity));
                const snapshot = await getDocs(q);
                if (snapshot.docs.length < quantity) throw new Error(`Insufficient stock for ${sku} at ${fromLocation}.`);
                snapshot.docs.forEach(doc => {
                    transaction.update(doc.ref, { location: toLocation });
                    allSerialsTransferred.push(doc.data().serialNumber);
                });
            }
        }

        const { fromLocation, toLocation } = operationData.items[0];
        const eventRef = doc(eventCollectionRef);
        transaction.set(eventRef, {
            type: 'TRANSFER', timestamp, userId, userName: user?.firstName || 'N/A',
            itemCount: allSerialsTransferred.length, involvedSerials: allSerialsTransferred,
            referenceNumber: operationData.referenceNumber || null, notes: operationData.notes || null,
            fromLocation, toLocation
        });
    });
};
