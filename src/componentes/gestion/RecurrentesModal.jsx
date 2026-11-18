// src/componentes/gestion/RecurrentesModal.jsx
// «Facturas que se repiten» (Diego 18/11/2026): clientes que facturan una vez por mes (en FC el
// colegio y la escuelita). Lazarillo los detecta y sugiere en qué meses facturan; acá el usuario
// prende / apaga meses, fija el monto o agrega / saca clientes. Por PDV; queda en Notificaciones.

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Dialog, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';

const LETRA = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CELESTE = '#5BC2EA';
const COLS = 'minmax(150px, 1fr) 488px 150px 32px';
const pesos = (n) => `$ ${Math.round(n).toLocaleString('es-AR')}`;
const aNumero = (t) => { const n = Number(String(t).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; };
const capital = (t) => String(t || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
// Mes a mes desde que apareció hasta el mes pasado (Diego 18/11/2026): un mes esperado sin factura va
// en 0 (rojo) y cuenta en el promedio, porque a veces se olvidan de emitir y después se juntan dos.
// Los meses apagados no se esperan: se muestran grises y no cuentan.
function mesAMes(f, mesActual) {
  if (!f.historial?.length) return { filas: [], promedio: 0, n: 0 };
  const hoy = new Date();
  const anio = mesActual > hoy.getMonth() + 1 ? hoy.getFullYear() - 1 : hoy.getFullYear();
  const fin = anio * 12 + (mesActual - 1); // mes en curso (no entra)
  const [y0, m0] = f.historial[0].mes.split('-').map(Number);
  const imp = new Map(f.historial.map((h) => [h.mes, h.imp]));
  const filas = [];
  for (let t = y0 * 12 + m0 - 1; t < fin; t++) {
    const mes = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
    const v = imp.get(mes) ?? 0;
    filas.push({ mes, imp: v, espera: !!f.meses[t % 12] || v > 0 });
  }
  const cuentan = filas.filter((x) => x.espera);
  return { filas, n: cuentan.length, promedio: cuentan.length ? Math.round(cuentan.reduce((a, x) => a + x.imp, 0) / cuentan.length) : 0 };
}
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export default function RecurrentesModal({ open, onClose }) {
  const { businessId, sucursal } = usePanelGestion();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['gestionRecurrentes', businessId, sucursal],
    queryFn: () => GestionAPI.recurrentes({ sucursal }),
    enabled: open && !!businessId,
  });
  const [filas, setFilas] = useState([]);
  const [nuevo, setNuevo] = useState(null); // { q, cliente, nombre, esperado }
  const [listaAbierta, setListaAbierta] = useState(false);
  // Clientes de las ventas del PDV (informe 22 en MaxiRest): solo se puede agregar uno que facturó.
  const { data: delPos, isLoading: cargandoPos } = useQuery({
    queryKey: ['gestionRecurrentesClientes', businessId, sucursal],
    queryFn: () => GestionAPI.clientesRecurrentesPos({ sucursal }),
    enabled: open && !!nuevo && !!businessId,
    staleTime: 5 * 60_000,
  });
  const candidatos = useMemo(() => {
    if (!nuevo) return [];
    const ya = new Set(filas.map((f) => f.cliente));
    const t = sinAcentos(nuevo.q);
    return (delPos?.clientes ?? []).filter((c) => !ya.has(c.cliente) && (!t || sinAcentos(c.nombre).includes(t))).slice(0, 60);
  }, [delPos, nuevo, filas]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !data) return;
    setFilas(data.clientes.map((c) => ({ ...c, monto: String(Math.round(c.esperado)), quitar: false })));
    setNuevo(null); setError(null);
  }, [open, data]);

  const mes = data?.mes ?? new Date().getMonth() + 1;
  const editable = data?.editable !== false;
  // Meses que la sugerencia dejó apagados aunque es el mes en curso: se avisa en naranja.
  const avisos = useMemo(() => filas.filter((f) => !f.quitar && !f.sugeridos[mes - 1] && !f.meses[mes - 1]), [filas, mes]);

  const cambiar = (i, cambio) => setFilas((xs) => xs.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const tocarMes = (i, k) => cambiar(i, { meses: filas[i].meses.map((v, j) => (j === k ? !v : v)) });

  async function guardar() {
    const clientes = [];
    for (const f of filas) {
      const monto = aNumero(f.monto);
      if (f.quitar) { clientes.push({ cliente: f.cliente, nombre: f.nombre, activo: false }); continue; }
      const mesesCambiaron = !iguales(f.meses, f.sugeridos);
      const montoCambio = monto != null && Math.round(monto) !== Math.round(f.esperadoAuto);
      if (!f.configurado && !mesesCambiaron && !montoCambio) continue;
      clientes.push({ cliente: f.cliente, nombre: f.nombre, meses: mesesCambiaron ? f.meses : null, esperado: montoCambio ? monto : null });
    }
    if (nuevo?.q?.trim() && !nuevo.cliente) { setError('Elegí el cliente de la lista (son los que tienen ventas en este PDV).'); return; }
    if (nuevo?.cliente) {
      const monto = aNumero(nuevo.esperado);
      if (!monto) { setError('Poné cuánto factura por mes el cliente nuevo.'); return; }
      clientes.push({ cliente: nuevo.cliente, nombre: nuevo.nombre, meses: Array(12).fill(true), esperado: monto });
    }
    if (!clientes.length) { onClose(); return; }
    setGuardando(true); setError(null);
    try {
      await GestionAPI.guardarRecurrentes({ sucursal, clientes });
      // Solo lo que depende de esto: la proyección del PDV y esta lista.
      qc.invalidateQueries({ queryKey: ['gestionProyeccion', businessId] });
      qc.invalidateQueries({ queryKey: ['gestionRecurrentes', businessId] });
      onClose();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  const sxMes = (on) => ({
    width: '100%', height: 30, borderRadius: '6px', border: 0, p: 0, cursor: editable ? 'pointer' : 'default',
    fontSize: 12, fontWeight: on ? 700 : 500, bgcolor: on ? CELESTE : '#f1f1ef', color: on ? '#fff' : '#b5b5b5',
    fontFamily: 'inherit', '&:disabled': { cursor: 'default' },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} slotProps={{ paper: { sx: { width: 'min(940px, 96vw)', borderRadius: 3, m: { xs: 0, sm: 4 }, maxHeight: { xs: '100%', sm: 'calc(100% - 64px)' }, height: { xs: '100%', sm: 'auto' }, ...{ '@media (max-width:599px)': { width: '100%', maxWidth: '100%', borderRadius: 0 } } } } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: 2.5, py: 2, borderBottom: '1px solid #e8e8e6' }}>
        <Box>
          <Box sx={{ fontSize: 17, fontWeight: 700 }}>Facturas que se repiten</Box>
          <Box sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>Clientes que facturan todos los meses. La proyección los espera solo en los meses marcados.</Box>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Cerrar"><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {isLoading || !data ? (
        <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>
      ) : (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {!editable && <Box sx={{ px: 2.5, pt: 1.5, fontSize: 12.5, color: '#b45309' }}>Estás mirando todas las sucursales: elegí una para corregir los meses (cada PDV tiene sus clientes).</Box>}
          {!filas.length && !nuevo && (
            <Box sx={{ px: 2.5, py: 3, fontSize: 13.5, color: 'text.secondary' }}>
              Lazarillo no encontró clientes que facturen todos los meses en este PDV.
              <Box sx={{ fontSize: 12, mt: 0.5 }}>Se detectan solos: un cliente que, desde que apareció, factura entre el 1 % y el 15 % de las ventas del mes en 2 de cada 3 meses (mínimo 3 veces).</Box>
            </Box>
          )}
          {filas.length > 0 && (
            // Grilla de divs (no <table>): el tema del negocio pinta los <thead> de la app.
            <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 1 }}>
              <Box sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: COLS, columnGap: 1.5, pb: 0.75, fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>
                <span>Cliente</span><span>Meses en que factura</span><Box sx={{ textAlign: 'center' }}>Se espera por mes</Box><span />
              </Box>
              {filas.map((f, i) => (
                <Box key={f.cliente} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: COLS }, gridTemplateAreas: { xs: '"n x" "m m" "e e"', sm: '"n m e x"' }, columnGap: 1.5, rowGap: 1, alignItems: 'start', py: 1.25, borderTop: '1px solid #f1f1ef', opacity: f.quitar ? 0.4 : 1 }}>
                  <Box sx={{ gridArea: 'n', minWidth: 0, minHeight: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 13.5, fontWeight: 600 }} title={f.nombre}>
                    <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{capital(f.nombre)}</Box>
                    {f.quitar && <Box sx={{ fontSize: 11, fontWeight: 400, color: 'text.secondary' }}>no se espera más</Box>}
                  </Box>
                  <Box sx={{ gridArea: 'm', pt: { sm: '5px' }, display: 'grid', gridTemplateColumns: { xs: 'repeat(6, 1fr)', sm: 'repeat(12, 1fr)' }, gap: '4px' }}>
                    {f.meses.map((on, k) => (
                      <Tooltip key={k} title={`${capital(NOMBRE_MES[k])}: ${on ? 'se espera' : 'no se espera'}${on !== f.sugeridos[k] ? ' (cambiado a mano)' : ''}`}>
                        <Box component="button" type="button" disabled={!editable || f.quitar} onClick={() => tocarMes(i, k)}
                          sx={{ ...sxMes(on), ...(k === mes - 1 ? { boxShadow: on ? '0 0 0 2px #fff, 0 0 0 3px #2a88ad' : '0 0 0 2px #f59e0b' } : {}) }}>{LETRA[k]}</Box>
                      </Tooltip>
                    ))}
                  </Box>
                  <Box sx={{ gridArea: 'e' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', height: 40, border: '1px solid #d7dbe0', borderRadius: 2, px: 1.25, bgcolor: editable ? '#fff' : '#fafafa' }}>
                    <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', mr: 0.5 }}>$</Box>
                    <Box component="input" inputMode="numeric" disabled={!editable || f.quitar} value={Number(aNumero(f.monto) ?? 0).toLocaleString('es-AR')}
                      onChange={(e) => cambiar(i, { monto: e.target.value })}
                      sx={{ border: 0, outline: 0, width: '100%', minWidth: 0, textAlign: 'right', fontSize: 13.5, fontVariantNumeric: 'tabular-nums', bgcolor: 'transparent', color: 'text.primary' }} />
                  </Box>
                  {f.historial?.length > 0 && (() => { const h12 = mesAMes(f, mes); return (
                    <Tooltip placement="bottom" title={
                      <Box sx={{ fontSize: 12, minWidth: 200 }}>
                        <Box sx={{ opacity: 0.7, mb: 0.5 }}>Facturado mes a mes · promedio de {h12.n} {h12.n === 1 ? 'mes' : 'meses'}</Box>
                        {h12.filas.map((h) => (
                          <Box key={h.mes} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontVariantNumeric: 'tabular-nums', ...(!h.espera ? { opacity: 0.45 } : h.imp === 0 ? { color: '#ff8a80', fontWeight: 700 } : {}) }}>
                            <span>{capital(NOMBRE_MES[Number(h.mes.slice(5)) - 1]).slice(0, 3)} {h.mes.slice(2, 4)}</span><span>{h.espera ? pesos(h.imp) : 'no se espera'}</span>
                          </Box>
                        ))}
                        {h12.filas.some((h) => h.espera && h.imp === 0) && <Box sx={{ opacity: 0.7, mt: 0.5 }}>En rojo: meses sin factura (cuentan como 0).</Box>}
                        {editable && <Box sx={{ opacity: 0.7, mt: 0.5 }}>Tocá para usar el promedio.</Box>}
                      </Box>
                    }>
                      <Box component="button" type="button" onClick={() => { if (editable && !f.quitar) cambiar(i, { monto: String(h12.promedio) }); }}
                        sx={{ all: 'unset', display: 'block', width: '100%', textAlign: 'center', whiteSpace: 'nowrap', mt: 0.5, fontSize: 11.5, color: '#8a8f98', cursor: editable ? 'pointer' : 'default', '&:hover': editable ? { color: '#2a88ad' } : {} }}>
                        Promedio {pesos(h12.promedio)}
                      </Box>
                    </Tooltip>
                  ); })()}
                  </Box>
                  <Box sx={{ gridArea: 'x', display: 'flex', justifyContent: 'center', pt: { sm: '4px' } }}>
                    {editable && (
                      <Tooltip title={f.quitar ? 'Volver a esperarlo' : 'No es una factura que se repite'}>
                        <IconButton size="small" onClick={() => cambiar(i, { quitar: !f.quitar })} sx={{ color: '#9ca3af' }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ px: 2.5, pt: 1, fontSize: 11.5, color: '#8a8f98', lineHeight: 1.5 }}>
            {filas.length > 0 && <div>Los meses los sugiere Lazarillo con lo que facturó cada cliente el año pasado: tocá uno para prenderlo o apagarlo.</div>}
            {avisos.map((f) => (
              <Box key={f.cliente} sx={{ color: '#b45309' }}>● {capital(NOMBRE_MES[mes - 1])} de {capital(f.nombre)} está apagado porque el año pasado no facturó. ¿Este año sí? Tocalo.</Box>
            ))}
            {filas.length > 0 && <div>«Se espera» es lo del último mes que facturó; si lo cambiás, queda fijo hasta que lo vuelvas a tocar.</div>}
          </Box>
          {editable && (nuevo ? (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'flex-start' }, gap: 1, px: 2.5, pt: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0, order: { xs: 0, sm: 0 } }}>
                <Box component="input" autoFocus placeholder="Buscá el cliente en las ventas del PDV" value={nuevo.q}
                  onFocus={() => setListaAbierta(true)}
                  onChange={(e) => { setNuevo({ ...nuevo, q: e.target.value, cliente: null }); setListaAbierta(true); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setListaAbierta(false); } }}
                  sx={{ width: '100%', boxSizing: 'border-box', height: 40, border: `1px solid ${nuevo.cliente ? CELESTE : '#d7dbe0'}`, borderRadius: 2, px: 1.25, fontSize: 13.5, outline: 0, fontFamily: 'inherit' }} />
                {listaAbierta && !nuevo.cliente && (
                  <Box ref={(el) => el?.scrollIntoView?.({ block: 'nearest' })} sx={{ mt: 0.5, maxHeight: 240, overflowY: 'auto', bgcolor: '#fff', border: '1px solid #e2e5e9', borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
                    {cargandoPos ? <Box sx={{ p: 1.5, fontSize: 12.5, color: 'text.secondary' }}>Buscando clientes…</Box>
                      : !candidatos.length ? <Box sx={{ p: 1.5, fontSize: 12.5, color: 'text.secondary' }}>No hay ventas con ese cliente en este PDV.</Box>
                      : candidatos.map((c) => (
                        <Box key={c.cliente} component="button" type="button"
                          onClick={() => { setNuevo({ q: capital(c.nombre), cliente: c.cliente, nombre: c.nombre, esperado: String(c.ultimo) }); setListaAbierta(false); }}
                          sx={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 0.25, sm: 2 }, minHeight: 44, py: { xs: 0.75, sm: 0 }, px: 1.5, cursor: 'pointer', fontSize: 13, '&:hover': { bgcolor: 'action.hover' } }}>
                          <Box sx={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{capital(c.nombre)}</Box>
                          <Box sx={{ flexShrink: 0, fontSize: 11.5, color: '#8a8f98', fontVariantNumeric: 'tabular-nums' }}>
                            {c.meses} de 12 meses · {capital(NOMBRE_MES[Number(c.ultimoMes.slice(5)) - 1]).slice(0, 3)} {pesos(c.ultimo)}
                          </Box>
                        </Box>
                      ))}
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', height: 40, width: { xs: 'auto', sm: 150 }, border: '1px solid #d7dbe0', borderRadius: 2, px: 1 }}>
                <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', mr: 0.5 }}>$</Box>
                <Box component="input" inputMode="numeric" placeholder="por mes" value={nuevo.esperado}
                  onChange={(e) => setNuevo({ ...nuevo, esperado: e.target.value })}
                  sx={{ border: 0, outline: 0, width: '100%', textAlign: 'right', fontSize: 13.5 }} />
              </Box>
            </Box>
          ) : (
            <Box component="button" type="button" onClick={() => { setNuevo({ q: '', cliente: null, nombre: '', esperado: '' }); setListaAbierta(true); }}
              sx={{ all: 'unset', cursor: 'pointer', color: '#2a88ad', fontWeight: 600, fontSize: 13, px: 2.5, pt: 1.5 }}>+ Agregar cliente</Box>
          ))}
          {error && <Box sx={{ px: 2.5, pt: 1, fontSize: 12.5, color: 'error.main' }}>{error}</Box>}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 2, mt: 1, borderTop: '1px solid #e8e8e6' }}>
        <Box sx={{ fontSize: 12, color: '#8a8f98' }}>Cada cambio queda en Notificaciones.</Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={onClose} sx={{ height: { xs: 44, sm: 36 }, textTransform: 'none' }}>Cancelar</Button>
          <Button variant="contained" disabled={guardando || !editable || !data} onClick={guardar}
            sx={{ height: { xs: 44, sm: 36 }, textTransform: 'none', bgcolor: CELESTE, boxShadow: 'none', '&:hover': { bgcolor: '#4ab0d8', boxShadow: 'none' } }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
