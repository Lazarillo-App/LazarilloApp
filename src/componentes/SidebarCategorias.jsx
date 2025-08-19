import React, { useMemo } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import '../css/SidebarCategorias.css';

// Normaliza IDs (id / articuloId / codigo / codigoArticulo; number|string)
const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);

const SidebarCategorias = ({
  categorias = [],
  setCategoriaSeleccionada,
  agrupaciones = [],
  agrupacionSeleccionada,
  setAgrupacionSeleccionada,
  setFiltroBusqueda,
  setBusqueda,
  idsVisibles, // <- NUEVO: Set<number> con IDs de artículos actualmente visibles en la tabla
}) => {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];

  const agrupacionesArray = Array.isArray(agrupaciones) ? agrupaciones : [];

  // Calcula qué categorías mostrar:
  // 1) Si llega idsVisibles, se usa para recortar categorías/subrubros a lo realmente visible
  // 2) Si no hay idsVisibles pero hay agrupación seleccionada, filtra por esa agrupación (modo anterior)
  // 3) Si no hay nada de lo anterior, muestra todas las categorías
  const categoriasParaMostrar = useMemo(() => {
    // 1) Filtrado por idsVisibles (vista TODO o cualquiera que pase el set)
    if (idsVisibles && idsVisibles.size) {
      const recortadas = (categoriasSafe || []).map(cat => {
        const sub = (cat.subrubros || []).map(sr => {
          const arts = (sr.articulos || []).filter(a => idsVisibles.has(getId(a)));
          return { ...sr, articulos: arts };
        }).filter(sr => (sr.articulos || []).length > 0);
        return { ...cat, subrubros: sub };
      }).filter(cat => (cat.subrubros || []).length > 0);

      // Si no quedó nada, devolvemos la estructura base para evitar sidebar vacío extremo
      return recortadas.length ? recortadas : categoriasSafe;
    }

    // 2) Filtrado por agrupación seleccionada (modo previo)
    if (agrupacionSeleccionada) {
      const idsAgr = new Set(
        (agrupacionSeleccionada.articulos || []).map(a => getId(a))
      );
      const recortadas = (categoriasSafe || []).map(cat => {
        const sub = (cat.subrubros || []).map(sr => {
          const arts = (sr.articulos || []).filter(a => idsAgr.has(getId(a)));
          return { ...sr, articulos: arts };
        }).filter(sr => (sr.articulos || []).length > 0);
        return { ...cat, subrubros: sub };
      }).filter(cat => (cat.subrubros || []).length > 0);
      return recortadas.length ? recortadas : categoriasSafe;
    }
    // 3) Sin filtros: todas
    return categoriasSafe;
  }, [categoriasSafe, idsVisibles, agrupacionSeleccionada]);

  const handleAgrupacionChange = (event) => {
    const nombreSeleccionado = event.target.value;

    if (nombreSeleccionado === '') {
      setAgrupacionSeleccionada?.(null);
      setFiltroBusqueda?.('');
    } else {
      const seleccionada =
        agrupacionesArray.find(a => a?.nombre === nombreSeleccionado) || null;
      setAgrupacionSeleccionada?.(seleccionada);
      setFiltroBusqueda?.('');
    }

    // Al cambiar de agrupación, limpiamos categoría y búsqueda
    setCategoriaSeleccionada?.(null);
    setBusqueda?.('');
  };

  const handleCategoriaClick = (categoria) => {
    setCategoriaSeleccionada?.(categoria);
    setFiltroBusqueda?.('');
    setBusqueda?.('');
  };

  return (
    <div className="sidebar">
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Agrupaciones</InputLabel>
        <Select
          value={agrupacionSeleccionada ? (agrupacionSeleccionada.nombre ?? '') : ''}
          onChange={handleAgrupacionChange}
          label="Agrupaciones"
        >
          <MenuItem value="">Ver todas</MenuItem>
          {agrupacionesArray.map((agrupacion, idx) => (
            <MenuItem key={idx} value={agrupacion?.nombre ?? ''}>
              {agrupacion?.nombre ?? '(sin nombre)'}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <h2>Categorías</h2>
      <ul>
        {categoriasParaMostrar.map((categoria) => (
          <li key={categoria?.id ?? categoria?.nombre}
              onClick={() => handleCategoriaClick(categoria)}>
            <p className="icono" /> {categoria?.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SidebarCategorias;
