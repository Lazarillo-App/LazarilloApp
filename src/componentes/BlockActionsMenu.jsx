/* eslint-disable no-unused-vars */
// src/componentes/BlockActionsMenu.jsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';

import { httpBiz } from '../servicios/apiBusinesses';

// Helpers
const norm = (s) => String(s || '').trim().toLowerCase();

const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return (
    n === 'todo' ||
    n === 'sin agrupacion' ||
    n === 'sin agrupación' ||
    n === 'sin agrupar' ||
    n === 'sin grupo'
  );
};

export default function BlockActionsMenu({
  sub,
  agrupaciones = [],
  agrupacionSeleccionada = null,
  todoGroupId = null,
  onMutateGroups,
  onRefetch,
  notify,
  baseById = null,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const open = Boolean(anchorEl);
  const handleOpenMenu = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleCloseMenu = useCallback(() => setAnchorEl(null), []);
  const openDialog = useCallback(() => { handleCloseMenu(); setDlgMoverOpen(true); }, [handleCloseMenu]);
  const closeDialog = useCallback(() => setDlgMoverOpen(false), []);

  const currentGroupId = agrupacionSeleccionada?.id ? Number(agrupacionSeleccionada.id) : null;

  // ✅ Detectar si estamos en "Sin Agrupación"
  const isFromTodo = useMemo(() => {
    if (!agrupacionSeleccionada) return false;
    
    if (Number.isFinite(Number(todoGroupId)) && 
        Number(agrupacionSeleccionada.id) === Number(todoGroupId)) {
      return true;
    }
    
    return esTodoGroup(agrupacionSeleccionada);
  }, [agrupacionSeleccionada, todoGroupId]);

  // Extraer todos los ids del bloque
  const allArticleIds = useMemo(() => {
    const ids = [];
    const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
    for (const c of cats) {
      const arts = Array.isArray(c?.articulos) ? c.articulos : [];
      for (const a of arts) {
        const rawId = a?.id ?? a?.articleId ?? a?.articulo_id ?? a?.codigo ?? a?.codigoArticulo ?? a?.articuloId;
        const id = Number(rawId);
        if (Number.isFinite(id) && id > 0) ids.push(id);
      }
    }
    return Array.from(new Set(ids));
  }, [sub]);

  // Destinos posibles
  const gruposDestino = useMemo(() => {
    return (agrupaciones || [])
      .filter(g => g?.id)
      .filter(g => !esTodoGroup(g))
      .filter(g => Number(g.id) !== Number(currentGroupId));
  }, [agrupaciones, currentGroupId]);

  const CHUNK_SIZE = 250;

  const mover = useCallback(async () => {
    if (!destId) {
      notify?.('Seleccioná una agrupación destino', 'info');
      return;
    }
    const toId = Number(destId);
    if (!Number.isFinite(toId) || toId <= 0) {
      notify?.('Destino inválido', 'error');
      return;
    }

    const ids = allArticleIds.slice();
    if (!ids.length) {
      notify?.('No hay artículos para mover', 'info');
      closeDialog();
      return;
    }

    setIsMoving(true);

    try {
      // ✅ CASO 1: Origen es "Sin Agrupación" (TODO)
      if (isFromTodo) {
        console.log('🔄 Moviendo desde "Sin agrupación" (TODO)...', { 
          todoGroupId, 
          toId, 
          count: ids.length 
        });

        if (Number.isFinite(Number(todoGroupId)) && Number(todoGroupId) > 0) {
          // ⚠️ ESTRATEGIA: PUT + DELETE forzado (no confiar en move-items)
          console.log('📝 Estrategia: PUT al destino + DELETE forzado del origen');
          
          // 1️⃣ PUT: Agregar al destino
          for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            await httpBiz(`/agrupaciones/${toId}/articulos`, {
              method: 'PUT',
              body: { ids: chunk },
            });
          }
          console.log('✅ PUT completado - artículos agregados al destino');

          // 2️⃣ DELETE: Quitar del TODO (forzado)
          try {
            // Intentar DELETE bulk
            await httpBiz(`/agrupaciones/${todoGroupId}/articulos`, {
              method: 'DELETE',
              body: { ids },
            });
            console.log('✅ DELETE bulk completado - artículos quitados del TODO');
          } catch (e2) {
            console.warn('⚠️ DELETE bulk falló, eliminando uno por uno...', e2);
            
            // Fallback: DELETE uno por uno
            let deleted = 0;
            let failed = 0;
            
            for (const id of ids) {
              try {
                await httpBiz(`/agrupaciones/${todoGroupId}/articulos/${id}`, {
                  method: 'DELETE',
                });
                deleted++;
              } catch (err) {
                console.error(`❌ No se pudo eliminar artículo ${id}:`, err);
                failed++;
              }
            }
            
            console.log(`✅ DELETE individual: ${deleted} exitosos, ${failed} fallidos`);
            
            if (failed > 0) {
              notify?.(`⚠️ ${deleted} movidos, ${failed} quedaron en TODO`, 'warning');
            }
          }

          // Mutación optimista
          onMutateGroups?.({
            type: 'move',
            fromId: Number(todoGroupId),
            toId,
            ids,
            baseById,
          });
          
        } else {
          console.error('❌ No hay todoGroupId válido');
          notify?.('Error: No se puede determinar el grupo TODO', 'error');
          return;
        }
      } 
      // ✅ CASO 2: Origen es una agrupación normal
      else if (currentGroupId && Number.isFinite(currentGroupId) && currentGroupId > 0) {
        console.log('🔄 Moviendo desde agrupación normal...', { 
          fromId: currentGroupId, 
          toId, 
          count: ids.length 
        });

        try {
          // Intentar endpoint move-items
          for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            await httpBiz(`/agrupaciones/${currentGroupId}/move-items`, {
              method: 'POST',
              body: { toId, ids: chunk },
            });
          }

          console.log(`✅ Movido con move-items desde grupo ${currentGroupId}`);

          onMutateGroups?.({
            type: 'move',
            fromId: currentGroupId,
            toId,
            ids,
            baseById,
          });
        } catch (err) {
          console.warn('⚠️ move-items falló, usando fallback PUT+DELETE', err);
          
          // Fallback: PUT + DELETE
          for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            await httpBiz(`/agrupaciones/${toId}/articulos`, {
              method: 'PUT',
              body: { ids: chunk },
            });
          }

          try {
            await httpBiz(`/agrupaciones/${currentGroupId}/articulos`, {
              method: 'DELETE',
              body: { ids },
            });
          } catch (e2) {
            for (const id of ids) {
              try {
                await httpBiz(`/agrupaciones/${currentGroupId}/articulos/${id}`, {
                  method: 'DELETE',
                });
              } catch (_) { /* swallow */ }
            }
          }

          onMutateGroups?.({
            type: 'move',
            fromId: currentGroupId,
            toId,
            ids,
            baseById,
          });
        }
      } else {
        console.error('❌ No se pudo determinar el origen');
        notify?.('Error: No se pudo determinar el origen', 'error');
        return;
      }

      notify?.(`✅ Movidos ${ids.length} artículo(s)`, 'success');
      
      // ✅ La mutación optimista ya actualizó el estado local (onMutateGroups).
      // NO llamar refetch aquí: causa condición de carrera donde el GET del servidor
      // puede devolver datos viejos (antes de que el backend consolide el move)
      // y sobreescribir la mutación, haciendo que los artículos aparezcan en el origen.
      // Solo refrescar en caso de error.
      
    } catch (e) {
      console.error('❌ MOVE_BLOCK_ERROR', e);
      notify?.(`Error al mover: ${e.message || e}`, 'error');
      // En error, refrescar para mostrar el estado real del servidor
      if (onRefetch) await onRefetch();
    } finally {
      setIsMoving(false);
      closeDialog();
    }
  }, [destId, allArticleIds, isFromTodo, todoGroupId, currentGroupId, onMutateGroups, onRefetch, notify, baseById, closeDialog]);

  return (
    <>
      <IconButton 
        size="small" 
        onClick={handleOpenMenu} 
        aria-label={`acciones bloque ${sub?.subrubro || ''}`}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleCloseMenu} anchorEl={anchorEl}>
        <MenuItem onClick={openDialog}>
          <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
          <ListItemText>
            {`Mover todo este rubro/subrubro (${allArticleIds.length})…`}
          </ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={dlgMoverOpen} onClose={closeDialog} keepMounted>
        <DialogTitle>
          {`Mover "${sub?.subrubro || 'bloque'}" a…`}
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            SelectProps={{ native: true }}
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            <option value="" disabled>Seleccionar agrupación destino…</option>
            {gruposDestino.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </TextField>

          <div style={{ marginTop: 12, fontSize: 13, color: '#555' }}>
            {isFromTodo && (
              <div style={{ marginBottom: 8, color: '#ff9800', fontWeight: 500 }}>
                ⚠️ Moviendo desde "Sin Agrupación"
              </div>
            )}
            {allArticleIds.length} artículo{allArticleIds.length !== 1 ? 's' : ''} serán movidos.
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={isMoving}>
            Cancelar
          </Button>
          <Button onClick={mover} variant="contained" disabled={!destId || isMoving}>
            {isMoving ? 'Moviendo…' : `Mover (${allArticleIds.length})`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}