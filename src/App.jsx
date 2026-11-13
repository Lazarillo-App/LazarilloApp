/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';

import Navbar from './componentes/Navbar';
import AnthonyWidget from './componentes/AnthonyWidget';
import AnthonyChat from './componentes/asistente/AnthonyChat';
//import Agrupaciones from './componentes/Agrupaciones';
import AgrupacionesList from './componentes/AgrupacionesList';
import Insumos from './paginas/InsumosMain';
import PlazaPage from './paginas/PlazaPage';
import RequireMaxi from './componentes/RequireMaxi';
import OnboardingGuard from './componentes/OnboardingGuard';
import ArticulosMain from './paginas/ArticulosMain';
import GestionLayout from './componentes/GestionLayout';
import ConfiguracionMain from './paginas/ConfiguracionMain';
import RequireSeccion from './componentes/RequireSeccion';
import RequireAdminOrOwner from './componentes/RequireAdminOrOwner';
import ForgotPassword from './paginas/ForgotPassword';
import ResetPassword from './paginas/ResetPassword';
import UploadFoto from './paginas/UploadFoto';
import NegocioPausado from './paginas/NegocioPausado';
import UpdateBanner from './componentes/UpdateBanner';
import ImpersonateBanner from './componentes/ImpersonateBanner';
import { VerComoBanner } from './componentes/VerComo';
import EnMantenimiento from './paginas/EnMantenimiento';
import { ThemeProviderNegocio } from './tema/ThemeProviderNegocio';
import AppAlertModal from './componentes/AppAlertModal';
import AppPromptModal from './componentes/AppPromptModal';
import AppConfirmModal from './componentes/AppConfirmModal';
import { ensureActiveBusiness } from './utils/ensureActiveBusiness';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BusinessesAPI } from './servicios/apiBusinesses';
import { obtenerAgrupaciones as apiObtenerAgrupaciones } from './servicios/apiAgrupaciones';
import AsistenteOnboarding from './componentes/asistente/AsistenteOnboarding';
import Login from './paginas/Login';
import LazarilloLanding from './paginas/LazarilloLanding';
import Register from './paginas/Register';
import Perfil from './paginas/Perfil';
import AltaRetomar from './paginas/AltaRetomar';
import Inicio from './paginas/Inicio';
import RrhhCronogramas from './paginas/RrhhCronogramas';
import RrhhNomina from './paginas/RrhhNomina';
import GestionPanel from './paginas/GestionPanel';
// Conciliación bancaria (14/11): pesada, se carga solo al entrar.
const Conciliacion = lazy(() => import('./paginas/Conciliacion'));
import GestionConceptos from './paginas/GestionConceptos';
import GestionMediosPago from './paginas/GestionMediosPago';
import GestionMovil from './paginas/GestionMovil';
import { irACelular, elegirPanelCompleto } from './gestion/vistaCelular';
import ProtectedRoute from './componentes/ProtectedRoute';
import RequireActiveAccount from './routing/RequireActiveAccount';
import Activar from './paginas/Activar';
import AdminApp from './admin/AdminApp';
// ── NUEVAS PÁGINAS ──
import AceptarInvitacion from './paginas/AceptarInvitacion';
import AltaPorQR from './paginas/AltaPorQR';
import SelectorNegocio from './paginas/SelectorNegocio';
import SuperPanel from './paginas/SuperPanel';
import AvisoAjuste from './componentes/soporte/AvisoAjuste';

import './css/global.css';
import './css/theme-layout.css';

function readRole() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return (JSON.parse(raw) || {}).role || null;
  } catch { return null; }
}

// En un celular el Panel abre la versión celular (/m), como en lazarillo_gestion. ?completa=1 (desde
// «Abrir el Panel completo» de /m) se recuerda en el celular. Lo que venga en la URL pasa igual a /m.
function PanelOCelular() {
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  if (sp.get('completa') === '1') elegirPanelCompleto();
  else if (irACelular()) return <Navigate to={sp.get('cargar') === '1' ? '/m?tab=cargar' : '/m'} replace />;
  return <GestionPanel />;
}

