/* eslint-disable no-dupe-keys */
// src/componentes/SalesPickerIcon.jsx
import { showAlert } from '../servicios/appAlert';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Popover, Box, Stack, Button, Typography, Divider, IconButton, Tooltip } from '@mui/material';
import DateRangeIcon from '@mui/icons-material/DateRange';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import {
  lastNDaysUntilYesterday, monthToDateUntilYesterday,
  yearToDateUntilYesterday, getRangeLabel, isValidRange,
} from '../utils/fechas';
import {
  format, subDays, parseISO, addMonths, subMonths, addYears, subYears,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isAfter, isBefore, isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';

/* ─── helpers ─── */
const ayer      = () => subDays(new Date(), 1);
const ymd       = (d) => format(d, 'yyyy-MM-dd');
const parseDate = (s) => s ? parseISO(s) : null;

function buildPresets(firstDate) {
  const today = new Date();
  const prevM = subMonths(new Date(today.getFullYear(), today.getMonth(), 1), 1);
  const prevY = today.getFullYear() - 1;

  return [
    { id: '7',         label: '7 días',     calc: () => lastNDaysUntilYesterday(7) },
    { id: '30',        label: '30 días',    calc: () => lastNDaysUntilYesterday(30) },
    { id: '90',        label: '90 días',    calc: () => lastNDaysUntilYesterday(90) },
    { id: 'mtd',       label: 'Mes actual', calc: () => monthToDateUntilYesterday() },
    { id: 'ytd',       label: 'Año actual', calc: () => yearToDateUntilYesterday() },
    {
      id: 'prev_month',
      label: format(prevM, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase()),
      calc: () => ({
        from: ymd(new Date(prevM.getFullYear(), prevM.getMonth(), 1)),
        to:   ymd(new Date(prevM.getFullYear(), prevM.getMonth() + 1, 0)),
      }),
    },
    {
      id: 'prev_year',
      label: `Año ${prevY}`,
      calc: () => ({ from: `${prevY}-01-01`, to: `${prevY}-12-31` }),
    },
    {
      id: 'all',
      label: 'Histórico',
      disabled: !firstDate,
      calc: () => firstDate ? { from: firstDate, to: ymd(ayer()) } : lastNDaysUntilYesterday(365),
    },
  ];
}

/* ─── Calendario visual ─── */
function MiniCalendar({ viewDate, onViewChange, fromDate, toDate, onDayClick, tc }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
    const end   = endOfWeek(endOfMonth(viewDate),     { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const maxDate = ayer();
  const fromD   = parseDate(fromDate);
  const toD     = parseDate(toDate);

  const isInRange = (day) => {
    if (!fromD || !toD) return false;
    return isAfter(day, fromD) && isBefore(day, toD);
  };

  const monthLabel = format(viewDate, 'MMMM yyyy', { locale: es }).toUpperCase();

  return (
    <Box>
      {/* Navegación */}
      <Stack direction="row" alignItems="center" sx={{ mb: 0.75 }}>
        <Tooltip title="Año anterior">
          <IconButton size="small" onClick={() => onViewChange(subYears(viewDate, 1))}
            sx={{ color: tc.primary, p: '3px' }}>
            <KeyboardDoubleArrowLeftIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Mes anterior">
          <IconButton size="small" onClick={() => onViewChange(subMonths(viewDate, 1))}
            sx={{ color: tc.primary, p: '3px' }}>
            <ChevronLeftIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>

        <Typography variant="caption" sx={{
          flex: 1, textAlign: 'center', fontWeight: 700,
          fontSize: '0.76rem', letterSpacing: '0.03em', color: tc.primary, userSelect: 'none',
        }}>
          {monthLabel}
        </Typography>

        <Tooltip title="Mes siguiente">
          <span>
            <IconButton size="small"
              onClick={() => onViewChange(addMonths(viewDate, 1))}
              disabled={isAfter(startOfMonth(addMonths(viewDate, 1)), maxDate)}
              sx={{ color: tc.primary, p: '3px' }}>
              <ChevronRightIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Año siguiente">
          <span>
            <IconButton size="small"
              onClick={() => onViewChange(addYears(viewDate, 1))}
              disabled={isAfter(startOfMonth(addYears(viewDate, 1)), maxDate)}
              sx={{ color: tc.primary, p: '3px' }}>
              <KeyboardDoubleArrowRightIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Cabecera días */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: '2px' }}>
        {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(d => (
          <Typography key={d} sx={{
            textAlign: 'center', fontWeight: 600, fontSize: '0.62rem',
            color: 'text.secondary', py: '2px',
          }}>
            {d}
          </Typography>
        ))}
      </Box>

      {/* Grilla de días */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
        {days.map((day, i) => {
          const outOfMonth = !isSameMonth(day, viewDate);
          const isDisabled = isAfter(day, maxDate);
          const isFrom     = fromD && isSameDay(day, fromD);
          const isTo_      = toD   && isSameDay(day, toD);
          const inRange    = isInRange(day);
          const isEnd      = isFrom || isTo_;
          const todayDay   = isToday(day);

          return (
            <Box
              key={i}
              onClick={() => !isDisabled && !outOfMonth && onDayClick(day)}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 28, fontSize: '0.76rem', userSelect: 'none',
                cursor: (isDisabled || outOfMonth) ? 'default' : 'pointer',
                borderRadius: isEnd ? '50%' : inRange ? 0 : '50%',
                bgcolor: isEnd
                  ? tc.primary
                  : inRange
                    ? `${tc.primary}20`
                    : 'transparent',
                color: isEnd
                  ? tc.onPrimary
                  : outOfMonth
                    ? '#ccc'
                    : inRange
                      ? tc.primary
                      : todayDay
                        ? tc.primary
                        : '#333',
                fontWeight: (isEnd || todayDay) ? 700 : 400,
                opacity: isDisabled ? 0.3 : 1,
                outline: todayDay && !isEnd ? `1px solid ${tc.primary}50` : 'none',
                outlineOffset: '-2px',
                borderRadius: isEnd ? '50%' : inRange ? 0 : undefined,
                transition: 'background 0.1s',
                '&:hover': (!isDisabled && !outOfMonth) ? {
                  bgcolor: isEnd ? tc.primary : `${tc.primary}35`,
                  borderRadius: '50%',
                } : {},
              }}
            >
              {format(day, 'd')}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/* ─── Componente principal ─── */
// firstDate y loadingFirst vienen del padre — cada contexto (ventas/compras) fetchea el suyo
export default function SalesPickerIcon({ value, onChange, firstDate = null, loadingFirst = false }) {
  const { mode, from, to } = value;

  const [anchorEl,      setAnchorEl]      = useState(null);
  const [customFrom,    setCustomFrom]    = useState('');
  const [customTo,      setCustomTo]      = useState('');
  const [viewDate,      setViewDate]      = useState(new Date());
  const [selectingFrom, setSelectingFrom] = useState(true);

  const open = Boolean(anchorEl);

  /* ── tema ── */
  const readColors = () => {
    if (typeof window === 'undefined') return { primary: '#3b82f6', onPrimary: '#ffffff' };
    const s = getComputedStyle(document.documentElement);
    return {
      primary:   s.getPropertyValue('--color-primary')?.trim()  || '#3b82f6',
      onPrimary: s.getPropertyValue('--on-primary')?.trim()     || '#ffffff',
    };
  };
  const [tc, setTc] = useState(readColors);
  useEffect(() => {
    const upd = () => setTc(readColors());
    ['palette:changed', 'theme:updated', 'business:switched'].forEach(e => window.addEventListener(e, upd));
    return () => ['palette:changed', 'theme:updated', 'business:switched'].forEach(e => window.removeEventListener(e, upd));
  }, []);

  const presets = useMemo(() => buildPresets(firstDate), [firstDate]);

  /* ── abrir ── */
  const handleOpen = useCallback((e) => {
    setAnchorEl(e.currentTarget);
    const base = from ? parseISO(from) : new Date();
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
    setCustomFrom(from || '');
    setCustomTo(to || '');
    setSelectingFrom(true);
  }, [from, to]);

  const handleClose = useCallback(() => setAnchorEl(null), []);

  /* ── click en día ── */
  const handleDayClick = useCallback((day) => {
    const d = ymd(day);
    if (selectingFrom) {
      setCustomFrom(d);
      setCustomTo('');
      setSelectingFrom(false);
    } else {
      if (d < customFrom) {
        setCustomTo(customFrom);
        setCustomFrom(d);
      } else {
        setCustomTo(d);
      }
    }
  }, [selectingFrom, customFrom]);

  /* ── preset ── */
  const applyPreset = useCallback((preset) => {
    if (preset.disabled) return;
    const result = preset.calc();
    onChange({ mode: preset.id, from: result.from, to: result.to });
    handleClose();
  }, [onChange, handleClose]);

  /* ── aplicar rango ── */
  const applyCustomRange = useCallback(() => {
    if (!customFrom || !customTo) return;
    if (!isValidRange(customFrom, customTo)) {
      showAlert('Rango inválido: «Desde» debe ser anterior a «Hasta» y no puede ser fecha futura.', 'warning');
      return;
    }
    onChange({ mode: 'custom', from: customFrom, to: customTo });
    handleClose();
  }, [customFrom, customTo, onChange, handleClose]);

  /* ── label botón ── */
  const rangeLabel = useMemo(() => {
    if (!from || !to) return 'Seleccionar período';
    const label = getRangeLabel(mode, from, to);
    if (label && label !== 'Período') return label;
    try {
      return `${format(parseISO(from), 'dd/MM/yy', { locale: es })} — ${format(parseISO(to), 'dd/MM/yy', { locale: es })}`;
    } catch { return 'Período seleccionado'; }
  }, [from, to, mode]);

  const fromLabel = customFrom ? format(parseISO(customFrom), 'dd/MM/yyyy') : '—';
  const toLabel   = customTo   ? format(parseISO(customTo),   'dd/MM/yyyy') : '—';
  const canApply  = customFrom && customTo && customFrom <= customTo;

  const presetSx = (pid) => ({
    textTransform: 'none', fontSize: 13, flex: '1 1 auto',
    ...(mode === pid
      ? { bgcolor: tc.primary, color: tc.onPrimary, '&:hover': { bgcolor: tc.primary, filter: 'brightness(.9)' } }
      : { borderColor: `${tc.primary}50`, color: tc.primary, '&:hover': { borderColor: tc.primary, bgcolor: `${tc.primary}0d` } }
    ),
  });

  return (
    <>
      <Tooltip title={rangeLabel}>
        <Button
          size="small"
          onClick={handleOpen}
          variant="outlined"
          sx={{
            textTransform: 'none', minWidth: 185, justifyContent: 'flex-start',
            borderColor: tc.primary, color: tc.primary,
            '&:hover': { borderColor: tc.primary, bgcolor: `${tc.primary}10` },
            padding: '7px 9px', fontSize: 13,
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
          paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6, border: `1px solid ${tc.primary}20`, overflow: 'hidden' } }
        }}
      >
        <Box sx={{ p: 2.5, width: 360 }}>
          <Stack spacing={2}>

            {/* Título */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tc.primary }}>
              📅 Seleccionar período
            </Typography>

            {/* Presets — fila 1 */}
            <Stack spacing={0.75}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Rangos rápidos
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {presets.slice(0, 5).map(p => (
                  <Button key={p.id} variant={mode === p.id ? 'contained' : 'outlined'}
                    size="small" onClick={() => applyPreset(p)} sx={presetSx(p.id)}>
                    {p.label}
                  </Button>
                ))}
              </Stack>
              {/* Fila 2: mes anterior, año anterior, histórico */}
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {presets.slice(5).map(p => (
                  <Button key={p.id} variant={mode === p.id ? 'contained' : 'outlined'}
                    size="small" onClick={() => applyPreset(p)} disabled={p.disabled}
                    title={p.id === 'all' && !firstDate ? 'Sin datos históricos disponibles' : undefined}
                    sx={{ ...presetSx(p.id), flex: '1 1 auto' }}>
                    {p.id === 'all' && loadingFirst ? '…' : p.label}
                  </Button>
                ))}
              </Stack>
            </Stack>

            <Divider sx={{ borderColor: `${tc.primary}20` }} />

            {/* Rango personalizado */}
            <Stack spacing={1}>
              <Typography variant="caption" sx={{ color: tc.primary, fontWeight: 600 }}>
                Rango personalizado
              </Typography>

              {/* Indicador DESDE → HASTA clickeable */}
              <Box sx={{
                p: '6px 10px', borderRadius: 1.5,
                bgcolor: `${tc.primary}08`, border: `1px solid ${tc.primary}20`,
              }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box
                    onClick={() => setSelectingFrom(true)}
                    sx={{
                      textAlign: 'center', cursor: 'pointer', flex: 1,
                      borderRadius: 1, p: '2px 6px',
                      bgcolor: selectingFrom ? `${tc.primary}18` : 'transparent',
                      border: selectingFrom ? `1px solid ${tc.primary}50` : '1px solid transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.06em' }}>
                      DESDE
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: customFrom ? tc.primary : '#bbb' }}>
                      {fromLabel}
                    </Typography>
                  </Box>

                  <Typography sx={{ color: `${tc.primary}60`, fontSize: '1.1rem', mx: 0.75, lineHeight: 1 }}>→</Typography>

                  <Box
                    onClick={() => customFrom && setSelectingFrom(false)}
                    sx={{
                      textAlign: 'center', cursor: customFrom ? 'pointer' : 'default', flex: 1,
                      borderRadius: 1, p: '2px 6px',
                      bgcolor: !selectingFrom && customFrom ? `${tc.primary}18` : 'transparent',
                      border: !selectingFrom && customFrom ? `1px solid ${tc.primary}50` : '1px solid transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.06em' }}>
                      HASTA
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: customTo ? tc.primary : '#bbb' }}>
                      {toLabel}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Calendario */}
              <MiniCalendar
                viewDate={viewDate}
                onViewChange={setViewDate}
                fromDate={customFrom}
                toDate={customTo}
                selectingFrom={selectingFrom}
                onDayClick={handleDayClick}
                tc={tc}
              />

              {/* Hint */}
              <Typography variant="caption" sx={{ color: `${tc.primary}80`, fontStyle: 'italic', textAlign: 'center' }}>
                {selectingFrom
                  ? 'Hacé click en el día de inicio'
                  : customTo
                    ? 'Rango seleccionado — podés ajustarlo o aplicar'
                    : 'Ahora seleccioná el día de fin'}
              </Typography>
            </Stack>

            {/* Botones */}
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ pt: 0.5 }}>
              <Button onClick={handleClose} size="small"
                sx={{ textTransform: 'none', color: 'text.secondary' }}>
                Cancelar
              </Button>
              <Button
                onClick={applyCustomRange}
                variant="contained"
                size="small"
                disabled={!canApply}
                sx={{
                  textTransform: 'none',
                  bgcolor: tc.primary, color: tc.onPrimary,
                  '&:hover': { bgcolor: tc.primary, filter: 'brightness(.9)' },
                  '&.Mui-disabled': { opacity: 0.4 },
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