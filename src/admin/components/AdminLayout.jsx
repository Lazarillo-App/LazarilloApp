/* eslint-disable no-unused-vars, no-empty */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import { AdminAPI } from '../../servicios/apiAdmin';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import BuildIcon from '@mui/icons-material/Build';
import HistoryIcon from '@mui/icons-material/History';

import logoLight from '@/assets/brand/logo-light.png';
import anthony from '@/assets/brand/anthony.png';

const NAV_ITEMS = [
  { to: '/admin',          label: 'Dashboard',        icon: DashboardIcon, exact: true },
  { to: '/admin/usuarios', label: 'Usuarios',         icon: PeopleIcon },
  { to: '/admin/negocios', label: 'Negocios',         icon: StorefrontIcon },
  { to: '/admin/organizaciones', label: 'Organizaciones', icon: ApartmentIcon },
  { to: '/admin/acceso',   label: 'Acceso y cupones', icon: ConfirmationNumberIcon },
  { to: '/admin/mantenimiento', label: 'Mantenimiento', icon: BuildIcon },
  { to: '/admin/auditoria', label: 'Auditoría', icon: HistoryIcon },
];

const BRAND = {
  azulNoche:      '#12111F',
  tinta:          '#15213E',
  celeste:        '#5BC2EA',
  celesteProfundo:'#2492C8',
  paper:          '#F2F4F7',
};

function NavItem({ to, label, icon: Icon, exact }) {
  const loc = useLocation();
  const active = exact ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 8,
        background: active ? BRAND.celesteProfundo : 'transparent',
        transition: 'background 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <Icon style={{ fontSize: 18, color: active ? '#fff' : 'rgba(255,255,255,0.45)' }} />
        <span style={{
          fontSize: 13, fontWeight: active ? 700 : 500,
          color: active ? '#fff' : 'rgba(255,255,255,0.45)',
          fontFamily: "'Archivo', system-ui, sans-serif",
        }}>
          {label}
        </span>
      </div>
    </Link>
  );
}

function GlobalSearchBox() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await AdminAPI.globalSearch(term);
        setResults(r);
        setOpen(true);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (path) => { setOpen(false); setQ(''); nav(path); };

  const hasResults = results && (results.users?.length || results.businesses?.length || results.organizations?.length);

  return (
    <div ref={boxRef} style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
        border: '0.5px solid #e2e8f0', borderRadius: 8, padding: '8px 12px',
      }}>
        <SearchIcon style={{ fontSize: 18, color: '#94a3b8' }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => q.trim() && setOpen(true)}
          placeholder="Buscar usuarios, negocios, organizaciones…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
        />
      </div>
      {open && results && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 20, maxHeight: 360, overflow: 'auto',
        }}>
          {!hasResults && (
            <div style={{ padding: 14, fontSize: 13, color: '#94a3b8' }}>Sin resultados.</div>
          )}
          {results.users?.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Usuarios</div>
              {results.users.map(u => (
                <div key={u.id} onClick={() => go(`/admin/usuarios/${u.id}`)}
                  style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {u.name || u.email} <span style={{ color: '#94a3b8' }}>· {u.email}</span>
                </div>
              ))}
            </div>
          )}
          {results.businesses?.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Negocios</div>
              {results.businesses.map(b => (
                <div key={b.id} onClick={() => go(`/admin/negocios/${b.id}`)}
                  style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {b.name}
                </div>
              ))}
            </div>
          )}
          {results.organizations?.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Organizaciones</div>
              {results.organizations.map(o => (
                <div key={o.id} onClick={() => go(`/admin/organizaciones/${o.id}`)}
                  style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {o.display_name || o.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }) {
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeBusinessId');
    window.dispatchEvent(new Event('auth:logout'));
    nav('/login', { replace: true });
  };

  const Sidebar = () => (
    <div style={{
      width: 220, background: BRAND.azulNoche,
      display: 'flex', flexDirection: 'column',
      height: '100vh', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 12px' }}>
        <Link to="/admin" style={{ textDecoration: 'none', display: 'block', marginBottom: 6 }}>
          <img src={logoLight} alt="Lazarillo" style={{ height: 30 }} />
        </Link>
        <span style={{
          fontSize: 10, color: 'rgba(91,194,234,0.65)',
          letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600,
          fontFamily: "'Archivo', system-ui, sans-serif",
        }}>
          Admin panel
        </span>
      </div>

      {/* Anthony + nombre */}
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ position: 'relative', width: 68, height: 68 }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: BRAND.tinta,
            border: `2px solid ${BRAND.celesteProfundo}`,
            overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}>
            <img src={anthony} alt="Anthony" style={{ width: 56, objectFit: 'cover' }} />
          </div>
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 16, height: 16, borderRadius: '50%',
            background: BRAND.celeste, border: `2px solid ${BRAND.azulNoche}`,
          }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: "'Archivo', system-ui, sans-serif" }}>
            {user?.name || 'Admin'}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: "'Archivo', system-ui, sans-serif" }}>
            Administrador
          </p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)', margin: '0 16px 12px' }} />

      {/* Nav */}
      <nav style={{ padding: '0 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => <NavItem key={item.to} {...item} />)}
      </nav>

      {/* Footer logout */}
      <div style={{ padding: '12px 10px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
        <div
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogoutIcon style={{ fontSize: 17, color: 'rgba(255,255,255,0.3)' }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: "'Archivo', system-ui, sans-serif" }}>
            Cerrar sesión
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Sidebar desktop */}
      <div style={{ display: 'none' }} className="admin-sidebar-desktop">
        <Sidebar />
      </div>

      {/* Sidebar mobile overlay */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 1100,
              display: 'block',
            }}
          />
          <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 1200 }}>
            <Sidebar />
          </div>
        </>
      )}

      {/* Sidebar siempre visible en desktop */}
      <div className="admin-sidebar-wrapper">
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BRAND.paper }}>

        {/* Topbar solo mobile */}
        <div className="admin-topbar-mobile" style={{
          display: 'none', alignItems: 'center', gap: 12,
          padding: '12px 16px', background: BRAND.azulNoche,
        }}>
          <button
            onClick={() => setMobileOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4, display: 'flex' }}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <img src={logoLight} alt="Lazarillo" style={{ height: 24 }} />
        </div>

        {/* Buscador global */}
        <div style={{ padding: '12px 24px 0' }}>
          <GlobalSearchBox />
        </div>

        {/* Área scrolleable */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {children}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Archivo:wght@300;400;600&display=swap');

        .admin-sidebar-wrapper { display: flex; }
        .admin-topbar-mobile   { display: none !important; }

        @media (max-width: 768px) {
          .admin-sidebar-wrapper { display: none !important; }
          .admin-topbar-mobile   { display: flex !important; }
        }
      `}</style>
    </div>
  );
}