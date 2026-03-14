// src/componentes/UploadInsumosModal.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, LinearProgress, Alert, Box, Typography,
  IconButton, Stepper, Step, StepLabel, StepContent, Paper,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon       from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon       from '@mui/icons-material/Close';
import Inventory2Icon  from '@mui/icons-material/Inventory2';
import { BASE } from '../servicios/apiBase';

// ─── Modal de instrucciones ───────────────────────────────────────────────────
function InstructionsModal({ open, onClose, themeColors }) {
  const steps = [
    {
      label: 'Ir a Stock → Insumos → Exportar a Excel',
      description: (
        <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
          <li>Desde el menú lateral de MaxiRest navegar a <strong>Stock</strong></li>
          <li>Ir a la sección <strong>Insumos</strong></li>
          <li>Buscar el botón de <strong>exportar / Excel 📊</strong></li>
          <li>Exportar <strong>sin filtros</strong> para traer el catálogo completo</li>
        </Box>
      ),
    },
    {
      label: 'Verificar el archivo antes de subir',
      description: (
        <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
          <li>El archivo debe tener las columnas: <strong>CODIGO, NOMBRE</strong> (mínimo)</li>
          <li>Columnas opcionales que se importan si están: <strong>RUBRO, MEDIDA, PRECIO, DISCONTINUADO</strong></li>
          <li>Los insumos que ya existen en Lazarillo se <strong>actualizan</strong></li>
          <li>Los insumos nuevos se <strong>agregan</strong></li>
          <li style={{ fontWeight: 900, color: '#166534' }}>✅ No se borra ningún insumo — solo se agrega/actualiza</li>
          <li style={{ fontWeight: 900 }}>⚠️ No modificar las columnas antes de subir</li>
        </Box>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <HelpOutlineIcon sx={{ color: themeColors.primary }} />
            <Typography variant="h6">¿Cómo exportar insumos desde MaxiRest?</Typography>
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper orientation="vertical">
          {steps.map((step, index) => (
            <Step key={index} expanded active>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight="bold">Paso {index + 1}</Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body1" fontWeight="medium" gutterBottom>{step.label}</Typography>
                  <Typography variant="body2" color="text.secondary" component="div" sx={{ mb: 1 }}>
                    {step.description}
                  </Typography>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            💡 <strong>Tip:</strong> Si MaxiRest está devolviendo datos incompletos o rotos,
            podés exportar el catálogo desde cualquier negocio que tenga la información correcta
            y subirlo acá — los códigos se cruzan automáticamente.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained"
          sx={{ bgcolor: themeColors.primary, '&:hover': { filter: 'brightness(0.9)' } }}>
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function UploadInsumosModal({ open, onClose, businessId, onSuccess }) {
  const [file,             setFile]             = useState(null);
  const [uploading,        setUploading]        = useState(false);
  const [progress,         setProgress]         = useState(null);
  const [error,            setError]            = useState(null);
  const [success,          setSuccess]          = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const themeColors = React.useMemo(() => {
    if (typeof window === 'undefined') return { primary: '#1976d2', secondary: '#10b981', onPrimary: '#ffffff' };
    const styles = getComputedStyle(document.documentElement);
    return {
      primary:   styles.getPropertyValue('--color-primary')?.trim()   || '#1976d2',
      secondary: styles.getPropertyValue('--color-secondary')?.trim() || '#10b981',
      onPrimary: styles.getPropertyValue('--on-primary')?.trim()      || '#ffffff',
    };
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(null); setSuccess(false); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress({ inserted: 0, updated: 0, total: 0, failed: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token    = localStorage.getItem('token');
      const response = await fetch(
        `${BASE}/businesses/${businessId}/insumos/import-csv`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      );

      const result = await response.json();
      console.log('[UploadInsumosModal] Respuesta:', result);

      if (result.ok || response.ok) {
        const s = result.summary || result;
        setProgress({
          inserted: Number(s.inserted ?? 0),
          updated:  Number(s.updated  ?? 0),
          total:    Number(s.total_rows ?? 0),
          failed:   Number(s.failed   ?? 0),
        });
        setSuccess(true);
      } else {
        throw new Error(result.message || result.error || 'Error al importar insumos');
      }
    } catch (err) {
      console.error('[UploadInsumosModal] Error:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      if (success && onSuccess) onSuccess();
      setFile(null); setProgress(null); setError(null); setSuccess(false);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <Inventory2Icon sx={{ color: themeColors.primary }} />
              <Typography variant="h6">
                {success ? '✓ Importación Completada' : 'Importar Insumos desde Archivo'}
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              {!success && (
                <IconButton onClick={() => setShowInstructions(true)}
                  sx={{ color: themeColors.primary, backgroundColor: `${themeColors.primary}15`,
                    '&:hover': { backgroundColor: `${themeColors.primary}25` } }}
                  title="¿Cómo exportar desde MaxiRest?">
                  <HelpOutlineIcon />
                </IconButton>
              )}
              <IconButton onClick={handleClose} disabled={uploading} size="small"
                sx={{ color: uploading ? 'text.disabled' : 'text.secondary' }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ py: 2 }}>
            {/* Sin archivo */}
            {!file && !success && (
              <>
                <Alert severity="info" sx={{ mb: 3, '& .MuiAlert-message': { width: '100%' } }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>📋 ¿Faltan insumos o los datos de MaxiRest están incompletos?</strong>
                  </Typography>
                  <Typography variant="caption" display="block">
                    Exportá el catálogo de insumos desde MaxiRest y subilo acá. Solo se agregan/actualizan
                    insumos — nunca se borra ninguno.
                    Hacé clic en{' '}
                    <HelpOutlineIcon sx={{ fontSize: 16, verticalAlign: 'middle', color: themeColors.primary }} />{' '}
                    para ver las instrucciones.
                  </Typography>
                </Alert>

                <Box
                  sx={{
                    border: `2px dashed ${themeColors.primary}`, borderRadius: 2, p: 5,
                    textAlign: 'center', cursor: 'pointer', backgroundColor: `${themeColors.primary}08`,
                    transition: 'all 0.3s',
                    '&:hover': { backgroundColor: `${themeColors.primary}15`, transform: 'scale(1.01)' },
                  }}
                  onClick={() => document.getElementById('insumos-file-input').click()}
                >
                  <Inventory2Icon sx={{ fontSize: 64, color: themeColors.primary, mb: 2 }} />
                  <Typography variant="h6" sx={{ color: themeColors.primary }} gutterBottom fontWeight="medium">
                    Seleccioná tu archivo
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Arrastrá y soltá o hacé clic para seleccionar
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Formatos: CSV, XLS, XLSX (exportado desde MaxiRest)
                  </Typography>
                  <input id="insumos-file-input" type="file" accept=".csv,.xls,.xlsx"
                    style={{ display: 'none' }} onChange={handleFileChange} />
                </Box>
              </>
            )}

            {/* Archivo seleccionado */}
            {file && !success && (
              <Box>
                <Alert severity="success" sx={{ mb: 2, bgcolor: `${themeColors.secondary}15`,
                  '& .MuiAlert-icon': { color: themeColors.secondary } }}>
                  <Typography variant="body2" fontWeight="medium">📄 {file.name}</Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                </Alert>
                {uploading && (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight="medium">Procesando...</Typography>
                    </Box>
                    <LinearProgress sx={{ height: 10, borderRadius: 1,
                      '& .MuiLinearProgress-bar': { bgcolor: themeColors.primary } }} />
                  </Box>
                )}
              </Box>
            )}

            {/* Éxito */}
            {success && progress && (
              <Box>
                <Alert severity="success" icon={<CheckCircleIcon fontSize="large" />}
                  sx={{ bgcolor: `${themeColors.secondary}15`,
                    '& .MuiAlert-icon': { color: themeColors.secondary } }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">✅ Importación completada</Typography>
                  <Typography variant="body2">
                    <strong style={{ color: '#166534' }}>+{progress.inserted}</strong> insumos nuevos
                    · <strong>{progress.updated}</strong> actualizados
                    {progress.failed > 0 && (
                      <span style={{ color: '#d32f2f' }}> · ⚠️ {progress.failed} fallidos</span>
                    )}
                  </Typography>
                  {progress.total > 0 && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                      Total procesado: {progress.total} filas
                    </Typography>
                  )}
                </Alert>

                <Box sx={{ mt: 2, p: 2, bgcolor: `${themeColors.primary}08`, borderRadius: 1,
                  border: `1px solid ${themeColors.primary}20` }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    📄 Archivo procesado:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">{file?.name}</Typography>
                </Box>
              </Box>
            )}

            {/* Error */}
            {error && (
              <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
                <Typography variant="body2"><strong>Error al importar:</strong> {error}</Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Verificá que el archivo tenga las columnas CODIGO y NOMBRE y volvé a intentar.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          {success ? (
            <Button onClick={handleClose} variant="contained" fullWidth size="large"
              sx={{ bgcolor: themeColors.secondary, color: themeColors.onPrimary,
                '&:hover': { filter: 'brightness(0.9)' } }}>
              ✓ Finalizar y actualizar catálogo
            </Button>
          ) : (
            <>
              <Button onClick={handleClose} disabled={uploading} variant="outlined"
                sx={{ borderColor: 'text.secondary', color: 'text.secondary' }}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={!file || uploading}
                variant="contained" startIcon={uploading ? null : <CloudUploadIcon />} size="large"
                sx={{ bgcolor: themeColors.primary, color: themeColors.onPrimary,
                  '&:hover': { filter: 'brightness(0.9)' } }}>
                {uploading ? 'Importando...' : 'Importar Insumos'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <InstructionsModal open={showInstructions} onClose={() => setShowInstructions(false)}
        themeColors={themeColors} />
    </>
  );
}