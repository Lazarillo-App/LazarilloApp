// src/componentes/ExcluirListasModal.jsx
// Modal compartido para excluir artículos (o rubros/agrupaciones) de listas de precios.
// Soporta uno o muchos IDs en una sola operación.
//
// Estado inicial por lista: indeterminate si solo ALGUNOS de los articleIds están excluidos.
// "Todas las listas" → guarda una sola fila con listId=null (exclusión global dinámica).

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Checkbox, FormControlLabel, Box, Typography,
  Divider, CircularProgress, Tooltip, IconButton, 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { PriceConfigAPI } from '@/servicios/apiBusinesses';

// Lee el estado de exclusión para un articleId en una lista dada del byList.
// listId = null → consulta _base (exclusión global).
const isExcluidoEn = (byList, listId, scope, scopeId) => {
  const key = listId == null ? '_base' : String(listId);
  const cfg = byList?.[key];
  if (!cfg) return null; // sin info → null
  const bucket = scope === 'rubro' ? cfg.byRubro
               : scope === 'agrupacion' ? cfg.byAgrupacion
               : cfg.byArticle;
  const entry = bucket?.[String(scopeId)];
  if (!entry) return null;
  return entry.excluido === true;
};

// Reduce el estado de N IDs a uno solo: 'all' | 'none' | 'mixed'.
const reduceState = (states) => {
  const has = { t: false, f: false };
  for (const s of states) {
    if (s === true) has.t = true;
    else has.f = true; // null o false cuentan como "no excluido"
    if (has.t && has.f) return 'mixed';
  }
  if (has.t && !has.f) return 'all';
  return 'none';
};

