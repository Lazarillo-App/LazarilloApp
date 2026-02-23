/* eslint-disable no-empty */
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { syncAll, isMaxiConfigured } from '@/servicios/syncService';

import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import SyncDialog from '../componentes/SyncDialog';
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import { useBusiness } from '@/context/BusinessContext';

export default function Perfil() {
  const {
    items,
    active,
    activeId,
    selectBusiness,

    divisions,
    divisionsLoading,
    activeDivisionId,
    selectDivision,
    refetchBusinesses,
    removeBusinessFromState,

    loading: businessesLoading,
  } = useBusiness() || {};

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState({ open: false, title: "", message: "" });

  const showNotice = (title, message) => setNotice({ open: true, title, message });
  const closeNotice = () => setNotice(s => ({ ...s, open: false }));

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') || {}; }
    catch { return {}; }
  }, []);

  // ✅ para arreglar warning aria-hidden: un “ancla” segura para devolver el foco
  const newLocalBtnRef = useRef(null);

  // ✅ opcional: al entrar, traemos verdad del server (si querés)
  useEffect(() => {
    refetchBusinesses?.();
  }, [refetchBusinesses]);

  const onSetActive = async (id) => {
    try {
      await selectBusiness?.(id);
    } catch (e) {
      console.error(e);
      alert('No se pudo activar.');
    }
  };

  const onSwitchDivision = (divisionId) => {
    selectDivision?.(divisionId);
    try {
      window.dispatchEvent(new CustomEvent('division:switched', {
        detail: { businessId: String(activeId || ''), divisionId: String(divisionId || '') }
      }));
    } catch { }
  };

  const onCreateComplete = async (biz) => {
    setShowCreate(false);

    // activar recién creado
    await onSetActive(biz.id);

    // ✅ aseguramos lista fresca
    await refetchBusinesses?.();

    // ✅ SOLO sincronizar si es un negocio NORMAL (no sub-negocio)
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
            const errors = Array.isArray(result?.errors) ? result.errors : [];
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
      // Es sub-negocio, solo mostrar mensaje de éxito
      showNotice('Sub-negocio creado', `"${biz.name}" fue creado correctamente y hereda las credenciales del principal.`);
    }

    try {
      window.dispatchEvent(new CustomEvent('business:created', { detail: { id: biz.id } }));
    } catch { }
  };

  const handleDeleteBusiness = async (biz) => {
    const id = biz?.id;
    if (!id) return;

    const name = biz?.name || biz?.nombre || `#${id}`;
    const ok = window.confirm(`¿Eliminar el local "${name}"?\nEsta acción no se puede deshacer.`);
    if (!ok) return;

    // ✅ mover foco antes de borrar para evitar warning aria-hidden
    try {
      newLocalBtnRef.current?.focus?.();
    } catch {
      try { document.activeElement?.blur?.(); } catch { }
    }

    try {
      const currentActiveId = Number(activeId);
      const deletedId = Number(id);
      const isActive = currentActiveId === deletedId;

      // 1️⃣ Borrar el negocio
      await BusinessesAPI.remove(id);

      // 2️⃣ Remover del state inmediatamente
      removeBusinessFromState?.(id);

      // 3️⃣ Si era el activo, seleccionar otro automáticamente
      if (isActive) {
        console.log('[Delete] Negocio activo borrado, seleccionando otro...');

        // Obtener lista actualizada del servidor
        const businesses = await BusinessesAPI.listMine();

        if (businesses && businesses.length > 0) {
          // Seleccionar el primero disponible
          const newBiz = businesses[0];
          console.log(`[Delete] Activando negocio: ${newBiz.id}`);

          await BusinessesAPI.setActive(newBiz.id);

          // Despachar evento para que todos los componentes se actualicen
          window.dispatchEvent(
            new CustomEvent('business:switched', {
              detail: { bizId: newBiz.id, biz: newBiz }
            })
          );

          showNotice("Listo", `🗑️ Local eliminado. Ahora activo: "${newBiz.name}"`);
        } else {
          // No hay más negocios
          console.log('[Delete] No quedan negocios');
          localStorage.removeItem('activeBusinessId');

          await selectBusiness?.(null);
          await selectDivision?.(null);

          window.dispatchEvent(
            new CustomEvent('business:switched', {
              detail: { bizId: null, biz: null }
            })
          );

          showNotice("Listo", "🗑️ Local eliminado. No quedan más locales.");
        }
      } else {
        // No era el activo, solo notificar
        showNotice("Listo", `🗑️ Local "${name}" eliminado`);
      }

      // 4️⃣ Refrescar lista completa
      await refetchBusinesses?.();

      // 5️⃣ Notificar evento de borrado
      window.dispatchEvent(
        new CustomEvent("business:deleted", { detail: { id } })
      );

    } catch (e) {
      console.error('[Delete] Error:', e);
      showNotice("Error", e?.message || "No se pudo eliminar el local");
    }
  };

  const activeBiz = active || null;

  const activeBranding = useMemo(() => {
    const br = activeBiz?.props?.branding || activeBiz?.branding || {};
    return {
      primary: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(br.primary || '') ? br.primary : '#111111',
      secondary: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(br.secondary || '') ? br.secondary : '#e5e7eb',
      name: activeBiz?.name || activeBiz?.nombre || ''
    };
  }, [activeBiz]);

  const user = me || {};
  const userInitial = (user?.firstName || user?.name || 'U')[0]?.toUpperCase?.() || 'U';
  const bizInitial = (activeBiz ? (activeBranding.name || 'N') : userInitial)[0]?.toUpperCase?.() || 'N';
  const meName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Usuario';

  const activeDivName = useMemo(() => {
    const d = (divisions || []).find(x => String(x.id) === String(activeDivisionId));
    return d?.name || '';
  }, [divisions, activeDivisionId]);

  const list = Array.isArray(items) ? items : [];

  return (
    <div className="profile-wrap">
      <header className="profile-header">
        <div className="avatar-wrap">
          <div
            className="avatar biz-avatar"
            title={activeBiz?.name || 'Sin local activo'}
            style={{
              backgroundColor: activeBranding?.secondary || '#e5e7eb',
              color: activeBranding?.primary || '#111'
            }}
          >
            <span className="biz-avatar-initial">{bizInitial}</span>
          </div>
        </div>

        <div className="who">
          <h1>Mi Perfil</h1>
          <h2>{meName}</h2>
          <div className="mail">{me?.email || ''}</div>

          {!!activeId && (
            <div className="division-row">
              <div className="division-label">Subnegocio:</div>

              {divisionsLoading ? (
                <div className="division-loading">Cargando…</div>
              ) : ((divisions || []).length <= 1 ? (
                <div className="division-single">{activeDivName || 'Principal'}</div>
              ) : (
                <select
                  className="division-select"
                  value={activeDivisionId ?? ''}
                  onChange={(e) => onSwitchDivision(e.target.value)}
                  aria-label="Cambiar subnegocio"
                >
                  <option value="">Principal</option>
                  {(divisions || [])
                    .slice()
                    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}{d.is_main ? ' (Principal)' : ''}
                      </option>
                    ))}
                </select>
              ))}
            </div>
          )}
          <button
            className="cta-wide"
            ref={newLocalBtnRef}
            onClick={() => setShowCreate(true)}
          >
            Nuevo Local
          </button>
        </div>
      </header>
      <section className="section">
        <h3>Mis locales</h3>
        {businessesLoading && (
          <div style={{ opacity: 0.7, fontSize: 13, padding: '6px 0' }}>
            Cargando locales…
          </div>
        )}
        <div className="grid">
          {list.map(biz => (
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
          {list.length === 0 && !businessesLoading && (
            <div className="empty">Aún no tenés locales. Creá el primero.</div>
          )}
        </div>
      </section>
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
        .who h1{margin:0 0 4px 0; font-size:14px; color:#64748b; font-weight:800}
        .who h2{margin:0; font-size:18px; font-weight:800}
        .who .mail{font-size:12px; color:#6b7280}

        .division-row{ margin-top:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .division-label{ font-size:12px; font-weight:800; color:#64748b; }
        .division-loading, .division-single{
          font-size:12px; font-weight:800; color:#111827;
          padding:8px 10px; border-radius:10px;
          border:1px solid var(--color-border,#e5e7eb);
          background:var(--color-surface,#fff);
        }
        .division-select{
          height:36px; padding:0 10px; border-radius:10px;
          border:1px solid var(--color-border,#e5e7eb);
          background:var(--color-surface,#fff);
          font-weight:800; color:#111827; outline:none;
        }

        .notifications-container{display:flex;align-items:center;justify-content:center}
        .section h3{margin:6px 0 10px;font-size:14px;font-weight:800;color:#1f2937}
        .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
        .empty{border:1px dashed #e5e7eb;border-radius:12px;padding:16px;color:#6b7280}

        .cta-wide{
          width:15%;
          height:40px;
          border-radius:12px;
          background: var(--color-primary, #0ea5e9);
          color: var(--on-primary, #ffffff);
          box-shadow: 0 1px 0 rgba(0,0,0,.06) inset;
          font-weight:400;
          cursor:pointer;
          margin: 10px
        }
        .cta-wide:hover{ filter: brightness(.96); }

        .biz-avatar{border:1px solid var(--color-border,#e5e7eb);box-shadow:0 1px 0 rgba(0,0,0,.03) inset;}
        .biz-avatar-initial{font-weight:900;font-size:20px;line-height:1;letter-spacing:.5px;text-transform:uppercase;}
      `}</style>
    </div>
  );
}
