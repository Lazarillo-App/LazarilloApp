import React, { useState } from 'react';
import { useBranch } from '@/hooks/useBranch';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Alert,
  Box,
  Typography,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import CloudUploadIcon  from '@mui/icons-material/CloudUpload';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import ErrorIcon        from '@mui/icons-material/Error';
import HelpOutlineIcon  from '@mui/icons-material/HelpOutline';
import CloseIcon        from '@mui/icons-material/Close';
import { BASE } from '../servicios/apiBase';

// ─── Imágenes de instrucciones ───
import image1Url from '../assets/brand/instrucciones-compras-1.jpeg';
import image2Url from '../assets/brand/instrucciones-compras-2.jpeg';

// ─── Modal de instrucciones ───
function InstructionsModal({ open, onClose, themeColors }) {
  const [activeStep] = useState(0);

  const steps = [
    {
      label: 'Ir a Compras > Informe de compras por insumo',
      description: 'Desde el menú lateral, navegar a la sección de Compras y seleccionar "Informe de compras por insumo".',
      imageUrl: image2Url,
    },
    {
      label: 'Configurar el informe correctamente',
      description: (
        <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
          <li>Seleccionar el <strong>Período</strong> deseado (campo Fecha)</li>
          <li>Informe: <strong>Compras - Informe de Compras por insumo</strong></li>
          <li>Tipo de listado: <strong>Detallado</strong></li>
          <li>Agrupar por: <strong>Rubro de insumos</strong></li>
          <li>Importes: <strong>Con impuestos actuales</strong></li>
          <li style={{ fontWeight: '900' }}>⚠️ Asegurate de que no haya otros filtros aplicados</li>
        </Box>
      ),
      imageUrl: image1Url,
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <HelpOutlineIcon sx={{ color: themeColors.primary }} />
            <Typography variant="h6">
              ¿Cómo exportar el archivo desde MaxiRest?
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={index} expanded>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight="bold">
                  Paso {index + 1}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body1" fontWeight="medium" gutterBottom>
                    {step.label}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} component="div">
                    {step.description}
                  </Typography>

                  {step.imageUrl && (
                    <Paper
                      elevation={3}
                      sx={{
                        p: 1,
                        backgroundColor: '#fafafa',
                        border: '1px solid #e0e0e0',
                        borderRadius: 2,
                      }}
                    >
                      <Box
                        component="img"
                        src={step.imageUrl}
                        alt={`Paso ${index + 1}`}
                        sx={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: 400,
                          objectFit: 'contain',
                          borderRadius: 1,
                        }}
                      />
                    </Paper>
                  )}

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }} />
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            💡 <strong>Importante:</strong> Una vez configurado el informe correctamente, exportá el archivo
            usando el botón de Excel 📊 en MaxiRest y luego subilo en esta ventana.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: themeColors.primary,
            '&:hover': { bgcolor: themeColors.primary, filter: 'brightness(0.9)' },
          }}
        >
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Componente principal ───
export default function UploadComprasModal({ open, onClose, businessId, onSuccess, activeBranchId }) {
  const { branches, hasBranches } = useBranch() || {};
  const [branchId, setBranchId] = useState(null);
  React.useEffect(() => { if (open) setBranchId(activeBranchId ?? null); }, [open, activeBranchId]);

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
    const selectedFile = e.target.files[0];
    if (selectedFile) { setFile(selectedFile); setError(null); setSuccess(false); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress({ inserted: 0, total: 0, failed: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (branchId !== null && branchId !== undefined && branchId !== '') {
        formData.append('branch_id', String(branchId));
      }

      const token    = localStorage.getItem('token');
      const response = await fetch(
        `${BASE}/businesses/${businessId}/purchases/import-csv`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      );

      const result = await response.json();
      console.log('[UploadComprasModal] Respuesta del servidor:', result);

      if (result.ok || response.ok) {
        const summary  = result.summary || result.data?.summary || result;
        const inserted = Number(summary.inserted || summary.rows_inserted || summary.count || 0);
        const total    = Number(summary.total_rows || summary.total || inserted);
        const failed   = Number(summary.failed || 0);

        console.log('[UploadComprasModal] Datos procesados:', { inserted, total, failed });

        setProgress({ inserted, total: total || inserted, failed });
        setSuccess(true);
      } else {
        throw new Error(result.message || result.error || 'Error al importar compras');
      }
    } catch (err) {
      console.error('Error uploading compras:', err);
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

  const progressPercent = progress?.total > 0
    ? Math.round((progress.inserted / progress.total) * 100)
    : 0;

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <CloudUploadIcon sx={{ color: themeColors.primary }} />
              <Typography variant="h6">
                {success ? '✓ Importación Completada' : 'Importar Compras desde Archivo'}
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              {!success && (
                <IconButton
                  onClick={() => setShowInstructions(true)}
                  sx={{
                    color: themeColors.primary,
                    backgroundColor: `${themeColors.primary}15`,
                    '&:hover': { backgroundColor: `${themeColors.primary}25` },
                  }}
                  title="¿Cómo exportar desde MaxiRest?"
                >
                  <HelpOutlineIcon />
                </IconButton>
              )}
              <IconButton
                onClick={handleClose}
                disabled={uploading}
                size="small"
                sx={{ color: uploading ? 'text.disabled' : 'text.secondary' }}
                title={uploading ? 'Esperando...' : 'Cerrar'}
              >
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
                    <strong>📋 ¿Primera vez importando compras?</strong>
                  </Typography>
                  {/* Selector de sucursal */}
                {branches && branches.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <StoreIcon sx={{ fontSize: 16 }} /> Sucursal
                        </Box>
                      </InputLabel>
                      <Select
                        value={branchId === null || branchId === undefined ? '' : String(branchId)}
                        label="Sucursal"
                        onChange={e => { const v = e.target.value; setBranchId(v === '' ? null : (Number(v) || v)); }}
                      >
                        <MenuItem value=""><em>Negocio completo (sin sucursal)</em></MenuItem>
                        {(branches || []).map(b => (
                          <MenuItem key={b.id} value={b.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: b.color || 'var(--color-primary)' }} />
                              {b.name}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {branchId && (
                      <Chip size="small" sx={{ mt: 0.5, fontSize: '0.72rem' }}
                        label={`Compras para: ${branches.find(b => b.id === branchId)?.name || branchId}`} />
                    )}
                  </Box>
                )}

                {hasBranches && !branchId && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <strong>Seleccioná una sucursal</strong> antes de importar las compras.
                  </Alert>
                )}

                <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                    Hacé clic en el ícono de ayuda{' '}
                    <HelpOutlineIcon sx={{ fontSize: 16, verticalAlign: 'middle', color: themeColors.primary }} />{' '}
                    arriba para ver las instrucciones detalladas paso a paso sobre cómo exportar el archivo desde MaxiRest.
                  </Typography>
                </Alert>

                <Box
                  sx={{
                    border: `2px dashed ${themeColors.primary}`,
                    borderRadius: 2,
                    p: 5,
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: `${themeColors.primary}08`,
                    transition: 'all 0.3s',
                    '&:hover': {
                      borderColor: themeColors.primary,
                      backgroundColor: `${themeColors.primary}15`,
                      transform: 'scale(1.01)',
                    },
                  }}
                  onClick={() => document.getElementById('compras-file-input').click()}
                >
                  <CloudUploadIcon sx={{ fontSize: 64, color: themeColors.primary, mb: 2 }} />
                  <Typography variant="h6" sx={{ color: themeColors.primary }} gutterBottom fontWeight="medium">
                    Seleccioná tu archivo
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Arrastrá y soltá o hacé clic para seleccionar
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Formatos: CSV, XLS, XLSX
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    (Exportado desde MaxiRest)
                  </Typography>
                  <input
                    id="compras-file-input"
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </Box>
              </>
            )}

            {/* Archivo seleccionado */}
            {file && !success && (
              <Box>
                <Alert
                  severity="success"
                  sx={{
                    mb: 2,
                    bgcolor: `${themeColors.secondary}15`,
                    color: themeColors.secondary,
                    '& .MuiAlert-icon': { color: themeColors.secondary },
                  }}
                >
                  <Typography variant="body2" fontWeight="medium">
                    📄 Archivo seleccionado: {file.name}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                </Alert>

                {uploading && progress && (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight="medium">Procesando...</Typography>
                      <Typography variant="body2" sx={{ color: themeColors.primary, fontWeight: 'bold' }}>
                        {progressPercent}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={progressPercent}
                      sx={{
                        height: 10,
                        borderRadius: 1,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': { bgcolor: themeColors.primary },
                      }}
                    />
                    <Typography variant="caption" align="center" display="block" sx={{ mt: 1 }} color="text.secondary">
                      {progress.inserted} de {progress.total} registros importados
                      {progress.failed > 0 && (
                        <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                          {' '}· {progress.failed} fallidos
                        </span>
                      )}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Éxito */}
            {success && progress && (
              <Box>
                <Alert
                  severity="success"
                  icon={<CheckCircleIcon fontSize="large" />}
                  sx={{
                    bgcolor: `${themeColors.secondary}15`,
                    color: themeColors.secondary,
                    '& .MuiAlert-icon': { color: themeColors.secondary },
                  }}
                >
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    ✅ Importación completada
                  </Typography>
                  {progress.total > 0 && progress.total !== progress.inserted && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      Total de filas procesadas: {progress.total}
                    </Typography>
                  )}
                  {progress.failed > 0 && (
                    <Typography variant="caption" display="block" sx={{ color: '#d32f2f', fontWeight: 'bold', mt: 0.5 }}>
                      ⚠️ {progress.failed} registro{progress.failed === 1 ? '' : 's'} no pudo{progress.failed === 1 ? '' : 'ieron'} ser importado{progress.failed === 1 ? '' : 's'}
                    </Typography>
                  )}
                </Alert>

                <Box
                  sx={{
                    mt: 2, p: 2,
                    bgcolor: `${themeColors.primary}08`,
                    borderRadius: 1,
                    border: `1px solid ${themeColors.primary}20`,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    📄 Archivo procesado:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Error */}
            {error && (
              <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Error al importar:</strong> {error}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Verificá que el archivo tenga el formato correcto y volvé a intentar.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          {success ? (
            <Button
              onClick={handleClose}
              variant="contained"
              fullWidth
              size="large"
              sx={{
                bgcolor: themeColors.secondary,
                color: themeColors.onPrimary,
                '&:hover': { bgcolor: themeColors.secondary, filter: 'brightness(0.9)' },
              }}
            >
              ✓ Finalizar y actualizar datos
            </Button>
          ) : (
            <>
              <Button
                onClick={handleClose}
                disabled={uploading}
                variant="outlined"
                sx={{ borderColor: 'text.secondary', color: 'text.secondary' }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading || (hasBranches && !branchId)}
                variant="contained"
                startIcon={uploading ? null : <CloudUploadIcon />}
                size="large"
                sx={{
                  bgcolor: themeColors.primary,
                  color: themeColors.onPrimary,
                  '&:hover': { bgcolor: themeColors.primary, filter: 'brightness(0.9)' },
                }}
              >
                {uploading ? 'Importando...' : 'Importar Compras'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <InstructionsModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
        themeColors={themeColors}
      />
    </>
  );
}