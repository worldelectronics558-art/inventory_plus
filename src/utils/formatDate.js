import { format } from 'date-fns';

/**
 * Formats a timestamp into a human-readable string.
 * Handles Firebase Timestamps, Date objects, and date strings.
 * @param {any} ts - The timestamp to format.
 * @returns {string} The formatted date string or 'N/A' if the timestamp is invalid.
 */
export const formatDate = (ts) => {
  if (!ts) return 'N/A';
  
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  
  try {
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return format(date, 'MMM dd, yyyy HH:mm');
  } catch (error) {
    console.error("Error formatting date:", ts, error);
    return 'Invalid Date';
  }
};
