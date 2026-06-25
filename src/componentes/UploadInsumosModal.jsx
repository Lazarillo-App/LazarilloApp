// src/componentes/UploadInsumosModal.jsx
// Importador inteligente con vista previa y detección de columnas
// Sirve para artículos e insumos (prop tipo = 'insumos' | 'articulos')
import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Alert, Box, Typography, IconButton, Chip,
  Table, TableHead, TableBody, TableRow, TableCell,
  Select, MenuItem, FormControl, LinearProgress, Tooltip,
  Stack, Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { BASE } from '../servicios/apiBase';

// ─── Definición de campos por tipo ───────────────────────────────────────────
const CAMPOS = {
  insumos: {
    requeridos: [
      { key: 'nombre', label: 'Nombre', desc: 'Nombre del insumo' },
    ],
    opcionales: [
      { key: 'codigo', label: 'Código', desc: 'Código externo (Maxi, etc.)' },
      { key: 'rubro', label: 'Rubro', desc: 'Categoría del insumo' },
      { key: 'unidad', label: 'Unidad de medida', desc: 'kg, gr, lt, u, etc.' },
      { key: 'precio', label: 'Precio', desc: 'Precio de referencia' },
      { key: 'elaborado', label: 'Elaborado', desc: 'Si/No — si se produce internamente' },
    ],
  },
  articulos: {
    requeridos: [
      { key: 'nombre', label: 'Nombre', desc: 'Nombre del artículo' },
    ],
    opcionales: [
      { key: 'codigo', label: 'Código', desc: 'Código externo (Maxi, etc.)' },
      { key: 'rubro', label: 'Rubro', desc: 'Categoría' },
      { key: 'subrubro', label: 'Subrubro', desc: 'Subcategoría' },
      { key: 'precio', label: 'Precio', desc: 'Precio de venta' },
    ],
  },
  ventas: {
    requeridos: [
      { key: 'fecha', label: 'Fecha', desc: 'Fecha de la venta (YYYY-MM-DD o DD/MM/YYYY)' },
      { key: 'codigo', label: 'Código', desc: 'Código del artículo vendido' },
      { key: 'unidades', label: 'Unidades', desc: 'Cantidad vendida' },
      { key: 'importe', label: 'Importe', desc: 'Monto total de la venta' },
    ],
    opcionales: [
      { key: 'nombre', label: 'Nombre artículo', desc: 'Nombre descriptivo (no requerido)' },
      { key: 'costo', label: 'Costo', desc: 'Costo unitario' },
      { key: 'neto', label: 'Neto', desc: 'Importe neto sin impuestos' },
    ],
  },
  compras: {
    requeridos: [
      { key: 'fecha', label: 'Fecha', desc: 'Fecha de la compra' },
      { key: 'codigo', label: 'Código', desc: 'Código del insumo comprado' },
      { key: 'cantidad', label: 'Cantidad', desc: 'Cantidad comprada' },
      { key: 'importe', label: 'Importe', desc: 'Monto total de la compra' },
    ],
    opcionales: [
      { key: 'nombre', label: 'Nombre', desc: 'Nombre del insumo' },
      { key: 'proveedor', label: 'Proveedor', desc: 'Nombre del proveedor' },
      { key: 'precio', label: 'Precio unit.', desc: 'Precio por unidad' },
      { key: 'medida', label: 'Medida', desc: 'Unidad de medida' },
    ],
  },
};

