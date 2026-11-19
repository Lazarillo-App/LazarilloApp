import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box, Paper, Popper, TextField, InputAdornment, Typography, ClickAwayListener,
} from '@mui/material';

/* ──────────────────────────────────────────────────────────────
   SelectorBuscable — Lazarillo Gestión

   Un select con buscador adentro y una fila de "Crear …" que queda
   SIEMPRE visible arriba, fuera del scroll de la lista. Con 60 rubros
   la opción de crear se pierde si scrollea con el resto.

   Se usa para Rubro, Subrubro y Unidad en los modales de edición.
   ────────────────────────────────────────────────────────────── */

export default function SelectorBuscable({
  label,
  value,                    // string | null — el nombre elegido
  opciones = [],            // string[] | {id, nombre}[]
  onChange,                 // (nombre) => void
  onCrear,                  // (nombre) => void   · si no se pasa, no hay fila de crear
  textoCrear,               // "Crear rubro nuevo…"  (por defecto se arma con label)
  nombreCrear,              // opcional: nombre ya sabido (crear sin escribir lo usa directo, sin pedirlo)
  requerido = false,
  deshabilitado = false,
  placeholder = '',
  ancho,                    // opcional, por defecto ocupa todo
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const anclaRef = useRef(null);
  const inputRef = useRef(null);

  const norm = (x) => (typeof x === 'string' ? x : x?.nombre ?? '');
  const lista = useMemo(() => opciones.map(norm).filter(Boolean), [opciones]);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter((o) => o.toLowerCase().includes(t));
  }, [lista, q]);

  // ¿lo que escribió existe tal cual? si no, crear ofrece ese texto
  const exacta = useMemo(
    () => lista.some((o) => o.toLowerCase() === q.trim().toLowerCase()),
    [lista, q]);

  // «+ Crear … nuevo» sin haber escrito nada: en vez de no hacer nada, abre ahí mismo un campo
  // para el nombre (Diego 17/11/2026: «tocás crear y no pasa nada hasta que escribís»).
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevoTxt, setNuevoTxt] = useState('');
  const nuevoRef = useRef(null);

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQ(''); setNuevoAbierto(false); setNuevoTxt(''); }
  }, [abierto]);

  const elegir = (o) => { onChange?.(o); setAbierto(false); };
  const crear = () => {
    const nombre = q.trim();
    if (!nombre && nombreCrear) { onCrear?.(nombreCrear); setAbierto(false); return; }
    if (!nombre) { setNuevoAbierto(true); setTimeout(() => nuevoRef.current?.focus(), 30); return; }
    onCrear?.(nombre);
    setAbierto(false);
  };
  const confirmarNuevo = () => {
    const nombre = nuevoTxt.trim();
    if (!nombre) return;
    const existente = lista.find((o) => o.toLowerCase() === nombre.toLowerCase());
    if (existente) onChange?.(existente); else onCrear?.(nombre);   // si ya existe, se elige el que hay
    setAbierto(false);
  };

  const rotulo = textoCrear ?? `Crear ${String(label || '').toLowerCase()} nuevo…`;

  return (
    <Box ref={anclaRef} sx={{ position: 'relative', flex: ancho ? `0 0 ${ancho}` : 1, minWidth: 0 }}>
      <TextField
        label={requerido ? `${label} *` : label}
        value={value ?? ''}
        placeholder={placeholder}
        size="small" fullWidth disabled={deshabilitado}
        onClick={() => !deshabilitado && setAbierto((a) => !a)}
        slotProps={{
          input: {
            readOnly: true,
            sx: { cursor: deshabilitado ? 'default' : 'pointer', bgcolor: 'background.paper' },
            endAdornment: (
              <InputAdornment position="end">
                <Box component="span" sx={{
                  color: 'text.disabled', fontSize: 11, lineHeight: 1,
                  transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
                }}>▼</Box>
              </InputAdornment>
            ),
          },
        }}
        sx={{ '& input': { cursor: deshabilitado ? 'default' : 'pointer' } }}
      />

      <Popper open={abierto} anchorEl={anclaRef.current} placement="bottom-start"
        style={{ zIndex: 1400, width: anclaRef.current?.offsetWidth }}>
        <ClickAwayListener onClickAway={() => setAbierto(false)}>
          <Paper elevation={8} sx={{ mt: 0.5, borderRadius: 1.5, overflow: 'hidden' }}>

            {/* buscador — fijo arriba */}
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                inputRef={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                size="small" fullWidth placeholder={`Buscar ${String(label || '').toLowerCase()}…`}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setAbierto(false);
                  if (e.key === 'Enter') {
                    if (filtradas.length === 1) elegir(filtradas[0]);
                    else if (onCrear && q.trim() && !exacta) crear();
                  }
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box component="span" sx={{ fontSize: 13, color: 'text.disabled' }}>🔍</Box>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {/* crear — también fijo, no scrollea con la lista */}
            {onCrear && nuevoAbierto && (
              <Box sx={{ p: 1, display: 'flex', gap: 1, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                <TextField inputRef={nuevoRef} value={nuevoTxt} onChange={(e) => setNuevoTxt(e.target.value)}
                  size="small" fullWidth placeholder={`Nombre del ${String(label || '').toLowerCase()} nuevo`}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarNuevo(); if (e.key === 'Escape') setNuevoAbierto(false); }}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }} />
                <Box component="button" type="button" onClick={confirmarNuevo} disabled={!nuevoTxt.trim()}
                  sx={{ border: 0, borderRadius: 1, px: 1.6, height: 40, flexShrink: 0, cursor: nuevoTxt.trim() ? 'pointer' : 'default',
                    bgcolor: nuevoTxt.trim() ? 'primary.main' : 'action.disabledBackground', color: nuevoTxt.trim() ? 'primary.contrastText' : 'text.disabled',
                    fontWeight: 700, fontSize: '0.8rem' }}>Crear</Box>
              </Box>
            )}
            {onCrear && !nuevoAbierto && (
              <Box onClick={crear}
                sx={{
                  px: 1.6, py: 1.1, cursor: 'pointer', borderBottom: '1px solid',
                  borderColor: 'divider', bgcolor: 'action.hover',
                  '&:hover': { bgcolor: 'action.selected' },
                }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'primary.main' }}>
                  + {q.trim() && !exacta ? `Crear «${q.trim()}»` : rotulo}
                </Typography>
              </Box>
            )}

            {/* la lista es lo único que scrollea */}
            <Box sx={{ maxHeight: 232, overflowY: 'auto' }}>
              {filtradas.length === 0 ? (
                <Typography sx={{ px: 1.6, py: 1.4, fontSize: '0.8rem', color: 'text.secondary' }}>
                  Sin resultados
                </Typography>
              ) : filtradas.map((o) => (
                <Box key={o} onClick={() => elegir(o)}
                  sx={{
                    px: 1.6, py: 0.9, cursor: 'pointer', fontSize: '0.84rem',
                    bgcolor: o === value ? 'action.selected' : 'transparent',
                    fontWeight: o === value ? 700 : 400,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}>
                  {o}
                </Box>
              ))}
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
}
