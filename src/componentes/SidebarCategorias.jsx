// src/componentes/SidebarCategorias.jsx
import React, { useEffect, useMemo } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import '../css/SidebarCategorias.css';

const labelAgrup = (g) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return n === 'TODO' ? 'Sin Agrupación' : (g?.nombre || '');
};

export default function SidebarCategorias({
  // Estructura: [{ subrubro, categorias: [{ categoria, articulos: [] }] }]
  categorias = [],
  setCategoriaSeleccionada,
  agrupaciones = [],
  agrupacionSeleccionada,
  setAgrupacionSeleccionada,
  setFiltroBusqueda,
  setBusqueda,
  categoriaSeleccionada,

  /* ✅ NUEVO (opcional): mapa { [agrupacionId:number]: countSinAgrup } para mostrar
     el conteo real de "Sin Agrupación" aunque g.articulos esté vacío (TODO). */
  todoCountOverride = {}, // ej: { [todoGroupId]: 123 }
}) {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];
  const agrupacionesArray = Array.isArray(agrupaciones) ? agrupaciones : [];
  const loading = categoriasSafe.length === 0;

  // ids activos de la agrupación seleccionada (si hay)
  const activeIds = useMemo(() => {
    const g = agrupacionSeleccionada;
    if (!g || !Array.isArray(g.articulos)) return null;
    const s = new Set();
    g.articulos.forEach(a => s.add(Number(a.id)));
    return s;
  }, [agrupacionSeleccionada]);

  // Aplica filtro por agrupación: si hay selección, mostramos solo subrubros/categorías con artículos del set
  const categoriasParaMostrar = useMemo(() => {
    if (!activeIds) return categoriasSafe;

    // Para cada subrubro, quedarnos solo con las categorías/arts que intersectan con activeIds
    const pruned = categoriasSafe.map(sub => {
      const keepCategorias = (sub.categorias || []).map(c => {
        const arts = (c.articulos || []).filter(a => activeIds.has(Number(a.id)));
        return { ...c, articulos: arts };
      }).filter(c => (c.articulos?.length || 0) > 0);

      return {
        ...sub,
        categorias: keepCategorias,
      };
    }).filter(sub => (sub.categorias?.reduce((acc, c) => acc + (c.articulos?.length || 0), 0) > 0));

    return pruned;
  }, [categoriasSafe, activeIds]);

  // ✅ Si la categoría seleccionada quedó sin artículos visibles luego de un refetch, la des-seleccionamos
  useEffect(() => {
    if (!categoriaSeleccionada) return;
    const stillVisible = categoriasParaMostrar.some(
      sub => sub?.subrubro === categoriaSeleccionada?.subrubro
          && (sub?.categorias || []).some(c => (c?.articulos?.length || 0) > 0)
    );
    if (!stillVisible) {
      setCategoriaSeleccionada?.(null);
    }
  }, [categoriasParaMostrar, categoriaSeleccionada, setCategoriaSeleccionada]);

  const handleAgrupacionChange = (event) => {
    const value = event.target.value; // '' | id
    if (value === '') {
      setAgrupacionSeleccionada?.(null);
      setFiltroBusqueda?.('');
    } else {
      const idSel = Number(value);
      const seleccionada = agrupacionesArray.find((a) => Number(a?.id) === idSel) || null;
      setAgrupacionSeleccionada?.(seleccionada);
      setFiltroBusqueda?.('');
    }
    setCategoriaSeleccionada?.(null);
    setBusqueda?.('');
  };

  const handleCategoriaClick = (subItem) => {
    if (categoriaSeleccionada?.subrubro === subItem?.subrubro) {
      setCategoriaSeleccionada?.(null);
    } else {
      setCategoriaSeleccionada?.(subItem);
    }
    setFiltroBusqueda?.('');
    setBusqueda?.('');
  };

  const countArticulosSub = (sub) =>
    (sub?.categorias || []).reduce((acc, c) => acc + (c?.articulos?.length || 0), 0);

  // ✅ Usa override si corresponde (ej. para “Sin Agrupación”)
  const countArticulosAgrup = (g) => {
    const id = Number(g?.id);
    const override = todoCountOverride && typeof todoCountOverride[id] === 'number'
      ? Number(todoCountOverride[id])
      : null;
    if (override != null && !Number.isNaN(override)) return override;
    return Array.isArray(g?.articulos) ? g.articulos.length : 0;
  };

  return (
    <div className="sidebar">
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Agrupaciones</InputLabel>
        <Select
          label="Agrupaciones"
          sx={{ fontWeight: '600' }}
          value={agrupacionSeleccionada ? Number(agrupacionSeleccionada.id) : ''}
          onChange={handleAgrupacionChange}
        >
          <MenuItem value="">Ver todas</MenuItem>
          {agrupacionesArray.map((g) => (
            <MenuItem key={g.id} value={Number(g.id)}>
              {labelAgrup(g)} {countArticulosAgrup(g) ? `(${countArticulosAgrup(g)})` : ''}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <h3>Subrubros</h3>
      <ul>
        {loading && <li style={{ opacity: 0.7 }}>Cargando subrubros…</li>}
        {!loading &&
          categoriasParaMostrar.map((sub) => {
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