const ALIASES = {
  nombre: ['nombre', 'name', 'descripcion', 'description', 'producto', 'insumo', 'articulo', 'item', 'article_name'],
  codigo: ['codigo', 'code', 'cod', 'sku', 'id', 'codigomaxi', 'codigo_maxi', 'codigoexterno', 'article_id', 'codrui', 'cod_rui'],
  rubro: ['rubro', 'categoria', 'category', 'tipo', 'grupo', 'group', 'family', 'cod_ru', 'codrubro', 'cod_rubro'],
  subrubro: ['subrubro', 'subcategoria', 'subcategory', 'subgrupo', 'subgroup'],
  unidad: ['unidad', 'medida', 'um', 'unidadmedida', 'unidad_med', 'unidadmed', 'unit', 'medida'],
  precio: ['precio', 'price', 'precioventa', 'precio_venta', 'precioref', 'precio_ref', 'costo', 'cost', 'importe', 'p_prom'],
  elaborado: ['elaborado', 'eselaborado', 'es_elaborado', 'elaborated'],
  // Ventas
  fecha: ['fecha', 'date', 'fecha_venta', 'fechaventa', 'dia', 'day', 'ult_compra', 'ultcompra', 'ultima_compra'],
  unidades: ['unidades', 'qty', 'quantity', 'cant', 'cantidad_vendida', 'cantidadvendida', 'unid'],
  importe: ['importe', 'amount', 'total', 'monto', 'p_total', 'neto', 'subtotal'],
  // Compras
  cantidad: ['cantidad', 'qty', 'quantity', 'cant', 'unidades'],
  proveedor: ['proveedor', 'supplier', 'prov'],
  medida: ['medida', 'unidad', 'um', 'unit'],
};

function normalizeKey(k) {
  return String(k || '').toLowerCase().replace(/[\s_\-.]/g, '');
}

function detectarColumna(colName) {
  const norm = normalizeKey(colName);
  for (const [campo, aliases] of Object.entries(ALIASES)) {
    if (aliases.some(a => normalizeKey(a) === norm || norm.startsWith(normalizeKey(a)))) {
      return campo;
    }
  }
  return null;
}

