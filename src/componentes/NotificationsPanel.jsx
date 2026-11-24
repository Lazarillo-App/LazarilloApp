/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/componentes/NotificationsPanel.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  Divider,
  Box,
  ListItemButton,
  CircularProgress,
  Alert,
  Chip,
  Popover,
} from '@mui/material';

import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckIcon from '@mui/icons-material/Check';
import UndoIcon from '@mui/icons-material/Undo';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '@/servicios/appAlert';
import { useAccess } from '@/context/AccessContext';
import { useAuth } from '@/context/AuthContext';
import { ScopeGestion } from '@/gestion/compat';
import { ActividadContenido, useActividadNuevos } from '@/componentes/gestion/pagos/actividad-campana';
import { agruparPorDia, horaDe } from '@/gestion/actividadFormato';
import { useAvisosAdmins, AvisosAdminsContenido, rutaDeAviso } from '@/componentes/super/AvisosAdmins';

// VerFactura necesita el contexto del Panel (negocio activo) para traer los maestros de la carga.
// La campana vive en el header, fuera del Panel: sin este envoltorio businessId quedaba null, los
// maestros nunca se pedían y el modal se quedaba cargando para siempre (Diego 12/11/2026, Comercio).
const VerFactura = React.lazy(() => Promise.all([
  import('@/componentes/gestion/CargarFactura'),
  import('@/componentes/gestion/FacturaEnRecetas'),
]).then(([cf, fr]) => ({
  default: function VerFacturaConContexto(props) {
    return <fr.ConContextoGestion><cf.VerFactura {...props} /></fr.ConContextoGestion>;
  },
})));

// Campana única (Diego 10/11/2026, opción A): una sola campana en el header con solapas por
// módulo, que abre en el módulo donde estás. Resultados = Actividad (facturas cargadas, editadas,
// eliminadas); Recetas = los avisos de artículos/insumos; Cuenta = pedidos de acceso.
// RRHH (Diego 12/11/2026, «todo ABM queda en Notificaciones»): altas, bajas, cambios de la
// nómina y de los cronogramas, con su propia solapa.
const moduloDeRuta = (p) => (p.startsWith('/gestion') ? 'resultados'
  : p.startsWith('/super') ? 'admins'
  : p.startsWith('/rrhh') ? 'rrhh'
  : (p.startsWith('/menu') || p.startsWith('/insumos') || p.startsWith('/agrupacioneslist')) ? 'recetas' : null);
const esDeCuenta = (n) => n?.kind === 'access_request';
const esDeRrhh = (n) => String(n?.kind || '').startsWith('rrhh_');
import { useBusiness } from '@/context/BusinessContext';
import { useNotifications } from '../hooks/useNotifications';
import { http } from '../servicios/apiBusinesses';
import { insumoDeshacerCostoManual, insumosDeshacerCostoManualLote } from '../servicios/apiInsumos';
import { emitUiUndo } from '@/servicios/uiEvents';

/* =========================
   API helpers (sync change-sets)
========================= */
async function apiGetChangeSet(businessId, changeSetId) {
  return http(`/businesses/${businessId}/sync/change-sets/${changeSetId}`);
}
async function apiApproveChangeSet(businessId, changeSetId) {
  return http(`/businesses/${businessId}/sync/change-sets/${changeSetId}/approve`, { method: 'POST' });
}
async function apiRejectChangeSet(businessId, changeSetId) {
  return http(`/businesses/${businessId}/sync/change-sets/${changeSetId}/reject`, { method: 'POST' });
}
async function apiApplyChangeSet(businessId, changeSetId) {
  return http(`/businesses/${businessId}/sync/change-sets/${changeSetId}/apply`, { method: 'POST' });
}

// Kinds del circuito de propuestas de receta que disparan la ventanita emergente
// (ver services/recetaProposals.js / recetaProposalsController.js en el backend).
const PROPOSAL_KINDS = new Set([
  'receta_proposal', 'receta_proposal_approved', 'receta_proposal_rejected', 'receta_proposal_revision',
]);

// Avisos de cocina (usuaria 23/11/2026): también quedan en pantalla hasta descartarlos, y al tocarlos
// abren la tarea (la receta con el cambio o la observación) o lo que corresponda. Quién los recibe lo
// decide el servidor: del cocinero al jefe y al dueño/admin; del jefe al dueño/admin.
const aTarea = (m) => {
  const id = m?.tarea_id ?? m?.ids?.[0];
  return id ? `/produccion?tarea=${id}` : '/produccion';
};
const aOrden = (m) => (m?.orden_id ? `/mantenimiento?orden=${m.orden_id}` : '/mantenimiento');
const COCINA_KINDS = {
  produccion_cambio: { icono: '🔁', color: '#C77C12', abrir: aTarea },
  produccion_nota: { icono: '💬', color: '#2F6FB2', abrir: aTarea },
  produccion_desperdicio: { icono: '🗑️', color: '#C0392B', abrir: () => '/produccion?vista=registros' },
  produccion_decision: { icono: '✅', color: '#1F8A5B', abrir: aTarea },
  produccion_tarea: { icono: '📋', color: '#15213E', abrir: aTarea },
  produccion_novedad: { icono: '📌', color: '#2492C8', abrir: () => '/produccion?vista=novedades' },
  mant_falla: { icono: '🛠️', color: '#C0392B', abrir: aOrden },
  mant_orden: { icono: '🔧', color: '#15213E', abrir: aOrden },
};
const ROL_ACTOR = { cocina: 'cocina', jefe: 'jefe de cocina', gestor: 'administración' };

