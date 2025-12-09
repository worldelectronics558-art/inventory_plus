
// src/firebase/system_services.js
import { doc, runTransaction } from 'firebase/firestore';

/**
 * Generates a unique, sequential Batch ID (BI) for stock-in operations.
 * The ID is in the format BI-YYMM-NNN, where NNN resets monthly.
 * This function is transactional to prevent race conditions.
 * 
 * @param {object} db - The Firestore database instance.
 * @param {string} appId - The application ID for multi-tenancy.
 * @returns {Promise<string>} - A promise that resolves to the new batch ID.
 */
export const generateBatchId = async (db, appId) => {
    const d = new Date();
    const year = d.getFullYear().toString().slice(-2); // YY
    const month = (d.getMonth() + 1).toString().padStart(2, '0'); // MM
    
    const counterId = `bi_counter_${year}${month}`; // bi = Batch In
    const counterRef = doc(db, 'artifacts', appId, 'counters', counterId);

    let nextNumber;
    try {
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                nextNumber = 1;
                transaction.set(counterRef, { count: nextNumber });
            } else {
                nextNumber = counterDoc.data().count + 1;
                transaction.update(counterRef, { count: nextNumber });
            }
        });
    } catch (e) {
        console.error("Batch ID generation transaction failed: ", e);
        throw new Error("Could not generate a new Batch ID.");
    }

    const formattedNumber = nextNumber.toString().padStart(3, '0');
    return `BI-${year}${month}-${formattedNumber}`;
};