async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return { headers: [], rows: [] };
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1, 6).map(line => {
      const vals = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });
    return { headers, rows };
  }
  // Excel — extraer headers leyendo el archivo en el servidor
  // Mandamos el archivo al backend para que nos devuelva solo las columnas
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    try {
      const token = localStorage.getItem('token') || '';
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch(`${BASE}/businesses/upload/preview-headers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (r.ok) {
        const d = await r.json();
        const headers = Array.isArray(d.headers) ? d.headers : [];
        return { headers, rows: d.rows || [], serverOnly: false };
      }
    } catch { /* ignorar, caer a serverOnly */ }
    return { headers: [], rows: [], serverOnly: true };
  }
  return { headers: [], rows: [], serverOnly: true };
}

function ColChip({ estado, label }) {
  const MAP = {
    ok: { color: 'success', icon: '✓' },
    falta: { color: 'error', icon: '✗' },
    extra: { color: 'default', icon: '~' },
    mapeada: { color: 'warning', icon: '↔' },
  };
  const { color, icon } = MAP[estado] || MAP.extra;
  return (
    <Chip size="small" label={`${icon} ${label}`} color={color}
      sx={{ fontSize: '0.72rem', height: 22, fontWeight: estado === 'falta' ? 700 : 400 }} />
  );
}

export default function UploadInsumosModal({
  open, onClose, businessId, onSuccess,
  tipo = 'insumos',
}) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const camposConfig = CAMPOS[tipo] || CAMPOS.insumos;
  const todosCampos = [...camposConfig.requeridos, ...camposConfig.opcionales];
  const tipoLabel = tipo === 'articulos' ? 'artículos' : 'insumos';

  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [fileRubros, setFileRubros] = useState(null);  // solo para tipo === 'insumos'
  const [preview, setPreview] = useState(null);
  const [mapeo, setMapeo] = useState({});
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const analisis = useMemo(() => {
    if (!preview) return null;
    const headers = preview.headers || [];

    const autoMapeo = {};
    headers.forEach(h => {
      const campo = detectarColumna(h);
      if (campo && !autoMapeo[campo]) autoMapeo[campo] = h;
    });

    const mapeoFinal = { ...autoMapeo, ...mapeo };

    const estadoCampos = todosCampos.map(c => ({
      ...c,
      columna: mapeoFinal[c.key] || null,
      estado: mapeoFinal[c.key]
        ? (mapeo[c.key] && !autoMapeo[c.key] ? 'mapeada' : 'ok')
        : null,
    }));

    const mapeadas = new Set(Object.values(mapeoFinal).filter(Boolean));
    const extras = headers.filter(h => !mapeadas.has(h));
    const faltantes = camposConfig.requeridos.filter(c => !mapeoFinal[c.key]);

    return { estadoCampos, extras, faltantes, mapeoFinal, autoMapeo };
  }, [preview, mapeo, todosCampos, camposConfig.requeridos]);

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    setErrorMsg('');
    setParsing(true);
    try {
      const parsed = await parseFile(f);
      setPreview(parsed);
      setMapeo({});
      setStep('preview');
    } catch (e) {
      setErrorMsg('No se pudo leer el archivo: ' + e.message);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleUpload = async () => {
    // Modo paired: insumos + rubros opcional, sin preview/mapeo
    if (tipo === 'insumos' && (fileRubros || (file && step === 'upload'))) {
      if (!file) return;
      setStep('uploading');
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('insumos', file);
        if (fileRubros) formData.append('rubros', fileRubros);

        const token = localStorage.getItem('token') || '';
        const res = await fetch(
          `${BASE}/insumos/import-csv-paired`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
            body: formData,
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
        setResult({
          inserted: data.insumos?.inserted ?? 0,
          updated: data.insumos?.updated ?? 0,
          skipped: data.insumos?.skipped ?? 0,
          batchId: data.batchId,
          rubrosInserted: data.rubros?.inserted ?? 0,
          rubrosUpdated: data.rubros?.updated ?? 0,
          autoMarked: data.autoMarked ?? 0,
        });
        setStep('done');
      } catch (e) {
        setErrorMsg(e.message);
        setStep('error');
      } finally {
        setUploading(false);
      }
      return;
    }

    // Modo original (artículos/ventas/compras): preview + mapeo
    if (!file || !analisis || analisis.faltantes.length > 0) return;
    setStep('uploading');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapeo', JSON.stringify(analisis.mapeoFinal));

      const token = localStorage.getItem('token') || '';
      const endpoints = {
        articulos: `${BASE}/businesses/${businessId}/articles/import-csv`,
        insumos: `${BASE}/businesses/${businessId}/insumos/import-csv`,
        ventas: `${BASE}/businesses/${businessId}/sales/import-csv`,
        compras: `${BASE}/businesses/${businessId}/purchases/import-csv`,
      };
      const endpoint = endpoints[tipo] || endpoints.insumos;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
          (data?.columnas_detectadas ? `Columnas detectadas: ${data.columnas_detectadas.join(', ')}` : `Error ${res.status}`)
        );
      }
      setResult(data.summary || data);
      setStep('done');
    } catch (e) {
      setErrorMsg(e.message);
      setStep('error');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    if (step === 'done') onSuccess?.();
    setFile(null); setFileRubros(null); setPreview(null); setMapeo({});
    setResult(null); setErrorMsg(''); setStep('upload');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>
            {step === 'done'
              ? `✓ ${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} importados`
              : `Importar ${tipoLabel}`}
          </Typography>
          <IconButton size="small" onClick={handleClose} disabled={uploading}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>

        {/* PASO 1 — Subir */}
        {step === 'upload' && tipo === 'insumos' && (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ py: 0.5, fontSize: '0.82rem' }}>
              Subí los <strong>dos archivos</strong> de Maxi: rubros (opcional, si ya están en el sistema)
              e insumos. Los rubros se cruzan automáticamente por el código <code>COD_RUI</code>.
            </Alert>

            {/* Dropzone 1: Rubros (opcional) */}
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                1️⃣ LISTADO DE RUBROS (OPCIONAL)
              </Typography>
              <Box
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setFileRubros(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById('import-file-rubros').click()}
                sx={{
                  border: `2px dashed ${fileRubros ? '#16a34a' : '#cbd5e1'}`, borderRadius: 2, p: 2,
                  textAlign: 'center', cursor: 'pointer',
                  bgcolor: fileRubros ? '#f0fdf4' : '#f8fafc',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: fileRubros ? '#dcfce7' : '#f1f5f9' },
                }}
              >
                {fileRubros ? (
                  <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                    <CheckCircleIcon sx={{ color: '#16a34a' }} />
                    <Typography variant="body2" fontWeight={600}>{fileRubros.name}</Typography>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setFileRubros(null); }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Arrastrá o hacé clic — archivo de rubros (xls/xlsx)
                  </Typography>
                )}
                <input id="import-file-rubros" type="file" accept=".csv,.xls,.xlsx"
                  style={{ display: 'none' }} onChange={e => setFileRubros(e.target.files[0])} />
              </Box>
            </Box>

            {/* Dropzone 2: Insumos (requerido) */}
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                2️⃣ LISTADO DE INSUMOS (REQUERIDO)
              </Typography>
              <Box
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); setErrorMsg(''); }}
                onClick={() => document.getElementById('import-file-insumos').click()}
                sx={{
                  border: `2px dashed ${file ? '#16a34a' : themeColor}`, borderRadius: 2, p: 3,
                  textAlign: 'center', cursor: 'pointer',
                  bgcolor: file ? '#f0fdf4' : `${themeColor}08`,
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: file ? '#dcfce7' : `${themeColor}15` },
                }}
              >
                {file ? (
                  <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                    <CheckCircleIcon sx={{ color: '#16a34a' }} />
                    <Typography variant="body2" fontWeight={600}>{file.name}</Typography>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : (
                  <>
                    <CloudUploadIcon sx={{ fontSize: 36, color: themeColor, mb: 0.5 }} />
                    <Typography variant="body2" fontWeight={600} sx={{ color: themeColor }}>
                      Arrastrá o hacé clic — archivo de insumos
                    </Typography>
                  </>
                )}
                <input id="import-file-insumos" type="file" accept=".csv,.xls,.xlsx"
                  style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0]); setErrorMsg(''); }} />
              </Box>
            </Box>

            {errorMsg && <Alert severity="error" sx={{ py: 0.5 }}>{errorMsg}</Alert>}

            <Alert severity="success" sx={{ py: 0.5, fontSize: '0.78rem' }} icon={false}>
              💡 <strong>Cruce automático:</strong> el campo <code>COD_RUI</code> del archivo de insumos
              se cruza con el <code>CODIGO</code> de rubros. Los insumos van directo a su rubro sin pasos extra.
            </Alert>
          </Stack>
        )}

        {/* PASO 1 — Subir (modo clásico para otros tipos) */}
        {step === 'upload' && tipo !== 'insumos' && (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ py: 0.5, fontSize: '0.82rem' }}>
              Subí un CSV o Excel con tus {tipoLabel}. El sistema detectará las columnas
              automáticamente y mostrará una vista previa antes de importar.
            </Alert>

            <Box
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('import-file-input').click()}
              sx={{
                border: `2px dashed ${themeColor}`, borderRadius: 2, p: 5,
                textAlign: 'center', cursor: 'pointer', bgcolor: `${themeColor}08`,
                transition: 'all 0.2s', '&:hover': { bgcolor: `${themeColor}15` },
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 52, color: themeColor, mb: 1 }} />
              <Typography fontWeight={600} sx={{ color: themeColor }}>
                Arrastrá o hacé clic para seleccionar
              </Typography>
              <Typography variant="caption" color="text.secondary">CSV, XLS, XLSX</Typography>
              <input id="import-file-input" type="file" accept=".csv,.xls,.xlsx"
                style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </Box>

            {parsing && <LinearProgress />}
            {errorMsg && <Alert severity="error" sx={{ py: 0.5 }}>{errorMsg}</Alert>}

            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                COLUMNAS QUE RECONOCE EL IMPORTADOR
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {camposConfig.requeridos.map(c => (
                  <Chip key={c.key} label={`${c.label} *`} size="small" color="error" variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }} />
                ))}
                {camposConfig.opcionales.map(c => (
                  <Chip key={c.key} label={c.label} size="small" variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20, color: 'text.secondary' }} />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                * Requerido. Las demás son opcionales.
              </Typography>
            </Box>
          </Stack>
        )}

        {/* PASO 2 — Vista previa */}
        {step === 'preview' && preview && analisis && (
          <Stack spacing={2}>
            {/* Estado de columnas */}
            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                📄 {file?.name} — ANÁLISIS DE COLUMNAS
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {analisis.estadoCampos
                  .filter(c => c.columna)
                  .map(c => (
                    <Tooltip key={c.key} title={`"${c.columna}" → ${c.desc}`}>
                      <span><ColChip estado={c.estado} label={c.label} /></span>
                    </Tooltip>
                  ))
                }
                {analisis.faltantes.map(c => (
                  <Tooltip key={c.key} title={`Requerida: ${c.desc}`}>
                    <span><ColChip estado="falta" label={c.label} /></span>
                  </Tooltip>
                ))}
                {analisis.extras.length > 0 && (
                  <Tooltip title={`Se ignoran: ${analisis.extras.join(', ')}`}>
                    <Chip size="small" label={`${analisis.extras.length} columna${analisis.extras.length !== 1 ? 's' : ''} extra (se ignora${analisis.extras.length !== 1 ? 'n' : ''})`}
                      sx={{ fontSize: '0.7rem', height: 22, color: 'text.secondary', bgcolor: '#f1f5f9' }} />
                  </Tooltip>
                )}
              </Stack>
            </Box>

            {/* Alerta faltantes */}
            {analisis.faltantes.length > 0 && (
              <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.82rem' }}>
                <strong>Columnas requeridas no detectadas automáticamente:</strong>{' '}
                {analisis.faltantes.map(c => c.label).join(', ')}.
                Seleccioná manualmente qué columna del archivo corresponde.
              </Alert>
            )}

            {/* Mapeo manual */}
            {(analisis.faltantes.length > 0 || camposConfig.opcionales.some(c => !analisis.autoMapeo[c.key])) && (
              <Box sx={{ bgcolor: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  MAPEO DE COLUMNAS
                </Typography>
                <Stack spacing={0.75}>
                  {/* Requeridas sin detección */}
                  {camposConfig.requeridos.filter(c => !analisis.autoMapeo[c.key]).map(campo => (
                    <Stack key={campo.key} direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={700} color="error" sx={{ minWidth: 100, fontSize: '0.8rem' }}>
                        {campo.label} *
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1, fontSize: '0.72rem' }}>
                        {campo.desc}
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select value={mapeo[campo.key] || ''} displayEmpty sx={{ fontSize: '0.8rem' }}
                          onChange={e => setMapeo(m => ({ ...m, [campo.key]: e.target.value || undefined }))}>
                          <MenuItem value=""><em>— Seleccioná —</em></MenuItem>
                          {preview.headers.map(h => <MenuItem key={h} value={h} sx={{ fontSize: '0.8rem' }}>{h}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Stack>
                  ))}

                  {camposConfig.opcionales.filter(c => !analisis.autoMapeo[c.key]).length > 0 && (
                    <>
                      <Divider sx={{ my: 0.5 }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>OPCIONAL</Typography>
                      {camposConfig.opcionales.filter(c => !analisis.autoMapeo[c.key]).map(campo => (
                        <Stack key={campo.key} direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100, fontSize: '0.8rem' }}>
                            {campo.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, fontSize: '0.72rem' }}>
                            {campo.desc}
                          </Typography>
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <Select value={mapeo[campo.key] || ''} displayEmpty sx={{ fontSize: '0.8rem' }}
                              onChange={e => setMapeo(m => ({ ...m, [campo.key]: e.target.value || undefined }))}>
                              <MenuItem value=""><em>— No importar —</em></MenuItem>
                              {preview.headers.map(h => <MenuItem key={h} value={h} sx={{ fontSize: '0.8rem' }}>{h}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Stack>
                      ))}
                    </>
                  )}
                </Stack>
              </Box>
            )}

            {/* Vista previa de filas */}
            {!preview.serverOnly && preview.rows?.length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  VISTA PREVIA — PRIMERAS {preview.rows.length} FILAS
                </Typography>
                <Box sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        {preview.headers.map(h => {
                          const campo = analisis.estadoCampos.find(c => c.columna === h);
                          const esExtra = !campo;
                          return (
                            <TableCell key={h} sx={{ fontSize: '0.7rem', fontWeight: 700, py: 0.75, whiteSpace: 'nowrap' }}>
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <span>{h}</span>
                                {campo && (
                                  <Chip size="small" label={campo.label} color="success"
                                    sx={{ fontSize: '0.6rem', height: 16 }} />
                                )}
                                {esExtra && (
                                  <Chip size="small" label="extra"
                                    sx={{ fontSize: '0.6rem', height: 16, bgcolor: '#f1f5f9', color: '#94a3b8' }} />
                                )}
                              </Stack>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.rows.map((row, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                          {preview.headers.map(h => {
                            const campo = analisis.estadoCampos.find(c => c.columna === h);
                            return (
                              <TableCell key={h} sx={{
                                fontSize: '0.75rem', py: 0.5,
                                maxWidth: 160, overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                color: campo ? 'inherit' : '#94a3b8',
                              }}>
                                {String(row[h] ?? '')}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Vista previa de las primeras {preview.rows.length} filas. Los datos en gris se ignorarán.
                </Typography>
              </Box>
            )}

            {preview.serverOnly && (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.82rem' }}>
                Los archivos XLS/XLSX se procesan directamente en el servidor.
                El importador reconocerá las columnas automáticamente al subir.
              </Alert>
            )}
          </Stack>
        )}

        {/* PASO 3 — Cargando */}
        {step === 'uploading' && (
          <Stack spacing={2} alignItems="center" py={3}>
            <LinearProgress sx={{ width: '100%', height: 6, borderRadius: 3 }} />
            <Typography variant="body2" color="text.secondary">
              Importando {tipoLabel}…
            </Typography>
          </Stack>
        )}

        {/* PASO 4 — Éxito */}
        {step === 'done' && result && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ py: 1.5 }}>
            <Typography fontWeight={700} sx={{ fontSize: '0.9rem' }}>Importación completada</Typography>
            <Stack direction="row" spacing={2} mt={0.75} flexWrap="wrap">
              <Typography variant="body2">
                <strong style={{ color: '#166534' }}>+{result.inserted ?? 0}</strong> insumos nuevos
              </Typography>
              <Typography variant="body2">
                <strong>{result.updated ?? 0}</strong> actualizados
              </Typography>
              {(result.skipped ?? 0) > 0 && (
                <Typography variant="body2" color="text.secondary">{result.skipped} omitidos</Typography>
              )}
            </Stack>
            {(result.rubrosInserted > 0 || result.rubrosUpdated > 0) && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Rubros: <strong style={{ color: '#166534' }}>+{result.rubrosInserted}</strong> nuevos,{' '}
                <strong>{result.rubrosUpdated}</strong> actualizados
              </Typography>
            )}
            {result.batchId && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Lote: {result.batchId}
              </Typography>
            )}
          </Alert>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <Alert severity="error" icon={<ErrorIcon />} sx={{ py: 1 }}>
            <Typography fontWeight={700} sx={{ fontSize: '0.9rem' }}>Error al importar</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>{errorMsg}</Typography>
          </Alert>
        )}

      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        {step === 'upload' && tipo !== 'insumos' && (
          <Button size="small" color="inherit" onClick={handleClose}>Cancelar</Button>
        )}
        {step === 'upload' && tipo === 'insumos' && (
          <>
            <Button size="small" color="inherit" onClick={handleClose}>Cancelar</Button>
            <Box flex={1} />
            <Button size="small" variant="contained"
              onClick={handleUpload} disabled={!file}
              startIcon={<CloudUploadIcon />}
              sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
              Importar
            </Button>
          </>
        )}
        {step === 'preview' && (
          <>
            <Button size="small" color="inherit" onClick={() => { setStep('upload'); setPreview(null); }}>
              ← Cambiar archivo
            </Button>
            <Box flex={1} />
            {analisis?.faltantes.length > 0 && (
              <Typography variant="caption" color="error" sx={{ alignSelf: 'center', mr: 0.5 }}>
                <WarningAmberIcon sx={{ fontSize: 13, mb: '-2px' }} /> Mapeá las columnas requeridas
              </Typography>
            )}
            <Button size="small" variant="contained"
              onClick={handleUpload} disabled={!!(analisis?.faltantes.length)}
              startIcon={<CloudUploadIcon />}
              sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
              Importar {tipoLabel}
            </Button>
          </>
        )}
        {step === 'done' && (
          <Button size="small" variant="contained" onClick={handleClose} fullWidth
            sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
            Finalizar
          </Button>
        )}
        {step === 'error' && (
          <>
            <Button size="small" color="inherit" onClick={handleClose}>Cerrar</Button>
            <Button size="small" variant="outlined" onClick={() => { setStep('upload'); setErrorMsg(''); }}>
              Reintentar
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}