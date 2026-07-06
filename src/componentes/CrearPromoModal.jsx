/* eslint-disable no-unused-vars */
// src/componentes/CrearPromoModal.jsx
// Modal para crear una promoción, con la UI espejo de RecetaModal.
// Función y estado separados: una promo es un artículo nuevo cuya "receta"
// contiene otros artículos (+ insumos opcionales). Carga sus propios datos.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal, Box, Stack, Typography, TextField, Button, IconButton,
  InputAdornment, Divider, CircularProgress, MenuItem, FormControl, Select,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RecetaModal from './RecetaModal';
import { BusinessesAPI, PromocionesAPI, RecetasAPI } from '@/servicios/apiBusinesses';
import { insumosList } from '@/servicios/apiInsumos';
import { getReceta } from '@/servicios/apiOrganizations';

const PRIMARY = 'var(--color-primary, #3b82f6)';
const ON_PRIMARY = 'var(--on-primary, #fff)';
const UNIDADES = ['u', 'kg', 'gr', 'l', 'ml'];

const fmt = (v) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
};

const sanitizeDecimal = (raw) =>
  String(raw ?? '').replace(/[^\d.,]/g, '').replace(',', '.').replace(/(\..*)\./g, '$1');

// Fila de artículo componente (estilo ItemRow simplificado)
const TIPO_COSTO_OPTS = [
  { value: 'maxi', label: 'Maxi DB' },
  { value: 'total', label: 'Total' },
  { value: 'sugerido', label: 'Sugerido' },
  { value: 'nulo', label: 'Nulo' },
];

function CompRow({ comp, costoUnit, onChange, onRemove, onOpenReceta, autoFocus, onFocused }) {
  const total = costoUnit * (Number(comp.cantidad) || 0);
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '28px 1fr 96px 64px 60px 84px 32px',
      gap: 0.6, alignItems: 'center', mb: 0.75,
    }}>
      <CheckCircleIcon sx={{ fontSize: 15, color: 'success.main' }} />
      <Box
        onClick={() => onOpenReceta?.(comp)}
        sx={{
          border: '1px solid', borderColor: 'success.light', borderRadius: 1,
          px: 0.75, py: 0.4, minHeight: 30, display: 'flex', alignItems: 'center', gap: 1,
          cursor: 'pointer', overflow: 'hidden',
          '&:hover': { borderColor: PRIMARY },
        }}
        title="Ver / editar la receta de este artículo"
      >
        <Typography variant="caption" noWrap sx={{ flex: 1, fontSize: '0.78rem', fontWeight: 600 }}>
          {comp.nombre}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: PRIMARY, fontWeight: 700, flexShrink: 0 }}>
          {costoUnit > 0 ? `$${fmt(costoUnit)}/u` : '—'}
        </Typography>
      </Box>
      <FormControl size="small">
        <Select value={comp.tipoCosto || 'maxi'} onChange={e => onChange({ tipoCosto: e.target.value })}
          sx={{ fontSize: '0.72rem', '& .MuiSelect-select': { py: '4px', fontSize: '0.72rem' } }}>
          {TIPO_COSTO_OPTS.map(o => <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.75rem' }}>{o.label}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField
        size="small" type="text" inputMode="decimal"
        value={comp.cantidad === '' ? '' : String(comp.cantidad).replace('.', ',')}
        onChange={e => onChange({ cantidad: sanitizeDecimal(e.target.value) })}
        inputProps={{ style: { textAlign: 'right', fontSize: '0.78rem', padding: '4px 6px' } }}
        autoFocus={autoFocus}
        onFocus={e => { e.target.select(); onFocused?.(); }}
      />
      <FormControl size="small">
        <Select value={comp.unidad} onChange={e => onChange({ unidad: e.target.value })}
          sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: '4px', fontSize: '0.75rem' } }}>
          {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
        </Select>
      </FormControl>
      <Typography variant="caption" sx={{ textAlign: 'right', fontWeight: 700, color: PRIMARY }}>
        {total > 0 ? `$${fmt(total)}` : '—'}
      </Typography>
      <IconButton size="small" onClick={onRemove}>
        <DeleteOutlineIcon sx={{ fontSize: 16 }} color="error" />
      </IconButton>
    </Box>
  );
}

