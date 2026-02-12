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

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // ========= helpers =========
  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const tokenize = (s) => normalize(s).split(' ').filter(Boolean);

  function scoreMatch(nombre, query) {
    const q = normalize(query);
    if (!q) return { tier: 999, pos: 999, len: 999 };

    const qTokens = tokenize(q);
    const tokens = tokenize(nombre);
    // 1) palabra exacta (cualquier posición)
    let bestExactPos = 999;
    for (const qt of qTokens) {
      const pos = tokens.findIndex(t => t === qt);
      if (pos !== -1) bestExactPos = Math.min(bestExactPos, pos);
    }
    if (bestExactPos !== 999) return { tier: 0, pos: bestExactPos, len: tokens[bestExactPos]?.length ?? 999 };

    // 2) prefijo de palabra
    let bestPrefixPos = 999;
    for (const qt of qTokens) {
      const pos = tokens.findIndex(t => t.startsWith(qt));
      if (pos !== -1) bestPrefixPos = Math.min(bestPrefixPos, pos);
    }
    if (bestPrefixPos !== 999) return { tier: 1, pos: bestPrefixPos, len: tokens[bestPrefixPos]?.length ?? 999 };

    // 3) substring en el string completo
    const hay = normalize(nombre);
    const idx = hay.indexOf(q);
    if (idx !== -1) return { tier: 2, pos: idx, len: q.length };

    return { tier: 999, pos: 999, len: 999 };
  }

  function sortOptions(options, query) {
    return [...options].sort((a, b) => {
      const sa = scoreMatch(a.nombre, query);
      const sb = scoreMatch(b.nombre, query);

      if (sa.tier !== sb.tier) return sa.tier - sb.tier;
      if (sa.pos !== sb.pos) return sa.pos - sb.pos;
      if (sa.len !== sb.len) return sa.len - sb.len;

      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
    });
  }

  const escapeRegExp = (s) =>
    String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
          const isMatch = re.test(part);
          re.lastIndex = 0;
          return isMatch ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  // ========= indexar opciones (para buscar rápido y consistente) =========
  const opts = useMemo(() => {
    const raw = Array.isArray(opciones) ? opciones : [];
    const out = [];
    const seen = new Set();

    for (const o of raw) {
      const label = String(o?.nombre ?? o?.label ?? o ?? '').trim();
      if (!label) continue;

      const idKey = String(o?.id ?? o?.value ?? label);
      const key = `${idKey}::${label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const norm = normalize(label);
      const words = norm ? norm.split(' ') : [];

      out.push({
        ...((typeof o === 'object' && o) ? o : { value: o }),
        _label: label,
        _norm: norm,
        _words: words,
      });
    }

    return out;
  }, [opciones]);

  // ========= scoring =========
  const scoreOption = useCallback((opt, qNorm, qTokens) => {
    const text = opt?._norm || '';
    if (!text) return -Infinity;

    // match ALL tokens (pero con regla para tokens de 1 char)
    for (const t of qTokens) {
      if (!t) continue;

      if (t.length === 1) {
        // para 1 letra: exigir inicio de palabra (evita "ch" o "cheddar" ganando por la h)
        const ok = opt._words?.some((w) => w.startsWith(t));
        if (!ok) return -Infinity;
      } else {
        if (!text.includes(t)) return -Infinity;
      }
    }

    let score = 0;

    // 1) match fuerte por frase completa
    if (text === qNorm) score += 1000;
    else if (text.startsWith(qNorm)) score += 700;
    else if (text.includes(qNorm)) score += 250;

    // 2) match por tokens / inicio de palabra
    for (const t of qTokens) {
      if (!t) continue;
      const startsWord = opt._words?.some((w) => w.startsWith(t));
      if (startsWord) score += 180;

      // bonus si aparece temprano
      const pos = text.indexOf(t);
      if (pos === 0) score += 120;
      else if (pos > 0 && pos < 5) score += 40;
    }

    // 3) tie-breakers: más corto suele ser más “exacto”
    score -= Math.min(40, text.length * 0.2);

    return score;
  }, []);

  // ========= filtro + ranking =========
  const filterOptions = useCallback((options, state) => {
    const qNorm = normalize(state.inputValue);
    if (!qNorm) return [];

    const qTokens = qNorm.split(' ').filter(Boolean);

    // score + sort
    const scored = [];
    for (const opt of options) {
      const s = scoreOption(opt, qNorm, qTokens);
      if (s === -Infinity) continue;
      scored.push({ opt, s });
    }

    scored.sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      // estable: label asc
      return String(a.opt._label).localeCompare(String(b.opt._label), 'es', { sensitivity: 'base', numeric: true });
    });

    // cap razonable (podés bajarlo a 80 si querés)
    return scored.slice(0, 120).map((x) => x.opt);
  }, [normalize, scoreOption]);

  // ========= handlers =========
  const handleFocus = useCallback(() => {
    if (clearOnFocus && inputValue) {
      setInputValue('');
      onChange?.('');
      setOpen(false);
      return;
    }
    setOpen(!!inputValue);
  }, [clearOnFocus, inputValue, onChange]);

  const handleInputChange = useCallback((_, newVal) => {
    const v = newVal ?? '';
    setInputValue(v);
    onChange?.(v);
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
      getOptionLabel={(o) => String(o?._label ?? o?.nombre ?? o?.label ?? o ?? '')}
      isOptionEqualToValue={(a, b) =>
        String(a?.id ?? a?.value ?? a?._label ?? a) === String(b?.id ?? b?.value ?? b?._label ?? b)
      }
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      clearOnEscape
      forcePopupIcon={false}
      renderOption={(props, option) => {
        // React warning: no spread de key
        const { key, ...rest } = props;

        const label = String(option?._label ?? option?.nombre ?? option?.label ?? option ?? '');

        // ✅ key estable y única (prioriza id/value; si no, label + índice del option)
        const uniq =
          option?.id ?? option?.value ?? option?._id ?? option?._key ?? null;

        // fallback seguro si no hay id: combinar label normalizado + data-option-index
        const fallbackKey = `${option?._norm ?? label.toLowerCase()}::${rest['data-option-index'] ?? ''}`;

        return (
          <li key={String(uniq ?? fallbackKey)} {...rest}>
            {renderHighlighted(label, inputValue)}
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
