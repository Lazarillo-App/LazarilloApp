/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/paginas/ConfiguracionMain.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { syncAll, isMaxiConfigured } from '@/servicios/syncService';
import { ensureTodo } from '../servicios/apiAgrupacionesTodo';
import {
  Box, Tabs, Tab, Typography, Stack, TextField, Button,
  Divider, Alert, CircularProgress, Chip, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Tooltip,
  Paper, InputAdornment, Grid,
} from '@mui/material';
import BusinessCard from '../componentes/BusinessCard';
import SucursalesSection from '../componentes/SucursalesSection';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import SyncDialog from '../componentes/SyncDialog';
import OrgDashboard from '../componentes/OrgDashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import PercentIcon from '@mui/icons-material/Percent';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BusinessIcon from '@mui/icons-material/Business';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PublicIcon from '@mui/icons-material/Public';
import TuneIcon from '@mui/icons-material/Tune';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddIcon from '@mui/icons-material/Add';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useActiveBusiness, useBusiness } from '../context/BusinessContext';
import { httpBiz, BusinessesAPI, RecetasAPI, PriceConfigAPI } from '../servicios/apiBusinesses';
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

/* ─── Sección de configuración con layout de dos columnas ─── */
function SectionCard({ icon, title, children, accent }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        height: '100%',
        ...(accent && { borderColor: `${themeColor}40` }),
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          ...(accent && { bgcolor: `${themeColor}06` }),
        }}
      >
        {icon && React.cloneElement(icon, { sx: { color: themeColor, fontSize: 18 } })}
        <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
      </Stack>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Paper>
  );
}

/* ─── % Costo ideal ─── */
function CostoIdealSection({ label, value, onChange, saving, onSave }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Define el porcentaje de costo objetivo para todas las recetas de insumos elaborados del negocio.
        Este valor se usa como default en sus recetas y puede sobreescribirse individualmente por agrupación, rubro o insumo elaborado.
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField
          label="Costo ideal"
          type="number"
          size="small"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputProps={{ min: 0, max: 100, step: 0.5 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <PercentIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 150 }}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={onSave}
          disabled={saving}
          sx={{
            bgcolor: themeColor,
            '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor },
          }}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </Stack>
      {Number(value) > 0 && (
        <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem' }}>
          Con {value}% de costo → precio sugerido: <strong>Costo ÷ {(Number(value) / 100).toFixed(2)}</strong>
        </Alert>
      )}
    </Stack>
  );
}

/* ─── Alerta de días/semanas sin datos ─── */
function AlertaConfigSection({ label, configKey, value, onChange, saving, onSave, unit = 'días', icon }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField
          label={unit === 'días' ? 'Días sin datos' : 'Semanas sin compras'}
          type="number"
          size="small"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputProps={{ min: 1, max: unit === 'días' ? 365 : 52, step: 1 }}
          sx={{ width: 150 }}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={onSave}
          disabled={saving}
          sx={{
            bgcolor: themeColor,
            '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor },
          }}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </Stack>
    </Stack>
  );
}

