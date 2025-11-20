/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useEffect, useMemo, useCallback, useRef, useState
} from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

import '../css/SidebarCategorias.css';

const norm = (s) => String(s || '').trim().toLowerCase();

const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return (
    n === 'todo' ||
    n === 'sin agrupacion' ||
    n === 'sin agrupación' ||
    n === 'sin agrupar' ||
    n === 'sin grupo'
  );
};

// ahora simplemente mostramos el nombre real
const labelAgrup = (g) => g?.nombre || '';

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
  onChangeListMode,
  // 🆕 props desde el padre
  favoriteGroupId,
  onSetFavorite,
  onEditGroup,
  onDeleteGroup,
}) {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];
  const loading = categoriasSafe.length === 0;

  // Select de agrupaciones
  const opcionesSelect = useMemo(() => {
    const arr = (Array.isArray(agrupaciones) ? agrupaciones : []).filter(Boolean);
    const todoIdNum = Number(todoGroupId);

    if (!Number.isFinite(todoIdNum)) return arr;

    const todo = arr.find(g => Number(g.id) === todoIdNum) || null;
    const others = arr.filter(g => Number(g.id) !== todoIdNum);

    return todo ? [todo, ...others] : others;
  }, [agrupaciones, todoGroupId]);

  // Valor seguro para el Select de agrupaciones (evita value=0 fuera de rango)
  const selectedAgrupValue = useMemo(() => {
    const idsOpciones = opcionesSelect.map(g => Number(g.id));

    const actualId = agrupacionSeleccionada
      ? Number(agrupacionSeleccionada.id)
      : null;

    // Si la selección actual existe en las opciones, usarla
    if (actualId != null && idsOpciones.includes(actualId)) {
      return actualId;
    }

    // Si no, probamos con el TODO si existe
    const todoIdNum = Number(todoGroupId);
    if (Number.isFinite(todoIdNum) && idsOpciones.includes(todoIdNum)) {
      return todoIdNum;
    }

    // Si nada encaja, dejamos el select sin selección
    return '';
  }, [opcionesSelect, agrupacionSeleccionada, todoGroupId]);

  // Set de ids activos
  const activeIds = useMemo(() => {
    // 1) Si la tabla nos pasa los visibles → usamos eso (modo sincronizado)
    if (visibleIds && visibleIds.size) return visibleIds;

    const g = agrupacionSeleccionada;
    if (!g) return null;

    // 2) Si es un grupo virtual (TODO / Sin agrupación) → no filtramos el árbol
    if (esTodoGroup(g)) return null;

    // 3) Para cualquier otra agrupación usamos solo sus artículos
    const gActual = (agrupaciones || []).find(
      x => Number(x?.id) === Number(g?.id)
    );
    const arr = Array.isArray(gActual?.articulos) ? gActual.articulos : [];

    // ⚠️ Clave: si no hay artículos → set vacío → sidebar queda vacío
    if (!arr.length) return new Set();

    return new Set(
      arr
        .map(a => Number(a?.id))
        .filter(Number.isFinite)
    );
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
  }, [agrupaciones, agrupacionSeleccionada, setAgrupacionSeleccionada]);

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
    } catch { }
    const merged = [
      ...saved.filter(k => actualKeys.includes(k)),
      ...actualKeys.filter(k => !saved.includes(k)),
    ];
    const finalKeys = merged.filter(k => actualKeys.includes(k));
    setOrder(finalKeys);
  }, [listaBase, storageKey, listMode]);

  const saveOrder = useCallback((keys) => {
    try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch { }
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
      (agrupaciones || []).find(g => Number(g?.id) === idSel) || null;

    setAgrupacionSeleccionada?.(seleccionada);
    setFiltroBusqueda?.('');
    setCategoriaSeleccionada?.(null);
    setBusqueda?.('');
    onManualPick?.();
  }, [agrupaciones, setAgrupacionSeleccionada, setFiltroBusqueda, setCategoriaSeleccionada, setBusqueda, onManualPick]);

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
          value={selectedAgrupValue}
          onChange={handleAgrupacionChange}
        >
          {opcionesSelect.map(g => (
            <MenuItem key={g.id} value={Number(g.id)}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  gap: 8,
                }}
              >
                <span>{labelAgrup(g)}</span>

                {/* Botonera de acciones dentro del select */}
                <span
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {onSetFavorite && (
                    <Tooltip
                      title={
                        Number(favoriteGroupId) === Number(g.id)
                          ? 'Quitar como favorita'
                          : 'Marcar como favorita'
                      }
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetFavorite(g.id);
                        }}
                      >
                        {Number(favoriteGroupId) === Number(g.id)
                          ? <StarIcon fontSize="inherit" color="warning" />
                          : <StarBorderIcon fontSize="inherit" />}
                      </IconButton>
                    </Tooltip>
                  )}

                  {onEditGroup && (
                    <Tooltip title="Renombrar agrupación">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditGroup(g);
                        }}
                      >
                        <EditIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  )}

                  {onDeleteGroup && (
                    <Tooltip
                      title={
                        Number(g.id) === Number(todoGroupId)
                          ? 'No se puede eliminar el grupo automático de sobrantes'
                          : 'Eliminar agrupación'
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          disabled={Number(g.id) === Number(todoGroupId)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (Number(g.id) === Number(todoGroupId)) return;
                            onDeleteGroup(g);
                          }}
                        >
                          <DeleteIcon fontSize="inherit" color="error" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </span>
              </div>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <div style={{ padding: '2px 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 8, textTransform: 'uppercase', opacity: 0.65 }}>
        </span>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={listMode}
          onChange={(_, val) => {
            if (!val) return;
            onChangeListMode?.(val);
          }}
        >
          <ToggleButton value="by-subrubro">Rubro</ToggleButton>
          <ToggleButton value="by-categoria">SubRubro</ToggleButton>
        </ToggleButtonGroup>
      </div>

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
          <li style={{ opacity: 0.7 }}>
            {agrupacionSeleccionada &&
              /discontinuad/i.test(agrupacionSeleccionada.nombre || '')
              ? 'No hay Rubros/Subrubros discontinuados.'
              : 'No hay Rubros/Subrubros en esta agrupación.'}
          </li>
        )}

      </ul>
    </div>
  );
}

export default React.memo(SidebarCategorias);
