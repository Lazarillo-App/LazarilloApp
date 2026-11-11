import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Menu, MenuItem, MenuList,
  Box, Container, Avatar, Tooltip, Button, Divider,
  Snackbar, Alert, LinearProgress, Badge, ClickAwayListener
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import logoLight from '@/assets/brand/logo-light.png';
import logoDark from '@/assets/brand/logo-dark.png';
import SucursalSelector from './SucursalSelector';
import SucursalesChips from './SucursalesChips';
import SucursalPrincipalFaltante from './SucursalPrincipalFaltante';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { RecetasAPI } from '@/servicios/apiBusinesses';
import { BASE } from '@/servicios/apiBase';
import BusinessDivisionSelector from './BusinessDivisionSelector';
import NotificationsPanel from '@/componentes/NotificationsPanel';
import ModulosDrawer from './ModulosDrawer';
import PulsoDatos from './PulsoDatos';
import { VerComoItems } from '@/componentes/VerComo';

/* ==== helpers ==== */
const hexToRgb = (hex) => {
  const h = String(hex || '').trim();
  const m = h.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const num = parseInt(s, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

const luminance = (rgb) => {
  if (!rgb) return 0;
  const toLin = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = toLin(rgb.r), G = toLin(rgb.g), B = toLin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const onColorFor = (bgHex) => (luminance(hexToRgb(bgHex)) > 0.179 ? '#000000' : '#ffffff');

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null') || null;
  } catch {
    return null;
  }
};

const getUserRole = () => getUser()?.role || null;

const getUserAvatarUrl = () => {
  const u = getUser();
  return u?.photo_url || u?.avatar_url || u?.picture || '';
};
// Iniciales del nombre del usuario logueado (ej. "María Perez" → "MP") para el avatar del navbar
const getUserInitials = () => {
  const u = getUser();
  const nombre = String(u?.name || u?.nombre || u?.email || '').trim();
  if (!nombre) return '';
  const partes = nombre.split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

export default function Navbar() {
  const [navEl, setNavEl] = React.useState(null);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [modulosOpen, setModulosOpen] = React.useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Detectar en qué sector estamos para navegar directo al tab correcto
  const getConfigTab = () => {
    const path = location.pathname;
    if (path.includes('/insumos')) return '1';   // tab Insumos
    if (path.includes('/articulos') || path === '/') return '0'; // tab Artículos
    if (path.includes('/perfil')) return '3';    // tab Organización
    return null; // sin preferencia
  };

  const logged = !!localStorage.getItem('token');
  const role = getUserRole();
  const isAppAdmin = role === 'app_admin';

  // Rol efectivo en el negocio activo (owner = puede crear/editar/borrar negocios)
  const { isOwner, isStaff, puedeVer = () => true, rolReal } = useAccess() || {};

  const { activeBusinessId, items: negocios } = useBusiness() || {};
  // Alta de un usuario sin negocios (/perfil muestra el asistente): el header
  // dice "Asistente de alta" en lugar de Artículos/Insumos/Menú.
  const enAlta = !isAppAdmin && (location.pathname.startsWith('/alta') || (location.pathname.startsWith('/perfil') && (!negocios || negocios.length === 0)));

  // Badge de alertas en el ícono de configuración
  const [alertasBadge, setAlertasBadge] = useState(0);
  useEffect(() => {
    if (!activeBusinessId) return;
    let alive = true;
    const token = localStorage.getItem('token') || '';
    const headers = { Authorization: `Bearer ${token}`, 'X-Business-Id': String(activeBusinessId) };

    Promise.all([
      // Alertas de insumos con compras vencidas
      RecetasAPI.getAlertas(Number(activeBusinessId)).catch(() => ({ total: 0 })),
      // Alertas de ventas sin datos recientes
      fetch(`${BASE}/businesses/${activeBusinessId}/articles-alertas-ventas`, { headers })
        .then(r => r.json()).catch(() => ({ hayAlerta: false })),
    ]).then(([insumosRes, ventasRes]) => {
      if (!alive) return;
      const totalInsumos = insumosRes?.total || 0;
      const alertaVentas = ventasRes?.hayAlerta ? 1 : 0;
      setAlertasBadge(totalInsumos + alertaVentas);
    });
    return () => { alive = false; };
  }, [activeBusinessId]);

  const [colors, setColors] = React.useState(() => ({
    primary: '#111111',
    onPrimary: '#ffffff',
  }));

  const recomputeColors = React.useCallback(() => {
    const root = document.documentElement;
    let primary = getComputedStyle(root).getPropertyValue('--color-primary').trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(primary)) primary = '#111111';
    const onPrimary = onColorFor(primary);
    root.style.setProperty('--on-primary', onPrimary);

    setColors((prev) => (prev.primary === primary && prev.onPrimary === onPrimary ? prev : { primary, onPrimary }));
  }, []);

  const [userAvatar, setUserAvatar] = React.useState(getUserAvatarUrl());
  const [userInitials, setUserInitials] = React.useState(getUserInitials());

  const [syncRunning, setSyncRunning] = React.useState(false);
  const [syncTotal, setSyncTotal] = React.useState(0);
  const [snack, setSnack] = React.useState({
    open: false,
    msg: '',
    sev: 'success',
  });

  // Nombre del módulo bajo el logo (Diego 10/11/2026): el mismo que en el menú de módulos.
  const conFilaSucursales = !isAppAdmin && (location.pathname.startsWith('/menu') || location.pathname.startsWith('/insumos')
    || location.pathname === '/gestion' || location.pathname.startsWith('/rrhh/cronogramas'));
  const nombreModulo = (() => {
    const p = location.pathname;
    if (p.startsWith('/gestion/medios-pago')) return 'Medios de pago';
    if (p.startsWith('/gestion')) return 'Resultados';
    if (p.startsWith('/menu') || p.startsWith('/insumos') || p.startsWith('/agrupacioneslist')) return 'Recetas';
    if (p.startsWith('/rrhh')) return 'RRHH';
    return null;
  })();

  const isLightBg = colors.onPrimary === '#000000';
  const brandSrc = isLightBg ? logoDark : logoLight;

  React.useEffect(() => {
    recomputeColors();
    setUserAvatar(getUserAvatarUrl());
    setUserInitials(getUserInitials());
    const onThemeUpdated = () => recomputeColors();
    const onPaletteChanged = () => recomputeColors();
    const onLogin = () => { setUserAvatar(getUserAvatarUrl()); setUserInitials(getUserInitials()); };
    const onLogout = () => {
      setUserAvatar('');
      setUserInitials('');
      recomputeColors();
    };

    window.addEventListener('theme:updated', onThemeUpdated);
    window.addEventListener('palette:changed', onPaletteChanged);
    window.addEventListener('auth:login', onLogin);
    window.addEventListener('auth:logout', onLogout);

    return () => {
      window.removeEventListener('theme:updated', onThemeUpdated);
      window.removeEventListener('palette:changed', onPaletteChanged);
      window.removeEventListener('auth:login', onLogin);
      window.removeEventListener('auth:logout', onLogout);
    };
  }, [recomputeColors]);

  React.useEffect(() => {
    const onStart = (e) => {
      const total = Number(e?.detail?.total || 0);
      setSyncTotal(total);
      setSyncRunning(true);
    };

    const onDone = () => {
      setSyncRunning(false);
    };

    window.addEventListener('business:auto-sync-start', onStart);
    window.addEventListener('business:auto-sync-done', onDone);

    return () => {
      window.removeEventListener('business:auto-sync-start', onStart);
      window.removeEventListener('business:auto-sync-done', onDone);
    };
  }, []);

  const logout = () => {
    const uid = getUser()?.id || null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeBusinessId');
    localStorage.removeItem('bizTheme');
    if (uid) localStorage.removeItem(`bizTheme:${uid}`);
    window.dispatchEvent(new Event('auth:logout'));
    navigate('/login', { replace: true });
  };

  // Nunca a "/" (landing de marketing): este navbar solo se muestra logueada,
  // así que el logo tiene que llevar siempre adentro de la app.
  // Staff: su casa son los artículos (no ve Inicio ni módulos, usuaria 10/11).
  const homeTo = isAppAdmin ? '/admin' : isStaff ? '/menu' : '/inicio';

  return (
    <>
      {!isAppAdmin && <SucursalPrincipalFaltante />}
      <AppBar
        position="static"
        sx={{
          backgroundColor: 'var(--color-primary, #111111)',
          color: 'var(--on-primary, #ffffff)',
          borderBottom: '1px solid color-mix(in srgb, var(--on-primary, #000) 12%, transparent)',
          boxShadow: 'none',
          // Celular: barra de 56 px, la misma altura que la versión celular del Panel (Diego 08/11/2026).
          '@media (max-width: 899.95px)': {
            '& .MuiToolbar-root': { minHeight: 56, height: 56 },
            '& .navbar-biz-logo': { height: '34px !important', maxWidth: 90 },
            '& .navbar-biz-fallback': { width: '34px !important', height: '34px !important', fontSize: '15px !important' },
            '& .navbar-biz-name': { fontSize: '0.95rem !important' },
            '& .navbar-user-avatar': { width: 36, height: 36, fontSize: '0.9rem' },
            '& .MuiIconButton-sizeLarge': { padding: '8px' },
          },
        }}
      >
        {/* Sin el maxWidth="xl" (1536px) de MUI: con eso el contenido quedaba
            centrado con franjas vacías a los costados en pantallas grandes,
            mientras el resto de la app ocupa el ancho completo. Pero del todo
            sin tope (maxWidth={false} a secas) el logo y los links quedaban
            pegados a la izquierda con un hueco creciente antes del selector de
            negocio/avatar en pantallas grandes — mismo problema, en el medio
            en vez de en los costados. 1800px cubre laptops/monitores comunes
            sin ningún recorte; recién en ultrawide/4K+ aparece un margen, ahí
            sí simétrico en los dos costados (no un hueco raro de un solo lado). */}
        <Container maxWidth={false} sx={{ px: { xs: 1.5, sm: 2, md: 3 }, maxWidth: '1800px !important', mx: 'auto' }}>
          <Toolbar disableGutters sx={{ color: 'inherit', gap: 1 }}>
            {/* Logo + pulso de los datos (Diego, 06/11/2026: el punto va al lado del logo) */}
            {/* Con la fila de sucursales abajo de los botones, el logo se alinea con la fila de
                botones, no con el centro de la barra (Diego 10/11/2026: «antes el logo coincidía
                con los botones»): misma altura y mismo margen de arriba que esa fila. */}
            <Box
              sx={{
                mr: 2,
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 1,
                pr: '50px',
                ...(conFilaSucursales ? { alignSelf: 'flex-start', mt: 0.75, height: 36.5 } : {}),
              }}
            >
              <Box
                component={NavLink}
                to={homeTo}
                aria-label="Ir al inicio"
                sx={{ position: 'relative', display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
              >
                <Box
                  component="img"
                  src={brandSrc}
                  alt="Lazarillo"
                  sx={{
                    height: 45,
                    display: 'block',
                    filter: isLightBg
                      ? 'drop-shadow(0 0 1px rgba(0,0,0,.45))'
                      : 'none',
                  }}
                />
                {nombreModulo && (
                  // Colgado bajo el logo sin ocupar lugar: el logo mantiene su tamaño y el punto de
                  // pulso queda centrado con él (Diego 10/11/2026: «quisiera el tamaño anterior»).
                  <Box component="span" sx={{
                    position: 'absolute', left: 2, top: 'calc(100% + 1px)', fontFamily: "'Sora', 'Archivo', sans-serif", fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.22em', lineHeight: 1, textTransform: 'uppercase', opacity: 0.8, whiteSpace: 'nowrap',
                  }}>
                    {nombreModulo}
                  </Box>
                )}
              </Box>
              {/* Staff: sin pulso de datos (es info de administración, usuaria 10/11). */}
              {!isAppAdmin && !isStaff && <PulsoDatos puedeActualizar />}
            </Box>

            {/* Mobile – hamburguesa */}
            <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
              <IconButton
                size="large"
                sx={{ color: 'inherit' }}
                onClick={(e) => setNavEl(e.currentTarget)}
                aria-label="Abrir menú principal"
              >
                <MenuIcon />
              </IconButton>

              <Menu
                anchorEl={navEl}
                open={Boolean(navEl)}
                onClose={() => setNavEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                sx={{
                  display: { xs: 'block', md: 'none' },
                  '& .MuiPaper-root': {
                    background: 'var(--color-primary)',
                    color: 'var(--on-primary)',
                  },
                }}
                MenuListProps={{ 'aria-label': 'Navegación principal' }}
              >
                <MenuList dense sx={{ color: 'inherit' }}>
                  {enAlta && <MenuItem disabled sx={{ opacity: '1 !important' }}>Asistente de alta</MenuItem>}
                  {!enAlta && location.pathname.startsWith('/rrhh') && !isAppAdmin ? [
                    <MenuItem key="rrhh-crono" component={NavLink} to="/rrhh/cronogramas" onClick={() => setNavEl(null)}>Cronogramas</MenuItem>,
                    <MenuItem key="rrhh-liq" disabled>Liquidación · Próximamente</MenuItem>,
                    <MenuItem key="rrhh-fich" disabled>Fichaje · Próximamente</MenuItem>,
                    <Divider key="rrhh-div" sx={{ borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)' }} />,
                    <MenuItem key="rrhh-nom" component={NavLink} to="/rrhh/nomina" onClick={() => setNavEl(null)}>Nómina</MenuItem>,
                  ] : null}
                  {!enAlta && !isAppAdmin && location.pathname.startsWith('/gestion') ? [
                    puedeVer('conceptos') && <MenuItem key="g-conc" component={NavLink} to="/gestion/conceptos" onClick={() => setNavEl(null)}>Conceptos de caja</MenuItem>,
                    puedeVer('recetas') && <MenuItem key="g-ins" component={NavLink} to="/insumos" onClick={() => setNavEl(null)}>Insumos</MenuItem>,
                    puedeVer('carga') && <MenuItem key="g-prov" onClick={() => { setNavEl(null); navigate('/gestion?proveedores=1'); }}>Proveedores</MenuItem>,
                  ] : null}
                  {!enAlta && puedeVer('recetas') && !location.pathname.startsWith('/rrhh') && !(!isAppAdmin && location.pathname.startsWith('/gestion')) && (
                  <MenuItem component={NavLink} to="/menu" onClick={() => setNavEl(null)}>
                    {isAppAdmin ? 'Menú' : 'Artículos'}
                  </MenuItem>
                  )}

                  {!enAlta && !isAppAdmin && puedeVer('recetas') && !location.pathname.startsWith('/rrhh') && !location.pathname.startsWith('/gestion') && (
                    <MenuItem component={NavLink} to="/insumos" onClick={() => setNavEl(null)}>
                      Insumos
                    </MenuItem>
                  )}

                  {!enAlta && !isAppAdmin && !isStaff && puedeVer('recetas') && !location.pathname.startsWith('/rrhh') && !location.pathname.startsWith('/gestion') && (
                    <MenuItem onClick={() => { setNavEl(null); navigate('/menu?vista=diseno'); }}>
                      Menú
                    </MenuItem>
                  )}


                  {isAppAdmin && (
                    <MenuItem component={NavLink} to="/admin" onClick={() => setNavEl(null)}>
                      Admin
                    </MenuItem>
                  )}
                </MenuList>
              </Menu>
            </Box>

{/* Desktop – links */}
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'flex-start', gap: 1, py: 0.75 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {(() => {
                const path = location.pathname;
                const enMenu = path.includes('/menu') || path.includes('/articulos') || path === '/';
                const enInsumos = path.includes('/insumos');
                const enGestion = !isAppAdmin && path.startsWith('/gestion');
                // En la home no van los links de Recetas (Artículos/Insumos/Menú): ahí se elige el módulo.
                const enInicio = path.startsWith('/inicio');
                // Estilo de subrayado para la sección activa
                const activeSx = (on) => on ? {
                  '&::after': {
                    content: '""', position: 'absolute', left: 8, right: 8, bottom: 2,
                    height: 2, borderRadius: 2, background: 'var(--on-primary)',
                  },
                } : {};
                // Dentro de RRHH la botonera es la del módulo (pedido de Diego, 07/11):
                // CRONOGRAMAS · LIQUIDACIÓN · FICHAJE | NÓMINA. Liquidación y Fichaje
                // se ven pero todavía no están ("Próximamente").
                if (enAlta) {
                  return (
                    <Button color="inherit" disableRipple tabIndex={-1}
                      sx={{ color: 'inherit', position: 'relative', cursor: 'default', '&:hover': { background: 'transparent' }, ...activeSx(true) }}>
                      Asistente de alta
                    </Button>
                  );
                }
                if (path.startsWith('/rrhh')) {
                  const proxSx = { color: 'inherit', opacity: 0.45, cursor: 'default' };
                  return (
                    <>
                      <Button color="inherit" sx={{ color: 'inherit', position: 'relative', ...activeSx(path.startsWith('/rrhh/cronogramas')) }}
                        component={NavLink} to="/rrhh/cronogramas">
                        Cronogramas
                      </Button>
                      <Tooltip title="Próximamente"><Button color="inherit" disableRipple sx={proxSx}>Liquidación</Button></Tooltip>
                      <Tooltip title="Próximamente"><Button color="inherit" disableRipple sx={proxSx}>Fichaje</Button></Tooltip>
                      <Box component="span" aria-hidden
                        sx={{ width: '1px', alignSelf: 'center', height: 22, background: 'currentColor', opacity: 0.35, mx: 0.5 }} />
                      <Button color="inherit" sx={{ color: 'inherit', position: 'relative', ...activeSx(path.startsWith('/rrhh/nomina')) }}
                        component={NavLink} to="/rrhh/nomina">
                        Nómina
                      </Button>
                    </>
                  );
                }
                // Panel de Gestión (Diego 10/11/2026): CONCEPTOS DE CAJA · INSUMOS | PROVEEDORES
                // (la cuenta corriente sin proveedor elegido). Sin Artículos ni Menú.
                if (enGestion) {
                  return (
                    <>
                      {puedeVer('conceptos') && (
                        <Button color="inherit" sx={{ color: 'inherit', position: 'relative', ...activeSx(path.startsWith('/gestion/conceptos')) }}
                          component={NavLink} to="/gestion/conceptos">
                          Conceptos de caja
                        </Button>
                      )}
                      {puedeVer('recetas') && (
                        <Button color="inherit" sx={{ color: 'inherit', position: 'relative', ...activeSx(enInsumos) }}
                          component={NavLink} to="/insumos">
                          Insumos
                        </Button>
                      )}
                      {puedeVer('carga') && (
                        <>
                          <Box component="span" aria-hidden
                            sx={{ width: '1px', alignSelf: 'center', height: 22, background: 'currentColor', opacity: 0.35, mx: 0.5 }} />
                          <Button color="inherit" sx={{ color: 'inherit', position: 'relative' }}
                            onClick={() => navigate('/gestion?proveedores=1')}>
                            Proveedores
                          </Button>
                        </>
                      )}
                    </>
                  );
                }
                return (
                  <>
                    {(enInicio || !puedeVer('recetas')) ? null : isAppAdmin ? (
                      <Button color="inherit"
                        sx={{ color: 'inherit', position: 'relative', ...activeSx(enMenu) }}
                        component={NavLink} to="/menu">
                        Menú
                      </Button>
                    ) : (() => {
                      // Tres botones (pedido de Diego, 02/11 — el desplegable
                      // "Menú ▾" no era práctico): ARTÍCULOS (la tabla) · INSUMOS
                      // | MENÚ (la carta para imprimir, ?vista=diseno) · ⚙.
                      const enDiseno = enMenu && new URLSearchParams(location.search).get('vista') === 'diseno';
                      return (
                        <>
                          <Button color="inherit"
                            sx={{ color: 'inherit', position: 'relative', ...activeSx(enMenu && !enDiseno) }}
                            onClick={() => navigate('/menu')}>
                            Artículos
                          </Button>
                          <Button color="inherit"
                            sx={{ color: 'inherit', position: 'relative', ...activeSx(enInsumos) }}
                            component={NavLink} to="/insumos">
                            Insumos
                          </Button>
                          {!isStaff && (
                            <>
                              <Box component="span" aria-hidden
                                sx={{ width: '1px', alignSelf: 'center', height: 22, background: 'currentColor', opacity: 0.35, mx: 0.5 }} />
                              <Button color="inherit"
                                sx={{ color: 'inherit', position: 'relative', ...activeSx(enDiseno) }}
                                onClick={() => navigate('/menu?vista=diseno')}>
                                Menú
                              </Button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </>
                );
              })()}

              {isAppAdmin && (
                <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to="/admin">
                  Admin
                </Button>
              )}
            </Box>
            {/* Sucursales: solo donde se ven ventas/compras (Artículos, Insumos, Menú y el Panel de
                Gestión — Diego 10/11/2026: «le falta el selector de sucursal igual que en recetas»). */}
            {!isAppAdmin && (location.pathname.startsWith('/menu') || location.pathname.startsWith('/insumos') || location.pathname === '/gestion') && (
              <Box sx={{ pl: 1, pb: 0.25 }}>
                <SucursalesChips />
              </Box>
            )}
            {/* Cronogramas: cada sucursal tiene su calendario (Diego, 07/11) → sin "Todas". */}
            {!isAppAdmin && location.pathname.startsWith('/rrhh/cronogramas') && (
              <Box sx={{ pl: 1, pb: 0.25 }}>
                <SucursalesChips sinTodas ayuda={
                  <span style={{ display: 'block', lineHeight: 1.45, padding: 2 }}>
                    <b>Sucursales</b><br />
                    Cada sucursal tiene su propio cronograma. La nómina y los feriados son los
                    mismos para todas; los eventos son de cada sucursal.
                  </span>
                } />
              </Box>
            )}
            </Box>

            {/* Selector negocio/división */}

            {!isAppAdmin && logged && (
              <Box sx={{ ml: 1, flexShrink: 0 }}>
                <BusinessDivisionSelector canCreate={!!isOwner} />
              </Box>
            )}

            {/* Perfil — dropdown propio (no MUI Menu portal) para no depender de
                matemática de posición cruzando el zoom global: al vivir en el
                mismo contenedor que el avatar (position:relative acá al lado),
                cae directamente debajo sin ningún cálculo. */}
            <Box sx={{ flexGrow: 0, ml: 0.5, position: 'relative' }}>
              <Tooltip title={userMenuOpen ? "" : "Perfil"}>
                <IconButton
                  onClick={() => setUserMenuOpen((v) => !v)}
                  sx={{ p: 0, color: 'inherit' }}
                  aria-label="Abrir menú de perfil"
                >
                  <Avatar
                    src={userAvatar || undefined}
                    className="navbar-user-avatar"
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: 'color-mix(in srgb, var(--on-primary) 18%, transparent)',
                      color: 'var(--on-primary)',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                    }}
                  >
                    {!userAvatar && userInitials}
                  </Avatar>
                </IconButton>
              </Tooltip>

              {userMenuOpen && (
                <ClickAwayListener onClickAway={() => setUserMenuOpen(false)}>
                  <Box
                    sx={{
                      position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                      minWidth: 200, zIndex: 1300, borderRadius: 1, boxShadow: 6, overflow: 'hidden',
                      bgcolor: 'var(--color-primary)', color: 'var(--on-primary)',
                    }}
                  >
                    <MenuList dense sx={{ color: 'inherit' }} aria-label="Opciones de perfil">
                      {logged ? (
                        [
                          <Box key="user-header" sx={{ px: 2, py: 1, pointerEvents: 'none' }}>
                            <Box sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                              {getUser()?.name || getUser()?.nombre || 'Usuario'}
                            </Box>
                          </Box>,
                          <Divider
                            key="div-header"
                            sx={{
                              my: 0.5,
                              borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
                            }}
                          />,
                          <MenuItem key="perfil" component={NavLink} to="/perfil" onClick={() => setUserMenuOpen(false)}>
                            Perfil
                          </MenuItem>,
                          // Ver como (solo el dueño): ver la app como otro rol sin cerrar sesión.
                          ...(!isAppAdmin && rolReal === 'owner' ? [
                            <Divider key="div-vercomo" sx={{ my: 0.5, borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)' }} />,
                            <VerComoItems key="vercomo" onElegido={() => setUserMenuOpen(false)} />,
                          ] : []),
                          <Divider
                            key="div"
                            sx={{
                              my: 0.5,
                              borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
                            }}
                          />,
                          <MenuItem key="salir" onClick={logout}>
                            Salir
                          </MenuItem>,
                        ]
                      ) : (
                        <MenuItem component={NavLink} to="/login" onClick={() => setUserMenuOpen(false)}>
                          Login
                        </MenuItem>
                      )}
                    </MenuList>
                  </Box>
                </ClickAwayListener>
              )}
            </Box>
            {/* 🔔 Notificaciones (no en el asistente de alta: todavía no hay negocio; pedido de la usuaria 09/11). */}
            {!isAppAdmin && logged && !enAlta && (
              <Box sx={{ ml: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <NotificationsPanel businessId={activeBusinessId} />
              </Box>
            )}
            {/* ⚙ Configuración, a la derecha de la campana (pedido de Diego, 06/11). */}
            {!isAppAdmin && !isStaff && logged && !enAlta && (puedeVer('configuracion') || puedeVer('conexiones')) && (
              <Box sx={{ ml: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <Tooltip title="Configuración">
                  <IconButton
                    color="inherit"
                    sx={{ color: 'inherit', position: 'relative', ...(location.pathname.includes('/configuracion') ? { bgcolor: 'color-mix(in srgb, var(--on-primary) 16%, transparent)' } : {}) }}
                    aria-label="Configuración"
                    onClick={() => {
                      const tab = getConfigTab();
                      navigate(tab ? `/configuracion?tab=${tab}` : '/configuracion');
                    }}
                  >
                    <Badge
                      badgeContent={alertasBadge || null}
                      color="warning"
                      max={99}
                      sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}
                    >
                      <SettingsIcon />
                    </Badge>
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Toolbar>
        </Container>

        {syncRunning && (
          <LinearProgress
            color="inherit"
            sx={{
              bgcolor: 'color-mix(in srgb, var(--on-primary) 20%, transparent)',
              '& .MuiLinearProgress-bar': { backgroundColor: 'var(--on-primary)' },
            }}
            aria-label={syncTotal > 0 ? `Sincronizando ${syncTotal} locales…` : 'Sincronizando…'}
          />
        )}
      </AppBar>

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.sev}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* Pestaña fija para abrir el menú de módulos — antes era un ícono en la
          barra (justo antes del logo); ahora es una solapita chica, pegada al
          borde izquierdo pero contenida DENTRO de la altura de la barra (no
          se mete en el contenido de la página, que cambia de layout según la
          pantalla). Un poco más clara/oscura que la barra para distinguirse
          sin agregar otro color nuevo. */}
      {/* En el asistente de alta no hay módulos que abrir todavía (09/11). */}
      {/* Tampoco en Inicio: ahí los módulos ya están en pantalla (09/11). */}
      {/* Staff: sin menú de módulos; trabaja solo en Artículos, Insumos y Recetas (usuaria 10/11). */}
      {!modulosOpen && !enAlta && !isStaff && location.pathname !== '/inicio' && (
        <Tooltip title="Módulos" placement="right">
          <Box
            component="button"
            onClick={() => setModulosOpen(true)}
            aria-label="Abrir módulos"
            sx={{
              position: 'fixed',
              left: 0,
              top: 12,
              zIndex: (t) => t.zIndex.appBar + 1,
              width: 16,
              height: 40,
              padding: 0,
              border: '1px solid color-mix(in srgb, var(--on-primary, #fff) 25%, transparent)',
              borderLeft: 'none',
              borderRadius: '0 8px 8px 0',
              background: 'color-mix(in srgb, var(--on-primary, #fff) 16%, var(--color-primary, #111111))',
              color: 'var(--on-primary, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'width .12s',
              '&:hover': { width: 22 },
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </Box>
        </Tooltip>
      )}

      {!isStaff && <ModulosDrawer open={modulosOpen} onClose={() => setModulosOpen(false)} />}
    </>
  );
}
