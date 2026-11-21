import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Box, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import logoLight from '@/assets/brand/logo-light.png';
import { useAccess } from '@/context/AccessContext';
import { useFuncionesOcultas, estaOculta } from '@/funciones';

// Módulo → sección de los roles a medida (lo que el rol no ve, no aparece).
const SECCION_DE_MODULO = {
  resultados: 'resultados', 'carga-gastos': 'carga', rrhh: 'rrhh',
  recetas: 'recetas', tableros: 'recetas', 'gestion-conceptos': 'conceptos', 'gestion-medios': 'medios',
};

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
      // Medios de pago salió del menú (Diego 10/11/2026): se gestionan desde el desplegable de cada pago.
      // Tableros = las plazas de despacho de cocina y barra (Diego 12/11/2026).
      { id: 'tableros', label: 'Tableros', emoji: '📋', to: '/tableros', claves: 'plazas cocina barra despacho pantalla tv' },
      { id: 'produccion', label: 'Producción', emoji: '🍳', to: '/produccion', claves: 'tareas operativas cocina elaborados tandas mise en place jefe cocinero turnos' },
      { id: 'mantenimiento', label: 'Mantenimiento', emoji: '🧰', to: '/mantenimiento', claves: 'equipos heladera freidora horno preventivo falla reparacion aceite limpieza temperatura' },
      { id: 'rrhh', label: 'RRHH', emoji: '👥', to: '/rrhh/cronogramas', claves: 'empleados personal cronogramas turnos sueldos feriados calendario' },
    ],
  },
  {
    id: 'rentabilidad', label: 'Rentabilidad',
    modules: [
      // Resultados pasa a Rentabilidad (Diego 15/11/2026; antes estaba en Administración).
      { id: 'resultados', label: 'Resultados', emoji: '📊', to: '/gestion', claves: 'panel gestion gastos compras ventas balance equilibrio facturas cargar pagos impagas proveedores sueldos' },
      { id: 'recetas', label: 'Recetas', emoji: '📖', to: '/menu', claves: 'menu articulos insumos costos food cost precios canasta' },
      { id: 'stock', label: 'Stock', emoji: '📦', to: null, claves: 'inventario existencias' },
      { id: 'compras', label: 'Compras', emoji: '🛒', to: null, claves: 'pedidos proveedores' },
    ],
  },
  {
    id: 'administracion', label: 'Administración',
    modules: [
      { id: 'conciliacion', label: 'Conciliación', emoji: '⚖️', to: '/conciliacion', claves: 'banco mercado pago tarjetas cupones extracto' },
      { id: 'movimientos-bancarios', label: 'Movimientos bancarios', emoji: '🏦', to: '/movimientos-bancarios', soloAdmin: true, claves: 'banco cuenta extracto mercado pago' },
      { id: 'clientes', label: 'Clientes', emoji: '👥', to: '/clientes', soloAdmin: true, claves: 'cuenta corriente cobranzas' },
      // Conceptos de caja y Carga de gastos salen del menú (Diego 10/11/2026): Conceptos va en el
      // header del Panel de Gestión y la carga se hace desde el panel («Cargar Gastos»).
      // Sin "Versión celular" (usuaria 08/11/2026: se sigue desarrollando, pero no hace falta un botón
      // que la muestre). /m sigue andando: un teléfono que entra a /gestion va solo ahí.
    ],
  },
];

// Una base oscura fija, apenas teñida con el color del negocio activo (~20%)
// — se "siente" el negocio sin que el panel entero pase a ser de ese color,
// que da un golpe visual muy fuerte con negocios de colores muy saturados,
// muy claros o muy oscuros. Con la base siempre oscura, el texto claro
// mantiene buen contraste sin importar el color del negocio.
// Buscador (Diego 15/11/2026: no filtraba nada): sin mayúsculas ni acentos, por nombre y por palabras clave.
const sinAcentos = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const coincide = (m, q) => !q || sinAcentos(m.label).includes(q)
  || sinAcentos(`${m.label} ${m.claves || ''}`).split(/\s+/).some((w) => w.startsWith(q));

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
  const { puedeVer } = useAccess() || {};
  // Ajuste a medida (13/11): módulos que el equipo ocultó para este cliente/negocio.
  // Funciones por negocio (17/11): área o función oculta para este negocio.
  const ocultos = useFuncionesOcultas();
  const visible = (m) => !estaOculta(ocultos, m.id) && (!SECCION_DE_MODULO[m.id] || !puedeVer || puedeVer(SECCION_DE_MODULO[m.id]));

  const q = sinAcentos(query.trim());
  const grupos = GROUPS.map((g) => ({ ...g, modules: g.modules.filter((m) => visible(m) && coincide(m, q)) }))
    .filter((g) => g.modules.length);
  const primero = grupos.flatMap((g) => g.modules).find((m) => m.to);
  // Al cerrar el menú se limpia la búsqueda: la próxima vez arranca con todo.
  React.useEffect(() => { if (!open) setQuery(''); }, [open]);

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

        {/* Los gap van en px: en sx un número es theme.spacing (gap: 12 eran 96px y separaba todo,
            Diego 15/11/2026). */}
        {/* Buscador de funciones: filtra los módulos; Enter abre el primero. Más adelante: tipear
            "pagos de mercado pago" y abrir Conciliación con eso a la vista. */}
        <Box sx={{ margin: '2px 12px 10px', display: 'flex', alignItems: 'center', gap: '8px', background: C.hover, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px' }}>
          <span style={{ fontSize: 15, opacity: 0.7 }}>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && primero) irA(primero.to); if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); } }}
            autoFocus
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
            display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', margin: '0 10px 12px',
            borderRadius: 10, cursor: 'pointer', color: C.sidebarText,
            fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15,
            border: `1px solid ${C.line}`,
          }}
        >
          <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>🏠</span>
          Inicio
        </Box>

        <Box sx={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 10px',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {!grupos.length && (
            <Box sx={{ color: C.sidebarDim, fontSize: 14, padding: '8px 4px' }}>No hay nada con «{query.trim()}».</Box>
          )}
          {grupos.map((g) => (
            <Box key={g.id} sx={{ marginBottom: '12px' }}>
              <Box sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: C.sidebarDim, padding: '0 4px 7px' }}>
                {g.label}
              </Box>
              {g.modules.map((m) => {
                const disabled = !m.to;
                return (
                  <Box
                    key={m.id}
                    onClick={() => { if (disabled) return; irA(m.to); }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: 10,
                      cursor: disabled ? 'default' : 'pointer', marginBottom: '2px',
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
