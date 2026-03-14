/* eslint-disable no-empty */
import { showAlert } from '../servicios/appAlert';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { syncAll, isMaxiConfigured } from '@/servicios/syncService';

import BusinessCard         from '../componentes/BusinessCard';
import BusinessCreateModal  from '../componentes/BusinessCreateModal';
import BusinessEditModal    from '../componentes/BusinessEditModal';
import SyncDialog           from '../componentes/SyncDialog';
import OrgDashboard         from '../componentes/OrgDashboard';
import UploadInsumosModal   from '../componentes/UploadInsumosModal';
import UploadArticulosModal from '../componentes/UploadArticulosModal';
import RecetasImportModal   from '../componentes/RecetasImportModal';

import { BusinessesAPI }   from "@/servicios/apiBusinesses";
import { useBusiness }     from '@/context/BusinessContext';
import { useOrganization } from '@/context/OrganizationContext';

import Inventory2Icon   from '@mui/icons-material/Inventory2';
import PointOfSaleIcon  from '@mui/icons-material/PointOfSale';
import MenuBookIcon     from '@mui/icons-material/MenuBook';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// ─── Panel de importación de datos ───────────────────────────────────────────
function ImportDataPanel({ businessId, onSuccess }) {
  const [uploadInsumosOpen,   setUploadInsumosOpen]   = useState(false);
  const [uploadArticulosOpen, setUploadArticulosOpen] = useState(false);
  const [recetasImportOpen,   setRecetasImportOpen]   = useState(false);

  if (!businessId) return null;

  const cards = [
    {
      icon:        <PointOfSaleIcon sx={{ fontSize: 36, color: 'var(--color-primary, #1976d2)' }} />,
      titulo:      'Importar Artículos',
      descripcion: 'Completar el catálogo de artículos cuando MaxiRest no devuelve todos los datos.',
      detalle:     'Exportá el listado de artículos desde MaxiRest → Excel y subilo acá. Solo agrega y actualiza — nunca borra.',
      accion:      'Subir archivo de artículos',
      onClick:     () => setUploadArticulosOpen(true),
    },
    {
      icon:        <Inventory2Icon sx={{ fontSize: 36, color: 'var(--color-primary, #1976d2)' }} />,
      titulo:      'Importar Insumos',
      descripcion: 'Completar el catálogo de insumos cuando MaxiRest no devuelve todos los datos.',
      detalle:     'Exportá el catálogo de insumos desde MaxiRest → Stock → Insumos → Excel y subilo acá. Solo agrega y actualiza — nunca borra.',
      accion:      'Subir archivo de insumos',
      onClick:     () => setUploadInsumosOpen(true),
    },
    {
      icon:        <MenuBookIcon sx={{ fontSize: 36, color: 'var(--color-primary, #1976d2)' }} />,
      titulo:      'Importar Recetas',
      descripcion: 'Sincronizar recetas desde MaxiRest o cargarlas manualmente desde un archivo.',
      detalle:     'Podés hacer sync automático desde MaxiRest o subir un archivo con ingredientes por artículo. Las recetas editadas manualmente no se pisan en syncs posteriores.',
      accion:      'Gestionar recetas',
      onClick:     () => setRecetasImportOpen(true),
    },
  ];

  return (
    <section className="section">
      <h3>Importación de datos</h3>

      <div className="import-notice">
        <InfoOutlinedIcon sx={{ fontSize: 16, flexShrink: 0, marginTop: '1px', color: '#6b7280' }} />
        <span>
          Usá estas opciones para completar el catálogo cuando la sincronización con MaxiRest
          no trae todos los datos. Después de importar, podés correr la sincronización normal
          para que complete los datos faltantes sin generar duplicados.
        </span>
      </div>

      <div className="import-grid">
        {cards.map((card) => (
          <div key={card.titulo} className="import-card">
            <div className="import-card-icon">{card.icon}</div>
            <div className="import-card-body">
              <div className="import-card-title">{card.titulo}</div>
              <div className="import-card-desc">{card.descripcion}</div>
              <div className="import-card-detail">{card.detalle}</div>
            </div>
            <button className="import-card-btn" onClick={card.onClick}>
              {card.accion}
            </button>
          </div>
        ))}
      </div>

      <UploadArticulosModal
        open={uploadArticulosOpen}
        onClose={() => setUploadArticulosOpen(false)}
        businessId={businessId}
        onSuccess={() => {
          setUploadArticulosOpen(false);
          onSuccess?.('articulos');
        }}
      />

      <UploadInsumosModal
        open={uploadInsumosOpen}
        onClose={() => setUploadInsumosOpen(false)}
        businessId={businessId}
        onSuccess={() => {
          setUploadInsumosOpen(false);
          onSuccess?.('insumos');
        }}
      />

      <RecetasImportModal
        open={recetasImportOpen}
        onClose={() => setRecetasImportOpen(false)}
        businessId={businessId}
        onSuccess={() => {
          setRecetasImportOpen(false);
          onSuccess?.('recetas');
        }}
      />
    </section>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Perfil() {
  const {
    items,
    active,
    activeId,
    selectBusiness,
    selectDivision,
    refetchBusinesses,
    removeBusinessFromState,
    loading: businessesLoading,
  } = useBusiness() || {};

  const { organization, allBusinesses } = useOrganization() || {};

  const [showCreate, setShowCreate] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [notice,     setNotice]     = useState({ open: false, title: '', message: '' });

  const showNotice  = (title, message) => setNotice({ open: true, title, message });
  const closeNotice = () => setNotice(s => ({ ...s, open: false }));

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') || {}; }
    catch { return {}; }
  }, []);

  const newLocalBtnRef = useRef(null);

  useEffect(() => {
    refetchBusinesses?.();
  }, [refetchBusinesses]);

  // Resolver el rootBizId para las importaciones (siempre el principal)
  const rootBizId = useMemo(() => {
    if (!allBusinesses?.length) return activeId;
    const root = allBusinesses.find(
      b => !b.created_from || b.created_from === 'manual' || b.created_from === 'onboarding'
    );
    return root?.id ?? activeId;
  }, [allBusinesses, activeId]);

  const onSetActive = async (id) => {
    try { await selectBusiness?.(id); }
    catch (e) { console.error(e); showAlert('No se pudo activar.', 'error'); }
  };

  const onCreateComplete = async (biz) => {
    setShowCreate(false);
    await onSetActive(biz.id);
    await refetchBusinesses?.();

    const isSubBusiness = biz.created_from === 'from_group';

    if (!isSubBusiness) {
      try {
        const maxiOk = await isMaxiConfigured(biz.id);
        if (maxiOk) {
          showNotice('Sincronizando datos', 'Iniciando sincronización automática…');
          const result = await syncAll(biz.id, {
            onProgress: (msg, type, step) => console.log(`[AUTO-SYNC] [${step}] ${msg}`),
          });
          if (result?.ok) {
            showNotice('Sincronización completa', 'Artículos e insumos sincronizados correctamente');
            window.dispatchEvent(new CustomEvent('sync:completed'));
          } else {
            const errors     = Array.isArray(result?.errors) ? result.errors : [];
            const errorSteps = errors.map(e => e.step).filter(Boolean).join(', ') || 'desconocido';
            showNotice('Sincronización parcial', `Completado con errores en: ${errorSteps}`);
          }
        } else {
          showNotice('Negocio creado', 'Configurá las credenciales de Maxi para habilitar la sincronización automática');
        }
      } catch (e) {
        console.error('Auto-sync on create error:', e);
        showNotice('Error', 'No se pudo completar la sincronización automática');
      }
    } else {
      showNotice('Sub-negocio creado', `"${biz.name}" fue creado correctamente y hereda las credenciales del principal.`);
    }

    try { window.dispatchEvent(new CustomEvent('business:created', { detail: { id: biz.id } })); } catch { }
  };

  const handleDeleteBusiness = async (biz) => {
    const id = biz?.id;
    if (!id) return;

    const name = biz?.name || biz?.nombre || `#${id}`;
    const ok   = window.confirm(`¿Eliminar el local "${name}"?\nEsta acción no se puede deshacer.`);
    if (!ok) return;

    try { newLocalBtnRef.current?.focus?.(); }
    catch { try { document.activeElement?.blur?.(); } catch { } }

    try {
      const currentActiveId = Number(activeId);
      const deletedId       = Number(id);
      const isActive        = currentActiveId === deletedId;

      await BusinessesAPI.remove(id);
      removeBusinessFromState?.(id);

      if (isActive) {
        const businesses = await BusinessesAPI.listMine();
        if (businesses && businesses.length > 0) {
          const newBiz = businesses[0];
          await BusinessesAPI.setActive(newBiz.id);
          window.dispatchEvent(new CustomEvent('business:switched', { detail: { bizId: newBiz.id, biz: newBiz } }));
          showNotice('Listo', `🗑️ Local eliminado. Ahora activo: "${newBiz.name}"`);
        } else {
          localStorage.removeItem('activeBusinessId');
          await selectBusiness?.(null);
          await selectDivision?.(null);
          window.dispatchEvent(new CustomEvent('business:switched', { detail: { bizId: null, biz: null } }));
          showNotice('Listo', '🗑️ Local eliminado. No quedan más locales.');
        }
      } else {
        showNotice('Listo', `🗑️ Local "${name}" eliminado`);
      }

      await refetchBusinesses?.();
      window.dispatchEvent(new CustomEvent('business:deleted', { detail: { id } }));
    } catch (e) {
      console.error('[Delete] Error:', e);
      showNotice('Error', e?.message || 'No se pudo eliminar el local');
    }
  };

  const handleImportSuccess = (tipo) => {
    if (tipo === 'articulos') {
      window.dispatchEvent(new CustomEvent('articulos:imported'));
    } else if (tipo === 'insumos') {
      window.dispatchEvent(new CustomEvent('insumos:imported'));
    } else if (tipo === 'recetas') {
      window.dispatchEvent(new CustomEvent('recetas:imported'));
    }
    showNotice(
      'Importación completada',
      `Los datos de ${tipo} fueron importados correctamente. Si tenés la pantalla abierta, recargá para ver los cambios.`
    );
  };

  const activeBiz = active || null;

  const activeBranding = useMemo(() => {
    const br = activeBiz?.props?.branding || activeBiz?.branding || {};
    return {
      primary:   /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(br.primary   || '') ? br.primary   : '#111111',
      secondary: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(br.secondary || '') ? br.secondary : '#e5e7eb',
      name:      activeBiz?.name || activeBiz?.nombre || '',
    };
  }, [activeBiz]);

  const user        = me || {};
  const userInitial = (user?.firstName || user?.name || 'U')[0]?.toUpperCase?.() || 'U';
  const bizInitial  = (activeBiz ? (activeBranding.name || 'N') : userInitial)[0]?.toUpperCase?.() || 'N';
  const meName      = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Usuario';
  const list        = Array.isArray(items) ? items : [];

  return (
    <div className="profile-wrap">
      {/* ── Header ── */}
      <header className="profile-header">
        <div className="avatar-wrap">
          <div
            className="avatar biz-avatar"
            title={activeBiz?.name || 'Sin local activo'}
            style={{
              backgroundColor: activeBranding?.secondary || '#e5e7eb',
              color:           activeBranding?.primary   || '#111',
            }}
          >
            <span className="biz-avatar-initial">{bizInitial}</span>
          </div>
        </div>

        <div className="who">
          <h1>Mi Perfil</h1>
          <h2>{meName}</h2>
          <div className="mail">{me?.email || ''}</div>
          <button className="cta-wide" ref={newLocalBtnRef} onClick={() => setShowCreate(true)}>
            Nuevo Local
          </button>
        </div>
      </header>

      {/* ── Organización ── */}
      {organization && (allBusinesses || []).length > 1 && (
        <section className="section">
          <h3>Mi Organización — {organization.name || 'Sin nombre'}</h3>
          <OrgDashboard
            compact
            onSelectBusiness={async (biz) => {
              try { await selectBusiness?.(biz.id); } catch { }
            }}
          />
        </section>
      )}

      {/* ── Mis locales ── */}
      {(() => {
        const orgBizIds  = new Set((allBusinesses || []).map(b => String(b.id)));
        const outsideOrg = organization && orgBizIds.size > 1
          ? list.filter(b => !orgBizIds.has(String(b.id)))
          : list;

        if (outsideOrg.length === 0 && organization && orgBizIds.size > 1) return null;

        return (
          <section className="section">
            <h3>Mis locales</h3>
            {businessesLoading && (
              <div style={{ opacity: 0.7, fontSize: 13, padding: '6px 0' }}>Cargando locales…</div>
            )}
            <div className="grid">
              {outsideOrg.map(biz => (
                <BusinessCard
                  key={biz.id}
                  biz={biz}
                  activeId={activeId}
                  onSetActive={onSetActive}
                  onEdit={setEditing}
                  onDelete={handleDeleteBusiness}
                  showNotice={(msg) => showNotice('Aviso', msg)}
                />
              ))}
              {outsideOrg.length === 0 && !businessesLoading && (
                <div className="empty">Aún no tenés locales. Creá el primero.</div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ── Importación de datos ── */}
      <ImportDataPanel businessId={rootBizId} onSuccess={handleImportSuccess} />

      {/* ── Modals globales ── */}
      <BusinessCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreateComplete={onCreateComplete}
      />
      <BusinessEditModal
        open={!!editing}
        business={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refetchBusinesses?.();
          try { window.dispatchEvent(new Event('business:updated')); } catch { }
        }}
      />
      <SyncDialog
        open={notice.open}
        title={notice.title}
        message={notice.message}
        onClose={closeNotice}
      />

      <style>{`
        .profile-wrap{max-width:1000px;margin:0 auto;padding:16px;display:grid;gap:18px}
        .profile-header{
          display:grid;
          grid-template-columns:auto 1fr auto;
          gap:12px;
          align-items:center;
          background:var(--color-surface,#fff);
          border:1px solid var(--color-border,#e5e7eb);
          border-radius:14px;
          padding:12px 14px;
        }
        .avatar{width:56px;height:56px;border-radius:999px;background:#e5e7eb;display:grid;place-items:center}
        .who h1{margin:0 0 4px 0;font-size:14px;color:#64748b;font-weight:800}
        .who h2{margin:0;font-size:18px;font-weight:800}
        .who .mail{font-size:12px;color:#6b7280}

        .section h3{margin:6px 0 10px;font-size:14px;font-weight:800;color:#1f2937}
        .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
        .empty{border:1px dashed #e5e7eb;border-radius:12px;padding:16px;color:#6b7280}

        .cta-wide{
          width:15%;height:40px;border-radius:12px;
          background:var(--color-primary,#0ea5e9);
          color:var(--on-primary,#ffffff);
          box-shadow:0 1px 0 rgba(0,0,0,.06) inset;
          font-weight:400;cursor:pointer;margin:10px;border:none;
        }
        .cta-wide:hover{filter:brightness(.96)}

        .biz-avatar{border:1px solid var(--color-border,#e5e7eb);box-shadow:0 1px 0 rgba(0,0,0,.03) inset}
        .biz-avatar-initial{font-weight:900;font-size:20px;line-height:1;letter-spacing:.5px;text-transform:uppercase}

        /* ── Panel de importación ── */
        .import-notice{
          display:flex;gap:8px;align-items:flex-start;
          background:#f8fafc;border:1px solid #e2e8f0;
          border-radius:10px;padding:10px 14px;
          font-size:12px;color:#6b7280;line-height:1.5;
          margin-bottom:14px;
        }
        .import-grid{
          display:grid;gap:12px;
          grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
        }
        .import-card{
          display:grid;
          grid-template-rows:auto 1fr auto;
          gap:10px;
          background:var(--color-surface,#fff);
          border:1px solid var(--color-border,#e5e7eb);
          border-radius:14px;
          padding:18px;
        }
        .import-card-icon{display:flex;align-items:center}
        .import-card-title{font-size:14px;font-weight:800;color:#1f2937;margin-bottom:4px}
        .import-card-desc{font-size:13px;color:#374151;margin-bottom:4px}
        .import-card-detail{font-size:11px;color:#9ca3af;line-height:1.4}
        .import-card-btn{
          width:100%;padding:10px;border-radius:10px;border:none;cursor:pointer;
          background:var(--color-primary,#1976d2);
          color:var(--on-primary,#fff);
          font-size:13px;font-weight:700;
          transition:filter .15s;
        }
        .import-card-btn:hover{filter:brightness(.92)}
      `}</style>
    </div>
  );
}