/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// OrgDashboard.jsx
// Cards de organización — misma estructura que BusinessCard.
// Sync de artículos/insumos SOLO en la card del principal (es global).
// Activar / Editar / Eliminar en cada card.

import React, { useMemo, useState, useRef } from 'react';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import EditIcon         from '@mui/icons-material/Edit';
import DeleteIcon       from '@mui/icons-material/Delete';
import AutorenewIcon    from '@mui/icons-material/Autorenew';
import Inventory2Icon   from '@mui/icons-material/Inventory2';
import PointOfSaleIcon  from '@mui/icons-material/PointOfSale';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CircularProgress from '@mui/material/CircularProgress';

import { useOrganization }  from '../context/OrganizationContext';
import { useBusiness }      from '@/context/BusinessContext';
import { syncArticulos, syncInsumos, isMaxiConfigured } from '@/servicios/syncService';
import { purchasesSync } from '@/servicios/apiPurchases';
import { checkNewArticlesAndSuggest, applyAutoGrouping, createNewAgrupacion } from '@/servicios/autoGrouping';
import AutoGroupModal    from './AutoGroupModal';
import BusinessEditModal   from './BusinessEditModal';
import SyncComprasModal    from './SyncComprasModal';

/* ─────────────────────────────────────────────────────── helpers */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://lazarilloapp-backend.onrender.com';

