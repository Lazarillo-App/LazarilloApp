// // /* eslint-disable no-undef */
// // /* eslint-disable no-unused-vars */
// // /* eslint-disable no-empty */
// // import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
// // import {
// //   IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
// //   Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Box
// // } from '@mui/material';
// // import MoreVertIcon from '@mui/icons-material/MoreVert';
// // import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
// // import UndoIcon from '@mui/icons-material/Undo';
// // import GroupAddIcon from '@mui/icons-material/GroupAdd';
// // import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
// // import VisibilityIcon from '@mui/icons-material/Visibility';
// // import { emitUiAction } from '@/servicios/uiEvents';
// // import { httpBiz, BusinessesAPI } from '../servicios/apiBusinesses';
// // import { addExclusiones } from '../servicios/apiAgrupacionesTodo';
// // import AgrupacionCreateModal from './AgrupacionCreateModal';
// // import { useOrganization } from '../context/OrganizationContext';

// // const getNum = (v) => Number(v ?? 0);
// // const norm = (s) => String(s || '').trim().toLowerCase();
// // const isDiscontinuadosGroup = (g) => {
// //   const n = norm(g?.nombre);
// //   return n === 'discontinuados' || n === 'descontinuados';
// // };

// // const safeUUID = () => {
// //   try {
// //     if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
// //   } catch { }
// //   return `ui_${Date.now()}_${Math.random().toString(16).slice(2)}`;
// // };

// // const toBizId = (v) => {
// //   const n = Number(v);
// //   return Number.isFinite(n) && n > 0 ? n : null;
// // };

// // const mapRowToArticle = (row) => {
// //   const raw = row?.raw || {};
// //   const id = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
// //   return {
// //     id,
// //     nombre: row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`,
// //     categoria: row?.categoria ?? raw?.categoria ?? raw?.rubro ?? 'Sin categoría',
// //     subrubro: row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? 'Sin subrubro',
// //     precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
// //   };
// // };

// // const buildTree = (flatList = []) => {
// //   const bySub = new Map();
// //   for (const a of flatList) {
// //     if (!Number.isFinite(a?.id)) continue;
// //     const sub = a.subrubro || 'Sin subrubro';
// //     const cat = a.categoria || 'Sin categoría';
// //     if (!bySub.has(sub)) bySub.set(sub, new Map());
// //     const byCat = bySub.get(sub);
// //     if (!byCat.has(cat)) byCat.set(cat, []);
// //     byCat.get(cat).push({
// //       id: a.id,
// //       nombre: a.nombre,
// //       precio: a.precio,
// //       categoria: cat,
// //       subrubro: sub,
// //     });
// //   }

// //   const tree = [];
// //   for (const [subrubro, byCat] of bySub.entries()) {
// //     const categorias = [];
// //     for (const [categoria, articulos] of byCat.entries()) {
// //       categorias.push({ categoria, articulos });
// //     }
// //     categorias.sort((a, b) =>
// //       String(a.categoria).localeCompare(String(b.categoria), 'es', { sensitivity: 'base', numeric: true })
// //     );
// //     tree.push({ subrubro, categorias });
// //   }

// //   tree.sort((a, b) =>
// //     String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true })
// //   );

// //   return tree;
// // };

// // function ArticuloAccionesMenu({
// //   articulo,
// //   agrupaciones = [],
// //   agrupacionSeleccionada,
// //   todoGroupId,
// //   isTodo = false,
// //   onRefetch,
// //   onAfterMutation,
// //   notify,
// //   onGroupCreated,
// //   todosArticulos = [],
// //   loading = false,
// //   onMutateGroups,
// //   baseById,
// //   onDiscontinuadoChange,
// //   treeMode = 'cat-first',
// //   businessId,
// //   rootBizId: rootBizIdProp = null,
// //   allowedIds,
// // }) {
// //   const [anchorEl, setAnchorEl] = useState(null);
// //   const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
// //   const [destId, setDestId] = useState('');
// //   const [isMoving, setIsMoving] = useState(false);
// //   const [openCrearAgr, setOpenCrearAgr] = useState(false);
// //   const [preselect, setPreselect] = useState(null);
// //   const [dlgReactivarOpen, setDlgReactivarOpen] = useState(false);
// //   // Datos de origen capturados cuando se cierra el diálogo de reactivar
// //   // fromGroupId/fromBizId/fromGroupName se buscan en las agrupaciones activas
// //   // y en el prop agrupacionSeleccionada (contexto actual del artículo)
// //   const [origenReactivar, setOrigenReactivar] = useState(null);

// //   const { rootBusiness, allBusinesses } = useOrganization();

// //   const [treeLocal, setTreeLocal] = useState([]);
// //   const [loadingLocal, setLoadingLocal] = useState(false);

// //   const haveExternalTree = Array.isArray(todosArticulos) && todosArticulos.length > 0;
// //   const effectiveTree = haveExternalTree ? todosArticulos : treeLocal;
// //   const effectiveLoading = haveExternalTree ? !!loading : loadingLocal;

// //   const open = Boolean(anchorEl);
// //   const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
// //   const handleClose = useCallback(() => setAnchorEl(null), []);

// //   const currentGroupId = agrupacionSeleccionada?.id ? Number(agrupacionSeleccionada.id) : null;

// //   const discontinuadosGroup = useMemo(
// //     () => (agrupaciones || []).find((g) => isDiscontinuadosGroup(g)),
// //     [agrupaciones]
// //   );
// //   const discontinuadosId = discontinuadosGroup ? Number(discontinuadosGroup.id) : null;

// //   const articuloIdNum = getNum(articulo?.id);

// //   // ==================== businessId efectivo ====================
// //   const effectiveBusinessIdRaw =
// //     businessId ??
// //     localStorage.getItem('activeBusinessId') ??
// //     localStorage.getItem('effectiveBusinessId') ??
// //     null;

// //   const effectiveBusinessId = toBizId(effectiveBusinessIdRaw);

// //   // Para operaciones de agrupaciones, siempre usar el negocio activo REAL del localStorage
// //   // (el prop `businessId` puede ser el ID de un negocio padre, no el activo actual)
// //   const realActiveBizId = toBizId(
// //     localStorage.getItem('activeBusinessId') ??
// //     localStorage.getItem('effectiveBusinessId') ??
// //     businessId
// //   );

// //   const articuloDisplayName = useMemo(() => {
// //     if (!articulo) return `Artículo #${articuloIdNum || ''}`;
// //     const raw = articulo.raw || {};
// //     return (
// //       articulo.nombre ||
// //       raw.nombre ||
// //       raw.descripcion ||
// //       `Artículo #${articuloIdNum || ''}`
// //     );
// //   }, [articulo, articuloIdNum]);

// //   const isInDiscontinuados = useMemo(() => {
// //     if (!Number.isFinite(articuloIdNum) || !discontinuadosId) return false;
// //     const g = (agrupaciones || []).find((gg) => Number(gg.id) === discontinuadosId);
// //     const arts = Array.isArray(g?.articulos) ? g.articulos : [];
// //     return arts.some((a) => Number(a?.id) === articuloIdNum);
// //   }, [agrupaciones, articuloIdNum, discontinuadosId]);

