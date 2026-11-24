// src/hooks/useFoodCostGeneral.js
// Food cost del KPI «General» tal como está configurado en Artículos (Diego 23/11/2026: «que tome el que se
// configura general»). Mismas fuentes y misma cuenta que KpiFoodCost (useFoodCostKpi + itemsDe), para que el
// celular y el Panel muestren exactamente el mismo número que Artículos, mes cerrado y proyectado.
//
// Devuelve un Map 'YYYY-MM' → { pct, proyPct } (fracciones: 0.279 = 27,9%), con los últimos 13 meses.
// Sin alcance (bizId 0) no pide nada y devuelve null.
import { useEffect, useMemo } from 'react';
import { useFoodCostKpi } from './useFoodCostKpi';
import { itemsDe, sumar } from '@/componentes/KpiFoodCost';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function useFoodCostGeneral(alcance) {
  const hoy = new Date();
  const desde = ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const hasta = ymd(hoy);
  const fc = useFoodCostKpi({ bizId: alcance?.bizId ?? 0, from: desde, to: hasta, activeBranchFilter: alcance?.activeBranchFilter });
  const general = useMemo(() => fc.kpis.find((k) => k.general) ?? fc.kpis[0] ?? null, [fc.kpis]);
  const mesHoy = hasta.slice(0, 7);

  // La proyección del mes en curso mira solo los rubros de compras del General (igual que KpiFoodCost).
  const rubrosKey = useMemo(() => {
    const m = (fc.porMes || []).find((x) => String(x.mes).slice(0, 7) === mesHoy);
    if (!m || !general) return null;
    const r = [...new Set(itemsDe(m.compras ?? [], fc.kpis, general.id, 'compras').map((it) => it.rubro).filter(Boolean))].sort();
    return r.length ? JSON.stringify(r) : null;
  }, [fc.porMes, fc.kpis, general, mesHoy]);
  const { setRubrosProy } = fc;
  useEffect(() => { if (rubrosKey) setRubrosProy(JSON.parse(rubrosKey)); }, [rubrosKey, setRubrosProy]);

  return useMemo(() => {
    if (!alcance?.bizId || !general || !fc.porMes?.length) return null;
    const out = new Map();
    for (const m of fc.porMes) {
      const mes = String(m.mes).slice(0, 7);
      const v = sumar(itemsDe(m.ventas ?? [], fc.kpis, general.id, 'ventas'));
      const c = sumar(itemsDe(m.compras ?? [], fc.kpis, general.id, 'compras'));
      const fila = { pct: v > 0 ? c / v : null, proyPct: null };
      if (mes === mesHoy) {
        const pr = fc.proyeccion?.mes === mesHoy ? fc.proyeccion : null;
        const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        const cerrados = pr?.cerrados ?? Math.max(1, hoy.getDate() - 1);
        if (cerrados < diasMes) {
          const pv = v * (pr?.ventas?.factor ?? diasMes / cerrados);
          const pc = c * (pr?.compras?.factor ?? diasMes / cerrados);
          fila.proyPct = pv > 0 ? pc / pv : null;
        }
      }
      out.set(mes, fila);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alcance?.bizId, general, fc.porMes, fc.kpis, fc.proyeccion, mesHoy]);
}

/** Alcance del celular: un solo negocio (un PDV, o todos sus PDV). Varios negocios juntos → null. */
export function alcanceFoodCost(sel, locales) {
  if (!sel?.length) return null;
  const localId = sel[0].localId;
  if (sel.some((s) => s.localId !== localId)) return null;
  if (sel.length === 1) {
    const p = Number(sel[0].pdvId);
    return { bizId: Number(localId), activeBranchFilter: p < 0 ? { mode: 'main' } : { mode: 'branch', branchId: p } };
  }
  const total = (locales ?? []).find((l) => Number(l.id) === Number(localId))?.puntosDeVenta?.length;
  return total && sel.length === total ? { bizId: Number(localId), activeBranchFilter: { mode: 'all' } } : null;
}