/* ─── Placeholder de importación desde archivo ─── */
function ImportPlaceholder({ tipo, columnasDemo, onAbrir }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={{
        p: 2,
        borderRadius: 1.5,
        border: '1.5px dashed',
        borderColor: `${themeColor}30`,
        bgcolor: `${themeColor}04`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <CloudUploadIcon sx={{ color: themeColor, fontSize: 22, flexShrink: 0 }} />
        <Box>
          <Typography variant="body2" fontWeight={600} lineHeight={1.3}>
            Importar desde archivo externo
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Lazarillo te guía para mapear columnas. Útil cuando Maxi es lento.
          </Typography>
        </Box>
      </Stack>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AutoFixHighIcon />}
        onClick={() => onAbrir(tipo, columnasDemo)}
        sx={{ borderColor: themeColor, color: themeColor, whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        Ver equivalencias
      </Button>
    </Stack>
  );
}

/* ═══════════════════════════════════════════════
   MODAL: Vista previa de lote
═══════════════════════════════════════════════ */
function LotePreviewModal({ open, onClose, lote, businessId, previewEndpoint }) {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState('');
  const themeColor = 'var(--color-primary, #3b82f6)';

  useEffect(() => {
    if (!open || !lote) return;
    setLoading(true);
    setError('');
    setPreviewData(null);
    fetch(previewEndpoint || `${BASE}/purchases/batches/${lote.batch_id}/preview`, {
      headers: authHeaders(businessId),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.columns && data?.rows) setPreviewData(data);
        else setError('No se pudo obtener la vista previa del lote.');
      })
      .catch(() => setError('Error al cargar la vista previa.'))
      .finally(() => setLoading(false));
  }, [open, lote, businessId, previewEndpoint]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '80vh' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <VisibilityIcon sx={{ color: themeColor }} />
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Vista previa del lote</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {lote?.batch_id}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading && (
          <Stack alignItems="center" justifyContent="center" py={6}>
            <CircularProgress />
          </Stack>
        )}
        {error && !loading && <Box p={3}><Alert severity="error">{error}</Alert></Box>}
        {previewData && !loading && (
          <Box>
            <Stack direction="row" spacing={2} sx={{ px: 3, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Chip size="small" label={`${previewData.columns?.length ?? 0} columnas`}
                sx={{ bgcolor: `${themeColor}15`, color: themeColor, fontWeight: 600 }} />
              <Chip size="small" label={`${lote?.total_items ?? '?'} registros`} variant="outlined" />
            </Stack>
            <Box sx={{ overflowX: 'auto', maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#f1f5f9 !important', fontWeight: 700, fontSize: '0.7rem', width: 40, textAlign: 'center' }}>#</TableCell>
                    {(previewData.columns || []).map((col, i) => (
                      <TableCell key={i} sx={{ bgcolor: '#f1f5f9 !important', fontWeight: 700, fontSize: '0.75rem', color: `${themeColor} !important`, whiteSpace: 'nowrap' }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(previewData.rows || []).map((row, ri) => (
                    <TableRow key={ri} sx={{ bgcolor: ri % 2 === 0 ? '#fff' : '#fafafa', '&:hover': { bgcolor: `${themeColor}08` } }}>
                      <TableCell sx={{ textAlign: 'center', fontSize: '0.7rem', color: 'text.disabled', fontFamily: 'monospace' }}>{ri + 1}</TableCell>
                      {(previewData.columns || []).map((col, ci) => (
                        <TableCell key={ci} sx={{ fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[col] === null || row[col] === undefined ? '—' : String(row[col])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════
   MODAL: Equivalencias de columnas (Lazarillo)
═══════════════════════════════════════════════ */
const REQUIRED_COLUMNS = {
  articulos: [
    { key: 'codigo', label: 'Código', required: true, description: 'Identificador único del artículo' },
    { key: 'nombre', label: 'Nombre', required: true, description: 'Nombre o descripción del artículo' },
    { key: 'precio', label: 'Precio de venta', required: true, description: 'Precio de venta al público' },
    { key: 'rubro', label: 'Rubro / Categoría', required: false, description: 'Clasificación del artículo' },
    { key: 'unidad', label: 'Unidad de medida', required: false, description: 'Ej: kg, un, lt' },
  ],
  insumos: [
    { key: 'codigo', label: 'Código', required: true, description: 'Identificador único del insumo' },
    { key: 'nombre', label: 'Nombre', required: true, description: 'Nombre o descripción del insumo' },
    { key: 'unidad', label: 'Unidad de medida', required: true, description: 'Ej: kg, lt, un' },
    { key: 'categoria', label: 'Categoría / Tipo', required: false, description: 'Clasificación del insumo' },
    { key: 'proveedor', label: 'Proveedor', required: false, description: 'Nombre del proveedor habitual' },
  ],
  compras: [
    { key: 'fecha', label: 'Fecha', required: true, description: 'Fecha de la compra (dd/mm/aaaa)' },
    { key: 'insumo_codigo', label: 'Código de insumo', required: true, description: 'Código del insumo comprado' },
    { key: 'insumo_nombre', label: 'Nombre del insumo', required: false, description: 'Alternativa al código' },
    { key: 'cantidad', label: 'Cantidad', required: true, description: 'Cantidad comprada' },
    { key: 'precio_unitario', label: 'Precio unitario', required: true, description: 'Precio por unidad' },
    { key: 'proveedor', label: 'Proveedor', required: false, description: 'Nombre del proveedor' },
    { key: 'nro_factura', label: 'Nº Factura', required: false, description: 'Número de comprobante' },
  ],
  ventas: [
    { key: 'fecha', label: 'Fecha', required: true, description: 'Fecha de la venta' },
    { key: 'articulo_codigo', label: 'Código de artículo', required: true, description: 'Código del artículo vendido' },
    { key: 'articulo_nombre', label: 'Nombre del artículo', required: false, description: 'Alternativa al código' },
    { key: 'cantidad', label: 'Cantidad', required: true, description: 'Unidades vendidas' },
    { key: 'precio', label: 'Precio unitario', required: true, description: 'Precio de venta' },
    { key: 'total', label: 'Total', required: false, description: 'Importe total de la línea' },
    { key: 'mesa', label: 'Mesa / Canal', required: false, description: 'Origen de la venta' },
  ],
};

function EquivalenciasModal({ open, onClose, uploadedColumns = [], tipoImportacion = 'compras', onConfirm }) {
  const requiredCols = REQUIRED_COLUMNS[tipoImportacion] || [];
  const [mapping, setMapping] = useState({});
  const themeColor = 'var(--color-primary, #3b82f6)';

  useEffect(() => {
    if (!open) return;
    const autoMap = {};
    requiredCols.forEach((req) => {
      const match = uploadedColumns.find(
        (c) =>
          c.toLowerCase() === req.key.toLowerCase() ||
          c.toLowerCase() === req.label.toLowerCase() ||
          c.toLowerCase().includes(req.key.toLowerCase()) ||
          req.key.toLowerCase().includes(c.toLowerCase().split(' ')[0])
      );
      if (match) autoMap[req.key] = match;
    });
    setMapping(autoMap);
  }, [open, tipoImportacion, uploadedColumns]);

  const missingRequired = requiredCols.filter((r) => r.required && !mapping[r.key]);
  const canConfirm = missingRequired.length === 0;

  const tipoLabel = { articulos: 'Artículos', insumos: 'Insumos', compras: 'Compras', ventas: 'Ventas' }[tipoImportacion] || tipoImportacion;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
          <AutoFixHighIcon sx={{ color: themeColor, fontSize: 26 }} />
          <Box>
            <Typography variant="h6" fontWeight={800}>Lazarillo — Equivalencias de columnas</Typography>
            <Typography variant="caption" color="text.secondary">Importación de {tipoLabel}</Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: `${themeColor}06`, borderColor: `${themeColor}30` }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <InfoOutlinedIcon sx={{ color: themeColor, mt: 0.2, flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Tu archivo tiene <strong>{uploadedColumns.length} columnas</strong>. Indicá a qué campo de Lazarillo corresponde cada una.
              Los campos con <strong style={{ color: '#ef4444' }}>*</strong> son obligatorios.
            </Typography>
          </Stack>
        </Paper>

        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Columnas detectadas en tu archivo
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.8} mt={1} mb={3}>
          {uploadedColumns.map((col) => {
            const isMapped = Object.values(mapping).includes(col);
            return (
              <Chip key={col} label={col} size="small" sx={{
                bgcolor: isMapped ? `${themeColor}18` : '#f1f5f9',
                color: isMapped ? themeColor : 'text.secondary',
                fontWeight: isMapped ? 700 : 400,
                border: `1px solid ${isMapped ? `${themeColor}40` : '#e2e8f0'}`,
                fontFamily: 'monospace',
                fontSize: '0.75rem',
              }} />
            );
          })}
        </Stack>

        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Campos requeridos por Lazarillo
        </Typography>
        <Stack spacing={1.5} mt={1.5}>
          {requiredCols.map((req) => {
            const val = mapping[req.key] || '';
            const isOk = !!val;
            return (
              <Paper key={req.key} variant="outlined" sx={{
                p: 1.5, borderRadius: 1.5,
                borderColor: isOk ? `${themeColor}40` : 'divider',
                bgcolor: isOk ? `${themeColor}05` : 'transparent',
              }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="body2" fontWeight={700}>{req.label}</Typography>
                      {req.required && <Typography component="span" sx={{ color: '#ef4444', fontWeight: 800 }}>*</Typography>}
                      {!req.required && <Chip label="Opcional" size="small" sx={{ fontSize: '0.65rem', height: 16, bgcolor: '#f1f5f9', color: 'text.secondary' }} />}
                      {isOk && <Chip label="Auto" size="small" sx={{ fontSize: '0.65rem', height: 16, bgcolor: `${themeColor}15`, color: themeColor, fontWeight: 700 }} />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{req.description}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 220 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Columna del archivo</InputLabel>
                      <Select value={val} label="Columna del archivo"
                        onChange={(e) => setMapping((m) => ({ ...m, [req.key]: e.target.value }))}>
                        <MenuItem value=""><em>— No mapear —</em></MenuItem>
                        {uploadedColumns.map((col) => <MenuItem key={col} value={col}>{col}</MenuItem>)}
                      </Select>
                    </FormControl>
                    {isOk ? <CheckCircleIcon sx={{ color: '#22c55e', flexShrink: 0 }} />
                      : req.required ? <ErrorIcon sx={{ color: '#ef444460', flexShrink: 0 }} />
                        : <Box sx={{ width: 24 }} />}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
        {missingRequired.length > 0 && (
          <Alert severity="error" sx={{ mt: 2, py: 0.5 }}>
            Faltan: <strong>{missingRequired.map((r) => r.label).join(', ')}</strong>
          </Alert>
        )}
        {canConfirm && <Alert severity="success" sx={{ mt: 2, py: 0.5 }}>¡Todo listo! Podés confirmar la importación.</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button onClick={() => onConfirm && onConfirm(mapping)} variant="contained" disabled={!canConfirm}
          startIcon={<CheckCircleIcon />}
          sx={{ bgcolor: 'var(--color-primary)', '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' } }}>
          Confirmar importación
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════
   LOTES PANEL — tabla de lotes importados
═══════════════════════════════════════════════ */
function LotesPanel({ businessId, lotesTipo = 'compras', allBusinesses }) {
  const [lotes, setLotes] = useState([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [dlgDeleteOpen, setDlgDeleteOpen] = useState(false);
  const [dlgMoveOpen, setDlgMoveOpen] = useState(false);
  const [dlgPreviewOpen, setDlgPreviewOpen] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const [moveTargetBiz, setMoveTargetBiz] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [notify, setNotify] = useState(null);

  const themeColor = 'var(--color-primary, #3b82f6)';
  const endpoint = lotesTipo === 'ventas' ? `${BASE}/sales/batches` : `${BASE}/purchases/batches`;

  const loadLotes = useCallback(async () => {
    if (!businessId) return;
    setLotesLoading(true);
    try {
      const res = await fetch(endpoint, { headers: authHeaders(businessId) });
      const data = await res.json().catch(() => ({}));
      setLotes(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setLotes([]);
    } finally {
      setLotesLoading(false);
    }
  }, [businessId, endpoint]);

  useEffect(() => { loadLotes(); }, [loadLotes]);

  const showNotify = (msg, sev = 'success') => {
    setNotify({ msg, sev });
    setTimeout(() => setNotify(null), 3000);
  };

  const handleDeleteLote = async () => {
    if (!selectedLote) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${endpoint}/${selectedLote.batch_id}`, { method: 'DELETE', headers: authHeaders(businessId) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showNotify(`Lote ${selectedLote.batch_id} eliminado`);
      setDlgDeleteOpen(false);
      setSelectedLote(null);
      await loadLotes();
      window.dispatchEvent(new CustomEvent('purchases:batch:changed', { detail: { businessId, action: 'deleted', batchId: selectedLote.batch_id } }));
    } catch (e) {
      showNotify('Error al eliminar: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveLote = async () => {
    if (!selectedLote || !moveTargetBiz) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${endpoint}/${selectedLote.batch_id}/move`, {
        method: 'POST',
        headers: authHeaders(businessId),
        body: JSON.stringify({ targetBusinessId: Number(moveTargetBiz) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showNotify(`Lote movido al negocio #${moveTargetBiz}`);
      setDlgMoveOpen(false);
      setSelectedLote(null);
      setMoveTargetBiz('');
      await loadLotes();
    } catch (e) {
      showNotify('Error al mover: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" fontWeight={700} color="text.secondary">
              Lotes importados
            </Typography>
            {lotes.length > 0 && (
              <Chip size="small" label={lotes.length}
                sx={{ bgcolor: `${themeColor}15`, color: themeColor, fontWeight: 700, height: 18, fontSize: '0.65rem' }} />
            )}
          </Stack>
          <Button size="small" variant="text" onClick={loadLotes} disabled={lotesLoading}
            sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {lotesLoading ? <CircularProgress size={12} /> : 'Actualizar'}
          </Button>
        </Stack>

        {notify && <Alert severity={notify.sev} sx={{ py: 0.5, fontSize: '0.78rem' }}>{notify.msg}</Alert>}

        {lotesLoading ? (
          <Stack alignItems="center" py={2}><CircularProgress size={20} /></Stack>
        ) : lotes.length === 0 ? (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            No hay lotes de importación registrados.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: `${themeColor}0c` }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', minWidth: 140 }}>ID / Archivo</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', minWidth: 120, whiteSpace: 'nowrap' }}>Importado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem' }}>Registros</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', minWidth: 100 }}>Sucursal</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.72rem' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lotes.map((lote) => (
                  <TableRow key={lote.batch_id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ fontSize: '0.78rem' }}>
                      {lotesTipo === 'ventas' ? (
                        <Stack>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160, fontSize: '0.78rem' }}>
                            {lote.original_name || lote.batch_id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
                            #{lote.batch_id}
                          </Typography>
                        </Stack>
                      ) : (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{lote.batch_id}</span>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                      {fmtDate(lote.created_at || lote.fecha)}
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={lote.total_items ?? lote.count ?? '—'}
                        sx={{ bgcolor: `${themeColor}15`, color: themeColor, fontSize: '0.7rem', height: 18 }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>
                      {lote.branch_name
                        ? <Chip size="small" label={lote.branch_name} sx={{ fontSize: '0.7rem', height: 18, bgcolor: `${themeColor}15`, color: themeColor }} />
                        : <Typography variant="caption" color="text.disabled">Principal</Typography>
                      }
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.25} justifyContent="center">
                        <Tooltip title="Vista previa">
                          <IconButton size="small" onClick={() => { setSelectedLote(lote); setDlgPreviewOpen(true); }} sx={{ color: '#6366f1' }}>
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mover a otro negocio">
                          <IconButton size="small" onClick={() => { setSelectedLote(lote); setDlgMoveOpen(true); }} sx={{ color: themeColor }}>
                            <DriveFileMoveIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar lote">
                          <IconButton size="small" onClick={() => { setSelectedLote(lote); setDlgDeleteOpen(true); }} sx={{ color: '#ef4444' }}>
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
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

      <LotePreviewModal
        open={dlgPreviewOpen}
        onClose={() => { setDlgPreviewOpen(false); setSelectedLote(null); }}
        lote={selectedLote}
        businessId={businessId}
        previewEndpoint={selectedLote ? `${endpoint}/${selectedLote.batch_id}/preview` : undefined}
      />

      <Dialog open={dlgDeleteOpen} onClose={() => setDlgDeleteOpen(false)}>
        <DialogTitle>Eliminar lote de {lotesTipo}</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar el lote <strong>{selectedLote?.batch_id}</strong>?
            Esto elimina <strong>todos los registros</strong> de esa importación y no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgDeleteOpen(false)} disabled={actionLoading}>Cancelar</Button>
          <Button onClick={handleDeleteLote} variant="contained" color="error" disabled={actionLoading}>
            {actionLoading ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dlgMoveOpen} onClose={() => setDlgMoveOpen(false)}>
        <DialogTitle>Mover lote a otro negocio</DialogTitle>
        <DialogContent>
          <Typography mb={2}>Mover el lote <strong>{selectedLote?.batch_id}</strong> a:</Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Negocio destino</InputLabel>
            <Select value={moveTargetBiz} label="Negocio destino" onChange={(e) => setMoveTargetBiz(e.target.value)}>
              {(allBusinesses || []).filter((b) => String(b.id) !== String(businessId)).map((b) => (
                <MenuItem key={b.id} value={String(b.id)}>{b.nombre || b.name || `Negocio #${b.id}`}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgMoveOpen(false)} disabled={actionLoading}>Cancelar</Button>
          <Button onClick={handleMoveLote} variant="contained" disabled={!moveTargetBiz || actionLoading}
            sx={{ bgcolor: 'var(--color-primary)', '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' } }}>
            {actionLoading ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function ConfiguracionMain() {
  const { businessId } = useActiveBusiness();
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState({});
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [config, setConfig] = useState({
    articulos_costo_ideal: '',
    insumos_costo_ideal: '',
    compras_alerta_semanas: '',
    ventas_alerta_dias: '',
    divisa: '',
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [alertasInsumos, setAlertasInsumos] = useState([]);
  const [alertasLoading, setAlertasLoading] = useState(false);
  const [alertasTotal, setAlertasTotal] = useState(0);

  const {
    removeBusinessFromState,
    loading: businessesLoading,
    activeId,
    selectBusiness,
    selectDivision,
    items,
    active,
    refetchBusinesses,
  } = useBusiness() || {};

  const { organization, allBusinesses } = useOrganization() || {};

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState({ open: false, title: '', message: '' });

  const showNotice = (title, message) => setNotice({ open: true, title, message });
  const closeNotice = () => setNotice((s) => ({ ...s, open: false }));

  const [dlgGlobal, setDlgGlobal] = useState(null);
  const [dlgEquivOpen, setDlgEquivOpen] = useState(false);
  const [equivTipo, setEquivTipo] = useState('compras');
  const [equivColumnas, setEquivColumnas] = useState([]);

  const notify = useCallback((msg, sev = 'success') => {
    setSnack({ open: true, msg, sev });
    setTimeout(() => setSnack((s) => ({ ...s, open: false })), 3500);
  }, []);

  /* ── Cargar configuración ── */
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
          ventas_alerta_dias: String(props.ventas_alerta_dias ?? ''),
          divisa: String(props.divisa ?? ''),
        });
      } catch (e) {
        console.error('[Config] Error cargando config:', e);
      } finally {
        setConfigLoading(false);
      }
    })();
  }, [businessId]);

  /* ── Guardar configuración ── */
  const saveConfig = useCallback(async (key) => {
    if (!businessId) return;
    if (key === 'articulos_costo_ideal') {
      const val = Number(config[key]);
      if (!Number.isFinite(val) || val <= 0) { notify('Ingresá un % válido mayor a 0', 'error'); return; }
      setSaving((s) => ({ ...s, [key]: true }));
      try {
        let totalOverrides = 0;
        try {
          const pcData = await PriceConfigAPI.getAll(Number(businessId));
          const byArticle = pcData?.byArticle || {};
          const byRubro = pcData?.byRubro || {};
          const byAgrupacion = pcData?.byAgrupacion || {};
          totalOverrides =
            Object.values(byArticle).filter((v) => v?.objetivo != null || v?.precioManual != null).length +
            Object.values(byRubro).filter((v) => v?.objetivo != null).length +
            Object.values(byAgrupacion).filter((v) => v?.objetivo != null).length;
        } catch { totalOverrides = -1; }

        if (totalOverrides !== 0) {
          setSaving((s) => ({ ...s, [key]: false }));
          setDlgGlobal({ val, totalOverrides: totalOverrides === -1 ? '?' : totalOverrides });
          return;
        }
        await BusinessesAPI.update(businessId, { props: { [key]: val } });
        notify('% global de artículos guardado');
      } catch (e) {
        notify('Error al guardar: ' + (e.message || e), 'error');
      } finally {
        setSaving((s) => ({ ...s, [key]: false }));
      }
      return;
    }
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const val = Number(config[key]);
      await BusinessesAPI.update(businessId, { props: { [key]: Number.isFinite(val) ? val : null } });
      notify('Configuración guardada correctamente');
    } catch (e) {
      notify('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }, [businessId, config, notify]);

  /* ── Ejecutar guardado global con overrides ── */
  const executeGlobalSave = useCallback(async (pisarTodo) => {
    if (!businessId || !dlgGlobal) return;
    setSaving((s) => ({ ...s, articulos_costo_ideal: true }));
    setDlgGlobal(null);
    try {
      const val = dlgGlobal.val;

      // 1. Guardar el valor global en props (sin pisar overrides en el backend)
      await BusinessesAPI.update(businessId, {
        props: { articulos_costo_ideal: Number.isFinite(val) ? val : null },
        pisarTodo, // ← el backend solo borra si esto es true
      });

      // 2. Si pisarTodo=true, limpiar overrides de objetivo vía PriceConfig
      if (pisarTodo) {
        await PriceConfigAPI.save(Number(businessId), {
          scope: 'global',
          pisarTodo: true,
          nuevoGlobal: val,
        });
      }

      notify(pisarTodo
        ? '% global guardado y overrides individuales eliminados'
        : '% global guardado — se respetan las configuraciones individuales'
      );

      // 3. Notificación de deshacer
      window.dispatchEvent(new CustomEvent('ui:action', {
        detail: {
          businessId,
          kind: 'global_costo_ideal',
          scope: 'articulo',
          title: '% costo global actualizado',
          message: `Nuevo valor: ${val}%${pisarTodo ? ' — overrides eliminados' : ''}`,
          createdAt: new Date().toISOString(),
          payload: { val, pisarTodo },
        },
      }));

    } catch (e) {
      notify('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      setSaving((s) => ({ ...s, articulos_costo_ideal: false }));
    }
  }, [businessId, dlgGlobal, notify]);

  /* ── Alertas de insumos ── */
  useEffect(() => {
    if (tab !== 1 || !businessId) return;
    setAlertasLoading(true);
    RecetasAPI.getAlertas(Number(businessId))
      .then((res) => { setAlertasInsumos(res?.insumos || []); setAlertasTotal(res?.total || 0); })
      .catch(() => setAlertasInsumos([]))
      .finally(() => setAlertasLoading(false));
  }, [tab, businessId]);

  const abrirEquivalencias = (tipo, cols) => {
    setEquivTipo(tipo);
    setEquivColumnas(cols);
    setDlgEquivOpen(true);
  };

  /* ── Org tab helpers ── */
  const activeBiz = active || null;
  const list = Array.isArray(items) ? items : [];
  const orgBizIds = new Set((allBusinesses || []).map((b) => String(b.id)));
  const outsideOrg = organization && orgBizIds.size > 1 ? list.filter((b) => !orgBizIds.has(String(b.id))) : list;

  const onCreateComplete = async (biz) => {
    setShowCreate(false);
    const bizId = Number(biz?.id);
    if (!Number.isFinite(bizId) || bizId <= 0) { await refetchBusinesses?.(); return; }
    await refetchBusinesses?.();
    const isSubBusiness = biz.created_from === 'from_group';
    if (!isSubBusiness) {
      try {
        const maxiOk = await isMaxiConfigured(bizId);
        if (maxiOk) {
          window.dispatchEvent(new CustomEvent('sync:start', { detail: { bizId } }));
          showNotice('Sincronizando datos', 'Iniciando sincronización automática…');
          const result = await syncAll(bizId, { onProgress: () => { } });
          if (result?.ok) {
            showNotice('Sincronización completa', 'Artículos e insumos sincronizados correctamente');
            try { await ensureTodo(bizId); } catch { }
          }
          window.dispatchEvent(new CustomEvent('sync:completed', { detail: { bizId, ok: !!result?.ok } }));
        } else {
          showNotice('Negocio creado', 'Configurá las credenciales de Maxi para habilitar la sincronización automática');
        }
      } catch { showNotice('Error', 'No se pudo completar la sincronización automática'); }
    } else {
      showNotice('Sub-negocio creado', `"${biz.name}" fue creado correctamente.`);
    }
    try { window.dispatchEvent(new CustomEvent('business:created', { detail: { id: bizId } })); } catch { }
  };

  const handleDeleteBusiness = async (biz) => {
    const id = biz?.id;
    if (!id) return;
    const name = biz?.name || biz?.nombre || `#${id}`;
    if (!window.confirm(`¿Eliminar el local "${name}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      const isActive = Number(activeId) === Number(id);
      await BusinessesAPI.remove(id);
      removeBusinessFromState?.(id);
      if (isActive) {
        const businesses = await BusinessesAPI.listMine();
        if (businesses?.length > 0) {
          await BusinessesAPI.setActive(businesses[0].id);
          window.dispatchEvent(new CustomEvent('business:switched', { detail: { bizId: businesses[0].id } }));
          showNotice('Listo', `Local eliminado. Ahora activo: "${businesses[0].name}"`);
        } else {
          localStorage.removeItem('activeBusinessId');
          await selectBusiness?.(null);
          showNotice('Listo', 'Local eliminado.');
        }
      } else {
        showNotice('Listo', `Local "${name}" eliminado`);
      }
      await refetchBusinesses?.();
      window.dispatchEvent(new CustomEvent('business:deleted', { detail: { id } }));
    } catch (e) {
      showNotice('Error', e?.message || 'No se pudo eliminar el local');
    }
  };

  const themeColor = 'var(--color-primary, #3b82f6)';

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 } }}>

      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <TuneIcon sx={{ color: themeColor, fontSize: 26 }} />
        <Typography variant="h5" fontWeight={800}>Configuración</Typography>
      </Stack>

      {configLoading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" mt={1}>Cargando configuración…</Typography>
        </Stack>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              borderBottom: 1, borderColor: 'divider',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 44 },
              '& .Mui-selected': { color: themeColor },
              '& .MuiTabs-indicator': { bgcolor: themeColor },
            }}
          >
            <Tab icon={<RestaurantMenuIcon fontSize="small" />} iconPosition="start" label="Artículos y ventas" />
            <Tab icon={<ShoppingCartIcon fontSize="small" />} iconPosition="start" label="Insumos y compras" />
            <Tab icon={<PublicIcon fontSize="small" />} iconPosition="start" label="General" />
            <Tab icon={<BusinessIcon fontSize="small" />} iconPosition="start" label="Organización" />
          </Tabs>

          {/* ══════════════════════════════
              TAB 0 — ARTÍCULOS Y VENTAS
          ══════════════════════════════ */}
          <TabPanel value={tab} index={0}>
            <Grid container spacing={2.5}>

              {/* COLUMNA IZQUIERDA: Artículos */}
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5} height="100%">
                  <SectionCard
                    icon={<RestaurantMenuIcon />}
                    title="Artículos — % costo ideal"
                    accent
                  >
                    <CostoIdealSection
                      label="Artículos"
                      value={config.articulos_costo_ideal}
                      onChange={(v) => setConfig((c) => ({ ...c, articulos_costo_ideal: v }))}
                      saving={!!saving.articulos_costo_ideal}
                      onSave={() => saveConfig('articulos_costo_ideal')}
                    />
                  </SectionCard>

                  <SectionCard icon={<CloudUploadIcon />} title="Importar artículos">
                    <Stack spacing={1.5}>
                      <Typography variant="body2" color="text.secondary">
                        Subí artículos directamente desde Lazarillo cuando la sincronización con Maxi sea lenta.
                        Cuando llegue la info de Maxi se valida y empareja automáticamente.
                      </Typography>
                      <ImportPlaceholder
                        tipo="articulos"
                        columnasDemo={['Cod', 'Descripcion', 'PrecioLista', 'Cat', 'UM', 'Stock']}
                        onAbrir={abrirEquivalencias}
                      />
                    </Stack>
                  </SectionCard>
                </Stack>
              </Grid>

              {/* COLUMNA DERECHA: Ventas */}
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5} height="100%">
                  <SectionCard icon={<ReceiptLongIcon />} title="Ventas — alerta de actualización">
                    <Stack spacing={2}>
                      <AlertaConfigSection
                        label="Si no hay ventas registradas hace más de N días, se muestra una alerta indicando que posiblemente falte sincronizar o importar datos."
                        configKey="ventas_alerta_dias"
                        value={config.ventas_alerta_dias}
                        onChange={(v) => setConfig((c) => ({ ...c, ventas_alerta_dias: v }))}
                        saving={!!saving.ventas_alerta_dias}
                        onSave={() => saveConfig('ventas_alerta_dias')}
                        unit="días"
                      />
                      {Number(config.ventas_alerta_dias) > 0 && (
                        <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.78rem' }}>
                          Alerta si no hay ventas en <strong>{config.ventas_alerta_dias} días</strong>
                        </Alert>
                      )}
                    </Stack>
                  </SectionCard>

                  <SectionCard icon={<ReceiptLongIcon />} title="Lotes de ventas importados">
                    <LotesPanel businessId={businessId} lotesTipo="ventas" allBusinesses={allBusinesses} />
                  </SectionCard>

                  <SectionCard icon={<CloudUploadIcon />} title="Importar ventas">
                    <Stack spacing={1.5}>
                      <Typography variant="body2" color="text.secondary">
                        Importá ventas desde archivo cuando Maxi no sincroniza o para cargar datos históricos.
                      </Typography>
                      <ImportPlaceholder
                        tipo="ventas"
                        columnasDemo={['Fecha', 'Art_cod', 'Art_nombre', 'Vendido', 'Precio', 'Importe', 'Mesa_nro']}
                        onAbrir={abrirEquivalencias}
                      />
                    </Stack>
                  </SectionCard>
                </Stack>
              </Grid>
            </Grid>
          </TabPanel>

          {/* ══════════════════════════════
              TAB 1 — INSUMOS Y COMPRAS
          ══════════════════════════════ */}
          <TabPanel value={tab} index={1}>
            <Grid container spacing={2.5}>

              {/* COLUMNA IZQUIERDA: Insumos */}
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5}>
                  <SectionCard icon={<ShoppingCartIcon />} title="Insumos — % costo ideal" accent>
                    <CostoIdealSection
                      label="Insumos"
                      value={config.insumos_costo_ideal}
                      onChange={(v) => setConfig((c) => ({ ...c, insumos_costo_ideal: v }))}
                      saving={!!saving.insumos_costo_ideal}
                      onSave={() => saveConfig('insumos_costo_ideal')}
                    />
                  </SectionCard>

                  <SectionCard icon={<WarningAmberIcon />} title="Insumos con compras vencidas en recetas">
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Insumos usados en recetas activas sin compras en las últimas{' '}
                          <strong>{config.compras_alerta_semanas || 4} semanas</strong>.
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {alertasTotal > 0 && (
                            <Chip label={alertasTotal} size="small"
                              sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, height: 18, fontSize: '0.65rem' }} />
                          )}
                          <Button size="small" variant="text" onClick={() => {
                            setAlertasLoading(true);
                            RecetasAPI.getAlertas(Number(businessId))
                              .then((res) => { setAlertasInsumos(res?.insumos || []); setAlertasTotal(res?.total || 0); })
                              .catch(() => { })
                              .finally(() => setAlertasLoading(false));
                          }} sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                            Actualizar
                          </Button>
                        </Stack>
                      </Stack>

                      {alertasLoading ? (
                        <Stack alignItems="center" py={2}><CircularProgress size={20} /></Stack>
                      ) : alertasInsumos.length === 0 ? (
                        <Alert severity="success" sx={{ py: 0.5, fontSize: '0.78rem' }}>
                          Todos los insumos tienen compras recientes ✓
                        </Alert>
                      ) : (
                        <Stack spacing={0.75}>
                          {alertasInsumos.map((ins) => (
                            <Paper key={ins.insumoId} variant="outlined" sx={{
                              p: 1.25, borderRadius: 1.5, borderColor: '#fbbf24', bgcolor: '#fffbeb',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                              <Box>
                                <Typography variant="body2" fontWeight={600} fontSize="0.82rem">
                                  {ins.nombre}
                                  {ins.unidadMed && (
                                    <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>
                                      ({ins.unidadMed})
                                    </Typography>
                                  )}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {ins.fechaUltimaCompra ? `Última compra: ${ins.fechaUltimaCompra}` : 'Sin compras registradas'}
                                  {' · '}{ins.enRecetas} receta{ins.enRecetas !== 1 ? 's' : ''}
                                </Typography>
                              </Box>
                              <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 18, flexShrink: 0 }} />
                            </Paper>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </SectionCard>

                  <SectionCard icon={<CloudUploadIcon />} title="Importar insumos">
                    <Stack spacing={1.5}>
                      <Typography variant="body2" color="text.secondary">
                        Subí insumos directamente cuando Maxi tarda en sincronizar. Se validan y emparejan al llegar la info oficial.
                      </Typography>
                      <ImportPlaceholder
                        tipo="insumos"
                        columnasDemo={['ID', 'Nombre_producto', 'Unidad', 'Tipo', 'Prov']}
                        onAbrir={abrirEquivalencias}
                      />
                    </Stack>
                  </SectionCard>
                </Stack>
              </Grid>

              {/* COLUMNA DERECHA: Compras */}
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5}>
                  <SectionCard icon={<WarningAmberIcon />} title="Compras — alerta de fecha">
                    <Stack spacing={2}>
                      <AlertaConfigSection
                        label="Si un insumo no fue comprado hace más de N semanas, se resalta en la tabla de artículos y en el resumen de insumos."
                        configKey="compras_alerta_semanas"
                        value={config.compras_alerta_semanas}
                        onChange={(v) => setConfig((c) => ({ ...c, compras_alerta_semanas: v }))}
                        saving={!!saving.compras_alerta_semanas}
                        onSave={() => saveConfig('compras_alerta_semanas')}
                        unit="semanas"
                      />
                      {Number(config.compras_alerta_semanas) > 0 && (
                        <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.78rem' }}>
                          Insumos sin compra hace más de <strong>{config.compras_alerta_semanas} semanas</strong> se mostrarán resaltados
                        </Alert>
                      )}
                    </Stack>
                  </SectionCard>

                  <SectionCard icon={<ReceiptLongIcon />} title="Lotes de compras importados">
                    <LotesPanel businessId={businessId} lotesTipo="compras" allBusinesses={allBusinesses} />
                  </SectionCard>

                  <SectionCard icon={<CloudUploadIcon />} title="Importar compras">
                    <Stack spacing={1.5}>
                      <Typography variant="body2" color="text.secondary">
                        Importá historial de compras desde archivo externo para que los costos de recetas estén siempre actualizados.
                      </Typography>
                      <ImportPlaceholder
                        tipo="compras"
                        columnasDemo={['Fecha_compra', 'Codigo_prod', 'Descripcion', 'Cant', 'Precio_unit', 'Total', 'Proveedor']}
                        onAbrir={abrirEquivalencias}
                      />
                    </Stack>
                  </SectionCard>
                </Stack>
              </Grid>
            </Grid>
          </TabPanel>

          {/* ══════════════════════════════
              TAB 2 — GENERAL
          ══════════════════════════════ */}
          <TabPanel value={tab} index={2}>
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={6}>
                <SectionCard icon={<PublicIcon />} title="Moneda del negocio" accent>
                  <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                      Define la moneda principal de este negocio. Este cambio impacta globalmente:
                      precios mostrados, reportes, cálculos de costos y listas de precios.
                      Si tenés negocios en distintos países podés asignar una moneda diferente a cada uno.
                    </Typography>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <FormControl size="small" sx={{ width: 160 }}>
                        <InputLabel>Moneda</InputLabel>
                        <Select
                          value={config.divisa || ''}
                          label="Moneda"
                          onChange={(e) => setConfig((c) => ({ ...c, divisa: e.target.value }))}
                        >
                          {[
                            { code: 'ARS', label: 'ARS — Peso argentino' },
                            { code: 'USD', label: 'USD — Dólar' },
                            { code: 'EUR', label: 'EUR — Euro' },
                            { code: 'BRL', label: 'BRL — Real brasileño' },
                            { code: 'CLP', label: 'CLP — Peso chileno' },
                            { code: 'PEN', label: 'PEN — Sol peruano' },
                            { code: 'UYU', label: 'UYU — Peso uruguayo' },
                            { code: 'MXN', label: 'MXN — Peso mexicano' },
                            { code: 'COP', label: 'COP — Peso colombiano' },
                          ].map(({ code, label }) => (
                            <MenuItem key={code} value={code}>{label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={saving.divisa ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                        disabled={!!saving.divisa}
                        onClick={async () => {
                          if (!config.divisa) return;
                          setSaving((s) => ({ ...s, divisa: true }));
                          try {
                            await BusinessesAPI.update(businessId, { props: { divisa: config.divisa } });
                            // Disparar evento global para que otros componentes actualicen formato de moneda
                            window.dispatchEvent(new CustomEvent('config:divisa:changed', {
                              detail: { divisa: config.divisa, businessId }
                            }));
                            notify('Moneda guardada — el cambio aplica en toda la app');
                          } catch (e) {
                            notify('Error al guardar: ' + (e.message || e), 'error');
                          } finally {
                            setSaving((s) => ({ ...s, divisa: false }));
                          }
                        }}
                        sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}
                      >
                        {saving.divisa ? 'Guardando…' : 'Guardar'}
                      </Button>
                    </Stack>

                    {config.divisa && (
                      <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem' }}>
                        Moneda activa: <strong>{config.divisa}</strong>. El cambio impacta en precios, reportes y listas de precio de este negocio.
                      </Alert>
                    )}

                    <Divider />

                    <Stack spacing={0.75}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        ¿Por qué puede querer cambiar la moneda?
                      </Typography>
                      {[
                        'Tenés negocios en distintos países con monedas diferentes',
                        'Querés generar una lista de precios alternativa (ej: en USD)',
                        'Cambiaste de país de operación',
                      ].map((item) => (
                        <Stack key={item} direction="row" spacing={0.75} alignItems="flex-start">
                          <CheckCircleIcon sx={{ fontSize: 14, color: themeColor, mt: 0.25, flexShrink: 0 }} />
                          <Typography variant="caption" color="text.secondary">{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </SectionCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <SectionCard icon={<InfoOutlinedIcon />} title="Próximas opciones generales">
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      Estas configuraciones globales están en desarrollo y estarán disponibles próximamente:
                    </Typography>
                    {[
                      'Zona horaria del negocio',
                      'Formato de fecha y hora',
                      'Redondeo de precios por defecto',
                      'Notificaciones y alertas por email',
                    ].map((item) => (
                      <Stack key={item} direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#e2e8f0', flexShrink: 0 }} />
                        <Typography variant="body2" color="text.secondary">{item}</Typography>
                        <Chip label="Próximamente" size="small"
                          sx={{ fontSize: '0.62rem', height: 16, bgcolor: '#f1f5f9', color: '#94a3b8', ml: 'auto' }} />
                      </Stack>
                    ))}
                  </Stack>
                </SectionCard>
              </Grid>
            </Grid>
          </TabPanel>

          {/* ══════════════════════════════
              TAB 3 — ORGANIZACIÓN
          ══════════════════════════════ */}
          <TabPanel value={tab} index={3}>
            <Stack spacing={2.5}>
              {/* Org dashboard si tiene múltiples negocios */}
              {organization && (allBusinesses || []).length > 1 && (
                <SectionCard icon={<BusinessIcon />} title={`Mi organización — ${organization.name || 'Sin nombre'}`}>
                  <OrgDashboard
                    compact
                    onSelectBusiness={async (biz) => {
                      try { await selectBusiness?.(biz.id); } catch { }
                    }}
                  />
                </SectionCard>
              )}

              {/* Mis locales */}
              {!(outsideOrg.length === 0 && organization && orgBizIds.size > 1) && (
                <SectionCard icon={<BusinessIcon />} title="Mis locales">
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setShowCreate(true)}
                        sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}
                      >
                        Nuevo local
                      </Button>
                    </Stack>

                    {businessesLoading ? (
                      <Stack spacing={1.5}>
                        {[1, 2].map((n) => (
                          <Box key={n} sx={{ height: 80, bgcolor: '#f8fafc', borderRadius: 2 }} />
                        ))}
                      </Stack>
                    ) : outsideOrg.length === 0 ? (
                      <Box sx={{ border: '1px dashed #e5e7eb', borderRadius: 2, p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Aún no tenés locales. Creá el primero.</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                        {outsideOrg.map((biz) => (
                          <BusinessCard
                            key={biz.id}
                            biz={biz}
                            activeId={activeId}
                            onEdit={setEditing}
                            onDelete={handleDeleteBusiness}
                            showNotice={(msg) => showNotice('Aviso', msg)}
                          />
                        ))}
                      </Box>
                    )}
                  </Stack>
                </SectionCard>
              )}

              {/* Sucursales */}
              {activeId && (
                <SectionCard icon={<BusinessIcon />} title={`Sucursales${activeBiz?.name ? ` de ${activeBiz.name}` : ''}`}>
                  <SucursalesSection />
                </SectionCard>
              )}
            </Stack>
          </TabPanel>
        </>
      )}

      {/* ── Snackbar ── */}
      {snack.open && (
        <Alert
          severity={snack.sev}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, boxShadow: 4, minWidth: 280 }}
        >
          {snack.msg}
        </Alert>
      )}

      {/* ── Modal equivalencias ── */}
      <EquivalenciasModal
        open={dlgEquivOpen}
        onClose={() => setDlgEquivOpen(false)}
        uploadedColumns={equivColumnas}
        tipoImportacion={equivTipo}
        onConfirm={(mapping) => {
          console.log('[Lazarillo] Mapping confirmado:', mapping);
          setDlgEquivOpen(false);
          notify('Equivalencias guardadas. Podés proceder con la importación.');
        }}
      />

      {/* ── Diálogo % global con overrides ── */}
      <Dialog open={!!dlgGlobal} onClose={() => setDlgGlobal(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Cambiar % costo ideal global</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Hay <strong>{dlgGlobal?.totalOverrides}</strong> artículo{dlgGlobal?.totalOverrides !== 1 ? 's' : ''} o grupos con configuración individual.
          </Typography>
          <Typography variant="body2" color="text.secondary">¿Qué querés hacer con esas configuraciones individuales?</Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 2, pb: 2 }}>
          <Button onClick={() => executeGlobalSave(false)} variant="contained" size="small"
            sx={{ textTransform: 'none', justifyContent: 'flex-start', bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
            Respetar las individuales — solo cambia el global como fallback
          </Button>
          <Button onClick={() => executeGlobalSave(true)} variant="outlined" size="small" color="warning"
            sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
            Pisar todo — eliminar overrides y usar solo el global
          </Button>
          <Button onClick={() => setDlgGlobal(null)} variant="text" size="small" color="inherit"
            sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modals org ── */}
      <BusinessCreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreateComplete={onCreateComplete} />
      <BusinessEditModal
        open={!!editing}
        business={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refetchBusinesses?.();
          try { window.dispatchEvent(new Event('business:updated')); } catch { }
        }}
      />
      <SyncDialog open={notice.open} title={notice.title} message={notice.message} onClose={closeNotice} />
    </Box>
  );
}