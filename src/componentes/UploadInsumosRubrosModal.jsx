// src/componentes/UploadInsumosRubrosModal.jsx
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, LinearProgress, Alert, Box, Typography,
  IconButton, Table, TableHead, TableBody, TableRow, TableCell,
  Select, MenuItem, FormControl, Chip, Stack,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon       from '@mui/icons-material/Error';
import CloseIcon       from '@mui/icons-material/Close';
import ArrowBackIcon   from '@mui/icons-material/ArrowBack';
import CategoryIcon    from '@mui/icons-material/Category';
import { BASE }        from '../servicios/apiBase';

const ROLES = [
  { value: 'ignorar', label: '— Ignorar —',        color: '#94a3b8', bg: '#f1f5f9' },
  { value: 'codigo',  label: '✓ Código de rubro',   color: '#166534', bg: '#dcfce7' },
  { value: 'nombre',  label: '✓ Nombre de rubro',   color: '#1e40af', bg: '#dbeafe' },
];

function detectRol(col) {
  const c = col.toLowerCase().replace(/[\s_]/g, '');
  if (['codigo', 'code', 'cod', 'codrub'].includes(c)) return 'codigo';
  if (['nombre', 'name', 'descripcion'].includes(c))   return 'nombre';
  return 'ignorar';
}

function fmtVal(v) {
  if (v == null || v === '') return <span style={{ color: '#cbd5e1' }}>—</span>;
  const s = String(v);
  return s.length > 22 ? s.slice(0, 22) + '…' : s;
}

