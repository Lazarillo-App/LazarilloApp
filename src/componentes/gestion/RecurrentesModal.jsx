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

const LETRA = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CELESTE = '#5BC2EA';
const pesos = (n) => `$ ${Math.round(n).toLocaleString('es-AR')}`;
const aNumero = (t) => { const n = Number(String(t).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; };
const capital = (t) => String(t || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
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
  const [nuevo, setNuevo] = useState(null); // { nombre, esperado }
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
    if (nuevo?.nombre?.trim()) {
      const monto = aNumero(nuevo.esperado);
      if (!monto) { setError('Poné cuánto factura por mes el cliente nuevo.'); return; }
      clientes.push({ cliente: nuevo.nombre, nombre: nuevo.nombre.trim(), meses: Array(12).fill(true), esperado: monto });
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

  const sxMes = (on, sugerido) => ({
    width: 30, height: 30, borderRadius: '7px', border: 0, p: 0, cursor: editable ? 'pointer' : 'default',
    fontSize: 11.5, fontWeight: on ? 700 : 500, bgcolor: on ? CELESTE : '#f1f1ef', color: on ? '#fff' : '#b5b5b5',
    outline: !on && !sugerido ? 'none' : undefined,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} slotProps={{ paper: { sx: { width: 'min(760px, 96vw)', borderRadius: 3 } } }}>
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
        <Box sx={{ overflowX: 'auto' }}>
          {!editable && <Box sx={{ px: 2.5, pt: 1.5, fontSize: 12.5, color: '#b45309' }}>Estás mirando todas las sucursales: elegí una para corregir los meses (cada PDV tiene sus clientes).</Box>}
          {!filas.length && !nuevo && (
            <Box sx={{ px: 2.5, py: 3, fontSize: 13.5, color: 'text.secondary' }}>
              Lazarillo no encontró clientes que facturen todos los meses en este PDV.
              <Box sx={{ fontSize: 12, mt: 0.5 }}>Se detectan solos: un cliente que en 3 de los últimos 4 meses facturó entre el 2 % y el 15 % del mes.</Box>
            </Box>
          )}
          {filas.length > 0 && (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr>
                  <Box component="th" sx={{ textAlign: 'left', pl: 2.5, py: 1, fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>Cliente</Box>
                  {LETRA.map((l, k) => <Box component="th" key={k} sx={{ width: 34, textAlign: 'center', fontSize: 11, color: k === mes - 1 ? 'text.primary' : 'text.secondary', fontWeight: k === mes - 1 ? 800 : 600 }}>{l}</Box>)}
                  <Box component="th" sx={{ width: 130, textAlign: 'center', fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>Se espera</Box>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <Box component="tr" key={f.cliente} sx={{ borderTop: '1px solid #f1f1ef', opacity: f.quitar ? 0.4 : 1 }}>
                    <Box component="td" sx={{ pl: 2.5, py: 1, fontSize: 13.5, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.nombre}>
                      {capital(f.nombre)}{f.quitar && <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}> · no se espera más</Box>}
                    </Box>
                    {f.meses.map((on, k) => (
                      <Box component="td" key={k} sx={{ textAlign: 'center' }}>
                        <Tooltip title={`${capital(NOMBRE_MES[k])}: ${on ? 'se espera' : 'no se espera'}${on !== f.sugeridos[k] ? ' (cambiado a mano)' : ''}`}>
                          <Box component="button" type="button" disabled={!editable || f.quitar} onClick={() => tocarMes(i, k)}
                            sx={{ ...sxMes(on, f.sugeridos[k]), ...(k === mes - 1 && !on ? { boxShadow: '0 0 0 2px #f59e0b' } : {}) }}>{LETRA[k]}</Box>
                        </Tooltip>
                      </Box>
                    ))}
                    <Box component="td" sx={{ textAlign: 'center', px: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', height: 40, width: 120, mx: 'auto', border: '1px solid #d7dbe0', borderRadius: 2, px: 1, bgcolor: editable ? '#fff' : '#fafafa' }}>
                        <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', mr: 0.5 }}>$</Box>
                        <Box component="input" inputMode="numeric" disabled={!editable || f.quitar} value={Number(aNumero(f.monto) ?? 0).toLocaleString('es-AR')}
                          onChange={(e) => cambiar(i, { monto: e.target.value })}
                          sx={{ border: 0, outline: 0, width: '100%', textAlign: 'right', fontSize: 13.5, fontVariantNumeric: 'tabular-nums', bgcolor: 'transparent' }} />
                      </Box>
                    </Box>
                    <Box component="td" sx={{ textAlign: 'center', pr: 1 }}>
                      {editable && (
                        <Tooltip title={f.quitar ? 'Volver a esperarlo' : 'No es una factura que se repite'}>
                          <IconButton size="small" onClick={() => cambiar(i, { quitar: !f.quitar })} sx={{ color: '#9ca3af' }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                ))}
              </tbody>
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 1.5 }}>
              <Box component="input" autoFocus placeholder="Nombre del cliente como figura en el POS" value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                sx={{ flex: 1, height: 40, border: '1px solid #d7dbe0', borderRadius: 2, px: 1.25, fontSize: 13.5, outline: 0 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', height: 40, width: 150, border: '1px solid #d7dbe0', borderRadius: 2, px: 1 }}>
                <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', mr: 0.5 }}>$</Box>
                <Box component="input" inputMode="numeric" placeholder="por mes" value={nuevo.esperado}
                  onChange={(e) => setNuevo({ ...nuevo, esperado: e.target.value })}
                  sx={{ border: 0, outline: 0, width: '100%', textAlign: 'right', fontSize: 13.5 }} />
              </Box>
            </Box>
          ) : (
            <Box component="button" type="button" onClick={() => setNuevo({ nombre: '', esperado: '' })}
              sx={{ all: 'unset', cursor: 'pointer', color: '#2a88ad', fontWeight: 600, fontSize: 13, px: 2.5, pt: 1.5 }}>+ Agregar cliente</Box>
          ))}
          {error && <Box sx={{ px: 2.5, pt: 1, fontSize: 12.5, color: 'error.main' }}>{error}</Box>}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 2, mt: 1, borderTop: '1px solid #e8e8e6' }}>
        <Box sx={{ fontSize: 12, color: '#8a8f98' }}>Cada cambio queda en Notificaciones.</Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={onClose} sx={{ height: 36, textTransform: 'none' }}>Cancelar</Button>
          <Button variant="contained" disabled={guardando || !editable || !data} onClick={guardar}
            sx={{ height: 36, textTransform: 'none', bgcolor: CELESTE, boxShadow: 'none', '&:hover': { bgcolor: '#4ab0d8', boxShadow: 'none' } }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
