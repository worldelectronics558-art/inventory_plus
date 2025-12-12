
// src/firebase/inventory_services.js

import { doc, writeBatch, collection, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';

// --- STAGING FUNCTIONS (for creating pending documents) ---

/**
 * Creates a 'pending_receivable' document. This is the first step in the purchase process.
 * This function is the direct parallel of handleStockDelivery.
 */
export const handleStockReceipt = async (db, appId, userId, user, summary) => {
    if (!summary || !summary.sku || !summary.batchId) {
        throw new Error("A valid receipt summary with at least a SKU and batchId is required.");
    }
    const pendingReceivableRef = doc(collection(db, `artifacts/${appId}/pending_receivables`));
    await setDoc(pendingReceivableRef, {
        ...summary,
        quantity: summary.isSerialized ? summary.serials.length : (summary.quantity || 0),
        status: 'PENDING',
        createdAt: serverTimestamp(),
        createdBy: { uid: userId, name: user.displayName || 'N/A' }
    });
};

/**
 * Creates a 'pending_deliverable' document. This is the first step in the sales process.
 */
export const handleStockDelivery = async (db, appId, userId, user, summary) => {
    if (!summary || !summary.sku || !summary.batchId) {
        throw new Error("A valid delivery summary with at least a SKU and batchId is required.");
    }
    const pendingDeliverableRef = doc(collection(db, `artifacts/${appId}/pending_deliverables`));
    await setDoc(pendingDeliverableRef, {
        ...summary,
        quantity: summary.serials.length,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        createdBy: { uid: userId, name: user.displayName || 'N/A' }
    });
};


// --- FINALIZATION FUNCTIONS (for moving items in/out of main inventory) ---

/**
 * Adds a batch of items to the main 'inventory_items' collection.
 * This is the FINAL step of a purchase.
 */
export const handleStockIn = async (db, appId, userId, user, items) => {
    if (!items || items.length === 0) return;
    const batch = writeBatch(db);
    const inventoryCollectionRef = collection(db, `artifacts/${appId}/inventory_items`);
    items.forEach(item => {
        const newItemRef = doc(inventoryCollectionRef);
        batch.set(newItemRef, {
            ...item,
            cost: item.cost || 0,
            receivedBy: { uid: userId, name: user.displayName || 'N/A' },
            authorizedBy: { uid: userId, name: user.displayName || 'N/A' },
            addedAt: serverTimestamp(),
        });
    });
    await batch.commit();
};

/**
 * Removes a batch of items from the main 'inventory_items' collection.
 * This is the FINAL step of a sale.
 */
export const handleStockOut = async (db, appId, userId, user, items) => {
    if (!items || items.length === 0) return;
    const batch = writeBatch(db);
    items.forEach(item => {
        if (!item.id) return; 
        const itemRef = doc(db, `artifacts/${appId}/inventory_items`, item.id);
        batch.delete(itemRef);
    });
    await batch.commit();
};


// --- DOCUMENT MANAGEMENT FUNCTIONS (for finalizing invoices/orders) ---

/**
 * Finalizes a Purchase Invoice and deletes the associated pending receivables.
 */
export const handleFinalizePurchaseInvoice = async (db, appId, userId, user, data) => {
    const { invoiceId, updatedInvoiceData, pendingReceivableIds } = data;
    if (!invoiceId) throw new Error("Invoice ID is missing.");

    const batch = writeBatch(db);
    
    const invoiceDocRef = doc(db, `artifacts/${appId}/purchaseInvoices`, invoiceId);
    batch.update(invoiceDocRef, {
        ...updatedInvoiceData,
        status: 'FINALIZED',
        updatedAt: serverTimestamp(),
        updatedBy: { uid: userId, name: user.displayName || 'N/A' }
    });

    if (pendingReceivableIds && pendingReceivableIds.length > 0) {
        pendingReceivableIds.forEach(id => {
            const docRef = doc(db, `artifacts/${appId}/pending_receivables`, id);
            batch.delete(docRef);
        });
    }
    await batch.commit();
};

/**
 * Finalizes a Sales Order and deletes the associated pending deliverables.
 */
export const handleFinalizeSalesOrder = async (db, appId, userId, user, data) => {
    const { orderId, updatedOrderData, pendingDeliverableIds } = data;
    if (!orderId) throw new Error("Order ID is missing.");

    const batch = writeBatch(db);

    const orderDocRef = doc(db, `artifacts/${appId}/sales_orders`, orderId);
    batch.update(orderDocRef, {
        ...updatedOrderData,
        status: 'FINALIZED',
        updatedAt: serverTimestamp(),
        updatedBy: { uid: userId, name: user.displayName || 'N/A' }
    });

    if (pendingDeliverableIds && pendingDeliverableIds.length > 0) {
        pendingDeliverableIds.forEach(id => {
            const docRef = doc(db, `artifacts/${appId}/pending_deliverables`, id);
            batch.delete(docRef);
        });
    }
    await batch.commit();
};