const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export default function UploadInsumosRubrosModal({ open, onClose, businessId, onSuccess }) {
  const [step,      setStep]      = useState('select');
  const [file,      setFile]      = useState(null);
  const [columnas,  setColumnas]  = useState([]);
  const [muestra,   setMuestra]   = useState([]);
  const [mapeo,     setMapeo]     = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [progress,  setProgress]  = useState(null);
  const [error,     setError]     = useState(null);
  const [dragging,  setDragging]  = useState(false);

  const PRIMARY = '#2492C8';

  const reset = () => {
    setStep('select'); setFile(null); setColumnas([]); setMuestra([]);
    setMapeo({}); setAnalyzing(false); setProgress(null); setError(null);
  };

  const handleClose = () => {
    if (step === 'uploading') return;
    if (step === 'done' && onSuccess) onSuccess();
    reset();
    onClose();
  };

  const handleFile = useCallback(async (f) => {
    setFile(f);
    setError(null);
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res  = await fetch(`${BASE}/businesses/${businessId}/insumos/preview-columns`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudieron leer las columnas');

      const cols = data.columnas || [];
      const mapeoInicial = {};
      const usados = {};
      for (const col of cols) {
        let rol = detectRol(col);
        if (rol !== 'ignorar' && usados[rol]) rol = 'ignorar';
        if (rol !== 'ignorar') usados[rol] = true;
        mapeoInicial[col] = rol;
      }
      setColumnas(cols);
      setMuestra(data.muestra || []);
      setMapeo(mapeoInicial);
      setStep('columns');
    } catch (e) {
      setError(e.message);
      setStep('error');
    } finally {
      setAnalyzing(false);
    }
  }, [businessId]);

  const handleChangeRol = (col, rol) => {
    setMapeo(prev => {
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
    setStep('uploading');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapeo', JSON.stringify(mapeo));
      const res  = await fetch(`${BASE}/businesses/${businessId}/insumos/import-rubros-csv`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const data = await res.json();
      if (data.ok || res.ok) {
        setProgress({ inserted: data.inserted ?? 0, updated: data.updated ?? 0, total: data.total ?? 0 });
        setStep('done');
        window.dispatchEvent(new Event('insumos:recargar'));
      } else {
        throw new Error(data.error || 'Error al importar');
      }
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const roles   = Object.values(mapeo);
  const tieneC  = roles.includes('codigo');
  const tieneN  = roles.includes('nombre');
  const puedeImp = tieneC && tieneN;

  return (
    <Dialog open={open} onClose={handleClose}
      maxWidth={step === 'columns' ? 'md' : 'sm'} fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}>

      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <CategoryIcon sx={{ color: PRIMARY }} />
            <Typography variant="h6" fontWeight={700}>
              {{
                select:    'Importar rubros de insumos',
                columns:   'Asignar columnas',
                uploading: 'Importando…',
                done:      '✓ Importación completada',
                error:     'Error al importar',
              }[step]}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={step === 'uploading'} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 2 }}>

        {/* Paso 1: seleccionar archivo */}
        {step === 'select' && !analyzing && (
          <Box>
            <Alert severity="info" sx={{ mb: 2, fontSize: '0.78rem', py: 0.75 }}>
              Subí un archivo con los rubros de insumos (CODIGO + NOMBRE). Se van a cruzar automáticamente con los insumos cargados.
            </Alert>
            <Box
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }}
              onClick={() => document.getElementById('rub-ins-input').click()}
              sx={{
                border: `2px dashed ${dragging ? '#5BC2EA' : PRIMARY}`,
                borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
                bgcolor: dragging ? '#5BC2EA15' : `${PRIMARY}08`,
                transition: 'all 0.2s',
                '&:hover': { bgcolor: `${PRIMARY}14` },
              }}
            >
              <CategoryIcon sx={{ fontSize: 44, color: PRIMARY, mb: 1 }} />
              <Typography variant="h6" sx={{ color: PRIMARY }} fontWeight="medium" gutterBottom>
                Seleccioná o arrastrá tu archivo
              </Typography>
              <Typography variant="caption" color="text.secondary">CSV · XLS · XLSX</Typography>
              <input id="rub-ins-input" type="file" accept=".csv,.xls,.xlsx"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </Box>
          </Box>
        )}

        {analyzing && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
            <Typography variant="body2" color="text.secondary">Analizando columnas…</Typography>
          </Box>
        )}

        {/* Paso 2: mapeo */}
        {step === 'columns' && (
          <Box>
            <Box sx={{ mb: 1.5, p: 1.25, bgcolor: `${PRIMARY}08`, borderRadius: 1.5,
              border: `1px solid ${PRIMARY}20`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CategoryIcon sx={{ fontSize: 16, color: PRIMARY }} />
              <Typography variant="body2" fontWeight={600} sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file?.name}
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.75} sx={{ mb: 1.5 }}>
              {[
                { ok: tieneC, label: tieneC ? '✓ Código' : '⚠ Sin Código', bg: tieneC ? '#dcfce7' : '#fee2e2', color: tieneC ? '#166534' : '#b91c1c' },
                { ok: tieneN, label: tieneN ? '✓ Nombre' : '⚠ Sin Nombre', bg: tieneN ? '#dbeafe' : '#fee2e2', color: tieneN ? '#1e40af' : '#b91c1c' },
              ].map((c, i) => (
                <Chip key={i} size="small" label={c.label}
                  sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: '0.7rem' }} />
              ))}
            </Stack>

            <Box sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 1.5, mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    {columnas.map(col => {
                      const rol  = mapeo[col] || 'ignorar';
                      const info = ROLES.find(r => r.value === rol) || ROLES[0];
                      return (
                        <TableCell key={col} sx={{ py: 0.75, px: 1, borderRight: '1px solid #f1f5f9', minWidth: 140 }}>
                          <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', color: '#64748b', fontSize: '0.63rem', mb: 0.5 }}>
                            {col}
                          </Typography>
                          <FormControl size="small" fullWidth>
                            <Select value={rol} onChange={e => handleChangeRol(col, e.target.value)}
                              sx={{ fontSize: '0.68rem', fontWeight: 600, bgcolor: info.bg, color: info.color, height: 26,
                                '.MuiSelect-select': { py: '3px', pr: '22px !important' },
                                '.MuiSvgIcon-root': { fontSize: 15, color: info.color } }}>
                              {ROLES.map(r => (
                                <MenuItem key={r.value} value={r.value}
                                  sx={{ fontSize: '0.7rem', fontWeight: r.value === 'ignorar' ? 400 : 600, color: r.color }}>
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
                    <TableRow key={i}>
                      {columnas.map(col => {
                        const rol  = mapeo[col] || 'ignorar';
                        const info = ROLES.find(r => r.value === rol) || ROLES[0];
                        return (
                          <TableCell key={col} sx={{ fontSize: '0.7rem', py: 0.5, px: 1,
                            color: rol === 'ignorar' ? '#cbd5e1' : '#1e293b',
                            bgcolor: rol === 'ignorar' ? 'transparent' : `${info.bg}55` }}>
                            {fmtVal(row[col])}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {!puedeImp && (
              <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.75rem' }}>
                Asigná al menos <strong>Código</strong> y <strong>Nombre</strong> para importar.
              </Alert>
            )}
          </Box>
        )}

        {step === 'uploading' && (
          <Box sx={{ py: 4 }}>
            <Typography variant="body2" fontWeight="medium" gutterBottom>Importando rubros…</Typography>
            <LinearProgress sx={{ height: 8, borderRadius: 1 }} />
          </Box>
        )}

        {step === 'done' && progress && (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Rubros importados</Typography>
            <Typography variant="body2">
              <strong style={{ color: '#166534' }}>+{progress.inserted}</strong> nuevos ·{' '}
              <strong>{progress.updated}</strong> actualizados ·{' '}
              {progress.total} filas procesadas
            </Typography>
          </Alert>
        )}

        {step === 'error' && (
          <Box>
            <Alert severity="error" icon={<ErrorIcon />}>
              <Typography variant="body2" fontWeight={600}>Error</Typography>
              <Typography variant="body2">{error}</Typography>
            </Alert>
            <Button sx={{ mt: 2 }} size="small" startIcon={<ArrowBackIcon />} onClick={reset}>
              Volver a intentar
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        {step === 'done' ? (
          <Button onClick={handleClose} variant="contained" fullWidth
            sx={{ bgcolor: PRIMARY, '&:hover': { filter: 'brightness(0.9)' } }}>
            ✓ Cerrar
          </Button>
        ) : step === 'columns' ? (
          <>
            <Button onClick={reset} color="inherit" startIcon={<ArrowBackIcon />}>
              Cambiar archivo
            </Button>
            <Button onClick={handleImport} variant="contained"
              startIcon={<CloudUploadIcon />} disabled={!puedeImp}
              sx={{ bgcolor: PRIMARY, '&:hover': { filter: 'brightness(0.9)' } }}>
              Importar rubros
            </Button>
          </>
        ) : step !== 'uploading' && step !== 'error' ? (
          <Button onClick={handleClose} color="inherit" variant="outlined">Cancelar</Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}