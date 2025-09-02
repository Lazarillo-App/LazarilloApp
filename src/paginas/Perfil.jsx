// src/paginas/Perfil.jsx
import React, { useEffect, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';

export default function Perfil() {
  const [items, setItems] = useState([]); // siempre array
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const list = await BusinessesAPI.listMine(); // ← ya es array
      setItems(list);
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
    if (!confirm(`Eliminar "${biz.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await BusinessesAPI.remove(biz.id);
      setItems(prev => prev.filter(i => String(i.id) !== String(biz.id)));
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
    setItems(prev => prev.map(i => String(i.id) === String(saved.id) ? saved : i));
    setEditing(null);
  };

  return (
    <div className="perfil">
      <div className="hdr">
        <h1>Mi perfil</h1>
        <button className="btn" onClick={() => setShowCreate(true)}>+ Nuevo local</button>
      </div>

      <h2 className="sub">Mis locales</h2>
      <div className="grid">
        {(items).map(biz => (
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
    </div>
  );
}
