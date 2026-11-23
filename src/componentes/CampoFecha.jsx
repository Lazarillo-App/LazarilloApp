// src/componentes/CampoFecha.jsx
// Campo de FECHA de la app (Diego 23/11/2026). Toda fecha que se carga de ahora en más usa este
// componente, igual que los importes usan CampoImporte:
//  - Se tipea dd/mm/aaaa y la barra aparece sola al completar el día y el mes («25» → «25/»,
//    «2510» → «25/10/»). Al borrar no se vuelve a poner; una barra tipeada de más no se duplica.
//  - Solo día y mes («25/10» o «2510») = año actual.
//  - Año de 2 dígitos sin fallas: «25» → 2025. Pivote: hasta el año actual + 20 es 20xx, más es
//    19xx («85» → 1985, para fechas de nacimiento).
//  - El día se ajusta al último del mes (31/02 → 28/02 o 29/02).
//  - Se confirma al salir del campo o con Enter; si no se entiende, vuelve al valor anterior.
//  - El ícono de calendario abre el calendario del navegador: tipear no le quita el calendario.
//  - value: 'AAAA-MM-DD' (o '' / null = vacío). onChange('AAAA-MM-DD' | '') devuelve siempre ISO:
//    quien lo usa guarda la fecha limpia, nunca el texto.
//  - Acepta las props de TextField (label, size, sx, disabled, autoFocus, fullWidth, error…).
import React, { useEffect, useRef, useState } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';

const pad2 = (n) => String(n).padStart(2, '0');
export const isoATexto = (iso) => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

// Año de 1 o 2 dígitos → 4 dígitos (pivote: año actual + 20).
export function anioCompleto(y, hoy = new Date()) {
  if (y >= 100) return y;
  const corte = (hoy.getFullYear() % 100) + 20;
  return y <= corte ? 2000 + y : 1900 + y;
}

/** Texto tipeado → 'AAAA-MM-DD', o null si no se entiende. */
export function textoAFecha(texto, hoy = new Date()) {
  let s = String(texto ?? '').trim();
  if (!s) return '';
  if (/^\d{8}$/.test(s) || /^\d{6}$/.test(s)) s = `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}`;
  else if (/^\d{4}$/.test(s)) s = `${s.slice(0, 2)}/${s.slice(2)}`;
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{1,4})?)?$/);
  if (!m) return null;
  if (m[3] && m[3].length === 3) return null;
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const y = m[3] ? anioCompleto(Number(m[3]), hoy) : hoy.getFullYear();
  const ult = new Date(y, mo, 0).getDate();
  const d = Math.min(Math.max(Number(m[1]), 1), ult);
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

/** Mientras se escribe: barra automática al completar día y mes. */
export function textoMientrasEscribe(nuevo, anterior) {
  let v = String(nuevo ?? '').replace(/[^\d/\-.]/g, '').replace(/[/\-.]{2,}/g, '/');
  if (/^\d+$/.test(v)) {
    const d = v.slice(0, 8);
    v = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }
  if (v.length > String(anterior ?? '').length && /^(\d{2}|\d{2}\/\d{2})$/.test(v)) v += '/';
  return v.slice(0, 10);
}

export default function CampoFecha({ value, onChange, onBlur, onKeyDown, inputRef, placeholder = 'dd/mm/aaaa', disabled, InputProps, inputProps, ...props }) {
  const [txt, setTxt] = useState(isoATexto(value));
  const nativo = useRef(null);
  useEffect(() => { setTxt(isoATexto(value)); }, [value]);

  const confirmar = () => {
    const iso = textoAFecha(txt);
    if (iso === null) { setTxt(isoATexto(value)); return; }
    setTxt(isoATexto(iso));
    if (iso !== (value ?? '')) onChange?.(iso);
  };
  const abrirCalendario = () => {
    const el = nativo.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };

  return (
    <TextField
      size="small"
      {...props}
      disabled={disabled}
      value={txt}
      placeholder={placeholder}
      inputRef={inputRef}
      onChange={(e) => setTxt(textoMientrasEscribe(e.target.value, txt))}
      onBlur={(e) => { confirmar(); onBlur?.(e); }}
      onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); onKeyDown?.(e); }}
      inputProps={{ inputMode: 'numeric', autoComplete: 'off', ...inputProps }}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <InputAdornment position="end" sx={{ position: 'relative' }}>
            <IconButton size="small" edge="end" tabIndex={-1} disabled={disabled} aria-label="Elegir en el calendario" onClick={abrirCalendario}>
              <CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
            {/* Calendario del navegador: invisible, solo para abrirlo desde el ícono. */}
            <input ref={nativo} type="date" tabIndex={-1} aria-hidden value={/^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value : ''}
              onChange={(e) => { if (e.target.value) { setTxt(isoATexto(e.target.value)); onChange?.(e.target.value); } }}
              style={{ position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, border: 0, padding: 0, pointerEvents: 'none' }} />
          </InputAdornment>
        ),
      }}
    />
  );
}