export default function CrearPromoModal({
  open,
  onClose,
  businessId,
  onCreated,
  promoExistente = null,
}) {
  const [articulos, setArticulos] = useState([]);
  const [insumosCat, setInsumosCat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [nombreEditado, setNombreEditado] = useState(false);
  const [pctObjetivo, setPctObjetivo] = useState(30);
  const [componentes, setComponentes] = useState([]);
  const [insumosSel, setInsumosSel] = useState([]);

  const [queryArt, setQueryArt] = useState('');
  const [queryIns, setQueryIns] = useState('');
  const bodyRef = useRef(null);

  const [recetaComp, setRecetaComp] = useState(null);

  const [focusIdx, setFocusIdx] = useState(null);
  const [focusInsIdx, setFocusInsIdx] = useState(null);

  useEffect(() => {
    if (!open || !businessId) return;
    setLoading(true);
    Promise.all([
      BusinessesAPI.articlesFromDB(businessId).catch(() => ({ items: [] })),
      insumosList(businessId, { limit: 99999 }).catch(() => ({ data: [] })),
      RecetasAPI.getCostos(businessId).catch(() => ({ costos: {} })),
    ]).then(async ([artResp, insResp, costosResp]) => {
      const costos = costosResp?.costos || {};
      const arts = Array.isArray(artResp?.items) ? artResp.items : [];
      setArticulos(arts.map(a => {
        const id = Number(a.id ?? a.articulo_id);
        // Costo real = costoTotal de su receta si existe, sino el costo base
        const costoReceta = Number(costos[id]?.costoTotal) || 0;
        return {
          id,
          nombre: String(a.nombre || a.name || `#${a.id}`),
          costoTotal: costoReceta,            // costo de su receta (0 si no tiene)
          precioMaxi: Number(a.precio) || 0,  // precio base de Maxi DB
          subrubro: a.subrubro || a.categoria || '',
        };
      }).filter(a => Number.isFinite(a.id)));
      const ins = Array.isArray(insResp?.data) ? insResp.data
        : Array.isArray(insResp?.insumos) ? insResp.insumos : [];
      setInsumosCat(ins);

      // ── Modo edición: precargar la promo existente ──
      if (promoExistente?.id != null) {
        const promoId = Number(promoExistente.id);
        try {
          const receta = await getReceta(businessId, promoId);
          const items = receta?.items || [];
          setNombre(receta?.nombre || promoExistente.nombre || '');
          setNombreEditado(true);
          setPctObjetivo(Number(receta?.porcentaje_venta) || Number(promoExistente.objetivoResuelto) || 30);

          const comps = [];
          const insus = [];
          for (const it of items) {
            if (it.article_ref_id != null && Number(it.article_ref_id) !== 0) {
              const refId = Number(it.article_ref_id);
              const costoReceta = Number(costos[refId]?.costoTotal) || 0;
              const artMeta = arts.find(a => Number(a.id ?? a.articulo_id) === refId);
              comps.push({
                id: refId,
                nombre: it.supply_nombre || it.nombre_insumo_maxi || artMeta?.nombre || `#${refId}`,
                costoTotal: costoReceta,
                precioMaxi: Number(artMeta?.precio) || Number(it.costo_unitario) || 0,
                cantidad: Number(it.cantidad) || 1,
                unidad: it.unidad || 'u',
                tipoCosto: it.tipo_costo || 'maxi',
              });
            } else if (it.supply_id != null) {
              const insId = Number(it.supply_id);
              const insMeta = ins.find(x => Number(x.id) === insId);
              const esElab = insMeta?.es_elaborado === true || insMeta?.tiene_receta === true;
              insus.push({
                id: insId,
                nombre: it.supply_nombre || insMeta?.nombre || `#${insId}`,
                precio_ref: Number(insMeta?.precio_ref) || Number(it.precio_ref_db) || 0,
                costoTotal: Number(insMeta?.costo_receta) || 0,
                esElaborado: esElab,
                unidad_med: insMeta?.unidad_med || 'u',
                cantidad: Number(it.cantidad) || 1,
                unidad: it.unidad || 'u',
                tipoCosto: it.tipo_costo || (esElab ? 'total' : 'maxi'),
              });
            }
          }
          setComponentes(comps);
          setInsumosSel(insus);
        } catch (e) {
          console.warn('[CrearPromoModal] no se pudo precargar la promo:', e.message);
        }
      }
    }).finally(() => setLoading(false));
  }, [open, businessId, promoExistente]);

  useEffect(() => {
    if (open) return;
    setNombre(''); setNombreEditado(false); setComponentes([]);
    setInsumosSel([]); setQueryArt(''); setQueryIns(''); setError(''); setPctObjetivo(30);
  }, [open]);

  useEffect(() => {
    if (nombreEditado) return;
    setNombre(componentes.map(c => c.nombre).join(' + '));
  }, [componentes, nombreEditado]);

  const idsUsados = useMemo(() => new Set(componentes.map(c => c.id)), [componentes]);

  const artFiltrados = useMemo(() => {
    const q = queryArt.trim().toLowerCase();
    if (!q) return [];
    return articulos
      .filter(a => !idsUsados.has(a.id))
      .filter(a => a.nombre.toLowerCase().includes(q) || String(a.id).includes(q))
      .slice(0, 8);
  }, [queryArt, articulos, idsUsados]);

  const insFiltrados = useMemo(() => {
    const q = queryIns.trim().toLowerCase();
    if (!q) return [];
    const idsIns = new Set(insumosSel.map(i => i.id));
    return insumosCat
      .filter(i => !idsIns.has(Number(i.id)))
      .filter(i => String(i.nombre || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [queryIns, insumosCat, insumosSel]);

  const costoIns = useCallback((i) => {
    const obj = Number(pctObjetivo) || 30;
    switch (i.tipoCosto) {
      case 'nulo': return 0;
      case 'total': return Number(i.costoTotal) || 0;
      case 'sugerido': return obj > 0 ? (Number(i.costoTotal) || 0) / (obj / 100) : 0;
      case 'maxi':
      default: return Number(i.precio_ref) || 0;
    }
  }, [pctObjetivo]);

  // Costo unitario efectivo de un componente según su tipoCosto
  const costoComp = useCallback((c) => {
    const obj = Number(pctObjetivo) || 30;
    switch (c.tipoCosto) {
      case 'nulo': return 0;
      case 'total': return (Number(c.costoTotal) || 0) || (Number(c.precioMaxi) || 0);
      case 'sugerido': return obj > 0 ? (Number(c.costoTotal) || 0) / (obj / 100) : 0;
      case 'maxi':
      default: return Number(c.precioMaxi) || 0;
    }
  }, [pctObjetivo]);

  const addComponente = useCallback((art) => {
    setComponentes(prev => {
      setFocusIdx(prev.length); // el nuevo va al final
      return [...prev, { ...art, cantidad: 1, unidad: 'u', tipoCosto: 'maxi' }];
    });
    setQueryArt('');
  }, []);

  const addInsumo = useCallback((ins) => {
    const u = String(ins.unidad_med || '').toLowerCase();
    const esElab = ins.es_elaborado === true || ins.tiene_receta === true;
    setInsumosSel(prev => {
      setFocusInsIdx(prev.length);
      return [...prev, {
        id: Number(ins.id), nombre: ins.nombre,
        precio_ref: Number(ins.precio_ref) || 0,
        costoTotal: Number(ins.costo_receta) || 0,
        esElaborado: esElab,
        unidad_med: ins.unidad_med || 'u',
        cantidad: 1, unidad: UNIDADES.includes(u) ? u : 'u',
        tipoCosto: esElab ? 'total' : 'maxi',
      }];
    });
    setQueryIns('');
  }, []);

  const updateComp = (idx, patch) =>
    setComponentes(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const removeComp = (idx) =>
    setComponentes(prev => prev.filter((_, i) => i !== idx));
  const updateIns = (idx, patch) =>
    setInsumosSel(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const removeIns = (idx) =>
    setInsumosSel(prev => prev.filter((_, i) => i !== idx));

  const costoTotal = useMemo(() => {
    let t = 0;
    for (const c of componentes) t += costoComp(c) * (Number(c.cantidad) || 0);
    for (const i of insumosSel) t += costoIns(i) * (Number(i.cantidad) || 0);
    return t;
  }, [componentes, insumosSel, costoComp, costoIns]);

  const precioSugerido = useMemo(() => {
    const pct = Number(pctObjetivo) || 0;
    return pct > 0 ? costoTotal / (pct / 100) : 0;
  }, [costoTotal, pctObjetivo]);

  const handleCrear = async () => {
    setError('');
    if (componentes.length < 1) { setError('Agregá al menos un artículo'); return; }
    if (!nombre.trim()) { setError('Poné un nombre a la promoción'); return; }
    setSaving(true);
    try {
      const body = {
        nombre: nombre.trim(),
        porcentajeVenta: Number(pctObjetivo) || 0,
        componentes: componentes.map(c => ({ articleId: c.id, cantidad: Number(c.cantidad) || 1, unidad: c.unidad || 'u' })),
        insumos: insumosSel.map(i => ({ insumoId: i.id, cantidad: Number(i.cantidad) || 0, unidad: i.unidad || 'u' })),
      };
      let r;
      if (promoExistente?.id != null) {
        r = await PromocionesAPI.actualizar(businessId, Number(promoExistente.id), body);
      } else {
        r = await PromocionesAPI.crear(businessId, body);
      }
      onCreated?.(r?.promo);
      onClose();
    } catch (e) {
      setError(e?.message || 'Error al crear la promoción');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '99vw', sm: '96vw', md: '760px' },
        maxWidth: '820px', maxHeight: '94vh',
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        display: 'flex', flexDirection: 'column', outline: 'none', overflow: 'hidden',
      }}>
        {/* ── HEADER ── */}
        <Box sx={{
          px: 3, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <LocalOfferIcon />
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>
              {promoExistente?.id != null ? 'Editar promoción' : 'Nueva promoción'}
            </Typography>
          </Stack>
          <IconButton onClick={onClose} size="small" sx={{ color: 'inherit' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* ── BODY ── */}
        <Box ref={bodyRef} sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <>
              {/* Datos generales */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 96px' }, gap: 1.5, mb: 2 }}>
                <TextField
                  label="Nombre de la promoción"
                  value={nombre}
                  onChange={e => { setNombre(e.target.value); setNombreEditado(true); }}
                  size="small"
                  placeholder="Ej: Café + 2 Medialunas"
                />
                <TextField
                  label="Objetivo %"
                  type="text" inputMode="decimal"
                  value={pctObjetivo}
                  onChange={e => setPctObjetivo(sanitizeDecimal(e.target.value))}
                  size="small"
                  inputProps={{ style: { textAlign: 'right' } }}
                />
              </Box>

              {/* Artículos de la promo */}
              <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
                Artículos de la promo ({componentes.length})
              </Typography>

              {componentes.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  {componentes.map((c, idx) => (
                    <CompRow
                      key={c.id}
                      comp={c}
                      costoUnit={costoComp(c)}
                      autoFocus={focusIdx === idx}
                      onFocused={() => setFocusIdx(null)}
                      onChange={patch => updateComp(idx, patch)}
                      onRemove={() => removeComp(idx)}
                      onOpenReceta={(comp) => setRecetaComp({ id: comp.id, nombre: comp.nombre })}
                    />
                  ))}
                </Box>
              )}

              <Box sx={{ position: 'relative', mb: 2 }}>
                <TextField
                  size="small" fullWidth placeholder="Buscar artículo…"
                  value={queryArt}
                  onChange={e => setQueryArt(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                {artFiltrados.length > 0 && (
                  <Box sx={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1, maxHeight: 240, overflowY: 'auto', boxShadow: 3 }}>
                    {artFiltrados.map(a => (
                      <Box key={a.id}
                        onClick={() => addComponente(a)}
                        sx={{ px: 1.5, py: 0.75, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{a.nombre}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{a.subrubro || 'Artículo'}</Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: PRIMARY, fontWeight: 700, fontSize: '0.8rem' }}>
                          {Number(a.precio) > 0 ? `$${fmt(a.precio)}` : '—'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Insumos propios */}
              <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
                Insumos propios ({insumosSel.length})
              </Typography>

              {insumosSel.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  {insumosSel.map((i, idx) => {
                    const cu = costoIns(i);
                    const total = cu * (Number(i.cantidad) || 0);
                    const esElab = !!i.esElaborado;
                    // Opciones habilitadas: elaborado → total/sugerido/nulo ; no elaborado → maxi/nulo
                    const optDisabled = (val) => {
                      if (val === 'nulo') return false;
                      if (esElab) return val === 'maxi';        // elaborado: maxi no aplica
                      return val === 'total' || val === 'sugerido'; // no elaborado: sin receta
                    };
                    return (
                      <Box key={i.id} sx={{ display: 'grid', gridTemplateColumns: '28px 1fr 96px 64px 60px 84px 32px', gap: 0.6, alignItems: 'center', mb: 0.75 }}>
                        <CheckCircleIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                          <Typography variant="caption" noWrap sx={{ flex: 1, fontSize: '0.78rem', fontWeight: 600 }}>{i.nombre}</Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 700, flexShrink: 0 }}>
                            {cu > 0 ? `$${fmt(cu)}/u` : '—'}
                          </Typography>
                        </Box>
                        <FormControl size="small">
                          <Select value={i.tipoCosto || (esElab ? 'total' : 'maxi')} onChange={e => updateIns(idx, { tipoCosto: e.target.value })}
                            sx={{ fontSize: '0.72rem', '& .MuiSelect-select': { py: '4px', fontSize: '0.72rem' } }}>
                            {TIPO_COSTO_OPTS.map(o => (
                              <MenuItem key={o.value} value={o.value} disabled={optDisabled(o.value)} sx={{ fontSize: '0.75rem' }}>{o.label}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          size="small" type="text" inputMode="decimal"
                          autoFocus={focusInsIdx === idx}
                          value={i.cantidad === '' ? '' : String(i.cantidad).replace('.', ',')}
                          onChange={e => updateIns(idx, { cantidad: sanitizeDecimal(e.target.value) })}
                          onFocus={e => { e.target.select(); if (focusInsIdx === idx) setFocusInsIdx(null); }}
                          inputProps={{ style: { textAlign: 'right', fontSize: '0.78rem', padding: '4px 6px' } }}
                        />
                        <FormControl size="small">
                          <Select value={i.unidad} onChange={e => updateIns(idx, { unidad: e.target.value })}
                            sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: '4px', fontSize: '0.75rem' } }}>
                            {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <Typography variant="caption" sx={{ textAlign: 'right', fontWeight: 700, color: 'text.secondary' }}>
                          {`$${fmt(total)}`}
                        </Typography>
                        <IconButton size="small" onClick={() => removeIns(idx)}>
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} color="error" />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              )}

              <Box sx={{ position: 'relative', mb: 2 }}>
                <TextField
                  size="small" fullWidth placeholder="Buscar insumo (packaging, etc.)…"
                  value={queryIns}
                  onChange={e => setQueryIns(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                {insFiltrados.length > 0 && (
                  <Box sx={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1, maxHeight: 200, overflowY: 'auto', boxShadow: 3 }}>
                    {insFiltrados.map(i => (
                      <Box key={i.id}
                        onClick={() => addInsumo(i)}
                        sx={{ px: 1.5, py: 0.75, cursor: 'pointer', fontSize: '0.82rem', '&:hover': { bgcolor: 'action.hover' } }}>
                        {i.nombre}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Footer resumen (estilo RecetaModal) */}
              <Box sx={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5,
                bgcolor: 'action.hover', borderRadius: 1.5, p: 2,
              }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Costo total</Typography>
                  <Typography variant="h6" fontWeight={800}>${fmt(costoTotal)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Precio sugerido ({pctObjetivo}% costo)</Typography>
                  <Typography variant="h6" fontWeight={800} color="success.main">{precioSugerido > 0 ? `$${fmt(precioSugerido)}` : '—'}</Typography>
                </Box>
              </Box>

              {error && <Typography color="error" variant="caption" sx={{ display: 'block', mt: 1 }}>{error}</Typography>}
            </>
          )}
        </Box>

        {/* ── FOOTER ── */}
        <Box sx={{
          px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider',
          display: 'flex', justifyContent: 'flex-end', gap: 1, flexShrink: 0,
        }}>
          <Button onClick={onClose} color="inherit" size="small">Cancelar</Button>
          <Button
            onClick={handleCrear}
            variant="contained"
            disabled={saving || loading || componentes.length === 0}
            startIcon={saving ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <AddIcon />}
          >
            {promoExistente?.id != null ? 'Guardar cambios' : 'Crear promoción'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}