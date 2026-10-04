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
  // OJO: antes faltaba acá el fetch de /recetas-elaborados — el Promise.all solo traía
  // 4 cosas pero se destructuraban 5 nombres, así que "elaboradosRes" terminaba leyendo
  // la respuesta de /config (y "configNegocio" la de /articles-alertas-ventas). Efecto
  // real: recetasElaborados (en ArticulosMain) quedaba SIEMPRE {} para cualquier receta
  // abierta desde Menú/Artículos — el modal nunca sabía que un ingrediente era un
  // elaborado con su propio rendimiento/peso-equivalente, y lo costeaba como si fuera
  // un insumo comprado común (sin la conversión u↔gr que necesita un elaborado que
  // rinde "porción"). Mismo endpoint que ya usa InsumosMain.jsx correctamente.
  const [costosRes, configRes, elaboradosRes, configNegocio, alertaVentasRes] = await Promise.all([
    RecetasAPI.getCostos(bizId).catch(() => ({ costos: {} })),
    PriceConfigAPI.getAll(bizId).catch(() => ({ byArticle: {}, byRubro: {}, byAgrupacion: {} })),
    fetch(`${BASE}/businesses/${bizId}/recetas-elaborados`, { headers }).then(r => r.json()).catch(() => ({ ok: false, data: {} })),
    fetch(`${BASE}/businesses/${bizId}/config`, { headers }).then(r => r.json()).catch(() => ({})),
    fetch(`${BASE}/businesses/${bizId}/articles-alertas-ventas`, { headers }).then(r => r.json()).catch(() => ({ hayAlerta: false })),
  ]);
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
