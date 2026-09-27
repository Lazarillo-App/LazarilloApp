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
      // Con el zoom global (html { zoom: 0.9 }, ver global.css) el Tooltip
      // portaleado a document.body queda mal posicionado — el mismo tipo de
      // bug que tenía el dropdown de perfil, pero acá no hay margen para
      // reescribirlo a mano en cada uso. disablePortal lo deja anclado en el
      // mismo árbol/zoom que el elemento que lo dispara, sin cruce de
      // contexto, así que cae en su lugar en vez de "encima de todo".
      MuiTooltip: {
        defaultProps: {
          slotProps: {
            popper: { disablePortal: true },
          },
        },
      },
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