export default function ExcluirListasModal({
  open,
  onClose,
  bizId,
  lists = [],
  byList = {},
  scope = 'articulo',           // 'articulo' | 'rubro' | 'agrupacion'
  scopeIds = [],                // array de IDs (o keys de rubro)
  scopeLabel = '',              // texto para el título (ej: nombre del artículo o subrubro)
  notify,
  mode = 'edit',                    // 'edit' | 'manage'
  articleNameById = new Map(), 
}) {
  const noFavoritas = useMemo(
    () => lists.filter(l => !l.is_favorite),
    [lists]
  );

  // Estado actual leído desde byList: por lista + global.
  const initialState = useMemo(() => {
    if (!scopeIds.length) return { global: 'none', porLista: {} };

    const globalStates = scopeIds.map(id => isExcluidoEn(byList, null, scope, id));
    const global = reduceState(globalStates);

    const porLista = {};
    for (const l of noFavoritas) {
      const states = scopeIds.map(id => isExcluidoEn(byList, l.id, scope, id));
      porLista[l.id] = reduceState(states);
    }
    return { global, porLista };
  }, [byList, scopeIds, scope, noFavoritas]);

  // Estado local del modal (lo que el usuario va marcando).
  const [globalCheck, setGlobalCheck] = useState(false);
  const [porListaCheck, setPorListaCheck] = useState({});
  const [saving, setSaving] = useState(false);

  // Resetear al abrir.
  useEffect(() => {
    if (!open) return;
    setGlobalCheck(initialState.global === 'all');
    const map = {};
    for (const l of noFavoritas) {
      map[l.id] = initialState.porLista[l.id] === 'all';
    }
    setPorListaCheck(map);
  }, [open, initialState, noFavoritas]);

  const toggleGlobal = useCallback((checked) => {
    setGlobalCheck(checked);
    if (checked) {
      // Al marcar "Todas", marcar visualmente todas las listas (UI consistente).
      const map = {};
      for (const l of noFavoritas) map[l.id] = true;
      setPorListaCheck(map);
    }
  }, [noFavoritas]);

  const toggleLista = useCallback((listId, checked) => {
    setPorListaCheck(prev => ({ ...prev, [listId]: checked }));
    // Si destildás una lista mientras "Todas" estaba marcada, dejamos "Todas" en false
    // y la guardada queda como override (excluido=false) sobre la global.
    if (!checked && globalCheck) setGlobalCheck(false);
  }, [globalCheck]);

  const handleSave = useCallback(async () => {
    if (!bizId || !scopeIds.length) return;
    setSaving(true);

    const calls = [];
    const finalGlobal = globalCheck;
    const wasGlobal = initialState.global === 'all';

    for (const id of scopeIds) {
      const scopeIdStr = String(id);

      // 1) Global (listId=null) — solo escribimos si cambió.
      if (finalGlobal !== wasGlobal) {
        calls.push({ scope, scopeId: scopeIdStr, listId: null, excluido: finalGlobal });
      }

      // 2) Por lista — solo si NO se está marcando global ahora.
      // Cuando global=true, dejamos que _base se haga cargo (incluye listas futuras).
      if (!finalGlobal) {
        for (const l of noFavoritas) {
          const eraExcluida = initialState.porLista[l.id] === 'all';
          const ahoraExcluida = !!porListaCheck[l.id];
          if (eraExcluida !== ahoraExcluida) {
            calls.push({ scope, scopeId: scopeIdStr, listId: l.id, excluido: ahoraExcluida });
          }
        }
      }
    }

    try {
      // Llamadas secuenciales para no saturar. Si hay muchas, después optimizamos con bulk.
      for (const body of calls) {
        await PriceConfigAPI.save(Number(bizId), body);
      }
      notify?.(`Exclusiones actualizadas`, 'success');
      // Que el hook recargue
      try { window.dispatchEvent(new Event('article-lists:updated')); } catch { /* */ }
      onClose?.();
    } catch (e) {
      console.error('[ExcluirListasModal] save error', e);
      notify?.('No se pudieron guardar las exclusiones', 'error');
    } finally {
      setSaving(false);
    }
  }, [bizId, scopeIds, scope, globalCheck, porListaCheck, initialState, noFavoritas, notify, onClose]);

  // ── Modo MANAGE: lista de artículos actualmente excluidos en el alcance dado ──
  // (alcance = "global" si pasaron _base, o "una lista específica" si pasaron un listId)
  if (mode === 'manage') {
    return (
      <ManageExclusionesView
        open={open}
        onClose={onClose}
        bizId={bizId}
        lists={lists}
        byList={byList}
        scopeLabel={scopeLabel}
        articleNameById={articleNameById}
        notify={notify}
      />
    );
  }

  if (!noFavoritas.length) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Excluir de listas</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            No hay listas no-favoritas configuradas. Las exclusiones se aplican solo a listas con ajuste.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    );
  }

  const count = scopeIds.length;
  const subtitulo = count > 1
    ? `${count} ítems${scopeLabel ? ` de "${scopeLabel}"` : ''}`
    : (scopeLabel || 'este ítem');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
        Excluir de listas
        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontWeight: 400, mt: 0.5 }}>
          {subtitulo}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Un artículo excluido usa el precio de la lista favorita (sin ajuste).
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={globalCheck}
              indeterminate={initialState.global === 'mixed' && !globalCheck}
              onChange={(e) => toggleGlobal(e.target.checked)}
              size="small"
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={700}>Todas las listas</Typography>
              <Typography variant="caption" color="text.secondary">
                Incluye las que se creen en el futuro
              </Typography>
            </Box>
          }
          sx={{ alignItems: 'flex-start', mb: 1 }}
        />

        <Divider sx={{ my: 1 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {noFavoritas.map(l => {
            const estadoInicial = initialState.porLista[l.id];
            const checked = !!porListaCheck[l.id];
            const indeterminate = estadoInicial === 'mixed' && checked === (estadoInicial === 'all');
            return (
              <FormControlLabel
                key={l.id}
                control={
                  <Checkbox
                    checked={checked}
                    indeterminate={indeterminate}
                    onChange={(e) => toggleLista(l.id, e.target.checked)}
                    size="small"
                    disabled={globalCheck}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {l.color && (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: l.color }} />
                    )}
                    <Typography variant="body2">{l.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Number(l.ajuste_pct) > 0 ? '+' : ''}{Number(l.ajuste_pct || 0)}%
                    </Typography>
                  </Box>
                }
              />
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? <><CircularProgress size={14} sx={{ mr: 1 }} /> Guardando…</> : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ManageExclusionesView — modo "ver/editar exclusiones existentes"
// Lee de byList los artículos ya excluidos en cada alcance y permite quitarlos.
// Liviano: sólo renderiza N filas (las que ya están excluidas), no la tabla entera.
// ─────────────────────────────────────────────────────────────────────────────
function ManageExclusionesView({ open, onClose, bizId, lists, byList, scopeLabel, articleNameById, notify }) {
  const noFavoritas = useMemo(() => lists.filter(l => !l.is_favorite), [lists]);

  // Resumen por lista: { listId|null: [articleId, ...] }
  const resumen = useMemo(() => {
    const out = { _base: [] };
    const baseExc = byList?._base?.byArticle || {};
    Object.entries(baseExc).forEach(([id, v]) => {
      if (v?.excluido === true) out._base.push(id);
    });
    for (const l of noFavoritas) {
      const arr = [];
      const bucket = byList?.[l.id]?.byArticle || {};
      Object.entries(bucket).forEach(([id, v]) => {
        if (v?.excluido === true) arr.push(id);
      });
      out[l.id] = arr;
    }
    return out;
  }, [byList, noFavoritas]);

  const [pending, setPending] = useState(new Set()); // claves "listIdOrBase:articleId" en curso

  const quitar = useCallback(async (articleId, listIdOrNull) => {
    const key = `${listIdOrNull ?? '_base'}:${articleId}`;
    setPending(prev => { const n = new Set(prev); n.add(key); return n; });
    try {
      await PriceConfigAPI.save(Number(bizId), {
        scope: 'articulo',
        scopeId: String(articleId),
        listId: listIdOrNull,
        excluido: false,
      });
      try { window.dispatchEvent(new Event('article-lists:updated')); } catch { /* */ }
    } catch (e) {
      console.error('[ManageExclusiones] quitar error', e);
      notify?.('No se pudo quitar la exclusión', 'error');
    } finally {
      setPending(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [bizId, notify]);

  const nombreDe = (id) => articleNameById.get(Number(id)) || articleNameById.get(String(id)) || `#${id}`;

  // Render por sección
  const renderSeccion = (titulo, articleIds, listIdOrNull, color) => {
    if (!articleIds.length) {
      return (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', display: 'block', mb: 0.5 }}>
            {titulo}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            Sin artículos excluidos.
          </Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', display: 'block', mb: 0.5 }}>
          {titulo} <span style={{ color: '#9ca3af', fontWeight: 400 }}>· {articleIds.length}</span>
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, maxHeight: 180, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0.5 }}>
          {articleIds.map(id => {
            const key = `${listIdOrNull ?? '_base'}:${id}`;
            const isPending = pending.has(key);
            return (
              <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.4, borderRadius: 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
                {color && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />}
                <Typography variant="body2" sx={{ flex: 1, fontSize: '0.82rem' }} noWrap>
                  {nombreDe(id)}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>#{id}</Typography>
                <Tooltip title="Quitar exclusión">
                  <span>
                    <IconButton size="small" disabled={isPending} onClick={() => quitar(id, listIdOrNull)} sx={{ p: 0.25 }}>
                      {isPending ? <CircularProgress size={12} /> : <CloseIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
        Exclusiones
        {scopeLabel && (
          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontWeight: 400, mt: 0.5 }}>
            {scopeLabel}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Lista de artículos actualmente excluidos. Quitar un artículo lo devuelve al cálculo de la lista.
        </Typography>

        {renderSeccion('🌐 Globales — todas las listas', resumen._base, null, null)}

        {noFavoritas.map(l => (
          <React.Fragment key={l.id}>
            {renderSeccion(l.name, resumen[l.id] || [], l.id, l.color)}
          </React.Fragment>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}