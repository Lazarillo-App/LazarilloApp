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
import BlockIcon from '@mui/icons-material/Block';
import { emitUiAction } from '@/servicios/uiEvents';
import { httpBiz, BusinessesAPI } from '../servicios/apiBusinesses';
import { addExclusiones } from '../servicios/apiAgrupacionesTodo';
import AgrupacionCreateModal from './AgrupacionCreateModal';

const getNum = (v) => Number(v ?? 0);
const norm = (s) => String(s || '').trim().toLowerCase();

const isDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
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
    byCat.get(cat).push({
      id: a.id,
      nombre: a.nombre,
      precio: a.precio,
      categoria: cat,
      subrubro: sub,
    });
  }
  const tree = [];
  for (const [subrubro, byCat] of bySub.entries()) {
    const categorias = [];
    for (const [categoria, articulos] of byCat.entries()) {
      categorias.push({ categoria, articulos });
    }
    categorias.sort((a, b) =>
      String(a.categoria).localeCompare(String(b.categoria), 'es', {
        sensitivity: 'base',
        numeric: true,
      })
    );
    tree.push({ subrubro, categorias });
  }
  tree.sort((a, b) =>
    String(a.subrubro).localeCompare(String(b.subrubro), 'es', {
      sensitivity: 'base',
      numeric: true,
    })
  );
  return tree;
};

