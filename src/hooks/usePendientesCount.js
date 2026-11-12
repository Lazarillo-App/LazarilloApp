// src/hooks/usePendientesCount.js
import React, { useEffect, useState } from 'react';
import { useAccess } from '@/context/AccessContext';
import { listarPropuestas, listarMisPropuestas, listarPropuestasEquipo } from '@/servicios/apiRecetaProposals';

// Cantidad para la pestaña: admin = propuestas abiertas; staff = cambios con novedades desde la última vez que abrió Pendientes.
export function usePendientesCount(businessId) {
  const { isStaff, isJefe } = useAccess() || {};
  const [n, setN] = useState(0);
  const cargar = React.useCallback(() => {
    if (!businessId) return;
    const seenKey = `lazarillo:pendientesVisto:${businessId}`;
    const visto = Number(localStorage.getItem(seenKey) || 0);
    // Jefe de cocina: suma lo de su equipo que espera su OK (Diego 11/11/2026).
    const equipo = isJefe ? listarPropuestasEquipo(businessId).then((l) => l.filter((p) => p.status === 'pending').length).catch(() => 0) : Promise.resolve(0);
    Promise.all([isStaff ? listarMisPropuestas(businessId) : listarPropuestas(businessId), equipo])
      .then(([lista, nEquipo]) => {
        if (!isStaff) { setN(lista.length); return; }
        setN(nEquipo + lista.filter((p) => p.status !== 'pending' && new Date(p.decided_at || p.created_at).getTime() > visto).length);
      })
      .catch(() => setN(0));
  }, [businessId, isStaff, isJefe]);
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

