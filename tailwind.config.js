// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Ensure Tailwind scans all your template files (adjust paths as needed)
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/pages/PurchasingSubPages/SupplierDetailsPage.jsx",
  ],
  theme: {
    extend: {
      colors: {
        // Defined using numeric shades for stability
        'primary': {
          900: '#264653', // Dark Blue/Green - Dark Text, Sidebar BG
        },
        'secondary': {
          50: '#dff6f4',  // Lightest for backgrounds/hovers
          700: '#2A9D8F', // Base Teal - Main Buttons/Focus
          900: '#228176', // Darker Teal for hover states
        },
        'accent': {
          500: '#E9C46A', // Mustard Yellow - Base Accent
          700: '#c9a75d', // Darker Accent for hover
        },
        'action': {
          50: '#fff5ef',  // Lightest for badges/light hovers
          500: '#F4A261', // Orange - Links, Secondary Buttons
          700: '#d89158', // Darker Orange for hover
        },
        'danger': {
          50: '#fff3f1',  // Lightest for badges/light hovers
          500: '#E76F51', // Red-Orange - Errors, Danger Buttons
          700: '#d0674d', // Darker Red-Orange for hover
        },
      },
    },
  },
  plugins: [],
}