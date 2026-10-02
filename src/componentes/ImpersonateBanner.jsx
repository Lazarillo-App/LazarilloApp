// src/componentes/ImpersonateBanner.jsx
// Vista Operación / soporte admin — cartel fijo mientras un app_admin está
// "viendo como" otro usuario (ver AdminUserDetail.jsx → botón "Ver como").
// Sin esto, sería indistinguible de estar logueado con la cuenta real.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { isImpersonating, getImpersonateOrigin, stopImpersonation } from '@/servicios/apiAuth';

export default function ImpersonateBanner() {
  const nav = useNavigate();
  const [active, setActive] = useState(isImpersonating());

  useEffect(() => {
    const onLogin = () => setActive(isImpersonating());
    window.addEventListener('auth:login', onLogin);
    return () => window.removeEventListener('auth:login', onLogin);
  }, []);

  if (!active) return null;

  const origin = getImpersonateOrigin();
  const targetUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  })();

  const handleVolver = () => {
    if (stopImpersonation()) nav('/admin', { replace: true });
  };

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      background: '#7c2d12', color: '#fff', padding: '7px 16px',
      fontSize: 13, fontWeight: 600,
    }}>
      <VisibilityIcon sx={{ fontSize: 16 }} />
      <span>
        Estás viendo como <strong>{targetUser?.name || targetUser?.email || 'este usuario'}</strong>
        {origin?.user?.name ? ` (entraste como ${origin.user.name})` : ''}
      </span>
      <button
        onClick={handleVolver}
        style={{
          background: '#fff', color: '#7c2d12', border: 'none', borderRadius: 6,
          padding: '3px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}
      >
        Volver a mi cuenta
      </button>
    </div>
  );
}
