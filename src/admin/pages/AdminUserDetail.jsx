/* eslint-disable no-empty */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminAPI } from '../../servicios/apiAdmin';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';

export default function AdminUserDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ businesses: 0 });
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isAppAdmin = useMemo(() => String(user?.role) === 'app_admin', [user]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // preferimos un endpoint directo; si no existe caemos a listUsers()
        let u = null;
        try { u = await AdminAPI.getUser(id); } catch {}
        if (!u) {
          const res = await AdminAPI.listUsers({ q: '', page: 1, pageSize: 1000 });
          u = (res?.rows || []).find(x => String(x.id) === String(id)) || null;
        }
        if (!alive) return;
        setUser(u);

        // KPIs (cantidad de locales del usuario). Intenta endpoint específico, sino 0.
        try {
          const bs = await AdminAPI.userBusinesses?.(id);
          if (alive && bs) setStats({ businesses: Array.isArray(bs) ? bs.length : (bs.total || 0) });
        } catch { setStats(s => ({ ...s, businesses: 0 })); }

        // Actividad (si no hay endpoint, queda vacío)
        try {
          const acts = await AdminAPI.userActivity?.(id);
          if (alive && acts) setActivity(acts || []);
        } catch { setActivity([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div style={{ color: 'var(--color-fg)' }}>Cargando…</div>;
  if (!user) return <div style={{ color: 'var(--color-fg)' }}>Usuario no encontrado.</div>;

  const initial = (user.name || user.email || '?')[0]?.toUpperCase();

  return (
    <div className="ud-wrap">
      {/* Header sticky con back */}
      <header className="ud-hdr">
        <button className="ghost" onClick={() => nav(-1)} title="Volver">
          <ArrowBackIosNewIcon fontSize="small" />
        </button>
        <div className="hdr-title">Detalles del usuario</div>
        <div style={{ width: 34 }} /> {/* spacer */}
      </header>

      {/* Perfil */}
      <section className="ud-top">
        <div className="avatar">{initial}</div>
        <div className="id-block">
          <div className="name">{user.name || '—'}</div>
          <div className="sub">ID: {user.id} · Rol: {user.role}</div>
        </div>
        <div className="mini-kpis">
          <div className="kpi">
            <div className="k-title">Locales</div>
            <div className="k-value">{stats.businesses}</div>
          </div>
          <div className={`pill ${user.status === 'active' ? 'ok' : user.status === 'suspended' ? 'warn' : 'del'}`}>
            {user.status}
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section className="card">
        <div className="card-title">Información de contacto</div>
        <div className="rows">
          <div className="row">
            <div className="label">Teléfono</div>
            <div className="value">{user.phone || '—'}</div>
          </div>
          <div className="row">
            <div className="label">Correo</div>
            <div className="value">{user.email}</div>
          </div>
          <div className="row">
            <div className="label">Dirección</div>
            <div className="value">{user.address || '—'}</div>
          </div>
        </div>
      </section>

      {/* Actividad */}
      <section className="card">
        <div className="card-title">Historial de actividad</div>
        <div className="act-list">
          {activity.length ? activity.map((a, i) => (
            <div key={i} className="act-item">
              <div className="dot" />
              <div className="a-col">
                <div className="a-title">{a.title || a.type || 'Evento'}</div>
                <div className="a-sub">{a.when || a.date || ''} {a.meta ? `· ${a.meta}` : ''}</div>
              </div>
            </div>
          )) : (
            <div className="empty">Sin actividad registrada.</div>
          )}
        </div>
      </section>

      {/* Barra de acciones inferior */}
      <footer className="ud-actions">
        <button
          className="btn ghost"
          disabled={busy}
          onClick={async () => {
            // reset de contraseña rápido
            setBusy(true);
            try {
              const r = await AdminAPI.resetPassword(user.id);
              alert(`Token temporal: ${r.token_preview}`);
            } finally { setBusy(false); }
          }}
          title="Restablecer contraseña"
        >
          <RestartAltIcon fontSize="small" />
          <span>Restablecer</span>
        </button>

        {user.status === 'deleted' ? (
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await AdminAPI.restoreUser(user.id); nav('/admin/usuarios', { replace: true }); }
              finally { setBusy(false); }
            }}
          >
            Restaurar
          </button>
        ) : (
          <button
            className="btn danger"
            disabled={busy || isAppAdmin}
            title={isAppAdmin ? 'No se puede eliminar un administrador general' : 'Eliminar'}
            onClick={async () => {
              if (!confirm('¿Eliminar este usuario?')) return;
              setBusy(true);
              try { await AdminAPI.deleteUser(user.id); nav('/admin/usuarios', { replace: true }); }
              finally { setBusy(false); }
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
            <span>Eliminar</span>
          </button>
        )}
      </footer>

      <style>{`
        .ud-wrap{ max-width: 980px; margin: 0 auto; padding-bottom: 76px; color: var(--color-fg) }

        .ud-hdr{
          position: sticky; top: 0; z-index: 5;
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 8px; background: color-mix(in srgb, var(--color-bg) 92%, white);
          border-bottom:1px solid var(--color-border);
        }
        .ud-hdr .ghost{
          border:0; background:transparent; width:34px; height:34px; border-radius:10px;
          display:grid; place-items:center; color: var(--color-fg); cursor:pointer;
        }
        .hdr-title{ font-weight:800; font-size:.95rem }

        .ud-top{
          display:flex; align-items:center; gap:14px; padding:16px 8px 8px;
          flex-wrap:wrap; justify-content:center;
        }
        .avatar{
          width:76px; height:76px; border-radius:999px; display:grid; place-items:center; font-weight:800; font-size:26px;
          background: color-mix(in srgb, var(--color-primary) 18%, #fff);
          border:1px solid var(--color-border);
        }
        .id-block{ text-align:center }
        .name{ font-size:1.15rem; font-weight:800 }
        .sub{ color: color-mix(in srgb, var(--color-fg) 55%, transparent); font-size:.9rem }

        .mini-kpis{ display:flex; gap:10px; margin-left:auto }
        .kpi{ background: var(--color-surface); border:1px solid var(--color-border); border-radius:10px; padding:8px 10px; text-align:center }
        .k-title{ font-size:11px; color: color-mix(in srgb, var(--color-fg) 60%, transparent) }
        .k-value{ font-weight:800; font-size:18px }

        .pill{ border-radius:999px; padding:6px 10px; font-size:.8rem; border:1px solid var(--color-border); background:#fff }
        .pill.ok{ background: color-mix(in srgb, var(--color-primary) 18%, #fff); color:#0a3620 }
        .pill.warn{ background:#fff8e6; color:#a15d00; border-color:#ffdfb0 }
        .pill.del{ background:#fff3f3; color:#b42318; border-color:#ffd8d8 }

        .card{
          background: var(--color-surface); border:1px solid var(--color-border);
          border-radius:12px; margin: 10px 8px; overflow:hidden;
        }
        .card-title{ font-weight:800; padding:12px 14px; border-bottom:1px solid var(--color-border) }
        .rows .row{ display:grid; grid-template-columns: 180px 1fr; gap:8px; padding:12px 14px; border-top:1px solid var(--color-border) }
        .rows .row:first-child{ border-top:0 }
        .label{ color: color-mix(in srgb, var(--color-fg) 60%, transparent) }
        .value{ word-break: break-word }

        .act-list{ padding: 8px 10px }
        .act-item{ display:flex; gap:10px; align-items:flex-start; padding:8px 4px; border-top:1px dashed var(--color-border) }
        .act-item:first-child{ border-top:0 }
        .dot{ width:12px; height:12px; border-radius:999px; background: var(--color-primary); margin-top:6px }
        .a-title{ font-weight:700 }
        .a-sub{ color: color-mix(in srgb, var(--color-fg) 55%, transparent) }

        .ud-actions{
          position: sticky; bottom: 0; display:flex; gap:10px; padding:10px 8px;
          background: color-mix(in srgb, var(--color-bg) 92%, white); border-top:1px solid var(--color-border);
        }
        .btn{
          flex:1; height:44px; border:0; border-radius:10px; cursor:pointer; font-weight:800;
          background: var(--color-primary); color: var(--on-primary); display:flex; align-items:center; gap:8px; justify-content:center;
        }
        .btn.ghost{
          background: color-mix(in srgb, var(--color-primary) 18%, #fff);
          color: var(--color-fg); border:1px solid var(--color-border);
        }
        .btn.danger{
          background:#ef4444; color:#fff;
        }

        @media (max-width: 720px){
          .rows .row{ grid-template-columns: 1fr; }
          .mini-kpis{ width:100%; justify-content:center; margin-top:6px }
        }
      `}</style>
    </div>
  );
}
