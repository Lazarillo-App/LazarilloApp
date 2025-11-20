/* eslint-disable no-empty */
import React, { useEffect, useMemo, useState } from 'react';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { setActiveBusiness } from "@/servicios/setActiveBusiness";
import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import SyncDialog from '../componentes/SyncDialog';

export default function Perfil() {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState({ open: false, title: "", message: "" });
  const showNotice = (title, message) => setNotice({ open: true, title, message });
  const closeNotice = () => setNotice(s => ({ ...s, open: false }));
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

  useEffect(() => { load(); }, []);

  // Mantener en sync si se cambia el local desde otro lugar
  useEffect(() => {
    const onSwitched = () => {
      const id = localStorage.getItem('activeBusinessId') || '';
      setActiveId(id);
      load();
    };
    window.addEventListener('business:switched', onSwitched);
    return () => window.removeEventListener('business:switched', onSwitched);
  }, []);

  const onSetActive = async (id) => {
    try {
      await setActiveBusiness(id);
      setActiveId(String(id));
      await load();
    } catch (e) {
      console.error(e);
      alert('No se pudo activar.');
    }
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

  // 1) Refrescamos lista desde backend
  let restantes = [];
  try {
    restantes = await BusinessesAPI.listMine();
    setItems(restantes || []);
  } catch {
    setItems(prev => prev.filter(i => String(i.id) !== String(deletedId)));
  }

  // 2) Si el que borraste era el activo → decidir nuevo activo
  const wasActive = String(localStorage.getItem('activeBusinessId')) === String(deletedId);

  if (wasActive) {
    if (restantes && restantes.length > 0) {
      // elegimos el primero de la lista como nuevo activo
      const fallback = restantes[0];
      try {
        const bizActivo = await setActiveBusiness(fallback.id);
        localStorage.setItem('activeBusinessId', String(bizActivo.id));
        setActiveId(String(bizActivo.id));
      } catch (e) {
        console.error('No se pudo activar fallback tras borrar negocio:', e);
        localStorage.removeItem('activeBusinessId');
        setActiveId('');
      }
    } else {
      // ya no quedan negocios
      localStorage.removeItem('activeBusinessId');
      setActiveId('');
    }

    // avisar a toda la app que cambió el local
    window.dispatchEvent(new CustomEvent('business:switched'));
  }

  try { 
    window.dispatchEvent(new CustomEvent('business:deleted', { detail: { id: deletedId } })); 
  } catch {}

  alert('Negocio eliminado.');
  window.dispatchEvent(new CustomEvent("business:list:updated"));
};

  // ===== Helper: auto-sync ventas 7d para nuevo negocio (si Maxi está configurado)
  const tryAutoSyncNewBusiness = async (bizId) => {
    try {
      const st = await BusinessesAPI.maxiStatus(bizId);
      if (st?.configured) {
        const resp = await BusinessesAPI.syncSalesLast7d(bizId);
        const s = resp?.sales || {};
        showNotice('Ventas sincronizadas',
          `Se sincronizaron ventas (7 días): ${s.from} → ${s.to} · upserted ${s.upserted ?? 0} · updated ${s.updated ?? 0}`);
        window.dispatchEvent(new CustomEvent('business:synced', { detail: { bizId } }));
      } else {
        // opcional: hint si no hay credenciales
        console.info('Maxi no configurado para el nuevo negocio; se omite auto-sync 7d.');
      }
    } catch (e) {
      console.error('Auto-sync ventas 7d (nuevo negocio) falló:', e);
    } finally {
      // Notificar a listeners (AdminActionsSidebar, etc.)
      try { window.dispatchEvent(new CustomEvent('business:created', { detail: { id: bizId } })); } catch {}
    }
  };

  const onCreateComplete = async (biz) => {
    setItems(prev => [biz, ...prev]);
    setShowCreate(false);
    await onSetActive(biz.id);
    window.dispatchEvent(new CustomEvent("business:list:updated"));

    // 🔁 Intentar auto-sync de ventas 7 días para el nuevo negocio
    try { await tryAutoSyncNewBusiness(biz.id); } catch {}
  };

  const onSaved = (saved) => {
    setItems(prev => prev.map(i => String(i.id) === String(saved.id) ? { ...i, ...saved } : i));
    setEditing(null);
    window.dispatchEvent(new CustomEvent("business:list:updated"));
  };

  const onOpenSync = async (biz) => {
    const prev = localStorage.getItem('activeBusinessId');
    try {
      // asegura contexto X-Business-Id para este biz
      localStorage.setItem('activeBusinessId', String(biz.id));

      const resp = await BusinessesAPI.syncNow(biz.id, { scope: 'articles' });
      window.dispatchEvent(new CustomEvent('business:synced', { detail: { bizId: biz.id } }));
      await load();

      const up = Number(resp?.upserted ?? 0);
      const mp = Number(resp?.mapped ?? 0);
      showNotice('Sincronización completada', `Sync OK. Artículos: ${up} · Mapeos: ${mp}`);
      return resp;
    } catch (e) {
      const msg = String(e?.message || '');
      const friendly = msg.includes('401')
        ? 'Maxi devolvió 401: credenciales inválidas o token caído. Revisá email/clave/codcli del local.'
        : (msg || 'No se pudo sincronizar.');
      showNotice('No se pudo sincronizar', friendly);
      throw e;
    } finally {
      // restaurar activo anterior
      if (prev) localStorage.setItem('activeBusinessId', prev);
      else localStorage.removeItem('activeBusinessId');
    }
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
          <button className="cta-wide" onClick={() => setShowCreate(true)}>
            Nuevo Local
          </button>
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
              onOpenSync={onOpenSync}
              showNotice={showNotice}
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
          display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:center;
          background:var(--color-surface,#fff); border:1px solid var(--color-border,#e5e7eb);
          border-radius:14px; padding:12px 14px;
        }
        .avatar{width:56px;height:56px;border-radius:999px;background:#e5e7eb}
        .who h1{margin:0 0 4px 0; font-size:14px; color:#64748b; font-weight:800}
        .who h2{margin:0; font-size:18px; font-weight:800}
        .who .mail{font-size:12px; color:#6b7280}

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
        .admin-tools{opacity:.7}
        .avatar{
          width:56px;height:56px;border-radius:999px;display:grid;place-items:center;background:#e5e7eb;
        }
        .biz-avatar{
          border:1px solid var(--color-border,#e5e7eb);
          box-shadow: 0 1px 0 rgba(0,0,0,.03) inset;
        }
        .biz-avatar-initial{
          font-weight:900;font-size:20px;line-height:1;letter-spacing:.5px;text-transform:uppercase;
        }
      `}</style>
    </div>
  );
}
