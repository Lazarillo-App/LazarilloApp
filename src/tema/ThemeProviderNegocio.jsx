/* eslint-disable react-refresh/only-export-components */
/* eslint-disable no-empty */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';

const Ctx = createContext(null);
export const useBizTheme = () => useContext(Ctx);

const DEFAULTS = {
  name: 'Default',
  primary: '#3b82f6',
  secondary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  fg: '#1a4f67',
  bg: '#ffffff',
  surface: '#f8fafc',
  border: '#e2e8f0',
  hover: 'rgba(40,90,115,.10)',
  font: 'Inter, system-ui, sans-serif',
};

/* ---------- helpers ---------- */
const currentUser = () => {
  try { return (JSON.parse(localStorage.getItem('user') || 'null') || null); }
  catch { return null; }
};
const currentUserId = () => currentUser()?.id || null;
const currentRole = () => currentUser()?.role || null;

const HEX6 = /^#([0-9a-fA-F]{6})$/;
const isHex6 = (v) => typeof v === 'string' && HEX6.test(v);
const coerceHex = (v, fb) => (isHex6(v) ? v : (isHex6(fb) ? fb : '#000000'));
const safeStr  = (v, fb = '') => (typeof v === 'string' && v.length ? v : fb);

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [0,0,0];
};
const relLum = ([r,g,b]) => {
  const s = [r,g,b].map(v=>v/255).map(u=>u<=.03928?u/12.92:Math.pow((u+.055)/1.055,2.4));
  return .2126*s[0]+.7152*s[1]+.0722*s[2];
};
const contrast = (a,b) => {
  const [L1,L2] = [relLum(a), relLum(b)];
  const [hi,lo] = L1>L2 ? [L1,L2] : [L2,L1];
  return (hi+.05)/(lo+.05);
};
const bestOn = (bgHex) =>
  contrast(hexToRgb(bgHex), [255,255,255]) >= contrast(hexToRgb(bgHex), [0,0,0]) ? '#fff' : '#000';

const supportsColorMix = (() => {
  try { return CSS && CSS.supports?.('color', 'color-mix(in srgb, #000 50%, #fff)'); }
  catch { return false; }
})();

function applyCssVars(p) {
  const t = { ...DEFAULTS, ...(p || {}) };

  const primary   = coerceHex(t.primary,   DEFAULTS.primary);
  const secondary = coerceHex(t.secondary, DEFAULTS.secondary);
  const success   = coerceHex(t.success,   DEFAULTS.success);
  const warning   = coerceHex(t.warning,   DEFAULTS.warning);
  const error     = coerceHex(t.error,     DEFAULTS.error);
  const fg        = coerceHex(t.fg ?? DEFAULTS.fg, DEFAULTS.fg);
  const bg        = coerceHex(t.bg ?? DEFAULTS.bg, DEFAULTS.bg);
  const surface   = coerceHex(t.surface ?? DEFAULTS.surface, DEFAULTS.surface);
  const border    = coerceHex(t.border  ?? DEFAULTS.border,  DEFAULTS.border);
  const font      = safeStr(t.font, DEFAULTS.font);

  const root = document.documentElement;
  if (!root || !root.style) return;

  root.style.setProperty('--color-primary',   primary);
  root.style.setProperty('--color-secondary', secondary);
  root.style.setProperty('--color-success',   success);
  root.style.setProperty('--color-warning',   warning);
  root.style.setProperty('--color-error',     error);
  root.style.setProperty('--color-fg',        fg);
  root.style.setProperty('--color-bg',        bg);
  root.style.setProperty('--color-surface',   surface);
  root.style.setProperty('--color-border',    border);
  root.style.setProperty('--app-font',        font);

  root.style.setProperty('--on-primary',   bestOn(primary));
  root.style.setProperty('--on-secondary', bestOn(secondary));

  const hover = supportsColorMix
    ? `color-mix(in srgb, ${secondary} 18%, transparent)`
    : 'rgba(0,0,0,.06)';
  root.style.setProperty('--color-hover',  hover);
}

/* ---------- mapping branding -> palette ---------- */
export const brandingToPalette = (br = {}) => ({
  name     : 'Custom',
  primary  : coerceHex(br.primary,   DEFAULTS.primary),
  secondary: coerceHex(br.secondary, DEFAULTS.secondary),
  bg       : coerceHex(br.background,DEFAULTS.bg),
  surface  : DEFAULTS.surface,
  border   : DEFAULTS.border,
  fg       : coerceHex(br.fg ?? br.primary, DEFAULTS.fg),
  hover    : undefined,
  font     : safeStr(br.font, DEFAULTS.font),
  logo_url : br.logo_url ?? null,
});

const getActiveBizId = () => localStorage.getItem('activeBusinessId') || '';

