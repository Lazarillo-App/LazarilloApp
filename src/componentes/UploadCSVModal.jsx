import React, { useState } from 'react';
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
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';

// Modal de instrucciones
function InstructionsModal({ open, onClose, image1Url, image2Url }) {
  const [activeStep] = useState(0);

  const steps = [
    {
      label: 'Ir a Ventas > Informes > Venta por Artículo / Ranking',
      description: 'Desde el menú lateral, navega a la sección de Ventas, luego Informes y selecciona "Venta por artículo / ranking"',
      imageUrl: image1Url,
    },
    {
      label: 'Configurar el informe correctamente',
      description: (
        <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
          <li>Seleccionar el <strong>Periodo</strong> deseado</li>
          <li>Tipo de informe: <strong>Ventas por día</strong></li>
          <li>Modo: <strong>Por rubro</strong></li>
          <li>Agrupación: <strong>Detallado</strong></li>
          <li>✅ Tildar: <strong>Incluye artículos discontinuados</strong></li>
          <li>✅ Tildar: <strong>Incluye artículos en cero</strong></li>
          <li style={{ fontWeight: "900"}}>⚠️ Asegurate de que no haya otros filtros aplicados</li>
        </Box>
      ),
      imageUrl: image2Url,
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <HelpOutlineIcon color="primary" />
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
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {step.description}
                  </Typography>
                  
                  {/* Imagen de referencia */}
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

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>                 
                  </Box>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            💡 <strong>Importante:</strong> Una vez configurado el informe correctamente, exporta el archivo usando el botón de Excel 📊 en MaxiRest y luego súbelo en esta ventana.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Componente principal
export default function UploadCSVModal({ 
  open, 
  onClose, 
  businessId, 
  onSuccess,
  instructionImage1, // URL de la primera imagen
  instructionImage2, // URL de la segunda imagen
}) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress({ inserted: 0, total: 0, failed: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch(
        `https://lazarilloapp-backend.onrender.com/api/businesses/${businessId}/sales/import-csv`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (result.ok) {
        setProgress({
          inserted: result.summary.inserted || 0,
          total: result.summary.total_rows || 0,
          failed: result.summary.failed || 0,
        });
        setSuccess(true);

        setTimeout(() => {
          if (onSuccess) onSuccess();
          handleClose();
        }, 8000);
      } else {
        throw new Error(result.message || 'Error al importar CSV');
      }
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setProgress(null);
      setError(null);
      setSuccess(false);
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
              <CloudUploadIcon color="primary" />
              <Typography variant="h6">
                Importar Ventas desde Archivo
              </Typography>
            </Box>
            <IconButton
              onClick={() => setShowInstructions(true)}
              color="primary"
              title="¿Cómo exportar desde MaxiRest?"
              sx={{
                backgroundColor: '#e3f2fd',
                '&:hover': {
                  backgroundColor: '#bbdefb',
                },
              }}
            >
              <HelpOutlineIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ py: 2 }}>
            {/* Mensaje informativo inicial */}
            {!file && !success && (
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 3,
                  '& .MuiAlert-message': {
                    width: '100%',
                  },
                }}
              >
                <Typography variant="body2" gutterBottom>
                  <strong>📋 ¿Primera vez importando datos?</strong>
                </Typography>
                <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                  Haz clic en el ícono de ayuda{' '}
                  <HelpOutlineIcon sx={{ fontSize: 16, verticalAlign: 'middle', color: '#1976d2' }} />{' '}
                  arriba para ver las instrucciones detalladas paso a paso sobre cómo exportar el archivo desde MaxiRest.
                </Typography>
              </Alert>
            )}

            {/* Estado: Sin archivo */}
            {!file && !success && (
              <Box
                sx={{
                  border: '2px dashed #1976d2',
                  borderRadius: 2,
                  p: 5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#f5f9ff',
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: '#1565c0',
                    backgroundColor: '#e3f2fd',
                    transform: 'scale(1.01)',
                  },
                }}
                onClick={() => document.getElementById('csv-file-input').click()}
              >
                <CloudUploadIcon sx={{ fontSize: 64, color: '#1976d2', mb: 2 }} />
                <Typography variant="h6" color="primary" gutterBottom fontWeight="medium">
                  Selecciona tu archivo
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Arrastra y suelta o haz clic para seleccionar
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Formatos: CSV, XLS, XLSX
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  (Exportado desde MaxiRest)
                </Typography>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </Box>
            )}

            {/* Estado: Archivo seleccionado */}
            {file && !success && (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
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
                      <Typography variant="body2" fontWeight="medium">
                        Procesando...
                      </Typography>
                      <Typography variant="body2" color="primary" fontWeight="bold">
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

            {/* Estado: Éxito */}
            {success && progress && (
              <Alert severity="success" icon={<CheckCircleIcon fontSize="large" />}>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  ✅ Importación exitosa
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Se importaron <strong>{progress.inserted}</strong> registros correctamente
                  {progress.failed > 0 && (
                    <span>
                      {' '}· <span style={{ color: '#d32f2f' }}>{progress.failed} fallidos</span>
                    </span>
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Esta ventana se cerrará automáticamente en unos segundos...
                </Typography>
              </Alert>
            )}

            {/* Estado: Error */}
            {error && (
              <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Error al importar:</strong> {error}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Verifica que el archivo tenga el formato correcto y vuelve a intentar.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button 
            onClick={handleClose} 
            disabled={uploading}
            variant="outlined"
          >
            {success ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!success && (
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              variant="contained"
              startIcon={uploading ? null : <CloudUploadIcon />}
              size="large"
            >
              {uploading ? 'Importando...' : 'Importar Ventas'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Modal de instrucciones */}
      <InstructionsModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
        image1Url={instructionImage1}
        image2Url={instructionImage2}
      />
    </>
  );
}