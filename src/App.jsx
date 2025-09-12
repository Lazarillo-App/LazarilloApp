// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

import Navbar from './componentes/Navbar';
import Agrupaciones from './componentes/Agrupaciones';
import AgrupacionesList from './componentes/AgrupacionesList';
import Insumos from './componentes/Insumos';
import RequireMaxi from './componentes/RequireMaxi';
import ThemeProvider from './componentes/ThemeProvider';
import OnboardingGuard from './componentes/OnboardingGuard';

import { BusinessesAPI } from './servicios/apiBusinesses';
import { obtenerAgrupaciones as apiObtenerAgrupaciones } from './servicios/apiAgrupaciones';

import { SearchProvider } from './servicios/searchContext';
import ArticulosMain from './paginas/ArticulosMain';

// Auth
import Login from './paginas/Login';
import Register from './paginas/Register';
import Perfil from './paginas/Perfil';
import ProtectedRoute from './componentes/ProtectedRoute';

// (Opcional) consola
import { obtenerVentas } from './servicios/apiVentas';
window.apiVentas = { obtenerVentas };

const App = () => {
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [categorias, setCategorias] = useState([]);

  // sesión y local activo
  const isLogged = !!localStorage.getItem('token');
  const [activeBusinessId, setActiveBusinessId] = useState(
    localStorage.getItem('activeBusinessId') || ''
  );

  // Mantener sincronizado el business activo si lo cambian desde otro tab o el switcher
  useEffect(() => {
    const sync = () => setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    window.addEventListener('storage', sync);
    const i = setInterval(sync, 1000);
    return () => { window.removeEventListener('storage', sync); clearInterval(i); };
  }, []);

  const recargarAgrupaciones = async () => {
    try {
      const data = await apiObtenerAgrupaciones();
      setAgrupaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error al cargar agrupaciones:', e);
      setAgrupaciones([]);
    }
  };

  // Carga catálogo desde tu BD (endpoint /api/businesses/:id/articles)
  const cargarCategorias = async () => {
    try {
      const bid = localStorage.getItem('activeBusinessId');
      if (!bid) { setCategorias([]); return; }

      const { items } = await BusinessesAPI.articlesFromDB(bid);
      setCategorias(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error('Error al cargar artículos (backend):', e);
      setCategorias([]);
    }
  };

  useEffect(() => {
    if (!isLogged || !activeBusinessId) return;
    recargarAgrupaciones();
    cargarCategorias();
  }, [isLogged, activeBusinessId]);

  const onBusinessSwitched = () => {
    setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    recargarAgrupaciones();
    cargarCategorias();
  };

  return (
    <SearchProvider>
      <ThemeProvider>
        {isLogged && <Navbar />}

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<OnboardingGuard />}>
              <Route
                path="/"
                element={
                  <RequireMaxi onReady={() => {}}>
                    <ArticulosMain
                      agrupacionSeleccionada={agrupacionSeleccionada}
                      setAgrupacionSeleccionada={setAgrupacionSeleccionada}
                      agrupaciones={agrupaciones}
                      categoriaSeleccionada={categoriaSeleccionada}
                      setCategoriaSeleccionada={setCategoriaSeleccionada}
                      // si más adelante usás categorías en la UI, ya las tenés acá
                      categorias={categorias}
                      onBusinessSwitched={onBusinessSwitched}
                    />
                  </RequireMaxi>
                }
              />
              <Route
                path="/agrupaciones"
                element={<Agrupaciones actualizarAgrupaciones={recargarAgrupaciones} />}
              />
              <Route
                path="/agrupacioneslist"
                element={<AgrupacionesList agrupaciones={agrupaciones} />}
              />
              <Route path="/insumos" element={<Insumos />} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>
          </Route>
          <Route path="*" element={<Login />} />
        </Routes>
      </ThemeProvider>
    </SearchProvider>
  );
};

export default App;
