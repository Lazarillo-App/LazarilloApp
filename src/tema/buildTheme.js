import { createTheme } from '@mui/material/styles';

export function buildMuiTheme(p) {
  return createTheme({
    palette: {
      mode: 'light',
      primary:   { main: p.primary },
      secondary: { main: p.secondary },
      success:   { main: p.success },
      warning:   { main: p.warning },
      error:     { main: p.error },
      background: {
        default: p.neutralBg,
        paper:   p.surface,
      },
      text: {
        primary:   p.neutralFg,
        secondary: '#475569',
      },
      divider: p.border,
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 10 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          colorPrimary: { backgroundColor: p.primary },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      // OJO: disablePortal en MuiTooltip (probado antes acá) causaba un loop
      // de reposicionamiento infinito ("Maximum update depth exceeded",
      // bloqueaba toda la navegación) — sin portal, el Popper vive dentro del
      // flujo normal del documento, y si su propia presencia desplaza al
      // elemento que lo ancla, el cálculo de posición de Popper.js nunca se
      // estabiliza. Revertido: los tooltips vuelven a portalearse a
      // document.body (default de MUI), que es justamente lo que evita este
      // problema. El desfasaje bajo el zoom global queda pendiente de
      // resolver con otro enfoque (no disablePortal).
    },
  });
}

// Inyecta variables CSS para estilos propios
export function applyCssVars(p) {
  const r = document.documentElement;
  r.style.setProperty('--color-primary',   p.primary);
  r.style.setProperty('--color-secondary', p.secondary);
  r.style.setProperty('--color-success',   p.success);
  r.style.setProperty('--color-warning',   p.warning);
  r.style.setProperty('--color-error',     p.error);
  r.style.setProperty('--color-fg',        p.neutralFg);
  r.style.setProperty('--color-bg',        p.neutralBg);
  r.style.setProperty('--color-surface',   p.surface);
  r.style.setProperty('--color-border',    p.border);
  r.style.setProperty('--color-hover',     p.hover);
}
