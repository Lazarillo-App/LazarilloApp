import React, { useEffect, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import { BASE } from '../servicios/apiBase';

export default function Perfil() {
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  // cargar usuario
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json();
        if (res.ok) setMe(data);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const load = async () => {
    try {
      const list = await BusinessesAPI.listMine();
      setItems(list);
      if (!list.length) setShowCreate(true);
    } catch (e) {
      console.error(e);
      setItems([]);
    }
  };
  useEffect(() => { load(); }, []);

  const onSetActive = async (id) => {
    try {
      await BusinessesAPI.select(id);
      localStorage.setItem('activeBusinessId', id);
      setActiveId(id);
    } catch (e) { console.error(e); alert('No se pudo activar.'); }
  };

  const onDelete = async (biz) => {
    if (!confirm(`Eliminar "${biz.name}"?`)) return;
    try {
      await BusinessesAPI.remove(biz.id);
      setItems(prev => prev.filter(i => String(i.id)!==String(biz.id)));
      if (String(activeId) === String(biz.id)) {
        localStorage.removeItem('activeBusinessId');
        setActiveId('');
      }
    } catch (e) { console.error(e); alert('No se pudo eliminar.'); }
  };

  const onCreateComplete = (biz) => {
    setItems(prev => [biz, ...prev]);
    setShowCreate(false);
    onSetActive(biz.id);
  };

  const onSaved = (saved) => {
    setItems(prev => prev.map(i => String(i.id)===String(saved.id) ? saved : i));
    setEditing(null);
  };

  return (
    <div className="perfil">
      <div className="hdr">
        <h1>Mi perfil</h1>
        <button className="btn" onClick={() => setShowCreate(true)}>+ Nuevo local</button>
      </div>

      {/* Panel usuario */}
      {me && (
        <div className="user-card">
          <div className="user-avatar">{(me.name?.[0] || me.email?.[0] || 'U').toUpperCase()}</div>
          <div className="user-info">
            <div className="name">{me.name || 'Sin nombre'}</div>
            <div className="email">{me.email}</div>
          </div>
        </div>
      )}

      <h2 className="sub">Mis locales</h2>
      <div className="grid">
        {items.map(biz => (
          <BusinessCard
            key={biz.id}
            biz={biz}
            activeId={activeId}
            onSetActive={onSetActive}
            onEdit={setEditing}
            onDelete={onDelete}
          />
        ))}
        {!items.length && <div className="empty">Aún no tenés locales. Creá el primero.</div>}
      </div>

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

      <style>{`
        .perfil{padding:16px}
        .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
        .btn{background:#111;color:#fff;border:0;border-radius:10px;padding:10px 14px;cursor:pointer}

        .user-card{display:flex;gap:12px;align-items:center;border:1px solid #eee;border-radius:12px;padding:12px;margin-bottom:14px}
        .user-avatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#0ea5e9;color:#fff;font-weight:700}
        .user-info .name{font-weight:700}
        .user-info .email{color:#666;font-size:.9rem}

        .sub{margin:8px 0 12px}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
        .empty{color:#666;border:2px dashed #e0e0e0;border-radius:12px;padding:24px;text-align:center}
      `}</style>
    </div>
  );
}
