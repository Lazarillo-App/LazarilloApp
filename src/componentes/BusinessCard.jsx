import React, { useMemo, useState } from 'react';

export default function BusinessCard({ biz, activeId, onSetActive, onEdit, onDelete }) {
  // Soporta ambos formatos: biz.branding y biz.props.branding
  const branding = useMemo(
    () => biz?.branding || biz?.props?.branding || {},
    [biz]
  );

  const bg   = branding.background ?? '#fafafa';
  const prim = branding.primary   ?? '#222222';
  const sec  = branding.secondary ?? '#999999';
  const logo = branding.logo_url  ?? '';

  const isActive = String(activeId) === String(biz.id);
  const [imgOk, setImgOk] = useState(true);

  // Texto legible sobre primario/secundario
  const onColor = (hex) => {
    const toRgb = (h)=> {
      const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h||'');
      return m ? [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)] : [0,0,0];
    };
    const rl = ([r,g,b])=>{
      const s=[r,g,b].map(v=>v/255).map(u=>u<=.03928?u/12.92:Math.pow((u+.055)/1.055,2.4));
      return .2126*s[0]+.7152*s[1]+.0722*s[2];
    };
    const c = ([r,g,b],[R,G,B])=>{
      const [L1,L2]=[rl([r,g,b]), rl([R,G,B])]; const hi=Math.max(L1,L2), lo=Math.min(L1,L2);
      return (hi+.05)/(lo+.05);
    };
    return c(toRgb(hex), [255,255,255]) >= c(toRgb(hex), [0,0,0]) ? '#fff' : '#000';
  };

  return (
    <div className="biz-card" style={{ borderColor: prim }}>
      {/* Banda preview: primario + subrayado secundario */}
      <div className="banner" style={{ background: prim, borderBottomColor: sec }}>
        {logo && imgOk ? (
          <img
            src={logo}
            alt={biz.name}
            className="logo"
            onError={() => setImgOk(false)}
            loading="lazy"
          />
        ) : (
          <div className="avatar" style={{ background: sec, color: onColor(sec) }}>
            {(biz.name || '?')[0]?.toUpperCase()}
          </div>
        )}
        <span
          className="badge-font"
          title={`Fuente: ${branding.font || 'Inter, system-ui, sans-serif'}`}
          style={{ color: onColor(prim) }}
        >
          {branding.font ? branding.font.split(',')[0] : 'Inter'}
        </span>
      </div>

      <div className="body">
        <div className="title" title={biz.name}>{biz.name}</div>
        {biz.slug && <div className="slug">/{biz.slug}</div>}

        {/* Paleta: primario / secundario / fondo con códigos */}
        <div className="palette">
          <div className="swatch">
            <span className="dot" style={{ background: prim }} />
            <small>Primario</small>
            <code>{prim}</code>
          </div>
          <div className="swatch">
            <span className="dot" style={{ background: sec }} />
            <small>Secundario</small>
            <code>{sec}</code>
          </div>
          <div className="swatch">
            <span className="dot" style={{ background: bg }} />
            <small>Fondo</small>
            <code>{bg}</code>
          </div>
        </div>
      </div>

      <div className="actions">
        {!isActive ? (
          <button className="btn btn-brand" onClick={() => onSetActive?.(biz.id)}>Activar</button>
        ) : (
          <span className="badge-active">Activo</span>
        )}
        <button className="btn btn-ghost"  onClick={() => onEdit?.(biz)}>Editar</button>
        <button className="btn btn-danger" onClick={() => onDelete?.(biz)}>Eliminar</button>
      </div>

      <style>{`
        .biz-card{
          width:300px; border:2px solid #e6e6e6; border-radius:14px; overflow:hidden;
          background:#fff; display:flex; flex-direction:column;
        }
        .banner{
          height:110px; display:grid; place-items:center; border-bottom:3px solid; position:relative;
        }
        .logo{
          width:88px; height:88px; object-fit:contain; background:#fff; border-radius:12px;
          border:1px solid #0001; box-shadow:0 4px 18px #0002; padding:6px;
        }
        .avatar{
          width:72px; height:72px; border-radius:12px; display:grid; place-items:center; font-weight:800; font-size:28px;
          border:1px solid #0001; box-shadow:0 4px 18px #0002;
        }
        .badge-font{
          position:absolute; right:10px; bottom:8px; font-size:12px; opacity:.9;
          background: rgba(0,0,0,.12); padding:2px 6px; border-radius:999px;
        }
        .body{ padding:10px 12px }
        .title{ font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
        .slug{ color:#667085; font-size:.9rem; margin-top:2px }
        .palette{
          display:flex; gap:10px; margin-top:10px; align-items:center; flex-wrap:wrap;
        }
        .swatch{ display:grid; grid-template-columns:auto; justify-items:start }
        .swatch .dot{
          width:22px; height:22px; border-radius:6px; border:1px solid #0002; margin-bottom:4px;
        }
        .swatch small{ color:#475569; line-height:1; }
        .swatch code{ color:#64748b; font-size:11px; margin-top:2px }
        .actions{ display:flex; gap:8px; justify-content:flex-end; padding:10px 12px }
        .btn{ border:0; border-radius:8px; padding:8px 10px; cursor:pointer; transition:filter .15s }
        .btn-brand{ background: var(--color-primary); color: var(--on-primary); }
        .btn-brand:hover{ filter: brightness(.96) }
        .btn-ghost{ background: var(--color-surface); color: var(--color-fg); border:1px solid var(--color-border); }
        .btn-ghost:hover{ background: color-mix(in srgb, var(--color-secondary) 10%, var(--color-surface)); }
        .btn-danger{ background:#e03131; color:#fff; }
        .btn-danger:hover{ filter: brightness(.96) }
        .badge-active{
          background: var(--color-secondary); color: var(--on-secondary);
          border-radius:999px; padding:6px 10px; font-size:.85rem;
        }
      `}</style>
    </div>
  );
}
