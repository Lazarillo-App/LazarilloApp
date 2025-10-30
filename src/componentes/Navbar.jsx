// Navbar.jsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Typography, Menu, MenuItem, MenuList,
  Box, Container, Avatar, Tooltip, Button, Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import BusinessSwitcher from './BusinessSwitcher';

function getUserRole() {
  try { return (JSON.parse(localStorage.getItem('user') || 'null') || {}).role || null; }
  catch { return null; }
}

/* ==== helpers de contraste ==== */
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

// Devuelve negro o blanco según contraste WCAG (umbral ~0.179)
const onColorFor = (bgHex) => {
  const L = luminance(hexToRgb(bgHex));
  return L > 0.179 ? '#000000' : '#ffffff';
};

export default function Navbar() {
  const [navEl, setNavEl] = React.useState(null);
  const [userEl, setUserEl] = React.useState(null);
  const navigate = useNavigate();

  const logged = !!localStorage.getItem('token');
  const role = getUserRole();
  const isAppAdmin = role === 'app_admin';

  // === contraste dinámico: setear --on-primary según --color-primary ===
  const [colors, setColors] = React.useState(() => ({ primary: '#111111', onPrimary: '#ffffff' }));

  const recomputeColors = React.useCallback(() => {
    const root = document.documentElement;
    let primary = getComputedStyle(root).getPropertyValue('--color-primary').trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(primary)) primary = '#111111';
    const onPrimary = onColorFor(primary);
    root.style.setProperty('--on-primary', onPrimary);
    setColors({ primary, onPrimary });
  }, []);

  React.useEffect(() => {
    recomputeColors();
    const handlers = [
      ['business:switched', recomputeColors],
      ['theme:updated', recomputeColors],
      ['palette:changed', recomputeColors],
    ];
    handlers.forEach(([ev, fn]) => window.addEventListener(ev, fn));
    return () => handlers.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
  }, [recomputeColors]);

  const logout = () => {
    const uid = (() => { try { return (JSON.parse(localStorage.getItem('user') || 'null') || {}).id } catch { return null } })();
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
        <Toolbar disableGutters sx={{ color: 'inherit' }}>
          <Typography
            variant="h4"
            sx={{ mr: 2, display: { xs: 'none', md: 'block', marginRight: '50px' }, color: 'inherit' }}
          >
            LAZARILLO
          </Typography>

          {/* Mobile */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton size="large" sx={{ color: 'inherit' }} onClick={(e) => setNavEl(e.currentTarget)}>
              <MenuIcon />
            </IconButton>
            <Menu
              key={`main-${colors.primary}`}
              anchorEl={navEl}
              open={Boolean(navEl)}
              onClose={() => setNavEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiPaper-root': {
                  background: 'var(--color-primary)',
                  color: 'var(--on-primary)'
                }
              }}
            >
              <MenuList dense sx={{ color: 'inherit' }}>
                <MenuItem component={NavLink} to={homeTo} onClick={() => setNavEl(null)}>Inicio</MenuItem>
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

          {/* Desktop */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to={homeTo}>Inicio</Button>
            {!isAppAdmin && (
              <>
                <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to="/agrupaciones">Agrupaciones</Button>
                <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to="/insumos">Insumos</Button>
              </>
            )}
            {isAppAdmin && <Button color="inherit" sx={{ color: 'inherit' }} component={NavLink} to="/admin">Admin</Button>}
          </Box>

          {/* Usuario */}
          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Cuenta">
              <IconButton onClick={(e) => setUserEl(e.currentTarget)} sx={{ p: 0, color: 'inherit' }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'color-mix(in srgb, var(--on-primary) 12%, transparent)' }} />
              </IconButton>
            </Tooltip>
            <Menu
              key={`user-${colors.primary}`}
              sx={{
                mt: '45px',
                '& .MuiPaper-root': {
                  background: 'var(--color-primary)',
                  color: 'var(--on-primary)'
                }
              }}
              anchorEl={userEl}
              open={Boolean(userEl)}
              onClose={() => setUserEl(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuList dense sx={{ color: 'inherit' }}>
                {logged
                  ? [
                      <MenuItem key="perfil" component={NavLink} to="/perfil" onClick={() => setUserEl(null)}>
                        Perfil
                      </MenuItem>,

                      !isAppAdmin && (
                        <MenuItem key="switcher" disableRipple disableGutters>
                          <Box sx={{ px: 2, py: 1, width: 280 }}>
                            <Typography variant="caption" sx={{ opacity: 0.8, color: 'inherit' }}>
                              Local
                            </Typography>
                            <BusinessSwitcher
                              fullWidth
                              onSwitched={() => {
                                setUserEl(null);
                                window.dispatchEvent(new CustomEvent('business:switched'));
                              }}
                            />
                          </Box>
                        </MenuItem>
                      ),

                      !isAppAdmin && (
                        <Divider
                          key="div1"
                          sx={{ my: 0.5, borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)' }}
                        />
                      ),

                      <MenuItem key="logout" onClick={logout}>
                        Salir
                      </MenuItem>,
                    ].filter(Boolean)
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
    </AppBar>
  );
}
