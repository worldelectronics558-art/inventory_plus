// src/components/AppLayout.jsx

import React from 'react';
import Sidebar from './Sidebar';

const AppLayout = ({ children }) => {
    // We define the layout structure here: Sidebar (fixed width) + Main Content (flex-grow)
    // The main container sets the overall application background and min-height.
    return (
        <div className="flex min-h-screen w-full bg-gray-100">
            
            {/* 1. Sidebar Component: 
                - It uses 'fixed' positioning in its own file, so we don't need utility classes here.
            */}
            <Sidebar />

            {/* 2. Main Content Area: 
                - We need to add a left margin equal to the width of the fixed sidebar (w-64 = ml-64).
                - flex-1 ensures it takes the remaining width.
                - overflow-x-hidden prevents horizontal scroll issues.
            */}
            <main className="flex-1 ml-64 p-0 overflow-x-hidden">
                {/* All routed components (like ProductsPage) will render here. 
                    The page's PADDING (p-8) should be defined inside the page component itself. */}
                {children}
            </main>
        </div>
    );
};

export default AppLayout;