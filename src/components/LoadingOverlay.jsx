// src/components/LoadingOverlay.jsx
import React from 'react';

// Using your custom colors from tailwind.config.js for the spinner
const LoadingOverlay = () => {
  return (
    // Full screen fixed overlay with a semi-transparent black background
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
      
      {/* Container for the spinner and text */}
      <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-2xl">
        
        {/* The Spinner Animation */}
        <div className="w-12 h-12 border-4 border-t-4 border-t-secondary-700 border-gray-200 rounded-full animate-spin"></div>
        
        {/* Loading Text */}
        <p className="mt-4 text-primary-900 font-semibold">
          Processing, please wait...
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;