// //   const gruposDestino = useMemo(
// //     () =>
// //       (agrupaciones || [])
// //         .filter((g) => g?.id)
// //         .filter((g) => Number(g.id) !== currentGroupId),
// //     [agrupaciones, currentGroupId]
// //   );

// //   const loadedRef = useRef(false);

// //   const openMover = useCallback(() => {
// //     handleClose();
// //     setTimeout(() => setDlgMoverOpen(true), 0);
// //   }, [handleClose]);
// //   const closeMover = useCallback(() => setDlgMoverOpen(false), []);

// //   // ✅ helper único para emitir notificación (con actionId)
// //   const pushUi = useCallback((payload) => {
// //     try {
// //       emitUiAction({
// //         actionId: safeUUID(),
// //         businessId: effectiveBusinessId,
// //         createdAt: new Date().toISOString(),
// //         ...payload,
// //       });
// //     } catch { }
// //   }, [effectiveBusinessId]);

// //   async function toggleDiscontinuado() {
// //     const idNum = articuloIdNum;
// //     if (!Number.isFinite(idNum)) return;

// //     try {
// //       if (!isInDiscontinuados) {
// //         // ===========================
// //         // ✅ DISCONTINUAR
// //         // ===========================
// //         let resolvedDiscId = discontinuadosId;

// //         if (!resolvedDiscId) {
// //           // Subnegocio sin Discontinuados propio → crear en el negocio raíz
// //           const res = await httpBiz('/agrupaciones/create-or-move', {
// //             method: 'POST',
// //             body: { nombre: 'Discontinuados', ids: [idNum] },
// //           }, agrupBizId);
// //           resolvedDiscId = res?.id ? Number(res.id) : null;
// //         } else {
// //           // Discontinuados vive en el principal → usar discBizId
// //           console.log('[DISCO DEBUG]', {
// //             rootBizIdProp,
// //             rootBizIdFromContext,
// //             rootBizId,
// //             agrupBizId,
// //             discBizId,
// //             effectiveBusinessId,
// //             discontinuadosGroup,
// //             resolvedDiscId,
// //           });
// //           await httpBiz(`/agrupaciones/${resolvedDiscId}/articulos`, {
// //             method: 'PUT',
// //             body: { ids: [idNum] },
// //           }, discBizId);
// //         }

// //         if (resolvedDiscId) {
// //           onMutateGroups?.({
// //             type: 'append',
// //             groupId: resolvedDiscId,
// //             articulos: [{ id: idNum }],
// //             baseById,
// //           });

// //           // ✅ Quitar del grupo actual para que desaparezca de la tabla inmediatamente
// //           if (currentGroupId && currentGroupId !== resolvedDiscId) {
// //             onMutateGroups?.({
// //               type: 'remove',
// //               groupId: currentGroupId,
// //               ids: [idNum],
// //             });
// //           }
// //         }

// //         // ✅ Emitir evento UI
// //         pushUi({
// //           kind: 'discontinue',
// //           scope: 'articulo',
// //           title: `⛔ ${articuloDisplayName} discontinuado`,
// //           message: `"${articuloDisplayName}" → Discontinuados.`,
// //           payload: {
// //             ids: [idNum],
// //             discontinuadosGroupId: Number(resolvedDiscId ?? discontinuadosId),
// //             undo: {
// //               payload: {
// //                 prev: {
// //                   fromGroupId: currentGroupId ?? null,
// //                   fromBizId: agrupBizId ?? null,
// //                   fromGroupName: agrupacionSeleccionada?.nombre ?? null,
// //                   discontinuadosGroupId: Number(resolvedDiscId ?? discontinuadosId),
// //                   wasInDiscontinuados: false,
// //                 },
// //               },
// //             },
// //           },
// //         });

// //         // ✅ Llamar handler SIN navegar (stay: true)
// //         onDiscontinuadoChange?.(idNum, true, { stay: true });
// //         // ✅ Notificar afterMutation — la mutación optimista ya actualizó el estado
// //         onAfterMutation?.([idNum]);
// //         // ✅ NO onRefetch — ni desde isTodo ni desde agrupación real.
// //         // La mutación optimista (append + remove) es suficiente en ambos casos.
// //         return;

// //       } else {
// //         // ===========================
// //         // ✅ REACTIVAR → abrir diálogo de confirmación
// //         // ===========================
// //         // Consultar al backend cuál es el grupo de origen real del artículo
// //         // (busca en toda la organización, excluyendo Discontinuados/Todo)
// //         let origenData = null;
// //         try {
// //           const res = await httpBiz(
// //             `/agrupaciones/articulo/${idNum}/origen`,
// //             { method: 'GET' },
// //             discBizId
// //           );
// //           origenData = res?.origen ?? null;
// //         } catch (e) {
// //           console.warn('[reactivar] No se pudo obtener origen:', e.message);
// //         }

// //         setOrigenReactivar({
// //           fromGroupId: origenData?.groupId ?? null,
// //           fromGroupName: origenData?.groupName ?? null,
// //           fromBizId: origenData?.bizId ?? null,
// //           fromBizName: origenData?.bizName ?? null,
// //         });

// //         handleClose();
// //         setTimeout(() => setDlgReactivarOpen(true), 0);
// //         return; // la ejecución real la hace el diálogo
// //       }

// //       // onRefetch eliminado — la mutación optimista mantiene el estado
// //     } catch (e) {
// //       console.error('TOGGLE_DISCONTINUADO_ERROR', e);
// //       notify?.('No se pudo cambiar el estado de discontinuado', 'error');
// //       onRefetch?.(); // solo en error para recuperar estado real
// //     } finally {
// //       handleClose();
// //     }
// //   }

// //   // BusinessId del principal - las agrupaciones son globales y viven en el negocio raíz.
// //   // Prioridad: 1) prop rootBizId (pasada desde ArticulosMain, siempre disponible)
// //   //            2) rootBusiness del OrganizationContext (puede tardar en cargar)
// //   //            3) effectiveBusinessId (fallback: el negocio activo)
// //   const rootBizIdFromContext = rootBusiness?.id ? Number(rootBusiness.id) : null;
// //   const rootBizId = rootBizIdProp || rootBizIdFromContext || null;

// //   // Nombre del negocio activo para mostrar en confirmación de reactivación
// //   const activeBusinessName = useMemo(() => {
// //     const biz = (allBusinesses || []).find(b => Number(b.id) === Number(realActiveBizId || effectiveBusinessId));
// //     return biz?.nombre || biz?.name || `Negocio #${realActiveBizId || effectiveBusinessId || '?'}`;
// //   }, [allBusinesses, realActiveBizId, effectiveBusinessId]);

