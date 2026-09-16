/* eslint-disable no-empty */
import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../../servicios/apiAdmin';

const BRAND = { tinta: '#15213E', paper: '#F2F4F7' };

const ACTION_LABEL = { create: 'Creación', update: 'Actualización', delete: 'Eliminación', restore: 'Restauración', reassign: 'Reasignación', view: 'Vista (solo lectura)' };

export default function AdminAuditoria() {
  const [state, setState] = useState({ rows: [], total: 0, page: 1, pageSize: 30, entityType: '' });

  const refetch = async (patch = {}) => {
    const next = { ...state, ...patch };
    setState(next);
    try {
      const res = await AdminAPI.listAudit(next);
      setState(s => ({ ...s, ...res }));
    } catch {}
  };

  useEffect(() => { refetch({}); }, []);

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '20px 28px', borderBottom: '0.5px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: BRAND.tinta }}>
          Historial de acciones
        </h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
          {state.total} acciones registradas
        </p>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={state.entityType}
            onChange={e => refetch({ entityType: e.target.value, page: 1 })}
            style={{ border: '0.5px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: BRAND.tinta, background: '#fff', cursor: 'pointer' }}
          >
            <option value="">Todos los tipos</option>
            <option value="app_user">Usuarios</option>
            <option value="business">Negocios</option>
            <option value="team_member">Staff</option>
            <option value="platform">Plataforma</option>
          </select>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 120px 1fr 160px 160px',
            padding: '10px 16px', background: BRAND.paper,
            borderBottom: '0.5px solid #e2e8f0', gap: 12,
          }}>
            {['Fecha', 'Acción', 'Entidad', 'Realizado por', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
            ))}
          </div>

          {state.rows.length === 0 && (
            <p style={{ padding: '24px 16px', margin: 0, fontSize: 13, color: '#94a3b8' }}>Sin acciones registradas.</p>
          )}

          {state.rows.map(a => (
            <div key={a.id} style={{
              display: 'grid', gridTemplateColumns: '140px 120px 1fr 160px 160px',
              padding: '10px 16px', gap: 12, alignItems: 'center', borderTop: '0.5px solid #f8fafc', fontSize: 12,
            }}>
              <span style={{ color: '#64748b' }}>{a.created_at ? new Date(a.created_at).toLocaleString('es-AR') : ''}</span>
              <span style={{ color: BRAND.tinta, fontWeight: 600 }}>{ACTION_LABEL[a.action] || a.action}</span>
              <span style={{ color: '#64748b' }}>{a.entity_type} #{a.entity_id}</span>
              <span style={{ color: '#64748b' }}>{a.admin_name || a.admin_email}</span>
              <span style={{ color: '#94a3b8' }}>{a.metadata?.reason || a.metadata?.source || ''}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Página {state.page}</span>
          <button
            disabled={state.page <= 1}
            onClick={() => refetch({ page: state.page - 1 })}
            style={{ border: '0.5px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: '#fff', color: BRAND.tinta }}
          >← Anterior</button>
          <button
            disabled={state.page * state.pageSize >= state.total}
            onClick={() => refetch({ page: state.page + 1 })}
            style={{ border: '0.5px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: '#fff', color: BRAND.tinta }}
          >Siguiente →</button>
        </div>
      </div>
    </div>
  );
}
