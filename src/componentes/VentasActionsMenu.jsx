// src/componentes/VentasActionsMenu.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
    Button,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Typography,
    Box,
    Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SyncIcon from '@mui/icons-material/Sync';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function VentasActionsMenu({
    onImport,
    onExport,
    rango,
    disabled = false
}) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const readColors = () => {
        if (typeof window === 'undefined') return { primary: '#3b82f6', secondary: '#10b981', onPrimary: '#ffffff' };
        const s = getComputedStyle(document.documentElement);
        return {
            primary: s.getPropertyValue('--color-primary')?.trim() || '#3b82f6',
            secondary: s.getPropertyValue('--color-secondary')?.trim() || '#10b981',
            onPrimary: s.getPropertyValue('--on-primary')?.trim() || '#ffffff',
        };
    };

    const [themeColors, setThemeColors] = useState(readColors);

    useEffect(() => {
        const update = () => setThemeColors(readColors());
        window.addEventListener('palette:changed', update);
        window.addEventListener('theme:updated', update);
        window.addEventListener('business:switched', update);
        return () => {
            window.removeEventListener('palette:changed', update);
            window.removeEventListener('theme:updated', update);
            window.removeEventListener('business:switched', update);
        };
    }, []);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleImport = () => {
        handleClose();
        if (onImport) onImport();
    };

    const handleExport = () => {
        handleClose();
        if (onExport) onExport();
    };

    // Formatear rango para mostrar
    const rangoLabel = useMemo(() => {
        if (!rango?.from || !rango?.to) return 'Sin período';

        try {
            const fromDate = new Date(rango.from);
            const toDate = new Date(rango.to);
            const fromStr = format(fromDate, 'dd/MM/yy', { locale: es });
            const toStr = format(toDate, 'dd/MM/yy', { locale: es });
            return `${fromStr} - ${toStr}`;
        } catch {
            return 'Período seleccionado';
        }
    }, [rango]);

    return (
        <>
            <Button
                variant="contained"
                startIcon={<SyncIcon />}
                onClick={handleClick}
                disabled={disabled}
                sx={{
                    textTransform: 'none',
                    bgcolor: themeColors.primary,
                    color: themeColors.onPrimary,
                    '&:hover': {
                        bgcolor: themeColors.primary,
                        filter: 'brightness(0.9)',
                    },
                    boxShadow: 2,
                    padding: '7.5px 9px',
                }}
            >
                Gestionar ventas
            </Button>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    elevation: 3,
                    sx: {
                        minWidth: 280,
                        mt: 1,
                        borderRadius: 2,
                        border: `1px solid ${themeColors.primary}20`,
                    },
                }}
                transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            >
                {/* Encabezado del menú */}
                <Box sx={{ px: 2, py: 1.5, bgcolor: `${themeColors.primary}08` }}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'text.secondary',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5
                        }}
                    >
                        📊 Administrar datos
                    </Typography>
                </Box>

                <Divider sx={{ my: 0.5 }} />

                {/* Importar ventas históricas */}
                <MenuItem onClick={handleImport} sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon>
                        <CloudUploadIcon
                            fontSize="small"
                            sx={{ color: themeColors.primary }}
                        />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Importar ventas
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Subir archivo CSV/Excel
                        </Typography>
                    </ListItemText>
                </MenuItem>

                <Divider sx={{ my: 0.5 }} />

                {/* Exportar ventas del rango actual */}
                <MenuItem onClick={handleExport} sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon>
                        <CloudDownloadIcon
                            fontSize="small"
                            sx={{ color: themeColors.secondary }}
                        />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Exportar ventas
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Descargar del rango actual
                        </Typography>
                    </ListItemText>
                </MenuItem>

                {/* Footer: muestra el rango actual */}
                <Box
                    sx={{
                        px: 2,
                        py: 1.5,
                        bgcolor: `${themeColors.secondary}08`,
                        borderTop: `1px solid ${themeColors.secondary}20`,
                        mt: 0.5
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'text.secondary',
                            display: 'block',
                            mb: 0.5
                        }}
                    >
                        📅 Rango actual:
                    </Typography>
                    <Chip
                        label={rangoLabel}
                        size="small"
                        sx={{
                            bgcolor: `${themeColors.secondary}15`,
                            color: themeColors.secondary,
                            fontWeight: 500,
                            fontSize: '0.75rem',
                        }}
                    />
                </Box>
            </Menu>
        </>
    );
}