// //   // Grupo de origen del artículo (el grupo real donde estaba antes de discontinuarse)
// //   // Lo buscamos en todas las agrupaciones NO-Discontinuados que contienen el artículo
// //   const grupoOrigenArticulo = useMemo(() => {
// //     if (!Number.isFinite(articuloIdNum)) return null;
// //     return (agrupaciones || []).find(g => {
// //       if (isDiscontinuadosGroup(g)) return false;
// //       const n = norm(g?.nombre);
// //       if (n === 'todo' || n === 'sin agrupacion' || n === 'sin agrupación' || n === 'sin agrupar' || n === 'sin grupo') return false;
// //       return (g.articulos || []).some(a => Number(a?.id) === articuloIdNum);
// //     }) || null;
// //   }, [agrupaciones, articuloIdNum]);

// //   // Resuelve el bizId correcto para operar sobre una agrupación dada
// //   const getAgrupBizId = useCallback((_agrupacion) => {
// //     // No usar agrupacion.business_id - puede ser incorrecto en contexto de subnegocio
// //     // Siempre usar el negocio activo real
// //     return realActiveBizId || rootBizId || effectiveBusinessId;
// //   }, [realActiveBizId, rootBizId, effectiveBusinessId]);

// //   const agrupBizId = realActiveBizId || rootBizId || effectiveBusinessId;
// //   // Discontinuados es global y vive siempre en el negocio principal.
// //   // Para cualquier operación sobre él (DELETE artículo, move-items desde él)
// //   // hay que usar rootBizId, no el negocio activo (que puede ser un subnegocio).
// //   const discBizId = rootBizId || agrupBizId;

// //   async function ejecutarReactivar() {
// //     const idNum = articuloIdNum;
// //     if (!Number.isFinite(idNum) || !Number.isFinite(discontinuadosId)) return;

// //     const { fromGroupId, fromBizId } = origenReactivar || {};

// //     try {
// //       // 1. Quitar de Discontinuados (siempre en el negocio principal)
// //       await httpBiz(`/agrupaciones/${discontinuadosId}/articulos/${idNum}`, {
// //         method: 'DELETE',
// //       }, discBizId);

// //       // 2. Si tenemos grupo origen, agregar ahí también
// //       if (fromGroupId && fromBizId) {
// //         try {
// //           await httpBiz(`/agrupaciones/${fromGroupId}/articulos`, {
// //             method: 'PUT',
// //             body: { ids: [idNum] },
// //           }, fromBizId);
// //         } catch (e2) {
// //           console.warn('[ejecutarReactivar] No se pudo agregar al grupo origen:', e2.message);
// //         }
// //       }

// //       // 3. Mutación optimista
// //       onMutateGroups?.({
// //         type: 'remove',
// //         groupId: discontinuadosId,
// //         ids: [idNum],
// //       });
// //       if (fromGroupId) {
// //         onMutateGroups?.({
// //           type: 'append',
// //           groupId: fromGroupId,
// //           articulos: [{ id: idNum }],
// //           baseById,
// //         });
// //       }

// //       pushUi({
// //         kind: 'info',
// //         scope: 'articulo',
// //         title: `✅ ${articuloDisplayName} reactivado`,
// //         message: fromGroupId
// //           ? `"${articuloDisplayName}" volvió a "${origenReactivar?.fromGroupName ?? 'su agrupación'}".`
// //           : `"${articuloDisplayName}" volvió a estar disponible.`,
// //         payload: {
// //           ids: [idNum],
// //           discontinuadosGroupId: Number(discontinuadosId),
// //           prev: {
// //             fromGroupId: fromGroupId ?? null,
// //             fromBizId: fromBizId ?? null,
// //             discontinuadosGroupId: Number(discontinuadosId),
// //             wasInDiscontinuados: true,
// //           },
// //         },
// //       });

// //       onDiscontinuadoChange?.(idNum, false, { stay: true });
// //       // ✅ NO onRefetch — la mutación optimista ya actualizó el estado
// //     } catch (e) {
// //       console.error('REACTIVAR_ERROR', e);
// //       notify?.('No se pudo reactivar el artículo', 'error');
// //     } finally {
// //       setDlgReactivarOpen(false);
// //     }
// //   }

// //   async function mover() {
// //     if (!destId) return;

// //     const idNum = articuloIdNum;
// //     const toId = Number(destId);
// //     const fromId = !isTodo && currentGroupId ? Number(currentGroupId) : null;

// //     if (fromId && fromId === toId) {
// //       notify?.('El artículo ya está en esa agrupación', 'info');
// //       onAfterMutation?.([idNum]);
// //       return closeMover();
// //     }

// //     setIsMoving(true);
// //     try {
// //       const destGroup = (agrupaciones || []).find((g) => Number(g.id) === toId);
// //       const fromGroup = (agrupaciones || []).find((g) => Number(g.id) === fromId);
// //       // Si el origen es Discontinuados, usar discBizId (negocio principal).
// //       // Para el destino, usar agrupBizId (negocio activo).
// //       const fromIsDisc = fromId != null && fromId === discontinuadosId;
// //       const fromBizId = fromIsDisc ? discBizId : getAgrupBizId(fromGroup);
// //       const toBizId = getAgrupBizId(destGroup);

// //       if (fromId) {
// //         try {
// //           await httpBiz(`/agrupaciones/${fromId}/move-items`, {
// //             method: 'POST',
// //             body: { toId, ids: [idNum] },
// //           }, fromBizId);
// //         } catch {
// //           await httpBiz(`/agrupaciones/${toId}/articulos`, {
// //             method: 'PUT',
// //             body: { ids: [idNum] },
// //           }, toBizId);
// //           try {
// //             await httpBiz(`/agrupaciones/${fromId}/articulos/${idNum}`, {
// //               method: 'DELETE',
// //             }, fromBizId);
// //           } catch { }
// //         }

// //         onMutateGroups?.({
// //           type: 'move',
// //           fromId,
// //           toId,
// //           ids: [idNum],
// //           baseById,
// //         });
// //       } else {
// //         await httpBiz(`/agrupaciones/${toId}/articulos`, {
// //           method: 'PUT',
// //           body: { ids: [idNum] },
// //         }, agrupBizId);;
// //         onMutateGroups?.({
// //           type: 'append',
// //           groupId: toId,
// //           articulos: [{ id: idNum }],
// //           baseById,
// //         });
// //       }

// //       notify?.(`Artículo #${idNum} movido`, 'success');

// //       // ✅ SOLO emitUiAction (sin dispatch manual)
// //       pushUi({
// //         kind: 'move',
// //         scope: 'articulo',
// //         title: 'Artículo movido',
// //         message: `Movido a "${destGroup?.nombre || 'agrupación'}".`,
// //         payload: { ids: [idNum], fromId, toId },
// //       });

// //       onAfterMutation?.([idNum]);
// //       // ✅ NO llamar onRefetch aquí — la mutación optimista ya actualizó el estado local.
// //       // Llamar refetch después de la mutación optimista causa condición de carrera:
// //       // el GET puede llegar con datos del servidor antes de que el backend consolide
// //       // el move-items, sobreescribiendo el estado y haciendo aparecer el artículo en el origen.
// //     } catch (e) {
// //       console.error('MOVER_ERROR', e);
// //       notify?.('No se pudo mover el artículo', 'error');
// //       // Solo en caso de error, refrescar para obtener el estado real del servidor
// //       onRefetch?.();
// //     } finally {
// //       setIsMoving(false);
// //       closeMover();
// //     }
// //   }

