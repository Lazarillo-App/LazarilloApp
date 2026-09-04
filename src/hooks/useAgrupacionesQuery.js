// src/hooks/useAgrupacionesQuery.js
// Lista de agrupaciones de un negocio, cacheada (sobrevive la navegación entre
// pantallas). Complementa a `refetchAgrupaciones` en ArticulosMain.jsx, que sigue
// existiendo para refrescos explícitos (crear/borrar/mover grupo, etc.) — ese callback
// además actualiza esta misma cache (`setQueryData`) para que quede sincronizada.
import { useQuery } from '@tanstack/react-query';
import { obtenerAgrupaciones } from '@/servicios/apiAgrupaciones';
import { qk, STALE } from '@/lib/reactQueryClient';

async function fetchAgrupaciones(bizId, divisionId) {
  const { list, orgAssignedIds } = await obtenerAgrupaciones(bizId, divisionId ?? null);
  const filtered = (list || []).filter(ag => !ag.moved_to_business_id);
  return { filtered, orgAssignedIds };
}

export function useAgrupacionesQuery(bizId, divisionId) {
  return useQuery({
    enabled: Number.isFinite(bizId) && bizId > 0,
    queryKey: qk.agrupaciones(bizId, divisionId ?? null),
    queryFn: () => fetchAgrupaciones(bizId, divisionId),
    staleTime: STALE.CATALOG,
    gcTime: STALE.CATALOG,
  });
}
