/* eslint-disable no-empty */
import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../../servicios/apiAdmin';

const Kpi = ({ title, value }) => (
  <div className="kpi">
    <div className="kpi-title">{title}</div>
    <div className="kpi-value">{value}</div>
    <style>{`
      .kpi{
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 14px 16px;
      }
      .kpi-title{ color: color-mix(in srgb, var(--color-fg) 60%, transparent); font-size: 12px; }
      .kpi-value{ font-size: 28px; font-weight: 800; color: var(--color-fg) }
    `}</style>
  </div>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    AdminAPI.overview().then(setData).catch(console.error);
  }, []);

  if (!data) return <div style={{ color: 'var(--color-fg)' }}>Cargando…</div>;

  return (
    <div className="ad-wrap">
      <header className="ad-hdr">
        <h1>Dashboard</h1>
      </header>

      <section className="ad-grid">
        <Kpi title="Usuarios totales" value={data.totals.users} />
        <Kpi title="Usuarios activos" value={data.totals.active_users} />
        <Kpi title="Negocios" value={data.totals.businesses} />
      </section>

      <section>
        <h3 className="ad-sub">Usuarios recientes</h3>
        <div className="list-card">
          {data.recentUsers.map(u => (
            <div key={u.id} className="row">
              <div className="avatar">{(u.name || u.email || '?')[0]?.toUpperCase()}</div>
              <div className="col">
                <div className="name">{u.name || '—'}</div>
                <div className="sub">{u.email} · {u.role}</div>
              </div>
              <span className={`badge ${u.status === 'active' ? 'ok' : 'warn'}`}>
                {u.status}
              </span>
            </div>
          ))}
          {!data.recentUsers?.length && <div className="empty">Sin actividad reciente.</div>}
        </div>
      </section>

      <style>{`
        .ad-wrap{ display:grid; gap:16px; color: var(--color-fg) }
        .ad-hdr h1{ margin: 4px 0 0; text-align:center; font-size:1.1rem; font-weight:800 }
        .ad-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px }
        @media (max-width:900px){ .ad-grid{ grid-template-columns:1fr; } }
        .ad-sub{ margin: 12px 0 8px; font-weight:800; font-size:1rem }
        .list-card{
          background: var(--color-surface); border:1px solid var(--color-border);
          border-radius:12px; overflow:hidden;
        }
        .row{
          display:flex; align-items:center; gap:12px; padding:12px 14px;
          border-top:1px solid var(--color-border);
        }
        .row:first-child{ border-top: 0; }
        .avatar{
          width:36px; height:36px; border-radius:999px; display:grid; place-items:center;
          background: color-mix(in srgb, var(--color-primary) 20%, #fff);
          color: var(--color-fg); font-weight:800;
          border:1px solid var(--color-border);
        }
        .col{ flex:1; min-width:0 }
        .name{ font-weight:700; line-height:1.2 }
        .sub{ color: color-mix(in srgb, var(--color-fg) 55%, transparent); font-size:.9rem }
        .badge{
          border-radius:999px; padding:6px 10px; font-size:.8rem; border:1px solid var(--color-border);
          background:#fff;
        }
        .badge.ok{ background: color-mix(in srgb, var(--color-primary) 18%, #fff); color:#0a3620 }
        .badge.warn{ background: #fff3f3; color:#b42318; border-color:#ffd8d8 }
        .empty{ padding:14px; color: color-mix(in srgb, var(--color-fg) 60%, transparent) }
      `}</style>
    </div>
  );
}
