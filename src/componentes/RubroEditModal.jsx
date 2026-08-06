/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Stack, Checkbox,
  IconButton, InputAdornment, Divider,
  Select, MenuItem, FormControl,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PercentIcon from '@mui/icons-material/Percent';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import {
  getDiscountExceptions,
  addDiscountException,
  removeDiscountException,
} from '@/servicios/apiMaxiPriceLists';
import { insumosList } from '@/servicios/apiInsumos';
import { RecetasAPI } from '@/servicios/apiBusinesses';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';

export default function RubroEditModal({
  open,
  onClose,
  rubroKey,            // nombre del rubro/subrubro (key del priceConfig.byRubro)
  rubroDisplay,        // texto para mostrar (rubro - subrubro)
  articleIds = [],     // IDs de artículos del bloque
  initialObjetivo = null,
  globalCostoIdeal = 30,
  priceLists = [],     // listas de la org [{listNumber, alias, isPrincipal, discountPct, tipo}]
  orgId,
  businessId,
  onSave,              // ({ objetivo, articleIds }) => void
}) {
  const [objetivo, setObjetivo] = useState('');
  const [exclusionesRubro, setExclusionesRubro] = useState(new Set()); // listNumbers donde TODOS los artículos están excluidos
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // ── Receta en bloque ──
  const [insumosCatalogo, setInsumosCatalogo] = useState([]);
  const [insumoQuery, setInsumoQuery] = useState('');
  const [insumoSel, setInsumoSel] = useState(null);
  const [recCantidad, setRecCantidad] = useState('1');
  const [recUnidad, setRecUnidad] = useState('u');
  const [addingReceta, setAddingReceta] = useState(false);
  const [insumosUsados, setInsumosUsados] = useState([]); // [{insumo_id, nombre, en_cuantos}]
  const [totalBloque, setTotalBloque] = useState(0);
  const searchBoxRef = useRef(null);
  const dropdownRef = useRef(null);
  const [verEnCuales, setVerEnCuales] = useState(false);

  // Resetear al abrir
  useEffect(() => {
    if (!open) return;
    setObjetivo(initialObjetivo != null ? String(initialObjetivo) : '');
  }, [open, initialObjetivo]);

  // Cargar exclusiones del bloque
  useEffect(() => {
    if (!open || !orgId || !articleIds.length) return;
    setLoading(true);
    getDiscountExceptions(orgId)
      .then(exc => {
        const idsSet = new Set(articleIds.map(String));
        const excByList = {};
        (exc || []).forEach(e => {
          if (e.scope === 'articulo' && idsSet.has(String(e.scope_id))) {
            if (!excByList[e.list_number]) excByList[e.list_number] = new Set();
            excByList[e.list_number].add(String(e.scope_id));
          }
        });
        const excSet = new Set();
        Object.entries(excByList).forEach(([listNum, artSet]) => {
          if (artSet.size === articleIds.length) excSet.add(Number(listNum));
        });
        setExclusionesRubro(excSet);
      })
      .catch(() => setExclusionesRubro(new Set()))
      .finally(() => setLoading(false));
  }, [open, orgId, articleIds]);

  useEffect(() => {
    if (!open || !businessId) return;
    insumosList(businessId, { limit: 99999 })
      .then(resp => {
        const lista = Array.isArray(resp?.data) ? resp.data
          : Array.isArray(resp?.insumos) ? resp.insumos : [];
        setInsumosCatalogo(lista);
      })
      .catch(() => setInsumosCatalogo([]));
  }, [open, businessId]);

  useEffect(() => {
    if (!open || !businessId || !articleIds.length) { setInsumosUsados([]); return; }
    RecetasAPI.insumosUsados(businessId, articleIds)
      .then(r => {
        setInsumosUsados(Array.isArray(r?.data) ? r.data : []);
        setTotalBloque(Number(r?.total) || articleIds.length);
      })
      .catch(() => setInsumosUsados([]));
  }, [open, businessId, articleIds]);

  const usadoInfo = useCallback((insumoId) => {
    const u = insumosUsados.find(x => Number(x.insumo_id) === Number(insumoId));
    if (!u) return null;
    const enTodos = totalBloque > 0 && u.en_cuantos >= totalBloque;
    return { en_cuantos: u.en_cuantos, enTodos, articulos: Array.isArray(u.articulos) ? u.articulos : [] };
  }, [insumosUsados, totalBloque]);

  const toggleExclusionLista = useCallback(async (listNumber) => {
    if (!orgId || !articleIds.length) return;
    const isExcluido = exclusionesRubro.has(listNumber);
    try {
      for (const id of articleIds) {
        if (isExcluido) {
          await removeDiscountException(orgId, 'articulo', String(id), listNumber).catch(() => { });
        } else {
          await addDiscountException(orgId, 'articulo', String(id), listNumber).catch(() => { });
        }
      }
      setExclusionesRubro(prev => {
        const next = new Set(prev);
        isExcluido ? next.delete(listNumber) : next.add(listNumber);
        return next;
      });
    } catch (e) {
      console.error('[toggleExclusionLista rubro]', e);
    }
  }, [orgId, articleIds, exclusionesRubro]);

  const toggleExclusionTodas = useCallback(async () => {
    const noPrincipales = priceLists.filter(l => !l.isPrincipal && l.discountPct != null);
    const todasExcluidas = noPrincipales.every(l => exclusionesRubro.has(l.listNumber));
    for (const l of noPrincipales) {
      if (todasExcluidas) {
        if (exclusionesRubro.has(l.listNumber)) await toggleExclusionLista(l.listNumber);
      } else {
        if (!exclusionesRubro.has(l.listNumber)) await toggleExclusionLista(l.listNumber);
      }
    }
  }, [priceLists, exclusionesRubro, toggleExclusionLista]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const val = objetivo === '' ? null : Number(objetivo);
      await onSave?.({ objetivo: val, articleIds });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const listasConDescuento = priceLists.filter(l => !l.isPrincipal && l.discountPct != null);

  const insumosFiltrados = React.useMemo(() => {
    const q = insumoQuery.trim().toLowerCase();
    // Campo vacío → sugerir los insumos ya usados en recetas del rubro
    if (!q) {
      return insumosUsados
        .map(u => insumosCatalogo.find(i => Number(i.id) === Number(u.insumo_id)))
        .filter(Boolean)
        .slice(0, 8);
    }
    return insumosCatalogo
      .filter(i => String(i.nombre || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [insumoQuery, insumosCatalogo, insumosUsados]);

  // Al aparecer resultados del buscador, scrollear para que el dropdown quede a la vista
  useEffect(() => {
    if (!insumoSel && insumosFiltrados.length > 0 && searchBoxRef.current) {
      // Esperar a que el dropdown se monte y scrollear tomándolo en cuenta
      requestAnimationFrame(() => {
        const box = searchBoxRef.current;
        if (!box) return;
        // Scrollear el ancestro scrolleable (DialogContent) para mostrar input + dropdown
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [insumosFiltrados.length, insumoSel]);

  const handleAddRecetaBloque = async () => {
    if (!insumoSel || !businessId) return;
    setAddingReceta(true);
    try {
      const r = await RecetasAPI.bulkAddInsumo(businessId, {
        articleIds,
        insumoId: insumoSel.id,
        cantidad: Number(recCantidad) || 0,
        unidad: recUnidad,
      });
      setInsumoSel(null); setInsumoQuery(''); setRecCantidad('1');
      try {
        window.dispatchEvent(new CustomEvent('ui:action', {
          detail: {
            kind: 'receta_bulk_add', scope: 'articulo',
            title: `Insumo agregado en bloque`,
            message: `${r.insumo}: ${r.agregados} agregado(s), ${r.salteados} ya lo tenían${r.recetasCreadas ? `, ${r.recetasCreadas} receta(s) nueva(s)` : ''}.`,
            createdAt: new Date().toISOString(),
          },
        }));
      } catch { }
      window.dispatchEvent(new CustomEvent('recetas:bulk-added', { detail: r }));
      window.dispatchEvent(new CustomEvent('articulos:updated'));
      onClose();
    } catch (e) {
      console.error('[bulk-add-insumo]', e);
    } finally {
      setAddingReceta(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography fontWeight={700} sx={{ flex: 1, fontSize: '0.95rem' }}>
          {rubroDisplay}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Objetivo % */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
            Objetivo de costo
          </Typography>
          <TextField
            type="number"
            size="small"
            fullWidth
            value={objetivo}
            onChange={e => setObjetivo(e.target.value)}
            placeholder={String(globalCostoIdeal)}
            inputProps={{ min: 0, max: 100, step: 1 }}
            InputProps={{
              endAdornment: <InputAdornment position="end"><PercentIcon sx={{ fontSize: 16, opacity: 0.5 }} /></InputAdornment>,
            }}
            helperText={`${articleIds.length} artículo(s) en este bloque`}
          />
        </Box>
        {/* Receta en bloque */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <RestaurantMenuIcon sx={{ fontSize: 16, color: 'var(--color-primary)' }} />
            <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
              Receta en bloque
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Agrega este insumo a la receta de los {articleIds.length} artículo(s). Los que ya lo tengan se saltean.
          </Typography>

         {insumoSel ? (
            <Box sx={{ mb: 1, p: 1, borderRadius: 1, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>{insumoSel.nombre}</Typography>
                <IconButton size="small" onClick={() => { setInsumoSel(null); setInsumoQuery(''); setVerEnCuales(false); }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              {(() => {
                const info = usadoInfo(insumoSel.id);
                const yaUsado = info?.en_cuantos || 0;
                const seAgrega = totalBloque - yaUsado;
                const arts = info?.articulos || [];
                return (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: '#166534', fontWeight: 600 }}>
                      Se agregará a {seAgrega} artículo{seAgrega !== 1 ? 's' : ''}.
                    </Typography>
                    {yaUsado > 0 && (
                      <Box sx={{ mt: 0.25 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Ya está en {yaUsado}:{' '}
                          {arts.slice(0, verEnCuales ? arts.length : 3).map(a => a.nombre).join(', ')}
                          {!verEnCuales && arts.length > 3 && (
                            <Box component="span"
                              onClick={() => setVerEnCuales(true)}
                              sx={{ ml: 0.5, color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>
                              +{arts.length - 3} más
                            </Box>
                          )}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Box>
          ) : (
            <Box ref={searchBoxRef} sx={{ position: 'relative', mb: 1 }}>
              <TextField
                size="small" fullWidth placeholder={insumosUsados.length ? 'Buscar o ver ya usados…' : 'Buscar insumo…'}
                value={insumoQuery}
                onChange={e => setInsumoQuery(e.target.value)}
              />
              {insumosFiltrados.length > 0 && (
                <Box ref={dropdownRef} sx={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1, maxHeight: 260, overflowY: 'auto', boxShadow: 4, mt: 0.5 }}>
                  {insumosFiltrados.map(ins => {
                    const info = usadoInfo(ins.id);
                    return (
                      <Box key={ins.id}
                        onClick={() => {
                          if (info?.enTodos) return;
                          setInsumoSel(ins);
                          const u = String(ins.unidad_med || 'u').trim().toLowerCase();
                          const permitidas = ['u', 'kg', 'gr', 'l', 'ml'];
                          setRecUnidad(permitidas.includes(u) ? u : 'u');
                          setRecCantidad('1');
                        }}
                        sx={{
                          px: 1.5, py: 0.75,
                          cursor: info?.enTodos ? 'default' : 'pointer',
                          opacity: info?.enTodos ? 0.5 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                          fontSize: '0.85rem',
                          '&:hover': { bgcolor: info?.enTodos ? 'transparent' : 'action.hover' },
                        }}>
                        <span>{ins.nombre}</span>
                        {info && (
                          <Typography component="span" variant="caption" sx={{
                            flexShrink: 0, px: 0.75, py: '1px', borderRadius: 0.75, fontWeight: 700,
                            fontSize: '0.62rem',
                            bgcolor: info.enTodos ? '#f1f5f9' : '#fef9c3',
                            color: info.enTodos ? '#64748b' : '#78350f',
                          }}>
                            {info.enTodos ? 'En todos' : `Ya usado (${info.en_cuantos}/${totalBloque})`}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}

          {insumoSel && (
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small" type="number" label="Cantidad" sx={{ flex: 1 }}
                autoFocus
                onFocus={e => e.target.select()}
                value={recCantidad} onChange={e => setRecCantidad(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
              />
              <FormControl size="small" sx={{ width: 90 }}>
                <Select
                  value={recUnidad}
                  onChange={e => setRecUnidad(e.target.value)}
                >
                  <MenuItem value="u">u</MenuItem>
                  <MenuItem value="kg">kg</MenuItem>
                  <MenuItem value="gr">gr</MenuItem>
                  <MenuItem value="l">L</MenuItem>
                  <MenuItem value="ml">ml</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained" size="small"
                disabled={addingReceta}
                onClick={handleAddRecetaBloque}
              >
                {addingReceta ? '...' : 'Agregar'}
              </Button>
            </Stack>
          )}
          {insumoSel && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Precio de referencia: ${Number(insumoSel.precio_ref || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}/{insumoSel.unidad_med || 'u'}
            </Typography>
          )}

        </Box>
        {/* Exclusiones */}
        {listasConDescuento.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <LocalOfferIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
                  Excluir de Listas
                </Typography>
              </Stack>

              <Box
                onClick={toggleExclusionTodas}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.5, borderRadius: 1, cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Checkbox
                  size="small"
                  checked={listasConDescuento.every(l => exclusionesRubro.has(l.listNumber))}
                  indeterminate={
                    exclusionesRubro.size > 0 &&
                    !listasConDescuento.every(l => exclusionesRubro.has(l.listNumber))
                  }
                />
                <Typography variant="body2" fontWeight={700}>Todas las listas</Typography>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              {listasConDescuento.map(l => (
                <Box
                  key={l.listNumber}
                  onClick={() => toggleExclusionLista(l.listNumber)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.5, borderRadius: 1, cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Checkbox size="small" checked={exclusionesRubro.has(l.listNumber)} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{l.alias || `Lista ${l.listNumber}`}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {l.tipo === 'descuento' ? '−' : '+'}{l.discountPct}%
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} size="small" color="inherit">Cancelar</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={saving}
          sx={{ bgcolor: 'var(--color-primary)', '&:hover': { bgcolor: 'var(--color-primary)', filter: 'brightness(0.9)' } }}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
