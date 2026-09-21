// src/hooks/useNormalizarNombres.js
// Normaliza el formato (MAYÚSCULA / Título) de nombres de artículos, insumos,
// rubros y subrubros de un negocio. Una sola función — la usan tanto
// Configuración (donde nació) como Vista Diseño (que solo necesita disparar
// la misma acción, no una versión propia).
import { useCallback, useState } from 'react';
import { http } from '@/servicios/apiBusinesses';
import { showConfirm } from '@/servicios/appConfirm';

export function useNormalizarNombres(businessId) {
  const [formato, setFormato] = useState('titulo'); // 'titulo' | 'mayuscula'
  const [normalizando, setNormalizando] = useState(false);

  const normalizar = useCallback(async () => {
    if (!businessId) return null;
    const etiqueta = formato === 'mayuscula' ? 'MAYÚSCULA' : 'Título (Primera mayúscula, resto minúscula)';
    const ok = await showConfirm(
      `Esto va a cambiar el nombre de TODOS los artículos, insumos, rubros y subrubros de este negocio a formato "${etiqueta}". No se puede deshacer con un solo click (habría que normalizar de nuevo con otro formato). ¿Confirmás?`,
      { danger: true }
    );
    if (!ok) return null;
    setNormalizando(true);
    try {
      const [rArt, rIns] = await Promise.all([
        http(`/businesses/${businessId}/articles/normalizar-nombres`, { method: 'POST', body: { formato }, withBusinessId: false }),
        http(`/insumos/normalizar-nombres`, { method: 'POST', body: { formato } }),
      ]);
      try {
        window.dispatchEvent(new CustomEvent('articulos:updated'));
        window.dispatchEvent(new CustomEvent('insumos:updated'));
      } catch { /* no-op */ }
      return { articulos: rArt?.cambiados || 0, insumos: rIns?.cambiados || 0 };
    } finally {
      setNormalizando(false);
    }
  }, [businessId, formato]);

  return { formato, setFormato, normalizando, normalizar };
}
