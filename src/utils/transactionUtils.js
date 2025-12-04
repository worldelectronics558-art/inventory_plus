
// src/utils/transactionUtils.js

/**
 * Processes a list of raw transaction items into a structured format for display.
 * It can return data either grouped by transactionId or as a flat, processed list.
 *
 * @param {object} options - The options for processing.
 * @param {Array<object>} options.transactions - The raw array of transaction items from the context.
 * @param {string} [options.groupBy='none'] - How to group the output. 'transactionId' or 'none'.
 * @param {string|null} [options.sku=null] - An optional SKU to filter the transactions by.
 * @returns {Array<object>} - The processed array of transactions.
 */
export const processTransactions = ({ transactions, groupBy = 'none', sku = null }) => {
    let filteredTxs = transactions;

    // 1. Filter by SKU if provided
    if (sku) {
        filteredTxs = transactions.filter(tx => tx.sku === sku);
    }

    // 2. Group by Transaction ID if requested (for HistoryPage)
    if (groupBy === 'transactionId') {
        const groups = {};
        filteredTxs.forEach(tx => {
            if (!groups[tx.transactionId]) {
                // Initialize the group with the first item's top-level info
                groups[tx.transactionId] = {
                    transactionId: tx.transactionId,
                    referenceNumber: tx.referenceNumber,
                    documentNumber: tx.documentNumber,
                    notes: tx.notes,
                    timestamp: tx.timestamp,
                    type: tx.type, 
                    userName: tx.userName,
                    userEmail: tx.userEmail,
                    items: [],
                };
            }
            groups[tx.transactionId].items.push(tx);
        });

        // Process items within each group to consolidate transfers and enforce sign consistency.
        Object.values(groups).forEach(group => {
            group.items = processTransferItems(group.items);
        });

        // Sort groups by timestamp DESCENDING (newest first)
        return Object.values(groups).sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
    }

    // 3. Return a flat, processed list, sorted DESCENDING (newest first)
    return processTransferItems(filteredTxs).sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
};

/**
 * Helper function to process a list of items (either a flat list or items within a group)
 * and consolidate transfer operations into single objects.
 */
const processTransferItems = (items) => {
    const processed = [];
    const processedIds = new Set(); // Use a simple Set to track processed transaction items by ID

    for (const item of items) {
        if (processedIds.has(item.id)) continue;

        if (item.type === 'TRANSFER') {
            const pair = items.find(t => 
                t.transactionId === item.transactionId && 
                t.sku === item.sku && 
                t.id !== item.id
            );

            if (pair) {
                const fromTx = item.quantityChange < 0 ? item : pair;
                const toTx = item.quantityChange > 0 ? item : pair;
                
                processed.push({
                    ...item, // Keep most info from one of the original items
                    isGrouped: true,
                    fromLocation: fromTx.location,
                    toLocation: toTx.location,
                    quantityChange: Math.abs(item.quantityChange), // Always positive for display
                });
                
                processedIds.add(item.id);
                processedIds.add(pair.id);
            } else {
                // If no pair is found (shouldn't happen in valid data), add as is
                processed.push(item);
                processedIds.add(item.id);
            }
        } else {
            // For non-TRANSFER items, enforce sign consistency for display logic.
            const correctedItem = { ...item };
            if (correctedItem.type === 'OUT') {
                correctedItem.quantityChange = -Math.abs(correctedItem.quantityChange);
            } else if (correctedItem.type === 'IN') {
                correctedItem.quantityChange = Math.abs(correctedItem.quantityChange);
            }
            processed.push(correctedItem);
            processedIds.add(item.id);
        }
    }
    return processed;
};
