// src/componentes/Navbar.jsx
import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import BusinessSwitcher from './BusinessSwitcher';

const pages = [
  { label: 'Inicio', to: '/' },
  { label: 'Agrupaciones', to: '/agrupaciones' },
  { label: 'Insumos', to: '/insumos' },
];

export default function Navbar() {
  const [anchorElNav, setAnchorElNav]   = React.useState(null);
  const [anchorElUser, setAnchorElUser] = React.useState(null);
  const navigate = useNavigate();
  const logged = !!localStorage.getItem('token');

  const handleOpenNavMenu  = (e) => setAnchorElNav(e.currentTarget);
  const handleCloseNavMenu = ()   => setAnchorElNav(null);

  const handleOpenUserMenu  = (e) => setAnchorElUser(e.currentTarget);
  const handleCloseUserMenu = ()  => setAnchorElUser(null);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    navigate('/login', { replace: true });
  };

  const userMenuItems = logged
    ? [
        <MenuItem key="perfil" component={RouterLink} to="/perfil" onClick={handleCloseUserMenu}>
          Perfil
        </MenuItem>,
        <MenuItem key="logout" onClick={() => { handleCloseUserMenu(); logout(); }}>
          Salir
        </MenuItem>,
      ]
    : [
        <MenuItem key="login" component={RouterLink} to="/login" onClick={handleCloseUserMenu}>
          Ingresar
        </MenuItem>,
        <MenuItem key="register" component={RouterLink} to="/register" onClick={handleCloseUserMenu}>
          Registrarse
        </MenuItem>,
      ];

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>

          {/* LOGO desktop */}
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{ mr: 2, display: { xs: 'none', md: 'flex' }, color: 'inherit', textDecoration: 'none', fontWeight: 700 }}
          >
            LOGO
          </Typography>

          {/* Menú hamburguesa (mobile) */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton size="large" aria-label="open menu" onClick={handleOpenNavMenu} color="inherit">
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              {pages.map(p => (
                <MenuItem key={p.to} component={RouterLink} to={p.to} onClick={handleCloseNavMenu}>
                  {p.label}
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* LOGO mobile */}
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' }, color: 'inherit', textDecoration: 'none', fontWeight: 700 }}
          >
            LOGO
          </Typography>

          {/* Links desktop */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            {pages.map(p => (
              <Button key={p.to} component={RouterLink} to={p.to} onClick={handleCloseNavMenu} sx={{ color: 'white' }}>
                {p.label}
              </Button>
            ))}
          </Box>

          {/* Switcher + usuario */}
          {logged && <BusinessSwitcher className="mr-2" onSwitched={() => window.location.reload()} />}

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Cuenta">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt="U" />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              id="user-menu"
              anchorEl={anchorElUser}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {userMenuItems /* ← es un array, no Fragment */}
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
