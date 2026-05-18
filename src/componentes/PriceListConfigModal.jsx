/* eslint-disable no-unused-vars */
// src/componentes/PriceListConfigModal.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Stack, Switch,
  FormControlLabel, Divider, CircularProgress, Alert,
  Tabs, Tab, Chip, IconButton, InputAdornment,
  Collapse,
} from '@mui/material';
import CloseIcon                 from '@mui/icons-material/Close';
import PercentIcon               from '@mui/icons-material/Percent';
import StarIcon                  from '@mui/icons-material/Star';
import InfoOutlinedIcon          from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon            from '@mui/icons-material/ExpandMore';
import ExpandLessIcon            from '@mui/icons-material/ExpandLess';
import CheckBoxIcon              from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon  from '@mui/icons-material/CheckBoxOutlineBlank';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';

import {
  saveOrgPriceListConfig,
  getDiscountExceptions,
  addDiscountException,
  removeDiscountException,
} from '@/servicios/apiPriceLists';
import { obtenerAgrupaciones } from '@/servicios/apiAgrupaciones';
import { httpBiz } from '@/servicios/apiBusinesses';

/* ─── helpers ─── */
function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

function TriCheckbox({ state }) {
  const sx = { cursor: 'pointer', fontSize: 18, verticalAlign: 'middle', flexShrink: 0 };
  if (state === 'all')  return <CheckBoxIcon sx={{ ...sx, color: 'primary.main' }} />;
  if (state === 'some') return <IndeterminateCheckBoxIcon sx={{ ...sx, color: 'warning.main' }} />;
  return <CheckBoxOutlineBlankIcon sx={{ ...sx, color: 'text.disabled' }} />;
}

