// src/componentes/BusinessSwitcher.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BusinessesAPI } from "@/servicios/apiBusinesses";

export default function BusinessSwitcher({ onSwitched, className = '' }) {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const hasToken = useMemo(() => !!localStorage.getItem('token'), []);

  useEffect(() => {
    if (!hasToken) return;
    let alive = true;
    (async () => {
      const resp = await BusinessesAPI.listMine(); // {items:[...]} o array
      const list = Array.isArray(resp) ? resp : (resp?.items || []);
      if (!alive) return;
      setItems(list);
      if (!activeId && list[0]?.id) {
        localStorage.setItem('activeBusinessId', list[0].id);
        setActiveId(list[0].id);
      }
    })().catch(console.error);
    return () => { alive = false; };
  }, [hasToken, activeId]);

  // cerrar dropdown al click fuera
  useEffect(() => {
    const onDoc = (e) => { if (open && ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = items.find(b => String(b.id) === String(activeId));

  const pick = async (id) => {
    try {
      await BusinessesAPI.select(id);
      localStorage.setItem('activeBusinessId', id);
      setActiveId(id);
      setOpen(false);
      onSwitched?.(id);
    } catch (e) {
      console.error(e);
      alert('No se pudo cambiar de local');
    }
  };

  if (!hasToken) return null;

  return (
    <div className={`biz-avatar ${className}`} ref={ref}>
      <button className="btn" onClick={() => setOpen(v=>!v)} title="Cambiar de local">
        <div className="circle">{(current?.name || 'L')[0]?.toUpperCase()}</div>
      </button>

      {open && (
        <div className="menu">
          <div className="hdr">Mis locales</div>
          <div className="list">
            {items.map(it => (
              <button
                key={it.id}
                className={`item ${String(it.id)===String(activeId) ? 'active' : ''}`}
                onClick={() => pick(it.id)}
              >
                <span className="dot" />
                <span className="name">{it.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .btn{background:transparent;border:0;padding:0;cursor:pointer}
        .circle{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;
          background:#222;color:#fff;font-weight:700}
        .menu{position:absolute;right:0;top:40px;background:#fff;border:1px solid #e6e6e6;
          border-radius:12px;box-shadow:0 10px 30px #0002;min-width:260px;z-index:9999}
        .hdr{padding:10px 12px;font-weight:600;border-bottom:1px solid #f1f1f1}
        .list{max-height:280px;overflow:auto}
        .item{width:100%;text-align:left;padding:10px 12px;background:#fff;border:0;
          display:flex;align-items:center;gap:8px;cursor:pointer}
        .item:hover{background:#fafafa}
        .item.active{background:#f0f8ff}
        .dot{width:8px;height:8px;border-radius:50%;background:#2ecc71}
        .name{flex:1}
        .sep{height:1px;background:#f1f1f1;margin:4px 0}
        .new{font-weight:600}
      `}</style>
    </div>
  );
}
