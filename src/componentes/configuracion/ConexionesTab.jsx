// src/componentes/configuracion/ConexionesTab.jsx
// ⚙ Configuración › Conexiones (Diego, 07-08/11/2026): el kit vinculado sin Drive.
//   - PC vinculadas del negocio: PC, local, última subida (punto verde/ámbar/rojo), motor y
//     Desvincular (corta la llave de esa PC al instante).
//   - Vincular una PC nueva: 3 pasos + "Descargar instalador" (Diego: "el kit quiero bajarlo
//     desde lazarillo"). El zip trae la última versión del kit y ya apunta a este servidor.
//   - Por API (Waitry, Fudo): próximamente, en gris.
//   El kit NO se publica desde la app: vive en el servidor (carpeta kit/ del repo del back),
//   Diego 08/11: "no quiero que se publique desde usuario".
// Back: GET/POST /api/businesses/:id/kit/{pcs, pcs/:id/desvincular, version, instalador}.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Stack, Paper, Typography, Button, Chip, CircularProgress, Alert, Table, TableHead,
  TableBody, TableRow, TableCell, Tooltip,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { api, BASE, getSession } from '@/servicios/apiBase';
import { showAlert } from '@/servicios/appAlert';
import { showConfirm } from '@/servicios/appConfirm';

const VERDE = '#059669';
const AMBAR = '#f59e0b';
const ROJO = '#dc2626';

const fechaHora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const hm = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hm}`;
  if (d.toDateString() === ayer.toDateString()) return `ayer ${hm}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
};
const dia = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
// La PC corre todos los días: hasta 26 h está al día, hasta 3 días atrasada, después roja.
function colorSubida(iso) {
  if (!iso) return ROJO;
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h <= 26) return VERDE;
  if (h <= 72) return AMBAR;
  return ROJO;
}

function Caja({ titulo, chip, accion, children, gris = false }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', opacity: gris ? 0.6 : 1 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.25, minHeight: 56, borderBottom: children ? '1px solid' : 'none', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{titulo}</Typography>
        {chip}
        <Box sx={{ flex: 1 }} />
        {accion}
      </Stack>
      {children}
    </Paper>
  );
}

