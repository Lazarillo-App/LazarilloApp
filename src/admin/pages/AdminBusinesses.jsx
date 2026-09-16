/* eslint-disable no-empty */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAPI } from '../../servicios/apiAdmin';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const BRAND = { tinta: '#15213E', celeste: '#5BC2EA', paper: '#F2F4F7', celesteProfundo: '#2492C8' };

function useBusinesses() {
  const [state, setState] = useState({ rows: [], total: 0, page: 1, pageSize: 20, q: '' });
  const refetch = async (patch = {}) => {
    const next = { ...state, ...patch };
    setState(next);
    try {
      const res = await AdminAPI.listBusinesses({ q: next.q, page: next.page, pageSize: next.pageSize });
      setState(s => ({ ...s, ...res }));
    } catch {}
  };
  useEffect(() => { refetch({}); }, []);
  return { state, setState, refetch };
}

export default function AdminBusinesses() {
  const { state, setState, refetch } = useBusinesses();
  const nav = useNavigate();

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '20px 28px', borderBottom: '0.5px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: BRAND.tinta }}>
          Negocios
        </h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
          {state.total} negocios registrados
        </p>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: 10, border: '0.5px solid #e2e8f0' }}>
          <SearchIcon style={{ color: '#94a3b8', fontSize: 20 }} />
          <input
            value={state.q}
            onChange={e => setState(s => ({ ...s, q: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && refetch({ page: 1 })}
            placeholder="Buscar por nombre de negocio…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: BRAND.tinta, background: 'transparent' }}
          />
          <button
            onClick={() => refetch({ page: 1 })}
            style={{ background: BRAND.celesteProfundo, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Buscar
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 180px 200px 24px',
            padding: '10px 16px', background: BRAND.paper,
            borderBottom: '0.5px solid #e2e8f0', gap: 12,
          }}>
            {['Negocio', 'Organización', 'Dueño', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
            ))}
          </div>

          {state.rows.length === 0 && (
            <p style={{ padding: '24px 16px', margin: 0, fontSize: 13, color: '#94a3b8' }}>Sin resultados.</p>
          )}

          {state.rows.map(b => (
            <div
              key={b.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 180px 200px 24px',
                padding: '10px 16px', gap: 12, alignItems: 'center',
                borderTop: '0.5px solid #f8fafc', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              onClick={() => nav(`/admin/negocios/${b.id}`)}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: BRAND.tinta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name || '—'}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>ID: {b.id}</p>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.organization_name || '—'}</p>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, color: BRAND.tinta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.owner_name || '—'}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.owner_email || ''}</p>
              </div>
              <ChevronRightIcon style={{ fontSize: 18, color: '#cbd5e1' }} />
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
