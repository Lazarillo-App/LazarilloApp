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
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export default function UploadCSVModal({ open, onClose, businessId, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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

        // Notificar éxito después de 2 segundos
        setTimeout(() => {
          if (onSuccess) onSuccess();
          handleClose();
        }, 2000);
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CloudUploadIcon />
          Importar Ventas desde CSV
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 2 }}>
          {/* Estado: Sin archivo */}
          {!file && !success && (
            <Box
              sx={{
                border: '2px dashed #ccc',
                borderRadius: 2,
                p: 5,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: '#1976d2',
                  backgroundColor: '#f5f5f5',
                },
              }}
              onClick={() => document.getElementById('csv-file-input').click()}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: '#999', mb: 2 }} />
              <Typography variant="body1" color="textSecondary">
                Haz clic para seleccionar archivo
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Formatos: CSV, XLS, XLSX
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
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Archivo:</strong> {file.name}
                </Typography>
                <Typography variant="caption">
                  Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Alert>

              {uploading && progress && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progressPercent}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                  <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                    {progress.inserted} / {progress.total} registros importados
                    {progress.failed > 0 && ` (${progress.failed} fallidos)`}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Estado: Éxito */}
          {success && progress && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              <Typography variant="body1">
                ✅ Importación exitosa
              </Typography>
              <Typography variant="body2">
                {progress.inserted} registros importados correctamente
                {progress.failed > 0 && ` · ${progress.failed} fallidos`}
              </Typography>
            </Alert>
          )}

          {/* Estado: Error */}
          {error && (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          {success ? 'Cerrar' : 'Cancelar'}
        </Button>
        {!success && (
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            variant="contained"
            startIcon={uploading ? null : <CloudUploadIcon />}
          >
            {uploading ? 'Importando...' : 'Importar'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}