// //   async function quitarDeActual() {
// //     const idNum = articuloIdNum;

// //     if (isTodo && todoGroupId) {
// //       try {
// //         await addExclusiones(todoGroupId, [{ scope: 'articulo', ref_id: idNum }]);
// //         notify?.(`Artículo #${idNum} ocultado de TODO`, 'success');

// //         pushUi({
// //           kind: 'info',
// //           scope: 'articulo',
// //           title: 'Artículo excluido',
// //           message: `Artículo #${idNum} oculto de TODO.`,
// //           payload: { ids: [idNum], todoGroupId: Number(todoGroupId) },
// //         });

// //         onMutateGroups?.({ type: 'excludeFromTodo', ids: [idNum] });
// //         onAfterMutation?.([idNum]);
// //         // ✅ NO refetch — mutación optimista es suficiente
// //       } catch (e) {
// //         console.error('EXCLUIR_TODO_ERROR', e);
// //         notify?.('No se pudo quitar de TODO', 'error');
// //         onRefetch?.(); // solo en error
// //       } finally {
// //         handleClose();
// //       }
// //       return;
// //     }

// //     if (!currentGroupId) return;
// //     try {
// //       // Usar create-or-move para mover a Sin Agrupación globalmente
// //       // Siempre usar rootBizId para que apunte al Sin Agrupación del principal
// //       // (el subnegocio from_group comparte los grupos especiales del principal)
// //       const sinAgrupBizId = rootBizId || agrupBizId;
// //       await httpBiz('/agrupaciones/create-or-move', {
// //         method: 'POST',
// //         body: { nombre: 'Sin Agrupación', ids: [idNum] },
// //       }, sinAgrupBizId);

// //       notify?.(`Artículo quitado de "${agrupacionSeleccionada?.nombre}" y enviado a Sin Agrupación`, 'success');

// //       pushUi({
// //         kind: 'info',
// //         scope: 'articulo',
// //         title: 'Artículo removido',
// //         message: `Quitado de "${agrupacionSeleccionada?.nombre}".`,
// //         payload: { ids: [idNum], fromGroupId: currentGroupId },
// //       });

// //       onMutateGroups?.({
// //         type: 'remove',
// //         groupId: currentGroupId,
// //         ids: [idNum],
// //       });

// //       onAfterMutation?.([idNum]);
// //       // ✅ NO refetch — mutación optimista es suficiente
// //     } catch (e) {
// //       console.error(e);
// //       notify?.('No se pudo quitar el artículo', 'error');
// //       onRefetch?.(); // solo en error
// //     } finally {
// //       handleClose();
// //     }
// //   }

// //   const isArticuloBloqueadoCreate = useMemo(() => {
// //     // Solo bloquear artículos que están en agrupaciones REALES
// //     // (no TODO/Sin Agrupación, no Discontinuados)
// //     const esTodo = (g) => {
// //       const n = norm(g?.nombre);
// //       return n === 'todo' || n === 'sin agrupacion' || n === 'sin agrupación' ||
// //         n === 'sin agrupar' || n === 'sin grupo';
// //     };

// //     const assigned = new Set();
// //     (agrupaciones || [])
// //       .filter((g) => !esTodo(g) && !isDiscontinuadosGroup(g))
// //       .forEach((g) =>
// //         (g.articulos || []).forEach((a) => {
// //           const n = Number(a?.id);
// //           if (Number.isFinite(n)) assigned.add(String(n));
// //         })
// //       );
// //     return (art) => assigned.has(String(art?.id));
// //   }, [agrupaciones]);

// //   useEffect(() => {
// //     if (!openCrearAgr) return;
// //     if (haveExternalTree || loading || loadedRef.current) return;

// //     let alive = true;
// //     (async () => {
// //       try {
// //         setLoadingLocal(true);
// //         const bizId = localStorage.getItem('activeBusinessId');
// //         if (!bizId) {
// //           setTreeLocal([]);
// //           return;
// //         }
// //         const res = await BusinessesAPI.articlesFromDB(bizId);
// //         const flat = (res?.items || [])
// //           .map(mapRowToArticle)
// //           .filter((a) => Number.isFinite(a.id));
// //         if (alive) {
// //           setTreeLocal(buildTree(flat));
// //           loadedRef.current = true;
// //         }
// //       } catch (e) {
// //         console.error('LOAD_TREE_ERROR', e);
// //         if (alive) setTreeLocal([]);
// //       } finally {
// //         if (alive) setLoadingLocal(false);
// //       }
// //     })();

// //     return () => {
// //       alive = false;
// //     };
// //   }, [openCrearAgr, haveExternalTree, loading]);

// //   return (
// //     <>
// //       <IconButton size="small" onClick={handleOpen}>
// //         <MoreVertIcon fontSize="small" />
// //       </IconButton>

// //       <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
// //         {/* 1. Discontinuar / Reactivar */}
// //         <MenuItem onClick={toggleDiscontinuado}>
// //           <ListItemIcon>
// //             {isInDiscontinuados ? (
// //               <VisibilityIcon fontSize="small" />
// //             ) : (
// //               <VisibilityOffIcon fontSize="small" />
// //             )}
// //           </ListItemIcon>
// //           <ListItemText>
// //             {isInDiscontinuados
// //               ? 'Reactivar (quitar de Discontinuados)'
// //               : 'Discontinuar'}
// //           </ListItemText>
// //         </MenuItem>

// //         { /* 2. Quitar de esta agrupación */}
// //         <MenuItem onClick={quitarDeActual} disabled={isTodo}>
// //           <ListItemIcon>
// //             <UndoIcon fontSize="small" />
// //           </ListItemIcon>
// //           <ListItemText>
// //             {isTodo ? 'Ya está en Sin agrupación' : 'Quitar de esta agrupación'}
// //           </ListItemText>
// //         </MenuItem>

// //         {/* 3. Mover a… */}
// //         <MenuItem onClick={openMover}>
// //           <ListItemIcon>
// //             <DriveFileMoveIcon fontSize="small" />
// //           </ListItemIcon>
// //           <ListItemText>Mover a…</ListItemText>
// //         </MenuItem>

// //         {/* 4. Crear agrupación a partir de… */}
// //         <MenuItem
// //           onClick={() => {
// //             handleClose();
// //             if (!Number.isFinite(articuloIdNum)) return;
// //             setPreselect({
// //               articleIds: [articuloIdNum],
// //               fromGroupId: !isTodo && currentGroupId ? Number(currentGroupId) : null,
// //               // Pasar todoGroupId para que AgrupacionCreateModal pueda quitar de Sin Agrupación
// //               todoGroupId: isTodo && todoGroupId ? Number(todoGroupId) : null,
// //               allowAssigned: true,
// //             });
// //             setOpenCrearAgr(true);
// //           }}
// //         >
// //           <ListItemIcon>
// //             <GroupAddIcon fontSize="small" />
// //           </ListItemIcon>
// //           <ListItemText>
// //             {`Crear agrupación a partir de “${articuloDisplayName}”`}
// //           </ListItemText>
// //         </MenuItem>
// //       </Menu>

