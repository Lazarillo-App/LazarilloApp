import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../../servicios/apiAdmin';

const BRAND = {
  tinta:          '#15213E',
  celeste:        '#5BC2EA',
  celesteProfundo:'#2492C8',
  paper:          '#F2F4F7',
};

function fmtDate() {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function KpiCard({ label, value, accentColor }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      padding: '16px 18px',
      border: '0.5px solid #e2e8f0',
      borderTop: accentColor ? `3px solid ${accentColor}` : '0.5px solid #e2e8f0',
    }}>
      <p style={{
        margin: '0 0 8px',
        fontSize: 11, fontWeight: 600,
        color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px',
        fontFamily: "'Archivo', system-ui, sans-serif",
      }}>
        {label}
      </p>
      <p style={{
        margin: 0,
        fontSize: 28, fontWeight: 700,
        color: accentColor || BRAND.tinta,
        fontFamily: "'Sora', system-ui, sans-serif",
      }}>
        {value ?? '—'}
      </p>
    </div>
  );
}

const STATUS_STYLE = {
  active:    { bg: '#e1f5ee', color: '#0F6E56' },
  trial:     { bg: '#e6f1fb', color: '#185FA5' },
  pending:   { bg: '#fef3c7', color: '#d97706' },
  expired:   { bg: '#fff3f3', color: '#b91c1c' },
  suspended: { bg: '#f1f5f9', color: '#475569' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.suspended;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: 20,
      fontFamily: "'Archivo', system-ui, sans-serif",
    }}>
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    AdminAPI.overview()
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: '#fff',
        padding: '20px 28px',
        borderBottom: '0.5px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: "'Sora', system-ui, sans-serif",
            fontSize: 20, fontWeight: 700, color: BRAND.tinta,
          }}>
            Dashboard
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' }}>
            {fmtDate()}
          </p>
        </div>
        {data && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: BRAND.paper, borderRadius: 8, padding: '8px 14px',
          }}>
            <span style={{ fontSize: 18 }}>🏪</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.tinta }}>
              {data.totals.businesses} negocios
            </span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {err && (
          <div style={{
            background: '#fff3f3', border: '0.5px solid #fca5a5',
            borderRadius: 10, padding: '14px 18px',
            fontSize: 14, color: '#b91c1c',
          }}>
            Error al cargar el dashboard. Verificá tu sesión.
          </div>
        )}

        {!data && !err && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', border: '0.5px solid #e2e8f0', height: 78 }} />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12 }}>
              <KpiCard label="Usuarios totales"  value={data.totals.users} />
              <KpiCard label="Activos + demo"    value={data.totals.active_users}  accentColor={BRAND.celeste} />
              <KpiCard label="Pendientes"         value={data.totals.pending_users} accentColor="#f59e0b" />
              <KpiCard label="Vencidos"           value={data.totals.expired_users} accentColor="#ef4444" />
              <KpiCard label="Negocios"           value={data.totals.businesses} />
            </div>

            {/* Usuarios recientes */}
            <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.tinta, fontFamily: "'Sora', system-ui, sans-serif" }}>
                  Usuarios recientes
                </span>
              </div>
              {data.recentUsers.length === 0 && (
                <p style={{ padding: '20px 18px', margin: 0, fontSize: 13, color: '#94a3b8' }}>
                  Sin usuarios recientes.
                </p>
              )}
              {data.recentUsers.map((u, i) => {
                const initial = (u.name || u.email || '?')[0].toUpperCase();
                const colors = ['#E6F1FB/#185FA5', '#E1F5EE/#0F6E56', '#EEEDFE/#3C3489', '#FAEEDA/#633806'].map(s => s.split('/'));
                const [bg, fg] = colors[i % colors.length];
                return (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 18px',
                    borderTop: i > 0 ? '0.5px solid #f8fafc' : 'none',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: bg, color: fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>
                      {initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: BRAND.tinta }}>
                        {u.name || '—'}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email} · {u.role}
                      </p>
                    </div>
                    <StatusBadge status={u.account_status || u.status} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}