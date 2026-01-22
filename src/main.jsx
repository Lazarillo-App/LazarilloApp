// src/main.jsx
import { bootApplySavedPalette } from './tema/paletteBoot';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/reactQueryClient';
import { SearchProvider } from './servicios/searchContext.jsx';
import { APP_BASENAME } from './servicios/apiBase';
import App from './App.jsx';
import './index.css';

// Contextos
import { AuthProvider } from './context/AuthContext.jsx';
import { BusinessProvider } from './context/BusinessContext.jsx';

bootApplySavedPalette();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BusinessProvider> 
          <BrowserRouter basename={APP_BASENAME}>
            <SearchProvider>
              <App />
            </SearchProvider>
          </BrowserRouter>
        </BusinessProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);