/* eslint-disable no-empty */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import GroupAddIcon from '@mui/icons-material/GroupAdd';

import { httpBiz, BusinessesAPI } from '../servicios/apiBusinesses';
import { addExclusiones } from '../servicios/apiAgrupacionesTodo';
import AgrupacionCreateModal from './AgrupacionCreateModal';

const getNum = (v) => Number(v ?? 0);

// ---- helpers del fallback local (mismo buildTree que arriba)
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
    for (const [categoria, articulos] of byCat.entries()) {
      categorias.push({ categoria, articulos });
    }
    categorias.sort((a, b) => String(a.categoria).localeCompare(String(b.categoria), 'es', { sensitivity: 'base', numeric: true }));
    tree.push({ subrubro, categorias });
  }
  tree.sort((a, b) => String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true }));
  return tree;
};

function SubrubroAccionesMenu({
  isTodo = false,
  agrupaciones = [],
  agrupacionSeleccionada,
  todoGroupId,
  articuloIds = [],
  onRefetch,
  notify,
  onAfterMutation,
  onGroupCreated,
  todosArticulos = [],
  loading = false,
  onMutateGroups,
  baseById,
  articuloIdsArray
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [openCrearAgr, setOpenCrearAgr] = useState(false);
  const [preselect, setPreselect] = useState(null);

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

  const gruposDestino = useMemo(
    () => (agrupaciones || [])
      .filter(g => g?.id)
      .filter(g => Number(g.id) !== currentGroupId),
    [agrupaciones, currentGroupId]
  );

  const openMover = useCallback(() => { handleClose(); setTimeout(() => setDlgMoverOpen(true), 0); }, [handleClose]);
  const closeMover = useCallback(() => setDlgMoverOpen(false), []);

  async function mover() {
    const ids = articuloIds.map(getNum).filter(Boolean);
    if (!ids.length) return;

    const fromId = (!isTodo && currentGroupId) ? Number(currentGroupId) : null;
    const toId = Number(destId);

    if (fromId && fromId === toId) {
      notify?.('Ya está en esa agrupación', 'info');
      onAfterMutation?.(ids);
      return closeMover();
    }

    setIsMoving(true);
    try {
      if (fromId) {
        onMutateGroups?.({ type: 'move', fromId, toId, ids, baseById });
        try {
          await httpBiz(`/agrupaciones/${fromId}/move-items`, { method: 'POST', body: { toId, ids } });
        } catch {
          await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids } });
          for (const id of ids) { try { await httpBiz(`/agrupaciones/${fromId}/articulos/${id}`, { method: 'DELETE' }); } catch {} }
        }
      } else {
        await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids } });
        onMutateGroups?.({ type: 'append', groupId: toId, articulos: ids.map(id => ({ id })), baseById });
      }

      onMutateGroups?.({ type: 'move', fromId, toId, ids: articuloIdsArray, baseById });
      notify?.(`Subrubro movido (${ids.length} artículo/s)`, 'success');
      onAfterMutation?.(ids);
      onRefetch?.();
    } catch (e) {
      console.error('MOVER_SUBRUBRO_ERROR', e);
      notify?.('No se pudo mover el subrubro', 'error');
    } finally {
      setIsMoving(false);
      closeMover();
    }
  }

  async function quitarDeActual() {
    const ids = articuloIds.map(getNum).filter(Boolean);
    if (isTodo && todoGroupId && ids.length) {
      try {
        await addExclusiones(todoGroupId, ids.map(id => ({ scope: 'articulo', ref_id: id })));
        notify?.(`Ocultados ${ids.length} artículo(s) de TODO`, 'success');
        onAfterMutation?.(ids);
        onRefetch?.();
      } catch (e) {
        console.error('EXCLUIR_SUBRUBRO_TODO_ERROR', e);
        notify?.('No se pudo ocultar el subrubro de TODO', 'error');
      } finally {
        handleClose();
      }
      return;
    }

    if (!currentGroupId) return;
    try {
      // FIX: enviar ids (no [ids])
      onMutateGroups?.({ type: 'remove', groupId: Number(currentGroupId), ids });
      for (const id of ids) { try { await httpBiz(`/agrupaciones/${currentGroupId}/articulos/${id}`, { method: 'DELETE' }); } catch {} }
      notify?.(`Quitados ${ids.length} artículo(s) de ${agrupacionSeleccionada?.nombre}`, 'success');
      onAfterMutation?.(ids);
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo quitar el subrubro', 'error');
    } finally {
      handleClose();
    }
  }

  const isArticuloBloqueadoCreate = useMemo(() => {
    const assigned = new Set();
    (agrupaciones || [])
      .filter(g => (g?.nombre || '').toUpperCase() !== 'TODO')
      .forEach(g => (g.articulos || []).forEach(a => {
        const n = Number(a?.id);
        if (Number.isFinite(n)) assigned.add(String(n));
      }));
    return (art) => assigned.has(String(art?.id));
  }, [agrupaciones]);

  // Fallback local: cargo plano desde DB y lo convierto al árbol esperado
  useEffect(() => {
    if (!openCrearAgr) return;
    if (haveExternalTree || loading || loadedRef.current) return;

    let alive = true;
    (async () => {
      try {
        setLoadingLocal(true);
        const bizId = localStorage.getItem('activeBusinessId');
        if (!bizId) { setTreeLocal([]); return; }
        const res = await BusinessesAPI.articlesFromDB(bizId);
        const flat = (res?.items || []).map(mapRowToArticle).filter(a => Number.isFinite(a.id));
        if (alive) { setTreeLocal(buildTree(flat)); loadedRef.current = true; }
      } catch (e) {
        console.error('LOAD_TREE_ERROR', e);
        if (alive) setTreeLocal([]);
      } finally {
        if (alive) setLoadingLocal(false);
      }
    })();

    return () => { alive = false; };
  }, [openCrearAgr, haveExternalTree, loading]);

  return (
    <>
      <IconButton size="small" onClick={handleOpen} title="Acciones de subrubro">
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        <MenuItem onClick={openMover}>
          <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Mover subrubro a…</ListItemText>
        </MenuItem>

        {!isTodo && (
          <MenuItem onClick={quitarDeActual}>
            <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Quitar del grupo actual</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={() => {
          handleClose();
          const ids = (articuloIds || []).map(getNum).filter(Boolean);
          setPreselect({
            articleIds: ids,
            fromGroupId: (!isTodo && currentGroupId) ? Number(currentGroupId) : null,
            allowAssigned: true,
          });
          setOpenCrearAgr(true);
        }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación con este subrubro…</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={dlgMoverOpen} onClose={closeMover} keepMounted>
        <DialogTitle>Mover {articuloIds.length} artículo(s) a…</DialogTitle>
        <DialogContent>
          <TextField
            select
            SelectProps={{ native: true }}
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            <option value="" disabled>Seleccionar…</option>
            {gruposDestino.map(g => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMover} disabled={isMoving}>Cancelar</Button>
          <Button onClick={mover} variant="contained" disabled={!destId || isMoving}>
            {isMoving ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>

      <AgrupacionCreateModal
        open={openCrearAgr}
        onClose={() => setOpenCrearAgr(false)}
        mode="create"
        preselect={preselect}
        todosArticulos={effectiveTree}
        loading={effectiveLoading}
        isArticuloBloqueado={isArticuloBloqueadoCreate}
        onCreated={(nombreCreado, newId, articulos) => {
          notify?.(`Agrupación “${nombreCreado}” creada`, 'success');
          onGroupCreated?.(nombreCreado, newId, articulos);
          onMutateGroups?.({
            type: 'create',
            id: Number(newId),
            nombre: nombreCreado,
            articulos: Array.isArray(articulos) ? articulos : [],
          });
          onRefetch?.();
        }}
        existingNames={(agrupaciones || []).map(g => String(g?.nombre || '')).filter(Boolean)}
      />
    </>
  );
}

export default React.memo(SubrubroAccionesMenu);