export default function ConexionesTab({ businessId, themeColor = '#2492C8' }) {
  const [pcs, setPcs] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(null);
  const [bajando, setBajando] = useState(false);
  const nuevaRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setError(null);
    try {
      const [p, v] = await Promise.all([
        api(`/businesses/${businessId}/kit/pcs`, { timeout: 90000 }),
        api(`/businesses/${businessId}/kit/version`, { timeout: 90000 }),
      ]);
      setPcs(p?.pcs || []);
      setVersion(v?.version || null);
    } catch (e) {
      setError(e?.message || String(e));
      setPcs([]);
    }
  }, [businessId]);
  useEffect(() => { cargar(); }, [cargar]);

  const desvincular = async (pc) => {
    const ok = await showConfirm(
      `¿Desvincular ${pc.pc_nombre}? Deja de subir los datos de ${pc.sucursal || 'este local'} en el momento. Para volver a usarla hay que vincularla de nuevo.`,
      { danger: true, confirmText: 'Desvincular' });
    if (!ok) return;
    try {
      await api(`/businesses/${businessId}/kit/pcs/${pc.id}/desvincular`, { method: 'POST' });
      showAlert(`${pc.pc_nombre} desvinculada`, 'success');
      cargar();
    } catch (e) {
      showAlert(`No se pudo desvincular: ${e?.message || e}`, 'error');
    }
  };

  const descargar = async () => {
    setBajando(true);
    try {
      const { token, activeBusinessId } = getSession();
      const r = await fetch(`${BASE}/businesses/${businessId}/kit/instalador`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(activeBusinessId || businessId) },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error === 'todavia_no_hay_kit_publicado' ? 'El kit todavía no está en el servidor.' : (j.error || `HTTP ${r.status}`));
      }
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Lazarillo - instalar.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showAlert(`No se pudo descargar el instalador: ${e?.message || e}`, 'error');
    } finally {
      setBajando(false);
    }
  };

  const activas = (pcs || []).filter((p) => !p.revocado_en);

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">No pude leer las conexiones: {error}</Alert>}

      <Caja
        titulo="PC vinculadas"
        chip={<Chip size="small" label="MaxiRest" sx={{ height: 24, fontWeight: 600, bgcolor: `${themeColor}14`, color: themeColor }} />}
        accion={
          <Button variant="outlined" size="small" onClick={() => nuevaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            sx={{ height: 34, textTransform: 'none', fontWeight: 700, borderColor: themeColor, color: themeColor }}>
            + Vincular una PC
          </Button>
        }
      >
        {pcs == null ? (
          <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={24} /></Stack>
        ) : activas.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            Todavía no hay ninguna PC vinculada a este negocio.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow sx={{ '& th': { color: 'text.secondary', fontWeight: 600, fontSize: 12 } }}>
                  <TableCell>PC</TableCell>
                  <TableCell>Local</TableCell>
                  <TableCell>Última subida</TableCell>
                  <TableCell>Motor</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {activas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.pc_nombre}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        desde {dia(p.creado_en)}{p.creado_por ? ` · por ${p.creado_por}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 13 }}>{p.sucursal || 'Principal'}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', minHeight: 18 }}>{p.maestros ? '+ maestros' : ''}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={p.ultimo_contacto ? `Último contacto: ${fechaHora(p.ultimo_contacto)}` : 'Todavía no se conectó'}>
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <Box component="span" sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: colorSubida(p.ultima_carga), flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 13 }}>{p.ultima_carga ? fechaHora(p.ultima_carga) : 'sin subidas todavía'}</Typography>
                        </Stack>
                      </Tooltip>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', pl: 2, minHeight: 18 }}>{p.ultima_carga_detalle || ''}</Typography>
                    </TableCell>
                    <TableCell><Typography sx={{ fontSize: 13 }}>{p.motor_ver || '—'}</Typography></TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" color="error" onClick={() => desvincular(p)}
                        sx={{ height: 30, textTransform: 'none', fontWeight: 600 }}>
                        Desvincular
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Caja>

      <Box ref={nuevaRef}>
        <Caja titulo="Vincular una PC nueva">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ px: 2, pt: 1.5 }}>
            {[
              'Bajá el instalador en la PC donde está MaxiRest y descomprimilo.',
              'Doble clic en INSTALAR EN ESTA PC. Entrá con tu usuario de Lazarillo y elegí el local.',
              'Listo: aparece acá con su última subida. Corre sola a las 08:00 y al prender.',
            ].map((t, i) => (
              <Typography key={i} component="div" sx={{ flex: 1, border: '1px dashed', borderColor: 'divider', borderRadius: 2, px: 1.25, py: 1, fontSize: 13, lineHeight: 1.4 }}>
                <Box component="span" sx={{ fontWeight: 700, color: themeColor, mr: 0.5 }}>{i + 1}</Box>{t}
              </Typography>
            ))}
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ px: 2, py: 1.5 }}>
            <Button variant="contained" startIcon={bajando ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadIcon />}
              onClick={descargar} disabled={bajando || !version}
              sx={{ height: 38, textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
              {bajando ? 'Preparando…' : 'Descargar instalador'}
            </Button>
            <Typography variant="body2" color="text.secondary">
              {version
                ? `Lazarillo - instalar.zip · kit ${version.version} del ${dia(version.publicado)}`
                : 'El kit todavía no está en el servidor.'}
            </Typography>
          </Stack>
          <Typography sx={{ px: 2, pb: 1.5, fontSize: 12, color: 'text.secondary' }}>
            Solo dueño o administrador. Si Windows avisa «Windows protegió su PC»: Más información › Ejecutar de todas formas.
            La contraseña no queda guardada en la PC.
          </Typography>
        </Caja>
      </Box>

      <Caja titulo="Por API" gris
        chip={<Chip size="small" label="próximamente" sx={{ height: 24, fontWeight: 600 }} />}
        accion={<Typography variant="body2" color="text.secondary">Waitry · Fudo</Typography>} />
    </Stack>
  );
}
