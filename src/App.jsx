// src/App.jsx
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

export default function App() {
  const [bootReady, setBootReady] = useState(false);           // ⬅️ clave: no renderizar hasta estar listos
  const [isLogged, setIsLogged] = useState(!!localStorage.getItem('token'));

  const [activeBusinessId, setActiveBusinessId] = useState(
    localStorage.getItem('activeBusinessId') || ''
  );

  const [agrupaciones, setAgrupaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);

  // ---- BOOT: asegurar token y negocio activo antes de pintar datos ----
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        setIsLogged(!!token);
        if (!token) { setBootReady(true); return; } // irá a login

        // Asegurar activeBusinessId: si no hay, elegir el primero del usuario
        let bid = localStorage.getItem('activeBusinessId');
        if (!bid) {
          const mine = await BusinessesAPI.listMine(); // withBusinessId:false
          const first = mine?.[0]?.id;
          if (first) {
            await BusinessesAPI.select(first);        // fija negocio activo en back
            bid = String(first);
            localStorage.setItem('activeBusinessId', bid);
            // avisar a componentes que escuchan
            window.dispatchEvent(new Event('business:switched'));
          }
        }
        setActiveBusinessId(bid || '');
      } catch (e) {
        // token inválido: limpieza suave
        localStorage.removeItem('token');
        localStorage.removeItem('activeBusinessId');
        setIsLogged(false);
        setActiveBusinessId('');
      } finally {
        setBootReady(true);
      }
    })();
  }, []);

  // Mantener sync si otro componente cambia el negocio
  useEffect(() => {
    const sync = () => setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    window.addEventListener('storage', sync);
    window.addEventListener('business:switched', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('business:switched', sync);
    };
  }, []);

  // Cargas de datos (solo cuando ya tenemos negocio activo)
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
    if (!bootReady || !isLogged || !activeBusinessId) {
      // si cambiamos de negocio o salimos, limpiamos vista
      setAgrupaciones([]);
      setCategorias([]);
      return;
    }
    recargarAgrupaciones();
    cargarCategorias();
  }, [bootReady, isLogged, activeBusinessId]);

  const onBusinessSwitched = () => {
    setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    recargarAgrupaciones();
    cargarCategorias();
  };

  // Splash muy simple mientras resolvemos negocio activo
  if (!bootReady) {
    return (
      <div style={{ padding: 24 }}>
        Cargando…
      </div>
    );
  }

  return (
    <SearchProvider>
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
}
