// src/componentes/RecetasImportModal.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, LinearProgress, Alert, Box, Typography,
  IconButton, Tab, Tabs, Stepper, Step, StepLabel, StepContent, Chip,
} from '@mui/material';
import CloudUploadIcon  from '@mui/icons-material/CloudUpload';
import SyncIcon         from '@mui/icons-material/Sync';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import ErrorIcon        from '@mui/icons-material/Error';
import HelpOutlineIcon  from '@mui/icons-material/HelpOutline';
import CloseIcon        from '@mui/icons-material/Close';
import MenuBookIcon     from '@mui/icons-material/MenuBook';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { BASE } from '../servicios/apiBase';

/* ── Tab Sync MaxiRest ─────────────────────────────────────────────── */
function SyncTab({ businessId, themeColors }) {
  const [syncing, setSyncing] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const handleSync = async () => {
    setSyncing(true); setError(null); setResult(null);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${BASE}/businesses/${businessId}/recetas/sync-maxi`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.ok) setResult(data.summary);
      else throw new Error(data.message || data.error || 'Error al sincronizar');
    } catch (err) { setError(err.message); }
    finally { setSyncing(false); }
  };

  return (
    <Box sx={{ py: 2 }}>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>Sincronización automática desde MaxiRest</Typography>
        <Typography variant="caption" display="block">
          Trae todas las recetas del catálogo. Los artículos e insumos deben estar
          sincronizados primero para resolver los ingredientes correctamente.
        </Typography>
      </Alert>

      {!result && !syncing && (
        <Box sx={{ border: `2px dashed ${themeColors.primary}`, borderRadius: 2, p: 5,
          textAlign: 'center', bgcolor: `${themeColors.primary}08` }}>
          <MenuBookIcon sx={{ fontSize: 64, color: themeColors.primary, mb: 2 }} />
          <Typography variant="h6" color="primary" fontWeight="medium">Sincronizar recetas desde MaxiRest</Typography>
          <Typography variant="body2" color="text.secondary">Se traerán todas las recetas disponibles</Typography>
        </Box>
      )}

      {syncing && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight="medium" gutterBottom>Conectando con MaxiRest...</Typography>
          <LinearProgress sx={{ height: 10, borderRadius: 1 }} />
        </Box>
      )}

      {result && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>✅ Sincronización completada</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Chip label={`${result.inserted} nuevas`}         color="success" size="small" />
            <Chip label={`${result.updated} actualizadas`}    color="info"    size="small" />
            <Chip label={`${result.items_saved} ingredientes`}                size="small" />
            {result.skipped > 0 && <Chip label={`${result.skipped} omitidas`} color="warning" size="small" />}
          </Box>
        </Alert>
      )}

      {error && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
          <Typography variant="body2"><strong>Error:</strong> {error}</Typography>
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Verificá que las credenciales de MaxiRest estén configuradas y que los artículos
            e insumos estén sincronizados primero.
          </Typography>
        </Alert>
      )}

      <Box sx={{ mt: 3 }}>
        <Button onClick={handleSync} disabled={syncing} variant="contained" size="large" fullWidth
          startIcon={syncing ? null : <SyncIcon />}
          sx={{ bgcolor: themeColors.primary, '&:hover': { filter: 'brightness(0.9)' } }}>
          {syncing ? 'Sincronizando...' : result ? 'Sincronizar de nuevo' : 'Sincronizar ahora'}
        </Button>
      </Box>
    </Box>
  );
}

/* ── Tab CSV ────────────────────────────────────────────────────────── */
function CsvTab({ businessId, themeColors, onSuccess }) {
  const [file,      setFile]      = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);
  const [showHelp,  setShowHelp]  = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res   = await fetch(`${BASE}/businesses/${businessId}/recetas/import-csv`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const data = await res.json();
      if (data.ok) { setResult(data.summary); onSuccess?.(); }
      else throw new Error(data.message || data.error || 'Error al importar');
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  };

  if (showHelp) return (
    <Box sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle2" fontWeight="bold">Formato del archivo</Typography>
        <Button size="small" onClick={() => setShowHelp(false)}>← Volver</Button>
      </Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="caption" display="block" fontWeight="bold" gutterBottom>Una fila = un ingrediente</Typography>
        <Box sx={{ fontFamily: 'monospace', fontSize: 10, bgcolor: '#f1f5f9', p: 1, borderRadius: 1, overflowX: 'auto', mt: 1 }}>
          CODIGO_ARTICULO | NOMBRE_ARTICULO | CODIGO_INSUMO | NOMBRE_INSUMO | CANTIDAD | UNIDAD | OBSERVACIONES
        </Box>
        <Box sx={{ fontFamily: 'monospace', fontSize: 10, bgcolor: '#f1f5f9', p: 1, borderRadius: 1, mt: 0.5, overflowX: 'auto' }}>
          51 | Fainá | 1 | Harina garbanzos | 0.3 | Kg |<br/>
          51 | Fainá | 2 | Agua | 0.85 | Lt |<br/>
          360 | Crema Adicional | 5 | Crema | 0.2 | Lt |
        </Box>
      </Alert>
      <Typography variant="caption" color="text.secondary">
        Los CODIGO_ARTICULO y CODIGO_INSUMO deben coincidir con los del catálogo de MaxiRest.
        Si un insumo no existe aún, se guarda el código para resolverlo después de sincronizar insumos.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ py: 2 }}>
      <Box display="flex" justifyContent="flex-end" mb={1}>
        <Button size="small" startIcon={<HelpOutlineIcon />} onClick={() => setShowHelp(true)}>
          Ver formato
        </Button>
      </Box>

      {!file && !result && (
        <Box sx={{ border: `2px dashed ${themeColors.primary}`, borderRadius: 2, p: 5,
          textAlign: 'center', cursor: 'pointer', bgcolor: `${themeColors.primary}08`,
          '&:hover': { bgcolor: `${themeColors.primary}15` } }}
          onClick={() => document.getElementById('recetas-csv-input').click()}>
          <CloudUploadIcon sx={{ fontSize: 64, color: themeColors.primary, mb: 2 }} />
          <Typography variant="h6" color="primary" fontWeight="medium">Seleccioná el archivo de recetas</Typography>
          <Typography variant="caption" color="text.secondary">CSV, XLS o XLSX · Una fila por ingrediente</Typography>
          <input id="recetas-csv-input" type="file" accept=".csv,.xls,.xlsx"
            style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) { setFile(f); setError(null); setResult(null); } }} />
        </Box>
      )}

      {file && !result && (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="medium">📄 {file.name}</Typography>
          </Alert>
          {uploading && <LinearProgress sx={{ height: 10, borderRadius: 1 }} />}
        </Box>
      )}

      {result && (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>✅ Importación completada</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Chip label={`${result.recetas_upserted} recetas`} color="success" size="small" />
            <Chip label={`${result.items_saved} ingredientes`} size="small" />
            {result.warnings > 0 && <Chip icon={<WarningAmberIcon />} label={`${result.warnings} advertencias`} color="warning" size="small" />}
            {result.failed   > 0 && <Chip label={`${result.failed} errores`} color="error" size="small" />}
          </Box>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2"><strong>Error:</strong> {error}</Typography>
        </Alert>
      )}

      <Box sx={{ mt: 3 }}>
        {!result ? (
          <Button onClick={handleUpload} disabled={!file || uploading} variant="contained"
            size="large" fullWidth startIcon={uploading ? null : <CloudUploadIcon />}
            sx={{ bgcolor: themeColors.primary, '&:hover': { filter: 'brightness(0.9)' } }}>
            {uploading ? 'Importando...' : 'Importar recetas'}
          </Button>
        ) : (
          <Button onClick={() => { setFile(null); setResult(null); }} variant="outlined" fullWidth>
            Importar otro archivo
          </Button>
        )}
      </Box>
    </Box>
  );
}

/* ── Modal principal ─────────────────────────────────────────────────── */
export default function RecetasImportModal({ open, onClose, businessId, onSuccess }) {
  const [tab, setTab] = useState(0);
  const themeColors = React.useMemo(() => {
    if (typeof window === 'undefined') return { primary: '#1976d2', onPrimary: '#fff' };
    const s = getComputedStyle(document.documentElement);
    return { primary: s.getPropertyValue('--color-primary')?.trim() || '#1976d2',
             onPrimary: s.getPropertyValue('--on-primary')?.trim() || '#ffffff' };
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <MenuBookIcon sx={{ color: themeColors.primary }} />
            <Typography variant="h6">Importar Recetas</Typography>
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
          <Tab icon={<SyncIcon fontSize="small" />} iconPosition="start" label="Sync MaxiRest" />
          <Tab icon={<CloudUploadIcon fontSize="small" />} iconPosition="start" label="Subir CSV" />
        </Tabs>
        {tab === 0 && <SyncTab businessId={businessId} themeColors={themeColors} />}
        {tab === 1 && <CsvTab  businessId={businessId} themeColors={themeColors} onSuccess={onSuccess} />}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}