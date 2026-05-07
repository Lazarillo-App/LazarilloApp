// src/hooks/useFirstDate.js
// Hook para obtener la primera fecha con datos en la DB para un negocio dado.
// Cada contexto (ventas, compras) usa su propio endpoint y businessId,
// evitando que se mezclen las fechas históricas entre negocios o entre ventas/compras.

import { useState, useEffect } from 'react';
import { BASE } from '../servicios/apiBase';

/**
 * @param {string|number|null} businessId  - ID del negocio activo
 * @param {'sales'|'purchases'}  type      - qué tipo de primera fecha buscar
 * @returns {{ firstDate: string|null, loadingFirst: boolean }}
 */
export function useFirstDate(businessId, type = 'sales', branchId = null, refreshKey = 0) {
  const [firstDate, setFirstDate] = useState(null);
  const [loadingFirst, setLoadingFirst] = useState(false);
  const [internalKey, setInternalKey] = useState(0);

  useEffect(() => {
    const eventName = type === 'purchases' ? 'purchases:batch:changed' : 'sales:batch:changed';
    const handler = (e) => {
      if (!e.detail?.businessId || String(e.detail.businessId) === String(businessId)) {
        setInternalKey(k => k + 1);
      }
    };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [businessId, type]);

  useEffect(() => {
    setFirstDate(null);
    if (!businessId) return;

    const token = localStorage.getItem('token') || '';
    const bid = String(businessId);
    const headers = {
      'Content-Type': 'application/json',
      'X-Business-Id': bid,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let url;
    if (type === 'purchases') {
      const branchParam = branchId && branchId !== 'main'
        ? `?branch_id=${branchId}`
        : branchId === 'main'
          ? `?branch_id=main`
          : '';
      url = `${BASE}/purchases/first-date${branchParam}`;
    } else {
      // Agregar branch_id al query si es sucursal real
      const branchParam = branchId && branchId !== 'main'
        ? `?branch_id=${branchId}`
        : branchId === 'main'
          ? `?branch_id=main`
          : '';
      url = `${BASE}/businesses/${bid}/sales/first-date${branchParam}`;
    }

    let cancelled = false;
    setLoadingFirst(true);

    fetch(url, { headers })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        if (cancelled) return;
        const raw = d?.first_date ?? d?.firstDate ?? null;
        if (raw) {
          // Garantizar formato YYYY-MM-DD siempre
          const clean = String(raw).slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) setFirstDate(clean);
        }
      })
      .catch(() => { })
      .finally(() => { if (!cancelled) setLoadingFirst(false); });

    return () => { cancelled = true; };
  }, [businessId, type, branchId, refreshKey, internalKey]);

  return { firstDate, loadingFirst };
}