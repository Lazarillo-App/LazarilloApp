/* eslint-disable no-empty */
import React, { useMemo, useState } from 'react';
import { syncAll, isMaxiConfigured } from '@/servicios/syncService';

import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import SyncDialog from '../componentes/SyncDialog';
import NotificationsPanel from '../componentes/NotificationsPanel';

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

  const onSetActive = async (id) => {
    try {
      await selectBusiness?.(id); // ✅ esto actualiza Context → Navbar también
    } catch (e) {
      console.error(e);
      alert('No se pudo activar.');
    }
  };

  const onSwitchDivision = (divisionId) => {
    selectDivision?.(divisionId);
    // Si querés mantener tu evento legado:
    try {
      window.dispatchEvent(new CustomEvent('division:switched', {
        detail: { businessId: String(activeId || ''), divisionId: String(divisionId || '') }
      }));
    } catch {}
  };

  const onCreateComplete = async (biz) => {
    setShowCreate(false);

    // activar recién creado
    await onSetActive(biz.id);

    try {
      const maxiOk = await isMaxiConfigured(biz.id);

      if (maxiOk) {
        showNotice('Sincronizando datos', 'Iniciando sincronización automática…');

        const result = await syncAll(biz.id, {
          onProgress: (msg, type, step) => {
            console.log(`[AUTO-SYNC] [${step}] ${msg}`);
          },
        });

        if (result.ok) {
          showNotice('Sincronización completa', 'Artículos e insumos sincronizados correctamente');
          window.dispatchEvent(new CustomEvent('sync:completed'));
        } else {
          const errorSteps = result.errors.map(e => e.step).join(', ');
          showNotice('Sincronización parcial', `Completado con errores en: ${errorSteps}`);
        }
      } else {
        showNotice('Negocio creado', 'Configurá las credenciales de Maxi para habilitar la sincronización automática');
      }
    } catch (e) {
      console.error('Auto-sync on create error:', e);
      showNotice('Error', 'No se pudo completar la sincronización automática');
    }

    try {
      window.dispatchEvent(new CustomEvent('business:created', { detail: { id: biz.id } }));
    } catch {}
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

          <button className="cta-wide" onClick={() => setShowCreate(true)}>
            Nuevo Local
          </button>
        </div>

        <div className="notifications-container">
          <NotificationsPanel businessId={activeId} />
        </div>
      </header>

      <section className="section">
        <h3>Mis locales</h3>
        <div className="grid">
          {(items || []).map(biz => (
            <BusinessCard
              key={biz.id}
              biz={biz}
              activeId={activeId}
              onSetActive={onSetActive}
              onEdit={setEditing}
              onDelete={() => {}}
              showNotice={(msg) => showNotice('Aviso', msg)}
            />
          ))}
          {(!items || items.length === 0) && (
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
        onSaved={() => setEditing(null)}
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

        .division-row{
          margin-top:10px;
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .division-label{
          font-size:12px;
          font-weight:800;
          color:#64748b;
        }
        .division-loading, .division-single{
          font-size:12px;
          font-weight:800;
          color:#111827;
          padding:8px 10px;
          border-radius:10px;
          border:1px solid var(--color-border,#e5e7eb);
          background:var(--color-surface,#fff);
        }
        .division-select{
          height:36px;
          padding:0 10px;
          border-radius:10px;
          border:1px solid var(--color-border,#e5e7eb);
          background:var(--color-surface,#fff);
          font-weight:800;
          color:#111827;
          outline:none;
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
