/* eslint-disable no-unused-vars */
// src/paginas/ConfiguracionMain.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Tabs, Tab, Typography, Stack, TextField, Button,
  Divider, Alert, CircularProgress, Chip, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Tooltip,
  Paper, InputAdornment,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import PercentIcon from '@mui/icons-material/Percent';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BarChartIcon from '@mui/icons-material/BarChart';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { useActiveBusiness, useBusiness } from '../context/BusinessContext';
import { useOrganization } from '../context/OrganizationContext';
import { httpBiz, BusinessesAPI, RecetasAPI } from '../servicios/apiBusinesses';
import { BASE } from '../servicios/apiBase';
import '../css/global.css';
import '../css/theme-layout.css';

/* ─── helpers ─── */
const fmtDate = (s) => {
  try { return format(parseISO(String(s).slice(0, 10)), 'dd/MM/yyyy HH:mm', { locale: es }); }
  catch { return String(s || '').slice(0, 16).replace('T', ' '); }
};

function authHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const bid = bizId ?? localStorage.getItem('activeBusinessId') ?? '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid) h['X-Business-Id'] = String(bid);
  return h;
}

/* ─── Tab panel ─── */
function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

/* ─── Sección de % costo ideal ─── */
function CostoIdealSection({ label, propKey, value, onChange, saving, onSave }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" fontWeight={700}>
          % Costo ideal global — {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Define el porcentaje de costo objetivo para todos los {label.toLowerCase()} del negocio.
          Este valor se usa como default en las recetas y puede sobreescribirse individualmente
          por agrupación, rubro o artículo.
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="% Costo ideal"
            type="number"
            size="small"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputProps={{ min: 0, max: 100, step: 0.5 }}
            InputProps={{
              endAdornment: <InputAdornment position="end"><PercentIcon fontSize="small" /></InputAdornment>,
            }}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            onClick={onSave}
            disabled={saving}
            sx={{
              bgcolor: 'var(--color-primary)',
              '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' },
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </Stack>
        {value > 0 && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Con {value}% de costo, el precio sugerido se calcula como: <strong>Costo ÷ {(value / 100).toFixed(2)}</strong>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function ConfiguracionMain() {
  const { businessId } = useActiveBusiness();
  const { allBusinesses } = useOrganization();

  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState({});
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [config, setConfig] = useState({
    articulos_costo_ideal: '',
    insumos_costo_ideal: '',
    compras_alerta_semanas: '',
  });
  const [configLoading, setConfigLoading] = useState(false);

  // Lotes de compras
  const [lotes, setLotes] = useState([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [dlgDeleteOpen, setDlgDeleteOpen] = useState(false);
  const [dlgMoveOpen, setDlgMoveOpen] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const [moveTargetBiz, setMoveTargetBiz] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [alertasInsumos, setAlertasInsumos] = useState([]);
  const [alertasLoading, setAlertasLoading] = useState(false);
  const [alertasTotal, setAlertasTotal] = useState(0);

  const notify = useCallback((msg, sev = 'success') => {
    setSnack({ open: true, msg, sev });
    setTimeout(() => setSnack(s => ({ ...s, open: false })), 3500);
  }, []);

  /* ── Cargar configuración del negocio ── */
  useEffect(() => {
    if (!businessId) return;
    setConfigLoading(true);
    (async () => {
      try {
        const biz = await BusinessesAPI.get(businessId);
        const props = biz?.props || {};
        setConfig({
          articulos_costo_ideal: String(props.articulos_costo_ideal ?? ''),
          insumos_costo_ideal: String(props.insumos_costo_ideal ?? ''),
          compras_alerta_semanas: String(props.compras_alerta_semanas ?? ''),
        });
      } catch (e) {
        console.error('[Config] Error cargando config:', e);
      } finally {
        setConfigLoading(false);
      }
    })();
  }, [businessId]);

  /* ── Guardar un campo de config ── */
  const saveConfig = useCallback(async (key) => {
    if (!businessId) return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const val = Number(config[key]);
      const patch = { props: { [key]: Number.isFinite(val) ? val : null } };
      await BusinessesAPI.update(businessId, patch);
      notify('Configuración guardada correctamente');
    } catch (e) {
      notify('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }, [businessId, config, notify]);

  /* ── Cargar lotes de compras ── */
  const loadLotes = useCallback(async () => {
    if (!businessId) return;
    setLotesLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/purchases/batches`, {
        headers: authHeaders(businessId),
      });
      const data = await res.json().catch(() => ({}));
      setLotes(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      console.warn('[Config] Error cargando lotes:', e.message);
      setLotes([]);
    } finally {
      setLotesLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (tab === 2) loadLotes();
  }, [tab, loadLotes]);

  // Cargar alertas de insumos al abrir tab Artículos
  useEffect(() => {
    if (tab !== 0 || !businessId) return;
    setAlertasLoading(true);
    RecetasAPI.getAlertas(Number(businessId))
      .then(res => {
        setAlertasInsumos(res?.insumos || []);
        setAlertasTotal(res?.total || 0);
      })
      .catch(() => setAlertasInsumos([]))
      .finally(() => setAlertasLoading(false));
  }, [tab, businessId]);

  /* ── Eliminar lote ── */
  const handleDeleteLote = async () => {
    if (!selectedLote) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/purchases/batches/${selectedLote.batch_id}`, {
        method: 'DELETE',
        headers: authHeaders(businessId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify(`Lote ${selectedLote.batch_id} eliminado`);
      setDlgDeleteOpen(false);
      setSelectedLote(null);
      await loadLotes();
    } catch (e) {
      notify('Error al eliminar: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Mover lote a otro negocio ── */
  const handleMoveLote = async () => {
    if (!selectedLote || !moveTargetBiz) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/purchases/batches/${selectedLote.batch_id}/move`, {
        method: 'POST',
        headers: authHeaders(businessId),
        body: JSON.stringify({ targetBusinessId: Number(moveTargetBiz) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify(`Lote movido al negocio #${moveTargetBiz}`);
      setDlgMoveOpen(false);
      setSelectedLote(null);
      setMoveTargetBiz('');
      await loadLotes();
    } catch (e) {
      notify('Error al mover: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const themeColor = 'var(--color-primary, #3b82f6)';

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <SettingsIcon sx={{ color: themeColor, fontSize: 28 }} />
        <Typography variant="h5" fontWeight={800}>
          Configuración
        </Typography>
      </Stack>

      {configLoading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" mt={1}>
            Cargando configuración…
          </Typography>
        </Stack>
      ) : (
        <>
          {/* Tabs */}
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
              '& .Mui-selected': { color: themeColor },
              '& .MuiTabs-indicator': { bgcolor: themeColor },
            }}
          >
            <Tab icon={<RestaurantMenuIcon fontSize="small" />} iconPosition="start" label="Artículos" />
            <Tab icon={<ShoppingCartIcon fontSize="small" />} iconPosition="start" label="Insumos" />
            <Tab icon={<ReceiptLongIcon fontSize="small" />} iconPosition="start" label="Compras" />
            <Tab icon={<BarChartIcon fontSize="small" />} iconPosition="start" label="Ventas" />
          </Tabs>

          {/* ─── ARTÍCULOS ─── */}
          <TabPanel value={tab} index={0}>
            <Stack spacing={3}>
              <CostoIdealSection
                label="Artículos"
                propKey="articulos_costo_ideal"
                value={config.articulos_costo_ideal}
                onChange={(v) => setConfig(c => ({ ...c, articulos_costo_ideal: v }))}
                saving={!!saving.articulos_costo_ideal}
                onSave={() => saveConfig('articulos_costo_ideal')}
              />
              {/* Panel de alertas de insumos */}
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <WarningAmberIcon sx={{ color: '#f59e0b' }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Insumos con compras vencidas en recetas
                    </Typography>
                    {alertasTotal > 0 && (
                      <Chip
                        label={alertasTotal}
                        size="small"
                        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }}
                      />
                    )}
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setAlertasLoading(true);
                      RecetasAPI.getAlertas(Number(businessId))
                        .then(res => { setAlertasInsumos(res?.insumos || []); setAlertasTotal(res?.total || 0); })
                        .catch(() => {})
                        .finally(() => setAlertasLoading(false));
                    }}
                  >
                    Actualizar
                  </Button>
                </Stack>

                <Typography variant="body2" color="text.secondary" mb={2}>
                  Estos insumos están siendo usados en recetas activas pero no tienen compras registradas
                  en las últimas <strong>{config.compras_alerta_semanas || 4} semanas</strong>.
                  El costo de las recetas puede estar desactualizado.
                </Typography>

                {alertasLoading ? (
                  <Stack alignItems="center" py={2}>
                    <CircularProgress size={24} />
                  </Stack>
                ) : alertasInsumos.length === 0 ? (
                  <Alert severity="success" sx={{ py: 0.5 }}>
                    Todos los insumos usados en recetas tienen compras recientes. ✓
                  </Alert>
                ) : (
                  <Stack spacing={1}>
                    {alertasInsumos.map(ins => (
                      <Paper
                        key={ins.insumoId}
                        variant="outlined"
                        sx={{
                          p: 1.5, borderRadius: 1.5,
                          borderColor: '#fbbf24',
                          bgcolor: '#fffbeb',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {ins.nombre}
                            {ins.unidadMed && (
                              <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>
                                ({ins.unidadMed})
                              </Typography>
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ins.fechaUltimaCompra
                              ? `Última compra: ${ins.fechaUltimaCompra}`
                              : 'Sin compras registradas'
                            }
                            {' · '}{ins.enRecetas} receta{ins.enRecetas !== 1 ? 's' : ''}
                          </Typography>
                        </Stack>
                        <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </TabPanel>

          {/* ─── INSUMOS ─── */}
          <TabPanel value={tab} index={1}>
            <Stack spacing={3}>
              <CostoIdealSection
                label="Insumos"
                propKey="insumos_costo_ideal"
                value={config.insumos_costo_ideal}
                onChange={(v) => setConfig(c => ({ ...c, insumos_costo_ideal: v }))}
                saving={!!saving.insumos_costo_ideal}
                onSave={() => saveConfig('insumos_costo_ideal')}
              />
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Próximamente
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configuración de mermas por tipo, conversiones de unidades, tabla de inflación.
                </Typography>
              </Paper>
            </Stack>
          </TabPanel>

          {/* ─── COMPRAS ─── */}
          <TabPanel value={tab} index={2}>
            <Stack spacing={3}>
              {/* Alerta de fecha */}
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <WarningAmberIcon sx={{ color: '#f59e0b' }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Alerta de fecha de compra
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Si un insumo no fue comprado hace más de N semanas, se resalta en la tabla
                    de artículos (recetas) y en el resumen de insumos.
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      label="Semanas sin compra"
                      type="number"
                      size="small"
                      value={config.compras_alerta_semanas}
                      onChange={(e) => setConfig(c => ({ ...c, compras_alerta_semanas: e.target.value }))}
                      inputProps={{ min: 1, max: 52, step: 1 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">semanas</InputAdornment>,
                      }}
                      sx={{ width: 200 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={saving.compras_alerta_semanas ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                      onClick={() => saveConfig('compras_alerta_semanas')}
                      disabled={!!saving.compras_alerta_semanas}
                      sx={{
                        bgcolor: 'var(--color-primary)',
                        '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' },
                      }}
                    >
                      {saving.compras_alerta_semanas ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </Stack>
                  {config.compras_alerta_semanas > 0 && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                      Los insumos sin compra hace más de <strong>{config.compras_alerta_semanas} semanas</strong> se mostrarán resaltados en rojo.
                    </Alert>
                  )}
                </Stack>
              </Paper>

              {/* Lotes de compras */}
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ReceiptLongIcon sx={{ color: themeColor }} />
                      <Typography variant="subtitle1" fontWeight={700}>
                        Lotes de importación
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={loadLotes}
                      disabled={lotesLoading}
                      sx={{ borderColor: themeColor, color: themeColor }}
                    >
                      {lotesLoading ? <CircularProgress size={14} /> : 'Actualizar'}
                    </Button>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Cada importación de compras genera un lote con ID único (fecha+hora). Desde aquí
                    podés eliminar un lote completo o moverlo a otro negocio.
                  </Typography>

                  {lotesLoading ? (
                    <Stack alignItems="center" py={3}>
                      <CircularProgress size={24} />
                    </Stack>
                  ) : lotes.length === 0 ? (
                    <Alert severity="info">No hay lotes de importación registrados.</Alert>
                  ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: `${themeColor}18` }}>
                            <TableCell sx={{ fontWeight: 700 }}>ID de lote</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Registros</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Negocio</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lotes.map((lote) => (
                            <TableRow
                              key={lote.batch_id}
                              sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                            >
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                                {lote.batch_id}
                              </TableCell>
                              <TableCell>{fmtDate(lote.created_at || lote.fecha)}</TableCell>
                              <TableCell align="right">
                                <Chip
                                  size="small"
                                  label={lote.total_items ?? lote.count ?? '—'}
                                  sx={{ bgcolor: `${themeColor}15`, color: themeColor }}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                                {lote.business_name || `#${lote.business_id}`}
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={0.5} justifyContent="center">
                                  <Tooltip title="Mover a otro negocio">
                                    <IconButton
                                      size="small"
                                      onClick={() => { setSelectedLote(lote); setDlgMoveOpen(true); }}
                                      sx={{ color: themeColor }}
                                    >
                                      <DriveFileMoveIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Eliminar lote">
                                    <IconButton
                                      size="small"
                                      onClick={() => { setSelectedLote(lote); setDlgDeleteOpen(true); }}
                                      sx={{ color: '#ef4444' }}
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </TabPanel>

          {/* ─── VENTAS ─── */}
          <TabPanel value={tab} index={3}>
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
              <BarChartIcon sx={{ fontSize: 48, color: `${themeColor}60`, mb: 1 }} />
              <Typography variant="h6" fontWeight={700} color="text.secondary">
                Configuración de Ventas
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Próximamente: listas de precios, descuentos, integración con MaxiRest, envío de precios actualizados.
              </Typography>
            </Paper>
          </TabPanel>
        </>
      )}

      {/* Snackbar */}
      {snack.open && (
        <Alert
          severity={snack.sev}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            boxShadow: 4, minWidth: 280,
          }}
        >
          {snack.msg}
        </Alert>
      )}

      {/* Dialog: confirmar eliminación de lote */}
      <Dialog open={dlgDeleteOpen} onClose={() => setDlgDeleteOpen(false)}>
        <DialogTitle>Eliminar lote de compras</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar el lote <strong>{selectedLote?.batch_id}</strong>?
            Esta acción eliminará <strong>todos los registros</strong> de esa importación y no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgDeleteOpen(false)} disabled={actionLoading}>Cancelar</Button>
          <Button
            onClick={handleDeleteLote}
            variant="contained"
            color="error"
            disabled={actionLoading}
          >
            {actionLoading ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: mover lote a otro negocio */}
      <Dialog open={dlgMoveOpen} onClose={() => setDlgMoveOpen(false)}>
        <DialogTitle>Mover lote a otro negocio</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Mover el lote <strong>{selectedLote?.batch_id}</strong> a:
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Negocio destino</InputLabel>
            <Select
              value={moveTargetBiz}
              label="Negocio destino"
              onChange={(e) => setMoveTargetBiz(e.target.value)}
            >
              {(allBusinesses || [])
                .filter(b => String(b.id) !== String(businessId))
                .map(b => (
                  <MenuItem key={b.id} value={String(b.id)}>
                    {b.nombre || b.name || `Negocio #${b.id}`}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgMoveOpen(false)} disabled={actionLoading}>Cancelar</Button>
          <Button
            onClick={handleMoveLote}
            variant="contained"
            disabled={!moveTargetBiz || actionLoading}
            sx={{ bgcolor: 'var(--color-primary)', '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' } }}
          >
            {actionLoading ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}