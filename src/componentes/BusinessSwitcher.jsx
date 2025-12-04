// src/componentes/BusinessSwitcher.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import { setCssVarsFromPalette } from "@/tema/paletteBoot";
import { setActiveBusiness } from "@/servicios/setActiveBusiness";

function brandingToPalette(br = {}) {
  // ajustá las claves si tu API devuelve otros nombres
  return {
    "color-primary": br.primary || "#111111",
    "color-secondary": br.secondary || "#6366f1",
    "color-bg": br.background || "#ffffff",
    "color-surface": "#ffffff",
    "color-border": "#e5e7eb",
    "color-fg": br.fg || br.primary || "#1f2937"
  };
}

async function fetchBusinessBranding(businessId) {
  // intenta traer branding/paleta del negocio
  // adapta al endpoint real que tengas:
  // const { branding } = await BusinessesAPI.get(businessId);
  // return branding || {};
  try {
    const full = await BusinessesAPI.get?.(businessId);
    return full?.branding || {};
  } catch { return {}; }
}

function applyAndPersistPalette(palette, userId) {
  setCssVarsFromPalette(palette);
  localStorage.setItem("bizTheme", JSON.stringify(palette));
  if (userId) localStorage.setItem(`bizTheme:${userId}`, JSON.stringify(palette));
  window.dispatchEvent(new Event("palette:changed"));
}

export default function BusinessSwitcher({ className = '' }) {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const hasToken = useMemo(() => !!localStorage.getItem('token'), []);
  const userId = useMemo(() => {
    try { return (JSON.parse(localStorage.getItem('user') || 'null') || {}).id } catch { return null }
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    let alive = true;
    (async () => {
      const resp = await BusinessesAPI.listMine(); // {items:[...]} o array
      const list = Array.isArray(resp) ? resp : (resp?.items || []);
      if (!alive) return;
      setItems(list);
      if (!activeId && list[0]?.id) {
        const { biz } = await setActiveBusiness(list[0].id, {
          fetchBiz: true,
          broadcast: true,
        });
        setActiveId(String(list[0].id));
        const branding = biz?.branding || biz?.props?.branding || await fetchBusinessBranding(list[0].id);
        applyAndPersistPalette(brandingToPalette(branding), userId);
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
      // 1) Cambiar negocio activo en backend + localStorage + eventos globales
      const { biz } = await setActiveBusiness(id, {
        fetchBiz: true,   // así ya tenemos el negocio para el branding
        broadcast: true,  // dispara business:switched + palette:changed
      });

      // 2) Aplicar paleta a partir del negocio devuelto
      const branding = biz?.branding || biz?.props?.branding || {};
      const palette = brandingToPalette({
        primary: branding.primary,
        secondary: branding.secondary,
        background: branding.background,
        fg: branding.fg || branding.primary,
      });

      applyAndPersistPalette(palette, userId);

      // 3) Estado local del switcher
      setActiveId(String(id));
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert('No se pudo cambiar de local');
    }
  };

  if (!hasToken) return null;

  return (
    <div className={`biz-avatar ${className}`} ref={ref}>
      <button className="btn" onClick={() => setOpen(v => !v)} title="Cambiar de local">
        <div className="circle">{(current?.name || 'L')[0]?.toUpperCase()}</div>
      </button>

      {open && (
        <div className="menu">
          <div className="hdr">Mis locales</div>
          <div className="list">
            {items.map(it => (
              <button
                key={it.id}
                className={`item ${String(it.id) === String(activeId) ? 'active' : ''}`}
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
