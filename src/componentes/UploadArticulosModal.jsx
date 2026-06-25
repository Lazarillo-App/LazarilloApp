/* eslint-disable no-empty */
// src/componentes/UploadArticulosModal.jsx
// Modal de import en lote con vista previa + mapeo editable
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, LinearProgress, Alert, Box, Typography,
  IconButton, Stack, Chip, Table, TableHead, TableBody,
  TableRow, TableCell, Select, MenuItem, FormControl,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { BASE } from '../servicios/apiBase';

const ROLES_RUBROS = [
  { value: 'ignorar', label: '— Ignorar —', color: '#94a3b8', bg: '#f1f5f9' },
  { value: 'codigo', label: '✓ Código', color: '#166534', bg: '#dcfce7' },
  { value: 'nombre', label: '✓ Nombre', color: '#1e40af', bg: '#dbeafe' },
];
const ROLES_SUBRUBROS = [
  { value: 'ignorar', label: '— Ignorar —', color: '#94a3b8', bg: '#f1f5f9' },
  { value: 'codigo', label: '✓ Código', color: '#166534', bg: '#dcfce7' },
  { value: 'nombre', label: '✓ Nombre', color: '#1e40af', bg: '#dbeafe' },
  { value: 'rubro', label: '○ Rubro padre', color: '#92400e', bg: '#fef3c7' },
];
const ROLES_ARTICULOS = [
  { value: 'ignorar', label: '— Ignorar —', color: '#94a3b8', bg: '#f1f5f9' },
  { value: 'codigo', label: '✓ Código', color: '#166534', bg: '#dcfce7' },
  { value: 'nombre', label: '✓ Nombre', color: '#1e40af', bg: '#dbeafe' },
  { value: 'precio', label: '✓ Precio', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'rubro', label: '○ Cód. rubro', color: '#92400e', bg: '#fef3c7' },
  { value: 'subrubro', label: '○ Cód. subrubro', color: '#065f46', bg: '#d1fae5' },
];
function getRoles(tipo) {
  if (tipo === 'rubros') return ROLES_RUBROS;
  if (tipo === 'subrubros') return ROLES_SUBRUBROS;
  return ROLES_ARTICULOS;
}
function roleInfo(tipo, rol) {
  return getRoles(tipo).find(r => r.value === rol) || getRoles(tipo)[0];
}
function detectarRol(col, tipo) {
  const c = col.toLowerCase().replace(/[\s_.-]/g, '');
  if (tipo === 'rubros') {
    if (['codigo', 'code', 'codrua', 'cod', 'id'].includes(c)) return 'codigo';
    if (['nombre', 'name', 'descripcion'].includes(c)) return 'nombre';
  }
  if (tipo === 'subrubros') {
    if (['codigo', 'codsua', 'code', 'cod', 'id'].includes(c)) return 'codigo';
    if (['nombre', 'name', 'descripcion'].includes(c)) return 'nombre';
    if (['codrua', 'codru', 'rubro', 'codrubro'].includes(c)) return 'rubro';
  }
  if (tipo === 'articulos') {
    if (['codigo', 'code', 'codarticulo', 'cod', 'id'].includes(c)) return 'codigo';
    if (['nombre', 'name', 'descripcion'].includes(c)) return 'nombre';
    if (['precio1', 'precio', 'price', 'precioventa', 'precioref'].includes(c)) return 'precio';
    if (['codrua', 'codru', 'rubro', 'codrubro'].includes(c)) return 'rubro';
    if (['codsua', 'subrubro', 'codsubrubro'].includes(c)) return 'subrubro';
  }
  return 'ignorar';
}
function fmtVal(v) {
  if (v == null || v === '') return <span style={{ color: '#cbd5e1' }}>—</span>;
  const s = String(v);
  return s.length > 20 ? s.slice(0, 20) + '…' : s;
}
function useTheme() {
  return React.useMemo(() => {
    if (typeof window === 'undefined') return { primary: '#1976d2', secondary: '#10b981', onPrimary: '#fff' };
    const s = getComputedStyle(document.documentElement);
    return {
      primary: s.getPropertyValue('--color-primary')?.trim() || '#1976d2',
      secondary: s.getPropertyValue('--color-secondary')?.trim() || '#10b981',
      onPrimary: s.getPropertyValue('--on-primary')?.trim() || '#ffffff',
    };
  }, []);
}

