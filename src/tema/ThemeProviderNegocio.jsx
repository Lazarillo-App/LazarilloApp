import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';

const Ctx = createContext(null);
export const useBizTheme = () => useContext(Ctx);

const DEFAULTS = {
  name: 'Default',
  primary:  '#3b82f6',
  secondary:'#6366f1',
  success:  '#10b981',
  warning:  '#f59e0b',
  error:    '#ef4444',
  fg:       '#1a4f67',   // texto general
  bg:       '#ffffff',
  surface:  '#f8fafc',
  border:   '#e2e8f0',
  hover:    'rgba(40,90,115,.10)',
  font:     'Inter, system-ui, sans-serif',
};

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||'');
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
const bestOn = (bgHex) => contrast(hexToRgb(bgHex), [255,255,255]) >= contrast(hexToRgb(bgHex), [0,0,0]) ? '#fff' : '#000';

function applyCssVars(p) {
  const t = { ...DEFAULTS, ...(p||{}) };
  const root = document.documentElement;

  root.style.setProperty('--color-primary',   t.primary);
  root.style.setProperty('--color-secondary', t.secondary);
  root.style.setProperty('--color-success',   t.success);
  root.style.setProperty('--color-warning',   t.warning);
  root.style.setProperty('--color-error',     t.error);

  root.style.setProperty('--color-fg',        t.fg);
  root.style.setProperty('--color-bg',        t.bg);
  root.style.setProperty('--color-surface',   t.surface);
  root.style.setProperty('--color-border',    t.border);

  // textos automáticos sobre colores de marca
  root.style.setProperty('--on-primary',   bestOn(t.primary));
  root.style.setProperty('--on-secondary', bestOn(t.secondary));

  // hover derivado del secondary
  root.style.setProperty('--color-hover', `color-mix(in srgb, ${t.secondary} 18%, transparent)`);

  root.style.setProperty('--app-font', t.font);
}

const brandingToPalette = (br = {}) => ({
  name     : 'Custom',
  primary  : br.primary   ?? DEFAULTS.primary,
  secondary: br.secondary ?? DEFAULTS.secondary,
  bg       : br.background?? DEFAULTS.bg,
  surface  : DEFAULTS.surface,
  border   : DEFAULTS.border,
  fg       : br.fg        ?? DEFAULTS.fg,   // texto general estable
  hover    : undefined,                     // lo calcula applyCssVars
  font     : br.font      ?? DEFAULTS.font,
  logo_url : br.logo_url  ?? null,
});


export function ThemeProviderNegocio({ children, activeBizId }) {
  // 1) hidratar desde localStorage ANTES de la primera pintura
  const initialFromLS = (() => {
    try { return JSON.parse(localStorage.getItem('bizTheme') || 'null') || DEFAULTS; }
    catch { return DEFAULTS; }
  })();

  const [palette, setPalette] = useState(initialFromLS);

  // aplicar inmediatamente la paleta inicial (evita “flash” de tema)
 useEffect(() => { applyCssVars(palette); }, [palette]);

  // util para setear y persistir
  const setPaletteForBiz = (p, { persist = false } = {}) => {
    setPalette(p);
    applyCssVars(p); // aplicamos ya mismo
    if (persist) {
      try { localStorage.setItem('bizTheme', JSON.stringify(p)); } catch {}
    }
  };

  // 2) cuando cambia el negocio activo, traemos su branding y lo aplicamos
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const id = activeBizId || localStorage.getItem('activeBusinessId');
      if (!id) return;
      try {
        const biz = await BusinessesAPI.get(id); // admin (sin X-Business-Id)
        const br  = biz?.props?.branding || biz?.branding || null;
        if (!cancelled && br) {
          const pal = brandingToPalette(br);
          setPaletteForBiz(pal, { persist: true });
        }
      } catch (e) {
        // si falla, mantenemos la del LS
        // console.warn('No se pudo cargar tema del negocio', e);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeBizId]);

  // 3) escuchar cambios globales
  useEffect(() => {
    const onSwitch = () => {
      const id = localStorage.getItem('activeBusinessId');
      if (!id) return;
      // re-trigger effect de arriba sin cambiar prop:
      (async () => {
        try {
          const biz = await BusinessesAPI.get(id);
          const br  = biz?.props?.branding || biz?.branding || null;
          if (br) setPaletteForBiz(brandingToPalette(br), { persist: true });
        } catch {}
      })();
    };
    window.addEventListener('business:switched', onSwitch);
    window.addEventListener('business:branding-updated', onSwitch);
    return () => {
      window.removeEventListener('business:switched', onSwitch);
      window.removeEventListener('business:branding-updated', onSwitch);
    };
  }, []);

  const value = useMemo(() => ({ palette, setPaletteForBiz }), [palette]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