export function ThemeProviderNegocio({ children, activeBizId }) {
  const uid = currentUserId();
  const role = currentRole();

  const bizIdInitial = String(activeBizId || getActiveBizId() || '');
  const keyFor = (bizId) => (uid ? `bizTheme:${uid}:${bizId}` : `bizTheme:${bizId}`);
  const CURRENT_KEY = 'bizTheme:current'; // espejo para evitar flash en recarga

  // 1) hidratar desde cache por-biz (o espejo current) para evitar “flash”
  const initialFromLS = (() => {
    try {
      const k = bizIdInitial ? keyFor(bizIdInitial) : CURRENT_KEY;
      return JSON.parse(localStorage.getItem(k) || localStorage.getItem(CURRENT_KEY) || 'null') || DEFAULTS;
    } catch { return DEFAULTS; }
  })();

  const [palette, setPalette] = useState(initialFromLS);
  const [bizId, setBizId] = useState(bizIdInitial);
  const lastAppliedRef = useRef(''); // evita loops inútiles

  useEffect(() => { applyCssVars(palette); }, [palette]);

  const persistPalette = (p, targetBizId) => {
    try {
      if (targetBizId) localStorage.setItem(keyFor(targetBizId), JSON.stringify(p));
      localStorage.setItem(CURRENT_KEY, JSON.stringify(p));
    } catch {}
  };

  const setPaletteForBiz = (p, { persist = false, biz = bizId } = {}) => {
    const cleaned = {
      ...p,
      primary  : coerceHex(p?.primary,   DEFAULTS.primary),
      secondary: coerceHex(p?.secondary, DEFAULTS.secondary),
      bg       : coerceHex(p?.bg,        DEFAULTS.bg),
      surface  : coerceHex(p?.surface ?? DEFAULTS.surface, DEFAULTS.surface),
      border   : coerceHex(p?.border  ?? DEFAULTS.border,  DEFAULTS.border),
      fg       : coerceHex(p?.fg ?? p?.primary ?? DEFAULTS.fg, DEFAULTS.fg),
      font     : safeStr(p?.font, DEFAULTS.font),
      logo_url : p?.logo_url ?? null,
    };

    const sig = JSON.stringify(cleaned);
    if (lastAppliedRef.current === sig) return;
    lastAppliedRef.current = sig;

    setPalette(cleaned);
    applyCssVars(cleaned);
    if (persist) persistPalette(cleaned, biz);
  };

  // 2) cuando cambia activeBizId (prop o LS), cargar cache o backend
  useEffect(() => {
    const nextId = String(activeBizId || getActiveBizId() || '');
    if (nextId === bizId) return;
    setBizId(nextId);

    // app_admin no usa tema por negocio
    if (role === 'app_admin' || !nextId) {
      setPaletteForBiz(DEFAULTS, { persist: true, biz: nextId });
      return;
    }

    // primero cache local
    try {
      const cached = JSON.parse(localStorage.getItem(keyFor(nextId)) || 'null');
      if (cached) { setPaletteForBiz(cached, { persist: false, biz: nextId }); return; }
    } catch {}

    // luego backend
    (async () => {
      try {
        const biz = await BusinessesAPI.get(nextId);
        const br  = biz?.props?.branding || biz?.branding || null;
        if (br) setPaletteForBiz(brandingToPalette(br), { persist: true, biz: nextId });
        else    setPaletteForBiz(DEFAULTS, { persist: true, biz: nextId });
      } catch {
        setPaletteForBiz(DEFAULTS, { persist: true, biz: nextId });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBizId]);

  // 3) eventos globales: switched / branding-updated / logout
  useEffect(() => {
    const onSwitch = () => {
      const id = getActiveBizId();
      if (!id) return;

      if (role === 'app_admin') {
        setPaletteForBiz(DEFAULTS, { persist: true, biz: id });
        return;
      }

      try {
        const cached = JSON.parse(localStorage.getItem(keyFor(id)) || 'null');
        if (cached) { setBizId(id); setPaletteForBiz(cached, { persist: false, biz: id }); return; }
      } catch {}

      (async () => {
        try {
          const biz = await BusinessesAPI.get(id);
          const br  = biz?.props?.branding || biz?.branding || null;
          if (br) { setBizId(id); setPaletteForBiz(brandingToPalette(br), { persist: true, biz: id }); }
        } catch {}
      })();
    };

    const onBrandingUpdated = (e) => {
      const id = getActiveBizId();
      if (!id || role === 'app_admin') return;
      const br = e?.detail?.branding || null;
      if (!br) return;
      setBizId(id);
      setPaletteForBiz(brandingToPalette(br), { persist: true, biz: id });
    };

    const onLogout = () => {
      try { localStorage.removeItem('bizTheme:current'); } catch {}
      lastAppliedRef.current = '';
      setPalette(DEFAULTS);
      applyCssVars(DEFAULTS);
    };

    window.addEventListener('business:switched', onSwitch);
    window.addEventListener('business:branding-updated', onBrandingUpdated);
    window.addEventListener('auth:logout', onLogout);
    return () => {
      window.removeEventListener('business:switched', onSwitch);
      window.removeEventListener('business:branding-updated', onBrandingUpdated);
      window.removeEventListener('auth:logout', onLogout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const value = useMemo(() => ({ palette, setPaletteForBiz }), [palette]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
