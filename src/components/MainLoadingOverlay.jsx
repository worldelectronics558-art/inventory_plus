import React from 'react';
import { Loader2 } from 'lucide-react'; // Using Lucide icon for the spinner
import ActualLogo from '../assets/logo.svg';

// Custom Logo component to simulate the presence of src/assets/logo.svg
const Logo = () => (
    // This is a simple placeholder SVG representing a logo
    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-white">
        <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" />
        <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
);

/**
 * Global Loading Overlay component.
 * It serves two purposes:
 * 1. isFullScreen: Renders the full-screen, branded loading screen during initial app boot.
 * 2. Default: Renders a subtle overlay for transaction/app processing (isAppProcessing).
 */
const MainLoadingOverlay = ({ isFullScreen = false }) => {
    // 1. Full Screen Loading State (Initial App Boot)
    if (isFullScreen) {
        // Gradient from emerald-600 to emerald-900 to match the #2A9D8F primary color
        return (
            <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-linear-to-br from-emerald-600 to-emerald-900">
                <div className="flex flex-col items-center p-8">
                    {/* Logo Placeholder - Spinning effect */}
                    <div className="mb-6">
                        <img src={ActualLogo} alt="Inventory Plus Logo" className="w-16 h-16 text-white" />
                    </div>
                    {/* App Name */}
                    <h1 className="text-4xl font-extrabold text-white tracking-wider mb-2 drop-shadow-lg font-['Inter']">
                        Inventory Plus
                    </h1>
                    {/* Loading Text */}
                    <p className="text-lg text-emerald-100 font-medium animate-pulse font-['Inter']">
                        Application initializing...
                    </p>
                    {/* Simple Spinner */}
                    <Loader2 className="w-10 h-10 text-emerald-100 mt-6 animate-spin" />
                </div>
            </div>
        );
    }

    // 2. Default Processing State (Global Busy State)
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-30 backdrop-blur-sm">
            <div className="flex items-center space-x-3 p-4 bg-white rounded-xl shadow-2xl">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                <span className="text-gray-700 font-semibold font-['Inter']">Processing transaction...</span>
            </div>
        </div>
    );
};

export default MainLoadingOverlay;