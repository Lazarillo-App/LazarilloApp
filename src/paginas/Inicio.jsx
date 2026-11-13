import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { altaEnCurso } from '@/componentes/asistente/altaEstado';
import anthonyImg from '@/assets/brand/anthony.png';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { useAjuste } from '@/hooks/useAjustes';

/**
 * Inicio — Home de la app (a donde se entra al iniciar sesión): muestra todos los módulos operativos agrupados
 * por área (Operación / Rentabilidad / Administración). Los disponibles
 * (con pantalla real) van arriba de cada columna, los "Próximamente" abajo.
 *
 * El Navbar ya se renderiza arriba de esta página (ver App.jsx), así que acá
 * solo va el cuerpo — no un header propio.
 */

const GROUPS = [
  {
    id: 'operacion', label: 'Operación', icon: '⚙️',
    modules: [
      { id: 'tableros', label: 'Tableros', emoji: '📈', desc: 'Vista integral de tus negocios.', to: null },
      { id: 'rrhh', label: 'RRHH', emoji: '👥', desc: 'Cronogramas del personal.', to: '/rrhh/cronogramas' },
    ],
  },
  {
    id: 'rentabilidad', label: 'Rentabilidad', icon: '📈',
    modules: [
      { id: 'recetas', label: 'Recetas', emoji: '📖', desc: 'Artículos, insumos y costos.', to: '/menu' },
      { id: 'stock', label: 'Stock', emoji: '📦', desc: 'Movimientos e inventario.', to: null },
      { id: 'compras', label: 'Compras', emoji: '🛒', desc: 'Órdenes, proveedores y comprobantes.', to: null },
    ],
  },
  {
    id: 'administracion', label: 'Administración', icon: '💼',
    modules: [
      { id: 'conciliacion', label: 'Conciliación', emoji: '⚖️', desc: 'Cruzá ventas y pagos con el banco.', to: '/conciliacion' },
      { id: 'resultados', label: 'Resultados', emoji: '📊', desc: 'Ingresos, egresos y evolución.', descCelular: 'Ventas, gastos y lo que falta cargar.', to: '/gestion', soloAdmin: true, destacado: true },
      { id: 'balance', label: 'Balance', emoji: '💳', desc: 'Estado contable y patrimonial.', to: null },
    ],
  },
];

const AREA_TINTS = {
  operacion: { bg: '#5BC2EA1a', border: '#5BC2EA55', fg: '#2492C8' },
  rentabilidad: { bg: '#34d3991a', border: '#34d39955', fg: '#1a9c6e' },
  administracion: { bg: '#6366f11a', border: '#6366f155', fg: '#4f46e5' },
};

const C = {
  tinta: '#15213E', paper: '#F2F4F7', white: '#ffffff',
  line2: 'rgba(21,33,62,.16)', txt: '#15213E', txt2: '#5b6577', txt3: '#8a93a3',
};

function getUserName() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return (u?.name || u?.nombre || '').trim().split(/\s+/)[0] || '';
  } catch { return ''; }
}

// Módulo → sección de los roles a medida.
const SECCION_DE_MODULO = { resultados: 'resultados', 'carga-gastos': 'carga', rrhh: 'rrhh', recetas: 'recetas' };

