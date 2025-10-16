import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Typography, Menu, MenuItem, MenuList,
  Box, Container, Avatar, Tooltip, Button, Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import BusinessSwitcher from './BusinessSwitcher';

function getUserRole() {
  try { return (JSON.parse(localStorage.getItem('user')||'null')||{}).role || null; }
  catch { return null; }
}

export default function Navbar() {
  const [navEl, setNavEl]   = React.useState(null);
  const [userEl, setUserEl] = React.useState(null);
  const navigate = useNavigate();

  const logged = !!localStorage.getItem('token');
  const role = getUserRole();
  const isAppAdmin = role === 'app_admin';

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const homeTo = isAppAdmin ? '/admin' : '/';

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Typography variant="h4" sx={{ mr: 2, display: { xs: 'none', md: 'block', marginRight: '50px' } }}>
            LAZARILLO
          </Typography>

          {/* Mobile */}
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
              <MenuList dense>
                <MenuItem component={NavLink} to={homeTo} onClick={()=>setNavEl(null)}>Inicio</MenuItem>
                {!isAppAdmin && (
                  <>
                    <MenuItem component={NavLink} to="/agrupaciones" onClick={()=>setNavEl(null)}>Agrupaciones</MenuItem>
                    <MenuItem component={NavLink} to="/insumos" onClick={()=>setNavEl(null)}>Insumos</MenuItem>
                  </>
                )}
                {isAppAdmin && (
                  <MenuItem component={NavLink} to="/admin" onClick={()=>setNavEl(null)}>Admin</MenuItem>
                )}
              </MenuList>
            </Menu>
          </Box>

          {/* Desktop */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            <Button color="inherit" component={NavLink} to={homeTo}>Inicio</Button>
            {!isAppAdmin && (
              <>
                <Button color="inherit" component={NavLink} to="/agrupaciones">Agrupaciones</Button>
                <Button color="inherit" component={NavLink} to="/insumos">Insumos</Button>
              </>
            )}
            {isAppAdmin && <Button color="inherit" component={NavLink} to="/admin">Admin</Button>}
          </Box>

          {/* Usuario */}
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
              <MenuList dense>
                {logged ? (
                  <>
                    <MenuItem component={NavLink} to="/perfil" onClick={()=>setUserEl(null)}>
                      Perfil
                    </MenuItem>

                    {!isAppAdmin && (
                      <>
                        <MenuItem disableRipple disableGutters>
                          <Box sx={{ px: 2, py: 1, width: 280 }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Local</Typography>
                            <BusinessSwitcher
                              fullWidth
                              onSwitched={() => {
                                setUserEl(null);
                                window.dispatchEvent(new CustomEvent('business:switched'));
                              }}
                            />
                          </Box>
                        </MenuItem>
                        <Divider sx={{ my: 0.5 }} />
                      </>
                    )}

                    <MenuItem onClick={logout}>Salir</MenuItem>
                  </>
                ) : (
                  <MenuItem component={NavLink} to="/login" onClick={()=>setUserEl(null)}>
                    Login
                  </MenuItem>
                )}
              </MenuList>
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
