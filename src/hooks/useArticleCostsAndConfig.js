// src/hooks/useArticleCostsAndConfig.js
// Costos de receta + price config + config del negocio + alertas de ventas, para la
// tabla de Artículos. Antes se pedía en un useEffect sin caché en cada montaje de
// ArticulosMain (recetasCostos/priceConfig quedaban vacíos hasta que resolvía, en CADA
// navegación de vuelta a /menu); ahora queda cacheado igual que el árbol de artículos.
import { useQuery } from '@tanstack/react-query';
import { RecetasAPI, PriceConfigAPI } from '@/servicios/apiBusinesses';
import { BASE } from '@/servicios/apiBase';
import { qk, STALE } from '@/lib/reactQueryClient';

async function fetchArticleCostsAndConfig(bizId) {
  const token = localStorage.getItem('token') || '';
  const headers = { Authorization: `Bearer ${token}`, 'X-Business-Id': String(bizId) };
  const [costosRes, configRes, elaboradosRes, configNegocio, alertaVentasRes] = await Promise.all([
    RecetasAPI.getCostos(bizId).catch(() => ({ costos: {} })),
    PriceConfigAPI.getAll(bizId).catch(() => ({ byArticle: {}, byRubro: {}, byAgrupacion: {} })),
    fetch(`${BASE}/businesses/${bizId}/config`, { headers }).then(r => r.json()).catch(() => ({})),
    fetch(`${BASE}/businesses/${bizId}/articles-alertas-ventas`, { headers }).then(r => r.json()).catch(() => ({ hayAlerta: false })),
  ]);
  // NOTA: esto preserva tal cual un desfasaje que ya existía en ArticulosMain.jsx antes
  // de esta migración — el .then() original destructuraba 5 nombres
  // (costosRes, configRes, elaboradosRes, configNegocio, alertaVentasRes) para solo 4
  // promesas, así que "elaboradosRes" terminaba leyendo la respuesta de /config y
  // "configNegocio" la de /articles-alertas-ventas ("alertaVentasRes" queda undefined,
  // no hay una 5ta promesa). Efecto observable hoy: recetasElaborados siempre {}, y el
  // sync de costo_ideal/redondeo/alertaVentas de ESTE fetch nunca corre. Se deja igual
  // a propósito (no es lo que se pidió arreglar) — el consumidor mapea con el mismo
  // desfasaje para no cambiar comportamiento de forma no solicitada.
  return { costosRes, configRes, elaboradosRes, configNegocio, alertaVentasRes };
}

export function useArticleCostsAndConfig(bizId) {
  return useQuery({
    enabled: Number.isFinite(bizId) && bizId > 0,
    queryKey: qk.articleCostsConfig(bizId),
    queryFn: () => fetchArticleCostsAndConfig(bizId),
    staleTime: STALE.CATALOG,
    gcTime: STALE.CATALOG,
  });
}