export default function App() {
  const location = useLocation();
  useDocumentTitle();
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

    categorias.forEach((item) => {
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
              searchText: nombre,
            });
          });
        });
        return;
      }
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

  useDocumentTitle();

  if (!bootReady) return <div style={{ padding: 24 }}>Cargando…</div>;
  const enAppMovil = location.pathname === '/m';
  return (
    <ThemeProviderNegocio activeBizId={activeBusinessId}>
      <AppAlertModal />
      <AppPromptModal />
      <AppConfirmModal />
      <UpdateBanner />
      <ImpersonateBanner />
      {isLogged && <VerComoBanner />}
      {isLogged && role !== 'app_admin' && !enAppMovil && <Navbar />}
      {isLogged && role !== 'app_admin' && !enAppMovil && <AnthonyWidget />}
      {/* Chat "Que lo haga Lazarillo": también en el alta (ahí el widget no se muestra). */}
      {isLogged && role !== 'app_admin' && <AnthonyChat />}
      {/* Ajuste a medida "aviso_cliente": mensaje del equipo para este cliente/negocio (13/11). */}
      {isLogged && role !== 'app_admin' && !enAppMovil && <AvisoAjuste />}

      <Routes>
        <Route path="/" element={isLogged ? <Navigate to="/inicio" replace /> : <LazarilloLanding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/activar" element={<Activar />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/upload-foto" element={<UploadFoto />} />
        <Route path="/negocio-pausado" element={<NegocioPausado />} />
        <Route path="/en-mantenimiento" element={<EnMantenimiento />} />

        {/* ── Pública: aceptar invitación ── */}
        <Route path="/aceptar-invitacion" element={<AceptarInvitacion />} />

        {/* ── Pública: alta por QR de sucursal (Vista Operación) ── */}
        <Route path="/r/:code" element={<AltaPorQR />} />

        <Route element={<ProtectedRoute />}>
          {/* ADMIN independiente del negocio */}
          <Route path="/admin/*" element={<AdminApp />} />

          {/* App "normal" solo si no es app_admin */}
          {role !== 'app_admin' ? (
            <Route element={<RequireActiveAccount />}>
              {/* ── Selector full-screen: NO va dentro de OnboardingGuard
                   (el selector justamente sirve para elegir negocio cuando
                    hay varios y aún no se seleccionó uno) ── */}
              <Route path="/seleccionar-negocio" element={<SelectorNegocio />} />
              {/* Panel de super usuarios (13/11): no depende de tener negocio; lo valida la página y el back. */}
              <Route path="/super" element={<SuperPanel />} />

              <Route element={<OnboardingGuard />}>
                {/* Menú e Insumos comparten la barra (no se recarga al pasar de una a otra) */}
                <Route element={<GestionLayout />}>
                <Route
                  path="/menu"
                  element={
                    <RequireSeccion seccion="recetas">
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
                    </RequireSeccion>
                  }
                />
                <Route
                  path="/insumos"
                  element={
                    <RequireSeccion seccion="recetas"><Insumos /></RequireSeccion>
                  }
                />
                </Route>
                {/* Plaza de despacho (Diego 11/11/2026): la lámina de armado de sus productos. */}
                <Route path="/plaza/:id" element={<RequireSeccion seccion="recetas"><PlazaPage /></RequireSeccion>} />
                <Route
                  path="/agrupacioneslist"
                  element={<AgrupacionesList agrupaciones={agrupaciones} />}
                />
                {/* ── RRHH › Cronogramas (Etapa 1) ── */}
                <Route path="/rrhh/cronogramas" element={<RequireAdminOrOwner><RequireSeccion seccion="rrhh"><RrhhCronogramas /></RequireSeccion></RequireAdminOrOwner>} />
                <Route path="/rrhh/nomina" element={<RequireAdminOrOwner><RequireSeccion seccion="rrhh"><RrhhNomina /></RequireSeccion></RequireAdminOrOwner>} />
                {/* ── Panel de Gestión (port de lazarillo_gestion; solo owner/admin) ── */}
                <Route path="/m" element={<RequireAdminOrOwner><RequireSeccion seccion="resultados"><GestionMovil /></RequireSeccion></RequireAdminOrOwner>} />
                <Route path="/conciliacion" element={<RequireAdminOrOwner><Suspense fallback={<div style={{ padding: 32 }}>Cargando…</div>}><Conciliacion /></Suspense></RequireAdminOrOwner>} />
                <Route path="/gestion" element={<RequireAdminOrOwner><RequireSeccion seccion={['resultados', 'carga']}><PanelOCelular /></RequireSeccion></RequireAdminOrOwner>} />
                <Route path="/gestion/conceptos" element={<RequireAdminOrOwner><RequireSeccion seccion="conceptos"><GestionConceptos /></RequireSeccion></RequireAdminOrOwner>} />
                <Route path="/gestion/medios-pago" element={<RequireAdminOrOwner><RequireSeccion seccion="medios"><GestionMediosPago /></RequireSeccion></RequireAdminOrOwner>} />
                <Route path="/perfil" element={<Perfil activeBusinessId={activeBusinessId} />} />
                <Route path="/alta" element={<RequireAdminOrOwner><AltaRetomar /></RequireAdminOrOwner>} />
                <Route path="/inicio" element={<Inicio />} />
                <Route path="/configuracion" element={<RequireAdminOrOwner><RequireSeccion seccion={['configuracion', 'conexiones']}><ConfiguracionMain /></RequireSeccion></RequireAdminOrOwner>} />
              </Route>
            </Route>
          ) : (
            <Route path="/menu" element={<AdminApp />} />
          )}
        </Route>

        <Route path="*" element={isLogged ? <Navigate to="/inicio" replace /> : <LazarilloLanding />} />

      </Routes>
    </ThemeProviderNegocio>
  );
}
