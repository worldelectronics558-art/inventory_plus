// src/contexts/LoadingContext.jsx

import React, { createContext, useContext, useState } from 'react';

// 1. Create the Context object
const LoadingContext = createContext();

// 2. Create a custom hook for easier use in components
export const useLoading = () => {
  return useContext(LoadingContext);
};

// 3. Create the Provider component
export const LoadingProvider = ({ children }) => {
  // 🚨 CHANGE 1: Unique state variable name
  const [isAppProcessing, setIsAppProcessing] = useState(false);

  // 🚨 CHANGE 2: Unique setter function name
  const setAppProcessing = (state) => {
    setIsAppProcessing(state);
  };

  const value = {
    // Expose the unique names
    isAppProcessing,
    setAppProcessing,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};