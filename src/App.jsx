// src/App.jsx
import React, { useState, useEffect, useMemo } from 'react';
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

  // sincroniza activeBusinessId si lo cambian desde el switcher
  useEffect(() => {
    const sync = () => setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    window.addEventListener('storage', sync);
    const i = setInterval(sync, 1000); // simple, sin context por ahora
    return () => { window.removeEventListener('storage', sync); clearInterval(i); };
  }, []);

  // Sugerencias para autocompletado
  const sugerencias = useMemo(() => (
    (Array.isArray(categorias) ? categorias : [])
      .flatMap(cat => (cat?.subrubros || []).flatMap(sub => sub?.articulos || []))
      .map(art => art?.nombre)
      .filter(Boolean)
  ), [categorias]);

  const recargarAgrupaciones = async () => {
    try {
      const data = await apiObtenerAgrupaciones();
      setAgrupaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error al cargar agrupaciones:', e);
      setAgrupaciones([]);
    }
  };

  const cargarCategorias = async () => {
    try {
      const bid = localStorage.getItem('activeBusinessId');
      if (!bid) { setCategorias([]); return; }

      // fechas de ejemplo; luego vas a tomar las reales del calendario
      const from = '2025-01-01', to = '2025-04-01';
      const { items } = await BusinessesAPI.maxiArticles(bid, { from, to });
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
        {isLogged && (
          <Navbar
            setAgrupacionSeleccionada={setAgrupacionSeleccionada}
            sugerencias={sugerencias}
          />
        )}

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<OnboardingGuard />}>
              <Route
                path="/"
                element={
                  <RequireMaxi onReady={() => { }}>
                    <ArticulosMain
                      agrupacionSeleccionada={agrupacionSeleccionada}
                      setAgrupacionSeleccionada={setAgrupacionSeleccionada}
                      agrupaciones={agrupaciones}
                      categoriaSeleccionada={categoriaSeleccionada}
                      setCategoriaSeleccionada={setCategoriaSeleccionada}
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