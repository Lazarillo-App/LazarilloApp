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
//  - PROMOCIÓN (promoMode): igual que el artículo (Diego 11/11/2026); a la derecha «sin promo →
//    promo → descuento» en una línea y el % de costo debajo del precio de la promo; el precio
//    actual va a la izquierda.
//  - STAFF (isStaff): sin sugerido ni %.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Box, Typography, IconButton, Stack, Slider, TextField, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { canonicalUnit, fmt } from './helpers';
import { useAccess } from '@/context/AccessContext';

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
  cambiarObjetivo,
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
  // Promo con regla '% off' o 'llevás N, pagás M' (ej. "10% off", "6x5"): el precio sale de la
  // regla y no se toca a mano — sin barra ni doble clic.
  etiquetaRegla = null,
  // % off / llevás N pagás M: + / − mueven el PRECIO de la promo (paso = redondeo de Configuración).
  onAjustarPrecioPromo = null,
  // Promo de un solo artículo: su precio individual, editable acá (atado al de la promo).
  // { nombre, precio, editado, onCambiar(v), paso }
  articuloPromo = null,
}) {
  const { isJefe } = useAccess() || {};
  const [editArt, setEditArt] = React.useState(null);
  const [editandoObjPromo, setEditandoObjPromo] = React.useState(false);
  const botonChico = { width: 22, height: 22, p: 0, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } };
  return (
    <Box sx={{ flexShrink: 0, px: 2.5, pt: 1.5 }}>
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: (() => {
        const ocultarExtras = modoInsumo && !verCostosExtra;
        const colPeso = Number(rendimientoPeso) > 0 ? 1 : 0;
        // Artículo y promoción: el % de costo va fusionado con el costo (no tiene columna propia).
        // Diego 11/11/2026: el pie de la promo es igual al de cualquier producto.
        const esPieArticulo = !modoInsumo;
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

      {(() => {
        const labelBase = Number(rendimiento) > 1 || rendimientoUnidad !== 'porcion' ? labelPorUnidad : 'Costo total';
        // Jefe de cocina (Diego 11/11/2026): ve el % de costo y el precio, sin editar objetivo ni precio.
        const conPct = !modoInsumo && (!isStaff || isJefe) && pctCostoActual !== null;
        const conObjetivo = !modoInsumo && !isStaff && !etiquetaRegla;
        const titulo = { variant: 'caption', color: 'text.secondary', fontWeight: 600, sx: { display: 'block', whiteSpace: 'nowrap' } };
        if (promoMode) {
          // Promo (Diego 11/11/2026): grilla de 2 columnas — costo | % ; el campo del % costo objetivo
          // va pegado debajo del % costo actual (los dos % alineados) y el precio actual al final.
          const colorPct = pctCostoActual > pctCostoIdeal ? '#ef4444' : 'success.main';
          const ANCHO_PCT = 54;
          return (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 4, rowGap: 0, alignItems: 'end', justifyContent: 'start' }}>
              <Typography {...titulo}>{labelBase}</Typography>
              <Typography {...titulo} sx={{ ...titulo.sx, justifySelf: 'end' }}>% costo actual</Typography>
              <Typography variant="h6" fontWeight={800} sx={{ whiteSpace: 'nowrap', lineHeight: '30px' }}>${fmt(costoXRendimiento)}</Typography>
              {/* Mismo armado que el campo de abajo (caja de ANCHO_PCT + «%») para que el 65 y el 66
                  arranquen en el mismo lugar y los dos % queden alineados (Diego 11/11/2026). */}
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ justifySelf: 'end', color: colorPct }}>
                <Typography variant="h6" fontWeight={800} sx={{ width: ANCHO_PCT, pl: '4px', boxSizing: 'border-box', whiteSpace: 'nowrap', lineHeight: '30px', color: 'inherit' }}>
                  {conPct ? fmt(pctCostoActual, 1) : '—'}
                </Typography>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1, color: 'inherit' }}>%</Typography>
              </Stack>
              {/* Objetivo (Diego 11/11/2026): título en la columna izquierda y el precio actual debajo;
                  el campo, chico, en la columna del %, con el % afuera y alineado con el % actual. */}
              {conObjetivo ? (<>
                <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', alignSelf: 'center' }}>% costo objetivo</Typography>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ justifySelf: 'end' }}>
                  <TextField
                    size="small"
                    type="text"
                    inputMode="decimal"
                    // Con un decimal, igual que el % actual (66,0); al editar se ve el número tal cual.
                    value={editandoObjPromo ? String(pctCostoIdeal ?? '').replace('.', ',') : fmt(pctCostoIdeal, 1)}
                    onChange={(e) => cambiarObjetivo(e.target.value)}
                    onFocus={(e) => { setEditandoObjPromo(true); const el = e.target; setTimeout(() => el.select(), 0); }}
                    onBlur={() => { setEditandoObjPromo(false); commitObjetivo(pctCostoIdeal); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                    inputProps={{ style: { textAlign: 'left', fontSize: '1.25rem', fontWeight: 800, padding: '0 0 0 4px' } }}
                    sx={{ width: ANCHO_PCT, bgcolor: 'background.paper', '& .MuiOutlinedInput-root': { height: 32 } }}
                  />
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1 }}>%</Typography>
                </Stack>
              </>) : null}
              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: estaPorDebajo ? '#ef4444' : 'text.secondary', mt: 0.5 }}>
                {precioActual > 0 && (!isStaff || isJefe) ? `Precio actual: $${fmt(precioActual)}` : ''}
              </Typography>
              <span />
            </Box>
          );
        }
        return (
          // Artículo y promo: "% costo actual" y "% costo objetivo" lado a lado, títulos en la misma
          // línea y valores en la misma línea (Diego 11/11/2026). El objetivo se edita acá.
          <Stack direction="row" spacing={4} alignItems="flex-start">
            <Box>
              <Typography {...titulo}>
                {conPct ? (labelBase === 'Costo total' ? '% costo actual' : `${labelBase} · % costo actual`) : labelBase}
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ whiteSpace: 'nowrap', lineHeight: '36px' }}>
                ${fmt(costoXRendimiento)}
                {conPct && (
                  <>
                    <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400, mx: 0.75 }}>·</Box>
                    <Box component="span" sx={{ color: pctCostoActual > pctCostoIdeal ? '#ef4444' : 'success.main' }}>{fmt(pctCostoActual, 1)}%</Box>
                  </>
                )}
              </Typography>
              {/* % off y llevás N pagás M no tienen objetivo: el precio sale de la regla */}
              {!modoInsumo && !isStaff && etiquetaRegla && (
                <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
                  % con el precio actual
                </Typography>
              )}
              {/* Promo: el precio actual va a la izquierda, con todo lo actual (Diego 11/11/2026). */}
              {!isStaff && promoMode && precioActual > 0 && (
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: estaPorDebajo ? '#ef4444' : 'text.secondary' }}>
                  Precio actual: ${fmt(precioActual)}
                </Typography>
              )}
            </Box>
            {isJefe && !modoInsumo && Number(precioActual) > 0 && (
              <Box>
                <Typography {...titulo}>Precio de venta</Typography>
                <Typography variant="h6" fontWeight={800} sx={{ whiteSpace: 'nowrap', lineHeight: '36px' }}>${fmt(precioActual)}</Typography>
              </Box>
            )}
            {conObjetivo && (
              <Box>
                <Typography {...titulo}>% costo objetivo</Typography>
                <TextField
                  size="small"
                  type="text"
                  inputMode="decimal"
                  value={String(pctCostoIdeal ?? '').replace('.', ',')}
                  onChange={(e) => cambiarObjetivo(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => commitObjetivo(pctCostoIdeal)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                  InputProps={{ endAdornment: <InputAdornment position="end" sx={{ ml: 0.25, '& p': { fontSize: '1.1rem', fontWeight: 800, color: 'text.primary' } }}>%</InputAdornment> }}
                  inputProps={{ style: { textAlign: 'center', fontSize: '1.25rem', fontWeight: 800, padding: '0 4px' } }}
                  sx={{ width: 96, bgcolor: 'background.paper', '& .MuiOutlinedInput-root': { height: 36, pr: 1.25 } }}
                />
              </Box>
            )}
          </Stack>
        );
      })()}
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
        {articuloPromo && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ my: 0.25, whiteSpace: 'nowrap' }}>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
              {articuloPromo.nombre} c/u:
            </Typography>
            <IconButton size="small" title="Bajar el precio del artículo" onClick={() => articuloPromo.onCambiar(articuloPromo.precio - articuloPromo.paso)} sx={botonChico}>
              <RemoveIcon sx={{ fontSize: 14 }} />
            </IconButton>
            {editArt != null ? (
              <input autoFocus type="number" value={editArt}
                onChange={(e) => setEditArt(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => { articuloPromo.onCambiar(editArt); setEditArt(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { articuloPromo.onCambiar(editArt); setEditArt(null); } if (e.key === 'Escape') setEditArt(null); }}
                style={{ width: 80, font: 'inherit', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: 4 }} />
            ) : (
              <Typography variant="caption" title="Doble clic para escribir el precio"
                onDoubleClick={() => setEditArt(String(Math.round(articuloPromo.precio)))}
                sx={{ fontSize: '0.8rem', fontWeight: 800, cursor: 'text', color: articuloPromo.editado ? 'primary.main' : 'text.primary' }}>
                ${fmt(articuloPromo.precio)}
              </Typography>
            )}
            <IconButton size="small" title="Subir el precio del artículo" onClick={() => articuloPromo.onCambiar(articuloPromo.precio + articuloPromo.paso)} sx={botonChico}>
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
            {articuloPromo.editado && (
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'primary.main', fontWeight: 600 }}>nuevo precio</Typography>
            )}
          </Stack>
        )}
        {promoMode && ventaSinPromo > 0 ? null : etiquetaRegla ? (
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Precio de la promo ({etiquetaRegla})
          </Typography>
        ) : (
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Precio sugerido ({pctCostoIdeal}% costo)
        </Typography>
        )}
        {/* Promo: «sin promo → promo → descuento» en una línea para comparar de un vistazo (Diego 11/11/2026). */}
        {promoMode && ventaSinPromo > 0 ? (
          <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ whiteSpace: 'nowrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block' }}>Sin promo</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: 'text.secondary' }}>${fmt(ventaSinPromo)}</Typography>
            </Box>
            <Typography variant="h6" sx={{ color: 'text.disabled', fontWeight: 400, pt: '20px' }}>→</Typography>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block' }}>
                {etiquetaRegla ? `Promo (${etiquetaRegla})` : `Promo (${pctCostoIdeal}% costo)`}
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
              {/* % de costo con el precio de la promo: debajo del precio al que se refiere; solo si se movió. */}
              {precioSugerido > 0 && costoXRendimiento > 0 && Math.round(precioSugerido) !== Math.round(precioActual || 0) && (
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 700,
                  color: etiquetaRegla ? 'text.secondary' : ((costoXRendimiento / precioSugerido) * 100 > pctCostoIdeal ? '#ef4444' : 'success.main') }}>
                  {fmt((costoXRendimiento / precioSugerido) * 100, 1)}% de costo
                </Typography>
              )}
            </Box>
            {precioSugerido > 0 && precioSugerido < ventaSinPromo && (
              <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#7c3aed', pt: '24px' }}>
                −{fmt((1 - precioSugerido / ventaSinPromo) * 100, 1)}%
              </Typography>
            )}
          </Stack>
        ) : (
          <>
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
          </>
        )}
        {sugeridoExcedeVenta && (
          <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
            <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />
            <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444' }}>
              Supera la venta sin promo
            </Typography>
          </Stack>
        )}
        {promoMode && !(ventaSinPromo > 0) && precioSugerido > 0 && costoXRendimiento > 0 && (
          <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', whiteSpace: 'nowrap',
            color: etiquetaRegla ? 'text.secondary' : ((costoXRendimiento / precioSugerido) * 100 > pctCostoIdeal ? '#ef4444' : 'success.main') }}>
            {fmt((costoXRendimiento / precioSugerido) * 100, 1)}% de costo con este precio
          </Typography>
        )}
        {/* Artículo: "Actual" y la barra del objetivo comparten renglón (la barra, corta) */}
        <Box sx={!modoInsumo ? { display: 'flex', alignItems: 'center', gap: 2, mt: 0.25 } : undefined}>
        {precioActual > 0 && !promoMode && (
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
        {/* Promo de un solo artículo: el precio se mueve desde el artículo c/u; estos +/- sobran. */}
        {etiquetaRegla && onAjustarPrecioPromo && !articuloPromo && (
          <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
            <IconButton size="small" title="Bajar el precio de la promo" onClick={() => onAjustarPrecioPromo(-1)} sx={botonChico}>
              <RemoveIcon sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton size="small" title="Subir el precio de la promo" onClick={() => onAjustarPrecioPromo(1)} sx={botonChico}>
              <AddIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        )}
        {!etiquetaRegla && (() => {
          const barraPorPrecio = !modoInsumo && costoXRendimiento > 0;
          const pctObj = Number(pctCostoIdeal) || 0;
          // La barra va al revés del %: a la derecha, % más bajo = precio más alto.
          // (Se usa el % negado como valor para que cada paso sea 1 punto parejo.)
          const botonSx = {
            width: 22, height: 22, p: 0,
            bgcolor: 'action.hover',
            '&:hover': { bgcolor: 'action.selected' },
          };
          return (
        <Stack direction="row" alignItems="center" spacing={0.25} sx={!modoInsumo ? { width: 200, flexShrink: 0 } : { mt: 0.5 }}>
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
    </Box>
    </Box>
  );
}
