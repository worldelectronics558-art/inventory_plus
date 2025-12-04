//src/hooks/useMediaQuery.jsx

import { useState, useEffect } from 'react';

/**
 * Custom hook to check if a media query matches.
 * @param {string} query - The media query string (e.g., '(min-width: 768px)').
 * @returns {boolean} - True if the query matches, false otherwise.
 */
const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(window.matchMedia(query).matches);

    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = () => setMatches(media.matches);

        // Add event listener
        media.addEventListener('change', listener);

        // Cleanup on unmount
        return () => media.removeEventListener('change', listener);
    }, [query]);

    return matches;
};

export default useMediaQuery;
