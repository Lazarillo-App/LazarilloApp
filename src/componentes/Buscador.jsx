import React from 'react';
import { Autocomplete, TextField } from '@mui/material';

const Buscador = ({ value, setFiltroBusqueda, opciones = [] }) => {
  return (
    <Autocomplete
      freeSolo
      inputValue={value}
      onInputChange={(event, newInputValue) => setFiltroBusqueda(newInputValue)}
      options={opciones}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Buscar artículos"
          variant="outlined"
          size="small"
          sx={{ width: 250 }}
        />
      )}
    />
  );
};

export default Buscador;