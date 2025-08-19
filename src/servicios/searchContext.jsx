import React, { createContext, useContext, useState } from 'react';

const SearchCtx = createContext();

export const SearchProvider = ({ children }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); // strings

  // truquito: normalizar para evitar duplicados
  const setUniqueSuggestions = (arr) => {
    const clean = Array.from(new Set(arr.filter(Boolean))).sort();
    setSuggestions(clean);
  };

  return (
    <SearchCtx.Provider value={{ query, setQuery, suggestions, setSuggestions: setUniqueSuggestions }}>
      {children}
    </SearchCtx.Provider>
  );
};

export const useSearch = () => useContext(SearchCtx);
