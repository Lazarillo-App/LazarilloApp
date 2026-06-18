/* eslint-disable react-refresh/only-export-components */
/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/paginas/ConfiguracionMain.jsx
// Shell liviano — la lógica de cada tab vive en su propio componente
import React, { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { useSearchParams } from 'react-router-dom';
import { syncAll, isMaxiConfigured } from '@/servicios/syncService';
import { ensureTodo } from '../servicios/apiAgrupacionesTodo';
import {
  Box, Stack, Typography, Tabs, Tab, Snackbar, Alert,
  CircularProgress, FormControl, InputLabel, Select, MenuItem,
  Button, Grid, Avatar, Chip, Paper, Skeleton, IconButton, Tooltip,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PublicIcon from '@mui/icons-material/Public';
import BusinessIcon from '@mui/icons-material/Business';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import { useActiveBusiness, useBusiness } from '../context/BusinessContext';
import { BusinessesAPI, RecetasAPI, PriceConfigAPI } from '../servicios/apiBusinesses';
import { BASE } from '../servicios/apiBase';
import { getRedondeoConfig, saveRedondeoConfig } from '../utils/redondeoUtils';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import SyncDialog from '../componentes/SyncDialog';
import OrgDashboard from '../componentes/OrgDashboard';
import BusinessCard from '../componentes/BusinessCard';
import SucursalesSection from '../componentes/SucursalesSection';
import RecetaModal from '../componentes/RecetaModal';
import UploadInsumosModal from '../componentes/UploadInsumosModal';
import UploadArticulosModal from '../componentes/UploadArticulosModal';
import { useAccess } from '@/context/AccessContext';
// Sub-tabs extraídos
import ConfigArticulosTab from '../componentes/configuracion/ConfigArticulosTab';
import ConfigInsumosTab from '../componentes/configuracion/ConfigInsumosTab';
import { TabPanel, SectionCard } from '../componentes/configuracion/configHelpers';
import { ArticuloNuevoModal, InsumoNuevoModal } from '../componentes/configuracion/ABMModals';
import '../css/global.css';
import '../css/theme-layout.css';

export { getRedondeoConfig, saveRedondeoConfig };

export default function ConfiguracionMain() {
  const { businessId } = useActiveBusiness();
  const { isOwner } = useAccess() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const themeColor = 'var(--color-primary, #3b82f6)';

  // ── Tabs ──
  const [tab, setTab] = useState(() => {
    const t = Number(searchParams.get('tab'));
    return Number.isFinite(t) && t >= 0 && t <= 3 ? t : 0;
  });
  const [subTabArt, setSubTabArt] = useState(0);
  const [subTabIns, setSubTabIns] = useState(0);

  // ── Config global ──
  const [config, setConfig] = useState({
    articulos_costo_ideal: '', insumos_costo_ideal: '',
    compras_alerta_semanas: '', ventas_alerta_dias: '',
    divisa: '', precio_costeo_insumos: 'ultima_compra', redondeo_precios: null,
  });
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });

  // ── Modales ABM ──
  const [showNuevoArticulo, setShowNuevoArticulo] = useState(false);
  const [showNuevoInsumo, setShowNuevoInsumo] = useState(false);
  const [showUploadInsumos, setShowUploadInsumos] = useState(false);
  const [showUploadArticulos, setShowUploadArticulos] = useState(false);

  // ── Alertas insumos ──
  const [alertasInsumos, setAlertasInsumos] = useState([]);
  const [alertasLoading, setAlertasLoading] = useState(false);
  const [alertasTotal, setAlertasTotal] = useState(0);
  const [alertaExpanded, setAlertaExpanded] = useState(null);
  const [recetaModalData, setRecetaModalData] = useState(null);

  // ── Org ──
  const { organization, allBusinesses } = useOrganization() || {};
  const {
    removeBusinessFromState, loading: businessesLoading,
    activeId, selectBusiness, items, active, refetchBusinesses,
  } = useBusiness() || {};
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState({ open: false, title: '', message: '' });
  const showNotice = (title, message) => setNotice({ open: true, title, message });
  const closeNotice = () => setNotice(s => ({ ...s, open: false }));

  const notify = useCallback((msg, sev = 'success') => {
    setSnack({ open: true, msg, sev });
    setTimeout(() => setSnack(s => ({ ...s, open: false })), 3500);
  }, []);

  // ── Cargar configuración ──
  useEffect(() => {
    if (!businessId) return;
    setConfigLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`${BASE}/businesses/${businessId}/config`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
        });
        const d = await res.json().catch(() => ({}));
        const cfg = d?.config || {};
        const localRedondeo = getRedondeoConfig(businessId);
        setConfig({
          articulos_costo_ideal: String(cfg.articulos_costo_ideal ?? ''),
          insumos_costo_ideal: String(cfg.insumos_costo_ideal ?? ''),
          compras_alerta_semanas: String(cfg.compras_alerta_semanas ?? ''),
          ventas_alerta_dias: String(cfg.ventas_alerta_dias ?? ''),
          divisa: String(cfg.divisa ?? ''),
          precio_costeo_insumos: cfg.precio_costeo_insumos || 'ultima_compra',
          // Si DB devuelve null, usar localStorage como fallback
          redondeo_precios: cfg.redondeo_precios ?? localRedondeo?.valor ?? null,
          redondeo_mostrar_modal: cfg.redondeo_mostrar_modal ?? localRedondeo?.mostrarModal ?? true,
        });
        if (cfg.redondeo_precios !== undefined) {
          const local = getRedondeoConfig(businessId);
          // Siempre sincronizar el valor de DB al localStorage,
          // preservando la preferencia de mostrarModal del usuario
          saveRedondeoConfig(businessId, cfg.redondeo_precios, local?.mostrarModal ?? true);
        }
      } catch { /* silencioso */ }
      finally { setConfigLoading(false); }
    })();
  }, [businessId]);

  useEffect(() => {
    const onConfigUpdated = (e) => {
      const { key, value } = e?.detail || {};
      if (key === 'redondeo_precios') {
        setConfig(c => ({ ...c, redondeo_precios: value }));
      }
      if (key === 'redondeo_mostrar_modal') {
        setConfig(c => ({ ...c, redondeo_mostrar_modal: value }));
      }
    };
    window.addEventListener('config:updated', onConfigUpdated);
    return () => window.removeEventListener('config:updated', onConfigUpdated);
  }, []);

  // ── Undo de costo_ideal desde notificaciones ──
  React.useEffect(() => {
    const onUndo = async (e) => {
      const d = e?.detail;
      if (d?.kind !== 'objetivo_change' || !d?.undo?.configKey) return;
      const { configKey, val } = d.undo;
      if (!['articulos_costo_ideal', 'insumos_costo_ideal'].includes(configKey)) return;
      try {
        await BusinessesAPI.update(businessId, { props: { [configKey]: val ?? null } });
        setConfig(c => ({ ...c, [configKey]: val != null ? String(val) : '' }));
        notify(`Costo ideal restaurado${val != null ? ` a ${val}%` : ' (sin valor)'}`);
      } catch (e) { notify('Error al deshacer: ' + e.message, 'error'); }
    };
    window.addEventListener('ui:undo', onUndo);
    return () => window.removeEventListener('ui:undo', onUndo);
  }, [businessId, notify]);

  useEffect(() => {
    if (tab !== 1 || subTabIns !== 0 || !businessId) return;
    setAlertasLoading(true);
    RecetasAPI.getAlertas(Number(businessId))
      .then(res => { setAlertasInsumos(res?.insumos || []); setAlertasTotal(res?.total || 0); })
      .catch(() => setAlertasInsumos([]))
      .finally(() => setAlertasLoading(false));
  }, [tab, subTabIns, businessId]);

  // ── Guardar config ──
  const saveConfig = useCallback(async (key) => {
    if (!businessId) return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const token = localStorage.getItem('token') || '';
      const prevRes = await fetch(`${BASE}/businesses/${businessId}/config`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      }).then(r => r.json()).catch(() => ({}));
      const valAnterior = prevRes?.config?.[key] ?? null;

      await BusinessesAPI.update(businessId, { props: { [key]: Number(config[key]) } });

      // Si es costo_ideal de artículos → limpiar todos los overrides de objetivo
      // para que el global sea el único valor vigente en toda la tabla
      if (key === 'articulos_costo_ideal') {
        await PriceConfigAPI.save(businessId, {
          scope: 'global',
          pisarTodo: true,
        }).catch(e => console.warn('[saveConfig] No se pudieron limpiar overrides:', e.message));
      }
      // Si es costo_ideal de insumos → propagar a todos los insumos elaborados
      // (el porcentajeVenta guardado en cada receta elaborada se actualiza)
      if (key === 'insumos_costo_ideal') {
        const token = localStorage.getItem('token') || '';
        await fetch(`${BASE}/businesses/${businessId}/recetas-elaborados/reset-objetivo`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ porcentajeVenta: Number(config[key]) }),
        }).catch(e => console.warn('[saveConfig] No se pudo propagar objetivo elaborados:', e.message));
      }

      notify('Configuración guardada — objetivo aplicado a todos los artículos');

      if (key === 'articulos_costo_ideal' || key === 'insumos_costo_ideal') {
        const isArticulos = key === 'articulos_costo_ideal';
        window.dispatchEvent(new CustomEvent('ui:action', {
          detail: {
            kind: 'objetivo_change',
            title: `🎯 Costo ideal global ${config[key]}% (${isArticulos ? 'artículos' : 'insumos'})`,
            message: `Objetivo global actualizado${valAnterior != null ? ` (antes: ${valAnterior}%)` : ''}. Todos los overrides limpiados.`,
            createdAt: new Date().toISOString(),
            undoable: true,
            payload: { configKey: key, val: Number(config[key]), valAnterior, businessId },
            undo: { configKey: key, val: valAnterior, businessId },
          },
        }));
      }

      window.dispatchEvent(new CustomEvent('config:updated', { detail: { key, value: Number(config[key]) } }));
    } catch (e) {
      notify('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }, [businessId, config, notify]);

  const handleToggleMostrarModal = useCallback(async (mostrar) => {
    setConfig(c => ({ ...c, redondeo_mostrar_modal: mostrar }));
    try {
      await BusinessesAPI.update(businessId, { props: { redondeo_mostrar_modal: mostrar } });
      saveRedondeoConfig(businessId, config.redondeo_precios, mostrar);
      window.dispatchEvent(new CustomEvent('config:updated', {
        detail: { key: 'redondeo_mostrar_modal', value: mostrar }
      }));
    } catch (e) { notify('Error al guardar preferencia', 'error'); }
  }, [businessId, config.redondeo_precios, notify]);

  const saveConfigCosteo = useCallback(async () => {
    if (!businessId) return;
    setSaving(s => ({ ...s, precio_costeo: true }));
    try {
      const token = localStorage.getItem('token') || '';
      await fetch(`${BASE}/businesses/${businessId}/config-costeo`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId), 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: config.precio_costeo_insumos }),
      });
      notify('Configuración de precio de costeo guardada');
      window.dispatchEvent(new CustomEvent('config:costeo:changed', { detail: { modo: config.precio_costeo_insumos } }));
    } catch (e) {
      notify('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      setSaving(s => ({ ...s, precio_costeo: false }));
    }
  }, [businessId, config.precio_costeo_insumos, notify]);

  const saveRedondeo = useCallback(async () => {
    if (!businessId) return;
    setSaving(s => ({ ...s, redondeo: true }));
    try {
      await BusinessesAPI.update(businessId, {
        props: {
          redondeo_precios: config.redondeo_precios,
          redondeo_mostrar_modal: config.redondeo_mostrar_modal ?? true,
        }
      });
      saveRedondeoConfig(businessId, config.redondeo_precios, config.redondeo_mostrar_modal ?? true);

      // ← agregar estos dos dispatches
      window.dispatchEvent(new CustomEvent('config:updated', {
        detail: { key: 'redondeo_precios', value: config.redondeo_precios }
      }));
      window.dispatchEvent(new CustomEvent('config:updated', {
        detail: { key: 'redondeo_mostrar_modal', value: config.redondeo_mostrar_modal ?? true }
      }));

      notify(config.redondeo_precios ? `Redondeo a $${config.redondeo_precios} guardado` : 'Redondeo desactivado');
    } catch (e) {
      notify('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      setSaving(s => ({ ...s, redondeo: false }));
    }
  }, [businessId, config.redondeo_precios, config.redondeo_mostrar_modal, notify]);

  // ── Equivalencias (abre UploadInsumosModal con tipo) ──
  const abrirEquivalencias = useCallback((tipo) => {
    if (tipo === 'insumos') setShowUploadInsumos(true);
    if (tipo === 'articulos') setShowUploadArticulos(true);
    if (tipo === 'ventas') setShowUploadArticulos(true); // TODO: modal ventas
    if (tipo === 'compras') setShowUploadInsumos(true);  // TODO: modal compras
  }, []);

  // ── Org helpers ──
  const activeBiz = active || null;
  const list = Array.isArray(items) ? items : [];
  const orgBizIds = new Set((allBusinesses || []).map(b => String(b.id)));
  const outsideOrg = organization && orgBizIds.size > 1 ? list.filter(b => !orgBizIds.has(String(b.id))) : list;

  const onCreateComplete = async (biz) => {
    setShowCreate(false);
    const bizId = Number(biz?.id);
    if (!Number.isFinite(bizId) || bizId <= 0) { await refetchBusinesses?.(); return; }
    await refetchBusinesses?.();
    if (biz.created_from !== 'from_group') {
      try {
        const maxiOk = await isMaxiConfigured(bizId);
        if (maxiOk) {
          showNotice('Sincronizando datos', 'Iniciando sincronización automática…');
          const result = await syncAll(bizId, { onProgress: () => { } });
          if (result?.ok) {
            showNotice('Sincronización completa', 'Artículos e insumos sincronizados correctamente');
            try { await ensureTodo(bizId); } catch { }
          }
        } else {
          showNotice('Negocio creado', 'Configurá las credenciales de Maxi para habilitar la sincronización automática');
        }
      } catch { showNotice('Error', 'No se pudo completar la sincronización automática'); }
    } else {
      showNotice('Sub-negocio creado', `"${biz.name}" fue creado correctamente.`);
    }
    try { window.dispatchEvent(new CustomEvent('business:created', { detail: { id: bizId } })); } catch { }
  };

  const handleDeleteBusiness = async (biz) => {
    const id = biz?.id;
    if (!id) return;
    const name = biz?.name || `#${id}`;
    if (!window.confirm(`¿Eliminar el local "${name}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      const isActive = Number(activeId) === Number(id);
      await BusinessesAPI.remove(id);
      removeBusinessFromState?.(id);
      if (isActive) {
        const businesses = await BusinessesAPI.listMine();
        if (businesses?.length > 0) {
          await BusinessesAPI.setActive(businesses[0].id);
          window.dispatchEvent(new CustomEvent('business:switched', { detail: { bizId: businesses[0].id } }));
          showNotice('Listo', `Local eliminado. Ahora activo: "${businesses[0].name}"`);
        } else {
          localStorage.removeItem('activeBusinessId');
          await selectBusiness?.(null);
          showNotice('Listo', 'Local eliminado.');
        }
      } else {
        showNotice('Listo', `Local "${name}" eliminado`);
      }
      await refetchBusinesses?.();
      window.dispatchEvent(new CustomEvent('business:deleted', { detail: { id } }));
    } catch (e) {
      showNotice('Error', e?.message || 'No se pudo eliminar el local');
    }
  };

  // ── RENDER ──
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 } }}>

      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <TuneIcon sx={{ color: themeColor, fontSize: 26 }} />
        <Typography variant="h5" fontWeight={800}>Configuración</Typography>
      </Stack>

      {configLoading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" mt={1}>Cargando configuración…</Typography>
        </Stack>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setSearchParams({}, { replace: true }); }}
            sx={{
              borderBottom: 1, borderColor: 'divider',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 44 },
              '& .Mui-selected': { color: themeColor },
              '& .MuiTabs-indicator': { bgcolor: themeColor },
            }}
          >
            <Tab icon={<RestaurantMenuIcon fontSize="small" />} iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  Artículos y ventas
                </Box>
              } />
            <Tab icon={<ShoppingCartIcon fontSize="small" />} iconPosition="start" label="Insumos y compras" />
            <Tab icon={<PublicIcon fontSize="small" />} iconPosition="start" label="General" />
            <Tab icon={<BusinessIcon fontSize="small" />} iconPosition="start" label="Organización" />
          </Tabs>

          {/* TAB 0 — ARTÍCULOS Y VENTAS */}
          <TabPanel value={tab} index={0}>
            <ConfigArticulosTab
              subTab={subTabArt} setSubTab={setSubTabArt}
              config={config} setConfig={setConfig}
              saving={saving}
              saveConfig={saveConfig}
              saveRedondeo={saveRedondeo}
              allBusinesses={allBusinesses}
              businessId={businessId}
              onNuevoArticulo={() => setShowNuevoArticulo(true)}
              onUploadArticulos={() => setShowUploadArticulos(true)}
              abrirEquivalencias={abrirEquivalencias}
              themeColor={themeColor}
              mostrarModalRedondeo={config.redondeo_mostrar_modal ?? true}
              onToggleMostrarModal={handleToggleMostrarModal}
            />
          </TabPanel>

          {/* TAB 1 — INSUMOS Y COMPRAS */}
          <TabPanel value={tab} index={1}>
            <ConfigInsumosTab
              subTab={subTabIns} setSubTab={setSubTabIns}
              config={config} setConfig={setConfig}
              saving={saving}
              saveConfig={saveConfig}
              saveConfigCosteo={saveConfigCosteo}
              businessId={businessId}
              allBusinesses={allBusinesses}
              alertasInsumos={alertasInsumos}
              alertasLoading={alertasLoading}
              alertasTotal={alertasTotal}
              alertaExpanded={alertaExpanded}
              setAlertaExpanded={setAlertaExpanded}
              setAlertasLoading={setAlertasLoading}
              setAlertasInsumos={setAlertasInsumos}
              setAlertasTotal={setAlertasTotal}
              onNuevoInsumo={() => setShowNuevoInsumo(true)}
              onUploadInsumos={() => setShowUploadInsumos(true)}
              onOpenReceta={rec => setRecetaModalData({ id: rec.articleId, nombre: rec.nombre })}
              abrirEquivalencias={abrirEquivalencias}
              RecetasAPI={RecetasAPI}
              themeColor={themeColor}
            />
          </TabPanel>

          {/* TAB 2 — GENERAL */}
          <TabPanel value={tab} index={2}>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard icon={<PublicIcon />} title="Moneda del negocio" accent>
                  <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                      Define la moneda principal de este negocio. Impacta en precios, reportes y cálculos.
                    </Typography>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <FormControl size="small" sx={{ width: 200 }}>
                        <InputLabel>Moneda</InputLabel>
                        <Select value={config.divisa || ''} label="Moneda"
                          onChange={e => setConfig(c => ({ ...c, divisa: e.target.value }))}>
                          {[
                            { code: 'ARS', label: 'ARS — Peso argentino' },
                            { code: 'USD', label: 'USD — Dólar' },
                            { code: 'EUR', label: 'EUR — Euro' },
                            { code: 'BRL', label: 'BRL — Real brasileño' },
                            { code: 'CLP', label: 'CLP — Peso chileno' },
                            { code: 'PEN', label: 'PEN — Sol peruano' },
                            { code: 'UYU', label: 'UYU — Peso uruguayo' },
                            { code: 'MXN', label: 'MXN — Peso mexicano' },
                            { code: 'COP', label: 'COP — Peso colombiano' },
                          ].map(({ code, label }) => (
                            <MenuItem key={code} value={code}>{label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button variant="contained" size="small"
                        startIcon={saving.divisa ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                        disabled={!!saving.divisa}
                        onClick={async () => {
                          if (!config.divisa) return;
                          setSaving(s => ({ ...s, divisa: true }));
                          try {
                            await BusinessesAPI.update(businessId, { props: { divisa: config.divisa } });
                            window.dispatchEvent(new CustomEvent('config:divisa:changed', { detail: { divisa: config.divisa, businessId } }));
                            notify('Moneda guardada');
                          } catch (e) {
                            notify('Error: ' + (e.message || e), 'error');
                          } finally {
                            setSaving(s => ({ ...s, divisa: false }));
                          }
                        }}
                        sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
                        {saving.divisa ? 'Guardando…' : 'Guardar'}
                      </Button>
                    </Stack>
                  </Stack>
                </SectionCard>
              </Grid>
            </Grid>
          </TabPanel>

          {/* TAB 3 — ORGANIZACIÓN */}
          <TabPanel value={tab} index={3}>
            {(() => {
              const me = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null') || {}; } catch { return {}; } })();
              const meName = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.name || 'Usuario';
              const userInitials = meName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
              const orgBizIds = new Set((allBusinesses || []).map(b => String(b.id)));
              const outsideOrg = organization && orgBizIds.size > 1
                ? (items || []).filter(b => !orgBizIds.has(String(b.id)))
                : (items || []);

              return (
                <Box sx={{ maxWidth: 900, mx: 'auto' }}>
                  {isOwner && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                      <button
                        onClick={() => setShowCreate(true)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '10px 18px', borderRadius: 10, border: 'none',
                          background: 'var(--color-primary, #3b82f6)',
                          color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                        }}>
                        + Nuevo negocio
                      </button>
                    </div>
                  )}

                  {/* ── Organización con sus negocios ── */}
                  {organization && (allBusinesses || []).length > 1 && (
                    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
                      <Stack direction="row" alignItems="center" spacing={1}
                        sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <BusinessIcon sx={{ color: themeColor, fontSize: 18 }} />
                        <Typography variant="subtitle2" fontWeight={700}>
                          Mi organización — {organization.name || 'Sin nombre'}
                        </Typography>
                      </Stack>
                      <Box sx={{ p: 2 }}>
                        <OrgDashboard compact onSelectBusiness={async (biz) => {
                          try { await selectBusiness?.(biz.id); } catch { }
                        }} />
                      </Box>
                    </Paper>
                  )}

                  {/* ── Mis locales (fuera de org) ── */}
                  {!(outsideOrg.length === 0 && organization && orgBizIds.size > 1) && (
                    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between"
                        sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <BusinessIcon sx={{ color: themeColor, fontSize: 18 }} />
                          <Typography variant="subtitle2" fontWeight={700}>Mis locales</Typography>
                          {outsideOrg.length > 0 && (
                            <Chip size="small" label={outsideOrg.length}
                              sx={{ fontSize: '0.65rem', height: 18, bgcolor: `${themeColor}18`, color: themeColor, fontWeight: 700 }} />
                          )}
                        </Stack>
                      </Stack>
                      <Box sx={{ p: 2 }}>
                        {businessesLoading ? (
                          <Stack spacing={1.5}>{[1, 2].map(n => <Skeleton key={n} variant="rounded" height={80} />)}</Stack>
                        ) : outsideOrg.length === 0 ? (
                          <Box sx={{ border: '1px dashed #e5e7eb', borderRadius: 2, p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">Aún no tenés locales. Creá el primero.</Typography>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                            {outsideOrg.map(biz => (
                              <BusinessCard key={biz.id} biz={biz} activeId={activeId}
                                onSetActive={async (id) => { await selectBusiness?.(id); }}
                                onEdit={isOwner ? setEditing : null}
                                onDelete={isOwner ? handleDeleteBusiness : null}
                                canEdit={isOwner}
                                showNotice={(msg) => showNotice('Aviso', msg)} />
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  )}

                  {/* ── Sucursales ── */}
                  {activeId && isOwner && (
                    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
                      <Stack direction="row" alignItems="center" spacing={1}
                        sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <BusinessIcon sx={{ color: themeColor, fontSize: 18 }} />
                        <Typography variant="subtitle2" fontWeight={700}>
                          Sucursales
                          {active?.name && (
                            <Typography component="span" variant="caption" color="text.secondary" ml={0.75}>
                              de {active.name}
                            </Typography>
                          )}
                        </Typography>
                      </Stack>
                      <Box sx={{ p: 2 }}>
                        <SucursalesSection />
                      </Box>
                    </Paper>
                  )}

                </Box>
              );
            })()}
          </TabPanel>
        </>
      )}

      {/* ── Snackbar ── */}
      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* ── Modales ── */}
      <BusinessCreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreateComplete={onCreateComplete} />
      <BusinessEditModal
        open={!!editing} business={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refetchBusinesses?.();
          try { window.dispatchEvent(new Event('business:updated')); } catch { }
        }}
      />
      <SyncDialog open={notice.open} title={notice.title} message={notice.message} onClose={closeNotice} />

      <UploadInsumosModal
        open={showUploadInsumos}
        onClose={() => setShowUploadInsumos(false)}
        businessId={businessId}
        tipo="insumos"
        onSuccess={() => { setShowUploadInsumos(false); notify('Insumos importados correctamente'); setSubTabIns(2); }}
      />

      <UploadArticulosModal
        open={showUploadArticulos}
        onClose={() => setShowUploadArticulos(false)}
        businessId={businessId}
        onSuccess={() => { notify('Importación completada'); window.dispatchEvent(new CustomEvent('articulos:updated')); }}
      />

      <InsumoNuevoModal
        open={showNuevoInsumo}
        onClose={() => setShowNuevoInsumo(false)}
        businessId={businessId}
        onCreated={ins => { notify(`Insumo "${ins.nombre}" creado — SKU: ${ins.codigo_maxi}`); window.dispatchEvent(new CustomEvent('insumos:updated')); }}
      />

      <ArticuloNuevoModal
        open={showNuevoArticulo}
        onClose={() => setShowNuevoArticulo(false)}
        businessId={businessId}
        onCreated={art => { notify(`Artículo "${art.name}" creado con SKU provisorio`); window.dispatchEvent(new CustomEvent('articulos:updated')); }}
      />

      {recetaModalData && (
        <RecetaModal
          open={true}
          onClose={() => setRecetaModalData(null)}
          articulo={recetaModalData}
          businessId={businessId}
          recetasElaborados={{}}
          onSaved={() => setRecetaModalData(null)}
        />
      )}
    </Box>
  );
}