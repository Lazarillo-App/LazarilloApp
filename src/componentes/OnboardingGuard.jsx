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

  useEffect(() => {
    let cancel = false;

    (async () => {
      const token = localStorage.getItem('token');
      if (!token) {                       // no logueado → no consultes nada
        if (!cancel) { setLoading(false); setHasBiz(true); }
        return;
      }

      const role = getRole();
      if (role === 'app_admin') {         // admin de plataforma → no chequees locales
        if (!cancel) { setLoading(false); setHasBiz(true); }
        return;
      }

      try {
        const list = await BusinessesAPI.listMine();
        if (!cancel) setHasBiz((list || []).length > 0);
      } catch {
        if (!cancel) setHasBiz(false);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, []);

  if (loading) return <div className="page-wrap">Cargando…</div>;
  if (!hasBiz && loc.pathname !== '/perfil') return <Navigate to="/perfil" replace />;
  return <Outlet />;
}
