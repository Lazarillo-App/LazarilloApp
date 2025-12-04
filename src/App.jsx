import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

import Navbar from './componentes/Navbar';
import Agrupaciones from './componentes/Agrupaciones';
import AgrupacionesList from './componentes/AgrupacionesList';
import Insumos from './paginas/InsumosMain';
import RequireMaxi from './componentes/RequireMaxi';
import OnboardingGuard from './componentes/OnboardingGuard';
import ArticulosMain from './paginas/ArticulosMain';
import ForgotPassword from './paginas/ForgotPassword';
import ResetPassword from './paginas/ResetPassword';

import { ThemeProviderNegocio } from './tema/ThemeProviderNegocio';
import { ensureActiveBusiness } from './utils/ensureActiveBusiness';

import { BusinessesAPI } from './servicios/apiBusinesses';
import { obtenerAgrupaciones as apiObtenerAgrupaciones } from './servicios/apiAgrupaciones';

import Login from './paginas/Login';
import Register from './paginas/Register';
import Perfil from './paginas/Perfil';
import ProtectedRoute from './componentes/ProtectedRoute';
import AdminApp from './admin/AdminApp';
import './css/global.css';
import './css/theme-layout.css';

function readRole() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return (JSON.parse(raw) || {}).role || null;
  } catch { return null; }
}

export default function App() {
  const [bootReady, setBootReady] = useState(false);
  const [isLogged, setIsLogged] = useState(!!localStorage.getItem('token'));
  const [role, setRole] = useState(readRole());

  const [activeBusinessId, setActiveBusinessId] = useState(
    localStorage.getItem('activeBusinessId') || ''
  );

  const [agrupaciones, setAgrupaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);

  // Opciones del buscador: ART + INS
  const globalSearchOptions = useMemo(() => {
    const out = [];
    if (!Array.isArray(categorias)) return out;

    // ---------- ARTÍCULOS ----------
    categorias.forEach((item) => {
      // Caso 1: estructura árbol (subrubro > categoría > artículos)
      if (Array.isArray(item.categorias)) {
        const subName = item.subrubro || 'Sin subrubro';
        item.categorias.forEach((cat) => {
          const catName = cat.categoria || 'Sin categoría';
          (cat.articulos || []).forEach((a) => {
            const id = Number(a.id);
            if (!Number.isFinite(id)) return;
            const nombre = (a.nombre || '').trim() || `#${id}`;
            out.push({
              id: `articulo:${id}`,
              type: 'articulo',
              articuloId: id,
              label: `[ART] ${subName} › ${catName} · ${nombre} · ${id}`,
              // texto "limpio" para filtrar en tablas/APIs
              searchText: nombre,
            });
          });
        });
        return;
      }

      // Caso 2: lista plana de artículos
      const id = Number(item.id);
      if (!Number.isFinite(id)) return;
      const nombre = (item.nombre || '').trim() || `#${id}`;
      const codigo = item.codigo || '';
      out.push({
        id: `articulo:${id}`,
        type: 'articulo',
        articuloId: id,
        label: `[ART] ${codigo ? codigo + ' – ' : ''}${nombre}`,
        searchText: nombre,
      });
    });

    return out;
  }, [categorias]);


  // resolver negocio activo (o nada si es app_admin)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        setIsLogged(!!token);
        setRole(readRole());

        if (!token) { setBootReady(true); return; }

        if (readRole() === 'app_admin') {
          setActiveBusinessId('');
          setBootReady(true);
          return;
        }

        const id = await ensureActiveBusiness();
        setActiveBusinessId(id ? String(id) : '');
      } finally {
        setBootReady(true);
      }
    })();
  }, []);

  // listeners de cambios externos
  useEffect(() => {
    const syncBiz = () => setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    const syncAuth = () => {
      const token = localStorage.getItem('token');
      setIsLogged(!!token);
      setRole(readRole());
      if (!token) {
        setActiveBusinessId('');
        setAgrupaciones([]);
        setCategorias([]);
      }
    };

    window.addEventListener('storage', syncBiz);
    window.addEventListener('business:switched', syncBiz);
    window.addEventListener('auth:login', syncAuth);
    window.addEventListener('auth:logout', syncAuth);

    return () => {
      window.removeEventListener('storage', syncBiz);
      window.removeEventListener('business:switched', syncBiz);
      window.removeEventListener('auth:login', syncAuth);
      window.removeEventListener('auth:logout', syncAuth);
    };
  }, []);

  // carga de datos solo para usuarios NO-admin con negocio activo
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
    if (!bootReady || !isLogged) return;

    if (role === 'app_admin' || !activeBusinessId) {
      setAgrupaciones([]);
      setCategorias([]);
      return;
    }
    recargarAgrupaciones();
    cargarCategorias();
  }, [bootReady, isLogged, role, activeBusinessId]);

  const onBusinessSwitched = () => {
    setActiveBusinessId(localStorage.getItem('activeBusinessId') || '');
    recargarAgrupaciones();
    cargarCategorias();
  };

  if (!bootReady) return <div style={{ padding: 24 }}>Cargando…</div>;

  return (
    <ThemeProviderNegocio activeBizId={activeBusinessId}>
      {isLogged && <Navbar />}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          {/* ADMIN independiente del negocio */}
          <Route path="/admin/*" element={<AdminApp />} />

          {/* App “normal” solo si no es app_admin */}
          {role !== 'app_admin' ? (
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
                      activeBizId={activeBusinessId}
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
              <Route
                path="/insumos"
                element={
                  <Insumos/>
                }
              />
              <Route path="/perfil" element={<Perfil activeBusinessId={activeBusinessId} />} />
            </Route>
          ) : (
            <Route path="/" element={<AdminApp />} />
          )}
        </Route>

        <Route path="*" element={<Login />} />
      </Routes>
    </ThemeProviderNegocio>
  );
}
