import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

const NavItem = ({ to, label }) => {
  const loc = useLocation();
  const active = loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      style={{
        display: 'block',
        padding: '10px 12px',
        borderRadius: 10,
        textDecoration: 'none',
        color: active ? 'var(--on-primary)' : 'var(--color-fg)',
        background: active ? 'var(--color-primary)' : 'transparent',
        fontWeight: active ? 800 : 600
      }}
    >
      {label}
    </Link>
  );
};

export default function AdminLayout({ children }) {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: '260px 1fr' },
      height: '100vh',
      color: 'var(--color-fg)'
    }}>
      <Box sx={{
        borderRight: { md: '1px solid var(--color-border)' },
        p: 2, overflowY: 'auto',
        background: 'var(--color-surface)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Lazarillo Admin</h2>
        <nav style={{ display: 'grid', gap: 6 }}>
          <NavItem to="/admin" label="Dashboard" />
          <NavItem to="/admin/usuarios" label="Usuarios" />
        </nav>
      </Box>
      <Box sx={{ p: 2, overflow: 'auto', background: 'var(--color-bg)' }}>
        {children}
      </Box>
    </Box>
  );
}
