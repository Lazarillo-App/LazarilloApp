/* eslint-disable no-unused-vars */
// src/paginas/ConfiguracionMain.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Tabs, Tab, Typography, Stack, TextField, Button,
  Divider, Alert, CircularProgress, Chip, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Tooltip,
  Paper, InputAdornment, Stepper, Step, StepLabel,
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { useActiveBusiness, useBusiness } from '../context/BusinessContext';
import { useOrganization } from '../context/OrganizationContext';
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
   MODAL: Vista previa de lote (mini Excel read-only)
═══════════════════════════════════════════════ */
function LotePreviewModal({ open, onClose, lote, businessId, previewEndpoint }) {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null); // { columns: [], rows: [] }
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !lote) return;
    setLoading(true);
    setError('');
    setPreviewData(null);

    fetch(previewEndpoint || `${BASE}/purchases/batches/${lote.batch_id}/preview`, {
      headers: authHeaders(businessId),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.columns && data?.rows) {
          setPreviewData(data);
        } else {
          setError('No se pudo obtener la vista previa del lote.');
        }
      })
      .catch(() => setError('Error al cargar la vista previa.'))
      .finally(() => setLoading(false));
  }, [open, lote, businessId]);

  const themeColor = 'var(--color-primary, #3b82f6)';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '80vh' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <VisibilityIcon sx={{ color: themeColor }} />
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
              Vista previa del lote
            </Typography>
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
            <Typography variant="body2" color="text.secondary" mt={1}>
              Cargando datos del lote…
            </Typography>
          </Stack>
        )}

        {error && !loading && (
          <Box p={3}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {previewData && !loading && (
          <Box>
            {/* Meta info header */}
            <Stack
              direction="row"
              spacing={2}
              sx={{
                px: 3, py: 1.5,
                bgcolor: `${themeColor}08`,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Chip
                size="small"
                label={`${previewData.columns?.length ?? 0} columnas`}
                sx={{ bgcolor: `${themeColor}15`, color: themeColor, fontWeight: 600 }}
              />
              <Chip
                size="small"
                label={`${lote?.total_items ?? lote?.count ?? '?'} registros totales`}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important', display: 'flex', alignItems: 'center' }}>
                Mostrando primeras {previewData.rows?.length ?? 0} filas
              </Typography>
            </Stack>

            {/* Table */}
            <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        // stickyHeader en MUI ignora bgcolor y usa el fondo del tema.
                        // backgroundColor con !important lo fuerza correctamente.
                        backgroundColor: '#f1f5f9 !important',
                        color: '#64748b !important',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        width: 48,
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '2px solid #e2e8f0 !important',
                        textAlign: 'center',
                      }}
                    >
                      #
                    </TableCell>
                    {(previewData.columns || []).map((col, i) => (
                      <TableCell
                        key={i}
                        sx={{
                          backgroundColor: '#f1f5f9 !important',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          whiteSpace: 'nowrap',
                          borderRight: '1px solid #e2e8f0',
                          borderBottom: '2px solid #e2e8f0 !important',
                          py: 1,
                          px: 1.5,
                          color: `${themeColor} !important`,
                          letterSpacing: '0.03em',
                        }}
                      >
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(previewData.rows || []).map((row, ri) => (
                    <TableRow
                      key={ri}
                      sx={{
                        bgcolor: ri % 2 === 0 ? '#fff' : '#fafafa',
                        '&:hover': { bgcolor: `${themeColor}08` },
                      }}
                    >
                      <TableCell
                        sx={{
                          color: 'text.disabled',
                          fontSize: '0.7rem',
                          textAlign: 'center',
                          borderRight: '1px solid #e2e8f0',
                          py: 0.8,
                          px: 1,
                          fontFamily: 'monospace',
                        }}
                      >
                        {ri + 1}
                      </TableCell>
                      {(previewData.columns || []).map((col, ci) => (
                        <TableCell
                          key={ci}
                          sx={{
                            fontSize: '0.8rem',
                            borderRight: '1px solid #e2e8f0',
                            py: 0.8,
                            px: 1.5,
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: row[col] === null || row[col] === '' ? 'text.disabled' : 'text.primary',
                            fontStyle: row[col] === null || row[col] === '' ? 'italic' : 'normal',
                          }}
                        >
                          {row[col] === null || row[col] === undefined
                            ? '—'
                            : String(row[col])
                          }
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

// Definición de columnas requeridas por tipo
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
    { key: 'insumo_nombre', label: 'Nombre del insumo', required: false, description: 'Nombre del insumo (alternativa al código)' },
    { key: 'cantidad', label: 'Cantidad', required: true, description: 'Cantidad comprada' },
    { key: 'precio_unitario', label: 'Precio unitario', required: true, description: 'Precio por unidad de medida' },
    { key: 'proveedor', label: 'Proveedor', required: false, description: 'Nombre del proveedor' },
    { key: 'nro_factura', label: 'Nº Factura', required: false, description: 'Número de comprobante' },
  ],
  ventas: [
    { key: 'fecha', label: 'Fecha', required: true, description: 'Fecha de la venta' },
    { key: 'articulo_codigo', label: 'Código de artículo', required: true, description: 'Código del artículo vendido' },
    { key: 'articulo_nombre', label: 'Nombre del artículo', required: false, description: 'Nombre (alternativa al código)' },
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

  // Auto-mapear columnas con nombres similares al abrir
  useEffect(() => {
    if (!open) return;
    const autoMap = {};
    requiredCols.forEach(req => {
      // Buscar coincidencia exacta o parcial (case-insensitive)
      const match = uploadedColumns.find(c =>
        c.toLowerCase() === req.key.toLowerCase() ||
        c.toLowerCase() === req.label.toLowerCase() ||
        c.toLowerCase().includes(req.key.toLowerCase()) ||
        req.key.toLowerCase().includes(c.toLowerCase().split(' ')[0])
      );
      if (match) autoMap[req.key] = match;
    });
    setMapping(autoMap);
  }, [open, tipoImportacion, uploadedColumns]);

  const missingRequired = requiredCols.filter(r => r.required && !mapping[r.key]);
  const canConfirm = missingRequired.length === 0;

  const tipoLabel = {
    articulos: 'Artículos',
    insumos: 'Insumos',
    compras: 'Compras',
    ventas: 'Ventas',
  }[tipoImportacion] || tipoImportacion;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
          <AutoFixHighIcon sx={{ color: themeColor, fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Lazarillo — Equivalencias de columnas
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Importación de {tipoLabel}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent>
        {/* Intro */}
        <Paper
          variant="outlined"
          sx={{
            p: 2, mb: 3, borderRadius: 2,
            bgcolor: `${themeColor}06`,
            borderColor: `${themeColor}30`,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <InfoOutlinedIcon sx={{ color: themeColor, mt: 0.2, flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Tu archivo tiene <strong>{uploadedColumns.length} columnas</strong>. Indicá a qué campo
              de Lazarillo corresponde cada una. Los campos con <strong style={{ color: '#ef4444' }}>*</strong> son
              obligatorios. Las columnas ya mapeadas automáticamente aparecen resaltadas — verificalas antes de confirmar.
            </Typography>
          </Stack>
        </Paper>

        {/* Columnas del archivo (chips) */}
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Columnas detectadas en tu archivo
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.8} mt={1} mb={3}>
          {uploadedColumns.map(col => {
            const isMapped = Object.values(mapping).includes(col);
            return (
              <Chip
                key={col}
                label={col}
                size="small"
                sx={{
                  bgcolor: isMapped ? `${themeColor}18` : '#f1f5f9',
                  color: isMapped ? themeColor : 'text.secondary',
                  fontWeight: isMapped ? 700 : 400,
                  border: isMapped ? `1px solid ${themeColor}40` : '1px solid #e2e8f0',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                }}
              />
            );
          })}
        </Stack>

        {/* Tabla de mapeo */}
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Campos requeridos por Lazarillo
        </Typography>
        <Stack spacing={1.5} mt={1.5}>
          {requiredCols.map(req => {
            const val = mapping[req.key] || '';
            const isAutoMapped = !!val;
            const isOk = !!val;
            return (
              <Paper
                key={req.key}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  borderColor: isOk ? `${themeColor}40` : req.required ? '#fca5a520' : 'divider',
                  bgcolor: isOk ? `${themeColor}05` : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  {/* Info del campo */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="body2" fontWeight={700}>
                        {req.label}
                      </Typography>
                      {req.required && (
                        <Typography component="span" sx={{ color: '#ef4444', fontWeight: 800, fontSize: '0.9rem' }}>
                          *
                        </Typography>
                      )}
                      {!req.required && (
                        <Chip label="Opcional" size="small"
                          sx={{ fontSize: '0.65rem', height: 16, bgcolor: '#f1f5f9', color: 'text.secondary' }} />
                      )}
                      {isAutoMapped && (
                        <Chip label="Auto" size="small"
                          sx={{ fontSize: '0.65rem', height: 16, bgcolor: `${themeColor}15`, color: themeColor, fontWeight: 700 }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {req.description}
                    </Typography>
                  </Box>

                  {/* Select de mapeo */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 220 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Columna del archivo</InputLabel>
                      <Select
                        value={val}
                        label="Columna del archivo"
                        onChange={e => setMapping(m => ({ ...m, [req.key]: e.target.value }))}
                        sx={{
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: isOk ? `${themeColor}60` : undefined,
                          }
                        }}
                      >
                        <MenuItem value=""><em>— No mapear —</em></MenuItem>
                        {uploadedColumns.map(col => (
                          <MenuItem key={col} value={col}>{col}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {isOk
                      ? <CheckCircleIcon sx={{ color: '#22c55e', flexShrink: 0 }} />
                      : req.required
                        ? <ErrorIcon sx={{ color: '#ef444460', flexShrink: 0 }} />
                        : <Box sx={{ width: 24 }} />
                    }
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {/* Resumen */}
        {missingRequired.length > 0 && (
          <Alert severity="error" sx={{ mt: 2, py: 0.5 }}>
            Faltan mapear los campos obligatorios: <strong>{missingRequired.map(r => r.label).join(', ')}</strong>
          </Alert>
        )}
        {canConfirm && (
          <Alert severity="success" sx={{ mt: 2, py: 0.5 }}>
            ¡Todo listo! Todos los campos obligatorios están mapeados. Podés confirmar la importación.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button
          onClick={() => onConfirm && onConfirm(mapping)}
          variant="contained"
          disabled={!canConfirm}
          startIcon={<CheckCircleIcon />}
          sx={{
            bgcolor: 'var(--color-primary)',
            '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' },
          }}
        >
          Confirmar importación
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════
   SUB-COMPONENTE: Panel de lotes reutilizable
   (usado tanto en Compras como en Ventas)
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
  const [notify, setNotify] = useState(null); // {msg, sev}

  const themeColor = 'var(--color-primary, #3b82f6)';

  // endpoint según tipo
  const endpoint = lotesTipo === 'ventas'
    ? `${BASE}/sales/batches`
    : `${BASE}/purchases/batches`;

  const loadLotes = useCallback(async () => {
    if (!businessId) return;
    setLotesLoading(true);
    try {
      const res = await fetch(endpoint, { headers: authHeaders(businessId) });
      const data = await res.json().catch(() => ({}));
      setLotes(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      console.warn(`[Config] Error cargando lotes ${lotesTipo}:`, e.message);
      setLotes([]);
    } finally {
      setLotesLoading(false);
    }
  }, [businessId, endpoint, lotesTipo]);

  useEffect(() => { loadLotes(); }, [loadLotes]);

  const showNotify = (msg, sev = 'success') => {
    setNotify({ msg, sev });
    setTimeout(() => setNotify(null), 3000);
  };

  const handleDeleteLote = async () => {
    if (!selectedLote) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${endpoint}/${selectedLote.batch_id}`, {
        method: 'DELETE',
        headers: authHeaders(businessId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showNotify(`Lote ${selectedLote.batch_id} eliminado`);
      setDlgDeleteOpen(false);
      setSelectedLote(null);
      await loadLotes();
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
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <ReceiptLongIcon sx={{ color: themeColor }} />
              <Typography variant="subtitle1" fontWeight={700}>
                Lotes de importación
              </Typography>
              {lotes.length > 0 && (
                <Chip
                  size="small"
                  label={lotes.length}
                  sx={{ bgcolor: `${themeColor}15`, color: themeColor, fontWeight: 700 }}
                />
              )}
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
            {lotesTipo === 'ventas'
              ? 'Cada archivo importado genera un lote. Podés ver una vista previa, eliminar o mover el lote a otro negocio.'
              : 'Cada importación genera un lote con ID único (fecha+hora). Podés ver una vista previa de los datos, eliminar un lote completo o moverlo a otro negocio.'
            }
          </Typography>

          {notify && (
            <Alert severity={notify.sev} sx={{ py: 0.5 }}>{notify.msg}</Alert>
          )}

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
                    <TableCell sx={{ fontWeight: 700 }}>
                      {lotesTipo === 'ventas' ? 'Archivo' : 'ID de lote'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Fecha importación</TableCell>
                    {lotesTipo === 'ventas' && (
                      <TableCell sx={{ fontWeight: 700 }}>Período</TableCell>
                    )}
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Registros</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Negocio</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lotes.map((lote) => (
                    <TableRow key={lote.batch_id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={{ fontSize: '0.82rem', maxWidth: 200 }}>
                        {lotesTipo === 'ventas' ? (
                          <Stack>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 180 }}>
                              {lote.original_name || lote.batch_id}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              #{lote.batch_id}
                            </Typography>
                          </Stack>
                        ) : (
                          <span style={{ fontFamily: 'monospace' }}>{lote.batch_id}</span>
                        )}
                      </TableCell>
                      <TableCell>{fmtDate(lote.created_at || lote.fecha)}</TableCell>
                      {lotesTipo === 'ventas' && (
                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {lote.date_from && lote.date_to
                            ? `${String(lote.date_from).slice(0, 10).split('-').reverse().join('/')} → ${String(lote.date_to).slice(0, 10).split('-').reverse().join('/')}`
                            : '—'
                          }
                        </TableCell>
                      )}
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
                          {/* Vista previa */}
                          <Tooltip title="Vista previa del lote">
                            <IconButton
                              size="small"
                              onClick={() => { setSelectedLote(lote); setDlgPreviewOpen(true); }}
                              sx={{ color: '#6366f1' }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Mover */}
                          <Tooltip title="Mover a otro negocio">
                            <IconButton
                              size="small"
                              onClick={() => { setSelectedLote(lote); setDlgMoveOpen(true); }}
                              sx={{ color: themeColor }}
                            >
                              <DriveFileMoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Eliminar */}
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

      {/* Modal: Vista previa */}
      <LotePreviewModal
        open={dlgPreviewOpen}
        onClose={() => { setDlgPreviewOpen(false); setSelectedLote(null); }}
        lote={selectedLote}
        businessId={businessId}
        previewEndpoint={selectedLote ? `${endpoint}/${selectedLote.batch_id}/preview` : undefined}
      />

      {/* Dialog: confirmar eliminación */}
      <Dialog open={dlgDeleteOpen} onClose={() => setDlgDeleteOpen(false)}>
        <DialogTitle>Eliminar lote de {lotesTipo}</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar el lote <strong>{selectedLote?.batch_id}</strong>?
            Esta acción eliminará <strong>todos los registros</strong> de esa importación y no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgDeleteOpen(false)} disabled={actionLoading}>Cancelar</Button>
          <Button onClick={handleDeleteLote} variant="contained" color="error" disabled={actionLoading}>
            {actionLoading ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: mover lote */}
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
    </>
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
    ventas_alerta_dias: '',
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [alertasInsumos, setAlertasInsumos] = useState([]);
  const [alertasLoading, setAlertasLoading] = useState(false);
  const [alertasTotal, setAlertasTotal] = useState(0);

  // Diálogo de confirmación al guardar % global
  const [dlgGlobal, setDlgGlobal] = useState(null); // { val, hasOverrides, totalOverrides }

  // Estado para modal de equivalencias (demo — en producción se abre al cargar un archivo)
  const [dlgEquivOpen, setDlgEquivOpen] = useState(false);
  const [equivTipo, setEquivTipo] = useState('compras');
  // Columnas de ejemplo que vendría del archivo cargado
  const [equivColumnas, setEquivColumnas] = useState([]);

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
          ventas_alerta_dias: String(props.ventas_alerta_dias ?? ''),
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

    // Para el % global de artículos: verificar si existen overrides individuales
    // Si hay, mostrar diálogo de confirmación antes de guardar
    if (key === 'articulos_costo_ideal') {
      const val = Number(config[key]);
      if (!Number.isFinite(val) || val <= 0) {
        notify('Ingresá un % válido mayor a 0', 'error');
        return;
      }

      setSaving(s => ({ ...s, [key]: true }));
      try {
        // Consultar overrides existentes para decidir si mostrar diálogo
        let totalOverrides = 0;
        try {
          const pcData = await PriceConfigAPI.getAll(Number(businessId));
          const byArticle   = pcData?.byArticle   || {};
          const byRubro     = pcData?.byRubro     || {};
          const byAgrupacion = pcData?.byAgrupacion || {};

          // Contar cualquier configuración individual activa
          const artConOverride = Object.values(byArticle).filter(
            v => v?.objetivo != null || v?.precioManual != null
          ).length;
          const rubroConObjetivo = Object.values(byRubro).filter(
            v => v?.objetivo != null
          ).length;
          const agrupConObjetivo = Object.values(byAgrupacion).filter(
            v => v?.objetivo != null
          ).length;

          totalOverrides = artConOverride + rubroConObjetivo + agrupConObjetivo;
          console.log('[saveConfig global] overrides detectados:', { artConOverride, rubroConObjetivo, agrupConObjetivo });
        } catch (e) {
          // Si falla el fetch de overrides, asumir que hay para no pisar sin querer
          console.warn('[saveConfig global] no se pudo consultar overrides, asumiendo que hay', e.message);
          totalOverrides = -1; // Valor centinela → forzar diálogo
        }

        if (totalOverrides !== 0) {
          // Mostrar diálogo: el usuario decide si respetar individuales o pisar todo
          setSaving(s => ({ ...s, [key]: false }));
          setDlgGlobal({
            val,
            totalOverrides: totalOverrides === -1 ? '?' : totalOverrides,
          });
          return;
        }

        // Sin overrides → guardar directo sin preguntar
        const patch = { props: { [key]: val } };
        await BusinessesAPI.update(businessId, patch);
        notify('% global de artículos guardado');
      } catch (e) {
        notify('Error al guardar: ' + (e.message || e), 'error');
      } finally {
        setSaving(s => ({ ...s, [key]: false }));
      }
      return;
    }

    // Para otros campos (insumos, compras, ventas) → guardar directo
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

  /* ── Ejecutar guardado global confirmado ── */
  const executeGlobalSave = useCallback(async (pisarTodo) => {
    if (!businessId || !dlgGlobal) return;
    setSaving(s => ({ ...s, articulos_costo_ideal: true }));
    setDlgGlobal(null);
    try {
      const val = dlgGlobal.val;
      const patch = { props: { articulos_costo_ideal: Number.isFinite(val) ? val : null } };
      await BusinessesAPI.update(businessId, patch);
      if (pisarTodo) {
        // Limpiar todos los overrides individuales de objetivo para que el global sea el único
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
    } catch (e) {
      notify('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      setSaving(s => ({ ...s, articulos_costo_ideal: false }));
    }
  }, [businessId, dlgGlobal, notify]);

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

  const themeColor = 'var(--color-primary, #3b82f6)';

  /* ── Helper: abrir modal de equivalencias con columnas simuladas ── */
  /* En producción este handler se llama al cargar un archivo (no MaxiRest)  */
  const abrirEquivalencias = (tipo, columnasDelArchivo) => {
    setEquivTipo(tipo);
    setEquivColumnas(columnasDelArchivo);
    setDlgEquivOpen(true);
  };

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

              {/* Botón demo: abrir equivalencias de Artículos */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderStyle: 'dashed' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>
                      Importar artículos desde archivo externo
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Al cargar un archivo no-MaxiRest, Lazarillo te guiará para mapear las columnas.
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AutoFixHighIcon />}
                    onClick={() => abrirEquivalencias('articulos', ['Cod', 'Descripcion', 'PrecioLista', 'Cat', 'UM', 'Stock'])}
                    sx={{ borderColor: themeColor, color: themeColor, whiteSpace: 'nowrap' }}
                  >
                    Ver equivalencias
                  </Button>
                </Stack>
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
                        .catch(() => { })
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

              {/* Botón demo: abrir equivalencias de Insumos */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderStyle: 'dashed' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>
                      Importar insumos desde archivo externo
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Al cargar un archivo no-MaxiRest, Lazarillo te guiará para mapear las columnas.
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AutoFixHighIcon />}
                    onClick={() => abrirEquivalencias('insumos', ['ID', 'Nombre_producto', 'Unidad', 'Tipo', 'Prov'])}
                    sx={{ borderColor: themeColor, color: themeColor, whiteSpace: 'nowrap' }}
                  >
                    Ver equivalencias
                  </Button>
                </Stack>
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
              <LotesPanel
                businessId={businessId}
                lotesTipo="compras"
                allBusinesses={allBusinesses}
              />

              {/* Botón demo: equivalencias compras */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderStyle: 'dashed' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>
                      Importar compras desde archivo externo
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Al cargar un archivo no-MaxiRest, Lazarillo te guiará para mapear las columnas.
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AutoFixHighIcon />}
                    onClick={() => abrirEquivalencias('compras', ['Fecha_compra', 'Codigo_prod', 'Descripcion', 'Cant', 'Precio_unit', 'Total', 'Proveedor'])}
                    sx={{ borderColor: themeColor, color: themeColor, whiteSpace: 'nowrap' }}
                  >
                    Ver equivalencias
                  </Button>
                </Stack>
              </Paper>
            </Stack>
          </TabPanel>

          {/* ─── VENTAS ─── */}
          <TabPanel value={tab} index={3}>
            <Stack spacing={3}>
              {/* Alerta de días sin ventas */}
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <WarningAmberIcon sx={{ color: '#f59e0b' }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Alerta de actualización de ventas
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Si no hay ventas registradas hace más de N días, se mostrará una alerta
                    indicando que posiblemente falte sincronizar o importar datos de ventas.
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      label="Días sin ventas"
                      type="number"
                      size="small"
                      value={config.ventas_alerta_dias}
                      onChange={(e) => setConfig(c => ({ ...c, ventas_alerta_dias: e.target.value }))}
                      inputProps={{ min: 1, max: 365, step: 1 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">días</InputAdornment>,
                      }}
                      sx={{ width: 200 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={saving.ventas_alerta_dias ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                      onClick={() => saveConfig('ventas_alerta_dias')}
                      disabled={!!saving.ventas_alerta_dias}
                      sx={{
                        bgcolor: 'var(--color-primary)',
                        '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' },
                      }}
                    >
                      {saving.ventas_alerta_dias ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </Stack>
                  {config.ventas_alerta_dias > 0 && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                      Si no hay ventas en los últimos <strong>{config.ventas_alerta_dias} días</strong>, se mostrará una alerta de datos desactualizados.
                    </Alert>
                  )}
                </Stack>
              </Paper>

              {/* Lotes de ventas */}
              <LotesPanel
                businessId={businessId}
                lotesTipo="ventas"
                allBusinesses={allBusinesses}
              />

              {/* Botón demo: equivalencias ventas */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderStyle: 'dashed' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>
                      Importar ventas desde archivo externo
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Al cargar un archivo no-MaxiRest, Lazarillo te guiará para mapear las columnas.
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AutoFixHighIcon />}
                    onClick={() => abrirEquivalencias('ventas', ['Fecha', 'Art_cod', 'Art_nombre', 'Vendido', 'Precio', 'Importe', 'Mesa_nro'])}
                    sx={{ borderColor: themeColor, color: themeColor, whiteSpace: 'nowrap' }}
                  >
                    Ver equivalencias
                  </Button>
                </Stack>
              </Paper>
            </Stack>
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

      {/* Modal global de equivalencias */}
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

      {/* ── Diálogo confirmación cambio de % global ── */}
      <Dialog open={!!dlgGlobal} onClose={() => setDlgGlobal(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
          Cambiar % costo ideal global
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Hay <strong>{dlgGlobal?.totalOverrides}</strong> artículo{dlgGlobal?.totalOverrides !== 1 ? 's' : ''} o
            grupos con configuración individual (objetivo % o precio manual).
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ¿Qué querés hacer con esas configuraciones individuales?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 2, pb: 2 }}>
          <Button
            onClick={() => executeGlobalSave(false)}
            variant="contained"
            size="small"
            sx={{ textTransform: 'none', justifyContent: 'flex-start',
              bgcolor: 'var(--color-primary)',
              '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' }
            }}
          >
            Respetar las individuales — solo cambia el global como fallback
          </Button>
          <Button
            onClick={() => executeGlobalSave(true)}
            variant="outlined"
            size="small"
            color="warning"
            sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Pisar todo — eliminar overrides individuales y usar solo el global
          </Button>
          <Button
            onClick={() => setDlgGlobal(null)}
            variant="text" size="small" color="inherit"
            sx={{ textTransform: 'none' }}
          >
            Cancelar — no cambiar nada
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}