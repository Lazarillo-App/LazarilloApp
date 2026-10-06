// src/hooks/usePendientesCount.js
import React, { useEffect, useState } from 'react';
import { useAccess } from '@/context/AccessContext';
import { listarPropuestas, listarMisPropuestas } from '@/servicios/apiRecetaProposals';

// Cantidad para la pestaña: admin = propuestas abiertas; staff = cambios con novedades desde la última vez que abrió Pendientes.
export function usePendientesCount(businessId) {
  const { isStaff } = useAccess() || {};
  const [n, setN] = useState(0);
  const cargar = React.useCallback(() => {
    if (!businessId) return;
    const seenKey = `lazarillo:pendientesVisto:${businessId}`;
    const visto = Number(localStorage.getItem(seenKey) || 0);
    (isStaff ? listarMisPropuestas(businessId) : listarPropuestas(businessId))
      .then((lista) => {
        if (!isStaff) { setN(lista.length); return; }
        setN(lista.filter((p) => p.status !== 'pending' && new Date(p.decided_at || p.created_at).getTime() > visto).length);
      })
      .catch(() => setN(0));
  }, [businessId, isStaff]);
  useEffect(() => {
    cargar();
    window.addEventListener('receta-proposals:changed', cargar);
    return () => window.removeEventListener('receta-proposals:changed', cargar);
  }, [cargar]);
  return n;
}

// Marca como visto (staff) al abrir la pestaña
export function marcarPendientesVistos(businessId) {
  try { localStorage.setItem(`lazarillo:pendientesVisto:${businessId}`, String(Date.now())); } catch { /* sin storage: solo se pierde el contador visto */ }
  window.dispatchEvent(new CustomEvent('receta-proposals:changed'));
}

