// src/componentes/Buscador.jsx
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

export default function Buscador({
  value = '',
  opciones = [],
  placeholder = 'Buscar…',
  onPick,                 
  onChange,               
  clearOnFocus = false,   
  clearOnPick = true,     
  autoFocusAfterPick = false, 
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  // sync con valor controlado del padre
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const handleFocus = useCallback(() => {
    if (clearOnFocus && inputValue) {
      setInputValue('');
      onChange?.('');
    }
    setOpen(true);
  }, [clearOnFocus, inputValue, onChange]);

  const handleInputChange = useCallback((_, newVal, reason) => {
    // reason: 'input' | 'reset' | 'clear'
    setInputValue(newVal);
    onChange?.(newVal);
    if (!open) setOpen(true);
  }, [onChange, open]);

  const handleChange = useCallback((_, opt, reason) => {
    // reason: 'selectOption' | 'clear' | ...
    if (reason === 'selectOption' && opt) {
      onPick?.(opt);
      if (clearOnPick) {
        setInputValue('');
        onChange?.('');
      }
      // Mantener abierto y con foco para nueva búsqueda
      if (autoFocusAfterPick) {
        setOpen(true);
        // re-enfocar en el próximo tick para evitar cerrar por blur del Autocomplete
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            // mostrar menú abierto aun con string vacío
            setOpen(true);
          }
        }, 0);
      } else {
        setOpen(false);
      }
    }
  }, [onPick, onChange, clearOnPick, autoFocusAfterPick]);

  const opts = useMemo(() => opciones || [], [opciones]);

  return (
    <Autocomplete
      freeSolo
      open={open}
      onOpen={() => setOpen(true)}
      onClose={(_, reason) => {
        // evitá cerrar por select para poder seguir buscando
        if (reason === 'selectOption' && autoFocusAfterPick) return;
        setOpen(false);
      }}
      options={opts}
      getOptionLabel={(o) => String(o?.label ?? o ?? '')}
      isOptionEqualToValue={(a, b) => String(a?.id ?? a?.value ?? a) === String(b?.id ?? b?.value ?? b)}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      clearOnEscape
      forcePopupIcon={false}
      filterSelectedOptions
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          placeholder={placeholder}
          size="small"
          onFocus={handleFocus}
        />
      )}
    />
  );
}