export default function Inicio() {
  const navigate = useNavigate();
  const { active } = useBusiness() || {};
  const { isStaff, puedeVer } = useAccess() || {};
  // Ajuste a medida (13/11): módulos que el equipo ocultó para este cliente/negocio.
  const ocultos = useAjuste('modulos_ocultos', []);
  const oculto = (id) => Array.isArray(ocultos) && ocultos.includes(id);
  // Staff no entra a Resultados ni a la carga (RequireAdminOrOwner): no se le muestran.
  // Un rol a medida tampoco ve los módulos de las secciones que no tiene.
  const grupos = GROUPS.map((g) => ({
    ...g,
    modules: g.modules.filter((m) => !oculto(m.id) && !(isStaff && m.soloAdmin) && (!SECCION_DE_MODULO[m.id] || !puedeVer || puedeVer(SECCION_DE_MODULO[m.id]))),
  }));

  const userName = getUserName();
  const celular = useAngosto();
  // Alta a medias (se salió en Ventas, Menú…): se retoma donde quedó, no se muestra el panel (09/11).
  if (!isStaff && altaEnCurso(active)) return <Navigate to="/alta" replace />;
  // Staff no tiene Inicio: entra directo a Recetas › Insumos (Diego 11/11).
  if (isStaff) return <Navigate to="/insumos" replace />;
  if (celular) return <InicioCelular grupos={grupos} userName={userName} onSelect={(to) => navigate(to)} />;

  return (
    <div style={{ fontFamily: "'Archivo',sans-serif", background: C.paper, minHeight: '100vh', color: C.txt }}>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 30px 30px' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 26, color: C.tinta, letterSpacing: '-0.3px', margin: 0 }}>
            Hola{userName ? `, ${userName}` : ''} 👋
          </h1>
          <p style={{ fontSize: 13.5, color: C.txt2, marginTop: 4 }}>
            {active?.name ? `${active.name} · ¿En qué trabajamos hoy?` : '¿En qué trabajamos hoy?'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
          {grupos.map((g) => (
            <AreaColumn key={g.id} group={g} tint={AREA_TINTS[g.id]} onSelect={(to) => navigate(to)} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 15, background: 'linear-gradient(90deg,#5BC2EA16,#5BC2EA06)', border: '1px solid #5BC2EA3a', borderRadius: 15, padding: '13px 20px', marginTop: 20 }}>
          <div style={{ width: 52, height: 52, flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} aria-hidden>
            <img src={anthonyImg} alt="Anthony" style={{ height: 58, width: 'auto', display: 'block', marginBottom: -6 }} />
          </div>
          <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.45 }}>
            <b style={{ color: '#2492C8', fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>Anthony:</b>{' '}
            Elegí un módulo para arrancar. Recetas, Resultados, Carga de gastos y RRHH ya están andando; el resto va sumándose.
          </div>
        </div>
      </main>
    </div>
  );
}

// Celular (< 760 px, Diego 08/11/2026): una columna, Administración primero (es lo que se usa desde el
// celu), solo lo disponible como tarjetas y lo que viene en una línea de pastillas.
function useAngosto(max = 760) {
  const q = `(max-width: ${max}px)`;
  const [v, setV] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  React.useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setV(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return v;
}

const ORDEN_CELULAR = ['administracion', 'operacion', 'rentabilidad'];

function InicioCelular({ grupos, userName, onSelect }) {
  const orden = [...grupos].sort((a, b) => ORDEN_CELULAR.indexOf(a.id) - ORDEN_CELULAR.indexOf(b.id));
  const proximos = orden.flatMap((g) => g.modules.filter((m) => !m.to));
  return (
    <div style={{ fontFamily: "'Archivo',sans-serif", background: C.paper, minHeight: '100vh', color: C.txt }}>
      <main style={{ padding: '18px 16px 28px' }}>
        <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 24, color: C.tinta, letterSpacing: '-0.3px', margin: 0 }}>
          Hola{userName ? `, ${userName}` : ''} 👋
        </h1>
        <p style={{ fontSize: 13, color: C.txt2, margin: '3px 0 0' }}>¿En qué trabajamos hoy?</p>
        {orden.map((g) => {
          const disponibles = g.modules.filter((m) => m.to);
          if (!disponibles.length) return null;
          return (
            <section key={g.id} style={{ marginTop: 18 }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 11.5, color: C.tinta, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }} aria-hidden>{g.icon}</span>{g.label}
              </div>
              {disponibles.map((m) => <TarjetaCelular key={m.id} module={m} tint={AREA_TINTS[g.id]} onSelect={onSelect} />)}
            </section>
          );
        })}
        {proximos.length > 0 && (
          <section style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.txt3 }}>Próximamente</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {proximos.map((m) => (
                <span key={m.id} style={{ fontSize: 12, color: C.txt3, background: C.white, border: `1px solid ${C.line2}`, borderRadius: 14, padding: '4px 10px' }}>{m.label}</span>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function TarjetaCelular({ module, tint, onSelect }) {
  return (
    <div role="button" tabIndex={0} onClick={() => onSelect(module.to)} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(module.to); }}
      style={{
        marginTop: 8, background: C.white, borderRadius: 14, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        border: module.destacado ? '1.5px solid var(--color-primary, #5BC2EA)' : `1px solid ${C.line2}`,
      }}>
      <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: tint.bg }} aria-hidden>
        {module.emoji}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: C.tinta, lineHeight: 1.2 }}>{module.label}</div>
        <div style={{ fontSize: 12.5, color: C.txt2, lineHeight: 1.3, marginTop: 2 }}>{module.descCelular || module.desc}</div>
      </div>
      <span style={{ color: C.txt3, fontSize: 20, lineHeight: 1 }} aria-hidden>›</span>
    </div>
  );
}

function AreaColumn({ group, tint, onSelect }) {
  const disponibles = group.modules.filter((m) => m.to);
  const proximos = group.modules.filter((m) => !m.to);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, color: C.tinta, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: `2px solid ${C.line2}` }}>
        <span style={{ fontSize: 14 }} aria-hidden>{group.icon}</span>
        {group.label}
      </div>

      {disponibles.map((m) => <ModuleCard key={m.id} module={m} tint={tint} onSelect={onSelect} />)}
      {disponibles.length > 0 && proximos.length > 0 && <ProximoDivider />}
      {proximos.map((m) => <ModuleCard key={m.id} module={m} tint={tint} onSelect={onSelect} />)}
    </div>
  );
}

function ProximoDivider() {
  return (
    <div style={{ height: 1, margin: '3px 0', position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.txt3, background: C.paper, paddingRight: 8, zIndex: 1 }}>
        Próximamente
      </span>
      <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: C.line2 }} />
    </div>
  );
}

function ModuleCard({ module, tint, onSelect }) {
  const [hover, setHover] = React.useState(false);
  const soon = !module.to;
  const clickable = !soon;

  return (
    <div
      onClick={clickable ? () => onSelect(module.to) : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.white, border: `1px solid ${C.line2}`, borderRadius: 12, padding: '11px 13px',
        position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
        opacity: soon ? 0.6 : 1, cursor: clickable ? 'pointer' : 'default',
        transition: 'box-shadow .15s',
        boxShadow: clickable && hover ? '0 6px 18px rgba(21,33,62,.10)' : 'none',
      }}
    >
      {soon && (
        <span style={{ position: 'absolute', top: 9, right: 11, fontSize: 7.5, background: C.paper, border: `1px solid ${C.line2}`, color: C.txt3, borderRadius: 8, padding: '1px 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>
          Pronto
        </span>
      )}
      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, background: tint.bg, border: `1.5px solid ${tint.border}`, color: tint.fg }} aria-hidden>
        {module.emoji}
      </div>
      <div style={{ minWidth: 0 }}>
        <h4 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: C.tinta, lineHeight: 1.2, margin: 0 }}>{module.label}</h4>
        <p style={{ fontSize: 10.5, color: C.txt2, lineHeight: 1.3, marginTop: 1, marginBottom: 0 }}>{module.desc}</p>
      </div>
    </div>
  );
}
