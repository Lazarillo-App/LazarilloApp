/* eslint-disable no-unused-vars */
// src/componentes/PriceListConfigModal.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Stack, Chip,
  IconButton, InputAdornment, CircularProgress, Alert,
  Collapse, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PercentIcon from '@mui/icons-material/Percent';
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SearchIcon from '@mui/icons-material/Search';

import {
  saveOrgPriceListConfig,
  getDiscountExceptions,
  addDiscountException,
  removeDiscountException,
} from '@/servicios/apiPriceLists';
import { obtenerAgrupaciones } from '@/servicios/apiAgrupaciones';
import { httpBiz } from '@/servicios/apiBusinesses';

/* ─── helpers ─── */
function fmtPrecio(p) {
  const n = Number(p);
  if (!n) return '';
  return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

function calcPrecioLista(precioBase, discountPct, tipo) {
  if (!precioBase || discountPct == null) return precioBase;
  const pct = Number(discountPct);
  if (!pct) return precioBase;
  return tipo === 'recargo'
    ? precioBase * (1 + pct / 100)
    : precioBase * (1 - pct / 100);
}

function TriCheckbox({ state, onClick }) {
  const sx = { cursor: 'pointer', fontSize: 18, verticalAlign: 'middle', flexShrink: 0 };
  const handleClick = (e) => { e.stopPropagation(); onClick?.(); };
  if (state === 'all') return <CheckBoxIcon sx={{ ...sx, color: 'primary.main' }} onClick={handleClick} />;
  if (state === 'some') return <IndeterminateCheckBoxIcon sx={{ ...sx, color: 'warning.main' }} onClick={handleClick} />;
  return <CheckBoxOutlineBlankIcon sx={{ ...sx, color: 'text.disabled' }} onClick={handleClick} />;
}

function buildTree(agrupaciones, catalogMap) {
  return agrupaciones.map(agrup => {
    const rawArts = agrup.articulos || [];
    const subMap = new Map();
    for (const raw of rawArts) {
      const artId = Number(raw.id ?? raw.articulo_id);
      if (!artId) continue;
      const cat = catalogMap.get(artId);
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

/* ═══════════════════════════════════════════════
   PANEL DE EXCEPCIONES POR LISTA
═══════════════════════════════════════════════ */
const ExcepcionesPanel = React.memo(function ExcepcionesPanel({ orgId, listNumber, bizId }) {
  const [excArticulos, setExcArticulos] = useState(new Set());
  const [excRubros, setExcRubros] = useState(new Set());
  const [excAgrupaciones, setExcAgrupaciones] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [catalogMap, setCatalogMap] = useState(new Map());
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedAgrup, setExpandedAgrup] = useState(new Set());
  const [expandedSub, setExpandedSub] = useState(new Set());
  const [expandedCat, setExpandedCat] = useState(new Set());

  // Cargar excepciones + datos al montar
  useEffect(() => {
    if (!orgId || !bizId) return;
    setLoading(true);
    setLoadingData(true);

    Promise.all([
      getDiscountExceptions(orgId, listNumber).catch(() => []),
      obtenerAgrupaciones(bizId).catch(() => ({ list: [] })),
      httpBiz('/articles', {}, bizId).catch(() => ({ items: [] })),
    ]).then(([exc, agrupRes, artRes]) => {
      const list = Array.isArray(agrupRes?.list) ? agrupRes.list
        : Array.isArray(agrupRes?.agrupaciones) ? agrupRes.agrupaciones
          : Array.isArray(agrupRes) ? agrupRes : [];
      setAgrupaciones(list);

      const cmap = new Map();
      for (const a of (artRes?.items || [])) {
        const id = Number(a.id ?? a.articulo_id);
        if (!id) continue;
        cmap.set(id, {
          nombre: a.nombre || a.name || `#${id}`,
          codigo: a.codigo ?? a.codart ?? null,
          precio: Number(a.precio ?? 0),
          subrubro: a.subrubro || 'Sin subrubro',
          categoria: a.categoria || 'Sin categoría',
        });
      }
      setCatalogMap(cmap);

      const arts = new Set(); const rubros = new Set(); const agrs = new Set();
      for (const e of (exc || [])) {
        if (e.scope === 'articulo') arts.add(String(e.scope_id));
        if (e.scope === 'rubro') rubros.add(String(e.scope_id));
        if (e.scope === 'agrupacion') agrs.add(String(e.scope_id));
      }
      setExcArticulos(arts); setExcRubros(rubros); setExcAgrupaciones(agrs);
    }).finally(() => { setLoading(false); setLoadingData(false); });
  }, [orgId, listNumber, bizId]);

  const tree = useMemo(() => buildTree(agrupaciones, catalogMap), [agrupaciones, catalogMap]);

  const filteredTree = useMemo(() => {
    const q = search.toLowerCase().trim();
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
  }, [tree, search]);

  const toggleExc = useCallback(async (scope, id, isCurrentlyExc) => {
    const sid = String(id);
    setSaving(true);
    try {
      if (isCurrentlyExc) {
        await removeDiscountException(orgId, scope, sid, listNumber);
        if (scope === 'articulo') setExcArticulos(p => { const n = new Set(p); n.delete(sid); return n; });
        if (scope === 'rubro') setExcRubros(p => { const n = new Set(p); n.delete(sid); return n; });
        if (scope === 'agrupacion') setExcAgrupaciones(p => { const n = new Set(p); n.delete(sid); return n; });
      } else {
        await addDiscountException(orgId, scope, sid, listNumber);
        if (scope === 'articulo') setExcArticulos(p => new Set([...p, sid]));
        if (scope === 'rubro') setExcRubros(p => new Set([...p, sid]));
        if (scope === 'agrupacion') setExcAgrupaciones(p => new Set([...p, sid]));
      }
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSaving(false); }
  }, [orgId, listNumber]);

  const toggleAgrup = useCallback(async agrup =>
    toggleExc('agrupacion', agrup.id, excAgrupaciones.has(String(agrup.id))),
    [excAgrupaciones, toggleExc]);

  const toggleSubrubro = useCallback(async (agrupId, sub) => {
    const catKeys = sub.categorias.map(c => `${agrupId}::${c.nombre}`);
    const allExc = catKeys.every(k => excRubros.has(k));
    setSaving(true);
    try {
      for (const cat of sub.categorias) {
        const key = `${agrupId}::${cat.nombre}`;
        if (allExc) { await removeDiscountException(orgId, 'rubro', key, listNumber); }
        else if (!excRubros.has(key)) { await addDiscountException(orgId, 'rubro', key, listNumber); }
      }
      setExcRubros(prev => {
        const next = new Set(prev);
        allExc ? catKeys.forEach(k => next.delete(k)) : catKeys.forEach(k => next.add(k));
        return next;
      });
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSaving(false); }
  }, [orgId, listNumber, excRubros]);

  const toggleCat = useCallback(async (agrupId, catNombre) => {
    const key = `${agrupId}::${catNombre}`;
    await toggleExc('rubro', key, excRubros.has(key));
  }, [excRubros, toggleExc]);

  const toggleArt = useCallback(async artId =>
    toggleExc('articulo', artId, excArticulos.has(String(artId))),
    [excArticulos, toggleExc]);

  const totalExc = excAgrupaciones.size + excRubros.size + excArticulos.size;

  const toggleAll = useCallback(async (excluirTodo) => {
    setSaving(true);
    try {
      if (excluirTodo) {
        for (const { agrup } of tree) {
          if (!excAgrupaciones.has(String(agrup.id)))
            await addDiscountException(orgId, 'agrupacion', String(agrup.id), listNumber);
        }
        setExcAgrupaciones(new Set(tree.map(n => String(n.agrup.id))));
        setExcRubros(new Set()); setExcArticulos(new Set());
      } else {
        for (const id of excAgrupaciones) await removeDiscountException(orgId, 'agrupacion', id, listNumber).catch(() => { });
        for (const id of excRubros) await removeDiscountException(orgId, 'rubro', id, listNumber).catch(() => { });
        for (const id of excArticulos) await removeDiscountException(orgId, 'articulo', id, listNumber).catch(() => { });
        setExcAgrupaciones(new Set()); setExcRubros(new Set()); setExcArticulos(new Set());
      }
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSaving(false); }
  }, [orgId, listNumber, tree, excAgrupaciones, excRubros, excArticulos]);

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

  const toggleExpAgrup = id => setExpandedAgrup(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExpSub = k => setExpandedSub(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleExpCat = k => setExpandedCat(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap">
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Marcá lo que <strong>no</strong> aplica el % de esta lista. Esos artículos usarán el precio de la lista principal.
        </Typography>
        {totalExc > 0 && (
          <Chip label={`${totalExc} excluidos`} size="small"
            sx={{ bgcolor: 'warning.50', color: 'warning.dark', fontWeight: 700, fontSize: '0.7rem' }} />
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap">
        <Button size="small" variant="outlined" color="warning"
          onClick={() => toggleAll(true)} disabled={saving || loadingData}>
          Excluir todo
        </Button>
        <Button size="small" variant="outlined"
          onClick={() => toggleAll(false)} disabled={saving || loadingData || totalExc === 0}>
          Aplicar a todo
        </Button>
        {saving && <CircularProgress size={14} sx={{ alignSelf: 'center' }} />}
      </Stack>

      <TextField size="small" fullWidth
        placeholder="Buscar agrupación, rubro o artículo..."
        value={search} onChange={e => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
        sx={{ mb: 1.5 }} />

      {error && <Alert severity="error" sx={{ mb: 1, py: 0.5 }}>{error}</Alert>}

      {loadingData ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
      ) : filteredTree.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2, fontStyle: 'italic' }}>
          {search ? `Sin resultados para "${search}".` : 'No hay agrupaciones.'}
        </Typography>
      ) : (
        <Box sx={{ maxHeight: 340, overflowY: 'auto', pr: 0.5 }}>
          {filteredTree.map(node => {
            const agrupId = node.agrup.id;
            const agrupSt = agrupState(node);
            const isExpA = expandedAgrup.has(agrupId);
            return (
              <Box key={agrupId} sx={{ mb: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                <Stack direction="row" alignItems="center" spacing={0.75}
                  sx={{ px: 1, py: 0.75, bgcolor: 'grey.50', cursor: 'pointer' }}
                  onClick={() => toggleExpAgrup(agrupId)}>
                  <TriCheckbox state={agrupSt} onClick={() => toggleAgrup(node.agrup)} />
                  <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>{node.agrup.nombre}</Typography>
                  <Typography variant="caption" color="text.secondary">{(node.agrup.articulos || []).length} art.</Typography>
                  {isExpA ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                </Stack>
                <Collapse in={isExpA}>
                  <Box sx={{ pl: 2, pb: 0.5 }}>
                    {node.subrubros.map(sub => {
                      const subKey = `${agrupId}::${sub.nombre}`;
                      const subSt = subrubroState(agrupId, sub);
                      const isExpS = expandedSub.has(subKey);
                      return (
                        <Box key={subKey} sx={{ mt: 0.5 }}>
                          <Stack direction="row" alignItems="center" spacing={0.75}
                            sx={{ px: 0.5, py: 0.4, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            onClick={() => toggleExpSub(subKey)}>
                            <TriCheckbox state={subSt} onClick={() => toggleSubrubro(agrupId, sub)} />
                            <Typography variant="body2" fontWeight={600} sx={{ flex: 1, fontSize: '0.82rem' }}>{sub.nombre}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{sub.categorias.length} rubro{sub.categorias.length !== 1 ? 's' : ''}</Typography>
                            {isExpS ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                          </Stack>
                          <Collapse in={isExpS}>
                            <Box sx={{ pl: 2.5 }}>
                              {sub.categorias.map(cat => {
                                const catKey = `${agrupId}::${cat.nombre}`;
                                const catSt = catState(agrupId, cat);
                                const isExpC = expandedCat.has(catKey);
                                return (
                                  <Box key={catKey} sx={{ mt: 0.25 }}>
                                    <Stack direction="row" alignItems="center" spacing={0.75}
                                      sx={{ px: 0.5, py: 0.35, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                                      onClick={() => toggleExpCat(catKey)}>
                                      <TriCheckbox state={catSt} onClick={() => toggleCat(agrupId, cat.nombre)} />
                                      <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>{cat.nombre}</Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{cat.articulos.length} art.</Typography>
                                      {isExpC ? <ExpandLessIcon sx={{ fontSize: 13 }} /> : <ExpandMoreIcon sx={{ fontSize: 13 }} />}
                                    </Stack>
                                    <Collapse in={isExpC}>
                                      <Box sx={{ pl: 2.5, pb: 0.5 }}>
                                        {cat.articulos.map(art => {
                                          const artId = String(art.id);
                                          const isExc = excArticulos.has(artId);
                                          return (
                                            <Stack key={artId} direction="row" alignItems="center" spacing={0.75}
                                              sx={{ px: 0.5, py: 0.3, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, bgcolor: isExc ? '#fffbeb' : 'transparent' }}
                                              onClick={() => toggleArt(art.id)}>
                                              <TriCheckbox state={isExc ? 'all' : 'none'} onClick={() => toggleArt(art.id)} />
                                              {art.codigo != null && (
                                                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.7rem', flexShrink: 0, minWidth: 36 }}>
                                                  {art.codigo}
                                                </Typography>
                                              )}
                                              <Typography variant="caption" sx={{ flex: 1, fontSize: '0.78rem' }}>{art.nombre}</Typography>
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
    </Box>
  );
});

/* ═══════════════════════════════════════════════
   MODAL PRINCIPAL
═══════════════════════════════════════════════ */
function PriceListConfigModal({ open, onClose, orgId, bizId, allLists, onSaved }) {
  const safeAllLists = Array.isArray(allLists) ? allLists : [];

  // Estado local de las 4 listas
  const [lists, setLists] = useState(() =>
    [1, 2, 3, 4].map(n => {
      const found = safeAllLists.find(l => l.listNumber === n);
      return {
        listNumber: n,
        alias: found?.alias ?? `Lista ${n}`,
        isPrincipal: found?.isPrincipal ?? (n === 1),
        discountPct: found?.discountPct ?? null,
        tipo: found?.tipo ?? 'descuento',
      };
    })
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [excListNum, setExcListNum] = useState(null); // qué lista tiene el panel de excepciones abierto

  // Sincronizar con allLists cuando cambia
  useEffect(() => {
    if (!open) return;
    setSaved(false); setError(null); setExcListNum(null);
    setLists([1, 2, 3, 4].map(n => {
      const found = safeAllLists.find(l => l.listNumber === n);
      return {
        listNumber: n,
        alias: found?.alias ?? `Lista ${n}`,
        isPrincipal: found?.isPrincipal ?? (n === 1),
        discountPct: found?.discountPct ?? null,
        tipo: found?.tipo ?? 'descuento',
      };
    }));
  }, [open]); // eslint-disable-line

  const principalList = lists.find(l => l.isPrincipal) || lists[0];

  const updateList = useCallback((listNumber, patch) => {
    setLists(prev => prev.map(l =>
      l.listNumber === listNumber ? { ...l, ...patch } : l
    ));
  }, []);

  const setPrincipal = useCallback((listNumber) => {
    setLists(prev => prev.map(l => ({ ...l, isPrincipal: l.listNumber === listNumber })));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      await saveOrgPriceListConfig(orgId, lists);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.(lists);

      window.dispatchEvent(new CustomEvent('pricelists:updated', { detail: { lists } }));
    } catch (e) { setError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const PRIMARY = 'var(--color-primary, #3b82f6)';

  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '92vh' } }}>

      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography fontWeight={700} sx={{ flex: 1 }}>Configurar listas de precios</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* ── Tabla de 4 listas ── */}
        <Box sx={{ mb: 2 }}>
          {/* Header */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr 130px 160px 100px 40px',
            gap: 1, px: 1.5, py: 0.75,
            bgcolor: '#f1f5f9', borderRadius: '8px 8px 0 0',
            border: '1px solid #e2e8f0', borderBottom: 'none',
          }}>
            {['Lista', 'Alias / Nombre', '% Desc. / Recargo', 'Tipo', 'Ejemplo precio', ''].map((h, i) => (
              <Typography key={i} variant="caption" fontWeight={700} color="text.secondary"
                sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {/* Filas */}
          {lists.map((list, idx) => {
            const isPrincipal = list.isPrincipal;
            const isExcOpen = excListNum === list.listNumber;
            const precioEjemplo = 1000;
            const precioCalculado = isPrincipal
              ? precioEjemplo
              : calcPrecioLista(precioEjemplo, list.discountPct, list.tipo);

            return (
              <Box key={list.listNumber}>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 130px 160px 100px 40px',
                  gap: 1, px: 1.5, py: 1,
                  border: '1px solid #e2e8f0',
                  borderTop: idx === 0 ? '1px solid #e2e8f0' : 'none',
                  borderRadius: idx === lists.length - 1 && !isExcOpen ? '0 0 8px 8px' : 0,
                  bgcolor: isPrincipal ? `${PRIMARY}06` : 'background.paper',
                  alignItems: 'center',
                  transition: 'background 0.15s',
                }}>
                  {/* Lista # + principal toggle */}
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Tooltip title={isPrincipal ? 'Lista principal' : 'Marcar como principal'}>
                      <Box
                        onClick={() => !isPrincipal && setPrincipal(list.listNumber)}
                        sx={{
                          cursor: isPrincipal ? 'default' : 'pointer',
                          color: isPrincipal ? '#f59e0b' : '#d1d5db',
                          '&:hover': { color: isPrincipal ? '#f59e0b' : '#f59e0b' },
                          display: 'flex', alignItems: 'center',
                          transition: 'color 0.15s',
                        }}>
                        <StarIcon sx={{ fontSize: 16 }} />
                      </Box>
                    </Tooltip>
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                      Lista {list.listNumber}
                    </Typography>
                  </Stack>

                  {/* Alias */}
                  <TextField
                    size="small"
                    value={list.alias}
                    onChange={e => updateList(list.listNumber, { alias: e.target.value })}
                    placeholder={`Lista ${list.listNumber}`}
                    inputProps={{ style: { fontSize: '0.82rem', padding: '5px 8px' } }}
                  />

                  {/* % */}
                  {isPrincipal ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', height: 32 }}>
                      <Chip label="Principal" size="small" icon={<StarIcon sx={{ fontSize: 12 }} />}
                        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                    </Box>
                  ) : (
                    <TextField
                      key={`pct-${list.listNumber}`}
                      size="small"
                      type="number"
                      defaultValue={list.discountPct ?? ''}
                      onBlur={e => updateList(list.listNumber, { discountPct: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="0"
                      inputProps={{ min: 0, max: 200, step: 0.5, style: { fontSize: '0.82rem', padding: '5px 8px', textAlign: 'right' } }}
                      InputProps={{ endAdornment: <InputAdornment position="end"><PercentIcon sx={{ fontSize: 14, opacity: 0.5 }} /></InputAdornment> }}
                    />
                  )}

                  {/* Tipo descuento/recargo */}
                  {isPrincipal ? (
                    <Box />
                  ) : (
                    <Stack direction="row" spacing={0.5}>
                      {['descuento', 'recargo'].map(t => (
                        <Chip
                          key={t}
                          label={t === 'descuento' ? '↓ Descuento' : '↑ Recargo'}
                          size="small"
                          onClick={() => updateList(list.listNumber, { tipo: t })}
                          icon={t === 'descuento'
                            ? <TrendingDownIcon sx={{ fontSize: 13 }} />
                            : <TrendingUpIcon sx={{ fontSize: 13 }} />}
                          sx={{
                            height: 24, fontSize: '0.7rem', cursor: 'pointer',
                            bgcolor: list.tipo === t
                              ? (t === 'descuento' ? '#dbeafe' : '#dcfce7')
                              : 'transparent',
                            color: list.tipo === t
                              ? (t === 'descuento' ? '#1d4ed8' : '#15803d')
                              : 'text.secondary',
                            border: `1px solid ${list.tipo === t
                              ? (t === 'descuento' ? '#93c5fd' : '#86efac')
                              : '#e2e8f0'}`,
                            '&:hover': {
                              bgcolor: t === 'descuento' ? '#dbeafe' : '#dcfce7',
                            },
                          }}
                        />
                      ))}
                    </Stack>
                  )}

                  {/* Ejemplo precio */}
                  <Box>
                    {isPrincipal ? (
                      <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                        $1.000 base
                      </Typography>
                    ) : list.discountPct != null ? (
                      <Stack>
                        <Typography variant="caption" fontWeight={700}
                          sx={{ fontSize: '0.75rem', color: list.tipo === 'descuento' ? '#1d4ed8' : '#15803d' }}>
                          ${Math.round(precioCalculado).toLocaleString('es-AR')}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                          sobre $1.000
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>—</Typography>
                    )}
                  </Box>

                  {/* Botón excepciones */}
                  {!isPrincipal && list.discountPct != null ? (
                    <Tooltip title={isExcOpen ? 'Cerrar excepciones' : 'Gestionar excepciones'}>
                      <IconButton
                        size="small"
                        onClick={() => setExcListNum(isExcOpen ? null : list.listNumber)}
                        sx={{
                          p: '4px',
                          bgcolor: isExcOpen ? PRIMARY : 'transparent',
                          color: isExcOpen ? '#fff' : 'text.secondary',
                          border: '1px solid', borderColor: isExcOpen ? PRIMARY : 'divider',
                          borderRadius: 1,
                          '&:hover': { bgcolor: isExcOpen ? PRIMARY : 'action.hover' },
                        }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, lineHeight: 1, px: 0.25 }}>
                          EXC
                        </Typography>
                      </IconButton>
                    </Tooltip>
                  ) : <Box />}
                </Box>

                {/* Panel de excepciones inline */}
                <Collapse in={isExcOpen} unmountOnExit>
                  <Box sx={{
                    border: '1px solid', borderColor: PRIMARY,
                    borderTop: 'none', p: 2,
                    bgcolor: `${PRIMARY}04`,
                    borderRadius: idx === lists.length - 1 ? '0 0 8px 8px' : 0,
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ color: PRIMARY }}>
                        Excepciones — {list.alias || `Lista ${list.listNumber}`}
                      </Typography>
                      <Chip
                        label={`${list.tipo === 'descuento' ? '−' : '+'}${list.discountPct}%`}
                        size="small"
                        sx={{
                          bgcolor: list.tipo === 'descuento' ? '#dbeafe' : '#dcfce7',
                          color: list.tipo === 'descuento' ? '#1d4ed8' : '#15803d',
                          fontWeight: 700, fontSize: '0.7rem', height: 20,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                        Los artículos marcados usarán el precio de la lista principal sin aplicar el {list.tipo}.
                      </Typography>
                    </Stack>
                    {isExcOpen && (
                      <ExcepcionesPanel
                        orgId={orgId}
                        listNumber={list.listNumber}
                        bizId={bizId}
                      />
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>

        {/* Nota informativa */}
        <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem' }}>
          <strong>Cómo funciona:</strong> el descuento/recargo se aplica sobre el precio de la lista marcada como principal.
          Las excepciones permiten que artículos, rubros o agrupaciones específicas conserven el precio principal sin modificar.
        </Alert>

        {error && <Alert severity="error" sx={{ mt: 1.5, py: 0.5 }}>{error}</Alert>}
        {saved && <Alert severity="success" sx={{ mt: 1.5, py: 0.5 }}>¡Configuración guardada!</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" size="small" color="inherit">Cancelar</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ bgcolor: PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}>
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PriceListConfigModal;