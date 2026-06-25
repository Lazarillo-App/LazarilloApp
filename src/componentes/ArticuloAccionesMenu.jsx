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
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { emitUiAction } from '@/servicios/uiEvents';
import { httpBiz, BusinessesAPI } from '../servicios/apiBusinesses';
import { addExclusiones } from '../servicios/apiAgrupacionesTodo';
import AgrupacionCreateModal from './AgrupacionCreateModal';
import { useOrganization } from '../context/OrganizationContext';
import { useBusiness } from '../context/BusinessContext';
import { obtenerAgrupaciones } from '../servicios/apiAgrupaciones';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ExcluirListasModal from './ExcluirListasModal';
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

  // Pre-seleccionar negocio activo al abrir — UN SOLO useEffect
  useEffect(() => {
    if (open) {
      setSelectedBizId(String(activeBizId || ''));
      setSelectedGroupId('');
    }
  }, [open, activeBizId]);

  // Auto-seleccionar si hay un solo negocio y selectedBizId está vacío
  useEffect(() => {
    if (negocios.length === 1 && !selectedBizId) {
      setSelectedBizId(String(negocios[0].id));
    }
  }, [negocios, selectedBizId]);

  const handleConfirm = useCallback(async () => {
    if (!selectedGroupId) return;
    const bizId = Number(selectedBizId);
    const groupId = Number(selectedGroupId);
    const grupo = agrupacionesMostrar.find(g => Number(g.id) === groupId);
    console.log('[MoverAModal] grupo encontrado:', grupo);
    console.log('[MoverAModal] grupo.business_id:', grupo?.business_id);
    const realBizId = Number(grupo?.business_id) || bizId;
    console.log('[MoverAModal] realBizId final:', realBizId, '| bizId del selector:', bizId);
    console.log('[MoverAModal] allBusinesses:', allBusinesses?.length, allBusinesses);
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
            label="Negocio"
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
              label=""
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
  treeMode = { treeMode },
  businessId,
  rootBizId: rootBizIdProp = null,
  allowedIds,
   priceLists = [],  
  priceListsByList = {},
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [openCrearAgr, setOpenCrearAgr] = useState(false);
  const [preselect, setPreselect] = useState(null);
  const [dlgReactivarOpen, setDlgReactivarOpen] = useState(false);
  const [origenReactivar, setOrigenReactivar] = useState(null);
  const { rootBusiness, allBusinesses, organization } = useOrganization() || {};

  const [treeLocal, setTreeLocal] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const { items: bizItems } = useBusiness() || {};
  const haveExternalTree = Array.isArray(todosArticulos) && todosArticulos.length > 0;
  const effectiveTree = haveExternalTree ? todosArticulos : treeLocal;
  const effectiveLoading = haveExternalTree ? !!loading : loadingLocal;

  const open = Boolean(anchorEl);
  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const [excluirOpen, setExcluirOpen] = useState(false);

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

  const negociosFiltrados = useMemo(() => {
    const activoNum = Number(businessId) || Number(agrupBizId);

    // Si hay org Y el negocio activo pertenece a esa org → mostrar solo los de la org
    if (organization?.id && organization?.businesses?.length > 0) {
      const orgIds = new Set(organization.businesses.map(b => Number(b.id)));
      if (orgIds.has(activoNum)) {
        // El negocio activo ES de esta org → mostrar todos los de la org
        return organization.businesses.filter(b => Number(b.id) > 0);
      }
    }

    // El negocio activo NO pertenece a ninguna org (o la org no lo incluye)
    // → mostrar SOLO el negocio activo
    const fuente = Array.isArray(bizItems) ? bizItems : [];
    const activo = fuente.find(b => Number(b.id) === activoNum);
    return activo ? [activo] : [{ id: activoNum, nombre: 'Negocio actual', name: 'Negocio actual' }];
  }, [organization, bizItems, businessId, agrupBizId]);

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
            method: 'PUT', body: {
              articulos: [{
                id: idNum,
                fromGroupId: currentGroupId ?? null,
                fromGroupName: agrupacionSeleccionada?.nombre ?? null,
                fromBizId: agrupBizId ?? null,
              }]
            },
          }, discBizId);
        }

        // Quitar de la agrupación actual en la DB
        if (currentGroupId && currentGroupId !== resolvedDiscId) {
          try {
            await httpBiz(`/agrupaciones/${currentGroupId}/articulos`, {
              method: 'DELETE', body: { ids: [idNum] },
            }, agrupBizId);
          } catch (e) {
            console.warn('[discontinuar] No se pudo quitar del origen:', e.message);
          }
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
        // REACTIVAR → buscar origen usando el endpoint plural (igual que SubrubroAccionesMenu)
        // El plural lee la metadata fromGroupId/fromBizId del JSONB de Discontinuados,
        // que es la fuente confiable cuando el artículo solo vive en Discontinuados.
        let origenData = null;
        try {
          const res = await httpBiz(
            `/agrupaciones/articulos/origenes`,
            { method: 'POST', body: { ids: [idNum] } },
            discBizId
          );
          origenData = res?.origenes?.[idNum] ?? res?.origenes?.[String(idNum)] ?? null;
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

      // 🆕 Navegar al origen del artículo reactivado
      console.log('[reactivar] origenReactivar:', origenReactivar, '| fromGroupId:', fromGroupId, '| fromBizId:', fromBizId);
      if (fromGroupId && fromBizId) {
        try {
          console.log('[reactivar] dispatching navigate event', { articleId: idNum, groupId: Number(fromGroupId), bizId: Number(fromBizId) });
          window.dispatchEvent(new CustomEvent('articulos:navigate-to-reactivated', {
            detail: { articleId: idNum, groupId: Number(fromGroupId), bizId: Number(fromBizId) },
          }));
        } catch { /* */ }
      }
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

    // Si el artículo está en Discontinuados, el origen siempre es discontinuadosId
    const fromId = isInDiscontinuados
      ? discontinuadosId
      : (!isTodo && currentGroupId ? Number(currentGroupId) : null);

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
        // ── Distinto negocio: limpiar de toda la org y mover al destino ──────
        await httpBiz('/agrupaciones/move-cross-biz', {
          method: 'POST',
          body: { articleIds: [idNum], toGroupId: toId, toBizId },
        }, agrupBizId);

        // Mutación optimista: quitar del grupo origen local
        if (fromId) {
          onMutateGroups?.({ type: 'remove', groupId: fromId, ids: [idNum] });
        }
      }

      notify?.(`Artículo movido a "${groupNombre}"`, 'success');
      pushUi({
        kind: 'move', scope: 'articulo', title: 'Artículo movido',
        message: `Movido a "${groupNombre}".`,
        payload: { ids: [idNum], fromId, toId, toBizId },
      });

      onAfterMutation?.([idNum]);

      // 🆕 Navegar al destino (mismo negocio o cross-biz)
      try {
        window.dispatchEvent(new CustomEvent('articulos:navigate-to-reactivated', {
          detail: { articleId: idNum, groupId: Number(toId), bizId: Number(toBizId) },
        }));
      } catch { /* */ }
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

  // Contador de listas en las que está excluido este artículo (leído del byList del hook).
  const exclusionesCount = useMemo(() => {
    if (!articuloIdNum || !priceLists?.length) return 0;
    let n = 0;
    // Global cuenta como una marca activa que pisa todas
    const baseEntry = priceListsByList?._base?.byArticle?.[String(articuloIdNum)];
    if (baseEntry?.excluido) return priceLists.filter(l => !l.is_favorite).length;
    for (const l of priceLists) {
      if (l.is_favorite) continue;
      const entry = priceListsByList?.[l.id]?.byArticle?.[String(articuloIdNum)];
      if (entry?.excluido) n++;
    }
    return n;
  }, [articuloIdNum, priceLists, priceListsByList]);

  const hayListasNoFavoritas = useMemo(
    () => (priceLists || []).some(l => !l.is_favorite),
    [priceLists]
  );

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
        {hayListasNoFavoritas && (
          <MenuItem onClick={() => { handleClose(); setTimeout(() => setExcluirOpen(true), 0); }}>
            <ListItemIcon><LocalOfferIcon fontSize="small" /></ListItemIcon>
            <ListItemText>
              Excluir de listas
              {exclusionesCount > 0 && (
                <Typography component="span" variant="caption" sx={{ ml: 1, color: '#f59e0b', fontWeight: 700 }}>
                  ({exclusionesCount})
                </Typography>
              )}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* ── Modal unificado "Mover a…" ── */}
      <MoverAModal
        open={dlgMoverOpen}
        onClose={closeMover}
        tituloExtra={`artículo #${articuloIdNum}`}
        agrupacionesLocales={agrupacionesLocalesParaMover}
        currentGroupId={currentGroupId}
        allBusinesses={negociosFiltrados}
        activeBizId={Number(businessId) || Number(agrupBizId)}
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

      <ExcluirListasModal
        open={excluirOpen}
        onClose={() => setExcluirOpen(false)}
        bizId={effectiveBusinessId}
        lists={priceLists}
        byList={priceListsByList}
        scope="articulo"
        scopeIds={Number.isFinite(articuloIdNum) ? [articuloIdNum] : []}
        scopeLabel={articuloDisplayName}
        notify={notify}
      />

    </>
  );
}

export default React.memo(ArticuloAccionesMenu);