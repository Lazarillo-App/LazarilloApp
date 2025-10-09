/* eslint-disable no-empty */
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
import ForgotPassword from './paginas/ForgotPassword';
import ResetPassword from './paginas/ResetPassword';

import { ThemeProviderNegocio } from './tema/ThemeProviderNegocio';
import { ensureActiveBusiness } from './utils/ensureActiveBusiness';

import { BusinessesAPI } from './servicios/apiBusinesses';
import { obtenerAgrupaciones as apiObtenerAgrupaciones } from './servicios/apiAgrupaciones';
import { SearchProvider } from './servicios/searchContext';

// Auth
import Login from './paginas/Login';
import Register from './paginas/Register';
import Perfil from './paginas/Perfil';
import ProtectedRoute from './componentes/ProtectedRoute';

// Admin
import AdminApp from './admin/AdminApp';

// (Opcional) consola
import { obtenerVentas } from './servicios/apiVentas';
window.apiVentas = { obtenerVentas };

import './css/global.css';
import './css/theme-layout.css';

export default function App() {
  const [bootReady, setBootReady] = useState(false); // no renderizar hasta resolver negocio activo
  const [isLogged, setIsLogged] = useState(!!localStorage.getItem('token'));

  const [activeBusinessId, setActiveBusinessId] = useState(
    localStorage.getItem('activeBusinessId') || ''
  );

  const [agrupaciones, setAgrupaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) return; // irá a /login por rutas protegidas
      let bid = localStorage.getItem('activeBusinessId');
      if (!bid) {
        try {
          const a = await BusinessesAPI.getActive();
          if (a?.activeBusinessId) {
            localStorage.setItem('activeBusinessId', String(a.activeBusinessId));
            window.dispatchEvent(new Event('business:switched'));
          }

        } catch { }
      }
    })();
  }, []);

  // ---------- BOOT ----------
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        setIsLogged(!!token);
        if (!token) { setBootReady(true); return; } // irá a login

        // restaura (o decide) negocio activo
        const id = await ensureActiveBusiness();
        setActiveBusinessId(id ? String(id) : '');
      } finally {
        setBootReady(true);
      }
    })();
  }, []);

  // Escuchar cambios externos del negocio (storage y eventos internos)
  useEffect(() => {
    const sync = () => setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    window.addEventListener('storage', sync);
    window.addEventListener('business:switched', sync);

    // si tu flujo de login dispara un evento, lo enganchamos aquí
    const onLogin = async () => {
      setIsLogged(true);
      const id = await ensureActiveBusiness();
      setActiveBusinessId(id ? String(id) : '');
    };
    window.addEventListener('auth:login', onLogin);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('business:switched', sync);
      window.removeEventListener('auth:login', onLogin);
    };
  }, []);

  // ---------- Carga de datos (depende del negocio activo) ----------
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
      // si no hay negocio activo, limpiamos
      setAgrupaciones([]);
      setCategorias([]);
      return;
    }
    recargarAgrupaciones();
    cargarCategorias();
  }, [bootReady, isLogged, activeBusinessId]);

  const onBusinessSwitched = () => {
    // util cuando un hijo cambia el negocio y queremos refrescar sin esperar listeners
    setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    recargarAgrupaciones();
    cargarCategorias();
  };

  // ---------- Splash mientras resolvemos negocio activo ----------
  if (!bootReady) {
    return <div style={{ padding: 24 }}>Cargando…</div>;
  }

  return (
    <SearchProvider>
      <ThemeProviderNegocio activeBizId={activeBusinessId}>
        {isLogged && <Navbar />}

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* 🔒 Rutas autenticadas */}
          <Route element={<ProtectedRoute />}>

            {/* ✅ Admin NO depende de Maxi ni del negocio activo */}
            <Route path="/admin/*" element={<AdminApp />} />

            {/* ✅ El resto SÍ requiere Maxi/negocio activo */}
            <Route element={<OnboardingGuard />}>
              <Route
                path="/"
                element={
                  <RequireMaxi onReady={() => { }}>
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
              <Route path="/agrupaciones" element={<Agrupaciones actualizarAgrupaciones={recargarAgrupaciones} />} />
              <Route path="/agrupacioneslist" element={<AgrupacionesList agrupaciones={agrupaciones} />} />
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
