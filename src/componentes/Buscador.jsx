import React from 'react';
import { TextField } from '@mui/material';

const Buscador = ({ value, setFiltroBusqueda }) => {
  const handleInputChange = (e) => {
    const valorBusqueda = e.target.value;
    setFiltroBusqueda(valorBusqueda);
  };

  return (
    <TextField
      value={value}
      onChange={handleInputChange}
      label="Buscar artículos"
      variant="outlined"
      size="small"
      sx={{ width: 250 }}
    />
  );
};

export default Buscador;