function DropZone({ id, label, sublabel, file, onFile, onClear, color, required = false }) {
  return (
    <Box>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label} {required ? '(requerido)' : '(opcional)'}
      </Typography>
      <Box
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById(id).click()}
        sx={{
          border: `2px dashed ${file ? '#16a34a' : color}`,
          borderRadius: 2, p: file ? 1.5 : 2.5,
          textAlign: 'center', cursor: 'pointer',
          bgcolor: file ? '#f0fdf4' : `${color}08`,
          transition: 'all 0.2s',
          '&:hover': { bgcolor: file ? '#dcfce7' : `${color}14` },
        }}
      >
        {file ? (
          <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
            <CheckCircleIcon sx={{ color: '#16a34a' }} />
            <Typography variant="body2" fontWeight={600}>{file.name}</Typography>
            <IconButton size="small" onClick={e => { e.stopPropagation(); onClear(); }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <>
            <Typography variant="body2" sx={{ color, fontWeight: 600 }}>Arrastrá o hacé clic</Typography>
            <Typography variant="caption" color="text.secondary" display="block">{sublabel}</Typography>
          </>
        )}
        <input id={id} type="file" accept=".csv,.xls,.xlsx" style={{ display: 'none' }}
          onChange={e => onFile(e.target.files[0])} />
      </Box>
    </Box>
  );
}