const toAbsolute = (u) => {
  const raw = String(u || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  return `${API_BASE}/${raw}`;
};

const getBranding = (b) => b?.branding || b?.props?.branding || {};
const getPhoto    = (b) => toAbsolute(b?.photo_url || getBranding(b)?.cover_url || b?.image_url || '');
const getLogo     = (b) => toAbsolute(getBranding(b)?.logo_url || '');

/* ─────────────────────────────────────────────────────── OrgBizCard */
function OrgBizCard({ biz, isPrincipal, activeId, onSetActive, onEdit, onDelete, showNotice }) {
  const isActive = String(activeId) === String(biz.id);

  const [syncingArt,     setSyncingArt]     = useState(false);
  const [syncingInsumos, setSyncingInsumos] = useState(false);
  const [syncingCompras, setSyncingCompras] = useState(false);
  const [comprasModalOpen, setComprasModalOpen] = useState(false);
  const [maxiOk,         setMaxiOk]         = useState(null); // null=cargando, true/false
  const syncArtRef     = useRef(false);
  const syncInsumosRef = useRef(false);

  const [autoGroupModal, setAutoGroupModal] = useState({ open: false, suggestions: [], loading: false });

  // Chequear Maxi solo si es el principal
  React.useEffect(() => {
    if (!isPrincipal) { setMaxiOk(false); return; }
    let alive = true;
    isMaxiConfigured(biz.id)
      .then(ok  => { if (alive) setMaxiOk(ok); })
      .catch(()  => { if (alive) setMaxiOk(false); });
    return () => { alive = false; };
  }, [biz.id, isPrincipal]);

  /* ── visual ── */
  const logo      = getLogo(biz);
  const photo     = getPhoto(biz);
  const thumbnail = logo || photo;
  const isLogoThumb = !!logo;

  const name = biz.name || biz.nombre || `#${biz.id}`;
  const address = (() => {
    const raw = biz?.address ?? biz?.direccion ?? biz?.props?.address ?? '';
    if (raw && typeof raw === 'object') {
      const { street, calle, number, numero, city, ciudad, line1, line2 } = raw;
      return [street ?? calle ?? line1, number ?? numero, line2, city ?? ciudad].filter(Boolean).join(', ');
    }
    return String(raw || '');
  })();

  /* ── sync handlers ── */
  const handleSyncArticulos = async () => {
    if (syncingArt || syncArtRef.current) return;
    setSyncingArt(true); syncArtRef.current = true;
    try {
      const result = await syncArticulos(biz.id, {
        force: true,
        onProgress: (msg, type) => { if (type === 'success' || type === 'error') showNotice?.(msg); },
      });
      if (result?.ok && !result.cached) {
        window.dispatchEvent(new Event('business:synced'));
        setTimeout(async () => {
          try {
            const suggestions = await checkNewArticlesAndSuggest(biz.id);
            if (suggestions?.length > 0) setAutoGroupModal({ open: true, suggestions, loading: false });
          } catch {}
        }, 1500);
      }
    } catch (e) { showNotice?.(`Error: ${e.message}`); }
    finally { setSyncingArt(false); syncArtRef.current = false; }
  };

  const handleSyncInsumos = async () => {
    if (syncingInsumos || syncInsumosRef.current) return;
    setSyncingInsumos(true); syncInsumosRef.current = true;
    try {
      await syncInsumos(biz.id, {
        force: true,
        onProgress: (msg, type) => { if (type === 'success' || type === 'error') showNotice?.(msg); },
      });
    } catch (e) { showNotice?.(`Error: ${e.message}`); }
    finally { setSyncingInsumos(false); syncInsumosRef.current = false; }
  };

  const handleSyncCompras = () => setComprasModalOpen(true);

  const handleApplyAutoGrouping = async (selections) => {
    setAutoGroupModal(p => ({ ...p, loading: true }));
    try {
      const { httpBiz } = await import('@/servicios/apiBusinesses');
      const { success, failed } = await applyAutoGrouping(selections, httpBiz);
      setAutoGroupModal({ open: false, suggestions: [], loading: false });
      window.dispatchEvent(new Event('agrupaciones:updated'));
      showNotice?.(failed === 0
        ? `✅ ${success} artículo${success !== 1 ? 's' : ''} agrupado${success !== 1 ? 's' : ''} correctamente`
        : `✅ ${success} agrupados, ⚠️ ${failed} fallaron`);
    } catch { setAutoGroupModal(p => ({ ...p, loading: false })); showNotice?.('❌ Error al agrupar'); }
  };

  const handleCreateGroup = async (nombre) => {
    try {
      const id = await createNewAgrupacion(biz.id, nombre);
      window.dispatchEvent(new Event('agrupaciones:updated'));
      return id;
    } catch { showNotice?.('❌ Error al crear agrupación'); throw new Error(); }
  };

  return (
    <>
      <AutoGroupModal
        open={autoGroupModal.open}
        suggestions={autoGroupModal.suggestions}
        onClose={() => setAutoGroupModal({ open: false, suggestions: [], loading: false })}
        onApply={handleApplyAutoGrouping}
        onCreateGroup={handleCreateGroup}
        loading={autoGroupModal.loading}
      />

      <SyncComprasModal
        open={comprasModalOpen}
        onClose={() => setComprasModalOpen(false)}
        bizId={biz.id}
        onSuccess={(msg) => showNotice?.(msg)}
      />

      <div className="bc-card">
        {/* TOP */}
        <div className="bc-top">
          <div className="bc-left">
            <div className="bc-title-row">
              <h4 className="bc-title" title={name}>{name}</h4>
              {isPrincipal && (
                <span className="bc-badge-principal" title="Negocio principal de la organización">
                  Principal
                </span>
              )}
              {isActive && (
                <span className="bc-badge-active" title="Negocio activo">
                  <CheckCircleIcon fontSize="inherit" />
                  Activo
                </span>
              )}
            </div>
            {address && <p className="bc-address" title={address}>{address}</p>}
          </div>

          <div className={`bc-thumb-wrap ${isLogoThumb ? 'logo-mode' : 'photo-mode'}`}>
            {thumbnail ? (
              <img className="bc-thumb" src={thumbnail} alt={name} loading="lazy"
                onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = photo || ''; }} />
            ) : (
              <div className="bc-thumb bc-thumb-fallback" aria-label="thumbnail" />
            )}
          </div>
        </div>

        {/* ACCIONES */}
        <div className="bc-actions">
          <div className="bc-actions-main">
            {!isActive && (
              <button className="bc-btn bc-btn-outline" onClick={() => onSetActive?.(biz.id)}>
                Activar
              </button>
            )}
            <button className="bc-btn bc-btn-edit" onClick={() => onEdit?.(biz)}>
              <EditIcon fontSize="small" /> Editar
            </button>
            <button className="bc-icon bc-icon-danger" title="Eliminar negocio"
              onClick={e => { try { e.currentTarget.blur(); } catch {} e.stopPropagation(); onDelete?.(biz); }}>
              <DeleteIcon fontSize="small" />
            </button>
          </div>

          {/* SYNC — solo principal */}
          {isPrincipal && (
            <div className="bc-actions-sync">
              <button className="bc-btn bc-btn-outline" onClick={handleSyncArticulos}
                disabled={syncingArt} title="Sincronizar catálogo / artículos">
                {syncingArt ? <CircularProgress size={16} /> : <AutorenewIcon fontSize="small" />}
                {syncingArt ? ' Artículos…' : ' Artículos'}
              </button>

              {maxiOk === null && (
                <button className="bc-btn bc-btn-outline" disabled style={{ opacity: 0.5 }}>
                  <CircularProgress size={16} /> Verificando…
                </button>
              )}
              {maxiOk === true && (
                <button className="bc-btn bc-btn-outline" onClick={handleSyncInsumos}
                  disabled={syncingInsumos} title="Sincronizar insumos desde Maxi">
                  {syncingInsumos ? <CircularProgress size={16} /> : <Inventory2Icon fontSize="small" />}
                  {syncingInsumos ? ' Insumos…' : ' Insumos'}
                </button>
              )}
              {/* {maxiOk === true && (
                <button className="bc-btn bc-btn-outline" onClick={handleSyncCompras}
                  disabled={syncingCompras} title="Sincronizar compras del mes actual desde Maxi">
                  {syncingCompras ? <CircularProgress size={16} /> : <ShoppingCartIcon fontSize="small" />}
                  {syncingCompras ? ' Compras…' : ' Compras'}
                </button>
              )} */}
              {maxiOk === false && (
                <button className="bc-btn bc-btn-outline" disabled
                  title="Configurá Maxi para habilitar la sincronización"
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  <PointOfSaleIcon fontSize="small" /> Maxi no configurado
                </button>
              )}
            </div>
          )}
        </div>

        <style>{`
          .bc-card{background:var(--color-surface,#fff);border:1px solid var(--color-border,#e5e7eb);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;}
          .bc-top{display:flex;gap:16px;}
          .bc-left{flex:1;min-width:0;}
          .bc-title-row{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;}
          .bc-title{margin:0;font-weight:700;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .bc-badge-active{display:inline-flex;align-items:center;gap:4px;background:color-mix(in srgb,var(--color-primary,#34d399) 18%,white);color:#166534;font-weight:700;padding:2px 8px;border-radius:999px;font-size:12px;}
          .bc-badge-principal{display:inline-flex;align-items:center;background:#f0f9ff;color:#0369a1;font-weight:700;padding:2px 8px;border-radius:999px;font-size:11px;border:1px solid #bae6fd;}
          .bc-address{margin:.125rem 0 0 0;color:#6b7280;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .bc-thumb-wrap{width:180px;aspect-ratio:16/9;border-radius:12px;overflow:hidden;flex-shrink:0;border:1px solid var(--color-border,#e5e7eb);background:#f3f4f6;display:block;position:relative;}
          .bc-thumb{width:100%;height:100%;display:block;}
          .bc-thumb-wrap.logo-mode{background:#fff;}
          .bc-thumb-wrap.logo-mode .bc-thumb{object-fit:contain;padding:6px;}
          .bc-thumb-wrap.photo-mode .bc-thumb{object-fit:cover;}
          .bc-thumb-fallback{background:linear-gradient(135deg,#f3f4f6,#e5e7eb);}
          .bc-actions{display:flex;flex-direction:column;gap:6px;}
          .bc-actions-main{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;}
          .bc-actions-sync{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;}
          .bc-btn{border:0;border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer;transition:filter .15s,background .15s;display:inline-flex;align-items:center;gap:6px;font-size:14px;}
          .bc-btn:disabled{opacity:.6;cursor:default;}
          .bc-btn-edit{background:var(--color-primary,#0ea5e9);color:var(--on-primary,#fff);box-shadow:0 1px 0 rgba(0,0,0,.06) inset;}
          .bc-btn-edit:hover:not(:disabled){filter:brightness(.96);}
          .bc-btn-outline{border:1px solid var(--color-border,#e5e7eb);background:var(--color-surface,#fff);color:var(--color-fg,#111827);}
          .bc-btn-outline:hover:not(:disabled){background:var(--color-surface-hover,#f9fafb);}
          .bc-icon{width:40px;height:40px;border-radius:10px;background:#fff;border:1px solid var(--color-border,#e5e7eb);display:grid;place-items:center;cursor:pointer;}
          .bc-icon-danger{color:#e11d48;}
          .bc-icon-danger:hover{background:#fff1f2;border-color:#fecdd3;}
          @media(max-width:720px){.bc-thumb-wrap{width:140px;}}
        `}</style>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────── OrgDashboard */
export default function OrgDashboard({ compact = false, onSelectBusiness }) {
  const { organization, allBusinesses, rootBusiness } = useOrganization();
  const { activeBusinessId, selectBusiness, refetchBusinesses } = useBusiness();

  const [editingBiz, setEditingBiz] = useState(null);
  const [notice,     setNotice]     = useState('');

  const showNotice = (msg) => setNotice(msg);
  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const principalId = rootBusiness?.id;

  const todosOrdenados = useMemo(() =>
    (allBusinesses || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [allBusinesses]
  );

  const handleSetActive = async (bizId) => {
    try {
      await selectBusiness?.(bizId);
      onSelectBusiness?.({ id: bizId });
    } catch (e) { console.error('[OrgDashboard] Error activando:', e); }
  };

  const handleDelete = async (biz) => {
    const ok = window.confirm(`¿Eliminar el local "${biz.name}"?\nEsta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      const { BusinessesAPI } = await import('@/servicios/apiBusinesses');
      await BusinessesAPI.remove(biz.id);
      await refetchBusinesses?.();
      showNotice(`🗑️ "${biz.name}" eliminado`);
      window.dispatchEvent(new CustomEvent('business:deleted', { detail: { id: biz.id } }));
    } catch (e) { showNotice(`❌ No se pudo eliminar: ${e.message}`); }
  };

  if (!organization) return null;

  return (
    <div style={{ padding: compact ? 0 : '32px 24px', maxWidth: compact ? '100%' : 1100, margin: compact ? 0 : '0 auto' }}>
      {notice && (
        <div style={{
          marginBottom: 12, padding: '10px 16px', borderRadius: 10,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          fontSize: 13, fontWeight: 600, color: '#166534',
        }}>
          {notice}
        </div>
      )}

      {todosOrdenados.length === 0 ? (
        <div style={{ padding: '40px 0', color: '#aaa', textAlign: 'center' }}>
          No hay negocios en esta organización.
        </div>
      ) : (
        <div className="grid">
          {todosOrdenados.map((biz) => (
            <OrgBizCard
              key={biz.id}
              biz={biz}
              isPrincipal={String(biz.id) === String(principalId)}
              activeId={activeBusinessId}
              onSetActive={handleSetActive}
              onEdit={setEditingBiz}
              onDelete={handleDelete}
              showNotice={showNotice}
            />
          ))}
        </div>
      )}

      <BusinessEditModal
        open={!!editingBiz}
        business={editingBiz}
        onClose={() => setEditingBiz(null)}
        onSaved={async () => {
          setEditingBiz(null);
          await refetchBusinesses?.();
          window.dispatchEvent(new Event('business:updated'));
        }}
      />
    </div>
  );
}