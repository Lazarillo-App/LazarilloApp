// src/componentes/CampoImporte.jsx
// Campo de IMPORTE de la app (Diego 19/11/2026: "no quiero contar ceros"). Regla única para
// todo importe que se tipea: se ve en formato moneda MIENTRAS se escribe —"$" adentro del
// campo, punto de miles, coma decimal, hasta 2 decimales, alineado a la derecha— y el cursor
// no salta al final al reformatear.
//  - value: número (o '' / null = vacío). onChange(numero | '') devuelve el número limpio:
//    quien lo usa guarda números, nunca el texto con puntos.
//  - Un "." recién tipeado (teclado numérico) o pegado se toma como coma decimal; los puntos
//    que ya estaban son de miles (misma regla que la carga de factura, Diego 06/11/2026).
//  - Acepta todas las props de TextField (label, size, sx, disabled, autoFocus…).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TextField, InputAdornment } from '@mui/material';

export function textoImporte(v, ev) {
  let s = String(v ?? '');
  const puntoNuevo = !ev || !ev.inputType || ev.inputType === 'insertFromPaste' || ev.inputType === 'insertFromDrop' || ev.data === '.';
  if (!s.includes(',') && puntoNuevo) {
    const ult = s.lastIndexOf('.');
    if (ult >= 0) {
      const dec = s.slice(ult + 1).replace(/[^\d]/g, '');
      if (dec.length < 3) s = s.slice(0, ult).replace(/\./g, '') + ',' + dec;
    }
  }
  const limpio = s.replace(/[^\d,]/g, '');
  if (!limpio) return '';
  const partes = limpio.split(',');
  const ent = (partes[0] || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return partes.length > 1 ? ent + ',' + partes.slice(1).join('').slice(0, 2) : ent;
}
export const numeroDeImporte = (t) => {
  const s = String(t ?? '').replace(/\./g, '').replace(',', '.');
  if (s === '' || s === '.') return '';
  const n = Number(s);
  return Number.isFinite(n) ? n : '';
};
export const importeATexto = (n) => (n === '' || n == null || !Number.isFinite(Number(n)) ? ''
  : Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));

const significativo = (c) => /[\d,]/.test(c);
const contar = (t, cur) => { let n = 0; for (let i = 0; i < Math.min(cur, t.length); i++) if (significativo(t[i])) n++; return n; };
const posTras = (t, n) => { if (n <= 0) return 0; let c = 0; for (let i = 0; i < t.length; i++) if (significativo(t[i]) && ++c === n) return i + 1; return t.length; };

export default function CampoImporte({ value, onChange, InputProps, inputProps, ...props }) {
  const ref = useRef(null);
  const cursor = useRef(null);
  const [texto, setTexto] = useState(() => importeATexto(value));
  // Si el valor cambia desde afuera (padrino, editar otro ítem), se muestra formateado;
  // mientras se tipea manda lo escrito (no se pisa "10.000," a mitad de la coma).
  useEffect(() => {
    if (numeroDeImporte(texto) !== (value === null ? '' : value === '' ? '' : Number(value))) setTexto(importeATexto(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && cursor.current !== null && document.activeElement === el) { const p = posTras(texto, cursor.current); el.setSelectionRange(p, p); }
    cursor.current = null;
  }, [texto]);
  return (
    <TextField
      {...props}
      inputRef={ref}
      value={texto}
      onChange={(e) => {
        const t = e.target;
        const nuevo = textoImporte(t.value, e.nativeEvent);
        const sel = t.selectionStart ?? t.value.length;
        // Un "." recién tipeado se vuelve coma: cuenta como carácter que importa.
        cursor.current = contar(t.value, sel) + (e.nativeEvent?.data === '.' && nuevo.includes(',') ? 1 : 0);
        setTexto(nuevo);
        onChange?.(numeroDeImporte(nuevo));
      }}
      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment>, ...InputProps }}
      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' }, ...inputProps }}
    />
  );
}
