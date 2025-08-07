import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import '../css/SidebarCategorias.css';

const SidebarCategorias = ({
  categorias,
  setCategoriaSeleccionada,
  agrupaciones = [],
  agrupacionSeleccionada,
  setAgrupacionSeleccionada,
  setFiltroBusqueda,
}) => {

  const categoriasFiltradas = agrupacionSeleccionada
    ? categorias.filter(categoria =>
        categoria.subrubros.some(subrubro =>
          subrubro.articulos.some(articulo =>
            agrupacionSeleccionada.articulos.some(a => a.id === articulo.id)
          )
        )
      )
    : categorias;

  const handleAgrupacionChange = (event) => {
    const nombreSeleccionado = event.target.value;

    if (nombreSeleccionado === '') {
      setAgrupacionSeleccionada(null);
      setFiltroBusqueda && setFiltroBusqueda('');
    } else {
      const seleccionada = agrupaciones.find(a => a.nombre === nombreSeleccionado) || null;
      setAgrupacionSeleccionada(seleccionada);
      setFiltroBusqueda && setFiltroBusqueda('');
    }

    setCategoriaSeleccionada(null); 
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
          <li
            key={categoria.id}
            onClick={() => setCategoriaSeleccionada(categoria)}
          >
            <p className="icono" /> {categoria.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SidebarCategorias;