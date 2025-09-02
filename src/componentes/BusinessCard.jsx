import React from 'react';

export default function BusinessCard({ biz, activeId, onSetActive, onEdit, onDelete }) {
  const branding = biz?.props?.branding || {};
  const bg = branding.background || '#fafafa';
  const prim = branding.primary || '#222';
  const sec = branding.secondary || '#999';
  const logo = branding.logo_url;

  const isActive = String(activeId) === String(biz.id);

  return (
    <div className="biz-card" style={{ borderColor: prim }}>
      <div className="banner" style={{ background: bg, borderBottomColor: prim }}>
        {logo ? (
          <img src={logo} alt={biz.name} className="logo" />
        ) : (
          <div className="avatar" style={{ background: prim }}>{(biz.name||'?')[0]?.toUpperCase()}</div>
        )}
      </div>
      <div className="body">
        <div className="title">{biz.name}</div>
        <div className="slug">/{biz.slug}</div>
        <div className="colors">
          <span title="Primario" style={{ background: prim }} />
          <span title="Secundario" style={{ background: sec }} />
          <span title="Fondo" style={{ background: bg }} />
        </div>
      </div>
      <div className="actions">
        {!isActive ? (
          <button className="btn" onClick={() => onSetActive(biz.id)}>Activar</button>
        ) : (
          <span className="badge">Activo</span>
        )}
        <button className="btn ghost" onClick={() => onEdit(biz)}>Editar</button>
        <button className="btn danger" onClick={() => onDelete(biz)}>Eliminar</button>
      </div>

      <style>{`
        .biz-card{width:300px;border:2px solid #e6e6e6;border-radius:14px;overflow:hidden;background:#fff;display:flex;flex-direction:column}
        .banner{height:110px;display:grid;place-items:center;border-bottom:2px solid;position:relative}
        .logo{width:88px;height:88px;object-fit:cover;border-radius:14px;border:2px solid #fff;box-shadow:0 4px 20px #0003}
        .avatar{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:28px}
        .body{padding:10px 12px}
        .title{font-weight:700}
        .slug{color:#777;font-size:.9rem;margin-top:2px}
        .colors{display:flex;gap:6px;margin-top:8px}
        .colors span{width:18px;height:18px;border-radius:4px;border:1px solid #0002}
        .actions{display:flex;gap:8px;justify-content:flex-end;padding:10px 12px}
        .btn{background:#111;color:#fff;border:0;border-radius:8px;padding:8px 10px;cursor:pointer}
        .btn.ghost{background:#f3f4f6;color:#111}
        .btn.danger{background:#e03131}
        .badge{background:#2ecc71;color:#fff;border-radius:999px;padding:6px 10px;font-size:.85rem}
      `}</style>
    </div>
  );
}
