import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Box, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import logoLight from '@/assets/brand/logo-light.png';

/**
 * ModulosDrawer — el menú "escondido" para navegar entre los módulos
 * operativos de Lazarillo. Se abre con un botón (ver Navbar.jsx) y se
 * cierra solo, con el botón de cerrar, o tocando afuera.
 *
 * Agrupa los módulos igual que el Home (Operación / Rentabilidad /
 * Administración). Por ahora solo Recetas tiene pantalla real (/menu) — el
 * resto queda deshabilitado con "Próximamente" hasta que existan.
 */

const GROUPS = [
  {
    id: 'operacion', label: 'Operación',
    modules: [
      { id: 'tableros', label: 'Tableros', emoji: '📈', to: null },
      { id: 'rrhh', label: 'RRHH', emoji: '👥', to: null },
    ],
  },
  {
    id: 'rentabilidad', label: 'Rentabilidad',
    modules: [
      { id: 'recetas', label: 'Recetas', emoji: '📖', to: '/menu' },
      { id: 'stock', label: 'Stock', emoji: '📦', to: null },
      { id: 'compras', label: 'Compras', emoji: '🛒', to: null },
    ],
  },
  {
    id: 'administracion', label: 'Administración',
    modules: [
      { id: 'conciliacion', label: 'Conciliación', emoji: '⚖️', to: null },
      { id: 'resultados', label: 'Resultados', emoji: '📊', to: null },
      { id: 'balance', label: 'Balance', emoji: '💳', to: null },
    ],
  },
];

// Una base oscura fija, apenas teñida con el color del negocio activo (~20%)
// — se "siente" el negocio sin que el panel entero pase a ser de ese color,
// que da un golpe visual muy fuerte con negocios de colores muy saturados,
// muy claros o muy oscuros. Con la base siempre oscura, el texto claro
// mantiene buen contraste sin importar el color del negocio.
const C = {
  noche: 'color-mix(in srgb, var(--color-primary, #7a1f3d) 20%, #12111F)',
  line: 'rgba(255,255,255,.10)',
  sidebarText: '#c8d2e0',
  sidebarDim: '#7a89a5',
  hover: 'rgba(255,255,255,.06)',
};

export default function ModulosDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');

  const irA = (to) => {
    if (!to) return;
    onClose?.();
    navigate(to);
  };

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 300, height: '100%', background: C.noche, display: 'flex', flexDirection: 'column', fontFamily: "'Archivo',sans-serif" }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 10px' }}>
          <img src={logoLight} alt="Lazarillo" style={{ height: 26, display: 'block' }} />
          <Tooltip title="Cerrar">
            <IconButton size="small" onClick={onClose} sx={{ color: C.sidebarText }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Buscador de funciones — por ahora solo visual, sin filtrar nada.
            Más adelante: tipear "pagos de mercado pago" y redirigir directo
            a Conciliación con eso a la vista. */}
        <Box sx={{ margin: '2px 12px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.hover, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px' }}>
          <span style={{ fontSize: 15, opacity: 0.7 }}>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar una función…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.sidebarText, fontFamily: "'Archivo',sans-serif", fontSize: 14,
            }}
          />
        </Box>

        <Box
          onClick={() => irA('/inicio')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', margin: '0 10px 10px',
            borderRadius: 10, cursor: 'pointer', color: C.sidebarText,
            fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15,
            border: `1px solid ${C.line}`,
          }}
        >
          <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>🏠</span>
          Inicio
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 10px' }}>
          {GROUPS.map((g) => (
            <Box key={g.id} sx={{ marginBottom: 14 }}>
              <Box sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: C.sidebarDim, padding: '0 4px 7px' }}>
                {g.label}
              </Box>
              {g.modules.map((m) => {
                const disabled = !m.to;
                return (
                  <Box
                    key={m.id}
                    onClick={() => !disabled && irA(m.to)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                      cursor: disabled ? 'default' : 'pointer', marginBottom: 3,
                      fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14.5,
                      color: disabled ? C.sidebarDim : C.sidebarText,
                      opacity: disabled ? 0.5 : 1,
                      '&:hover': disabled ? {} : { background: C.hover },
                    }}
                  >
                    <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{m.emoji}</span>
                    {m.label}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Drawer>
  );
}
