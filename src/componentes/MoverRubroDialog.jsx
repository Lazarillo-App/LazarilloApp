// src/componentes/MoverRubroDialog.jsx
// «Mover a otro rubro» de un artículo (Diego 12/11/2026): buscador pegado a la lista,
// «+ Crear rubro …» fijo arriba (patrón SelectorBuscable), primero los rubros de la
// agrupación donde está el artículo y el rubro actual marcado. Un toque en el rubro mueve.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, TextField, InputAdornment,
  IconButton, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Marcas de acento (U+0300–U+036F), armadas sin escapes de barra-u para que el conector de GitHub no las convierta.
const SIN_TILDES = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const norm = (s) => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(SIN_TILDES, '');

export default function MoverRubroDialog({
  open, onClose,
  articuloNombre = '',
  rubroActual = '',
  origen = null,            // { id, nombre } — agrupación donde está guardado el artículo
  rubros = [],              // [{ subrubro, agrupacionId, agrupacionNombre }]
  conteos = new Map(),      // `${agrupacionId}|${subrubro}` → cantidad de artículos
  movingKey = null,         // clave del rubro que se está moviendo (spinner)
  onMover,                  // (toId, subrubro) => void
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  const ocupado = movingKey != null;
  const origenId = origen ? Number(origen.id) : null;

  // Grupos: primero la agrupación del artículo, después el resto por nombre.
  const grupos = useMemo(() => {
    const t = norm(q);
    const m = new Map();
    for (const r of rubros) {
      // Promociones es un resumen y Top 20 / Discontinuados no son destinos de rubro.
      if (['promociones', 'top 20', 'discontinuados', 'descontinuados'].includes(norm(r.agrupacionNombre))) continue;
      if (t && !norm(r.subrubro).includes(t) && !norm(r.agrupacionNombre).includes(t)) continue;
      const id = Number(r.agrupacionId);
      if (!m.has(id)) m.set(id, { id, nombre: r.agrupacionNombre || '', rubros: [] });
      m.get(id).rubros.push(r);
    }
    const arr = [...m.values()];
    for (const g of arr) {
      g.rubros.sort((a, b) => String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true }));
    }
    return arr.sort((a, b) => {
      if (a.id === origenId) return -1;
      if (b.id === origenId) return 1;
      return String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' });
    });
  }, [rubros, q, origenId]);

  const texto = q.trim();
  const existeExacto = texto && rubros.some((r) => Number(r.agrupacionId) === origenId && norm(r.subrubro) === norm(texto));
  const crear = () => {
    if (ocupado || !origen) return;
    if (!texto) { inputRef.current?.focus(); return; }
    if (existeExacto) return;
    onMover?.(origenId, texto);
  };

  const esActual = (r) => norm(r.subrubro) === norm(rubroActual) && Number(r.agrupacionId) === origenId;

  return (
    <Dialog open={open} onClose={() => !ocupado && onClose?.()} maxWidth="xs" fullWidth
      // Anclado arriba: al filtrar, el modal no salta de lugar.
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      PaperProps={{ sx: { borderRadius: 2, mt: '10vh' } }}>
      <DialogTitle sx={{ pr: 6, pb: 0.5 }}>
        <Typography component="div" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.3 }}>
          Mover «{articuloNombre}»
        </Typography>
        <Typography component="div" sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.5 }}>
          Hoy está en <b>{origen?.nombre || 'su agrupación'}{rubroActual ? ` › ${rubroActual}` : ''}</b>. Tocá el rubro destino.
        </Typography>
        <IconButton onClick={() => !ocupado && onClose?.()} size="small" sx={{ position: 'absolute', right: 10, top: 10 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: '12px !important', pb: 2 }}>
        {/* buscador pegado a la lista */}
        <TextField
          inputRef={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
          size="small" fullWidth placeholder="Buscar rubro…" disabled={ocupado}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const todos = grupos.flatMap((g) => g.rubros).filter((r) => !esActual(r));
            if (todos.length === 1) onMover?.(Number(todos[0].agrupacionId), todos[0].subrubro);
            else if (texto && !existeExacto) crear();
          }}
          slotProps={{
            input: {
              sx: { height: 40 },
              startAdornment: (
                <InputAdornment position="start">
                  <Box component="span" sx={{ fontSize: 13, color: 'text.disabled' }}>🔍</Box>
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          {/* crear — fijo, no scrollea con la lista */}
          {origen && (
            <Box onClick={crear}
              sx={{
                px: 1.6, py: 1.1, cursor: ocupado || existeExacto ? 'default' : 'pointer',
                borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover',
                '&:hover': { bgcolor: ocupado || existeExacto ? 'action.hover' : 'action.selected' },
                display: 'flex', alignItems: 'center', gap: 1,
              }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: existeExacto ? 'text.disabled' : 'primary.main', flex: 1, minWidth: 0 }} noWrap>
                + {texto && !existeExacto
                  ? `Crear «${texto}» en ${origen.nombre}`
                  : existeExacto ? `«${texto}» ya existe en ${origen.nombre}` : `Crear rubro nuevo en ${origen.nombre}`}
              </Typography>
              {movingKey === `${origenId}|${texto}` && <CircularProgress size={14} />}
            </Box>
          )}
          {!texto && origen && (
            <Typography sx={{ px: 1.6, pt: 0.75, fontSize: '0.7rem', color: 'text.disabled' }}>
              Para crear uno, escribí su nombre en el buscador.
            </Typography>
          )}

          {/* la lista es lo único que scrollea */}
          <Box sx={{ maxHeight: 340, overflowY: 'auto', pb: 0.5 }}>
            {grupos.length === 0 ? (
              <Typography sx={{ px: 1.6, py: 1.4, fontSize: '0.8rem', color: 'text.secondary' }}>
                Sin rubros que coincidan
              </Typography>
            ) : grupos.map((g) => (
              <Box key={g.id}>
                <Typography sx={{
                  px: 1.6, pt: 1.2, pb: 0.4, fontSize: '0.68rem', fontWeight: 700,
                  letterSpacing: '.05em', color: 'text.disabled', textTransform: 'uppercase',
                }}>
                  {g.nombre}{g.id === origenId ? ' · esta agrupación' : ''}
                </Typography>
                {g.rubros.map((r) => {
                  const key = `${r.agrupacionId}|${r.subrubro}`;
                  const actual = esActual(r);
                  const n = conteos.get(key);
                  return (
                    <Box key={key}
                      onClick={() => { if (!actual && !ocupado) onMover?.(Number(r.agrupacionId), r.subrubro); }}
                      sx={{
                        px: 1.6, height: 38, display: 'flex', alignItems: 'center', gap: 1,
                        cursor: actual || ocupado ? 'default' : 'pointer',
                        color: actual ? 'text.disabled' : 'text.primary',
                        '&:hover': { bgcolor: actual || ocupado ? 'transparent' : 'rgba(91,194,234,0.12)' },
                      }}>
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: '0.86rem', color: 'inherit' }}>{r.subrubro}</Typography>
                      {movingKey === key ? <CircularProgress size={14} />
                        : actual ? (
                          <Typography component="span" sx={{
                            fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary',
                            bgcolor: 'action.hover', borderRadius: 5, px: 1, py: '1px',
                          }}>actual</Typography>
                        ) : n ? (
                          <Typography component="span" sx={{ fontSize: '0.74rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
                            {n} artículo{n === 1 ? '' : 's'}
                          </Typography>
                        ) : null}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
