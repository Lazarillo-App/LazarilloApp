import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { BusinessesAPI } from '../servicios/apiBusinesses';

export default function OnboardingGuard() {
  const [loading, setLoading] = useState(true);
  const [hasBiz, setHasBiz] = useState(true); // asumí true: evita parpadeos
  const loc = useLocation();

  useEffect(() => {
    let cancel = false;
    (async () => {
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

  // si no hay locales, redirigí a perfil (donde podés crear uno)
  if (!hasBiz && loc.pathname !== '/perfil') {
    return <Navigate to="/perfil" replace />;
  }
  return <Outlet />;
}

