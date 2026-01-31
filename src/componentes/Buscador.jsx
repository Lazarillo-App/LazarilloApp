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

  // ============ helpers ============

  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // saca acentos
      .replace(/[^a-z0-9\s]/gi, ' ')   // símbolos → espacios
      .replace(/\s+/g, ' ')
      .trim();

  const escapeRegExp = (s) =>
    String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 👇 Render con negrita
  const renderHighlighted = (text, query) => {
    const t = String(text || '');
    const q = String(query || '').trim();
    if (!q) return t;

    const tokens = q.split(/\s+/).filter(Boolean).map(escapeRegExp);
    if (!tokens.length) return t;

    const re = new RegExp(`(${tokens.join('|')})`, 'ig');
    const parts = t.split(re);

    return (
      <span>
        {parts.map((part, i) => {
          // como usamos regex global, reseteamos el estado del test
          const isMatch = re.test(part);
          re.lastIndex = 0;
          return isMatch ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  // ✅ Filtrado holgado (desde la primera letra)
  const filterOptions = useCallback((options, state) => {
    const q = normalize(state.inputValue);
    if (!q) return [];

    const tokens = q.split(' ');
    const out = [];

    for (const opt of options) {
      const text = opt._search;
      let ok = true;

      for (const t of tokens) {
        if (!text.includes(t)) {
          ok = false;
          break;
        }
      }

      if (ok) out.push(opt);
      if (out.length >= 200) break;
    }

    return out;
  }, []);

  // ============ handlers ============

  const handleFocus = useCallback(() => {
    if (clearOnFocus && inputValue) {
      setInputValue('');
      onChange?.('');
      setOpen(false);
      return;
    }
    setOpen(!!inputValue); // abre si hay texto
  }, [clearOnFocus, inputValue, onChange]);

  const handleInputChange = useCallback((_, newVal) => {
    const v = newVal ?? '';
    setInputValue(v);
    onChange?.(v);

    // ✅ si borra todo, se cierra y "reinicia"
    setOpen(!!v);
  }, [onChange]);

  const handleChange = useCallback((_, opt, reason) => {
    if (reason === 'selectOption' && opt) {
      onPick?.(opt);

      if (clearOnPick) {
        setInputValue('');
        onChange?.('');
        setOpen(false);
      } else {
        setOpen(true);
      }

      if (autoFocusAfterPick) {
        setOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
          setOpen(true);
        }, 0);
      }
    }
  }, [onPick, onChange, clearOnPick, autoFocusAfterPick]);

  const opts = useMemo(() => opciones || [], [opciones]);

  return (
    <Autocomplete
      freeSolo
      open={open}
      onOpen={() => setOpen(!!inputValue)}
      onClose={(_, reason) => {
        if (reason === 'selectOption' && autoFocusAfterPick) return;
        setOpen(false);
      }}
      options={opts}
      filterOptions={filterOptions}
      getOptionLabel={(o) => String(o?.nombre ?? o?.label ?? o ?? '')}
      isOptionEqualToValue={(a, b) =>
        String(a?.id ?? a?.value ?? a) === String(b?.id ?? b?.value ?? b)
      }
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      clearOnEscape
      forcePopupIcon={false}

      renderOption={(props, option) => {
        const { key, ...rest } = props;

        return (
          <li key={key} {...rest}>
            {renderHighlighted(
              String(option?.nombre ?? option?.label ?? option ?? ''),
              inputValue
            )}
          </li>
        );
      }}

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
