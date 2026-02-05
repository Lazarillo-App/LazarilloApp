import { useState, useEffect, useCallback, useMemo } from 'react';
import * as apiDivisions from '@/servicios/apiDivisions';

export function useDivisions(businessId, options = {}) {
  const {
    includeInactive = false,
    includeStats = false,
    autoLoad = true,
  } = options;

  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizeList = useCallback((data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.divisions)) return data.divisions;
    if (Array.isArray(data.rows)) return data.rows;
    return [];
  }, []);

  const loadDivisions = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    setError(null);

    try {
      // Si tu backend soporta flags, pasalos acá:
      const data = await apiDivisions.getDivisions(businessId, {
        includeInactive,
        includeStats,
      });

      setDivisions(normalizeList(data));
    } catch (err) {
      setError(err?.message || 'Error cargando divisiones');
      console.error('Error cargando divisiones:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, includeInactive, includeStats, normalizeList]);

  const refetch = loadDivisions;

  const createDivision = useCallback(
    async (divisionData) => {
      setError(null);

      // 🔒 validar
      if (!businessId) {
        const e = new Error('businessId requerido para crear división');
        setError(e.message);
        throw e;
      }

      try {
        const payload = {
          businessId,
          ...(divisionData || {}),
        };

        if (!payload.name || !String(payload.name).trim()) {
          const e = new Error('name requerido para crear división');
          setError(e.message);
          throw e;
        }

        // ✅ ACÁ estaba el bug: llamar al API, NO a createDivision()
        const resp = await apiDivisions.createDivision(payload);

        const created = resp?.division || resp;

        if (created?.id) {
          setDivisions((prev) => {
            const idNew = Number(created.id);
            const exists = prev.some((d) => Number(d.id) === idNew);
            if (exists) {
              return prev.map((d) => (Number(d.id) === idNew ? created : d));
            }
            return [...prev, created];
          });
        }

        return created;
      } catch (err) {
        setError(err?.message || 'Error creando división');
        throw err;
      }
    },
    [businessId]
  );

  const updateDivision = useCallback(async (divisionId, updates) => {
    setError(null);

    try {
      const resp = await apiDivisions.updateDivision(divisionId, updates);
      const updated = resp?.division || resp;

      setDivisions((prev) =>
        prev.map((d) => (Number(d.id) === Number(divisionId) ? updated : d))
      );

      return updated;
    } catch (err) {
      setError(err?.message || 'Error actualizando división');
      throw err;
    }
  }, []);

  const deleteDivision = useCallback(async (divisionId) => {
    setError(null);

    try {
      const resp = await apiDivisions.deleteDivision(divisionId);
      setDivisions((prev) => prev.filter((d) => Number(d.id) !== Number(divisionId)));
      return resp;
    } catch (err) {
      setError(err?.message || 'Error eliminando división');
      throw err;
    }
  }, []);

  useEffect(() => {
    setDivisions([]);
    setError(null);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (autoLoad && businessId) loadDivisions();
  }, [autoLoad, businessId, loadDivisions]);

  const hasDivisions = useMemo(() => (divisions?.length || 0) > 0, [divisions]);

  return {
    divisions,
    loading,
    error,
    loadDivisions,
    refetch,
    createDivision,
    updateDivision,
    deleteDivision,
    hasDivisions,
  };
}
