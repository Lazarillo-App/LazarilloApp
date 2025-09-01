// src/componentes/OnboardingGuard.jsx
import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import OnboardingWizard from './BusinessCreateModal';

export default function OnboardingGuard() {
  const [loading, setLoading] = useState(true);
  const [needs, setNeeds] = useState(false);
  const [initialId, setInitialId] = useState(localStorage.getItem('activeBusinessId') || '');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await BusinessesAPI.listMine();      // { items: [...] }
        const items = Array.isArray(resp) ? resp : (resp?.items || []);
        if (!alive) return;

        if (!items.length) {               // no hay locales ⇒ onboarding
          setNeeds(true);
          setLoading(false);
          return;
        }

        // asegurar activo
        let active = initialId && items.some(x => String(x.id) === String(initialId)) ? initialId : String(items[0].id);
        if (!initialId) {
          localStorage.setItem('activeBusinessId', active);
          setInitialId(active);
        }
        setNeeds(false);
        setLoading(false);
      } catch (e) {
        console.error('OnboardingGuard error:', e);
        setNeeds(false);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div style={{padding:24}}>Cargando…</div>;
  if (needs)   return <OnboardingWizard onDone={() => { setNeeds(false); }} />;

  return <Outlet />;
}
