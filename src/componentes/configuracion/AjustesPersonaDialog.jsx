// src/componentes/configuracion/AjustesPersonaDialog.jsx
// Ajustes solo para esta persona (Diego 14/11/2026): excepciones sobre su rol. Se muestra lo
// que la persona ve hoy (rol + ajustes) y se marca con un punto lo que difiere del rol. Se
// guarda como DIFERENCIA con el rol (user_assignments.permissions), así si después se cambia el
// rol la persona sigue con sus excepciones encima del rol nuevo.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography, Button, Switch, Checkbox,
  ToggleButton, ToggleButtonGroup, Divider, Alert,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import { esOculto, alternarOculto } from '@/gestion/ocultosRol';
import { SECCIONES, PERMISOS_STAFF, aplicarAjustes, diferencia, cantidadAjustes } from './catalogoPermisos';

const tc = 'var(--color-primary, #3b82f6)';
const PUNTO = '#5BC2EA';

function Punto({ visible }) {
  return <Box sx={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', bgcolor: visible ? PUNTO : 'transparent' }} title={visible ? 'Distinto de su rol' : undefined} />;
}

export default function AjustesPersonaDialog({ open, onClose, persona, rolNombre, tipo, base, ajustes, onGuardar }) {
  const [efectivo, setEfectivo] = useState(() => aplicarAjustes(tipo, base, ajustes));
  const [seccionId, setSeccionId] = useState('resultados');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setEfectivo(aplicarAjustes(tipo, base, ajustes)); setError(null); } }, [open, tipo, base, ajustes]);

  const delta = useMemo(() => diferencia(tipo, base, efectivo), [tipo, base, efectivo]);
  const n = cantidadAjustes(delta);
  const seccion = SECCIONES.find((s) => s.id === seccionId);

  const guardar = async (valor) => {
    setGuardando(true); setError(null);
    try { await onGuardar(valor); onClose(); }
    catch (e) { setError(e?.response?.data?.error || e?.message || 'No se pudo guardar'); }
    finally { setGuardando(false); }
  };

  const toggleSeccion = (id) => setEfectivo((e) => {
    const s = { ...e.secciones };
    if (s[id]) delete s[id]; else s[id] = 'ver';
    return { ...e, secciones: s };
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth={tipo === 'staff' ? 'xs' : 'md'} fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2, pb: 1 }}>
        <TuneIcon sx={{ color: tc }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2} noWrap>Ajustes solo para {persona}</Typography>
          <Typography variant="caption" color="text.secondary">
            Parte de su rol <b>{rolNombre}</b>. Lo marcado con <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', bgcolor: PUNTO, mx: 0.25 }} /> es distinto del rol.
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {error && <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {tipo === 'staff' ? (
          <Box sx={{ px: 2.5, py: 1.5 }}>
            {PERMISOS_STAFF.map((g, gi) => (
              <Box key={g.grupo} sx={{ mb: 1 }}>
                {gi > 0 && <Divider sx={{ mb: 1 }} />}
                <Typography fontWeight={700} sx={{ fontSize: '0.78rem', mb: 0.5 }}>{g.grupo}</Typography>
                {g.items.map(([k, label]) => {
                  const on = !!efectivo.permisos?.[k];
                  return (
                    <Stack key={k} direction="row" alignItems="center" gap={0.75} sx={{ minHeight: 34 }}>
                      <Punto visible={!!base?.permisos?.[k] !== on} />
                      <Checkbox size="small" checked={on} sx={{ p: 0.5 }}
                        onChange={() => setEfectivo((e) => { const p = { ...e.permisos }; if (on) delete p[k]; else p[k] = true; return { permisos: p }; })} />
                      <Typography sx={{ fontSize: '0.8rem', flex: 1 }}>{label}</Typography>
                    </Stack>
                  );
                })}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, minHeight: 420 }}>
            <Box sx={{ borderRight: { md: '1px solid #f0f0f0' }, py: 1.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 2.5, display: 'block', mb: 1 }}>QUÉ SECCIONES VE</Typography>
              {SECCIONES.map((s) => {
                const on = !!efectivo.secciones?.[s.id];
                const sel = s.id === seccionId;
                const distinto = (base?.secciones?.[s.id] || null) !== (efectivo.secciones?.[s.id] || null);
                return (
                  <Box key={s.id} onClick={() => setSeccionId(s.id)} sx={{
                    px: 1.5, mx: 1, mb: 0.5, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', minHeight: 44,
                    bgcolor: sel ? 'action.selected' : 'transparent', '&:hover': { bgcolor: sel ? 'action.selected' : 'action.hover' },
                  }}>
                    <Punto visible={distinto} />
                    <Switch size="small" checked={on} onClick={(e) => e.stopPropagation()} onChange={() => toggleSeccion(s.id)} />
                    <Typography fontWeight={600} sx={{ fontSize: '0.8rem', flex: 1, minWidth: 0, opacity: on ? 1 : 0.45 }} noWrap>{s.nombre}</Typography>
                    {on && (
                      <ToggleButtonGroup size="small" exclusive value={efectivo.secciones[s.id]} onClick={(e) => e.stopPropagation()}
                        onChange={(_, v) => v && setEfectivo((e) => ({ ...e, secciones: { ...e.secciones, [s.id]: v } }))}
                        sx={{ '& .MuiToggleButton-root': { py: 0.15, px: 1, fontSize: '0.68rem', textTransform: 'none', height: 24 } }}>
                        <ToggleButton value="ver">Ver</ToggleButton>
                        <ToggleButton value="editar">Editar</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ py: 1.5, px: 2.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                DENTRO DE {seccion.nombre.toUpperCase()}, DESTILDÁ LO QUE NO VE
              </Typography>
              {!efectivo.secciones?.[seccionId] ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No ve {seccion.nombre}.</Typography>
              ) : !seccion.grupos.length ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{seccion.nombre} se ve completa.</Typography>
              ) : seccion.grupos.map((g, gi) => (
                <Box key={g.nombre} sx={{ mb: 1.5 }}>
                  {gi > 0 && <Divider sx={{ mb: 1.5 }} />}
                  <Typography fontWeight={700} sx={{ fontSize: '0.78rem', mb: 0.5 }}>{g.nombre}</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', columnGap: 2 }}>
                    {g.items.map(([k, label]) => {
                      const visible = !esOculto(efectivo.ocultos, k);
                      return (
                        <Stack key={k} direction="row" alignItems="center" gap={0.5} sx={{ minHeight: 34 }}>
                          <Punto visible={esOculto(base?.ocultos, k) !== !visible} />
                          <Checkbox size="small" checked={visible} sx={{ p: 0.5 }}
                            onChange={() => setEfectivo((e) => ({ ...e, ocultos: alternarOculto(e.ocultos, k) }))} />
                          <Typography sx={{ fontSize: '0.78rem', flex: 1, minWidth: 0, color: visible ? 'text.primary' : 'text.disabled',
                            textDecoration: visible ? 'none' : 'line-through' }}>{label}</Typography>
                        </Stack>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
          {n ? `${n} ajuste${n !== 1 ? 's' : ''} sobre ${rolNombre}` : `Igual que ${rolNombre}`}
        </Typography>
        {cantidadAjustes(ajustes) > 0 && (
          <Button onClick={() => guardar({})} disabled={guardando} sx={{ color: 'text.secondary' }}>Volver al rol</Button>
        )}
        <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
        <Button variant="contained" disableElevation onClick={() => guardar(delta)} disabled={guardando}
          sx={{ bgcolor: tc, '&:hover': { bgcolor: tc, filter: 'brightness(0.9)' } }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
