/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
} from '@mui/material';

import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import BlockIcon from '@mui/icons-material/Block';
import { emitUiAction } from '@/servicios/uiEvents';
import { httpBiz, BusinessesAPI } from '../servicios/apiBusinesses';
import { addExclusiones } from '../servicios/apiAgrupacionesTodo';
import AgrupacionCreateModal from './AgrupacionCreateModal';
import { useOrganization } from '../context/OrganizationContext';
import { obtenerAgrupaciones } from '../servicios/apiAgrupaciones';

const getNum = (v) => Number(v ?? 0);
const norm = (s) => String(s || '').trim().toLowerCase();

const isDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};
const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'todo' || n === 'sin agrupacion' || n === 'sin agrupación' ||
    n === 'sin agrupar' || n === 'sin grupo';
};

const mapRowToArticle = (row) => {
  const raw = row?.raw || {};
  const id = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
  return {
    id,
    nombre: row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`,
    categoria: row?.categoria ?? raw?.categoria ?? raw?.rubro ?? 'Sin categoría',
    subrubro: row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? 'Sin subrubro',
    precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
  };
};

const buildTree = (flatList = []) => {
  const bySub = new Map();
  for (const a of flatList) {
    if (!Number.isFinite(a?.id)) continue;
    const sub = a.subrubro || 'Sin subrubro';
    const cat = a.categoria || 'Sin categoría';
    if (!bySub.has(sub)) bySub.set(sub, new Map());
    const byCat = bySub.get(sub);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push({ id: a.id, nombre: a.nombre, precio: a.precio, categoria: cat, subrubro: sub });
  }
  const tree = [];
  for (const [subrubro, byCat] of bySub.entries()) {
    const categorias = [];
    for (const [categoria, articulos] of byCat.entries()) categorias.push({ categoria, articulos });
    categorias.sort((a, b) => String(a.categoria).localeCompare(String(b.categoria), 'es', { sensitivity: 'base', numeric: true }));
    tree.push({ subrubro, categorias });
  }
  tree.sort((a, b) => String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true }));
  return tree;
};

const safeId = (a) => {
  const n = Number(a?.id ?? a?.articuloId ?? a?.codigo);
  return Number.isFinite(n) ? n : null;
};

// ── Hook: carga agrupaciones de un negocio dado ──────────────────────────────
function useAgrupacionesBiz(bizId) {
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = Number(bizId);
    if (!Number.isFinite(id) || id <= 0) { setAgrupaciones([]); return; }
    let alive = true;
    setLoading(true);
    obtenerAgrupaciones(id).then(({ list }) => {
      if (!alive) return;
      const reales = (list || []).filter(g => !esTodoGroup(g) && !isDiscontinuadosGroup(g));
      setAgrupaciones(reales);
    }).catch(() => {
      if (alive) setAgrupaciones([]);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [bizId]);

  return { agrupaciones, loading };
}

// ── Modal unificado "Mover a…" con selector de sub-negocio ──────────────────
function MoverAModal({
  open, onClose,
  tituloExtra = '',
  agrupacionesLocales = [],
  currentGroupId = null,
  allBusinesses = [],
  activeBizId,
  onConfirm,
  isMoving = false,
}) {
  const [selectedBizId, setSelectedBizId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const negocios = useMemo(() => (allBusinesses || []).filter(b => Number(b.id) > 0), [allBusinesses]);

  const isSameBiz = Number(selectedBizId) === Number(activeBizId);
  const { agrupaciones: agrupacionesExternas, loading: loadingExt } = useAgrupacionesBiz(
    !isSameBiz && selectedBizId ? selectedBizId : null
  );

  const agrupacionesMostrar = useMemo(() => {
    if (!selectedBizId) return [];
    if (isSameBiz) return (agrupacionesLocales || []).filter(g => Number(g.id) !== currentGroupId);
    return agrupacionesExternas;
  }, [selectedBizId, isSameBiz, agrupacionesLocales, agrupacionesExternas, currentGroupId]);

  useEffect(() => { setSelectedGroupId(''); }, [selectedBizId]);

  useEffect(() => {
    if (open) { setSelectedBizId(String(activeBizId || '')); setSelectedGroupId(''); }
  }, [open, activeBizId]);

  const handleConfirm = useCallback(async () => {
    if (!selectedGroupId) return;
    const bizId = Number(selectedBizId);
    const groupId = Number(selectedGroupId);
    const grupo = agrupacionesMostrar.find(g => Number(g.id) === groupId);
    console.log('[MoverAModal] grupo encontrado:', grupo);
    console.log('[MoverAModal] grupo.business_id:', grupo?.business_id);
    const realBizId = Number(grupo?.business_id) || bizId;
    console.log('[MoverAModal] realBizId final:', realBizId, '| bizId del selector:', bizId);
    await onConfirm({ bizId: realBizId, groupId, groupNombre: grupo?.nombre || '' });
  }, [selectedBizId, selectedGroupId, agrupacionesMostrar, onConfirm]);

  const showBizSelect = negocios.length > 1;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth keepMounted>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
        Mover {tituloExtra} a…
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        {showBizSelect && (
          <TextField
            select SelectProps={{ native: true }}
            label="Sub-negocio" value={selectedBizId}
            onChange={e => setSelectedBizId(e.target.value)}
            fullWidth size="small"
          >
            <option value="" disabled>Seleccionar negocio…</option>
            {negocios.map(b => (
              <option key={b.id} value={b.id}>
                {b.nombre || b.name || `Negocio #${b.id}`}
                {Number(b.id) === Number(activeBizId) ? ' (actual)' : ''}
              </option>
            ))}
          </TextField>
        )}

        {selectedBizId && (
          loadingExt ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.82rem' }}>
              <CircularProgress size={14} /> Cargando agrupaciones…
            </Box>
          ) : (
            <TextField
              select SelectProps={{ native: true }}
              label="Agrupación destino" value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              fullWidth size="small"
              disabled={agrupacionesMostrar.length === 0}
              helperText={agrupacionesMostrar.length === 0 ? 'Sin agrupaciones disponibles' : ''}
            >
              <option value="" disabled>Seleccionar agrupación…</option>
              {agrupacionesMostrar.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </TextField>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isMoving}>Cancelar</Button>
        <Button onClick={handleConfirm} variant="contained"
          disabled={!selectedGroupId || isMoving || loadingExt}>
          {isMoving ? 'Moviendo…' : 'Mover'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════════════════
function SubrubroAccionesMenu({
  subrubro,
  todosArticulos = [],
  agrupacionSeleccionada,
  isTodo = false,
  agrupaciones = [],
  todoGroupId,
  articuloIds = [],
  onRefetch,
  notify,
  onAfterMutation,
  onGroupCreated,
  loading = false,
  onMutateGroups,
  baseById,
  treeMode = 'cat-first',
  businessId,
  rootBizId: rootBizIdProp = null,
  allowedIds,
}) {
  const effectiveBusinessId = businessId ?? localStorage.getItem('activeBusinessId') ??
    localStorage.getItem('effectiveBusinessId') ?? null;
  const realActiveBizId = localStorage.getItem('activeBusinessId') ??
    localStorage.getItem('effectiveBusinessId') ?? businessId ?? null;

  const { rootBusiness, allBusinesses } = useOrganization();
  const rootBizIdFromContext = rootBusiness?.id ? Number(rootBusiness.id) : null;
  const rootBizId = rootBizIdProp || rootBizIdFromContext || null;
  const agrupBizId = Number(realActiveBizId) || rootBizId || Number(effectiveBusinessId);

  const resolveAgrupBizId = useCallback((agrupacion) => {
    const agBizId = Number(agrupacion?.business_id);
    if (Number.isFinite(agBizId) && agBizId > 0) return agBizId;
    return agrupBizId;
  }, [agrupBizId]);
  const discBizId = rootBizId || agrupBizId;

  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [openCrearAgr, setOpenCrearAgr] = useState(false);
  const [preselect, setPreselect] = useState(null);
  const [dlgReactivarOpen, setDlgReactivarOpen] = useState(false);
  const [origenReactivar, setOrigenReactivar] = useState(null);

  const [treeLocal, setTreeLocal] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const haveExternalTree = Array.isArray(todosArticulos) && todosArticulos.length > 0;
  const effectiveTree = haveExternalTree ? todosArticulos : treeLocal;
  const effectiveLoading = haveExternalTree ? !!loading : loadingLocal;

  const open = Boolean(anchorEl);
  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);
  const loadedRef = useRef(false);

  const currentGroupId = agrupacionSeleccionada?.id ? Number(agrupacionSeleccionada.id) : null;

  const subDisplayName = useMemo(() => {
    if (typeof subrubro === 'string') return subrubro.trim() || 'este subrubro';
    if (subrubro && typeof subrubro === 'object') {
      if (subrubro.nombre) return String(subrubro.nombre).trim();
      if (subrubro.label) return String(subrubro.label).trim();
    }
    return 'este subrubro';
  }, [subrubro]);

  const discontinuadosGroup = useMemo(
    () => (agrupaciones || []).find((g) => isDiscontinuadosGroup(g)) || null,
    [agrupaciones]
  );
  const discontinuadosId = discontinuadosGroup ? Number(discontinuadosGroup.id) : null;

  const isInDiscontinuadosView = useMemo(
    () => !!agrupacionSeleccionada && isDiscontinuadosGroup(agrupacionSeleccionada),
    [agrupacionSeleccionada]
  );

  const subName = useMemo(() => norm(subrubro?.nombre || subrubro), [subrubro]);

  const allArticleIdsForSub = useMemo(() => {
    const baseIds = (articuloIds || []).map(getNum).filter(Boolean);
    if (!baseIds.length) return baseIds;
    const out = new Set(baseIds);
    if (treeMode === 'cat-first') {
      if (!subName || !Array.isArray(todosArticulos) || !todosArticulos.length) return baseIds;
      for (const node of todosArticulos) {
        for (const cat of node.categorias || []) {
          const catNorm = norm(cat?.categoria);
          if (catNorm !== subName) continue;
          for (const art of cat.articulos || []) {
            const id = safeId(art);
            if (id != null) out.add(id);
          }
        }
      }
      return Array.from(out);
    }
    return baseIds;
  }, [articuloIds, subName, todosArticulos, treeMode]);

  // Agrupaciones locales para el modal Mover (sin Discontinuados)
  const agrupacionesLocalesParaMover = useMemo(
    () => (agrupaciones || []).filter(g => !isDiscontinuadosGroup(g)),
    [agrupaciones]
  );

  const openMover = useCallback(() => { handleClose(); setTimeout(() => setDlgMoverOpen(true), 0); }, [handleClose]);
  const closeMover = useCallback(() => setDlgMoverOpen(false), []);

  // ── Mover bloque a otro negocio/agrupación ────────────────────────────────
  async function ejecutarMover({ bizId: toBizId, groupId: toId, groupNombre }) {
    const ids = articuloIds.map(getNum).filter(Boolean);
    if (!ids.length) return;

    const fromId = !isTodo && currentGroupId ? Number(currentGroupId) : null;
    const isSameBiz = Number(toBizId) === Number(agrupBizId);

    if (isSameBiz && fromId && fromId === toId) {
      notify?.('Ya está en esa agrupación', 'info');
      onAfterMutation?.(ids);
      return closeMover();
    }

    setIsMoving(true);
    try {
      if (isSameBiz) {
        // ── Mismo negocio: lógica original ──────────────────────────────────
        const fromAgrup = (agrupaciones || []).find(g => Number(g.id) === fromId);
        const toAgrup = (agrupaciones || []).find(g => Number(g.id) === toId);
        const fromMoverBizId = resolveAgrupBizId(fromAgrup ?? agrupacionSeleccionada);
        const toMoverBizId = resolveAgrupBizId(toAgrup);

        if (fromId) {
          onMutateGroups?.({ type: 'remove', groupId: fromId, ids });
          onMutateGroups?.({ type: 'append', groupId: toId, articulos: ids.map(id => ({ id })), baseById });
          try {
            await httpBiz(`/agrupaciones/${fromId}/move-items`, { method: 'POST', body: { toId, ids } }, fromMoverBizId);
          } catch {
            await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids } }, toMoverBizId);
            for (const id of ids) {
              try { await httpBiz(`/agrupaciones/${fromId}/articulos/${id}`, { method: 'DELETE' }, fromMoverBizId); } catch { }
            }
          }
        } else {
          await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids } }, toMoverBizId);
          onMutateGroups?.({ type: 'append', groupId: toId, articulos: ids.map(id => ({ id })), baseById });
        }

      } else {
        // ── Distinto negocio: limpiar de toda la org y mover al destino ──────
        await httpBiz('/agrupaciones/move-cross-biz', {
          method: 'POST',
          body: { articleIds: ids, toGroupId: toId, toBizId },
        }, agrupBizId);

        // Mutación optimista: quitar del grupo origen local
        if (fromId) {
          onMutateGroups?.({ type: 'remove', groupId: fromId, ids });
        }
      }

      notify?.(`${ids.length} artículo(s) movido(s) a "${groupNombre}"`, 'success');
      try {
        window.dispatchEvent(new CustomEvent('ui:action', {
          detail: {
            kind: 'move', scope: 'articulo', businessId: effectiveBusinessId,
            createdAt: new Date().toISOString(), title: 'Subrubro movido',
            message: `${ids.length} artículo(s) movido(s) a "${groupNombre}".`,
            payload: { ids, fromId, toId, toBizId },
          },
        }));
      } catch { }

      onAfterMutation?.(ids);
      if (!isTodo) onRefetch?.();
    } catch (e) {
      console.error('MOVER_SUBRUBRO_ERROR', e);
      notify?.('No se pudo mover el subrubro', 'error');
      onRefetch?.();
    } finally {
      setIsMoving(false);
      closeMover();
    }
  }

  async function quitarDeActual() {
    const ids = articuloIds.map(getNum).filter(Boolean);
    if (isTodo && todoGroupId && ids.length) {
      try {
        await addExclusiones(todoGroupId, ids.map((id) => ({ scope: 'articulo', ref_id: id })));
        notify?.(`Quitados ${ids.length} artículo(s) de TODO`, 'success');
        onAfterMutation?.(ids);
      } catch {
        notify?.('No se pudo quitar el subrubro de TODO', 'error');
        onRefetch?.();
      } finally { handleClose(); }
      return;
    }
    if (!currentGroupId) return;
    try {
      onMutateGroups?.({ type: 'remove', groupId: Number(currentGroupId), ids });
      const fromBizId = resolveAgrupBizId(agrupacionSeleccionada);
      await httpBiz('/agrupaciones/create-or-move', { method: 'POST', body: { nombre: 'Sin Agrupación', ids } }, fromBizId);
      notify?.(`Quitados ${ids.length} artículo(s) de "${agrupacionSeleccionada?.nombre}"`, 'success');
      onAfterMutation?.(ids);
      onRefetch?.();
    } catch {
      notify?.('No se pudo quitar el subrubro', 'error');
      onRefetch?.();
    } finally { handleClose(); }
  }

  async function toggleDiscontinuarBloque() {
    const ids = (articuloIds || []).map(getNum).filter(Boolean);
    if (!ids.length) return;

    if (!discontinuadosId) {
      notify?.('No existe la agrupación "Discontinuados". Creala primero.', 'error');
      handleClose(); return;
    }

    const labelCount = ids.length === 1 ? '1 artículo' : `${ids.length} artículos`;

    try {
      if (!isInDiscontinuadosView) {
        // DISCONTINUAR
        const articulosConOrigen = ids.map(id => ({
          id,
          fromGroupId: currentGroupId ?? null,
          fromGroupName: agrupacionSeleccionada?.nombre ?? null,
          fromBizId: agrupBizId ?? null,
        }));
        await httpBiz(`/agrupaciones/${discontinuadosId}/articulos`, {
          method: 'PUT', body: { articulos: articulosConOrigen },
        }, discBizId);

        // Quitar de la agrupación actual en la DB
        if (currentGroupId && currentGroupId !== discontinuadosId) {
          try {
            await httpBiz(`/agrupaciones/${currentGroupId}/articulos`, {
              method: 'DELETE', body: { ids },
            }, agrupBizId);
          } catch (e) {
            console.warn('[discontinuar] No se pudo quitar del origen:', e.message);
          }
        }

        onMutateGroups?.({ type: 'append', groupId: discontinuadosId, articulos: ids.map(id => ({ id })), baseById });
        if (currentGroupId && currentGroupId !== discontinuadosId) {
          onMutateGroups?.({ type: 'remove', groupId: currentGroupId, ids });
        }
        emitUiAction({
          businessId: effectiveBusinessId, kind: 'discontinue', scope: 'articulo',
          title: `⛔ ${subDisplayName} discontinuado`,
          message: `"${subDisplayName}": ${labelCount} → Discontinuados.`,
          createdAt: new Date().toISOString(),
          payload: {
            ids, discontinuadosGroupId: Number(discontinuadosId),
            undo: { payload: { prev: { fromGroupId: currentGroupId ?? null, fromBizId: agrupBizId ?? null, fromGroupName: agrupacionSeleccionada?.nombre ?? null, discontinuadosGroupId: Number(discontinuadosId), wasInDiscontinuados: false } } },
          },
        });
        onAfterMutation?.(ids);

      } else {
        // REACTIVAR → buscar orígenes y abrir diálogo
        let origenesMap = {};
        if (ids.length > 0) {
          try {
            const res = await httpBiz(`/agrupaciones/articulos/origenes`, { method: 'POST', body: { ids } }, discBizId);
            const origenes = res?.origenes ?? {};
            for (const [artIdStr, origen] of Object.entries(origenes)) {
              const artId = Number(artIdStr);
              const key = origen.groupId;
              if (!origenesMap[key]) origenesMap[key] = { groupId: origen.groupId, groupName: origen.groupName, bizId: origen.bizId, bizName: origen.bizName, ids: [] };
              origenesMap[key].ids.push(artId);
            }
          } catch (e) { console.warn('[reactivar bloque] No se pudo obtener origenes:', e.message); }
        }

        const grupos = Object.values(origenesMap);
        const sinOrigen = ids.filter(id => !grupos.some(g => g.ids.includes(id)));
        const resumenTexto = grupos.length > 0 ? grupos.map(g => `${g.bizName} › ${g.groupName} (${g.ids.length})`).join(', ') : null;

        setOrigenReactivar({ ids, origenesMap, sinOrigen, resumenTexto, labelCount, fromGroupName: grupos[0]?.groupName ?? null, fromBizName: grupos[0]?.bizName ?? null });
        handleClose();
        setTimeout(() => setDlgReactivarOpen(true), 0);
        return;
      }
    } catch (e) {
      console.error('DISCONTINUAR_BLOQUE_ERROR', e);
      notify?.('No se pudo cambiar el estado del subrubro', 'error');
      onRefetch?.();
    } finally { handleClose(); }
  }

  async function ejecutarReactivarBloque() {
    const { ids, origenesMap = {}, sinOrigen = [], labelCount } = origenReactivar || {};
    if (!ids?.length || !Number.isFinite(discontinuadosId)) return;

    try {
      for (const id of ids) {
        try { await httpBiz(`/agrupaciones/${discontinuadosId}/articulos/${id}`, { method: 'DELETE' }, discBizId); } catch { }
      }
      for (const grupo of Object.values(origenesMap)) {
        if (!grupo.groupId || !grupo.bizId || !grupo.ids?.length) continue;
        try { await httpBiz(`/agrupaciones/${grupo.groupId}/articulos`, { method: 'PUT', body: { ids: grupo.ids } }, grupo.bizId); }
        catch (e2) { console.warn(`[ejecutarReactivarBloque] No se pudo restaurar a ${grupo.groupName}:`, e2.message); }
      }

      onMutateGroups?.({ type: 'remove', groupId: discontinuadosId, ids });
      for (const grupo of Object.values(origenesMap)) {
        onMutateGroups?.({ type: 'append', groupId: grupo.groupId, articulos: grupo.ids.map(id => ({ id })), baseById });
      }

      const grupos = Object.values(origenesMap);
      const resumen = grupos.length > 0 ? grupos.map(g => `"${g.groupName}"`).join(', ') : null;
      emitUiAction({
        businessId: effectiveBusinessId, kind: 'info', scope: 'articulo',
        title: `✅ ${subDisplayName} reactivado`,
        message: resumen ? `"${subDisplayName}": ${labelCount} restaurado(s) a ${resumen}.` : `"${subDisplayName}": ${labelCount} disponible(s) nuevamente.`,
        createdAt: new Date().toISOString(),
        payload: { ids, discontinuadosGroupId: Number(discontinuadosId), prev: { origenesMap, discontinuadosGroupId: Number(discontinuadosId), wasInDiscontinuados: true } },
      });
    } catch (e) {
      console.error('REACTIVAR_BLOQUE_ERROR', e);
      notify?.('No se pudo reactivar el subrubro', 'error');
      onRefetch?.();
    } finally { setDlgReactivarOpen(false); }
  }

  const isArticuloBloqueadoCreate = useMemo(() => {
    const esTodo = (g) => { const n = norm(g?.nombre); return n === 'todo' || n === 'sin agrupacion' || n === 'sin agrupación' || n === 'sin agrupar' || n === 'sin grupo'; };
    const assigned = new Set();
    (agrupaciones || []).filter((g) => !esTodo(g) && !isDiscontinuadosGroup(g)).filter((g) => Number(g.id) !== currentGroupId)
      .forEach((g) => (g.articulos || []).forEach((a) => { const n = Number(a?.id); if (Number.isFinite(n)) assigned.add(String(n)); }));
    return (art) => assigned.has(String(art?.id));
  }, [agrupaciones, currentGroupId]);

  useEffect(() => {
    if (!openCrearAgr || haveExternalTree || loading || loadedRef.current) return;
    let alive = true;
    (async () => {
      try {
        setLoadingLocal(true);
        if (!effectiveBusinessId) { if (alive) setTreeLocal([]); return; }
        const res = await BusinessesAPI.articlesFromDB(effectiveBusinessId);
        const flat = (res?.items || []).map(mapRowToArticle).filter((a) => Number.isFinite(a.id));
        if (alive) { setTreeLocal(buildTree(flat)); loadedRef.current = true; }
      } catch { if (alive) setTreeLocal([]); }
      finally { if (alive) setLoadingLocal(false); }
    })();
    return () => { alive = false; };
  }, [openCrearAgr, haveExternalTree, loading, effectiveBusinessId]);

  return (
    <>
      <IconButton size="small" onClick={handleOpen} title="Acciones de subrubro">
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        <MenuItem onClick={toggleDiscontinuarBloque}>
          <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{isInDiscontinuadosView ? 'Reactivar (quitar de Discontinuados)' : 'Discontinuar'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={quitarDeActual} disabled={isTodo}>
          <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{isTodo ? 'Ya está en Sin agrupación' : 'Quitar de esta agrupación'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={openMover}>
          <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Mover a…</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          handleClose();
          const ids = allArticleIdsForSub;
          setPreselect({ articleIds: ids, fromGroupId: !isTodo && currentGroupId ? Number(currentGroupId) : null, fromGroupBizId: !isTodo && agrupacionSeleccionada?.business_id ? Number(agrupacionSeleccionada.business_id) : null, todoGroupId: isTodo && todoGroupId ? Number(todoGroupId) : null, allowAssigned: true });
          setOpenCrearAgr(true);
        }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{`Crear agrupación a partir de "${subDisplayName}"`}</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── Diálogo de reactivación en bloque ── */}
      <Dialog open={dlgReactivarOpen} onClose={() => setDlgReactivarOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Reactivar subrubro</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            ¿Reactivar <strong>{origenReactivar?.labelCount || ''}</strong> artículo(s) de <strong>{subDisplayName}</strong>?
          </Typography>
          {(() => {
            const grupos = Object.values(origenReactivar?.origenesMap || {});
            const sinOrigen = origenReactivar?.sinOrigen || [];
            if (grupos.length === 0 && sinOrigen.length === 0) return null;
            return (
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {grupos.length > 0 && (
                  <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Origen detectado — se reactivarán en:</Typography>
                    {grupos.map(g => (
                      <Typography key={g.groupId} variant="body2">
                        🏢 <strong>{g.bizName}</strong> › 📁 <strong>{g.groupName}</strong>
                        <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>({g.ids.length} artículo{g.ids.length !== 1 ? 's' : ''})</Typography>
                      </Typography>
                    ))}
                  </Box>
                )}
                {sinOrigen.length > 0 && (
                  <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#fffbeb', border: '1px solid #fbbf24' }}>
                    <Typography variant="body2" color="text.secondary">
                      ⚠️ {sinOrigen.length} artículo{sinOrigen.length !== 1 ? 's' : ''} sin origen — quedarán en Sin Agrupación.
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button variant="contained" size="small" onClick={ejecutarReactivarBloque} sx={{ flex: 1, minWidth: 140, textTransform: 'none' }}>
            {origenReactivar?.resumenTexto ? 'Reactivar en origen' : 'Reactivar (sin agrupación)'}
          </Button>
          <Button variant="outlined" size="small" sx={{ flex: 1, minWidth: 140, textTransform: 'none' }}
            onClick={() => { setDlgReactivarOpen(false); setTimeout(() => setDlgMoverOpen(true), 0); }}>
            Mover a otro lugar…
          </Button>
          <Button variant="text" size="small" color="inherit" sx={{ textTransform: 'none' }}
            onClick={() => setDlgReactivarOpen(false)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal unificado "Mover a…" ── */}
      <MoverAModal
        open={dlgMoverOpen}
        onClose={closeMover}
        tituloExtra={`${articuloIds.length} artículo(s)`}
        agrupacionesLocales={agrupacionesLocalesParaMover}
        currentGroupId={currentGroupId}
        allBusinesses={allBusinesses}
        activeBizId={agrupBizId}
        onConfirm={ejecutarMover}
        isMoving={isMoving}
      />

      <AgrupacionCreateModal
        open={openCrearAgr}
        onClose={() => setOpenCrearAgr(false)}
        businessId={effectiveBusinessId}
        mode="create"
        preselect={preselect}
        todosArticulos={effectiveTree}
        loading={effectiveLoading}
        isArticuloBloqueado={isArticuloBloqueadoCreate}
        onCreated={(nombreCreado, newId, articulos) => {
          notify?.(`Agrupación "${nombreCreado}" creada`, 'success');
          const movingIds = (Array.isArray(articulos) ? articulos : []).map(a => Number(a?.id)).filter(Number.isFinite);
          const fromGrpId = preselect?.fromGroupId;
          if (!isTodo && fromGrpId && movingIds.length) onMutateGroups?.({ type: 'remove', groupId: Number(fromGrpId), ids: movingIds });
          const todoGrpId = preselect?.todoGroupId;
          if (isTodo && todoGrpId && movingIds.length) onMutateGroups?.({ type: 'remove', groupId: Number(todoGrpId), ids: movingIds });
          onMutateGroups?.({ type: 'create', id: Number(newId), nombre: nombreCreado, articulos: Array.isArray(articulos) ? articulos : [] });
          onGroupCreated?.(nombreCreado, newId, articulos);
          if (!isTodo) onRefetch?.();
        }}
        existingNames={(agrupaciones || []).map((g) => String(g?.nombre || '')).filter(Boolean)}
        treeMode={treeMode}
        groupName={subDisplayName}
        allowedIds={allowedIds || null}
      />
    </>
  );
}

export default React.memo(SubrubroAccionesMenu);