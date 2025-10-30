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
  listMode = 'by-subrubro', //  ⬅️  "by-subrubro" | "by-categoria"
}) {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];
  const loading = categoriasSafe.length === 0;

  // Select de agrupaciones
  const opcionesSelect = useMemo(() => {
    const base = (Array.isArray(agrupaciones) ? agrupaciones : [])
      .filter(Boolean)
      .filter(g => Number(g.id) !== Number(todoGroupId))
      .filter(g => !isRealSin(g));
    return Number.isFinite(Number(todoGroupId))
      ? [{ id: Number(todoGroupId), nombre: 'TODO', articulos: [] }, ...base]
      : base;
  }, [agrupaciones, todoGroupId]);

  // Set de ids activos
  const activeIds = useMemo(() => {
    if (visibleIds && visibleIds.size) return visibleIds;
    const g = agrupacionSeleccionada;
    if (!g) return null;
    if (Number(g.id) === Number(todoGroupId)) return null;
    const gActual = (agrupaciones || []).find(x => Number(x?.id) === Number(agrupacionSeleccionada?.id));
    const arr = Array.isArray(gActual?.articulos) ? gActual.articulos : [];
    if (!arr.length) return null;
    return new Set(arr.map(a => Number(a?.id)).filter(Number.isFinite));
  }, [visibleIds, agrupacionSeleccionada, agrupaciones, todoGroupId]);

  useEffect(() => {
    if (!agrupacionSeleccionada) return;
    const g = (agrupaciones || []).find(x => Number(x?.id) === Number(agrupacionSeleccionada.id));
    if (!g) return;
    // Actualizá solo si cambió algo visible (nombre o cantidad de artículos)
    const changed =
      g.nombre !== agrupacionSeleccionada.nombre ||
      (Array.isArray(g.articulos) ? g.articulos.length : 0) !==
      (Array.isArray(agrupacionSeleccionada.articulos) ? agrupacionSeleccionada.articulos.length : 0);
    if (changed) setAgrupacionSeleccionada?.(g);
  }, [agrupaciones]);


  // === Construcciones según modo =================================================
  // MODO SUBRUBRO: usamos directamente el árbol { subrubro, categorias:[...] } que viene del backend
  const treeBySubrubro = useMemo(() => {
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
          total = (Array.isArray(c?.articulos) ? c.articulos.length : 0);
        }
        return total > 0;
      });
    return pruned;
  }, [categoriasSafe, activeIds]);

  // MODO CATEGORÍA: re-agrupamos por categoría y fabricamos un "subrubro" sintético con nombre = categoría
  const treeByCategoria = useMemo(() => {
    const catMap = new Map(); // categoria -> artículos
    for (const sub of categoriasSafe) {
      const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
      for (const c of cats) {
        const catName = String(c?.categoria || 'Sin categoría');
        const arts = Array.isArray(c?.articulos) ? c.articulos : [];
        if (!catMap.has(catName)) catMap.set(catName, []);
        catMap.get(catName).push(...arts);
      }
    }
    const out = [];
    for (const [catName, arts] of catMap.entries()) {
      const filtered = !activeIds ? arts : arts.filter(a => activeIds.has(Number(a?.id)));
      if (filtered.length > 0) {
        out.push({
          subrubro: catName, // <- mostramos esto
          categorias: [{ categoria: catName, articulos: filtered }],
        });
      }
    }
    out.sort((a, b) =>
      String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true })
    );
    return out;
  }, [categoriasSafe, activeIds]);

  // Elegimos el árbol según listMode
  const listaParaMostrar = listMode === 'by-categoria' ? treeByCategoria : treeBySubrubro;

  // Si lo seleccionado deja de existir, limpiar
  useEffect(() => {
    if (!categoriaSeleccionada) return;
    const stillVisible = listaParaMostrar.some(
      sub => sub?.subrubro === categoriaSeleccionada?.subrubro
        && (sub?.categorias || []).some(c => (c?.articulos?.length || 0) > 0)
    );
    if (!stillVisible) setCategoriaSeleccionada?.(null);
  }, [listaParaMostrar, categoriaSeleccionada, setCategoriaSeleccionada]);

  // Handlers
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
  }, [agrupaciones, todoGroupId, setAgrupacionSeleccionada, setFiltroBusqueda, setCategoriaSeleccionada, setBusqueda, onManualPick]);

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
    for (const c of cats) total = (Array.isArray(c?.articulos) ? c.articulos.length : 0);
    return total;
  };

  return (
    <div className="sidebar">
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Agrupaciones</InputLabel>
        <Select
          label="Agrupaciones"
          sx={{ fontWeight: '500' }}
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

      <h3>{listMode === 'by-categoria' ? 'Categorías' : 'Subrubros'}</h3>
      <ul>
        {loading && <li style={{ opacity: 0.7 }}>
          Cargando {listMode === 'by-categoria' ? 'categorías' : 'subrubros'}…
        </li>}
        {!loading && listaParaMostrar.map((sub) => {
          const active = categoriaSeleccionada?.subrubro === sub?.subrubro;
          return (
            <li
              key={sub?.subrubro || (listMode === 'by-categoria' ? '(sin categoría)' : '(sin subrubro)')}
              onClick={() => handleCategoriaClick(sub)}
              className={active ? 'categoria-activa' : undefined}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
              title={sub?.subrubro || (listMode === 'by-categoria' ? 'Sin categoría' : 'Sin subrubro')}
            >
              <span><span className="icono" /> {sub?.subrubro || (listMode === 'by-categoria' ? 'Sin categoría' : 'Sin subrubro')}</span>
              <small style={{ opacity: 0.65 }}>{countArticulosSub(sub)}</small>
            </li>
          );
        })}
        {!loading && listaParaMostrar.length === 0 && (
          <li style={{ opacity: 0.7 }}>No hay artículos en esta agrupación.</li>
        )}
      </ul>
    </div>
  );
}

export default React.memo(SidebarCategorias);