// //       <Dialog open={dlgMoverOpen} onClose={closeMover} keepMounted>
// //         <DialogTitle>Mover artículo #{articulo.id} a…</DialogTitle>
// //         <DialogContent>
// //           <TextField
// //             select
// //             SelectProps={{ native: true }}
// //             value={destId}
// //             onChange={(e) => setDestId(e.target.value)}
// //             fullWidth
// //             sx={{ mt: 1 }}
// //           >
// //             <option value="" disabled>
// //               Seleccionar…
// //             </option>
// //             {gruposDestino.map((g) => (
// //               <option key={g.id} value={g.id}>
// //                 {g.nombre}
// //               </option>
// //             ))}
// //           </TextField>
// //         </DialogContent>
// //         <DialogActions>
// //           <Button onClick={closeMover} disabled={isMoving}>
// //             Cancelar
// //           </Button>
// //           <Button
// //             onClick={mover}
// //             variant="contained"
// //             disabled={!destId || isMoving}
// //           >
// //             {isMoving ? 'Moviendo…' : 'Mover'}
// //           </Button>
// //         </DialogActions>
// //       </Dialog>

// //       {/* Diálogo de confirmación de reactivación */}
// //       <Dialog open={dlgReactivarOpen} onClose={() => setDlgReactivarOpen(false)} maxWidth="sm" fullWidth>
// //         <DialogTitle>Reactivar artículo</DialogTitle>
// //         <DialogContent>
// //           <Typography variant="body1" gutterBottom>
// //             ¿Reactivar <strong>{articuloDisplayName}</strong>?
// //           </Typography>

// //           {origenReactivar?.fromBizName || origenReactivar?.fromGroupName ? (
// //             <Box sx={{
// //               mt: 1.5, p: 1.5, borderRadius: 1.5,
// //               bgcolor: 'action.hover',
// //               border: '1px solid', borderColor: 'divider',
// //             }}>
// //               <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
// //                 Origen detectado:
// //               </Typography>
// //               {origenReactivar?.fromBizName && (
// //                 <Typography variant="body2">
// //                   🏢 <strong>Negocio:</strong> {origenReactivar.fromBizName}
// //                 </Typography>
// //               )}
// //               {origenReactivar?.fromGroupName && (
// //                 <Typography variant="body2">
// //                   📁 <strong>Agrupación:</strong> {origenReactivar.fromGroupName}
// //                 </Typography>
// //               )}
// //             </Box>
// //           ) : (
// //             <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: '#fffbeb', border: '1px solid #fbbf24' }}>
// //               <Typography variant="body2" color="text.secondary">
// //                 ⚠️ No se encontró un origen registrado. El artículo quedará en Sin Agrupación.
// //               </Typography>
// //             </Box>
// //           )}
// //         </DialogContent>
// //         <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
// //           <Button
// //             variant="outlined"
// //             size="small"
// //             onClick={() => {
// //               setDlgReactivarOpen(false);
// //               setTimeout(() => setDlgMoverOpen(true), 0);
// //             }}
// //           >
// //             Mover a otro lugar…
// //           </Button>
// //           <Button variant="contained" size="small" onClick={ejecutarReactivar}>
// //             {origenReactivar?.fromGroupName
// //               ? `Reactivar en ${origenReactivar.fromBizName ? origenReactivar.fromBizName + ' › ' : ''}${origenReactivar.fromGroupName}`
// //               : 'Reactivar (sin agrupación)'
// //             }
// //           </Button>
// //         </DialogActions>
// //       </Dialog>

// //       <AgrupacionCreateModal
// //         open={openCrearAgr}
// //         onClose={() => setOpenCrearAgr(false)}
// //         mode="create"
// //         preselect={preselect}
// //         todosArticulos={effectiveTree}
// //         loading={effectiveLoading}
// //         isArticuloBloqueado={isArticuloBloqueadoCreate}
// //         onCreated={(nombreCreado, newId, articulos) => {
// //           notify?.(`Agrupación "${nombreCreado}" creada`, 'success');

// //           pushUi({
// //             kind: 'group_create',
// //             scope: 'articulo',
// //             title: 'Agrupación creada',
// //             message: `"${nombreCreado}" desde artículo #${articuloIdNum}.`,
// //             payload: { groupId: Number(newId), groupName: nombreCreado },
// //           });

// //           // 1. Agregar el nuevo grupo al estado optimista
// //           onMutateGroups?.({
// //             type: 'create',
// //             id: Number(newId),
// //             nombre: nombreCreado,
// //             articulos: Array.isArray(articulos) ? articulos : [],
// //           });

// //           // 2. ✅ Si veníamos de Sin Agrupación, quitar los artículos de ahí optimistamente
// //           const movingIds = (Array.isArray(articulos) ? articulos : [])
// //             .map(a => Number(a?.id)).filter(Number.isFinite);
// //           const todoGrpId = preselect?.todoGroupId;
// //           if (isTodo && todoGrpId && movingIds.length) {
// //             onMutateGroups?.({
// //               type: 'remove',
// //               groupId: Number(todoGrpId),
// //               ids: movingIds,
// //             });
// //           }

// //           onGroupCreated?.(nombreCreado, newId, articulos);
// //           if (!isTodo) onRefetch?.();
// //         }}
// //         existingNames={(agrupaciones || []).map((g) => String(g?.nombre || '')).filter(Boolean)}
// //         treeMode={treeMode}
// //         groupName={articuloDisplayName}
// //         businessId={effectiveBusinessId}
// //         allowedIds={allowedIds || null}
// //       />
// //     </>
// //   );
// // }

// // export default React.memo(ArticuloAccionesMenu);

/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress, Divider,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
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

