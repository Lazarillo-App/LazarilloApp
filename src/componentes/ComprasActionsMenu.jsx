// src/componentes/ComprasActionsMenu.jsx
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
import CloudUploadIcon   from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ShoppingCartIcon  from '@mui/icons-material/ShoppingCart';
import { format } from 'date-fns';
import { es }    from 'date-fns/locale';

export default function ComprasActionsMenu({
    onImport,
    onExport,
    rango,
    disabled = false,
}) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const readColors = () => {
        if (typeof window === 'undefined') return { primary: '#3b82f6', secondary: '#10b981', onPrimary: '#ffffff' };
        const s = getComputedStyle(document.documentElement);
        return {
            primary:   s.getPropertyValue('--color-primary')?.trim()   || '#3b82f6',
            secondary: s.getPropertyValue('--color-secondary')?.trim() || '#10b981',
            onPrimary: s.getPropertyValue('--on-primary')?.trim()      || '#ffffff',
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

    const handleClose   = () => setAnchorEl(null);
    const handleImport  = () => { handleClose(); onImport?.(); };
    const handleExport  = () => { handleClose(); onExport?.(); };

    const rangoLabel = useMemo(() => {
        if (!rango?.from || !rango?.to) return 'Sin período';
        try {
            const fromStr = format(new Date(rango.from), 'dd/MM/yy', { locale: es });
            const toStr   = format(new Date(rango.to),   'dd/MM/yy', { locale: es });
            return `${fromStr} - ${toStr}`;
        } catch {
            return 'Período seleccionado';
        }
    }, [rango]);

    return (
        <>
            <Button
                variant="contained"
                startIcon={<ShoppingCartIcon />}
                onClick={(e) => setAnchorEl(e.currentTarget)}
                disabled={disabled}
                sx={{
                    textTransform: 'none',
                    bgcolor: themeColors.primary,
                    color: themeColors.onPrimary,
                    '&:hover': { bgcolor: themeColors.primary, filter: 'brightness(0.9)' },
                    boxShadow: 2,
                    padding: '7.5px 9px',
                }}
            >
                Gestionar compras
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
                {/* Encabezado */}
                <Box sx={{ px: 2, py: 1.5, bgcolor: `${themeColors.primary}08` }}>
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
                    >
                        🛒 Administrar datos de compras
                    </Typography>
                </Box>

                <Divider sx={{ my: 0.5 }} />

                {/* Importar */}
                <MenuItem onClick={handleImport} sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon>
                        <CloudUploadIcon fontSize="small" sx={{ color: themeColors.primary }} />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Importar compras
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Subir archivo CSV/Excel de MaxiRest
                        </Typography>
                    </ListItemText>
                </MenuItem>

                <Divider sx={{ my: 0.5 }} />

                {/* Exportar */}
                <MenuItem onClick={handleExport} sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon>
                        <CloudDownloadIcon fontSize="small" sx={{ color: themeColors.secondary }} />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Exportar compras
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Descargar del rango actual
                        </Typography>
                    </ListItemText>
                </MenuItem>

                {/* Footer: rango actual */}
                <Box
                    sx={{
                        px: 2, py: 1.5,
                        bgcolor: `${themeColors.secondary}08`,
                        borderTop: `1px solid ${themeColors.secondary}20`,
                        mt: 0.5,
                    }}
                >
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
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