// src/main.jsx
import { bootApplySavedPalette } from './tema/paletteBoot';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SearchProvider } from './servicios/searchContext.jsx';
import { APP_BASENAME } from './servicios/apiBase';
import App from './App.jsx';
import './index.css';

bootApplySavedPalette(); 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={APP_BASENAME}>
      <SearchProvider>
        <App />
      </SearchProvider>
    </BrowserRouter>
  </React.StrictMode>
);