const safeUUID = () => {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { }
  return `ui_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const toBizId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
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
      // Filtrar solo agrupaciones reales (sin TODO ni Discontinuados)
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
  tituloExtra = '',         // ej: "artículo #123"
  agrupacionesLocales = [], // agrupaciones del negocio activo ya cargadas
  currentGroupId = null,
  allBusinesses = [],       // lista de sub-negocios disponibles
  activeBizId,              // negocio activo (para pre-seleccionar)
  onConfirm,                // ({ bizId, groupId, groupNombre }) => Promise<void>
  isMoving = false,
}) {
  const [selectedBizId, setSelectedBizId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // Negocios disponibles: incluye el activo + otros sub-negocios
  const negocios = useMemo(() => {
    return (allBusinesses || []).filter(b => Number(b.id) > 0);
  }, [allBusinesses]);

  // Cargar agrupaciones del negocio seleccionado (si es distinto al activo)
  const isSameBiz = Number(selectedBizId) === Number(activeBizId);
  const { agrupaciones: agrupacionesExternas, loading: loadingExt } = useAgrupacionesBiz(
    !isSameBiz && selectedBizId ? selectedBizId : null
  );

  const agrupacionesMostrar = useMemo(() => {
    if (!selectedBizId) return [];
    if (isSameBiz) {
      // Negocio activo: excluir el grupo actual
      return (agrupacionesLocales || []).filter(g => Number(g.id) !== currentGroupId);
    }
    return agrupacionesExternas;
  }, [selectedBizId, isSameBiz, agrupacionesLocales, agrupacionesExternas, currentGroupId]);

  // Resetear grupo al cambiar negocio
  useEffect(() => { setSelectedGroupId(''); }, [selectedBizId]);

  // Pre-seleccionar negocio activo al abrir
  useEffect(() => {
    if (open) {
      setSelectedBizId(String(activeBizId || ''));
      setSelectedGroupId('');
    }
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

        {/* Select de sub-negocio (solo si hay más de uno) */}
        {showBizSelect && (
          <TextField
            select
            SelectProps={{ native: true }}
            label="Sub-negocio"
            value={selectedBizId}
            onChange={e => setSelectedBizId(e.target.value)}
            fullWidth
            size="small"
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

        {/* Select de agrupación */}
        {selectedBizId && (
          loadingExt ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.82rem' }}>
              <CircularProgress size={14} /> Cargando agrupaciones…
            </Box>
          ) : (
            <TextField
              select
              SelectProps={{ native: true }}
              label="Agrupación destino"
              value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              fullWidth
              size="small"
              disabled={agrupacionesMostrar.length === 0}
              helperText={agrupacionesMostrar.length === 0 ? 'Este negocio no tiene agrupaciones disponibles' : ''}
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
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedGroupId || isMoving || loadingExt}
        >
          {isMoving ? 'Moviendo…' : 'Mover'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════════════════
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
  baseById,
  onDiscontinuadoChange,
  treeMode = 'cat-first',
  businessId,
  rootBizId: rootBizIdProp = null,
  allowedIds,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [openCrearAgr, setOpenCrearAgr] = useState(false);
  const [preselect, setPreselect] = useState(null);
  const [dlgReactivarOpen, setDlgReactivarOpen] = useState(false);
  const [origenReactivar, setOrigenReactivar] = useState(null);

  const { rootBusiness, allBusinesses } = useOrganization();

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

  const articuloIdNum = getNum(articulo?.id);

  const effectiveBusinessIdRaw =
    businessId ?? localStorage.getItem('activeBusinessId') ??
    localStorage.getItem('effectiveBusinessId') ?? null;
  const effectiveBusinessId = toBizId(effectiveBusinessIdRaw);

  const realActiveBizId = toBizId(
    localStorage.getItem('activeBusinessId') ??
    localStorage.getItem('effectiveBusinessId') ?? businessId
  );

  const articuloDisplayName = useMemo(() => {
    if (!articulo) return `Artículo #${articuloIdNum || ''}`;
    const raw = articulo.raw || {};
    return articulo.nombre || raw.nombre || raw.descripcion || `Artículo #${articuloIdNum || ''}`;
  }, [articulo, articuloIdNum]);

  const isInDiscontinuados = useMemo(() => {
    if (!Number.isFinite(articuloIdNum) || !discontinuadosId) return false;
    const g = (agrupaciones || []).find((gg) => Number(gg.id) === discontinuadosId);
    const arts = Array.isArray(g?.articulos) ? g.articulos : [];
    return arts.some((a) => Number(a?.id) === articuloIdNum);
  }, [agrupaciones, articuloIdNum, discontinuadosId]);

  const loadedRef = useRef(false);

  const openMover = useCallback(() => {
    handleClose();
    setTimeout(() => setDlgMoverOpen(true), 0);
  }, [handleClose]);
  const closeMover = useCallback(() => setDlgMoverOpen(false), []);

  const pushUi = useCallback((payload) => {
    try {
      emitUiAction({
        actionId: safeUUID(), businessId: effectiveBusinessId,
        createdAt: new Date().toISOString(), ...payload,
      });
    } catch { }
  }, [effectiveBusinessId]);

  const rootBizIdFromContext = rootBusiness?.id ? Number(rootBusiness.id) : null;
  const rootBizId = rootBizIdProp || rootBizIdFromContext || null;

  const agrupBizId = realActiveBizId || rootBizId || effectiveBusinessId;
  const discBizId = rootBizId || agrupBizId;

  const getAgrupBizId = useCallback((_agrupacion) => {
    return realActiveBizId || rootBizId || effectiveBusinessId;
  }, [realActiveBizId, rootBizId, effectiveBusinessId]);

  // ── Agrupaciones locales (negocio activo) para el modal Mover ─────────────
  const agrupacionesLocalesParaMover = useMemo(() => {
    return (agrupaciones || []).filter(g => !isDiscontinuadosGroup(g));
  }, [agrupaciones]);

  async function toggleDiscontinuado() {
    const idNum = articuloIdNum;
    if (!Number.isFinite(idNum)) return;

    try {
      if (!isInDiscontinuados) {
        // DISCONTINUAR
        let resolvedDiscId = discontinuadosId;
        if (!resolvedDiscId) {
          const res = await httpBiz('/agrupaciones/create-or-move', {
            method: 'POST', body: { nombre: 'Discontinuados', ids: [idNum] },
          }, agrupBizId);
          resolvedDiscId = res?.id ? Number(res.id) : null;
        } else {
          await httpBiz(`/agrupaciones/${resolvedDiscId}/articulos`, {
            method: 'PUT', body: { ids: [idNum] },
          }, discBizId);
        }

        if (resolvedDiscId) {
          onMutateGroups?.({ type: 'append', groupId: resolvedDiscId, articulos: [{ id: idNum }], baseById });
          if (currentGroupId && currentGroupId !== resolvedDiscId) {
            onMutateGroups?.({ type: 'remove', groupId: currentGroupId, ids: [idNum] });
          }
        }

        pushUi({
          kind: 'discontinue', scope: 'articulo',
          title: `⛔ ${articuloDisplayName} discontinuado`,
          message: `"${articuloDisplayName}" → Discontinuados.`,
          payload: {
            ids: [idNum],
            discontinuadosGroupId: Number(resolvedDiscId ?? discontinuadosId),
            undo: {
              payload: {
                prev: {
                  fromGroupId: currentGroupId ?? null,
                  fromBizId: agrupBizId ?? null,
                  fromGroupName: agrupacionSeleccionada?.nombre ?? null,
                  discontinuadosGroupId: Number(resolvedDiscId ?? discontinuadosId),
                  wasInDiscontinuados: false,
                },
              },
            },
          },
        });

        onDiscontinuadoChange?.(idNum, true, { stay: true });
        onAfterMutation?.([idNum]);
        return;

      } else {
        // REACTIVAR → buscar origen y abrir diálogo
        let origenData = null;
        try {
          const res = await httpBiz(
            `/agrupaciones/articulo/${idNum}/origen`, { method: 'GET' }, discBizId
          );
          origenData = res?.origen ?? null;
        } catch (e) {
          console.warn('[reactivar] No se pudo obtener origen:', e.message);
        }

        setOrigenReactivar({
          fromGroupId: origenData?.groupId ?? null,
          fromGroupName: origenData?.groupName ?? null,
          fromBizId: origenData?.bizId ?? null,
          fromBizName: origenData?.bizName ?? null,
        });

        handleClose();
        setTimeout(() => setDlgReactivarOpen(true), 0);
        return;
      }
    } catch (e) {
      console.error('TOGGLE_DISCONTINUADO_ERROR', e);
      notify?.('No se pudo cambiar el estado de discontinuado', 'error');
      onRefetch?.();
    } finally {
      handleClose();
    }
  }

  async function ejecutarReactivar() {
    const idNum = articuloIdNum;
    if (!Number.isFinite(idNum) || !Number.isFinite(discontinuadosId)) return;

    const { fromGroupId, fromBizId } = origenReactivar || {};

    try {
      await httpBiz(`/agrupaciones/${discontinuadosId}/articulos/${idNum}`, {
        method: 'DELETE',
      }, discBizId);

      if (fromGroupId && fromBizId) {
        try {
          await httpBiz(`/agrupaciones/${fromGroupId}/articulos`, {
            method: 'PUT', body: { ids: [idNum] },
          }, fromBizId);
        } catch (e2) {
          console.warn('[ejecutarReactivar] No se pudo agregar al grupo origen:', e2.message);
        }
      }

      onMutateGroups?.({ type: 'remove', groupId: discontinuadosId, ids: [idNum] });
      if (fromGroupId) {
        onMutateGroups?.({ type: 'append', groupId: fromGroupId, articulos: [{ id: idNum }], baseById });
      }

      pushUi({
        kind: 'info', scope: 'articulo',
        title: `✅ ${articuloDisplayName} reactivado`,
        message: fromGroupId
          ? `"${articuloDisplayName}" volvió a "${origenReactivar?.fromGroupName ?? 'su agrupación'}".`
          : `"${articuloDisplayName}" volvió a estar disponible.`,
        payload: {
          ids: [idNum], discontinuadosGroupId: Number(discontinuadosId),
          prev: {
            fromGroupId: fromGroupId ?? null, fromBizId: fromBizId ?? null,
            discontinuadosGroupId: Number(discontinuadosId), wasInDiscontinuados: true,
          },
        },
      });

      onDiscontinuadoChange?.(idNum, false, { stay: true });
    } catch (e) {
      console.error('REACTIVAR_ERROR', e);
      notify?.('No se pudo reactivar el artículo', 'error');
    } finally {
      setDlgReactivarOpen(false);
    }
  }

  // ── Mover a otro negocio/agrupación ────────────────────────────────────────
  async function ejecutarMover({ bizId: toBizId, groupId: toId, groupNombre }) {
    const idNum = articuloIdNum;
    const fromId = !isTodo && currentGroupId ? Number(currentGroupId) : null;
    const isSameBiz = Number(toBizId) === Number(agrupBizId);

    if (isSameBiz && fromId && fromId === toId) {
      notify?.('El artículo ya está en esa agrupación', 'info');
      onAfterMutation?.([idNum]);
      return closeMover();
    }

    setIsMoving(true);
    try {
      if (isSameBiz) {
        // ── Mismo negocio: lógica original ──────────────────────────────────
        const destGroup = (agrupaciones || []).find((g) => Number(g.id) === toId);
        const fromGroup = (agrupaciones || []).find((g) => Number(g.id) === fromId);
        const fromIsDisc = fromId != null && fromId === discontinuadosId;
        const fromBizIdLocal = fromIsDisc ? discBizId : getAgrupBizId(fromGroup);
        const toBizIdLocal = getAgrupBizId(destGroup);

        if (fromId) {
          try {
            await httpBiz(`/agrupaciones/${fromId}/move-items`, {
              method: 'POST', body: { toId, ids: [idNum] },
            }, fromBizIdLocal);
          } catch {
            await httpBiz(`/agrupaciones/${toId}/articulos`, {
              method: 'PUT', body: { ids: [idNum] },
            }, toBizIdLocal);
            try {
              await httpBiz(`/agrupaciones/${fromId}/articulos/${idNum}`, { method: 'DELETE' }, fromBizIdLocal);
            } catch { }
          }
          onMutateGroups?.({ type: 'move', fromId, toId, ids: [idNum], baseById });
        } else {
          await httpBiz(`/agrupaciones/${toId}/articulos`, {
            method: 'PUT', body: { ids: [idNum] },
          }, agrupBizId);
          onMutateGroups?.({ type: 'append', groupId: toId, articulos: [{ id: idNum }], baseById });
        }

      } else {
        // ── Distinto negocio ────────────────────────────────────────────────
        // 1. Agregar al negocio destino
        await httpBiz(`/agrupaciones/${toId}/articulos`, {
          method: 'PUT', body: { ids: [idNum] },
        }, toBizId);

        // 2. Quitar del origen (si venía de una agrupación real, incluido Discontinuados)
        if (fromId) {
          const fromIsDisc = fromId === discontinuadosId;
          const fromBizIdLocal = fromIsDisc ? discBizId : agrupBizId;
          try {
            await httpBiz(`/agrupaciones/${fromId}/articulos/${idNum}`, {
              method: 'DELETE',
            }, fromBizIdLocal);
          } catch { }
        }

        // Mutación optimista: quitar del grupo origen
        if (fromId) {
          onMutateGroups?.({ type: 'remove', groupId: fromId, ids: [idNum] });
        }
        // Nota: no hacemos append al destino porque no tenemos esa agrupación en el estado local
      }

      notify?.(`Artículo movido a "${groupNombre}"`, 'success');
      pushUi({
        kind: 'move', scope: 'articulo', title: 'Artículo movido',
        message: `Movido a "${groupNombre}".`,
        payload: { ids: [idNum], fromId, toId, toBizId },
      });

      onAfterMutation?.([idNum]);
    } catch (e) {
      console.error('MOVER_ERROR', e);
      notify?.('No se pudo mover el artículo', 'error');
      onRefetch?.();
    } finally {
      setIsMoving(false);
      closeMover();
    }
  }

  async function quitarDeActual() {
    const idNum = articuloIdNum;
    if (isTodo && todoGroupId) {
      try {
        await addExclusiones(todoGroupId, [{ scope: 'articulo', ref_id: idNum }]);
        notify?.(`Artículo #${idNum} ocultado de TODO`, 'success');
        pushUi({ kind: 'info', scope: 'articulo', title: 'Artículo excluido', message: `Artículo #${idNum} oculto de TODO.`, payload: { ids: [idNum], todoGroupId: Number(todoGroupId) } });
        onMutateGroups?.({ type: 'excludeFromTodo', ids: [idNum] });
        onAfterMutation?.([idNum]);
      } catch (e) {
        notify?.('No se pudo quitar de TODO', 'error');
        onRefetch?.();
      } finally { handleClose(); }
      return;
    }
    if (!currentGroupId) return;
    try {
      const sinAgrupBizId = rootBizId || agrupBizId;
      await httpBiz('/agrupaciones/create-or-move', {
        method: 'POST', body: { nombre: 'Sin Agrupación', ids: [idNum] },
      }, sinAgrupBizId);
      notify?.(`Artículo quitado de "${agrupacionSeleccionada?.nombre}"`, 'success');
      pushUi({ kind: 'info', scope: 'articulo', title: 'Artículo removido', message: `Quitado de "${agrupacionSeleccionada?.nombre}".`, payload: { ids: [idNum], fromGroupId: currentGroupId } });
      onMutateGroups?.({ type: 'remove', groupId: currentGroupId, ids: [idNum] });
      onAfterMutation?.([idNum]);
    } catch (e) {
      notify?.('No se pudo quitar el artículo', 'error');
      onRefetch?.();
    } finally { handleClose(); }
  }

  const isArticuloBloqueadoCreate = useMemo(() => {
    const esTodo = (g) => { const n = norm(g?.nombre); return n === 'todo' || n === 'sin agrupacion' || n === 'sin agrupación' || n === 'sin agrupar' || n === 'sin grupo'; };
    const assigned = new Set();
    (agrupaciones || []).filter((g) => !esTodo(g) && !isDiscontinuadosGroup(g))
      .forEach((g) => (g.articulos || []).forEach((a) => { const n = Number(a?.id); if (Number.isFinite(n)) assigned.add(String(n)); }));
    return (art) => assigned.has(String(art?.id));
  }, [agrupaciones]);

  useEffect(() => {
    if (!openCrearAgr || haveExternalTree || loading || loadedRef.current) return;
    let alive = true;
    (async () => {
      try {
        setLoadingLocal(true);
        const bizId = localStorage.getItem('activeBusinessId');
        if (!bizId) { setTreeLocal([]); return; }
        const res = await BusinessesAPI.articlesFromDB(bizId);
        const flat = (res?.items || []).map(mapRowToArticle).filter((a) => Number.isFinite(a.id));
        if (alive) { setTreeLocal(buildTree(flat)); loadedRef.current = true; }
      } catch { if (alive) setTreeLocal([]); }
      finally { if (alive) setLoadingLocal(false); }
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
          <ListItemIcon>{isInDiscontinuados ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}</ListItemIcon>
          <ListItemText>{isInDiscontinuados ? 'Reactivar (quitar de Discontinuados)' : 'Discontinuar'}</ListItemText>
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
          if (!Number.isFinite(articuloIdNum)) return;
          setPreselect({ articleIds: [articuloIdNum], fromGroupId: !isTodo && currentGroupId ? Number(currentGroupId) : null, todoGroupId: isTodo && todoGroupId ? Number(todoGroupId) : null, allowAssigned: true });
          setOpenCrearAgr(true);
        }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{`Crear agrupación a partir de "${articuloDisplayName}"`}</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── Modal unificado "Mover a…" ── */}
      <MoverAModal
        open={dlgMoverOpen}
        onClose={closeMover}
        tituloExtra={`artículo #${articuloIdNum}`}
        agrupacionesLocales={agrupacionesLocalesParaMover}
        currentGroupId={currentGroupId}
        allBusinesses={allBusinesses}
        activeBizId={agrupBizId}
        onConfirm={ejecutarMover}
        isMoving={isMoving}
      />

      {/* ── Diálogo de reactivación ── */}
      <Dialog open={dlgReactivarOpen} onClose={() => setDlgReactivarOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Reactivar artículo</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            ¿Reactivar <strong>{articuloDisplayName}</strong>?
          </Typography>

          {origenReactivar?.fromBizName || origenReactivar?.fromGroupName ? (
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Origen detectado:</Typography>
              {origenReactivar?.fromBizName && (
                <Typography variant="body2">🏢 <strong>Negocio:</strong> {origenReactivar.fromBizName}</Typography>
              )}
              {origenReactivar?.fromGroupName && (
                <Typography variant="body2">📁 <strong>Agrupación:</strong> {origenReactivar.fromGroupName}</Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: '#fffbeb', border: '1px solid #fbbf24' }}>
              <Typography variant="body2" color="text.secondary">
                ⚠️ No se encontró un origen registrado. El artículo quedará en Sin Agrupación.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          {/* Botón: reactivar en origen */}
          <Button variant="contained" size="small" onClick={ejecutarReactivar} sx={{ flex: 1, minWidth: 140, textTransform: 'none' }}>
            {origenReactivar?.fromGroupName
              ? `Reactivar en origen`
              : 'Reactivar (sin agrupación)'}
          </Button>
          {/* Botón: mover a otro lugar (abre MoverAModal) */}
          <Button
            variant="outlined" size="small"
            sx={{ flex: 1, minWidth: 140, textTransform: 'none' }}
            onClick={() => {
              setDlgReactivarOpen(false);
              setTimeout(() => setDlgMoverOpen(true), 0);
            }}
          >
            Mover a otro lugar…
          </Button>
          <Button variant="text" size="small" color="inherit" sx={{ textTransform: 'none' }}
            onClick={() => setDlgReactivarOpen(false)}>
            Cancelar
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
          notify?.(`Agrupación "${nombreCreado}" creada`, 'success');
          pushUi({ kind: 'group_create', scope: 'articulo', title: 'Agrupación creada', message: `"${nombreCreado}" desde artículo #${articuloIdNum}.`, payload: { groupId: Number(newId), groupName: nombreCreado } });
          
          const movingIds = (Array.isArray(articulos) ? articulos : []).map(a => Number(a?.id)).filter(Number.isFinite);
          const todoGrpId = preselect?.todoGroupId;
          const fromGrpId = preselect?.fromGroupId ? Number(preselect.fromGroupId) : null;

          // 1. Crear el nuevo grupo optimistamente
          onMutateGroups?.({ type: 'create', id: Number(newId), nombre: nombreCreado, articulos: Array.isArray(articulos) ? articulos : [] });

          // 2. Quitar artículos del grupo origen (mutación optimista)
          if (isTodo && todoGrpId && movingIds.length) {
            // Venía de Sin Agrupación
            onMutateGroups?.({ type: 'remove', groupId: Number(todoGrpId), ids: movingIds });
          } else if (!isTodo && fromGrpId && movingIds.length) {
            // Venía de una agrupación real (ej: "Cafeteria") — quitarlos optimistamente
            onMutateGroups?.({ type: 'remove', groupId: fromGrpId, ids: movingIds });
          }

          onGroupCreated?.(nombreCreado, newId, articulos);
          // Refetch para consolidar con backend (la DB ya está correcta)
          onRefetch?.();
        }}
        existingNames={(agrupaciones || []).map((g) => String(g?.nombre || '')).filter(Boolean)}
        treeMode={treeMode}
        groupName={articuloDisplayName}
        businessId={effectiveBusinessId}
        allowedIds={allowedIds || null}
      />
    </>
  );
}

export default React.memo(ArticuloAccionesMenu);