/* ========= helpers ========= */
function pickChangeSetId(notif) {
  const raw = notif?.metadata?.change_set_id ?? notif?.meta?.change_set_id ?? null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;

  if (!Number.isFinite(diff)) return '';
  if (diff < 60000) return 'Hace un momento';
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} hs`;
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function NotificationsPanel({ businessId: businessIdProp }) {
  const { activeBusinessId } = useBusiness() || {};
  const businessId = Number(businessIdProp ?? activeBusinessId) || null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Aumentos de precios borrados que ya se deshicieron (tablero #10).
  const [aumentosDeshechos, setAumentosDeshechos] = useState(() => new Set());
  const deshacerAumento = async (notif) => {
    const m = notif.metadata || {};
    if (!businessId || !m.fecha) return;
    try {
      const q = m.sucursal != null ? `?sucursal=${encodeURIComponent(m.sucursal)}` : '';
      await http(`/businesses/${businessId}/gestion/dashboard/canasta/aumentos${q}`, { method: 'POST', body: { fecha: m.fecha } });
      setAumentosDeshechos((x) => new Set(x).add(notif.id));
      queryClient.invalidateQueries({ queryKey: ['gestionCanasta'] });
      showAlert('Listo: el aumento volvió a quedar anotado.', 'success');
    } catch {
      showAlert('No se pudo deshacer. Anotalo de nuevo desde Tu canasta.', 'error');
    }
  };

  // Costo manual de un insumo deshecho desde la campanita (Diego 19/11/2026).
  const [costosDeshechos, setCostosDeshechos] = useState(() => new Set());
  const deshacerCostoManual = async (notif) => {
    const ids = (notif.metadata?.ids || []).filter((x) => x != null);
    const insumoId = ids[0];
    if (!businessId || insumoId == null) return;
    try {
      // Recargo a varios insumos (todo un proveedor): se deshace el lote entero.
      if (ids.length > 1) {
        const r = await insumosDeshacerCostoManualLote(ids, businessId);
        setCostosDeshechos((x) => new Set(x).add(notif.id));
        try { window.dispatchEvent(new CustomEvent('insumos:costos-lote', { detail: { insumoIds: ids } })); } catch { /* nada */ }
        queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').startsWith('insumos') });
        const n = r?.items?.length || 0;
        showAlert(`Listo: ${n} insumo${n === 1 ? '' : 's'} volvieron a su costo${r?.saltados ? ` (${r.saltados} ya no estaban manuales)` : ''}.`, 'success');
        return;
      }
      const r = await insumoDeshacerCostoManual(insumoId, businessId);
      setCostosDeshechos((x) => new Set(x).add(notif.id));
      try { window.dispatchEvent(new CustomEvent('insumos:updated', { detail: { insumoId } })); } catch { /* nada */ }
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').startsWith('insumos') });
      showAlert(r?.deCompras ? 'Listo: el insumo volvió al costo de sus compras.'
        : r?.sinPrevio ? 'Listo: ya no es manual. No había un precio anterior guardado, así que queda el mismo.'
          : 'Listo: el insumo volvió al precio de antes.', 'success');
    } catch (e) {
      if (e?.status === 409) {
        setCostosDeshechos((x) => new Set(x).add(notif.id));
        showAlert('Ese costo ya no está manual (se deshizo o entró una compra).', 'info');
      } else {
        showAlert(e?.message || 'No se pudo deshacer.', 'error');
      }
    }
  };

  const [open, setOpen] = useState(false);
  const botonRef = React.useRef(null);
  const location = useLocation();
  const { puedeVer = () => true, isStaff } = useAccess() || {};
  const verResultados = !isStaff && puedeVer('resultados');
  const moduloActual = moduloDeRuta(location.pathname);
  const actividad = useActividadNuevos(verResultados);
  const [solapa, setSolapa] = useState('recetas');
  // «Mías» / «Del equipo» (Diego 12/11/2026, como en el Panel de Gestión): los avisos que dejó
  // otra persona (alta, baja o discontinuar de artículos e insumos) traen metadata.actor_user_id.
  const { user } = useAuth() || {};
  const miId = Number(user?.id) || null;
  const [quien, setQuien] = useState('todas');
  const [vistoAlAbrir, setVistoAlAbrir] = useState('');
  // Solapa "Admins" (usuaria 13/11/2026): lo que hace el equipo en el panel de super usuarios.
  const esSuper = user?.es_superusuario === true;
  const admins = useAvisosAdmins(esSuper);
  const [vistoAdminsAlAbrir, setVistoAdminsAlAbrir] = useState(null);
  const [verFactura, setVerFactura] = useState(null);

  // El panel solo se abre por interacción del usuario (clic en el ícono) o
  // por solicitud explícita de otro componente (evento 'notifications:open').
  // Las nuevas notificaciones se contabilizan en el badge sin expandir el drawer.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('notifications:open', onOpen);
    return () => window.removeEventListener('notifications:open', onOpen);
  }, []);

  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    refreshCount,
    refreshAll,
    markAsRead,
    markAllAsRead,
    patchNotification,
  } = useNotifications({ businessId, refreshInterval: 60000 });

  // Cada minuto se mira el número; si subió, se trae la lista para que las ventanitas aparezcan sin
  // recargar la página (antes solo se traía al abrir la campana).
  const unreadPrevio = React.useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > unreadPrevio.current) refresh?.();
    unreadPrevio.current = unreadCount;
  }, [unreadCount, refresh]);

  const [rowBusy, setRowBusy] = useState({});
  const [uiNotifs, setUiNotifs] = useState([]);

  /* =========================
     ✅ Persistencia + DEDUPE UI
  ========================= */
  const UI_KEY = useCallback((bid) => `lazarillo:uiNotifs:${bid || 'na'}`, []);

  // cargar persistido por negocio (limpiando notificaciones > 30 días)
  useEffect(() => {
    if (!businessId) return;
    try {
      const raw = localStorage.getItem(UI_KEY(businessId));
      if (!raw) {
        setUiNotifs([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        // Las no leídas nunca se borran por antigüedad: quedan hasta marcarlas como leídas.
        const filtered = parsed.filter(n => {
          if (!n.read) return true;
          const age = now - new Date(n.created_at || 0).getTime();
          return age < THIRTY_DAYS;
        });
        setUiNotifs(filtered);
      } else {
        setUiNotifs([]);
      }
    } catch {
      setUiNotifs([]);
    }
  }, [businessId, UI_KEY]);

  // persistir cambios
  useEffect(() => {
    if (!businessId) return;
    try {
      localStorage.setItem(UI_KEY(businessId), JSON.stringify(uiNotifs || []));
    } catch { }
  }, [uiNotifs, businessId, UI_KEY]);

  // ✅ Helper para formatear título (necesario para usar en merged)
  const formatTitle = useCallback((notif) => {
    const scope = notif?.scope || notif?.payload?.scope || 'articulo';
    const scopeLabel = scope === 'insumo' ? 'Insumo' : 'Artículo';
    const kind = notif?.kind;

    if (kind === 'objetivo_update') return `🎯 Objetivo % actualizado`;
    if (kind === 'group_favorite_set') return `⭐ Marcada como favorita`;
    if (kind === 'group_favorite_unset') return `☆ Desmarcada como favorita`;
    if (kind === 'group_create') return `🆕 Nueva agrupación`;
    if (kind === 'group_delete') return `🗑️ Agrupación eliminada`;
    if (kind === 'group_rename') return `✏️ Agrupación renombrada`;
    if (kind === 'group_move_division') return `🔀 Enviada a división`;
    if (kind === 'discontinue') return `⛔ ${scopeLabel}${notif.payload?.ids?.length > 1 ? 's' : ''} discontinuado${notif.payload?.ids?.length > 1 ? 's' : ''}`;
    if (kind === 'move') return `📦 ${scopeLabel}${notif.payload?.ids?.length > 1 ? 's' : ''} movido${notif.payload?.ids?.length > 1 ? 's' : ''}`;

    return notif?.title || 'Notificación';
  }, []);

  // 1) Escuchar eventos globales ui:action (con dedupe mejorado)
  useEffect(() => {
    const makeSig = (d) => {
      const groupId = String(d?.payload?.groupId ?? '');
      const groupName = String(d?.payload?.groupName ?? d?.message ?? '').toLowerCase().trim();
      const ids = (d?.payload?.ids || [])
        .map(Number).filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b).join(',');

      const val = String(d?.payload?.val ?? d?.payload?.objetivo ?? '');

      return [d?.kind || '', d?.scope || d?.payload?.scope || '', groupId, groupName, ids, val].join('|');
    };

    const onUiAction = (e) => {
      const d = e?.detail;
      if (!d) return;

      console.log('🔔 [NotificationsPanel] Evento recibido:', {
        kind: d.kind,
        scope: d.scope,
        title: d.title,
        message: d.message,
        groupId: d.payload?.groupId,
        groupName: d.payload?.groupName,
      });

      // filtrar negocio
      if (businessId && d.businessId && Number(d.businessId) !== Number(businessId)) {
        console.log('⏭️ [NotificationsPanel] Ignorado: negocio diferente');
        return;
      }

      const scope = d.scope ?? d.payload?.scope ?? (d.kind === 'discontinue' ? 'articulo' : null);
      const actionId = d.actionId || d.id || null;
      const sig = makeSig(d);

      const item = {
        id: actionId
          ? `ui:${actionId}`
          : `ui:${Date.now()}:${Math.random().toString(16).slice(2)}`,
        _actionId: actionId,
        _sig: sig,

        source: 'ui',
        read: false,
        kind: d.kind,
        scope,
        businessId: d.businessId ?? businessId ?? null,
        title: d.title || 'Notificación',
        message: d.message || '',
        created_at: d.createdAt || new Date().toISOString(),
        payload: d.payload || {},
        resolved: false,
      };

      setUiNotifs((prev) => {
        const arr = Array.isArray(prev) ? prev : [];

        // ✅ 1) dedupe por actionId
        if (actionId && arr.some((n) => n?._actionId === actionId)) {
          console.log('🚫 [NotificationsPanel] DUPLICADO por actionId:', actionId);
          return arr;
        }

        // ✅ 2) dedupe por firma en ventana de 5s
        const now = Date.now();
        const repeated = arr.find((n) => {
          if (!n?._sig || n._sig !== sig) return false;
          const t = new Date(n.created_at).getTime();
          const diff = now - t;
          return Number.isFinite(t) && diff < 5000; // 5s
        });

        if (repeated) {
          console.log('🚫 [NotificationsPanel] DUPLICADO por firma:', {
            sig,
            diff: now - new Date(repeated.created_at).getTime(),
            existing: repeated.title,
            new: item.title,
          });
          return arr;
        }

        console.log('✅ [NotificationsPanel] Notificación añadida:', item.title);
        // Si es objetivo_update, iniciar countdown de 2 minutos
        if (item.kind === 'objetivo_update') {
          setCountdowns(prev => ({ ...prev, [item.id]: 86400 }));
        }
        return [item, ...arr].slice(0, 200);
      });
    };

    window.addEventListener('ui:action', onUiAction);
    return () => window.removeEventListener('ui:action', onUiAction);
  }, [businessId]);

  const setBusy = useCallback((notifId, actionOrNull) => {
    setRowBusy((prev) => {
      const next = { ...prev };
      if (!actionOrNull) delete next[notifId];
      else next[notifId] = actionOrNull;
      return next;
    });
  }, []);

  // 2) Al abrir panel, traer backend list+count (opcional)
  useEffect(() => {
    if (!open) return;
    refreshAll?.();
  }, [open, refreshAll]);

  // 3) Auto-refresh backend (opcional)
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      refresh?.();
      refreshCount?.();
    }, 15000);
    return () => clearInterval(t);
  }, [open, refresh, refreshCount]);

  const safeRefreshAfterAction = useCallback(async () => {
    await refreshCount?.();
    await refresh?.();
    try { window.dispatchEvent(new CustomEvent('sync:completed')); } catch { }
  }, [refresh, refreshCount]);

  const onNotifClick = useCallback(async (notif) => {
    if (!notif?.read && !notif?.metadata?.resolution?.status) {
      try { await markAsRead([notif.id]); } catch { }
    }
  }, [markAsRead]);

  const getIcon = (notif) => {
    if (notif?.source === 'ui') {
      const kind = notif.kind;
      if (kind === 'discontinue') return '⛔';
      if (kind === 'aumento_borrado') return '🏷️';
      if (kind === 'group_create') return '🆕';
      if (kind === 'group_delete') return '🗑️';
      if (kind === 'group_rename') return '✏️';
      if (kind === 'group_move_division') return '🔀';
      if (kind === 'group_favorite_set') return '⭐';
      if (kind === 'group_favorite_unset') return '☆';
      if (kind === 'move') return '📦';
      return '📌';
    }
    if (notif?.kind === 'access_request') return '👤';
    return '🔔';
  };

  const rejectInline = useCallback(async (notif) => {
    const csId = pickChangeSetId(notif);
    if (!businessId || !csId) return;

    setBusy(notif.id, 'reject');

    patchNotification?.(notif.id, {
      read: true,
      metadata: { resolution: { status: 'rejected', at: new Date().toISOString(), change_set_id: String(csId) } },
    });

    try {
      await apiRejectChangeSet(businessId, csId);
      await safeRefreshAfterAction();
    } catch (e) {
      patchNotification?.(notif.id, { read: false, metadata: { resolution: null } });
      await safeRefreshAfterAction();
    } finally {
      setBusy(notif.id, null);
    }
  }, [businessId, patchNotification, safeRefreshAfterAction, setBusy]);

  const acceptAndApplyInline = useCallback(async (notif) => {
    const csId = pickChangeSetId(notif);
    if (!businessId || !csId) return;

    setBusy(notif.id, 'apply');

    patchNotification?.(notif.id, {
      read: true,
      metadata: { resolution: { status: 'applied', at: new Date().toISOString(), change_set_id: String(csId) } },
    });

    try {
      const cs = await apiGetChangeSet(businessId, csId);
      const status = String(cs?.item?.status || '');

      if (status === 'applied' || status === 'rejected') {
        await safeRefreshAfterAction();
        return;
      }
      if (status === 'pending' || status === 'error') {
        await apiApproveChangeSet(businessId, csId);
      }
      await apiApplyChangeSet(businessId, csId);
      await safeRefreshAfterAction();
    } catch (e) {
      patchNotification?.(notif.id, { read: false, metadata: { resolution: null } });
      await safeRefreshAfterAction();
    } finally {
      setBusy(notif.id, null);
    }
  }, [businessId, patchNotification, safeRefreshAfterAction, setBusy]);

  // Notificaciones que vienen del backend (sync_notifications) — antes se
  // pedían (fetch) pero nunca se mostraban ni se contaban en el badge.
  const backendNotifs = useMemo(() => {
    return (notifications || []).map((n) => ({
      id: `be:${n.id}`,
      _backendId: n.id,
      source: 'backend',
      read: !!n.read,
      kind: n.type,
      title: n.title,
      message: n.message,
      created_at: n.created_at,
      metadata: n.metadata,
      scope: n.metadata?.scope ?? null,
      resolved: false,
    }));
  }, [notifications]);

  // ── Ventanita emergente (toast) para el circuito de propuestas de receta ──
  // Distinta del drawer: aparece sola, abajo a la izquierda, mientras la
  // persona sigue trabajando en la tabla — no hace falta abrir la campanita
  // para enterarse. Cubre las 4 instancias: propuesta nueva (admin), y
  // aprobada/rechazada/a revisión (quien la propuso).
  // Se muestran mientras la notificación esté sin leer: no se borran solas ni al
  // recargar. Cerrarla (X) o abrirla la marca como leída.
  const toastsPendientes = useMemo(() => (notifications || [])
    .filter((n) => !n.read && (PROPOSAL_KINDS.has(n.metadata?.kind) || COCINA_KINDS[n.metadata?.kind])), [notifications]);
  const proposalToasts = useMemo(() => toastsPendientes.slice(0, 4)
    .map((n) => ({ id: n.id, message: n.message, title: n.title, kind: n.metadata?.kind, meta: n.metadata || {} })),
  [toastsPendientes]);
  const toastsDeMas = toastsPendientes.length - proposalToasts.length;

  const cerrarToast = (id) => markAsRead([id]);

  const deEquipo = (n) => n?.source === 'backend' && n.metadata?.actor_user_id != null && Number(n.metadata.actor_user_id) !== miId;

  // ✅ 4) UI notifs (no resueltas) + notifs del backend, ordenadas por fecha
  const merged = useMemo(() => {
    const ui = (uiNotifs || []).filter((n) => !n.resolved);
    return [...backendNotifs, ...ui].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [uiNotifs, backendNotifs]);

  const unreadUiCount = useMemo(
    () => (uiNotifs || []).filter((n) => !n.read && !n.resolved).length,
    [uiNotifs]
  );

  // ✅ Badge: UI notifs + no leídas del backend (pedidos de acceso, sync, etc.)
  const badgeCount = unreadUiCount + (unreadCount || 0);
  const noLeidaRecetas = (n) => !n.read && !esDeCuenta(n) && !esDeRrhh(n);
  const nRecetas = useMemo(() => merged.filter(noLeidaRecetas).length, [merged]); // eslint-disable-line react-hooks/exhaustive-deps
  const nCuenta = useMemo(() => merged.filter((n) => !n.read && esDeCuenta(n)).length, [merged]);
  const nRrhh = useMemo(() => merged.filter((n) => !n.read && esDeRrhh(n)).length, [merged]);
  const hayRrhh = merged.some(esDeRrhh);
  // solapa a la que pertenece cada aviso
  const enSolapa = (n, sol) => (sol === 'cuenta' ? esDeCuenta(n) : sol === 'rrhh' ? esDeRrhh(n) : !esDeCuenta(n) && !esDeRrhh(n));
  const hayCuenta = merged.some(esDeCuenta);
  // El número de la campana es el del módulo donde estás; fuera de un módulo, el total.
  const numeroCampana = moduloActual === 'resultados' ? actividad.nuevos
    : moduloActual === 'recetas' ? nRecetas
      : moduloActual === 'rrhh' ? nRrhh
        : moduloActual === 'admins' && esSuper ? admins.nuevos
          : nRecetas + nCuenta + nRrhh + (verResultados ? actividad.nuevos : 0) + admins.nuevos;
  const abrirCampana = () => {
    setSolapa(moduloActual === 'resultados' && verResultados ? 'resultados'
      : moduloActual === 'recetas' ? 'recetas'
      : moduloActual === 'rrhh' ? 'rrhh'
        : moduloActual === 'admins' && esSuper ? 'admins'
          : (verResultados && actividad.nuevos > 0 && nRecetas === 0) ? 'resultados'
            : (esSuper && admins.nuevos > 0 && nRecetas === 0) ? 'admins' : 'recetas');
    setVistoAlAbrir(actividad.visto);
    setVistoAdminsAlAbrir(admins.visto_hasta);
    if (esSuper) admins.cargar();
    setOpen(true);
  };
  const cerrarCampana = () => {
    setOpen(false);
    if (verResultados) actividad.marcarVisto();
    if (esSuper && solapa === 'admins') admins.marcarVisto();
  };

  const handleNotifClick = useCallback((notif) => {
    if (notif.source === 'backend') {
      if (!notif.read) markAsRead([notif._backendId]);
      if (notif.kind === 'access_request') {
        setOpen(false);
        navigate('/configuracion?tab=5');
      }
      // Producción: tarea asignada, cambio de ingrediente, decisión u observación → abre la tarea.
      if (String(notif.kind || '').startsWith('mant_')) {
        const id = notif.metadata?.orden_id;
        setOpen(false);
        navigate(id ? `/mantenimiento?orden=${id}` : '/mantenimiento');
      }
      if (notif.kind === 'produccion_novedad' || notif.metadata?.kind === 'produccion_novedad') {
        setOpen(false);
        navigate('/produccion?vista=novedades');
        return;
      }
      if (notif.kind === 'produccion_desperdicio' || notif.metadata?.kind === 'produccion_desperdicio') {
        setOpen(false);
        navigate('/produccion?vista=registros');
        return;
      }
      if (String(notif.kind || '').startsWith('produccion_')) {
        const id = notif.metadata?.tarea_id ?? notif.metadata?.ids?.[0];
        setOpen(false);
        navigate(id ? `/produccion?tarea=${id}` : '/produccion');
      }
      return;
    }
    setUiNotifs((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
  }, [markAsRead, navigate]);

  // Marca TODO como leído: las locales (uiNotifs, guardadas en localStorage) y las
  // del backend (pedidos de acceso, sync, etc.) — antes solo tocaba las locales, así
  // que las del backend (el grueso del "99+" cuando hay notificaciones viejas que se
  // acumularon) nunca se limpiaban con este botón.
  const markAllUiAsRead = () => {
    setUiNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    if (unreadCount > 0) markAllAsRead();
  };

  // Countdown para notificaciones de objetivo_update (2 minutos)
  const [countdowns, setCountdowns] = React.useState({});
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const next = { ...prev };
        let changed = false;
        for (const [id, val] of Object.entries(next)) {
          if (val > 0) { next[id] = val - 1; changed = true; }
          else {
            // Expiró — marcar como resuelta
            setUiNotifs(p => p.map(n => n.id === id ? { ...n, resolved: true, read: true } : n));
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const undoUiNotif = async (uiNotif) => {
    console.log('[undoUiNotif] payload:', JSON.stringify(uiNotif.payload));
    emitUiUndo({
      kind: uiNotif.kind,
      scope: uiNotif.scope,
      businessId: uiNotif.businessId || businessId,
      payload: uiNotif.payload,
    });

    setUiNotifs((prev) =>
      prev.map((n) => (n.id === uiNotif.id ? { ...n, resolved: true, read: true } : n))
    );
  };

  const dismissUiNotif = (uiNotif) => {
    setUiNotifs((prev) =>
      prev.map((n) => (n.id === uiNotif.id ? { ...n, resolved: true, read: true } : n))
    );
  };

  // Un aviso de Recetas/Cuenta con el formato de Actividad: ícono, título, detalle, hora y acciones.
  const renderAviso = (notif) => {
    const canUndo = (notif) => {
      if (!notif) return false;
      const kind = notif.kind;
      const scope = notif.scope || notif.payload?.scope || 'articulo';
      if (kind === 'objetivo_update' || kind === 'objetivo_change') return true;
      // Deshacer solo lo que hiciste en esta sesión (el aviso de otra persona no trae con qué).
      return notif.source === 'ui' && kind === 'discontinue' && (scope === 'articulo' || scope === 'insumo');
    };

    // "Ir al artículo/insumo": solo cuando el payload trae UN solo id (alta,
    // movimiento) — con varios de una no hay a dónde "ir" puntualmente.
    // notif.payload (eventos 'ui' en vivo, esta sesión) o notif.metadata
    // (notificación ya guardada y releída del backend — ver notificationService.js
    // createUiNotification, que persiste el payload tal cual dentro de metadata).
    const GOTO_KINDS = new Set(['move', 'articulo_create', 'insumo_create', 'articulo_move', 'insumo_move']);
    const getGotoId = (notif) => {
      if (!notif || !GOTO_KINDS.has(notif.kind)) return null;
      const ids = notif.payload?.ids || notif.metadata?.ids;
      if (!Array.isArray(ids) || ids.length !== 1) return null;
      const id = Number(ids[0]);
      return Number.isFinite(id) ? id : null;
    };
    // Mismo mecanismo de "foco pendiente" que ya usa el buscador global para
    // saltar entre Artículos e Insumos (sessionStorage + efecto de montaje en
    // cada página — ver ArticulosMain.jsx/InsumosMain.jsx, "pendingFocusX").
    const goToTarget = (notif) => {
      const id = getGotoId(notif);
      if (id == null) return;
      const scope = notif.scope || notif.payload?.scope || notif.metadata?.scope || 'articulo';
      setOpen(false);
      try {
        sessionStorage.setItem(scope === 'insumo' ? 'pendingFocusInsumo' : 'pendingFocusArticulo', String(id));
      } catch { /* sessionStorage puede no estar disponible */ }
      // Si ya estás parada en la página correcta, navigate() a la MISMA ruta no
      // remonta el componente — el efecto que lee pendingFocusX del sessionStorage
      // nunca corre, y el click no hacía nada. Este evento cubre ese caso: si la
      // página ya está montada y escuchando, foquea de una sin esperar un remount.
      window.dispatchEvent(new CustomEvent(
        scope === 'insumo' ? 'focus:pendingInsumo' : 'focus:pendingArticulo',
        { detail: { id } }
      ));
      navigate(scope === 'insumo' ? '/insumos' : '/menu');
    };

    const getCountdownLabel = (notif) => {
      const secs = countdowns[notif.id];
      if (!secs) return null;
      const m = Math.floor(secs / 60);
      const s = String(secs % 60).padStart(2, '0');
      return `${m}:${s}`;
    };


    const fecha = new Date(notif.created_at);
    return (
      <Box key={notif.id} onClick={() => handleNotifClick(notif)}
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(91,194,234,.08)' } }}>
        <Box sx={{ mt: 1.1, width: 6, height: 6, borderRadius: '50%', flexShrink: 0, bgcolor: notif.read ? 'transparent' : '#5BC2EA' }} />
        <Box sx={{ width: 26, height: 26, borderRadius: '6px', bgcolor: '#f2f4f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
          {getIcon(notif)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: notif.read ? 500 : 700, lineHeight: 1.35 }}>
            {formatTitle(notif)}
            {notif.scope === 'insumo' && <Chip label="Insumo" size="small" sx={{ ml: 0.75, height: 16, fontSize: '0.65rem' }} />}
          </Typography>
          {notif.message && <Typography sx={{ fontSize: 11.5, color: 'text.secondary', whiteSpace: 'pre-line' }}>{notif.message}</Typography>}
          {deEquipo(notif) && notif.metadata?.actor_nombre && (
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>por {notif.metadata.actor_nombre}</Typography>
          )}
          {notif.kind === 'aumento_borrado' && (
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
              {aumentosDeshechos.has(notif.id)
                ? <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'success.main' }}>Deshecho ✓</Typography>
                : (
                  <Box component="button" type="button" onClick={(e) => { e.stopPropagation(); deshacerAumento(notif); }}
                    sx={{ border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                    Deshacer ›
                  </Box>
                )}
            </Box>
          )}
          {/* Los avisos de antes del 19/11 no traen costo_manual: se reconocen por el título. */}
          {(notif.metadata?.costo_manual || (notif.kind === 'insumo_update' && /^Costo manual: /.test(notif.title || '') && notif.metadata?.ids?.length)) && (
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
              {costosDeshechos.has(notif.id)
                ? <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'success.main' }}>Deshecho ✓</Typography>
                : (
                  <Box component="button" type="button" onClick={(e) => { e.stopPropagation(); deshacerCostoManual(notif); }}
                    sx={{ border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                    Deshacer ›
                  </Box>
                )}
            </Box>
          )}
          {(canUndo(notif) || getGotoId(notif) != null) && (
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
              {canUndo(notif) && (
                <Box component="button" type="button" onClick={(e) => { e.stopPropagation(); undoUiNotif(notif); }}
                  sx={{ border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                  Deshacer{getCountdownLabel(notif) ? ` (${getCountdownLabel(notif)})` : ''} ›
                </Box>
              )}
              {getGotoId(notif) != null && (
                <Box component="button" type="button" onClick={(e) => { e.stopPropagation(); goToTarget(notif); }}
                  sx={{ border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 600, color: '#0d6fa8' }}>
                  Ir {notif.scope === 'insumo' ? 'al insumo' : 'al artículo'} ›
                </Box>
              )}
            </Box>
          )}
        </Box>
        <Typography sx={{ mt: 0.25, fontSize: 11, color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {Number.isFinite(fecha.getTime()) ? horaDe(fecha) : ''}
        </Typography>
      </Box>
    );
  };

  return (
    <>
      <IconButton ref={botonRef} onClick={abrirCampana} color="inherit" aria-label="Abrir notificaciones">
        <Badge badgeContent={numeroCampana} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      {proposalToasts.length > 0 && (
        <Box data-no-captura="" sx={{
          // En el celular a lo ancho y por encima del botón de Anthony (abajo a la derecha).
          position: 'fixed', left: 16, right: { xs: 16, sm: 'auto' }, bottom: { xs: 96, sm: 16 }, zIndex: 1400,
          display: 'flex', flexDirection: 'column-reverse', gap: 1, maxWidth: { xs: 'none', sm: 360 },
        }}>
          {toastsDeMas > 0 && (
            <Button size="small" onClick={abrirCampana}
              sx={{ alignSelf: 'flex-start', bgcolor: 'background.paper', boxShadow: 2, borderRadius: 2, textTransform: 'none', px: 1.5 }}>
              +{toastsDeMas} {toastsDeMas === 1 ? 'aviso más' : 'avisos más'}
            </Button>
          )}
          {proposalToasts.map((t) => {
            const cocina = COCINA_KINDS[t.kind];
            if (cocina) {
              const abrir = () => { cerrarToast(t.id); navigate(cocina.abrir(t.meta)); };
              return (
                <Box key={t.id} role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => { if (e.key === 'Enter') abrir(); }}
                  sx={{
                    bgcolor: 'background.paper', borderRadius: 2, boxShadow: 4, border: '1px solid', borderColor: 'divider',
                    borderLeft: `4px solid ${cocina.color}`, p: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1, cursor: 'pointer',
                    '&:hover': { boxShadow: 6 },
                  }}>
                  <Box sx={{ fontSize: 20, lineHeight: 1.2 }} aria-hidden>{cocina.icono}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} fontSize="0.85rem">{t.title}</Typography>
                    {t.meta.actor_nombre && (
                      <Typography fontSize="0.72rem" color="text.secondary">
                        {t.meta.actor_nombre}{ROL_ACTOR[t.meta.actor_rol] ? ` · ${ROL_ACTOR[t.meta.actor_rol]}` : ''}
                      </Typography>
                    )}
                    {t.message && <Typography fontSize="0.78rem" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{t.message}</Typography>}
                    <Typography fontSize="0.72rem" sx={{ color: cocina.color, fontWeight: 600, mt: 0.25 }}>Tocá para abrir</Typography>
                  </Box>
                  <IconButton size="small" aria-label="Descartar" onClick={(e) => { e.stopPropagation(); cerrarToast(t.id); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            }
            return (
            <Box
              key={t.id}
              sx={{
                bgcolor: 'background.paper', borderRadius: 2, boxShadow: 4,
                border: '1px solid', borderColor: 'divider',
                p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} fontSize="0.85rem">{t.title}</Typography>
                <Typography fontSize="0.78rem" color="text.secondary">{t.message}</Typography>
                {t.kind === 'receta_proposal' && (
                  <Button
                    size="small" sx={{ mt: 0.5, p: 0, minWidth: 0, textTransform: 'none' }}
                    onClick={() => { cerrarToast(t.id); navigate('/configuracion?tab=6'); }}
                  >
                    Ver aprobaciones
                  </Button>
                )}
              </Box>
              <IconButton size="small" onClick={() => cerrarToast(t.id)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            );
          })}
        </Box>
      )}

      <Popover
        open={open}
        anchorEl={botonRef.current}
        onClose={cerrarCampana}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 420, maxWidth: '94vw', borderRadius: '14px', mt: 1, boxShadow: '0 18px 50px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', maxHeight: 'min(640px, 78vh)' } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.75, pb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Notificaciones</Typography>
          <IconButton onClick={cerrarCampana} size="small" aria-label="Cerrar"><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2, pb: 1.25, flexWrap: 'wrap' }}>
          {[
            verResultados && { id: 'resultados', nombre: 'Resultados', n: actividad.nuevos },
            { id: 'recetas', nombre: 'Recetas', n: nRecetas },
            (hayRrhh || moduloActual === 'rrhh') && { id: 'rrhh', nombre: 'RRHH', n: nRrhh },
            hayCuenta && { id: 'cuenta', nombre: 'Cuenta', n: nCuenta },
            esSuper && { id: 'admins', nombre: 'Admins', n: admins.nuevos },
          ].filter(Boolean).map((m) => (
            <Box key={m.id} component="button" type="button" onClick={() => setSolapa(m.id)}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', font: 'inherit', fontSize: 12,
                px: 1.25, py: 0.5, borderRadius: 999, border: '1px solid',
                borderColor: solapa === m.id ? '#15213E' : '#e3e6eb',
                bgcolor: solapa === m.id ? '#15213E' : 'transparent', color: solapa === m.id ? '#fff' : '#5b6577',
              }}>
              {m.nombre}
              {m.n > 0 && <Box component="span" sx={{ bgcolor: '#ef4444', color: '#fff', borderRadius: 999, px: 0.75, fontSize: 10.5, fontWeight: 700, lineHeight: '16px' }}>{m.n > 99 ? '99+' : m.n}</Box>}
            </Box>
          ))}
          {(solapa === 'recetas' || solapa === 'rrhh') && merged.some((n) => enSolapa(n, solapa) && deEquipo(n)) && (() => {
            const opciones = [
              { id: 'todas', nombre: 'Todas' },
              { id: 'mias', nombre: 'Mías', n: merged.filter((n) => !n.read && enSolapa(n, solapa) && !deEquipo(n)).length },
              { id: 'equipo', nombre: 'Del equipo', n: merged.filter((n) => !n.read && enSolapa(n, solapa) && deEquipo(n)).length },
            ];
            return (
              <Box sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', height: 26, boxSizing: 'border-box', border: '1px solid #e3e6eb', borderRadius: 999, p: '2px' }}>
                {opciones.map((o) => (
                  <Box key={o.id} component="button" type="button" onClick={() => setQuien(o.id)}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 11.5,
                      px: 1, height: 20, borderRadius: 999, whiteSpace: 'nowrap',
                      bgcolor: quien === o.id ? 'rgba(91,194,234,.18)' : 'transparent', color: quien === o.id ? '#0d6fa8' : '#5b6577', fontWeight: quien === o.id ? 600 : 400,
                    }}>
                    {o.nombre}{o.n > 0 && <Box component="span" sx={{ fontSize: 10.5, opacity: 0.8 }}>{o.n > 99 ? '99+' : o.n}</Box>}
                  </Box>
                ))}
              </Box>
            );
          })()}
        </Box>
        <Divider />
        <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {solapa === 'admins' ? (
            <AvisosAdminsContenido avisos={admins} miId={miId} vistoAlAbrir={vistoAdminsAlAbrir}
              onIr={(a) => { cerrarCampana(); navigate(rutaDeAviso(a)); }} />
          ) : solapa === 'resultados' ? (
            <ScopeGestion>
              <Box sx={{ pt: 1 }}>
                <ActividadContenido vistoAlAbrir={vistoAlAbrir} onVer={(v) => { setVerFactura(v); cerrarCampana(); }} />
              </Box>
            </ScopeGestion>
          ) : loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={20} /></Box>
          ) : (() => {
            const hayEquipo = merged.some((n) => enSolapa(n, solapa) && deEquipo(n));
            const lista = merged.filter((n) => enSolapa(n, solapa)
              && (solapa === 'cuenta' || quien === 'todas' || !hayEquipo || (quien === 'equipo') === deEquipo(n)));
            if (!lista.length) return <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center', fontSize: 12.5 }}>No hay notificaciones</Typography>;
            return agruparPorDia(lista.map((n) => ({ ...n, creadoEn: n.created_at }))).map((g) => (
              <Box key={g.dia}>
                <Box sx={{ px: 2, pt: 1.25, pb: 0.5, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'text.secondary' }}>{g.dia}</Box>
                {g.items.map((notif) => renderAviso(notif))}
              </Box>
            ));
          })()}
        </Box>
        {solapa !== 'resultados' && solapa !== 'admins' && badgeCount > 0 && (
          <Box sx={{ borderTop: 1, borderColor: 'divider', px: 2, py: 1 }}>
            <Button size="small" startIcon={<CheckIcon />} onClick={markAllUiAsRead} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Marcar como leídas ({badgeCount})
            </Button>
          </Box>
        )}
      </Popover>
      {verFactura && (
        <React.Suspense fallback={null}>
          <ScopeGestion><VerFactura rowId={verFactura.rowId} detalle={verFactura.detalle} onClose={() => setVerFactura(null)} /></ScopeGestion>
        </React.Suspense>
      )}
    </>
  );
}