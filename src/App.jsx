import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

import Navbar from './componentes/Navbar';
import Agrupaciones from './componentes/Agrupaciones';
import AgrupacionesList from './componentes/AgrupacionesList';
import Insumos from './componentes/Insumos';
import RequireMaxi from './componentes/RequireMaxi';
import OnboardingGuard from './componentes/OnboardingGuard';
import ArticulosMain from './paginas/ArticulosMain';

import { ThemeProviderNegocio } from './tema/ThemeProviderNegocio';

import { BusinessesAPI } from './servicios/apiBusinesses';
import { obtenerAgrupaciones as apiObtenerAgrupaciones } from './servicios/apiAgrupaciones';
import { SearchProvider } from './servicios/searchContext';

// Auth
import Login from './paginas/Login';
import Register from './paginas/Register';
import Perfil from './paginas/Perfil';
import ProtectedRoute from './componentes/ProtectedRoute';

// (Opcional) consola
import { obtenerVentas } from './servicios/apiVentas';
window.apiVentas = { obtenerVentas };

import './css/global.css';
import './css/theme-layout.css';

const App = () => {
  const isLogged = !!localStorage.getItem('token');

  const [activeBusinessId, setActiveBusinessId] = useState(
    localStorage.getItem('activeBusinessId') || ''
  );

  const [agrupaciones, setAgrupaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);

  useEffect(() => {
    const sync = () => setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    window.addEventListener('storage', sync);
    window.addEventListener('business:switched', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('business:switched', sync);
    };
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
    if (!isLogged || !activeBusinessId) {
      setAgrupaciones([]);
      setCategorias([]);
      return;
    }
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
      {/* 👇 El provider recibe el activeBusinessId para aplicar tema del backend */}
      <ThemeProviderNegocio activeBizId={activeBusinessId}>
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
                      categoriaSeleccionada={categoriaSeleccionada}
                      setCategoriaSeleccionada={setCategoriaSeleccionada}
                      agrupaciones={agrupaciones}
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
      </ThemeProviderNegocio>
    </SearchProvider>
  );
};

export default App;

