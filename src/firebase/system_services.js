
// src/firebase/system_services.js
import { doc, runTransaction } from 'firebase/firestore';

/**
 * Generates a unique, sequential Batch ID (BI) for stock-in operations.
 * The ID is in the format BI-YYMM-NNN, where NNN resets monthly.
 * This function is transactional and uses a single-document counter model.
 * 
 * @param {object} db - The Firestore database instance.
 * @param {string} appId - The application ID for multi-tenancy.
 * @returns {Promise<string>} - A promise that resolves to the new batch ID.
 */
export const generateBatchId = async (db, appId) => {
    const counterRef = doc(db, 'artifacts', appId, 'counters', 'receiveBatchCounter');

    try {
        const newBatchIdStr = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            const d = new Date();
            const year = d.getFullYear().toString().slice(-2);
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const currentPeriod = `${year}${month}`;

            let nextCount = 1;
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                if (data.lastResetPeriod === currentPeriod) {
                    nextCount = data.currentCount + 1;
                }
            }

            transaction.set(counterRef, {
                currentCount: nextCount,
                lastResetPeriod: currentPeriod
            }, { merge: true });

            const formattedCount = nextCount.toString().padStart(3, '0');
            return `BI-${currentPeriod}-${formattedCount}`;
        });

        return newBatchIdStr;
    } catch (e) {
        console.error("Batch ID generation transaction failed: ", e);
        throw new Error("Could not generate a new Batch ID. Please try again.");
    }
};

/**
 * Generates a unique, sequential Delivery Batch ID (BO) for stock-out operations.
 * The ID is in the format BO-YYMM-NNN, where NNN resets monthly.
 * This function is transactional and uses a single-document counter model.
 * 
 * @param {object} db - The Firestore database instance.
 * @param {string} appId - The application ID for multi-tenancy.
 * @returns {Promise<string>} - A promise that resolves to the new batch ID.
 */
export const generateDeliveryBatchId = async (db, appId) => {
    const counterRef = doc(db, 'artifacts', appId, 'counters', 'deliveryBatchCounter');

    try {
        const newBatchIdStr = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            const d = new Date();
            const year = d.getFullYear().toString().slice(-2);
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const currentPeriod = `${year}${month}`;

            let nextCount = 1;
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                if (data.lastResetPeriod === currentPeriod) {
                    nextCount = data.currentCount + 1;
                }
            }

            transaction.set(counterRef, {
                currentCount: nextCount,
                lastResetPeriod: currentPeriod
            }, { merge: true });

            const formattedCount = nextCount.toString().padStart(3, '0');
            return `BO-${currentPeriod}-${formattedCount}`;
        });

        return newBatchIdStr;
    } catch (e) {
        console.error("Delivery Batch ID generation transaction failed: ", e);
        throw new Error("Could not generate a new Delivery Batch ID. Please try again.");
    }
};
