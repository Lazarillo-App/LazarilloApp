/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useCallback } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import '../css/SidebarCategorias.css';

const norm = (s) => String(s || '').trim().toLowerCase();
const isRealSin = (g) => {
  const n = norm(g?.nombre);
  return n === 'sin agrupacion' || n === 'sin agrupación' || n === 'todo';
};

const labelAgrup = (g, todoGroupId) =>
  Number(g?.id) === Number(todoGroupId) ? 'Sin Agrupación' : (g?.nombre || '');

function SidebarCategorias({
  categorias = [],
  setCategoriaSeleccionada,
  agrupaciones = [],
  agrupacionSeleccionada,
  setAgrupacionSeleccionada,
  setFiltroBusqueda,
  setBusqueda,
  categoriaSeleccionada,
  todoGroupId,
  visibleIds,
  onManualPick,
}) {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];
  const loading = categoriasSafe.length === 0;

    const opcionesSelect = useMemo(() => {
    const base = (Array.isArray(agrupaciones) ? agrupaciones : [])
      .filter(Boolean)
      .filter(g => Number(g.id) !== Number(todoGroupId))
      .filter(g => !isRealSin(g));
    return Number.isFinite(Number(todoGroupId))
      ? [{ id: Number(todoGroupId), nombre: 'TODO', articulos: [] }, ...base]
      : base;
  }, [agrupaciones, todoGroupId]);
  
  const activeIds = useMemo(() => {
    if (visibleIds && visibleIds.size) return visibleIds;
    const g = agrupacionSeleccionada;
    if (!g) return null;
    if (Number(g.id) === Number(todoGroupId)) return null;
    const arr = Array.isArray(g?.articulos) ? g.articulos : [];
    if (!arr.length) return null;
    return new Set(arr.map(a => Number(a?.id)).filter(Number.isFinite));
  }, [visibleIds, agrupacionSeleccionada, todoGroupId]);

  const categoriasParaMostrar = useMemo(() => {
    if (!activeIds) return categoriasSafe;
    const pruned = categoriasSafe
      .map(sub => {
        const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
        const keepCategorias = cats
          .map(c => {
            const arts = (Array.isArray(c?.articulos) ? c.articulos : [])
              .filter(a => activeIds.has(Number(a?.id)));
            return { ...c, articulos: arts };
          })
          .filter(c => (Array.isArray(c.articulos) ? c.articulos.length : 0) > 0);
        return { ...sub, categorias: keepCategorias };
      })
      .filter(sub => {
        let total = 0;
        for (const c of (sub?.categorias || [])) {
          total += (Array.isArray(c?.articulos) ? c.articulos.length : 0);
        }
        return total > 0;
      });
    return pruned;
  }, [categoriasSafe, activeIds]);

  useEffect(() => {
    if (!categoriaSeleccionada) return;
    const stillVisible = categoriasParaMostrar.some(
      sub => sub?.subrubro === categoriaSeleccionada?.subrubro
        && (sub?.categorias || []).some(c => (c?.articulos?.length || 0) > 0)
    );
    if (!stillVisible) setCategoriaSeleccionada?.(null);
  }, [categoriasParaMostrar, categoriaSeleccionada, setCategoriaSeleccionada]);

  const handleAgrupacionChange = useCallback((event) => {
    const idSel = Number(event.target.value);
    const seleccionada =
      Number(idSel) === Number(todoGroupId)
        ? { id: Number(todoGroupId), nombre: 'TODO', articulos: [] }
        : (agrupaciones || []).find(g => Number(g?.id) === idSel) || null;

    setAgrupacionSeleccionada?.(seleccionada);
    setFiltroBusqueda?.('');
    setCategoriaSeleccionada?.(null);
    setBusqueda?.('');
    onManualPick?.();
  }, [agrupaciones, todoGroupId, setAgrupacionSeleccionada, setFiltroBusqueda, setCategoriaSeleccionada, setBusqueda]);

  const handleCategoriaClick = useCallback((subItem) => {
    setCategoriaSeleccionada?.(
      categoriaSeleccionada?.subrubro === subItem?.subrubro ? null : subItem
    );
    setFiltroBusqueda?.('');
    setBusqueda?.('');
  }, [categoriaSeleccionada, setCategoriaSeleccionada, setFiltroBusqueda, setBusqueda]);

  const countArticulosSub = (sub) => {
    let total = 0;
    const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
    for (const c of cats) total += (Array.isArray(c?.articulos) ? c.articulos.length : 0);
    return total;
  };

  return (
    <div className="sidebar">
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Agrupaciones</InputLabel>
        <Select
          label="Agrupaciones"
          sx={{ fontWeight: '600' }}
          value={
            agrupacionSeleccionada
              ? Number(agrupacionSeleccionada.id)
              : (Number.isFinite(Number(todoGroupId)) ? Number(todoGroupId) : '')
          }
          onChange={handleAgrupacionChange}
        >
          {opcionesSelect.map(g => (
            <MenuItem key={g.id} value={Number(g.id)}>
              {labelAgrup(g, todoGroupId)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <h3>Subrubros</h3>
      <ul>
        {loading && <li style={{ opacity: 0.7 }}>Cargando subrubros…</li>}
        {!loading && categoriasParaMostrar.map((sub) => {
          const active = categoriaSeleccionada?.subrubro === sub?.subrubro;
          return (
            <li
              key={sub?.subrubro || '(sin subrubro)'}
              onClick={() => handleCategoriaClick(sub)}
              className={active ? 'categoria-activa' : undefined}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
              title={sub?.subrubro || 'Sin subrubro'}
            >
              <span><span className="icono" /> {sub?.subrubro || 'Sin subrubro'}</span>
              <small style={{ opacity: 0.65 }}>{countArticulosSub(sub)}</small>
            </li>
          );
        })}
        {!loading && categoriasParaMostrar.length === 0 && (
          <li style={{ opacity: 0.7 }}>No hay artículos en esta agrupación.</li>
        )}
      </ul>
    </div>
  );
}

export default React.memo(SidebarCategorias);