const safeId = (a) => {
  const n = Number(a?.id ?? a?.articuloId ?? a?.codigo);
  return Number.isFinite(n) ? n : null;
};

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
  treeMode = "cat-first",
  businessId,
  allowedIds,
}) {
  /* ==================== businessId efectivo ==================== */
  const effectiveBusinessId =
    businessId ??
    localStorage.getItem('activeBusinessId') ??
    localStorage.getItem('effectiveBusinessId') ??
    null;

  /* ==================== UI menu states ==================== */
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

  const currentGroupId = agrupacionSeleccionada?.id
    ? Number(agrupacionSeleccionada.id)
    : null;

  const subDisplayName = useMemo(() => {
    if (typeof subrubro === 'string') return subrubro.trim() || 'este subrubro';
    if (subrubro && typeof subrubro === 'object') {
      if (subrubro.nombre) return String(subrubro.nombre).trim();
      if (subrubro.label) return String(subrubro.label).trim();
    }
    return 'este subrubro';
  }, [subrubro]);

  // Discontinuados
  const discontinuadosGroup = useMemo(
    () => (agrupaciones || []).find((g) => isDiscontinuadosGroup(g)) || null,
    [agrupaciones]
  );
  const discontinuadosId = discontinuadosGroup ? Number(discontinuadosGroup.id) : null;

  const isInDiscontinuadosView = useMemo(
    () => !!agrupacionSeleccionada && isDiscontinuadosGroup(agrupacionSeleccionada),
    [agrupacionSeleccionada]
  );

  const gruposDestino = useMemo(
    () =>
      (agrupaciones || [])
        .filter((g) => g?.id)
        .filter((g) => Number(g.id) !== currentGroupId),
    [agrupaciones, currentGroupId]
  );

  const subName = useMemo(() => norm(subrubro?.nombre || subrubro), [subrubro]);

  const allArticleIdsForSub = useMemo(() => {
    const baseIds = (articuloIds || []).map(getNum).filter(Boolean);
    if (!baseIds.length) return baseIds;

    const out = new Set(baseIds);

    // 🟢 MODO RUBRO (cat-first)
    if (treeMode === "cat-first") {
      if (!subName || !Array.isArray(todosArticulos) || !todosArticulos.length) {
        return baseIds;
      }

      for (const node of todosArticulos) {
        const nodeSubNorm = norm(node?.subrubro);
        if (nodeSubNorm !== subName) continue;

        for (const cat of node.categorias || []) {
          for (const art of cat.articulos || []) {
            const id = safeId(art);
            if (id != null) out.add(id);
          }
        }
      }

      return Array.from(out);
    }

    // 🟣 MODO SUBRUBRO (sr-first)
    const firstBase = baseById ? baseById.get(baseIds[0]) : null;
    const rubroNameNorm = norm(
      firstBase?.categoria ||
      firstBase?.raw?.categoria ||
      ''
    );

    if (!rubroNameNorm || !Array.isArray(todosArticulos) || !todosArticulos.length) {
      return baseIds;
    }

    for (const node of todosArticulos) {
      for (const cat of node.categorias || []) {
        const catNorm = norm(cat?.categoria);
        if (catNorm !== rubroNameNorm) continue;

        for (const art of cat.articulos || []) {
          const id = safeId(art);
          if (id != null) out.add(id);
        }
      }
    }

    return Array.from(out);
  }, [articuloIds, subName, baseById, todosArticulos, treeMode]);

  const openMover = useCallback(() => {
    handleClose();
    setTimeout(() => setDlgMoverOpen(true), 0);
  }, [handleClose]);

  const closeMover = useCallback(() => setDlgMoverOpen(false), []);

  async function mover() {
    const ids = articuloIds.map(getNum).filter(Boolean);
    if (!ids.length || !destId) return;

    const fromId = !isTodo && currentGroupId ? Number(currentGroupId) : null;
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
          await httpBiz(
            `/agrupaciones/${fromId}/move-items`,
            { method: 'POST', body: { toId, ids } },
            effectiveBusinessId
          );
        } catch {
          await httpBiz(
            `/agrupaciones/${toId}/articulos`,
            { method: 'PUT', body: { ids } },
            effectiveBusinessId
          );

          for (const id of ids) {
            try {
              await httpBiz(
                `/agrupaciones/${fromId}/articulos/${id}`,
                { method: 'DELETE' },
                effectiveBusinessId
              );
            } catch { }
          }
        }
      } else {
        await httpBiz(
          `/agrupaciones/${toId}/articulos`,
          { method: 'PUT', body: { ids } },
          effectiveBusinessId
        );

        onMutateGroups?.({
          type: 'append',
          groupId: toId,
          articulos: ids.map((id) => ({ id })),
          baseById,
        });
      }

      notify?.(`Subrubro movido (${ids.length} artículo/s)`, 'success');
      try {
        const destGroup = (agrupaciones || []).find(g => Number(g.id) === toId);
        window.dispatchEvent(
          new CustomEvent('ui:action', {
            detail: {
              kind: 'move',
              scope: 'articulo',
              businessId: effectiveBusinessId,
              createdAt: new Date().toISOString(),
              title: 'Subrubro movido',
              message: `${ids.length} artículo(s) movido(s) a "${destGroup?.nombre || 'agrupación'}".`,
              payload: { ids, fromId, toId },
            },
          })
        );
      } catch { }
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

    // TODO → exclusiones
    if (isTodo && todoGroupId && ids.length) {
      try {
        await addExclusiones(
          todoGroupId,
          ids.map((id) => ({ scope: 'articulo', ref_id: id }))
        );
        notify?.(`Quitados ${ids.length} artículo(s) de TODO`, 'success');
        try {
          window.dispatchEvent(
            new CustomEvent('ui:action', {
              detail: {
                kind: 'info',
                scope: 'articulo',
                businessId: effectiveBusinessId,
                createdAt: new Date().toISOString(),
                title: 'Quitados de TODO',
                message: `${ids.length} artículo(s) excluidos.`,
                payload: { ids },
              },
            })
          );
        } catch { }
        onAfterMutation?.(ids);
        onRefetch?.();
      } catch (e) {
        console.error('EXCLUIR_SUBRUBRO_TODO_ERROR', e);
        notify?.('No se pudo quitar el subrubro de TODO', 'error');
      } finally {
        handleClose();
      }
      return;
    }

    if (!currentGroupId) return;

    try {
      onMutateGroups?.({
        type: 'remove',
        groupId: Number(currentGroupId),
        ids,
      });

      for (const id of ids) {
        try {
          await httpBiz(
            `/agrupaciones/${currentGroupId}/articulos/${id}`,
            { method: 'DELETE' },
            effectiveBusinessId
          );
        } catch { }
      }

      notify?.(
        `Quitados ${ids.length} artículo(s) de ${agrupacionSeleccionada?.nombre}`,
        'success'
      );
      try {
        window.dispatchEvent(
          new CustomEvent('ui:action', {
            detail: {
              kind: 'info',
              scope: 'articulo',
              businessId: effectiveBusinessId,
              createdAt: new Date().toISOString(),
              title: 'Artículos removidos',
              message: `${ids.length} quitado(s) de "${agrupacionSeleccionada?.nombre}".`,
              payload: { ids, fromGroupId: currentGroupId },
            },
          })
        );
      } catch { }
      onAfterMutation?.(ids);
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo quitar el subrubro', 'error');
    } finally {
      handleClose();
    }
  }

  // ✅ DISCONTINUAR/REACTIVAR BLOQUE (sin cambiar vista)
  async function toggleDiscontinuarBloque() {
    const ids = (articuloIds || []).map(getNum).filter(Boolean);
    if (!ids.length) return;

    if (!discontinuadosId) {
      notify?.('No existe la agrupación "Discontinuados". Creala primero.', 'error');
      handleClose();
      return;
    }

    const labelCount = ids.length === 1 ? '1 artículo' : `${ids.length} artículos`;

    try {
      if (!isInDiscontinuadosView) {
        // ===========================
        // ✅ DISCONTINUAR
        // ===========================
        await httpBiz(
          `/agrupaciones/${discontinuadosId}/articulos`,
          { method: 'PUT', body: { ids } },
          effectiveBusinessId
        );

        onMutateGroups?.({
          type: 'append',
          groupId: discontinuadosId,
          articulos: ids.map((id) => ({ id })),
          baseById,
        });

        // ❌ NO notify (evita duplicado)
        // notify?.(`Subrubro discontinuado (${labelCount})`, 'success');

        // ✅ SOLO emitUiAction con estructura correcta
        emitUiAction({
          businessId: effectiveBusinessId,
          kind: 'discontinue',
          scope: 'articulo',
          title: `⛔ ${subDisplayName} discontinuado`,
          message: `"${subDisplayName}": ${labelCount} → Discontinuados.`,
          createdAt: new Date().toISOString(),
          payload: {
            ids,
            discontinuadosGroupId: Number(discontinuadosId),
            undo: { // ✅ Estructura correcta para undo
              payload: {
                prev: {
                  fromGroupId: currentGroupId ?? null,
                  discontinuadosGroupId: Number(discontinuadosId),
                  wasInDiscontinuados: false,
                },
              },
            },
          },
        });

        onRefetch?.();

      } else {
        // ===========================
        // ✅ REACTIVAR
        // ===========================
        for (const id of ids) {
          try {
            await httpBiz(
              `/agrupaciones/${discontinuadosId}/articulos/${id}`,
              { method: 'DELETE' },
              effectiveBusinessId
            );
          } catch { }
        }

        onMutateGroups?.({
          type: 'remove',
          groupId: discontinuadosId,
          ids,
        });

        // ❌ NO notify (evita duplicado)
        // notify?.(`Subrubro reactivado (${labelCount})`, 'success');

        // ✅ SOLO emitUiAction
        emitUiAction({
          businessId: effectiveBusinessId,
          kind: 'info', // ← NO 'discontinue' porque es reactivación
          scope: 'articulo',
          title: `✅ ${subDisplayName} reactivado`,
          message: `"${subDisplayName}": ${labelCount} disponible(s) nuevamente.`,
          createdAt: new Date().toISOString(),
          payload: {
            ids,
            discontinuadosGroupId: Number(discontinuadosId),
            prev: {
              fromGroupId: currentGroupId ?? null,
              discontinuadosGroupId: Number(discontinuadosId),
              wasInDiscontinuados: true,
            },
          },
        });

        onRefetch?.();
      }
    } catch (e) {
      console.error('DISCONTINUAR_BLOQUE_ERROR', e);
      notify?.('No se pudo cambiar el estado del subrubro', 'error');
    } finally {
      handleClose();
    }
  }

  const isArticuloBloqueadoCreate = useMemo(() => {
    const assigned = new Set();
    (agrupaciones || [])
      .filter((g) => (g?.nombre || '').toUpperCase() !== 'TODO')
      .forEach((g) =>
        (g.articulos || []).forEach((a) => {
          const n = Number(a?.id);
          if (Number.isFinite(n)) assigned.add(String(n));
        })
      );
    return (art) => assigned.has(String(art?.id));
  }, [agrupaciones]);

  useEffect(() => {
    if (!openCrearAgr) return;
    if (haveExternalTree || loading || loadedRef.current) return;

    let alive = true;
    (async () => {
      try {
        setLoadingLocal(true);

        if (!effectiveBusinessId) {
          if (alive) setTreeLocal([]);
          return;
        }

        const res = await BusinessesAPI.articlesFromDB(effectiveBusinessId);
        const flat = (res?.items || [])
          .map(mapRowToArticle)
          .filter((a) => Number.isFinite(a.id));

        if (alive) {
          setTreeLocal(buildTree(flat));
          loadedRef.current = true;
        }
      } catch (e) {
        console.error('LOAD_TREE_ERROR', e);
        if (alive) setTreeLocal([]);
      } finally {
        if (alive) setLoadingLocal(false);
      }
    })();

    return () => { alive = false; };
  }, [openCrearAgr, haveExternalTree, loading, effectiveBusinessId]);

  return (
    <>
      <IconButton size="small" onClick={handleOpen} title="Acciones de subrubro">
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        {/* 1. Discontinuar / Reactivar */}
        <MenuItem onClick={toggleDiscontinuarBloque}>
          <ListItemIcon>
            <BlockIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {isInDiscontinuadosView
              ? 'Reactivar (quitar de Discontinuados)'
              : 'Discontinuar'}
          </ListItemText>
        </MenuItem>

        {/* 2. Quitar de esta agrupación */}
        <MenuItem
          onClick={quitarDeActual}
          disabled={isTodo} // ✅ Deshabilitar si está en TODO
        >
          <ListItemIcon>
            <UndoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {isTodo ? 'Ya está en Sin agrupación' : 'Quitar de esta agrupación'}
          </ListItemText>
        </MenuItem>

        {/* 3. Mover a… */}
        <MenuItem onClick={openMover}>
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Mover a…</ListItemText>
        </MenuItem>

        {/* 4. Crear agrupación a partir de… */}
        <MenuItem
          onClick={() => {
            handleClose();
            const ids = allArticleIdsForSub;
            setPreselect({
              articleIds: ids,
              fromGroupId: !isTodo && currentGroupId ? Number(currentGroupId) : null,
              allowAssigned: true,
            });
            setOpenCrearAgr(true);
          }}
        >
          <ListItemIcon>
            <GroupAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{`Crear agrupación a partir de "${subDisplayName}"`}</ListItemText>
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
            {gruposDestino.map((g) => (
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
        businessId={effectiveBusinessId}
        mode="create"
        preselect={preselect}
        todosArticulos={effectiveTree}
        loading={effectiveLoading}
        isArticuloBloqueado={isArticuloBloqueadoCreate}
        onCreated={(nombreCreado, newId, articulos) => {
          notify?.(`Agrupación “${nombreCreado}” creada`, 'success');
          try {
            window.dispatchEvent(
              new CustomEvent('ui:action', {
                detail: {
                  kind: 'group_create',
                  scope: 'articulo',
                  businessId: effectiveBusinessId,
                  createdAt: new Date().toISOString(),
                  title: 'Agrupación creada',
                  message: `"${nombreCreado}" con ${(articulos || []).length} artículo(s).`,
                  payload: { groupId: newId, groupName: nombreCreado },
                },
              })
            );
          } catch { }
          onGroupCreated?.(nombreCreado, newId, articulos);
          onMutateGroups?.({
            type: 'create',
            id: Number(newId),
            nombre: nombreCreado,
            articulos: Array.isArray(articulos) ? articulos : [],
          });
          onRefetch?.();
        }}
        existingNames={(agrupaciones || [])
          .map((g) => String(g?.nombre || ''))
          .filter(Boolean)}
        treeMode="cat-first"
        groupName={subDisplayName}
        allowedIds={allowedIds || null}
      />
    </>
  );
}

export default React.memo(SubrubroAccionesMenu);