function PreviewTabla({ tipo, file, columnas, muestra, mapeo, onChange }) {
  if (!file) return null;
  const titulo = tipo === 'rubros' ? 'Rubros' : tipo === 'subrubros' ? 'Subrubros' : 'Artículos';
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>
        {titulo} — {file.name}
      </Typography>
      <Box sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              {columnas.map(col => {
                const rol = mapeo[col] || 'ignorar';
                const info = roleInfo(tipo, rol);
                return (
                  <TableCell key={col} sx={{ py: 0.75, px: 1, verticalAlign: 'top', borderRight: '1px solid #f1f5f9', minWidth: 130 }}>
                    <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', color: '#64748b', fontSize: '0.63rem', mb: 0.5, whiteSpace: 'nowrap' }}>
                      {col}
                    </Typography>
                    <FormControl size="small" fullWidth>
                      <Select value={rol} onChange={(e) => onChange(col, e.target.value)}
                        sx={{
                          fontSize: '0.68rem', fontWeight: 600, bgcolor: info.bg, color: info.color, height: 26,
                          '.MuiOutlinedInput-notchedOutline': { borderColor: `${info.color}40` },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: info.color },
                          '.MuiSelect-select': { py: '3px', pr: '22px !important' },
                          '.MuiSvgIcon-root': { fontSize: 15, color: info.color },
                        }}>
                        {getRoles(tipo).map(r => (
                          <MenuItem key={r.value} value={r.value} sx={{ fontSize: '0.7rem', fontWeight: r.value === 'ignorar' ? 400 : 600, color: r.color }}>
                            {r.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {muestra.map((row, i) => (
              <TableRow key={i} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                {columnas.map(col => {
                  const rol = mapeo[col] || 'ignorar';
                  const info = roleInfo(tipo, rol);
                  const ign = rol === 'ignorar';
                  return (
                    <TableCell key={col} sx={{
                      fontSize: '0.7rem', py: 0.5, px: 1, borderRight: '1px solid #f8fafc',
                      color: ign ? '#cbd5e1' : '#1e293b',
                      bgcolor: ign ? 'transparent' : `${info.bg}55`,
                      maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {fmtVal(row[col])}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

export default function UploadArticulosModal({ open, onClose, businessId, onSuccess }) {
  const themeColors = useTheme();
  const [step, setStep] = useState('upload');
  const [fileRubros, setFileRubros] = useState(null);
  const [fileSubrubros, setFileSubrubros] = useState(null);
  const [fileArticulos, setFileArticulos] = useState(null);
  const [previewRubros, setPreviewRubros] = useState(null);
  const [previewSubrubros, setPreviewSubrubros] = useState(null);
  const [previewArticulos, setPreviewArticulos] = useState(null);
  const [mapeoRubros, setMapeoRubros] = useState({});
  const [mapeoSubrubros, setMapeoSubrubros] = useState({});
  const [mapeoArticulos, setMapeoArticulos] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const reset = () => {
    setStep('upload');
    setFileRubros(null); setFileSubrubros(null); setFileArticulos(null);
    setPreviewRubros(null); setPreviewSubrubros(null); setPreviewArticulos(null);
    setMapeoRubros({}); setMapeoSubrubros({}); setMapeoArticulos({});
    setResult(null); setError(null); setAnalyzing(false);
  };

  const handleClose = () => {
    if (step === 'uploading') return;
    if (step === 'done' && onSuccess) onSuccess();
    reset();
    onClose();
  };

  const analizarArchivo = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${BASE}/businesses/${businessId}/articles/preview-columns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'No se pudieron leer las columnas');
    return { columnas: data.columnas || [], muestra: data.muestra || [] };
  };

  const construirMapeoInicial = (columnas, tipo) => {
    const out = {};
    const usados = {};
    for (const col of columnas) {
      let rol = detectarRol(col, tipo);
      if (rol !== 'ignorar' && usados[rol]) rol = 'ignorar';
      if (rol !== 'ignorar') usados[rol] = true;
      out[col] = rol;
    }
    return out;
  };

  const handleSiguiente = async () => {
    if (!fileArticulos) return;
    setAnalyzing(true);
    setError(null);
    try {
      const tareas = [];
      if (fileRubros) tareas.push(analizarArchivo(fileRubros).then(d => ({ tipo: 'rubros', ...d })));
      if (fileSubrubros) tareas.push(analizarArchivo(fileSubrubros).then(d => ({ tipo: 'subrubros', ...d })));
      tareas.push(analizarArchivo(fileArticulos).then(d => ({ tipo: 'articulos', ...d })));
      const resultados = await Promise.all(tareas);
      for (const r of resultados) {
        const mapeo = construirMapeoInicial(r.columnas, r.tipo);
        if (r.tipo === 'rubros') { setPreviewRubros(r); setMapeoRubros(mapeo); }
        if (r.tipo === 'subrubros') { setPreviewSubrubros(r); setMapeoSubrubros(mapeo); }
        if (r.tipo === 'articulos') { setPreviewArticulos(r); setMapeoArticulos(mapeo); }
      }
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleChangeRol = (tipo) => (col, rol) => {
    const setter = tipo === 'rubros' ? setMapeoRubros : tipo === 'subrubros' ? setMapeoSubrubros : setMapeoArticulos;
    setter(prev => {
      const next = { ...prev };
      if (rol !== 'ignorar') {
        for (const [k, v] of Object.entries(next)) {
          if (v === rol && k !== col) next[k] = 'ignorar';
        }
      }
      next[col] = rol;
      return next;
    });
  };

  const handleImport = async () => {
    if (!fileArticulos) return;
    setStep('uploading');
    setError(null);
    try {
      const fd = new FormData();
      if (fileRubros) {
        fd.append('rubros', fileRubros);
        fd.append('mapeoRubros', JSON.stringify(mapeoRubros));
      }
      if (fileSubrubros) {
        fd.append('subrubros', fileSubrubros);
        fd.append('mapeoSubrubros', JSON.stringify(mapeoSubrubros));
      }
      fd.append('articulos', fileArticulos);
      fd.append('mapeoArticulos', JSON.stringify(mapeoArticulos));
      const token = localStorage.getItem('token') || '';
      const res = await fetch(
        `${BASE}/businesses/${businessId}/articles/import-csv-paired`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) }, body: fd }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || `Error ${res.status}`);
      setResult(data);
      setStep('done');
      try { window.dispatchEvent(new CustomEvent('articulos:batch:changed', { detail: { businessId } })); } catch {}
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const articulosOK = Object.values(mapeoArticulos).includes('nombre');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth={step === 'preview' ? 'lg' : 'sm'} fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <PointOfSaleIcon sx={{ color: themeColors.primary }} />
            <Typography variant="h6" fontWeight={700}>
              {step === 'done' ? '✓ Importación completada' :
               step === 'preview' ? 'Vista previa y mapeo' :
               'Importar artículos en lote'}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={step === 'uploading'} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 2 }}>
        {step === 'upload' && !analyzing && (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ fontSize: '0.82rem', py: 0.75 }}>
              Subí los archivos de Maxi en una sola pasada.
              En el siguiente paso vas a poder editar qué columna es cada cosa.
            </Alert>
            <DropZone id="art-file-rubros" label="1️⃣ Listado de rubros"
              sublabel="CODIGO + NOMBRE" file={fileRubros}
              onFile={setFileRubros} onClear={() => setFileRubros(null)} color="#94a3b8" />
            <DropZone id="art-file-subrubros" label="2️⃣ Listado de subrubros"
              sublabel="CODIGO + NOMBRE (+ COD_RUA)" file={fileSubrubros}
              onFile={setFileSubrubros} onClear={() => setFileSubrubros(null)} color="#94a3b8" />
            <DropZone id="art-file-articulos" label="3️⃣ Listado de artículos"
              sublabel="CODIGO + NOMBRE + COD_RUA + COD_SUA + PRECIO" file={fileArticulos}
              onFile={setFileArticulos} onClear={() => setFileArticulos(null)}
              color={themeColors.primary} required />
            {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
            <Alert severity="success" sx={{ py: 0.5, fontSize: '0.78rem' }} icon={false}>
              💡 Si ya cargaste los rubros antes, podés subir solo el de artículos.
            </Alert>
          </Stack>
        )}

        {analyzing && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
            <Typography variant="body2" color="text.secondary">Analizando archivos…</Typography>
          </Box>
        )}

        {step === 'preview' && (
          <Box>
            <Alert severity="info" sx={{ mb: 2, py: 0.5, fontSize: '0.78rem' }}>
              Revisá qué columna es cada cosa. Si una columna está mal detectada, cambiala desde el menú.
              Lo único que necesitamos sí o sí es el <strong>Nombre</strong> de cada artículo.
            </Alert>
            {previewRubros && (
              <PreviewTabla tipo="rubros" file={fileRubros} columnas={previewRubros.columnas}
                muestra={previewRubros.muestra} mapeo={mapeoRubros}
                onChange={handleChangeRol('rubros')} />
            )}
            {previewSubrubros && (
              <PreviewTabla tipo="subrubros" file={fileSubrubros} columnas={previewSubrubros.columnas}
                muestra={previewSubrubros.muestra} mapeo={mapeoSubrubros}
                onChange={handleChangeRol('subrubros')} />
            )}
            {previewArticulos && (
              <PreviewTabla tipo="articulos" file={fileArticulos} columnas={previewArticulos.columnas}
                muestra={previewArticulos.muestra} mapeo={mapeoArticulos}
                onChange={handleChangeRol('articulos')} />
            )}
            {!articulosOK && (
              <Alert severity="warning" sx={{ mt: 1, py: 0.5, fontSize: '0.78rem' }}>
                Asigná al menos la columna <strong>Nombre</strong> en el listado de artículos.
              </Alert>
            )}
          </Box>
        )}

        {step === 'uploading' && (
          <Box sx={{ py: 4 }}>
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              Procesando archivos y cruzando datos…
            </Typography>
            <LinearProgress sx={{
              height: 8, borderRadius: 1,
              '& .MuiLinearProgress-bar': { bgcolor: themeColors.primary }
            }} />
          </Box>
        )}

        {step === 'done' && result && (
          <Alert severity="success" icon={<CheckCircleIcon />}
            sx={{ bgcolor: `${themeColors.secondary}15`, '& .MuiAlert-icon': { color: themeColors.secondary } }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Importación completada</Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                Artículos: <strong style={{ color: '#166534' }}>+{result.articulos?.inserted ?? 0}</strong> nuevos ·{' '}
                <strong>{result.articulos?.updated ?? 0}</strong> actualizados
                {(result.articulos?.failed ?? 0) > 0 && (
                  <span style={{ color: '#d32f2f' }}> · ⚠️ {result.articulos.failed} fallidos</span>
                )}
              </Typography>
              {(result.rubros?.total ?? 0) > 0 && (
                <Typography variant="body2">
                  Rubros: <strong style={{ color: '#166534' }}>+{result.rubros.inserted}</strong> nuevos ·{' '}
                  <strong>{result.rubros.updated}</strong> actualizados
                </Typography>
              )}
              {(result.subrubros?.total ?? 0) > 0 && (
                <Typography variant="body2">
                  Subrubros: <strong style={{ color: '#166534' }}>+{result.subrubros.inserted}</strong> nuevos ·{' '}
                  <strong>{result.subrubros.updated}</strong> actualizados
                </Typography>
              )}
            </Stack>
            {result.batchId && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Lote: {result.batchId}
              </Typography>
            )}
          </Alert>
        )}

        {step === 'error' && (
          <Alert severity="error" icon={<ErrorIcon />}>
            <Typography variant="body2" fontWeight={600}>Error al importar</Typography>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        {step === 'upload' && !analyzing && (
          <>
            <Button onClick={handleClose} variant="text" color="inherit">Cancelar</Button>
            <Box flex={1} />
            <Button onClick={handleSiguiente} variant="contained"
              disabled={!fileArticulos}
              sx={{ bgcolor: themeColors.primary, color: themeColors.onPrimary,
                    '&:hover': { filter: 'brightness(0.9)' } }}>
              Siguiente →
            </Button>
          </>
        )}
        {step === 'preview' && (
          <>
            <Button onClick={() => setStep('upload')} variant="text" startIcon={<ArrowBackIcon />}
              sx={{ color: 'text.secondary' }}>Volver</Button>
            <Box flex={1} />
            <Button onClick={handleImport} variant="contained" startIcon={<CloudUploadIcon />}
              disabled={!articulosOK}
              sx={{ bgcolor: themeColors.primary, color: themeColors.onPrimary,
                    '&:hover': { filter: 'brightness(0.9)' } }}>
              Importar
            </Button>
          </>
        )}
        {step === 'done' && (
          <Button onClick={handleClose} variant="contained" fullWidth
            sx={{ bgcolor: themeColors.secondary, color: themeColors.onPrimary,
                  '&:hover': { filter: 'brightness(0.9)' } }}>
            ✓ Cerrar
          </Button>
        )}
        {step === 'error' && (
          <>
            <Button onClick={handleClose} variant="text" color="inherit">Cerrar</Button>
            <Button onClick={() => { setStep('upload'); setError(null); }} variant="outlined">Reintentar</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}