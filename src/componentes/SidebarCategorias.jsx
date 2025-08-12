import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import '../css/SidebarCategorias.css';

// Helper: normaliza IDs sin importar si vienen como id/articuloId/codigo y si son string/number
const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);

const SidebarCategorias = ({
  categorias,
  setCategoriaSeleccionada,
  agrupaciones = [],
  agrupacionSeleccionada,
  setAgrupacionSeleccionada,
  setFiltroBusqueda,
  setBusqueda, // limpia el input del buscador
}) => {

  const categoriasFiltradas = agrupacionSeleccionada
    ? categorias.filter(categoria =>
        categoria.subrubros.some(subrubro =>
          subrubro.articulos.some(articulo =>
            (agrupacionSeleccionada?.articulos || []).some(a => getId(a) === getId(articulo))
          )
        )
      )
    : categorias;

  const handleAgrupacionChange = (event) => {
    const nombreSeleccionado = event.target.value;

    if (nombreSeleccionado === '') {
      setAgrupacionSeleccionada(null);
      setFiltroBusqueda('');
    } else {
      const seleccionada = agrupaciones.find(a => a.nombre === nombreSeleccionado) || null;
      setAgrupacionSeleccionada(seleccionada);
      setFiltroBusqueda('');
    }

    setCategoriaSeleccionada(null);
    setBusqueda('');
  };

  const handleCategoriaClick = (categoria) => {
    setCategoriaSeleccionada(categoria);
    setFiltroBusqueda('');
    setBusqueda('');
  };

  return (
    <div className="sidebar">
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Agrupaciones</InputLabel>
        <Select
          value={agrupacionSeleccionada ? agrupacionSeleccionada.nombre : ''}
          onChange={handleAgrupacionChange}
          label="Agrupaciones"
        >
          <MenuItem value="">Ver todas</MenuItem>
          {agrupaciones.map((agrupacion, idx) => (
            <MenuItem key={idx} value={agrupacion.nombre}>
              {agrupacion.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <h2>Categorías</h2>
      <ul>
        {categoriasFiltradas.map((categoria) => (
          <li key={categoria.id} onClick={() => handleCategoriaClick(categoria)}>
            <p className="icono" /> {categoria.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SidebarCategorias;
