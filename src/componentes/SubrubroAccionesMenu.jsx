import React, { useEffect, useMemo, useState } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import GroupAddIcon from '@mui/icons-material/GroupAdd';

import { httpBiz, BusinessesAPI } from '../servicios/apiBusinesses';
import AgrupacionCreateModal from './AgrupacionCreateModal';

const getNum = (v) => Number(v ?? 0);

// Helpers locales (mismos que arriba)
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
  const cats = new Map();
  for (const a of flatList) {
    if (!Number.isFinite(a.id)) continue;
    const cat = a.categoria || 'Sin categoría';
    const sr = a.subrubro || 'Sin subrubro';
    if (!cats.has(cat)) cats.set(cat, { id: cat, nombre: cat, subrubros: [] });
    const catObj = cats.get(cat);
    let srObj = catObj.subrubros.find(s => s.nombre === sr);
    if (!srObj) { srObj = { nombre: sr, articulos: [] }; catObj.subrubros.push(srObj); }
    srObj.articulos.push({ id: a.id, nombre: a.nombre, categoria: cat, subrubro: sr, precio: a.precio });
  }
  return Array.from(cats.values());
};

export default function SubrubroAccionesMenu({
  articulo,
  isTodo = false,
  agrupaciones = [],
  agrupacionSeleccionada,
  todoGroupId,
  articuloIds = [],
  onRefetch,
  notify,
  onAfterMutation,

  // (opcionales) si vienen desde el padre, los usamos; si no, los cargamos acá
  todosArticulos,
  loading,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [openCrearAgr, setOpenCrearAgr] = useState(false);

  // fallback interno
  const [treeLocal, setTreeLocal] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(false);

  const haveExternalTree = Array.isArray(todosArticulos);
  const effectiveTree = haveExternalTree ? todosArticulos : treeLocal;
  const effectiveLoading = haveExternalTree ? !!loading : loadingLocal;

  const open = Boolean(anchorEl);
  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const currentGroupId = agrupacionSeleccionada?.id ? Number(agrupacionSeleccionada.id) : null;

  const gruposDestino = useMemo(
    () => (agrupaciones || [])
      .filter(g => g?.id)
      .filter(g => Number(g.id) !== currentGroupId),
    [agrupaciones, currentGroupId]
  );

  const openMover = () => { handleClose(); setTimeout(() => setDlgMoverOpen(true), 0); };
  const closeMover = () => setDlgMoverOpen(false);

  async function mover() {
    if (!destId) return;
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
        try {
          await httpBiz(`/agrupaciones/${fromId}/move-items`, { method: 'POST', body: { toId, ids } });
        } catch {
          await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids } });
          for (const id of ids) {
            try { await httpBiz(`/agrupaciones/${fromId}/articulos/${id}`, { method: 'DELETE' }); } catch { }
          }
        }
      } else {
        await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids } });
      }

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
    if (isTodo || !currentGroupId) return;
    const ids = articuloIds.map(getNum).filter(Boolean);
    try {
      for (const id of ids) {
        try { await httpBiz(`/agrupaciones/${currentGroupId}/articulos/${id}`, { method: 'DELETE' }); } catch { }
      }
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
    (Array.isArray(agrupaciones) ? agrupaciones : [])
      .filter(Boolean)
      .filter(g => (g?.nombre || '').toUpperCase() !== 'TODO')
      .forEach(g => {
        const arts = Array.isArray(g?.articulos) ? g.articulos : [];
        arts.filter(Boolean).forEach(a => {
          const id = Number(a?.id);
          if (Number.isFinite(id)) assigned.add(String(id));
        });
      });
    return (art) => assigned.has(String(art?.id));
  }, [agrupaciones]);


  useEffect(() => {
    if (!openCrearAgr) return;
    if (haveExternalTree) return;
    (async () => {
      try {
        setLoadingLocal(true);
        const bizId = localStorage.getItem('activeBusinessId');
        const res = await BusinessesAPI.articlesFromDB(bizId);
        const flat = (res?.items || []).map(mapRowToArticle).filter(a => Number.isFinite(a.id));
        setTreeLocal(buildTree(flat));
      } catch (e) {
        console.error('LOAD_TREE_ERROR', e);
        setTreeLocal([]);
      } finally {
        setLoadingLocal(false);
      }
    })();
  }, [openCrearAgr, haveExternalTree]);

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

        <MenuItem onClick={() => { handleClose(); setOpenCrearAgr(true); }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación con este subrubro…</ListItemText>
        </MenuItem>
      </Menu>

      {/* Diálogo "Mover a" */}
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

      {/* Modal: crear agrupación */}
      <AgrupacionCreateModal
        initialSelectedIds={[Number(articulo.id)]}
        open={openCrearAgr}
        onClose={() => setOpenCrearAgr(false)}
        mode="create"
        todosArticulos={effectiveTree}
        loading={effectiveLoading}
        isArticuloBloqueado={isArticuloBloqueadoCreate}
        onCreated={async (nombreCreado) => {
          notify?.(`Agrupación “${nombreCreado}” creada`, 'success');
          onRefetch?.();
        }}
      />
    </>
  );
}
