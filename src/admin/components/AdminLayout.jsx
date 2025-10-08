import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

const NavItem = ({ to, label }) => {
  const loc = useLocation();
  const active = loc.pathname.startsWith(to);
  return (
    <Link
      to={to}
      style={{
        display: 'block',
        padding: '10px 14px',
        borderRadius: 8,
        textDecoration: 'none',
        color: active ? 'white' : '#222',
        background: active ? '#1976d2' : 'transparent'
      }}
    >
      {label}
    </Link>
  );
};

export default function AdminLayout({ children }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: '100vh' }}>
      <Box sx={{ borderRight: '1px solid #e5e7eb', p: 2, overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>Lazarillo Admin</h2>
        <nav style={{ display: 'grid', gap: 8 }}>
          <NavItem to="/admin" label="Dashboard" />
          <NavItem to="/admin/usuarios" label="Usuarios" />
          {/* Más secciones: Negocios, Auditoría, Configuración */}
        </nav>
      </Box>
      <Box sx={{ p: 2, overflow: 'auto' }}>{children}</Box>
    </Box>
  );
}
