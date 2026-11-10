// src/hooks/useFoodCostKpi.js
// Datos del KPI de food cost (KpiFoodCost) para usarlo fuera de Gestión de
// Artículos — hoy en Insumos (pedido de Diego, 02/11: "el food cost tiene que
// estar tanto en insumos como en menú"). Mismas fuentes y mismo criterio que
// ArticulosMain.jsx (ventas /sales/summary + árbol de artículos, compras
// /purchases/food-cost, evolución mensual con las mismas claves de caché que
// ArticulosMain → si ya se vio Menú, acá no se vuelve a pedir nada).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/servicios/apiBase';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { purchasesFoodCost, purchasesFoodCostMonthly } from '@/servicios/apiPurchases';
import { useArticlesTree } from '@/hooks/useArticlesTree';
import { useAgrupacionesQuery } from '@/hooks/useAgrupacionesQuery';
import { STALE } from '@/lib/reactQueryClient';
import { esTodoGroup, esDiscontinuadosGroup, esTop20Group } from '@/utils/articuloGruposEspeciales';
import { kpiGeneralSemilla } from '@/componentes/KpiFoodCost';

const artId = (a) => {
  const n = Number(a?.article_id ?? a?.articulo_id ?? a?.articuloId ?? a?.id);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

const branchParamDe = (f) => (f?.mode === 'branch' ? f.branchId : f?.mode === 'main' ? 'none' : 'all');
const branchSalesDe = (f) => (f?.mode === 'main' ? 'main' : f?.mode === 'branch' ? f.branchId : null);

export function useFoodCostKpi({ bizId, from, to, activeBranchFilter }) {
  const biz = Number(bizId) || 0;
  const habil = biz > 0 && !!from && !!to;
  const branchParam = branchParamDe(activeBranchFilter);
  const branchSales = branchSalesDe(activeBranchFilter);

  const { data: tree } = useArticlesTree(biz);
  const { data: agrupData } = useAgrupacionesQuery(biz, null);
  const agrupaciones = agrupData?.filtered || [];

  // Primera agrupación real de cada artículo (orden por id), sin Todo /
  // Discontinuados / Top 20 — mismo criterio que ArticulosMain.
  const agrupacionDe = useMemo(() => {
    const porArt = new Map();
    [...agrupaciones]
      .filter((g) => !esTodoGroup(g) && !esDiscontinuadosGroup(g) && !esTop20Group(g))
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((g) => {
        const ids = [
          ...(Array.isArray(g.articulos) ? g.articulos.map(artId) : []),
          ...(Array.isArray(g.app_articles_ids) ? g.app_articles_ids.map(Number) : []),
        ];
        ids.forEach((id) => { if (id && !porArt.has(id)) porArt.set(id, g.nombre || 'Sin agrupación'); });
      });
    return (id) => porArt.get(Number(id)) || 'Sin agrupación';
  }, [agrupaciones]);

  // `importes` = { [articleId]: $ }. Recorre el árbol y, al final, suma lo
  // vendido que no está en el árbol: el id 0 ("ARTÍCULOS INEXISTENTES" de
  // MaxiRest) y artículos que ya no están en el catálogo. Antes quedaban
  // afuera del total de ventas (pedido de Diego, 05/11: no se pueden dejar
  // afuera los inexistentes).
  const recorrerArbol = useCallback((importes) => {
    const out = [];
    const vistos = new Set();
    for (const sub of tree || []) {
      const rubro = sub?.subrubro || 'Sin rubro';
      for (const cat of sub?.categorias || []) {
        const subrubro = cat?.categoria || 'Sin subrubro';
        for (const a of cat?.articulos || []) {
          const id = artId(a);
          if (id == null || vistos.has(id)) continue;
          vistos.add(id);
          const importe = importes[id] || 0;
          if (!(importe > 0)) continue;
          out.push({ id: String(id), nombre: a?.nombre || `#${id}`, agrupacion: agrupacionDe(id), rubro, subrubro, importe });
        }
      }
    }
    Object.entries(importes || {}).forEach(([k, importe]) => {
      const id = Number(k);
      // Distinto de 0 (no solo > 0): una devolución sin artículo resta del total.
      if (vistos.has(id) || !importe) return;
      out.push({
        id: String(id),
        // Diego 10/11/2026: aparecen en la selección del KPI como «Sin rubro», y ahí elige en qué food cost van.
        nombre: id === 0 ? 'Ventas sin artículo (MaxiRest)' : `#${id} (fuera del catálogo)`,
        agrupacion: 'Sin agrupación', rubro: 'Sin rubro', subrubro: 'Sin subrubro', importe,
      });
    });
    return out;
  }, [tree, agrupacionDe]);

  // Ventas del período (una fila por artículo).
  const { data: ventasPeriodo } = useQuery({
    enabled: habil,
    queryKey: ['fcVentasPeriodo', biz, from, to, branchSales ?? 'all'],
    staleTime: STALE.SALES,
    queryFn: async () => {
      const bq = branchSales != null ? `&branch_id=${branchSales}` : '';
      const resp = await api(`/businesses/${biz}/sales/summary?from=${from}&to=${to}${bq}`);
      const rows = Array.isArray(resp) ? resp : (resp?.items || []);
      const m = {};
      rows.forEach((r) => {
        const id = Number(r.article_id ?? r.articuloId ?? r.articulo_id ?? r.id);
        if (!Number.isFinite(id) || id < 0) return; // 0 = sin artículo, cuenta igual
        m[id] = (m[id] || 0) + Number(r.total_amount ?? r.amount ?? r.total ?? 0);
      });
      return m;
    },
  });
  const ventas = useMemo(
    () => (ventasPeriodo ? recorrerArbol(ventasPeriodo) : []),
    [ventasPeriodo, recorrerArbol]);

  // Compras del período.
  const { data: comprasData } = useQuery({
    enabled: habil,
    queryKey: ['fcComprasPeriodo', biz, from, to, branchParam],
    staleTime: STALE.SALES,
    queryFn: () => purchasesFoodCost(biz, { from, to, branch_id: branchParam }),
  });
  const compras = useMemo(() => (comprasData || []).filter((i) => i.importe > 0), [comprasData]);

  // Evolución mensual (13 meses terminando en el mes de `to`) — mismas claves
  // que ArticulosMain para compartir la caché.
  const mesesFrom = useMemo(() => {
    if (!to) return null;
    const [y, m] = to.slice(0, 7).split('-').map(Number);
    return new Date(y, m - 1 - 12, 1).toISOString().slice(0, 10);
  }, [to]);
  const { data: ventasMes } = useQuery({
    enabled: habil && !!mesesFrom,
    queryKey: ['fcVentasMes', biz, mesesFrom, to, branchParam],
    staleTime: STALE.SALES,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const bq = branchParam && branchParam !== 'all' ? `&branch_id=${branchParam}` : '';
      const data = await api(`/businesses/${biz}/sales/items?from=${mesesFrom}&to=${to}${bq}&por=mes`);
      const porMes = {};
      (data?.items || []).forEach((r) => {
        const id = Number(r.article_id);
        const mes = String(r.day || '').slice(0, 7);
        if (!Number.isFinite(id) || !mes) return;
        const mm = (porMes[mes] ||= {});
        mm[id] = (mm[id] || 0) + Number(r.amount || 0);
      });
      return porMes;
    },
  });
  const { data: comprasMes } = useQuery({
    enabled: habil && !!mesesFrom,
    queryKey: ['fcComprasMes', biz, mesesFrom, to, branchParam],
    staleTime: STALE.SALES,
    gcTime: 30 * 60 * 1000,
    queryFn: () => purchasesFoodCostMonthly(biz, { from: mesesFrom, to, branch_id: branchParam }),
  });
  const porMes = useMemo(() => {
    const byMes = new Map();
    Object.entries(ventasMes || {}).forEach(([mes, amounts]) => {
      byMes.set(mes, { mes, ventas: recorrerArbol(amounts), compras: [] });
    });
    (comprasMes || []).forEach(({ mes, items }) => {
      if (!byMes.has(mes)) byMes.set(mes, { mes, ventas: [], compras: [] });
      byMes.get(mes).compras = items;
    });
    return [...byMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }, [ventasMes, comprasMes, recorrerArbol]);

  // KPIs configurados (se guardan en el negocio, compartidos con Menú).
  const [kpis, setKpis] = useState([]);
  const cargadoRef = useRef(false);
  useEffect(() => {
    if (!biz) return;
    cargadoRef.current = false;
    BusinessesAPI.getFoodCostKpis(biz)
      .then((k) => { cargadoRef.current = true; setKpis(k.length ? k : [kpiGeneralSemilla()]); })
      .catch(() => { cargadoRef.current = true; setKpis([kpiGeneralSemilla()]); });
  }, [biz]);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const onChange = useCallback((nuevos) => {
    setKpis(nuevos);
    if (!cargadoRef.current || !biz) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      BusinessesAPI.update(biz, { props: { food_cost_kpis: nuevos } })
        .catch((e) => console.error('[food-cost-kpis] error guardando:', e));
    }, 600);
  }, [biz]);

  const periodoLabel = useMemo(() => {
    if (!from || !to) return '';
    const f = (iso) => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${String(y).slice(2)}`; };
    return `${f(from)} — ${f(to)}`;
  }, [from, to]);

  return { ventas, compras, kpis, onChange, periodoLabel, porMes };
}
