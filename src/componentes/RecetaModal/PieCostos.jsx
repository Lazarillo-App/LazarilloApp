// src/componentes/RecetaModal/PieCostos.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Pie de costos del modal de receta (fijo, entre el cuerpo que scrollea y los
// botones). Separado de index.jsx para que cada cambio del pie se pueda hacer
// sin tocar el modal entero. Es el mismo JSX que vivía en index.jsx, sin cambios:
// todo el estado y los cálculos siguen en index.jsx y llegan por props.
//
// Variantes (las decide index.jsx con modoInsumo / promoMode / isStaff):
//  - INSUMO ELABORADO (modoInsumo): Costo total · Costo/porción · Costo/kg; el 👁
//    muestra/oculta sugerido y % (verCostosExtra).
//  - ARTÍCULO (!modoInsumo && !promoMode): costo y % en una línea + objetivo;
//    precio sugerido con la barra que mueve el PRECIO.
//  - PROMOCIÓN (promoMode): venta sin promo, sugerido con barra de %, % costo actual.
//  - STAFF (isStaff): sin sugerido ni %.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Box, Typography, IconButton, Stack, Slider, TextField, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { canonicalUnit, fmt } from './helpers';

export default function PieCostos({
  modoInsumo,
  verCostosExtra,
  setVerCostosExtra,
  rendimientoPeso,
  rendimiento,
  rendimientoUnidad,
  costoTotalMostrado,
  labelPorUnidad,
  costoXRendimiento,
  unidadPeso,
  isStaff,
  promoMode,
  ventaSinPromo,
  colorSinPromo,
  editandoObjetivo,
  setEditandoObjetivo,
  objetivoDraft,
  setObjetivoDraft,
  commitObjetivo,
  pctCostoIdeal,
  setPctCostoIdeal,
  editandoPrecioSugerido,
  setEditandoPrecioSugerido,
  precioSugeridoDraft,
  setPrecioSugeridoDraft,
  commitPrecioSugerido,
  precioSugerido,
  sugeridoExcedeVenta,
  precioActual,
  estaPorDebajo,
  pctCostoActual,
}) {
  return (
    <Box sx={{ flexShrink: 0, px: 2.5, pt: 1.5 }}>
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: (() => {
        const ocultarExtras = modoInsumo && !verCostosExtra;
        const colPeso = Number(rendimientoPeso) > 0 ? 1 : 0;
        // Artículo: el % de costo va fusionado con el costo (no tiene columna propia).
        const esPieArticulo = !modoInsumo && !promoMode;
        const cols = (Number(rendimiento) > 1 ? 2 : 1) + colPeso + (ocultarExtras ? 0 : (esPieArticulo ? 1 : 2));
        return `repeat(${cols}, 1fr)`;
      })(),
      gap: 1.5,
      bgcolor: 'action.hover',
      borderRadius: 1.5, p: 2,
      mb: 2,
      position: 'relative',
    }}>
      {modoInsumo && (
        <IconButton
          size="small"
          onClick={() => setVerCostosExtra(v => !v)}
          sx={{ position: 'absolute', top: 4, right: 4, p: 0.25 }}
          title={verCostosExtra ? 'Ocultar sugerido y % costo' : 'Ver sugerido y % costo'}
        >
          <VisibilityIcon sx={{ fontSize: 16, opacity: 0.6 }} />
        </IconButton>
      )}
      {Number(rendimiento) > 1 && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>Costo total</Typography>
          <Typography variant="h6" fontWeight={800}>${fmt(costoTotalMostrado)}</Typography>
        </Box>
      )}

      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {Number(rendimiento) > 1 || rendimientoUnidad !== 'porcion'
            ? labelPorUnidad
            : 'Costo total'}
        </Typography>
        {!modoInsumo && !promoMode ? (
          <>
            {/* Artículo: costo y su % sobre el precio actual en una sola línea, objetivo abajo */}
            <Typography variant="h6" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
              ${fmt(costoXRendimiento)}
              {!isStaff && pctCostoActual !== null && (
                <>
                  <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400, mx: 0.75 }}>·</Box>
                  <Box component="span" sx={{ color: pctCostoActual > pctCostoIdeal ? '#ef4444' : 'success.main' }}>{fmt(pctCostoActual, 1)}%</Box>
                </>
              )}
            </Typography>
            {!isStaff && (
              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
                Objetivo: {pctCostoIdeal}%
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="h6" fontWeight={800}>${fmt(costoXRendimiento)}</Typography>
        )}
      </Box>
      {Number(rendimientoPeso) > 0 && (() => {
        // Mostrar el costo por unidad GRANDE: gr→kg, ml→L (× 1000).
        const uBase = canonicalUnit(unidadPeso || 'gr');
        const esPeso = uBase === 'gr' || uBase === 'kg';
        const uGrande = esPeso ? 'kg' : 'lt';
        // costo por unidad base (gr/ml) × 1000 = costo por unidad grande (kg/L)
        const costoUnitBase = costoXRendimiento / Number(rendimientoPeso);
        const costoGrande = costoUnitBase * 1000;
        return (
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Costo / {uGrande} (÷{fmt(Number(rendimientoPeso))} {uBase})
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              ${fmt(costoGrande)}
            </Typography>
          </Box>
        );
      })()}
      {(!modoInsumo || verCostosExtra) && <Box sx={{ display: isStaff ? 'none' : undefined }}>
        {/* KPI Venta sin promo — solo en promos, como leyenda arriba del sugerido */}
        {promoMode && ventaSinPromo > 0 && (
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: colorSinPromo, fontSize: '0.75rem' }}>
            Venta sin promo: ${fmt(ventaSinPromo)}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Precio sugerido (
          {editandoObjetivo ? (
            <input
              autoFocus
              type="number"
              min={0}
              max={150}
              value={objetivoDraft}
              onChange={(e) => setObjetivoDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => { commitObjetivo(objetivoDraft); setEditandoObjetivo(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { commitObjetivo(objetivoDraft); setEditandoObjetivo(false); }
                if (e.key === 'Escape') setEditandoObjetivo(false);
              }}
              style={{ width: 34, font: 'inherit', fontWeight: 700, textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: 4 }}
            />
          ) : (
            <span
              onDoubleClick={() => { setObjetivoDraft(String(pctCostoIdeal)); setEditandoObjetivo(true); }}
              title="Doble click para editar"
              style={{ cursor: 'text', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
            >
              {pctCostoIdeal}
            </span>
          )}
          % costo)
        </Typography>
        {editandoPrecioSugerido ? (
          <TextField
            autoFocus
            size="small"
            type="number"
            variant="standard"
            value={precioSugeridoDraft}
            onChange={(e) => setPrecioSugeridoDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => { commitPrecioSugerido(precioSugeridoDraft); setEditandoPrecioSugerido(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { commitPrecioSugerido(precioSugeridoDraft); setEditandoPrecioSugerido(false); }
              if (e.key === 'Escape') setEditandoPrecioSugerido(false);
            }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment>, sx: { fontSize: '1.25rem', fontWeight: 800 } }}
            sx={{ width: 120 }}
          />
        ) : (
          <Typography
            variant="h6"
            fontWeight={800}
            onDoubleClick={() => { setPrecioSugeridoDraft(String(Math.round(precioSugerido))); setEditandoPrecioSugerido(true); }}
            title="Doble click para editar"
            sx={{ color: sugeridoExcedeVenta ? '#ef4444' : 'success.main', cursor: 'text' }}
          >
            {precioSugerido > 0 ? `$${fmt(precioSugerido)}` : '—'}
          </Typography>
        )}
        {sugeridoExcedeVenta && (
          <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
            <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />
            <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444' }}>
              Supera la venta sin promo
            </Typography>
          </Stack>
        )}
        {/* Artículo: "Actual" y la barra del objetivo comparten renglón (la barra, corta) */}
        <Box sx={!modoInsumo && !promoMode ? { display: 'flex', alignItems: 'center', gap: 2, mt: 0.25 } : undefined}>
        {precioActual > 0 && (
          <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25} sx={{ whiteSpace: 'nowrap' }}>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: estaPorDebajo ? '#ef4444' : 'text.secondary' }}>Actual: ${fmt(precioActual)}</Typography>
            {estaPorDebajo && <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />}
          </Stack>
        )}
        {/* Barra de ajuste — debajo del sugerido, visible siempre.
            ARTÍCULO: la barra mueve el PRECIO sugerido (izquierda = más barato, derecha = más caro)
            y el % de costo objetivo lo sigue (% = costo ÷ precio). Se guarda igual que antes: como
            objetivo entero (commitObjetivo), así que el precio salta de a 1 punto de % (5% a 90%).
            Elaborados y promociones: la barra sigue moviendo el % directamente. */}
        {(() => {
          const barraPorPrecio = !modoInsumo && !promoMode && costoXRendimiento > 0;
          const pctObj = Number(pctCostoIdeal) || 0;
          // La barra va al revés del %: a la derecha, % más bajo = precio más alto.
          // (Se usa el % negado como valor para que cada paso sea 1 punto parejo.)
          const botonSx = {
            width: 22, height: 22, p: 0,
            bgcolor: 'action.hover',
            '&:hover': { bgcolor: 'action.selected' },
          };
          return (
        <Stack direction="row" alignItems="center" spacing={0.25} sx={!modoInsumo && !promoMode ? { width: 200, flexShrink: 0 } : { mt: 0.5 }}>
          <IconButton
            size="small"
            title={barraPorPrecio ? 'Bajar el precio sugerido' : undefined}
            onClick={() => commitObjetivo(pctObj + (barraPorPrecio ? 1 : -1))}
            sx={botonSx}
          >
            <RemoveIcon sx={{ fontSize: 15 }} />
          </IconButton>
          {barraPorPrecio ? (
            <Slider
              value={-Math.min(90, Math.max(5, pctObj || 50))}
              min={-90}
              max={-5}
              step={1}
              size="small"
              onChange={(_, val) => setPctCostoIdeal(-val)}
              onChangeCommitted={(_, val) => commitObjetivo(-val)}
              sx={{ py: 0.5, flex: 1 }}
            />
          ) : (
            <Slider
              value={pctObj}
              min={0}
              max={100}
              step={1}
              size="small"
              onChange={(_, val) => setPctCostoIdeal(val)}
              onChangeCommitted={(_, val) => commitObjetivo(val)}
              sx={{ py: 0.5, flex: 1 }}
            />
          )}
          <IconButton
            size="small"
            title={barraPorPrecio ? 'Subir el precio sugerido' : undefined}
            onClick={() => commitObjetivo(pctObj + (barraPorPrecio ? -1 : 1))}
            sx={botonSx}
          >
            <AddIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Stack>
          );
        })()}
        </Box>
      </Box>}
      {!modoInsumo && promoMode && <Box sx={{ display: isStaff ? 'none' : undefined }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>% Costo actual</Typography>
        {pctCostoActual !== null ? (
          <>
            <Typography variant="h6" fontWeight={800} color={pctCostoActual > pctCostoIdeal ? '#ef4444' : 'success.main'}>{fmt(pctCostoActual, 1)}%</Typography>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>Ideal: {pctCostoIdeal}%</Typography>
          </>
        ) : (
          <Typography variant="h6" color="text.disabled">—</Typography>
        )}
      </Box>}
    </Box>
    </Box>
  );
}
