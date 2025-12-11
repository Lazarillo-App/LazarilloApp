import React, { useState } from 'react';
import {
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    CircularProgress,
    Alert,
    Stack,
    Typography,
    RadioGroup,
    FormControlLabel,
    Radio,
    Box,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { BusinessesAPI } from '../servicios/apiBusinesses';

export default function SyncVentasButton({ businessId, onSuccess }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('7days'); // ← Valor por defecto: últimos 7 días
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleOpen = () => {
        setOpen(true);
        setResult(null);
        setError(null);

        // Pre-llenar fechas de últimos 7 días
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(yesterday);
        lastWeek.setDate(lastWeek.getDate() - 6);

        setTo(yesterday.toISOString().split('T')[0]);
        setFrom(lastWeek.toISOString().split('T')[0]);
    };

    const handleClose = () => {
        if (loading) return;
        setOpen(false);
    };

    const handleSync = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            let response;
            let fromDate, toDate;

            // Calcular fechas según el modo
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            switch (mode) {
                case '7days': {
                    const startDate = new Date(yesterday);
                    startDate.setDate(startDate.getDate() - 6);
                    fromDate = startDate.toISOString().split('T')[0];
                    toDate = yesterday.toISOString().split('T')[0];
                    break;
                }

                case '30days': {
                    const startDate = new Date(yesterday);
                    startDate.setDate(startDate.getDate() - 29);
                    fromDate = startDate.toISOString().split('T')[0];
                    toDate = yesterday.toISOString().split('T')[0];
                    break;
                }

                case '90days': {
                    const startDate = new Date(yesterday);
                    startDate.setDate(startDate.getDate() - 89);
                    fromDate = startDate.toISOString().split('T')[0];
                    toDate = yesterday.toISOString().split('T')[0];
                    break;
                }

                case 'window':
                    if (!from || !to) {
                        throw new Error('Debes especificar fechas desde/hasta');
                    }
                    fromDate = from;
                    toDate = to;
                    break;

                default:
                    throw new Error('Modo inválido');
            }

            // Llamar al endpoint con las fechas calculadas
            response = await BusinessesAPI.syncSalesWindow(businessId, {
                from: fromDate,
                to: toDate,
            });

            setResult(response);
            onSuccess?.();
        } catch (err) {
            console.error('[SyncVentasButton] error:', err);
            setError(err.message || 'Error al sincronizar ventas');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<SyncIcon />}
                onClick={handleOpen}
                disabled={!businessId}
                sx={{
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'filter .15s, background .15s;display:inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid var(--color-border,#e5e7eb)',
                    color: 'var(--color-fg,#111827)',
                }}
            >
                Ventas
            </Button>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>Sincronizar Ventas desde Maxirest</DialogTitle>

                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        {error && (
                            <Alert severity="error" onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        {result && (
                            <Alert severity="success">
                                ✅ Sincronización exitosa
                                <Box sx={{ mt: 1 }}>
                                    {result.inserted != null && (
                                        <Typography variant="body2">
                                            📥 Insertados: {result.inserted}
                                        </Typography>
                                    )}
                                    {result.updated != null && (
                                        <Typography variant="body2">
                                            🔄 Actualizados: {result.updated}
                                        </Typography>
                                    )}
                                    {result.from && result.to && (
                                        <Typography variant="body2">
                                            📅 Rango: {result.from} → {result.to}
                                        </Typography>
                                    )}
                                </Box>
                            </Alert>
                        )}

                        <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
                            <FormControlLabel
                                value="window"
                                control={<Radio />}
                                label="Ventana específica"
                            />
                            <FormControlLabel
                                value="7days"
                                control={<Radio />}
                                label="Últimos 7 días"
                            />
                            <FormControlLabel
                                value="30days"
                                control={<Radio />}
                                label="Últimos 30 días"
                            />
                            <FormControlLabel
                                value="90days"
                                control={<Radio />}
                                label="Últimos 90 días"
                            />
                        </RadioGroup>

                        {mode === 'window' && (
                            <Stack spacing={2}>
                                <TextField
                                    label="Desde"
                                    type="date"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                />
                                <TextField
                                    label="Hasta"
                                    type="date"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                />
                            </Stack>
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSync}
                        variant="contained"
                        disabled={loading || (mode === 'window' && (!from || !to))}
                        startIcon={loading ? <CircularProgress size={20} /> : <SyncIcon />}
                    >
                        {loading ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}