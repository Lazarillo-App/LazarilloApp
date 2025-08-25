import React, { useMemo } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import '../css/SidebarCategorias.css';

const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);

// Etiqueta amigable: TODO -> "Sin Agrupación"
const labelAgrup = (g) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return n === 'TODO' ? 'Sin Agrupación' : (g?.nombre || '');
};

const SidebarCategorias = ({
  categorias = [],
  setCategoriaSeleccionada,
  agrupaciones = [],
  agrupacionSeleccionada,
  setAgrupacionSeleccionada,
  setFiltroBusqueda,
  setBusqueda,
  idsVisibles,
  categoriaSeleccionada,
  activeIds,
}) => {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];
  const agrupacionesArray = Array.isArray(agrupaciones) ? agrupaciones : [];

  const filterByAgrupacion = (cats) => {
    if (!agrupacionSeleccionada) return cats;
    const idsAgr = new Set((agrupacionSeleccionada.articulos || []).map(a => getId(a)));

    const recortadas = cats.map(cat => {
      const sub = (cat.subrubros || []).map(sr => {
        const arts = (sr.articulos || []).filter(a => idsAgr.has(getId(a)));
        return { ...sr, articulos: arts };
      }).filter(sr => (sr.articulos || []).length > 0);
      return { ...cat, subrubros: sub };
    }).filter(cat => (cat.subrubros || []).length > 0);

    return recortadas.length ? recortadas : cats;
  };

  const filterByIdsVisibles = (cats) => {
    if (!idsVisibles || !idsVisibles.size) return cats;
    const recortadas = cats.map(cat => {
      const sub = (cat.subrubros || []).map(sr => {
        const arts = (sr.articulos || []).filter(a => idsVisibles.has(getId(a)));
        return { ...sr, articulos: arts };
      }).filter(sr => (sr.articulos || []).length > 0);
      return { ...cat, subrubros: sub };
    }).filter(cat => (cat.subrubros || []).length > 0);
    return recortadas.length ? recortadas : cats;
  };

 const categoriasParaMostrar = useMemo(() => {
    if (!activeIds || activeIds.size === 0) return categoriasSafe;

    const rec = categoriasSafe.map(cat => {
      const sub = (cat.subrubros || []).map(sr => ({
        ...sr,
        articulos: (sr.articulos || []).filter(a =>
          activeIds.has(Number(a?.id ?? a?.articuloId ?? a?.codigo ?? a?.codigoArticulo))
        ),
      })).filter(sr => (sr.articulos || []).length > 0);

      return { ...cat, subrubros: sub };
    }).filter(cat => (cat.subrubros || []).length > 0);

    return rec.length ? rec : categoriasSafe;
  }, [categoriasSafe, activeIds, idsVisibles, agrupacionSeleccionada]);

  const handleAgrupacionChange = (event) => {
    const value = event.target.value; // '' o id
    if (value === '') {
      setAgrupacionSeleccionada?.(null);
      setFiltroBusqueda?.('');
    } else {
      const idSel = Number(value);
      const seleccionada = agrupacionesArray.find(a => Number(a?.id) === idSel) || null;
      setAgrupacionSeleccionada?.(seleccionada);
      setFiltroBusqueda?.('');
    }
    setCategoriaSeleccionada?.(null);
    setBusqueda?.('');
  };

  const handleCategoriaClick = (categoria) => {
    if (categoriaSeleccionada?.id === categoria?.id) {
      setCategoriaSeleccionada?.(null);
    } else {
      setCategoriaSeleccionada?.(categoria);
    }
    setFiltroBusqueda?.('');
    setBusqueda?.('');
  };

  return (
    <div className="sidebar">
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Agrupaciones</InputLabel>
        <Select
          label="Agrupaciones"
          value={agrupacionSeleccionada ? Number(agrupacionSeleccionada.id) : ''} // usa id
          onChange={handleAgrupacionChange}
        >
          <MenuItem value="">Ver todas</MenuItem>
          {agrupacionesArray.map((g) => (
            <MenuItem key={g.id} value={Number(g.id)}>
              {labelAgrup(g)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <h2>Categorías</h2>
      <ul>
        {categoriasParaMostrar.map((categoria) => {
          const active = categoriaSeleccionada?.id === categoria?.id;
          return (
            <li
              key={categoria?.id ?? categoria?.nombre}
              onClick={() => handleCategoriaClick(categoria)}
              className={active ? 'categoria-activa' : undefined}
            >
              <p className="icono" /> {categoria?.nombre}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SidebarCategorias;