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
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';

const getNum = (v) => Number(v ?? 0);
const norm = (s) => String(s || '').trim().toLowerCase();
const isDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

/** Normaliza una fila plana proveniente de maxi_articles */
const mapRowToArticle = (row) => {
  const raw = row?.raw || {};
  const id = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
  return {
    id,
    nombre: row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`,
    // En DB ya está SWAP: categoria = subrubro Maxi, subrubro = rubro Maxi
    categoria: row?.categoria ?? raw?.categoria ?? raw?.rubro ?? 'Sin categoría',
    subrubro: row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? 'Sin subrubro',
    precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
  };
};

/** >>> Fallback local correcto: SUBRUBRO -> CATEGORÍAS -> ARTÍCULOS <<< */
const buildTree = (flatList = []) => {
  // subrubro -> categoria -> articulos[]
  const bySub = new Map();

  for (const a of flatList) {
    if (!Number.isFinite(a?.id)) continue;
    const sub = a.subrubro || 'Sin subrubro';    // padre (rubro Maxi)
    const cat = a.categoria || 'Sin categoría';  // hijo  (subrubro Maxi)

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

function ArticuloAccionesMenu({
  articulo,
  agrupaciones = [],
  agrupacionSeleccionada,
  todoGroupId,
  isTodo = false,
  onRefetch,
  onAfterMutation,
  notify,
  onGroupCreated,
  todosArticulos = [],
  loading = false,
  onMutateGroups,
  baseById
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

  const currentGroupId = agrupacionSeleccionada?.id ? Number(agrupacionSeleccionada.id) : null;

  const discontinuadosGroup = useMemo(
    () => (agrupaciones || []).find((g) => isDiscontinuadosGroup(g)),
    [agrupaciones]
  );
  const discontinuadosId = discontinuadosGroup ? Number(discontinuadosGroup.id) : null;

  const isInDiscontinuados = useMemo(() => {
    const idNum = getNum(articulo?.id);
    if (!Number.isFinite(idNum) || !discontinuadosId) return false;

    const g = (agrupaciones || []).find((gg) => Number(gg.id) === discontinuadosId);
    const arts = Array.isArray(g?.articulos) ? g.articulos : [];
    return arts.some((a) => Number(a?.id) === idNum);
  }, [agrupaciones, articulo, discontinuadosId]);

  const gruposDestino = useMemo(
    () => (agrupaciones || [])
      .filter(g => g?.id)
      .filter(g => Number(g.id) !== currentGroupId),
    [agrupaciones, currentGroupId]
  );

  const loadedRef = useRef(false);

  const openMover = useCallback(() => { handleClose(); setTimeout(() => setDlgMoverOpen(true), 0); }, [handleClose]);
  const closeMover = useCallback(() => setDlgMoverOpen(false), []);

  async function toggleDiscontinuado() {
    const idNum = getNum(articulo?.id);
    if (!Number.isFinite(idNum)) return;

    try {
      if (!isInDiscontinuados) {
        // 🔴 DESACTIVAR: mandarlo a "Discontinuados" sacándolo de cualquier agrupación
        await httpBiz('/agrupaciones/create-or-move', {
          method: 'POST',
          body: {
            nombre: 'Discontinuados',
            ids: [idNum],
          },
        });
        notify?.(`Artículo #${idNum} marcado como discontinuado`, 'success');
      } else {
        // 🟢 REACTIVAR: quitarlo de "Discontinuados" → queda sin agrupación (vuelve a TODO)
        if (!discontinuadosId) return;
        await httpBiz(`/agrupaciones/${discontinuadosId}/articulos/${idNum}`, {
          method: 'DELETE',
        });
        notify?.(`Artículo #${idNum} reactivado`, 'success');
      }

      onAfterMutation?.([idNum]);
      onRefetch?.();
    } catch (e) {
      console.error('TOGGLE_DISCONTINUADO_ERROR', e);
      notify?.('No se pudo cambiar el estado de discontinuado', 'error');
    } finally {
      handleClose();
    }
  }

  async function mover() {
    if (!destId) return;
    const idNum = getNum(articulo.id);
    const toId = Number(destId);
    const fromId = (!isTodo && currentGroupId) ? Number(currentGroupId) : null;

    if (fromId && fromId === toId) {
      notify?.('El artículo ya está en esa agrupación', 'info');
      onAfterMutation?.([idNum]);
      return closeMover();
    }

    setIsMoving(true);
    try {
      if (fromId) {
        try {
          await httpBiz(`/agrupaciones/${fromId}/move-items`, { method: 'POST', body: { toId, ids: [idNum] } });
        } catch {
          await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids: [idNum] } });
          try { await httpBiz(`/agrupaciones/${fromId}/articulos/${idNum}`, { method: 'DELETE' }); } catch { }
        }
        onMutateGroups?.({ type: 'move', fromId, toId, ids: [idNum], baseById });
      } else {
        await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids: [idNum] } });
        onMutateGroups?.({ type: 'append', groupId: toId, articulos: [{ id: idNum }], baseById });
      }

      notify?.(`Artículo #${idNum} movido`, 'success');
      onAfterMutation?.([idNum]);
      onRefetch?.();
    } catch (e) {
      console.error('MOVER_ERROR', e);
      notify?.('No se pudo mover el artículo', 'error');
    } finally {
      setIsMoving(false);
      closeMover();
    }
  }

  async function quitarDeActual() {
    const idNum = getNum(articulo.id);
    if (isTodo && todoGroupId) {
      try {
        await addExclusiones(todoGroupId, [{ scope: 'articulo', ref_id: idNum }]);
        notify?.(`Artículo #${idNum} ocultado de TODO`, 'success');
        onMutateGroups?.({ type: 'excludeFromTodo', ids: [idNum] });
        onAfterMutation?.([idNum]);
        onRefetch?.();
      } catch (e) {
        console.error('EXCLUIR_TODO_ERROR', e);
        notify?.('No se pudo ocultar de TODO', 'error');
      } finally {
        handleClose();
      }
      return;
    }

    if (!currentGroupId) return;
    try {
      await httpBiz(`/agrupaciones/${currentGroupId}/articulos/${idNum}`, { method: 'DELETE' });
      notify?.(`Artículo #${articulo.id} quitado de ${agrupacionSeleccionada?.nombre}`, 'success');
      onMutateGroups?.({ type: 'remove', groupId: currentGroupId, ids: [idNum] });
      onAfterMutation?.([idNum]);
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo quitar el artículo', 'error');
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

  // Fallback: cargo plano desde DB y lo transformo en SUBRUBRO->CATEGORÍAS->ART.
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
      <IconButton size="small" onClick={handleOpen}>
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        <MenuItem onClick={toggleDiscontinuado}>
          <ListItemIcon>
            {isInDiscontinuados
              ? <VisibilityIcon fontSize="small" />
              : <VisibilityOffIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>
            {isInDiscontinuados
              ? 'Reactivar (quitar de Discontinuados)'
              : 'Marcar como discontinuado'}
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={openMover}>
          <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Mover a…</ListItemText>
        </MenuItem>

        {!isTodo && (
          <MenuItem onClick={quitarDeActual}>
            <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Quitar de {agrupacionSeleccionada?.nombre}</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={() => {
          handleClose();
          const idNum = Number(articulo?.id);
          if (!Number.isFinite(idNum)) return;
          setPreselect({
            articleIds: [idNum],
            fromGroupId: (!isTodo && currentGroupId) ? Number(currentGroupId) : null,
            allowAssigned: true,
          });
          setOpenCrearAgr(true);
        }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación…</ListItemText>
        </MenuItem>
      </Menu>
      <Dialog open={dlgMoverOpen} onClose={closeMover} keepMounted>
        <DialogTitle>Mover artículo #{articulo.id} a…</DialogTitle>
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
          onMutateGroups?.({
            type: 'create',
            id: Number(newId),
            nombre: nombreCreado,
            articulos: Array.isArray(articulos) ? articulos : [],
          });
          onGroupCreated?.(nombreCreado, newId, articulos);
          onRefetch?.();
        }}
        existingNames={(agrupaciones || []).map(g => String(g?.nombre || '')).filter(Boolean)}
      />
    </>
  );
}

export default React.memo(ArticuloAccionesMenu);
