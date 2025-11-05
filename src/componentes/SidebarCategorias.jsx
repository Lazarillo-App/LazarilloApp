/* eslint-disable no-empty */
/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useEffect, useMemo, useCallback, useRef, useState
} from 'react';
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
  listMode = 'by-subrubro', // "by-subrubro" | "by-categoria"
  onReorderSubrubros,       // (nuevoOrden: string[]) => void (opcional)
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
    const changed =
      g.nombre !== agrupacionSeleccionada.nombre ||
      (Array.isArray(g.articulos) ? g.articulos.length : 0) !==
      (Array.isArray(agrupacionSeleccionada.articulos) ? agrupacionSeleccionada.articulos.length : 0);
    if (changed) setAgrupacionSeleccionada?.(g);
  }, [agrupaciones]);

  /* ==========================
     Árbol según modo
  ========================== */
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
          total += (Array.isArray(c?.articulos) ? c.articulos.length : 0);
        }
        return total > 0;
      });
    return pruned;
  }, [categoriasSafe, activeIds]);

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
          subrubro: catName,
          categorias: [{ categoria: catName, articulos: filtered }],
        });
      }
    }
    out.sort((a, b) =>
      String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true })
    );
    return out;
  }, [categoriasSafe, activeIds]);

  const listaBase = listMode === 'by-categoria' ? treeByCategoria : treeBySubrubro;

  /* ==========================
     Orden personalizado (DnD)
  ========================== */
  const storageKey = useMemo(() => {
    const groupKey = agrupacionSeleccionada?.id != null ? String(agrupacionSeleccionada.id) : 'global';
    return `lazarillo:sidebarOrder:${listMode}:${groupKey}`;
  }, [listMode, agrupacionSeleccionada?.id]);

  // Estado con el orden de claves (subrubro string)
  const [order, setOrder] = useState([]);

  // Lee/normaliza orden cuando cambian datos base
  useEffect(() => {
    const actualKeys = (listaBase || []).map(s => String(s?.subrubro || (listMode === 'by-categoria' ? 'Sin categoría' : 'Sin subrubro')));
    let saved = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch {}
    // merge: mantener orden guardado y agregar nuevas claves al final
    const merged = [
      ...saved.filter(k => actualKeys.includes(k)),
      ...actualKeys.filter(k => !saved.includes(k)),
    ];
    // limpiar claves obsoletas
    const finalKeys = merged.filter(k => actualKeys.includes(k));
    setOrder(finalKeys);
  }, [listaBase, storageKey, listMode]);

  const saveOrder = useCallback((keys) => {
    try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch {}
    onReorderSubrubros?.(keys);
  }, [storageKey, onReorderSubrubros]);

  // Aplica el orden a la lista mostrada
  const listaParaMostrar = useMemo(() => {
    if (!order?.length) return listaBase;
    const map = new Map((listaBase || []).map(s => [String(s?.subrubro || ''), s]));
    return order.map(k => map.get(k)).filter(Boolean);
  }, [listaBase, order]);

  /* ===== HTML5 Drag & Drop ===== */
  const dragIndexRef = useRef(null);
  const overIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = useCallback((idx) => (e) => {
    dragIndexRef.current = idx;
    overIndexRef.current = idx;
    setDragOverIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    // setData para Firefox
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((idx) => (e) => {
    e.preventDefault();
    if (overIndexRef.current !== idx) {
      overIndexRef.current = idx;
      setDragOverIndex(idx);
    }
  }, []);

  const handleDrop = useCallback((idx) => (e) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = idx;
    dragIndexRef.current = null;
    overIndexRef.current = null;
    setDragOverIndex(null);
    if (from == null || to == null || from === to) return;

    setOrder((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveOrder(next);
      return next;
    });
  }, [saveOrder]);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    overIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  /* ==========================
     UX: selección & contadores
  ========================== */
  useEffect(() => {
    if (!categoriaSeleccionada) return;
    const stillVisible = listaParaMostrar.some(
      sub => sub?.subrubro === categoriaSeleccionada?.subrubro
        && (sub?.categorias || []).some(c => (c?.articulos?.length || 0) > 0)
    );
    if (!stillVisible) setCategoriaSeleccionada?.(null);
  }, [listaParaMostrar, categoriaSeleccionada, setCategoriaSeleccionada]);

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
    for (const c of cats) total += (Array.isArray(c?.articulos) ? c.articulos.length : 0);
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

      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {listMode === 'by-categoria' ? 'Categorías' : 'Subrubros'}
        <small style={{ opacity: .6, fontWeight: 500 }}></small>
      </h3>

      <ul className="sidebar-draggable-list">
        {loading && (
          <li style={{ opacity: 0.7 }}>
            Cargando {listMode === 'by-categoria' ? 'categorías' : 'subrubros'}…
          </li>
        )}

        {!loading && listaParaMostrar.map((sub, idx) => {
          const keyStr = String(sub?.subrubro || (listMode === 'by-categoria' ? 'Sin categoría' : 'Sin subrubro'));
          const active = categoriaSeleccionada?.subrubro === sub?.subrubro;
          const dragOver = dragOverIndex === idx;

          return (
            <li
              key={keyStr}
              className={[
                active ? 'categoria-activa' : '',
                dragOver ? 'drag-over' : '',
              ].join(' ').trim()}
              title={keyStr}
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                alignItems: 'center',
                cursor: 'grab',
                userSelect: 'none',
              }}
            >
              <span
                onClick={() => handleCategoriaClick(sub)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }}
              >
                <span className="icono" />
                {keyStr}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <small style={{ opacity: 0.65 }}>{countArticulosSub(sub)}</small>
                <span
                  aria-hidden
                  title="Arrastrar para reordenar"
                  style={{ opacity: .6, cursor: 'grab' }}
                ></span>
              </div>
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
