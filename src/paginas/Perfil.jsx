/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/paginas/Perfil.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import AdminActionsSidebar from '../componentes/AdminActionsSidebar';

export default function Perfil() {
  // ---------- estado ----------
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  // sync (versión compacta)
  const [mxStatus, setMxStatus] = useState({ configured: null, email: null, codcli: null });
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // ---------- helpers ----------
  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') || {}; }
    catch { return {}; }
  }, []);

  const load = async () => {
    try {
      const list = await BusinessesAPI.listMine();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    }
  };

  const loadMx = async (bizId) => {
    if (!bizId) { setMxStatus({ configured: null, email: null, codcli: null }); return; }
    try {
      const s = await BusinessesAPI.maxiStatus(Number(bizId));
      setMxStatus({
        configured: !!s?.configured,
        email: s?.email || null,
        codcli: s?.codcli || null
      });
    } catch (e) {
      setMxStatus({ configured: false, email: null, codcli: null });
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadMx(activeId || localStorage.getItem('activeBusinessId')); }, [activeId]);

  // Mantener en sync si se cambia el local desde otro lugar
  useEffect(() => {
    const onSwitched = () => {
      const id = localStorage.getItem('activeBusinessId') || '';
      setActiveId(id);
      load();
      loadMx(id);
    };
    window.addEventListener('business:switched', onSwitched);
    return () => window.removeEventListener('business:switched', onSwitched);
  }, []);

  // ---------- acciones ----------
  const onSetActive = async (id) => {
    try {
      await BusinessesAPI.select(id);
      localStorage.setItem('activeBusinessId', id);
      setActiveId(String(id));
      await load();
      await loadMx(id);
      window.dispatchEvent(new CustomEvent('business:switched'));
    } catch (e) {
      console.error(e);
      alert('No se pudo activar.');
    }
  };

  const onDelete = async (biz) => {
    const nombre = String(biz?.name ?? biz?.nombre ?? `#${biz.id}`).trim();
    const typed = window.prompt(
      `Vas a eliminar el negocio "${nombre}". Esta acción es permanente.\n\n` +
      `Para confirmar, escribí EXACTAMENTE el nombre del negocio:`
    );
    if (typed === null) return;
    if (typed.trim() !== nombre) {
      alert('El texto no coincide. Operación cancelada.');
      return;
    }

    try {
      await BusinessesAPI.remove(biz.id);
    } catch (e) {
      if (String(e?.message).toLowerCase().includes('not_found')) {
        console.warn('Negocio ya no existe en backend, limpiando UI igual.');
      } else {
        console.error(e);
        alert(e?.message || 'No se pudo eliminar.');
        return;
      }
    }

    setItems(prev => prev.filter(i => String(i.id) !== String(biz.id)));

    if (String(localStorage.getItem('activeBusinessId')) === String(biz.id)) {
      localStorage.removeItem('activeBusinessId');
      setActiveId('');
      window.dispatchEvent(new CustomEvent('business:switched'));
    }

    try {
      const restantes = await BusinessesAPI.listMine();
      setItems(restantes || []);
    } catch { }
    alert('Negocio eliminado.');
  };

  const onCreateComplete = (biz) => {
    setItems(prev => [biz, ...prev]);
    setShowCreate(false);
    onSetActive(biz.id);
  };

  const onSaved = (savedOrPartial) => {
    const merged = { ...editing, ...savedOrPartial };
    if (editing?.props?.branding && savedOrPartial?.props?.branding) {
      merged.props = { ...editing.props, ...savedOrPartial.props };
    }
    setItems(prev => prev.map(i => String(i.id) === String(merged.id) ? merged : i));
    setEditing(null);
  };

  // sync con Maxi (hoy / 30d) – misma API que tu SalesSyncPanel
  const runSync = async (mode) => {
    if (!activeId) return;
    setSyncMsg('');
    setSyncBusy(true);
    try {
      const res = await BusinessesAPI.syncSales(Number(activeId), { mode });
      // feedback mínimo (opcional)
      if (res?.counts || res?.sales) {
        setSyncMsg(
          res?.sales?.mode
            ? `Listo: ${res.sales.mode}`
            : 'Sincronización completada.'
        );
      }
      window.dispatchEvent(new CustomEvent('business:synced'));
    } catch (e) {
      setSyncMsg(e?.message || 'No se pudo sincronizar.');
    } finally {
      setSyncBusy(false);
    }
  };

  // negocio activo + branding
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

  const userInitial = (me?.firstName || me?.name || 'U')[0]?.toUpperCase?.() || 'U';
  const bizInitial = (activeBiz ? (activeBranding.name || 'N') : userInitial)[0]?.toUpperCase?.() || 'N';
  const meName = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.name || 'Usuario';

  // ---------- UI ----------
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
            // si prefieres, puedes pasar onSync aquí para hacerlo por tarjeta:
            // onSync={async () => runSync('auto')}
            />
          ))}
          {!items.length && (
            <div className="empty">Aún no tenés locales. Creá el primero.</div>
          )}
        </div>
        <button className="cta-wide" onClick={() => setShowCreate(true)}>
          Crear Nuevo Local
        </button>
      </section>

      {/* Sincronizar datos (compacto) */}
      <section className="section">
        <h3>Sincronizar datos</h3>
          <div className="admin-tools">
            <AdminActionsSidebar onSynced={load} />
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
      {/* Configuración (colapsable simple visual) */}
      <section className="section">
        <h3>Configuración</h3>
        <div className="config-list">
          <button className="row">
            <span>Configuración General</span>
            <span className="chev">›</span>
          </button>
          <button className="row">
            <span>Notificaciones</span>
            <span className="chev">›</span>
          </button>
          <button className="row">
            <span>Ayuda y Soporte</span>
            <span className="chev">›</span>
          </button>
        </div>
      </section>
      {/* estilos locales */}
      <style>{`
        .profile-wrap{max-width:1000px;margin:0 auto;padding:16px;display:grid;gap:18px}
        .profile-header{
          display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:center;
          background:var(--color-surface,#fff); border:1px solid var(--color-border,#e5e7eb);
          border-radius:14px; padding:12px 14px;
        }
        .avatar{width:56px;height:56px;border-radius:999px;background:#e5e7eb}
        .who h1{margin:0 0 4px 0; font-size:14px; color:#64748b; font-weight:800}
        .who h2{margin:0; font-size:18px; font-weight:800}
        .who .mail{font-size:12px; color:#6b7280}
        .new-btn{
          height:36px;border-radius:10px;border:0;background:#1f2923ad;
          color:white;font-weight:500; padding:0 12px; cursor:pointer;
        }

        .section h3{margin:6px 0 10px;font-size:14px;font-weight:800;color:#1f2937}
        .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
        .empty{border:1px dashed #e5e7eb;border-radius:12px;padding:16px;color:#6b7280}
        .cta-wide{
          width:50%;height:44px;border-radius:12px;border:0;background:#1f2923ad;
          color:white;font-weight:500;cursor:pointer;margin-top:6px;disabled:opacity-50
        }

        .sync-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        @media (max-width:720px){ .sync-cards{grid-template-columns:1fr} .profile-header{grid-template-columns:auto 1fr} .new-btn{grid-column:1/-1;justify-self:end} }
        .card{
          background:var(--color-surface,#fff); border:1px solid var(--color-border,#e5e7eb);
          border-radius:12px; padding:12px; display:grid; gap:10px;
        }
        .card-title{font-weight:700;color:#0f172a}
        .status-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .pill{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:12px}
        .pill.ok{background:color-mix(in srgb, var(--color-primary,#34d399) 18%, white); color:#065f46}
        .pill.error{background:#fee2e2;color:#991b1b}
        .pill.muted{background:#f3f4f6;color:#6b7280}
        .mono{font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; color:#475569}
        .actions{display:flex;gap:8px;flex-wrap:wrap}
        .btn{border:0;border-radius:10px;padding:9px 12px;font-weight:700;cursor:pointer}
        .btn.dark{background:#111;color:#fff}
        .btn.ghost{background:#f3f4f6;color:#111}
        .hint{font-size:12px;color:#475569}

        .config-list{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
        .config-list .row{
          width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;
          padding:12px;border:0;background:#fff;cursor:pointer;
          border-bottom:1px solid #f1f5f9;
        }
        .config-list .row:last-child{border-bottom:0}
        .chev{color:#94a3b8}

        .admin-tools{opacity:.7}
.avatar{
  width:56px;height:56px;border-radius:999px;
  display:grid;place-items:center;
  background:#e5e7eb;
}

/* avatar del negocio (colores vienen inline) */
.biz-avatar{
  border:1px solid var(--color-border,#e5e7eb);
  box-shadow: 0 1px 0 rgba(0,0,0,.03) inset;
}

.biz-avatar-initial{
  font-weight:900;
  font-size:20px;
  line-height:1;
  letter-spacing:.5px;
  text-transform:uppercase;
}

      `}</style>
    </div>
  );
}
