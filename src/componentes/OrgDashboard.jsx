/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// OrgDashboard.jsx
// Cards de organización — misma estructura que BusinessCard.
// Sync de artículos/insumos SOLO en la card del principal (es global).
// Activar / Editar / Eliminar en cada card.

import React, { useMemo, useState, useRef } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import CircularProgress from '@mui/material/CircularProgress';
import BusinessCreateModal from './BusinessCreateModal';
import { useOrganization } from '../context/OrganizationContext';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { syncArticulos, syncInsumos, isMaxiConfigured } from '@/servicios/syncService';
import { checkNewArticlesAndSuggest, applyAutoGrouping, createNewAgrupacion } from '@/servicios/autoGrouping';
import { useAccess } from '@/context/AccessContext';
import BusinessEditModal from './BusinessEditModal';
import BranchFormModal from './BranchFormModal';
import SyncComprasModal from './SyncComprasModal';
import SettingsIcon from '@mui/icons-material/Settings';
import StoreIcon from '@mui/icons-material/Store';

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
const getPhoto = (b) => toAbsolute(b?.photo_url || getBranding(b)?.cover_url || b?.image_url || '');
const getLogo = (b) => toAbsolute(getBranding(b)?.logo_url || '');

/* ─────────────────────────────────────────────────────── OrgBizCard */
function OrgBizCard({
  biz,
  isPrincipal,
  activeId,
  onSetActive,
  onEdit,
  onEditSucursal,
  onDelete,
  showNotice,
  orgId,
  allLists,
  onListsUpdated,
  rawBranches,
  onBranchesChange,
  canEdit
  = true
}) {
  const isActive = String(activeId) === String(biz.id);

  const [syncingArt, setSyncingArt] = useState(false);
  const [syncingInsumos, setSyncingInsumos] = useState(false);
  const [comprasModalOpen, setComprasModalOpen] = useState(false);
  const [maxiOk, setMaxiOk] = useState(null);
  const syncArtRef = useRef(false);
  const syncInsumosRef = useRef(false);

  const [autoGroupModal, setAutoGroupModal] = useState({ open: false, suggestions: [], loading: false });

  // ── Sucursales de este negocio específico ──
  const sucursales = useMemo(() =>
    (rawBranches || []).filter(b => !b.props?.is_main && String(b.business_id) === String(biz.id)),
    [rawBranches, biz.id]
  );
  const [editingSuc, setEditingSuc] = useState(null);  // null = nueva, objeto = editar
  const [sucModalOpen, setSucModalOpen] = useState(false);
  const [deletingSucId, setDeletingSucId] = useState(null);

 
  React.useEffect(() => {
    if (!isPrincipal) { setMaxiOk(false); return; }
    let alive = true;
    isMaxiConfigured(biz.id)
      .then(ok => { if (alive) setMaxiOk(ok); })
      .catch(() => { if (alive) setMaxiOk(false); });
    return () => { alive = false; };
  }, [biz.id, isPrincipal]);

  const logo = getLogo(biz);
  const photo = getPhoto(biz);
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
          } catch { }
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
      <div className="grid"></div>
      <SyncComprasModal
        open={comprasModalOpen}
        onClose={() => setComprasModalOpen(false)}
        bizId={biz.id}
        onSuccess={(msg) => showNotice?.(msg)}
      />

      <div className="bc-card">
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

        <div className="bc-actions">
          <div className="bc-actions-main">
            {!isActive && (
              <button className="bc-btn bc-btn-outline" onClick={() => onSetActive?.(biz.id)}>
                Activar
              </button>
            )}
            {canEdit && (
              <>
                <button className="bc-btn bc-btn-edit" onClick={() => onEdit?.(biz)}>
                  <EditIcon fontSize="small" /> Editar
                </button>
                {isPrincipal && (
                  <button className="bc-btn bc-btn-outline" onClick={() => onEditSucursal?.(biz)}
                    title="Editar datos de la sucursal principal (independiente del negocio)">
                    <StoreIcon fontSize="small" /> Sucursal
                  </button>
                )}
                <button className="bc-icon bc-icon-danger" title="Eliminar negocio"
                  onClick={e => { try { e.currentTarget.blur(); } catch { } e.stopPropagation(); onDelete?.(biz); }}>
                  <DeleteIcon fontSize="small" />
                </button>
              </>
            )}
          </div>

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

        {/* ── Sucursales ── */}
        {canEdit && (
          <div className="bc-branches-section">
            <div className="bc-branches-header">
              <span className="bc-price-label">
                <StoreIcon style={{ fontSize: 13 }} />
                Sucursales
                {isActive && sucursales.length > 0 && (
                  <span className="bc-branches-count">{sucursales.length}</span>
                )}
              </span>
              {isActive && (
                <button className="bc-btn bc-btn-outline bc-branches-add"
                  onClick={() => { setEditingSuc(null); setSucModalOpen(true); }}
                  title="Agregar sucursal">
                  <AddIcon style={{ fontSize: 14 }} /> Nueva
                </button>
              )}
            </div>

            {!isActive ? (
              <div className="bc-branches-empty">
                Activá este negocio para ver y gestionar sus sucursales
              </div>
            ) : sucursales.length === 0 ? (
              <div className="bc-branches-empty">
                Sin sucursales adicionales —{' '}
                <span className="bc-branches-add-link"
                  onClick={() => { setEditingSuc(null); setSucModalOpen(true); }}>
                  agregar
                </span>
              </div>
            ) : (
              <div className="bc-branches-list">
                {sucursales.map(suc => (
                  <div key={suc.id} className="bc-branch-row">
                    <div className="bc-branch-info">
                      <span className="bc-branch-name">{suc.name || `Sucursal #${suc.id}`}</span>
                      {suc.address?.line1 && (
                        <span className="bc-branch-addr">{suc.address.line1}{suc.address.city ? `, ${suc.address.city}` : ''}</span>
                      )}
                    </div>
                    <div className="bc-branch-actions">
                      <button className="bc-icon" title="Editar sucursal"
                        onClick={() => { setEditingSuc(suc); setSucModalOpen(true); }}>
                        <EditIcon style={{ fontSize: 14 }} />
                      </button>
                      <button className="bc-icon bc-icon-danger" title="Eliminar sucursal"
                        disabled={deletingSucId === suc.id}
                        onClick={async () => {
                          if (!window.confirm(`¿Eliminar la sucursal "${suc.name}"?`)) return;
                          setDeletingSucId(suc.id);
                          try {
                            const { BranchesAPI } = await import('@/servicios/apiBranches');
                            await BranchesAPI.remove(suc.id);
                            showNotice?.(`Sucursal "${suc.name}" eliminada`);
                            onBranchesChange?.();
                          } catch (e) { showNotice?.(`❌ Error: ${e.message}`); }
                          finally { setDeletingSucId(null); }
                        }}>
                        {deletingSucId === suc.id ? <CircularProgress size={12} /> : <DeleteIcon style={{ fontSize: 14 }} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isActive && (
          <BranchFormModal
            open={sucModalOpen}
            onClose={() => setSucModalOpen(false)}
            onSaved={() => { setSucModalOpen(false); showNotice?.('Sucursal guardada'); onBranchesChange?.(); }}
            bizId={biz.id}
            branch={editingSuc}
          />
        )}

        <style>{`
          .bc-branches-section{border-top:1px solid var(--color-border,#e5e7eb);padding-top:10px;display:flex;flex-direction:column;gap:8px;}
          .bc-branches-header{display:flex;align-items:center;justify-content:space-between;}
          .bc-branches-count{display:inline-flex;align-items:center;justify-content:center;background:var(--color-primary,#3b82f6);color:#fff;font-size:10px;font-weight:700;width:16px;height:16px;border-radius:50%;margin-left:4px;}
          .bc-branches-add{padding:4px 8px;font-size:0.75rem;border-radius:7px;}
          .bc-branches-empty{font-size:0.78rem;color:#94a3b8;font-style:italic;}
          .bc-branches-add-link{color:var(--color-primary,#3b82f6);cursor:pointer;font-style:normal;font-weight:600;text-decoration:underline;}
          .bc-branches-list{display:flex;flex-direction:column;gap:4px;}
          .bc-branch-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e8edf2;}
          .bc-branch-info{display:flex;flex-direction:column;min-width:0;flex:1;}
          .bc-branch-name{font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .bc-branch-addr{font-size:0.72rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .bc-branch-actions{display:flex;gap:4px;flex-shrink:0;}
        `}</style>

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
          .bc-price-section{border-top:1px solid var(--color-border,#e5e7eb);padding-top:10px;display:flex;flex-direction:column;gap:6px;}
          .bc-price-label{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;}
          .bc-price-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
          .bc-price-select{border:1px solid var(--color-border,#e5e7eb);border-radius:8px;padding:6px 10px;font-size:0.82rem;font-weight:600;background:var(--color-surface,#fff);color:var(--color-fg,#111827);cursor:pointer;outline:none;transition:border-color .15s;flex:1;min-width:140px;max-width:260px;}
          .bc-price-select:hover:not(:disabled){border-color:var(--color-primary,#0ea5e9);}
          .bc-price-select:disabled{opacity:.6;cursor:default;}
          .bc-price-cfg-btn{padding:6px 10px;font-size:0.78rem;border-radius:8px;white-space:nowrap;flex-shrink:0;}
          .bc-price-discount-badge{display:inline-flex;align-items:center;font-size:11px;font-weight:600;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:2px 8px;width:fit-content;}
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
  const { isOwner } = useAccess() || {};
  const { rawBranches } = useBranch() || {};
  const [showCreate, setShowCreate] = useState(false);
  const [editingBiz, setEditingBiz] = useState(null);
  const [editingMainBranch, setEditingMainBranch] = useState(null);
  const [notice, setNotice] = useState('');
  const [allLists, setAllLists] = useState([]);

  const showNotice = (msg) => setNotice(msg);
  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const principalId = rootBusiness?.id;

  // Si no hay org, construir lista desde los negocios del contexto de Business
  const { items: bizItems } = useBusiness();

  const todosOrdenados = useMemo(() => {
    const base = allBusinesses?.length > 0 ? allBusinesses : (bizItems || []);
    return base.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [allBusinesses, bizItems]);

  if (!organization && (!bizItems || bizItems.length === 0)) return (
    <div style={{ padding: '32px 24px', textAlign: 'center', color: '#94a3b8' }}>
      No hay negocios configurados todavía.
    </div>
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

  if (!organization && todosOrdenados.length === 0) return (
    <div style={{ padding: '32px 24px', textAlign: 'center', color: '#94a3b8' }}>
      No hay negocios configurados todavía.
    </div>
  );

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
              canEdit={!!isOwner}
              isPrincipal={String(biz.id) === String(principalId)}
              activeId={activeBusinessId}
              onSetActive={handleSetActive}
              onEdit={isOwner ? setEditingBiz : null}
              onEditSucursal={isOwner ? (biz) => {
                const mainStored = (rawBranches || []).find(b => b.props?.is_main === true);
                setEditingMainBranch({
                  name: mainStored?.name ?? biz.name ?? '',
                  logo_url: mainStored?.logo_url ?? '',
                  address: mainStored?.address ?? {},
                  contacts: mainStored?.contacts ?? {},
                  props: mainStored?.props ?? { social: {} },
                  isMain: true,
                });
              } : null}
              onDelete={isOwner ? handleDelete : null}
              showNotice={showNotice}
              orgId={organization?.id}
              allLists={allLists}
              onListsUpdated={setAllLists}
              rawBranches={rawBranches}
              onBranchesChange={() => {
                window.dispatchEvent(new CustomEvent('branch:updated'));
              }}
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

      <BranchFormModal
        open={!!editingMainBranch}
        onClose={() => setEditingMainBranch(null)}
        onSaved={() => {
          setEditingMainBranch(null);
          window.dispatchEvent(new CustomEvent('branch:updated'));
        }}
        bizId={Number(principalId)}
        branch={editingMainBranch}
      />

      <BusinessCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreateComplete={async (biz) => {
          setShowCreate(false);
          await refetchBusinesses?.();
          showNotice(`✅ "${biz.name}" creado`);
          window.dispatchEvent(new CustomEvent('business:created', { detail: { id: biz.id } }));
        }}
      />

    </div>
  );
}