function fmtPrecio(p) {
  const n = Number(p);
  if (!n) return '';
  return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

/* ─── buildTree: agrupaciones enriquecidas con catálogo ─── */
function buildTree(agrupaciones, catalogMap) {
  return agrupaciones.map(agrup => {
    const rawArts = agrup.articulos || [];
    const subMap = new Map();

    for (const raw of rawArts) {
      const artId = Number(raw.id ?? raw.articulo_id);
      if (!artId) continue;
      const cat = catalogMap.get(artId);
      // Enriquecer con datos del catálogo
      const art = {
        id: artId,
        nombre: cat?.nombre || raw.nombre || `#${artId}`,
        codigo: cat?.codigo ?? raw.codigo ?? null,
        precio: cat?.precio ?? raw.precio ?? 0,
        subrubro: cat?.subrubro || raw.subrubro || 'Sin subrubro',
        categoria: cat?.categoria || raw.categoria || 'Sin categoría',
      };

      const sub = art.subrubro;
      const catNombre = art.categoria;
      if (!subMap.has(sub)) subMap.set(sub, new Map());
      if (!subMap.get(sub).has(catNombre)) subMap.get(sub).set(catNombre, []);
      subMap.get(sub).get(catNombre).push(art);
    }

    const subrubros = Array.from(subMap.entries()).map(([sub, catMap2]) => ({
      nombre: sub,
      categorias: Array.from(catMap2.entries())
        .map(([cat, arts]) => ({
          nombre: cat,
          articulos: arts.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return { agrup, subrubros };
  });
}

/* ═══════════════════════════════════════════════════════════════ */
function PriceListConfigModal({ open, onClose, orgId, bizId, listNumber, allLists, onSaved }) {
  const safeAllLists = Array.isArray(allLists) ? allLists : [];
  const thisList = safeAllLists.find(l => l.listNumber === listNumber) || {
    listNumber, alias: 'Lista ' + listNumber, isPrincipal: false, discountPct: null,
  };
  const principalList = safeAllLists.find(l => l.isPrincipal) || safeAllLists[0];
  const isPrincipal = !!thisList.isPrincipal;

  const [tab,         setTab]         = useState(0);
  const [alias,       setAlias]       = useState(thisList.alias || 'Lista ' + listNumber);
  const [useDiscount, setUseDiscount] = useState(thisList.discountPct != null);
  const [discountPct, setDiscountPct] = useState(thisList.discountPct || 0);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState(null);

  // Excepciones
  const [excArticulos,    setExcArticulos]    = useState(new Set());
  const [excRubros,       setExcRubros]       = useState(new Set());
  const [excAgrupaciones, setExcAgrupaciones] = useState(new Set());
  const [loadingExc,      setLoadingExc]      = useState(false);
  const [savingExc,       setSavingExc]       = useState(false);

  // Datos
  const [agrupaciones,  setAgrupaciones]  = useState([]);
  const [catalogMap,    setCatalogMap]    = useState(new Map()); // id → { nombre, codigo, precio, subrubro, categoria }
  const [loadingData,   setLoadingData]   = useState(false);
  const [searchAgrup,   setSearchAgrup]   = useState('');

  // Expansión
  const [expandedAgrup, setExpandedAgrup] = useState(new Set());
  const [expandedSub,   setExpandedSub]   = useState(new Set());
  const [expandedCat,   setExpandedCat]   = useState(new Set());

  const showExcTab = !isPrincipal && useDiscount;

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setTab(0); setSaved(false); setError(null);
    setAlias(thisList.alias || 'Lista ' + listNumber);
    setUseDiscount(thisList.discountPct != null);
    setDiscountPct(thisList.discountPct || 0);
    setSearchAgrup('');
    setExpandedAgrup(new Set()); setExpandedSub(new Set()); setExpandedCat(new Set());
  }, [open, listNumber]); // eslint-disable-line

  useEffect(() => {
    if (!useDiscount && tab === 1) setTab(0);
  }, [useDiscount, tab]);

  // Cargar datos al abrir tab 1
  useEffect(() => {
    if (!open || tab !== 1 || !orgId || !bizId) return;
    setLoadingData(true);
    setLoadingExc(true);

    Promise.all([
      getDiscountExceptions(orgId).catch(() => []),
      obtenerAgrupaciones(bizId).catch(() => ({ list: [] })),
      httpBiz('/articles', {}, bizId).catch(() => ({ items: [] })),
    ]).then(([exc, agrupRes, artRes]) => {
      // Agrupaciones
      const list = Array.isArray(agrupRes?.list) ? agrupRes.list
        : Array.isArray(agrupRes?.agrupaciones) ? agrupRes.agrupaciones
        : Array.isArray(agrupRes) ? agrupRes : [];
      setAgrupaciones(list);

      // Catálogo: id → { nombre, codigo, precio, subrubro, categoria }
      const cmap = new Map();
      for (const a of (artRes?.items || [])) {
        const id = Number(a.id ?? a.articulo_id);
        if (!id) continue;
        cmap.set(id, {
          nombre:   a.nombre || a.name || `#${id}`,
          codigo:   a.codigo ?? a.codart ?? a.articulo_id ?? null,
          precio:   Number(a.precio ?? a.price ?? 0),
          subrubro: a.subrubro || 'Sin subrubro',
          categoria: a.categoria || 'Sin categoría',
        });
      }
      setCatalogMap(cmap);

      // Excepciones
      const arts = new Set(); const rubros = new Set(); const agrs = new Set();
      for (const e of (exc || [])) {
        if (e.scope === 'articulo')   arts.add(String(e.scope_id));
        if (e.scope === 'rubro')      rubros.add(String(e.scope_id));
        if (e.scope === 'agrupacion') agrs.add(String(e.scope_id));
      }
      setExcArticulos(arts); setExcRubros(rubros); setExcAgrupaciones(agrs);
    }).finally(() => { setLoadingData(false); setLoadingExc(false); });
  }, [open, tab, orgId, bizId]);

  // Árbol enriquecido
  const tree = useMemo(() => buildTree(agrupaciones, catalogMap), [agrupaciones, catalogMap]);

  const filteredTree = useMemo(() => {
    const q = searchAgrup.toLowerCase().trim();
    if (!q) return tree;
    return tree.filter(node =>
      node.agrup.nombre?.toLowerCase().includes(q) ||
      node.subrubros.some(s =>
        s.nombre.toLowerCase().includes(q) ||
        s.categorias.some(c =>
          c.nombre.toLowerCase().includes(q) ||
          c.articulos.some(a =>
            a.nombre?.toLowerCase().includes(q) ||
            String(a.codigo ?? '').includes(q)
          )
        )
      )
    );
  }, [tree, searchAgrup]);

  // ── Toggles ──────────────────────────────────────────────────────────────
  const toggleExc = useCallback(async (scope, id, isCurrentlyExc) => {
    const sid = String(id);
    setSavingExc(true);
    try {
      if (isCurrentlyExc) {
        await removeDiscountException(orgId, scope, sid);
        if (scope === 'articulo')   setExcArticulos(p   => { const n = new Set(p); n.delete(sid); return n; });
        if (scope === 'rubro')      setExcRubros(p      => { const n = new Set(p); n.delete(sid); return n; });
        if (scope === 'agrupacion') setExcAgrupaciones(p => { const n = new Set(p); n.delete(sid); return n; });
      } else {
        await addDiscountException(orgId, scope, sid);
        if (scope === 'articulo')   setExcArticulos(p    => new Set([...p, sid]));
        if (scope === 'rubro')      setExcRubros(p       => new Set([...p, sid]));
        if (scope === 'agrupacion') setExcAgrupaciones(p  => new Set([...p, sid]));
      }
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSavingExc(false); }
  }, [orgId]);

  const toggleAgrup = useCallback(async agrup =>
    toggleExc('agrupacion', agrup.id, excAgrupaciones.has(String(agrup.id))),
    [excAgrupaciones, toggleExc]);

  const toggleSubrubro = useCallback(async (agrupId, sub) => {
    const catKeys = sub.categorias.map(c => `${agrupId}::${c.nombre}`);
    const allExc = catKeys.every(k => excRubros.has(k));
    setSavingExc(true);
    try {
      for (const cat of sub.categorias) {
        const key = `${agrupId}::${cat.nombre}`;
        if (allExc) { await removeDiscountException(orgId, 'rubro', key); }
        else if (!excRubros.has(key)) { await addDiscountException(orgId, 'rubro', key); }
      }
      setExcRubros(prev => {
        const next = new Set(prev);
        allExc ? catKeys.forEach(k => next.delete(k)) : catKeys.forEach(k => next.add(k));
        return next;
      });
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSavingExc(false); }
  }, [orgId, excRubros]);

  const toggleCat = useCallback(async (agrupId, catNombre) => {
    const key = `${agrupId}::${catNombre}`;
    await toggleExc('rubro', key, excRubros.has(key));
  }, [excRubros, toggleExc]);

  const toggleArt = useCallback(async artId =>
    toggleExc('articulo', artId, excArticulos.has(String(artId))),
    [excArticulos, toggleExc]);

  const toggleAll = useCallback(async (excluirTodo) => {
    setSavingExc(true);
    try {
      if (excluirTodo) {
        for (const { agrup } of tree) {
          if (!excAgrupaciones.has(String(agrup.id)))
            await addDiscountException(orgId, 'agrupacion', String(agrup.id));
        }
        setExcAgrupaciones(new Set(tree.map(n => String(n.agrup.id))));
        setExcRubros(new Set()); setExcArticulos(new Set());
      } else {
        for (const id of excAgrupaciones) await removeDiscountException(orgId, 'agrupacion', id).catch(() => {});
        for (const id of excRubros)       await removeDiscountException(orgId, 'rubro', id).catch(() => {});
        for (const id of excArticulos)    await removeDiscountException(orgId, 'articulo', id).catch(() => {});
        setExcAgrupaciones(new Set()); setExcRubros(new Set()); setExcArticulos(new Set());
      }
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSavingExc(false); }
  }, [orgId, tree, excAgrupaciones, excRubros, excArticulos]);

  // ── Estado tri-state ──────────────────────────────────────────────────────
  function agrupState(node) {
    if (excAgrupaciones.has(String(node.agrup.id))) return 'all';
    const artIds = (node.agrup.articulos || []).map(a => String(a.id ?? a.articulo_id));
    const catKeys = node.subrubros.flatMap(s => s.categorias.map(c => `${node.agrup.id}::${c.nombre}`));
    const excArt = artIds.filter(id => excArticulos.has(id)).length;
    const excCat = catKeys.filter(k => excRubros.has(k)).length;
    if (artIds.length > 0 && excArt === artIds.length) return 'all';
    if (catKeys.length > 0 && excCat === catKeys.length) return 'all';
    if (excArt > 0 || excCat > 0) return 'some';
    return 'none';
  }

  function subrubroState(agrupId, sub) {
    const catKeys = sub.categorias.map(c => `${agrupId}::${c.nombre}`);
    const artIds = sub.categorias.flatMap(c => c.articulos.map(a => String(a.id)));
    if (catKeys.length > 0 && catKeys.every(k => excRubros.has(k))) return 'all';
    if (artIds.length > 0 && artIds.every(id => excArticulos.has(id))) return 'all';
    if (catKeys.some(k => excRubros.has(k)) || artIds.some(id => excArticulos.has(id))) return 'some';
    return 'none';
  }

  function catState(agrupId, cat) {
    const key = `${agrupId}::${cat.nombre}`;
    if (excRubros.has(key)) return 'all';
    const artIds = cat.articulos.map(a => String(a.id));
    if (artIds.length > 0 && artIds.every(id => excArticulos.has(id))) return 'all';
    if (artIds.some(id => excArticulos.has(id))) return 'some';
    return 'none';
  }

  const totalExc = excAgrupaciones.size + excRubros.size + excArticulos.size;

  const toggleExpAgrup = id => setExpandedAgrup(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExpSub   = k  => setExpandedSub(p  => { const n = new Set(p); n.has(k)  ? n.delete(k)  : n.add(k);  return n; });
  const toggleExpCat   = k  => setExpandedCat(p  => { const n = new Set(p); n.has(k)  ? n.delete(k)  : n.add(k);  return n; });

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const updatedLists = safeAllLists.map(l =>
        l.listNumber !== listNumber ? l : {
          ...l, alias,
          discountPct: (!isPrincipal && useDiscount) ? Number(discountPct) : null,
        }
      );
      await saveOrgPriceListConfig(orgId, updatedLists);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (onSaved) onSaved(updatedLists);
    } catch (e) { setError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  }

  /* ── Render ── */
  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}>

      <DialogTitle sx={{ pb: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography fontWeight={700}>
              {'Configurar ' + (alias || 'Lista ' + listNumber)}
            </Typography>
            <Chip label={'Lista ' + listNumber} size="small" variant="outlined" sx={{ fontSize: '0.72rem' }} />
            {isPrincipal && (
              <Chip icon={<StarIcon sx={{ fontSize: 14 }} />} label="Principal"
                size="small" color="warning" sx={{ fontSize: '0.72rem' }} />
            )}
          </Stack>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36 }}>
          <Tab label="General" sx={{ minHeight: 36, fontSize: '0.82rem' }} />
          {showExcTab && (
            <Tab
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <span>Excepciones</span>
                  {totalExc > 0 && (
                    <Chip label={totalExc} size="small"
                      sx={{ fontSize: '0.65rem', height: 16, bgcolor: 'warning.light', color: 'warning.dark' }} />
                  )}
                </Stack>
              }
              sx={{ minHeight: 36, fontSize: '0.82rem' }}
            />
          )}
        </Tabs>
      </Box>

      <DialogContent sx={{ pt: 1 }}>

        {/* ══ TAB 0: General ══ */}
        <TabPanel value={tab} index={0}>
          <Stack spacing={2.5}>
            <TextField label="Nombre (alias)" size="small" fullWidth
              value={alias} onChange={e => setAlias(e.target.value)}
              helperText="Aparece en el selector dentro de cada negocio" />

            <Divider />

            {isPrincipal ? (
              <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
                Esta es la lista principal. Las demás listas calculan su descuento sobre esta.
              </Alert>
            ) : (
              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={useDiscount} onChange={e => setUseDiscount(e.target.checked)} />}
                  label={
                    <Typography variant="body2" fontWeight={600}>
                      Descuento automático sobre lista principal
                      {principalList && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                          ({principalList.alias || 'Lista ' + principalList.listNumber})
                        </Typography>
                      )}
                    </Typography>
                  }
                />
                {useDiscount && (
                  <Stack spacing={1.5} sx={{ mt: 1.5, pl: 0.5 }}>
                    <TextField
                      label="% descuento" size="small" type="number"
                      value={discountPct} onChange={e => setDiscountPct(e.target.value)}
                      inputProps={{ min: 0, max: 100, step: 0.5 }}
                      InputProps={{ endAdornment: <InputAdornment position="end"><PercentIcon sx={{ fontSize: 16, opacity: 0.5 }} /></InputAdornment> }}
                      sx={{ width: 160 }}
                    />
                    {Number(discountPct) > 0 && principalList && (
                      <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ py: 0.5, fontSize: '0.78rem' }}>
                        Precio $1.000 en {principalList.alias || 'lista principal'} →{' '}
                        <strong>${(1000 * (1 - Number(discountPct) / 100)).toFixed(0)}</strong> acá.
                        Configurá las excepciones en la pestaña "Excepciones".
                      </Alert>
                    )}
                  </Stack>
                )}
              </Box>
            )}
          </Stack>
        </TabPanel>

        {/* ══ TAB 1: Excepciones ══ */}
        {showExcTab && (
          <TabPanel value={tab} index={1}>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Marcá lo que <strong>no</strong> lleva descuento — se muestra al precio directo de Maxi.
                Por defecto todo lleva el descuento configurado.
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Button size="small" variant="outlined" color="warning"
                  onClick={() => toggleAll(true)} disabled={savingExc || loadingData}>
                  Excluir todo
                </Button>
                <Button size="small" variant="outlined"
                  onClick={() => toggleAll(false)} disabled={savingExc || loadingData || totalExc === 0}>
                  Aplicar descuento a todo
                </Button>
                {savingExc && <CircularProgress size={14} />}
              </Stack>

              <TextField size="small" fullWidth
                placeholder="Buscar agrupación, rubro, código o artículo..."
                value={searchAgrup} onChange={e => setSearchAgrup(e.target.value)} />

              {loadingData ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : filteredTree.length === 0 ? (
                <Typography variant="body2" color="text.secondary"
                  sx={{ textAlign: 'center', py: 2, fontStyle: 'italic' }}>
                  {searchAgrup ? `Sin resultados para "${searchAgrup}".` : 'No hay agrupaciones.'}
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 0.5 }}>
                  {filteredTree.map(node => {
                    const agrupId = node.agrup.id;
                    const agrupSt = agrupState(node);
                    const isExpA = expandedAgrup.has(agrupId);

                    return (
                      <Box key={agrupId} sx={{ mb: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>

                        {/* ── Agrupación ── */}
                        <Stack direction="row" alignItems="center" spacing={0.75}
                          sx={{ px: 1, py: 0.75, bgcolor: 'grey.50', cursor: 'pointer' }}
                          onClick={() => toggleExpAgrup(agrupId)}>
                          <Box onClick={e => { e.stopPropagation(); toggleAgrup(node.agrup); }} sx={{ display: 'flex' }}>
                            <TriCheckbox state={agrupSt} />
                          </Box>
                          <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
                            {node.agrup.nombre}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(node.agrup.articulos || []).length} art.
                          </Typography>
                          {isExpA ? <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            : <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                        </Stack>

                        {/* ── Subrubros ── */}
                        <Collapse in={isExpA}>
                          <Box sx={{ pl: 2, pb: 0.5 }}>
                            {node.subrubros.map(sub => {
                              const subKey = `${agrupId}::${sub.nombre}`;
                              const subSt = subrubroState(agrupId, sub);
                              const isExpS = expandedSub.has(subKey);

                              return (
                                <Box key={subKey} sx={{ mt: 0.5 }}>
                                  <Stack direction="row" alignItems="center" spacing={0.75}
                                    sx={{ px: 0.5, py: 0.5, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                                    onClick={() => toggleExpSub(subKey)}>
                                    <Box onClick={e => { e.stopPropagation(); toggleSubrubro(agrupId, sub); }} sx={{ display: 'flex' }}>
                                      <TriCheckbox state={subSt} />
                                    </Box>
                                    <Typography variant="body2" fontWeight={600} sx={{ flex: 1, fontSize: '0.82rem' }}>
                                      {sub.nombre}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                      {sub.categorias.length} rubro{sub.categorias.length !== 1 ? 's' : ''}
                                    </Typography>
                                    {isExpS ? <ExpandLessIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                      : <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
                                  </Stack>

                                  {/* ── Categorías/Rubros ── */}
                                  <Collapse in={isExpS}>
                                    <Box sx={{ pl: 2.5 }}>
                                      {sub.categorias.map(cat => {
                                        const catKey = `${agrupId}::${cat.nombre}`;
                                        const catSt = catState(agrupId, cat);
                                        const isExpC = expandedCat.has(catKey);

                                        return (
                                          <Box key={catKey} sx={{ mt: 0.25 }}>
                                            <Stack direction="row" alignItems="center" spacing={0.75}
                                              sx={{ px: 0.5, py: 0.4, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                                              onClick={() => toggleExpCat(catKey)}>
                                              <Box onClick={e => { e.stopPropagation(); toggleCat(agrupId, cat.nombre); }} sx={{ display: 'flex' }}>
                                                <TriCheckbox state={catSt} />
                                              </Box>
                                              <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>
                                                {cat.nombre}
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                {cat.articulos.length} art.
                                              </Typography>
                                              {isExpC ? <ExpandLessIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                                : <ExpandMoreIcon sx={{ fontSize: 13, color: 'text.secondary' }} />}
                                            </Stack>

                                            {/* ── Artículos ── */}
                                            <Collapse in={isExpC}>
                                              <Box sx={{ pl: 2.5, pb: 0.5 }}>
                                                {cat.articulos.map(art => {
                                                  const artId = String(art.id);
                                                  const isExc = excArticulos.has(artId);
                                                  return (
                                                    <Stack key={artId} direction="row" alignItems="center" spacing={0.75}
                                                      sx={{
                                                        px: 0.5, py: 0.3, borderRadius: 1, cursor: 'pointer',
                                                        '&:hover': { bgcolor: 'action.hover' },
                                                        bgcolor: isExc ? 'warning.50' : 'transparent',
                                                      }}
                                                      onClick={() => toggleArt(art.id)}>
                                                      <TriCheckbox state={isExc ? 'all' : 'none'} />
                                                      {/* Código */}
                                                      {art.codigo != null && (
                                                        <Typography variant="caption"
                                                          sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.7rem', flexShrink: 0, minWidth: 36 }}>
                                                          {art.codigo}
                                                        </Typography>
                                                      )}
                                                      {/* Nombre */}
                                                      <Typography variant="caption" sx={{ flex: 1, fontSize: '0.78rem' }}>
                                                        {art.nombre}
                                                      </Typography>
                                                      {/* Precio */}
                                                      {art.precio > 0 && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontSize: '0.72rem' }}>
                                                          {fmtPrecio(art.precio)}
                                                        </Typography>
                                                      )}
                                                    </Stack>
                                                  );
                                                })}
                                              </Box>
                                            </Collapse>
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  </Collapse>
                                </Box>
                              );
                            })}
                          </Box>
                        </Collapse>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Stack>
          </TabPanel>
        )}

        {error && <Alert severity="error" sx={{ mt: 2, py: 0.5 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {saved && <Alert severity="success" sx={{ py: 0, px: 1.5, flex: 1 }}>Guardado</Alert>}
        <Button onClick={onClose} variant="outlined" size="small">Cancelar</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PriceListConfigModal;