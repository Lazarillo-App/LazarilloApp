// src/componentes/BuscadorDireccion.jsx
// Buscador de direcciones con Google Maps (tablero #55, Diego 14/11/2026: en «Editar sucursal» la
// ciudad y la calle se escribían a mano y lo que aparecía era el autocompletar de Chrome).
// Va por el back (/api/places/direcciones, Geocoding de Google: la clave nunca llega al navegador).
// Busca después de una pausa al escribir, para no pagar una búsqueda por letra.
import React, { useEffect, useRef, useState } from 'react';
import { Autocomplete, TextField, CircularProgress, Box } from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { http } from '@/servicios/apiBusinesses';

const PAUSA_MS = 600;
const MIN_LETRAS = 4;

/** onElegir({ direccion, calle, numero, ciudad, provincia, lat, lng, place_id }) */
export default function BuscadorDireccion({ onElegir, label = 'Buscar la dirección en Google Maps' }) {
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const ultima = useRef(0);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < MIN_LETRAS) { setOpciones([]); setError(''); return undefined; }
    const id = ++ultima.current;
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const r = await http(`/places/direcciones?text=${encodeURIComponent(q)}`, { cache: false, withBusinessId: false });
        if (id === ultima.current) { setOpciones(r?.resultados || []); setError(''); }
      } catch {
        if (id === ultima.current) { setOpciones([]); setError('No se pudo buscar en Google Maps. Podés escribirla a mano abajo.'); }
      } finally {
        if (id === ultima.current) setCargando(false);
      }
    }, PAUSA_MS);
    return () => clearTimeout(t);
  }, [texto]);

  return (
    <Autocomplete
      size="small"
      options={opciones}
      filterOptions={(x) => x}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.direccion || '')}
      isOptionEqualToValue={(a, b) => a.place_id === b.place_id}
      inputValue={texto}
      onInputChange={(_, v, motivo) => { if (motivo !== 'reset') setTexto(v); }}
      onChange={(_, o) => { if (o && typeof o === 'object') { onElegir?.(o); setTexto(''); setOpciones([]); } }}
      value={null}
      loading={cargando}
      noOptionsText={texto.trim().length < MIN_LETRAS ? 'Escribí calle y número, y la ciudad' : 'Sin resultados'}
      loadingText="Buscando…"
      renderOption={(props, o) => (
        <Box component="li" {...props} key={o.place_id || o.direccion} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <PlaceOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', mt: '2px' }} />
          <span>{o.direccion}</span>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Ej. Av. Corrientes 1234, CABA"
          helperText={error || undefined}
          error={!!error}
          inputProps={{ ...params.inputProps, autoComplete: 'off' }}
          InputProps={{
            ...params.InputProps,
            sx: { borderRadius: 2 },
            endAdornment: (<>{cargando && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>),
          }}
        />
      )}
    />
  );
}
