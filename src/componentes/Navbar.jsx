import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Typography, Menu, MenuItem, Box, Container, Avatar, Tooltip, Button, Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import BusinessSwitcher from './BusinessSwitcher';

export default function Navbar() {
  const [navEl, setNavEl]   = React.useState(null);
  const [userEl, setUserEl] = React.useState(null);
  const logged = !!localStorage.getItem('token');
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    navigate('/login', { replace: true });
  };

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Typography variant="h4" sx={{ mr: 2, display: { xs: 'none', md: 'block', marginRight: '50px' } }}>
            LAZARILLO
          </Typography>

          {/* Menú hamburguesa (mobile) */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton size="large" color="inherit" onClick={(e)=>setNavEl(e.currentTarget)}>
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={navEl}
              open={Boolean(navEl)}
              onClose={()=>setNavEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              <MenuItem component={NavLink} to="/" onClick={()=>setNavEl(null)}>Inicio</MenuItem>
              <MenuItem component={NavLink} to="/agrupaciones" onClick={()=>setNavEl(null)}>Agrupaciones</MenuItem>
              <MenuItem component={NavLink} to="/insumos" onClick={()=>setNavEl(null)}>Insumos</MenuItem>
            </Menu>
          </Box>

          {/* Links desktop */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            <Button color="inherit" component={NavLink} to="/">Inicio</Button>
            <Button color="inherit" component={NavLink} to="/agrupaciones">Agrupaciones</Button>
            <Button color="inherit" component={NavLink} to="/insumos">Insumos</Button>
          </Box>

          {/* Lado derecho: avatar con menú */}
          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Cuenta">
              <IconButton onClick={(e)=>setUserEl(e.currentTarget)} sx={{ p: 0 }}>
                <Avatar />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              anchorEl={userEl}
              open={Boolean(userEl)}
              onClose={()=>setUserEl(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {logged
                ? [
                    <MenuItem key="perfil" component={NavLink} to="/perfil" onClick={()=>setUserEl(null)}>
                      Perfil
                    </MenuItem>,

                    <Box key="switcher" sx={{ px: 2, py: 1, width: 280 }}>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Local
                      </Typography>
                      <BusinessSwitcher
                        fullWidth
                        onSwitched={() => {
                          setUserEl(null);
                          // 👇 en lugar de recargar la página:
                          window.dispatchEvent(new CustomEvent('business:switched'));
                        }}
                      />
                    </Box>,

                    <Divider key="div1" sx={{ my: 0.5 }} />,

                    <MenuItem key="logout" onClick={logout}>Salir</MenuItem>,
                  ]
                : [
                    <MenuItem key="login" component={NavLink} to="/login" onClick={()=>setUserEl(null)}>
                      Login
                    </MenuItem>
                  ]
              }
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
