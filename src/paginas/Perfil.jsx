/* eslint-disable no-empty */
// src/paginas/Perfil.jsx
import React, { useEffect, useState } from 'react';
import { Grid } from '@mui/material';
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import AdminActionsSidebar from '../componentes/AdminActionsSidebar';
import SalesSyncPanel from '../componentes/SalesSyncPanel';

export default function Perfil() {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const list = await BusinessesAPI.listMine();
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
      await load();
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


  return (
    <Grid container spacing={4} sx={{ mb: 4 }}>
      <Grid item xs={12} md={3}>
        <div className="space-y-4">
          <AdminActionsSidebar onSynced={load} />
          <SalesSyncPanel
            businessId={Number(activeId) || Number(localStorage.getItem('activeBusinessId')) || null}
            onAfterSync={load}
          />
        </div>
      </Grid>
      <Grid item xs={12} md={9}>
        <div className="perfil">
          <div className="hdr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0, color: 'var(--color-fg)' }}>Mi perfil</h1>
            <button className="btn btn-brand" onClick={() => setShowCreate(true)}>+ Nuevo local</button>
          </div>
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
        </div>
      </Grid>
    </Grid>
  );
}
