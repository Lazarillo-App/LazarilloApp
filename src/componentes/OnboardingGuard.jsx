// src/componentes/OnboardingGuard.jsx
import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { BusinessesAPI } from "@/servicios/apiBusinesses";

function getRole() {
  try { return (JSON.parse(localStorage.getItem('user')||'null')||{}).role || null; }
  catch { return null; }
}

export default function OnboardingGuard() {
  const [loading, setLoading] = useState(true);
  const [hasBiz, setHasBiz] = useState(true);
  const loc = useLocation();

  const checkBiz = React.useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); setHasBiz(true); return; }

    const role = getRole();
    if (role === 'app_admin') { setLoading(false); setHasBiz(true); return; }

    try {
      const list = await BusinessesAPI.listMine();
      setHasBiz((list || []).length > 0);
    } catch {
      setHasBiz(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificar al montar
  useEffect(() => {
    let cancel = false;
    checkBiz().then(() => { if (cancel) return; }).catch(() => {});
    return () => { cancel = true; };
  }, [checkBiz]);

  // Re-verificar cuando se crea un negocio — el guard se ejecutó antes de que existiera
  useEffect(() => {
    const onBizCreated = () => checkBiz();
    window.addEventListener('business:created', onBizCreated);
    window.addEventListener('business:switched', onBizCreated);
    return () => {
      window.removeEventListener('business:created', onBizCreated);
      window.removeEventListener('business:switched', onBizCreated);
    };
  }, [checkBiz]);

  if (loading) return <div className="page-wrap">Cargando…</div>;
  if (!hasBiz && loc.pathname !== '/perfil') return <Navigate to="/perfil" replace />;
  return <Outlet />;
}