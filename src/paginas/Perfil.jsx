/* eslint-disable no-empty */
import React, { useEffect, useMemo, useState } from 'react';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { setActiveBusiness } from "@/servicios/setActiveBusiness";
import { syncAll, isMaxiConfigured } from '@/servicios/syncService';
import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import SyncDialog from '../componentes/SyncDialog';
import NotificationsPanel from '../componentes/NotificationsPanel';

// 🆕 Divisiones
import { getDivisions } from '@/servicios/apiDivisions';
import { getActiveDivisionId, setActiveDivisionId } from '@/servicios/activeDivision';

export default function Perfil({ activeBusinessId }) {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(String(activeBusinessId || ''));
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState({ open: false, title: "", message: "" });
  const showNotice = (title, message) => setNotice({ open: true, title, message });
  const closeNotice = () => setNotice(s => ({ ...s, open: false }));

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') || {}; }
    catch { return {}; }
  }, []);

  // 🆕 divisiones del negocio activo
  const [divList, setDivList] = useState([]);
  const [loadingDiv, setLoadingDiv] = useState(false);
  const [activeDivId, setActiveDivId] = useState('');

  useEffect(() => {
    setActiveId(String(activeBusinessId || ''));
  }, [activeBusinessId]);

  const load = async () => {
    try {
      const list = await BusinessesAPI.listMine();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    }
  };

  useEffect(() => { load(); }, []);

  const onSetActive = async (id) => {
    try {
      await setActiveBusiness(id, { fetchBiz: true, broadcast: true });
      setActiveId(String(id));
      await load();
      // divisiones se recargan por efecto (activeId)
    } catch (e) {
      console.error(e);
      alert('No se pudo activar.');
    }
  };

  // 🆕 cargar divisiones cuando cambia negocio activo
  useEffect(() => {
    let alive = true;

    async function loadDivs() {
      if (!activeId) {
        setDivList([]);
        setActiveDivId('');
        return;
      }

      try {
        setLoadingDiv(true);
        const data = await getDivisions(activeId);
        if (!alive) return;

        const divs = data?.divisions || [];
        setDivList(divs);

        // resolver activa (guardada -> main -> primera)
        const saved = getActiveDivisionId(activeId);
        const savedOk = saved && divs.some(d => String(d.id) === String(saved));
        const pick = savedOk
          ? saved
          : (divs.find(d => d.is_main)?.id || divs[0]?.id || '');

        if (pick) {
          setActiveDivId(String(pick));
          setActiveDivisionId(activeId, pick);

          // notificar al resto de la app
          window.dispatchEvent(new CustomEvent('division:switched', {
            detail: { businessId: String(activeId), divisionId: String(pick) }
          }));
        } else {
          setActiveDivId('');
        }
      } catch (e) {
        console.error('[Perfil] error cargando divisiones:', e);
        setDivList([]);
        setActiveDivId('');
      } finally {
        if (alive) setLoadingDiv(false);
      }
    }

    loadDivs();
    return () => { alive = false; };
  }, [activeId]);

  // 🆕 cambiar división manualmente
  const onSwitchDivision = (divisionId) => {
    const did = String(divisionId || '');
    setActiveDivId(did);
    setActiveDivisionId(activeId, did);

    window.dispatchEvent(new CustomEvent('division:switched', {
      detail: { businessId: String(activeId), divisionId: String(did) }
    }));
  };

  const onDelete = async (biz) => {
    const nombre = String(biz?.name ?? biz?.nombre ?? `#${biz.id}`).trim();
    const typed = window.prompt(
      `Vas a eliminar el negocio "${nombre}". Esta acción es permanente.\n\nPara confirmar, escribí EXACTAMENTE el nombre del negocio:`
    );
    if (typed === null) return;
    if (typed.trim() !== nombre) {
      alert('El texto no coincide. Operación cancelada.');
      return;
    }

    const deletedId = biz.id;

    try {
      await BusinessesAPI.remove(deletedId);
    } catch (e) {
      if (String(e?.message).toLowerCase().includes('not_found')) {
        console.warn('Negocio ya no existe en backend, limpiando UI igual.');
      } else {
        console.error(e);
        alert(e?.message || 'No se pudo eliminar.');
        return;
      }
    }

    let restantes = [];
    try {
      restantes = await BusinessesAPI.listMine();
      setItems(restantes || []);
    } catch {
      setItems(prev => prev.filter(i => String(i.id) !== String(deletedId)));
    }

    const wasActive = String(localStorage.getItem('activeBusinessId')) === String(deletedId);

    if (wasActive) {
      if (restantes && restantes.length > 0) {
        const fallback = restantes[0];
        try {
          await setActiveBusiness(fallback.id, { fetchBiz: true, broadcast: true });
          setActiveId(String(fallback.id));
        } catch (e) {
          console.error('No se pudo activar fallback tras borrar negocio:', e);
        }
      } else {
        localStorage.removeItem('activeBusinessId');
        window.dispatchEvent(new Event('business:switched'));
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('business:deleted', { detail: { id: deletedId } }));
    } catch { }

    alert('Negocio eliminado.');
    window.dispatchEvent(new CustomEvent("business:list:updated"));
  };

  const onCreateComplete = async (biz) => {
    setItems(prev => [biz, ...prev]);
    setShowCreate(false);
    await onSetActive(biz.id);
    window.dispatchEvent(new CustomEvent("business:list:updated"));

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
          showNotice(
            'Sincronización completa',
            'Artículos, ventas e insumos sincronizados correctamente'
          );
          window.dispatchEvent(new CustomEvent('sync:completed'));
        } else {
          const errorSteps = result.errors.map(e => e.step).join(', ');
          showNotice(
            'Sincronización parcial',
            `Completado con errores en: ${errorSteps}`
          );
        }
      } else {
        showNotice(
          'Negocio creado',
          'Configurá las credenciales de Maxi para habilitar la sincronización automática'
        );
      }
    } catch (e) {
      console.error('Auto-sync on create error:', e);
      showNotice('Error', 'No se pudo completar la sincronización automática');
    }

    try {
      window.dispatchEvent(new CustomEvent('business:created', { detail: { id: biz.id } }));
    } catch { }
  };

  const onSaved = (saved) => {
    setItems(prev => prev.map(i => String(i.id) === String(saved.id) ? { ...i, ...saved } : i));
    setEditing(null);
    window.dispatchEvent(new CustomEvent("business:list:updated"));
  };

  const activeBiz = useMemo(
    () => items.find(i => String(i.id) === String(activeId)) || null,
    [items, activeId]
  );

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
    const d = divList.find(x => String(x.id) === String(activeDivId));
    return d?.name || '';
  }, [divList, activeDivId]);

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

          {/* 🆕 Selector de división */}
          {!!activeId && (
            <div className="division-row">
              <div className="division-label">
                Subnegocio:
              </div>

              {loadingDiv ? (
                <div className="division-loading">Cargando…</div>
              ) : (divList.length <= 1 ? (
                <div className="division-single">
                  {activeDivName || 'Principal'}
                </div>
              ) : (
                <select
                  className="division-select"
                  value={activeDivId}
                  onChange={(e) => onSwitchDivision(e.target.value)}
                  aria-label="Cambiar subnegocio"
                >
                  {divList
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
          {items.map(biz => (
            <BusinessCard
              key={biz.id}
              biz={biz}
              activeId={activeId}
              onSetActive={onSetActive}
              onEdit={setEditing}
              onDelete={onDelete}
              showNotice={(msg) => showNotice('Aviso', msg)}
            />
          ))}
          {!items.length && (
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
        onSaved={onSaved}
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
