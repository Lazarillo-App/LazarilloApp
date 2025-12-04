/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Menu, MenuItem, MenuList,
  Box, Container, Avatar, Tooltip, Button, Divider,
  ListItemIcon, ListItemText, CircularProgress, Typography,
  Snackbar, Alert, LinearProgress
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CheckIcon from '@mui/icons-material/Check';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { setActiveBusiness } from "@/servicios/setActiveBusiness";
import logoLight from '@/assets/brand/logo-light.png';
import logoDark from '@/assets/brand/logo-dark.png';

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

const getUser = () => { try { return JSON.parse(localStorage.getItem('user') || 'null') || null; } catch { return null; } };
const getUserRole = () => getUser()?.role || null;
const getUserAvatarUrl = () => {
  const u = getUser();
  return u?.photo_url || u?.avatar_url || u?.picture || '';
};

const getBranding = (biz) => biz?.branding || biz?.props?.branding || {};
const getBizLogoUrl = (biz) =>
  getBranding(biz)?.logo_url ||
  biz?.photo_url ||
  getBranding(biz)?.cover_url ||
  biz?.image_url || '';

export default function Navbar() {
  // Menús
  const [navEl, setNavEl] = React.useState(null);
  const [localEl, setLocalEl] = React.useState(null);
  const [userEl, setUserEl] = React.useState(null);

  const navigate = useNavigate();
  const logged = !!localStorage.getItem('token');
  const role = getUserRole();
  const isAppAdmin = role === 'app_admin';

  // contraste dinámico
  const [colors, setColors] = React.useState(() => ({ primary: '#111111', onPrimary: '#ffffff' }));

  const recomputeColors = React.useCallback(() => {
    const root = document.documentElement;
    let primary = getComputedStyle(root).getPropertyValue('--color-primary').trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(primary)) primary = '#111111';
    const onPrimary = onColorFor(primary);
    root.style.setProperty('--on-primary', onPrimary);

    setColors(prev => {
      if (prev.primary === primary && prev.onPrimary === onPrimary) {
        return prev; // no dispares rerender si no cambió nada
      }
      return { primary, onPrimary };
    });
  }, []);

  // local activo
  const [bizLabel, setBizLabel] = React.useState('Local');
  const [activeBizId, setActiveBizId] = React.useState(null);
  const [activeBizLogo, setActiveBizLogo] = React.useState('');

  // lista de negocios
  const [bizList, setBizList] = React.useState([]);
  const [loadingBiz, setLoadingBiz] = React.useState(false);

  // avatar usuario
  const [userAvatar, setUserAvatar] = React.useState(getUserAvatarUrl());

  // ---- Estado de sincronización global (auto-sync) ----
  const [syncRunning, setSyncRunning] = React.useState(false);
  const [syncTotal, setSyncTotal] = React.useState(0);
  const [snack, setSnack] = React.useState({ open: false, msg: '', sev: 'success' });

  const isLightBg = colors.onPrimary === '#000000';
  const brandSrc = isLightBg ? logoDark : logoLight;

  const loadActiveBusiness = React.useCallback(async () => {
    try {
      if (isAppAdmin || !logged) {
        setBizLabel('Local');
        setActiveBizId(null);
        setActiveBizLogo('');
        localStorage.removeItem('activeBusinessId');
        return;
      }

      const lsId = localStorage.getItem('activeBusinessId');

      if (lsId) {
        const id = String(lsId);
        setActiveBizId(id);
        try {
          const biz = await BusinessesAPI.get(id);
          setBizLabel(biz?.name || 'Local');
          setActiveBizLogo(getBizLogoUrl(biz));
        } catch {
          setBizLabel('Local');
          setActiveBizLogo('');
        }
        console.log(
          '[NAVBAR] usando businessId desde localStorage (ya sincronizado por ensureActiveBusiness):',
          id
        );
        return;
      }

      // 2) Si NO hay nada en LS → preguntamos al backend
      const act = await BusinessesAPI.getActive();
      const id = act?.activeBusinessId || null;
      setActiveBizId(id);

      if (id) {
        localStorage.setItem('activeBusinessId', String(id));
        const biz = await BusinessesAPI.get(id);
        setBizLabel(biz?.name || 'Local');
        setActiveBizLogo(getBizLogoUrl(biz));
        console.log('[NAVBAR] usando businessId desde backend:', id);
      } else {
        localStorage.removeItem('activeBusinessId');
        setBizLabel('Local');
        setActiveBizLogo('');
        console.log('[NAVBAR] sin negocio activo en backend');
      }
    } catch (err) {
      console.error('loadActiveBusiness error', err);
      setBizLabel('Local');
      setActiveBizId(null);
      setActiveBizLogo('');
      // mejor no tocar LS en caso de error
    }
  }, [isAppAdmin, logged]);

  const openLocalMenu = async (e) => {
    setLocalEl(e.currentTarget);
    try {
      setLoadingBiz(true);
      const items = await BusinessesAPI.listMine();
      setBizList(items);
    } finally {
      setLoadingBiz(false);
    }
  };

  const switchBusiness = async (id) => {
    try {
      const biz = await setActiveBusiness(id);
      setActiveBizId(id);
      setBizLabel(biz?.name || "Local");
      setActiveBizLogo(getBizLogoUrl(biz));
      setLocalEl(null);
      recomputeColors();
    } catch (e) {
      console.error("switchBusiness failed", e);
    }
  };

  // 🔧 ÚNICO efecto principal para tema + negocio + listeners
  React.useEffect(() => {
    // 1) inicial
    recomputeColors();
    loadActiveBusiness();
    setUserAvatar(getUserAvatarUrl());

    // 2) listeners globales
    const onBizSwitched = () => {
      recomputeColors();
      loadActiveBusiness();
    };

    const onBizDeleted = () => {
      recomputeColors();
      loadActiveBusiness();
    };

    const onThemeUpdated = () => {
      recomputeColors();
    };

    const onPaletteChanged = () => {
      recomputeColors();
    };

    const onLogin = () => {
      setUserAvatar(getUserAvatarUrl());
      loadActiveBusiness();
    };

    const onLogout = () => {
      setUserAvatar('');
      setBizLabel('Local');
      setActiveBizId(null);
      setActiveBizLogo('');
      recomputeColors();
    };

    window.addEventListener('business:switched', onBizSwitched);
    window.addEventListener('business:deleted', onBizDeleted);
    window.addEventListener('theme:updated', onThemeUpdated);
    window.addEventListener('palette:changed', onPaletteChanged);
    window.addEventListener('auth:login', onLogin);
    window.addEventListener('auth:logout', onLogout);

    return () => {
      window.removeEventListener('business:switched', onBizSwitched);
      window.removeEventListener('business:deleted', onBizDeleted);
      window.removeEventListener('theme:updated', onThemeUpdated);
      window.removeEventListener('palette:changed', onPaletteChanged);
      window.removeEventListener('auth:login', onLogin);
      window.removeEventListener('auth:logout', onLogout);
    };
  }, [recomputeColors, loadActiveBusiness]);

  // Escuchar inicio/fin del auto-sync (disparados por syncAllBusinesses)
  React.useEffect(() => {
    const onStart = (e) => {
      const total = Number(e?.detail?.total || 0);
      setSyncTotal(total);
      setSyncRunning(true);
    };
    const onDone = (e) => {
      const ok = Number(e?.detail?.ok || 0);
      const fail = Number(e?.detail?.fail || 0);
      setSyncRunning(false);
      setSnack({
        open: true,
        sev: fail > 0 ? 'warning' : 'success',
        msg: fail > 0
          ? `Sincronización completa: ${ok} OK, ${fail} con aviso.`
          : `Sincronización completa: ${ok} OK.`
      });
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
    localStorage.removeItem('activeBusinessId');
    localStorage.removeItem('user');
    localStorage.removeItem('bizTheme');
    if (uid) localStorage.removeItem(`bizTheme:${uid}`);
    window.dispatchEvent(new Event('auth:logout'));
    navigate('/login', { replace: true });
  };

  const homeTo = isAppAdmin ? '/admin' : '/';

  return (
    <>
      <AppBar
        position="static"
        sx={{
          backgroundColor: 'var(--color-primary, #111111)',
          color: 'var(--on-primary, #ffffff)',
          borderBottom: '1px solid color-mix(in srgb, var(--on-primary, #000) 12%, transparent)',
          boxShadow: 'none',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ color: 'inherit', gap: 1 }}>
            <Box
              component={NavLink}
              to={homeTo}
              aria-label="Ir al inicio"
              sx={{
                mr: 2,
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                textDecoration: 'none',
                pr: '50px'
              }}
            >
              <Box
                component="img"
                src={brandSrc}
                alt="Lazarillo"
                sx={{
                  height: 28,
                  display: 'block',
                  filter: isLightBg
                    ? 'drop-shadow(0 0 1px rgba(0,0,0,.45))'
                    : 'drop-shadow(0 0 1px rgba(255,255,255,.35))',
                  outline: isLightBg ? '1px solid rgba(0,0,0,.06)' : 'transparent',
                  outlineOffset: -1
                }}
              />
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
                  '& .MuiPaper-root': { background: 'var(--color-primary)', color: 'var(--on-primary)' }
                }}
                MenuListProps={{ 'aria-label': 'Navegación principal' }}
              >
                <MenuList dense sx={{ color: 'inherit' }}>
                  <MenuItem component={NavLink} to={homeTo} onClick={() => setNavEl(null)}>Menú</MenuItem>
                  {!isAppAdmin && (
                    <>
                      <MenuItem component={NavLink} to="/agrupaciones" onClick={() => setNavEl(null)}>Agrupaciones</MenuItem>
                      <MenuItem component={NavLink} to="/insumos" onClick={() => setNavEl(null)}>Insumos</MenuItem>
                    </>
                  )}
                  {isAppAdmin && (
                    <MenuItem component={NavLink} to="/admin" onClick={() => setNavEl(null)}>Admin</MenuItem>
                  )}
                </MenuList>
              </Menu>
            </Box>

            {/* Desktop – links */}
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
              <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to={homeTo}>Menú</Button>
              {!isAppAdmin && (
                <>
                  <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to="/agrupaciones">Agrupaciones</Button>
                  <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to="/insumos">Insumos</Button>
                </>
              )}
              {isAppAdmin && <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to="/admin">Admin</Button>}
            </Box>

            {/* ====== Botón LOCAL (logo  nombre) ====== */}
            {!isAppAdmin && logged && (
              <>
                <Button
                  aria-label="Cambiar local activo"
                  onClick={openLocalMenu}
                  sx={{
                    color: 'var(--on-primary)',
                    textTransform: 'none',
                    fontWeight: 700,
                    border: '1px solid color-mix(in srgb, var(--on-primary) 22%, transparent)',
                    px: 1.25,
                    '&:focus-visible': {
                      outline: '2px solid color-mix(in srgb, var(--on-primary) 65%, transparent)',
                      outlineOffset: 2,
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {activeBizLogo ? (
                      <Box
                        component="img"
                        src={activeBizLogo}
                        alt={bizLabel}
                        sx={{
                          width: 22, height: 22, objectFit: 'contain',
                          borderRadius: '6px', p: 0.5,
                          background: 'rgba(255,255,255,0.92)',
                          border: '1px solid',
                          borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
                          boxShadow: '0 0 0 1px color-mix(in srgb, var(--on-primary) 10%, transparent) inset'
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          display: 'inline-grid', placeItems: 'center',
                          width: 22, height: 22, borderRadius: 6,
                          border: '1px solid color-mix(in srgb, var(--on-primary) 25%, transparent)',
                          background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)',
                          fontSize: 11, fontWeight: 800, color: 'var(--on-primary)'
                        }}
                        aria-hidden
                      >
                        {String(bizLabel || '#').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span>{bizLabel}</span>
                  </Box>
                </Button>

                <Menu
                  anchorEl={localEl}
                  open={Boolean(localEl)}
                  onClose={() => setLocalEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  sx={{
                    '& .MuiPaper-root': {
                      background: 'var(--color-primary)',
                      color: 'var(--on-primary)',
                      minWidth: 280,
                      maxHeight: 360,
                      overflowY: 'auto'
                    }
                  }}
                  MenuListProps={{ 'aria-label': 'Selección de local', dense: true }}
                >
                  <MenuItem disableRipple disableGutters>
                    <Box sx={{ px: 2, py: 1 }}>
                      <Typography variant="caption" sx={{ opacity: 0.8, color: 'inherit' }}>
                        Cambiar de local
                      </Typography>
                    </Box>
                  </MenuItem>

                  {loadingBiz && (
                    <MenuItem disabled>
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 28 }}>
                        <CircularProgress size={16} sx={{ color: 'var(--on-primary)' }} />
                      </ListItemIcon>
                      <ListItemText primary="Cargando locales…" />
                    </MenuItem>
                  )}

                  {!loadingBiz && bizList.map(b => {
                    const logoUrl = getBizLogoUrl(b);
                    const isActive = Number(activeBizId) === Number(b.id);
                    return (
                      <MenuItem
                        key={b.id}
                        onClick={() => switchBusiness(b.id)}
                        selected={isActive}
                        sx={{
                          '&.Mui-selected': {
                            background: 'color-mix(in srgb, var(--on-primary) 15%, transparent)'
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {logoUrl ? (
                            <Box
                              component="img"
                              src={logoUrl}
                              alt={b.name}
                              sx={{
                                width: 22, height: 22, objectFit: 'contain',
                                borderRadius: '6px', p: 0.5,
                                background: 'rgba(255,255,255,0.92)',
                                border: '1px solid',
                                borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
                                boxShadow: '0 0 0 1px color-mix(in srgb, var(--on-primary) 10%, transparent) inset'
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                display: 'inline-grid', placeItems: 'center',
                                width: 22, height: 22, borderRadius: 6,
                                border: '1px solid color-mix(in srgb, var(--on-primary) 25%, transparent)',
                                background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)',
                                fontSize: 11, fontWeight: 800, color: 'var(--on-primary)'
                              }}
                              aria-hidden
                            >
                              {(b?.name || b?.slug || '#').slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={b.name}
                          secondary={b.slug}
                          secondaryTypographyProps={{ sx: { opacity: .7 } }}
                        />
                        {isActive && <CheckIcon fontSize="small" sx={{ ml: 1, opacity: .9 }} />}
                      </MenuItem>
                    );
                  })}

                  {!loadingBiz && bizList.length === 0 && (
                    <MenuItem disabled>
                      <ListItemText primary="No tenés locales todavía" />
                    </MenuItem>
                  )}
                </Menu>
              </>
            )}

            {/* ====== Botón PERFIL (usa foto si existe) ====== */}
            <Box sx={{ flexGrow: 0 }}>
              <Tooltip title="Perfil">
                <IconButton
                  onClick={(e) => setUserEl(e.currentTarget)}
                  sx={{ p: 0, color: 'inherit' }}
                  aria-label="Abrir menú de perfil"
                >
                  <Avatar
                    src={userAvatar || undefined}
                    sx={{ width: 32, height: 32, bgcolor: 'color-mix(in srgb, var(--on-primary) 12%, transparent)' }}
                  />
                </IconButton>
              </Tooltip>
              <Menu
                sx={{ mt: '45px', '& .MuiPaper-root': { background: 'var(--color-primary)', color: 'var(--on-primary)' } }}
                anchorEl={userEl}
                open={Boolean(userEl)}
                onClose={() => setUserEl(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                MenuListProps={{ 'aria-label': 'Opciones de perfil' }}
              >
                <MenuList dense sx={{ color: 'inherit' }}>
                  {logged
                    ? [
                      <MenuItem key="perfil" component={NavLink} to="/perfil" onClick={() => setUserEl(null)}>
                        Perfil
                      </MenuItem>,
                      <Divider key="divp" sx={{ my: 0.5, borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)' }} />,
                      <MenuItem key="logout" onClick={logout}>Salir</MenuItem>,
                    ]
                    : [
                      <MenuItem key="login" component={NavLink} to="/login" onClick={() => setUserEl(null)}>
                        Login
                      </MenuItem>,
                    ]}
                </MenuList>
              </Menu>
            </Box>
          </Toolbar>
        </Container>

        {/* Línea de progreso visible mientras corre el auto-sync */}
        {syncRunning && (
          <LinearProgress
            color="inherit"
            sx={{
              bgcolor: 'color-mix(in srgb, var(--on-primary) 20%, transparent)',
              '& .MuiLinearProgress-bar': { backgroundColor: 'var(--on-primary)' }
            }}
            aria-label={syncTotal > 0 ? `Sincronizando ${syncTotal} locales…` : 'Sincronizando…'}
          />
        )}
      </AppBar>

      {/* Snackbar al finalizar la sincronización */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          severity={snack.sev}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
