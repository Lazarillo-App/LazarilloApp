// src/componentes/SalesPickerIcon.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { 
  IconButton, Tooltip, Popover, Box, Stack, Button, Typography, 
  ToggleButtonGroup, ToggleButton, Divider, Chip 
} from '@mui/material';
import TodayIcon from '@mui/icons-material/Today';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { 
  lastNDaysUntilYesterday, 
  monthToDateUntilYesterday, 
  yearToDateUntilYesterday,
  getRangeLabel,
  isValidRange
} from '../utils/fechas';
import { format, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ✅ Preset rápidos mejorados
const PRESETS = [
  { 
    id: '7', 
    label: '7 días', 
    calc: () => lastNDaysUntilYesterday(7),
    icon: '📅' 
  },
  { 
    id: '30', 
    label: '30 días', 
    calc: () => lastNDaysUntilYesterday(30),
    icon: '📊' 
  },
  { 
    id: '90', 
    label: '90 días', 
    calc: () => lastNDaysUntilYesterday(90),
    icon: '📈' 
  },
  { 
    id: 'mtd', 
    label: 'Mes actual', 
    calc: monthToDateUntilYesterday,
    icon: '🗓️' 
  },
  { 
    id: 'ytd', 
    label: 'Año actual', 
    calc: yearToDateUntilYesterday,
    icon: '📆' 
  },
];

export default function SalesPickerIcon({ value, onChange }) {
  const { mode, from, to } = value;

  const [anchorEl, setAnchorEl] = useState(null);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  
  const open = Boolean(anchorEl);

  // ✅ Obtener colores del tema del negocio
  const themeColors = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        primary: '#3b82f6',
        secondary: '#10b981',
        background: '#f9fafb'
      };
    }

    const root = document.documentElement;
    const styles = getComputedStyle(root);
    
    return {
      primary: styles.getPropertyValue('--color-primary')?.trim() || '#3b82f6',
      secondary: styles.getPropertyValue('--color-secondary')?.trim() || '#10b981',
      background: styles.getPropertyValue('--color-background')?.trim() || '#f9fafb',
      onPrimary: styles.getPropertyValue('--on-primary')?.trim() || '#ffffff',
    };
  }, []);
  
  const handleOpen = useCallback((e) => {
    setAnchorEl(e.currentTarget);
    // Pre-cargar valores custom si estamos en modo custom
    if (mode === 'custom' && from && to) {
      setCustomFrom(from);
      setCustomTo(to);
    }
  }, [mode, from, to]);
  
  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // ✅ Label inteligente que muestra el rango actual
  const rangeLabel = useMemo(() => {
    if (!from || !to) return 'Seleccionar período';
    
    // Primero intentar con la función centralizada
    const label = getRangeLabel(mode, from, to);
    if (label && label !== 'Período') return label;
    
    // Fallback: mostrar fechas formateadas
    try {
      const fromDate = parseISO(from);
      const toDate = parseISO(to);
      const fromStr = format(fromDate, 'dd/MM/yy', { locale: es });
      const toStr = format(toDate, 'dd/MM/yy', { locale: es });
      return `📅 ${fromStr} - ${toStr}`;
    } catch {
      return 'Período seleccionado';
    }
  }, [from, to, mode]);

  // ✅ Aplicar preset rápido
  const applyPreset = useCallback((preset) => {
    const result = preset.calc();
    onChange({ 
      mode: preset.id, 
      from: result.from, 
      to: result.to 
    });
    handleClose();
  }, [onChange, handleClose]);

  // ✅ Aplicar rango custom (con validación mejorada)
  const applyCustomRange = useCallback(() => {
    if (!customFrom || !customTo) {
      alert('Por favor selecciona ambas fechas');
      return;
    }
    
    // Validar con la función centralizada
    if (!isValidRange(customFrom, customTo)) {
      alert('Rango de fechas inválido. Verifica que "Desde" sea anterior a "Hasta" y que no sean fechas futuras.');
      return;
    }
    
    onChange({ 
      mode: 'custom', 
      from: customFrom, 
      to: customTo 
    });
    
    handleClose();
  }, [customFrom, customTo, onChange, handleClose]);

  // ✅ Shortcuts de teclado en el custom range
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      applyCustomRange();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  }, [applyCustomRange, handleClose]);

  return (
    <>
      <Tooltip title={rangeLabel}>
        <Button
          size="small"
          onClick={handleOpen}
          variant="outlined"
          sx={{ 
            textTransform: 'none',
            minWidth: 180,
            justifyContent: 'flex-start',
            borderColor: themeColors.primary,
            color: themeColors.primary,
            '&:hover': {
              borderColor: themeColors.primary,
              bgcolor: `${themeColors.primary}10`
            },
            padding: '7.5px 9px',
          }}
        >
          {rangeLabel}
        </Button>
      </Tooltip>

      <Popover
        open={open}
        onClose={handleClose}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { 
              mt: 1,
              borderRadius: 2,
              boxShadow: 3,
              border: `1px solid ${themeColors.primary}20`
            }
          }
        }}
      >
        <Box sx={{ p: 2.5, width: 340 }}>
          <Stack spacing={2}>
            {/* Título */}
            <Typography 
              variant="subtitle2" 
              sx={{ 
                fontWeight: 600, 
                color: themeColors.primary 
              }}
            >
              📅 Selecciona un período
            </Typography>

            {/* Presets rápidos en grid */}
            <Stack spacing={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Rangos predefinidos
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={mode === preset.id ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => applyPreset(preset)}
                    startIcon={<span>{preset.icon}</span>}
                    sx={{ 
                      textTransform: 'none',
                      flex: preset.id === 'ytd' ? '1 1 100%' : '0 1 auto',
                      minWidth: preset.id === 'ytd' ? '100%' : 'auto',
                      ...(mode === preset.id ? {
                        bgcolor: themeColors.primary,
                        color: themeColors.onPrimary,
                        '&:hover': {
                          bgcolor: themeColors.primary,
                          filter: 'brightness(0.9)'
                        }
                      } : {
                        borderColor: themeColors.primary,
                        color: themeColors.primary,
                        '&:hover': {
                          borderColor: themeColors.primary,
                          bgcolor: `${themeColors.primary}10`
                        }
                      })
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </Stack>
            </Stack>

            <Divider sx={{ borderColor: `${themeColors.primary}20` }} />

            {/* Rango personalizado mejorado */}
            <Stack spacing={1.5}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: themeColors.primary, 
                  fontWeight: 500 
                }}
              >
                📍 Rango personalizado
              </Typography>
              
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                    Desde
                  </Typography>
                  <input
                    type="date"
                    value={customFrom || from || ''}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    onKeyDown={handleKeyDown}
                    max={customTo || to || format(subDays(new Date(), 1), 'yyyy-MM-dd')}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: `1px solid ${themeColors.primary}40`,
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = themeColors.primary}
                    onBlur={(e) => e.target.style.borderColor = `${themeColors.primary}40`}
                  />
                </Box>
                
                <DateRangeIcon 
                  sx={{ color: themeColors.primary, mt: 2.5, opacity: 0.6 }} 
                  fontSize="small" 
                />
                
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                    Hasta
                  </Typography>
                  <input
                    type="date"
                    value={customTo || to || ''}
                    onChange={(e) => setCustomTo(e.target.value)}
                    onKeyDown={handleKeyDown}
                    min={customFrom || from || ''}
                    max={format(subDays(new Date(), 1), 'yyyy-MM-dd')}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: `1px solid ${themeColors.primary}40`,
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = themeColors.primary}
                    onBlur={(e) => e.target.style.borderColor = `${themeColors.primary}40`}
                  />
                </Box>
              </Stack>

              {/* Hint informativo */}
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary', 
                  fontStyle: 'italic',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                <span style={{ color: themeColors.primary }}>💡</span> 
                Selecciona cualquier rango histórico disponible
              </Typography>
            </Stack>

            {/* Botones de acción */}
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ pt: 1 }}>
              <Button 
                onClick={handleClose} 
                size="small"
                sx={{ 
                  textTransform: 'none',
                  color: 'text.secondary'
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={applyCustomRange} 
                variant="contained" 
                size="small"
                disabled={!customFrom || !customTo}
                sx={{ 
                  textTransform: 'none',
                  bgcolor: themeColors.primary,
                  color: themeColors.onPrimary,
                  '&:hover': {
                    bgcolor: themeColors.primary,
                    filter: 'brightness(0.9)'
                  }
                }}
              >
                Aplicar rango
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}