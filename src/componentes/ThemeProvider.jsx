// src/componentes/ThemeProvider.jsx
import React, { useEffect, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';

const defaultTheme = {
  primary:   '#0ea5e9',
  secondary: '#94a3b8',
  background:'#ffffff',
  text:      '#111827',
  font:      'Inter, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"'
};

export default function ThemeProvider({ children }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('activeBusinessId');
    if (!id) return applyTheme(defaultTheme);

    let alive = true;
    setBusy(true);
    BusinessesAPI.get(id)
      .then((biz) => {
        if (!alive) return;
        const b = biz?.props?.branding || {};
        applyTheme({
          primary:    b.primary    || defaultTheme.primary,
          secondary:  b.secondary  || defaultTheme.secondary,
          background: b.background || defaultTheme.background,
          text:       b.text       || defaultTheme.text,
          font:       b.font       || defaultTheme.font,
        });
      })
      .catch(() => applyTheme(defaultTheme))
      .finally(() => setBusy(false));

    return () => { alive = false; };
  }, []);

  return <>{children}</>;
}

function applyTheme(t) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary',   t.primary);
  root.style.setProperty('--brand-secondary', t.secondary);
  root.style.setProperty('--brand-bg',        t.background);
  root.style.setProperty('--brand-text',      t.text);
  root.style.setProperty('--brand-font',      t.font);
}
