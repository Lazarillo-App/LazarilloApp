// src/componentes/plazas/TablerosBotonera.jsx — header de Operación › Tableros.
// Diego 17/11/2026: con el formato de todos los headers. Arriba, una pestaña por SECTOR (Cocina · Barra ·
// Cafetería), «+» para crear un sector y, al fondo después de la barra, TODOS (el mapa). Debajo, las
// PLAZAS del sector como chips de sucursal (TablerosChips), con «+» para crear una plaza en ese sector.
// Los sectores se ven aunque estén vacíos. Crear: plazas del jefe de cocina para arriba; sectores, dueño/admin.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, IconButton, Tooltip, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { PlazasAPI } from '@/servicios/apiPlazas';
import { showPrompt } from '@/servicios/appPrompt';
import { showAlert } from '@/servicios/appAlert';
import EditorPlaza from './EditorPlaza';
import { useTableros, sectoresDe, pedirNuevaPlaza, COLORES_PLAZA } from './useTableros';

// Qué está elegido según la URL: /tableros (Todos), /tableros/sector/:sid o /tableros/:plazaId.
export function useSeleccionTableros(t) {
  const { pathname } = useLocation();
  const mSector = pathname.match(/^\/tableros\/sector\/(\d+)/);
  const enTodos = pathname.startsWith('/tableros/todos');
  const mPlaza = !mSector && pathname.match(/^\/tableros\/(\d+)/);
  const plazaId = mPlaza ? Number(mPlaza[1]) : null;
  const plaza = plazaId ? (t?.plazas || []).find((p) => Number(p.id) === plazaId) : null;
  const sectorId = mSector ? Number(mSector[1]) : (plaza ? Number(plaza.sectorId) : null);
  return { todos: enTodos, sectorId, plazaId };
}

export default function TablerosBotonera({ activeSx = () => ({}) }) {
  const t = useTableros();
  const navigate = useNavigate();
  const [creando, setCreando] = useState(null); // { sectorId } mientras el editor está abierto
  const sel = useSeleccionTableros(t);
  const sectores = sectoresDe(t);

  // Los «+ Plaza» de los chips y del mapa piden abrir el editor acá (un solo editor en la pantalla).
  useEffect(() => {
    const abrir = (e) => setCreando({ sectorId: e?.detail?.sectorId ?? null });
    window.addEventListener('plazas:crear', abrir);
    return () => window.removeEventListener('plazas:crear', abrir);
  }, []);

  const irASector = (s) => {
    const primera = (t?.plazas || []).find((p) => Number(p.sectorId) === Number(s.id));
    navigate(primera ? `/tableros/${primera.id}` : `/tableros/sector/${s.id}`);
  };
  const crearSector = async () => {
    const n = await showPrompt('Nombre del sector (ej. Cocina, Barra, Cafetería):', '');
    if (n == null || !String(n).trim()) return;
    try {
      const s = await PlazasAPI.crearSector(String(n).trim());
      try { window.dispatchEvent(new CustomEvent('plazas:changed')); } catch { /* sin evento */ }
      navigate(`/tableros/sector/${s.id}`);
    } catch (e) { showAlert(e?.message || 'No se pudo crear el sector', 'error'); }
  };

  if (!t) return null;
  const cant = (sid) => (t.plazas || []).filter((p) => Number(p.sectorId) === Number(sid)).length;
  return (
    <>
      {sectores.map((s) => (
        <Button key={s.id} color="inherit" onClick={() => irASector(s)}
          sx={{ color: 'inherit', position: 'relative', whiteSpace: 'nowrap', ...activeSx(sel.sectorId === s.id) }}>
          {s.nombre}
          <Box component="span" sx={{ fontSize: '0.68rem', opacity: 0.75, ml: 0.5 }}>{cant(s.id)}</Box>
        </Button>
      ))}
      {t.puedeCrearSector && (
        <Tooltip title="Agregar sector">
          <IconButton color="inherit" size="small" onClick={crearSector} aria-label="Agregar sector"
            sx={{ color: 'inherit', width: 26, height: 26, border: '1px solid', borderColor: 'currentColor', opacity: 0.85, ml: 0.25, alignSelf: 'center' }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
      {/* Al fondo, después de la barra, la vista general (como MENÚ en Recetas o NÓMINA en RRHH). */}
      {!!(t.plazas || []).length && (
        <>
          <Box component="span" aria-hidden sx={{ width: '1px', alignSelf: 'center', height: 22, background: 'currentColor', opacity: 0.35, mx: 0.5 }} />
          <Button color="inherit" onClick={() => navigate('/tableros/todos')}
            sx={{ color: 'inherit', position: 'relative', whiteSpace: 'nowrap', ...activeSx(sel.todos) }}>
            Todos
          </Button>
        </>
      )}
      {!sectores.length && !t.puedeCrear && <Box component="span" sx={{ opacity: 0.6, fontSize: '0.85rem', alignSelf: 'center' }}>Sin plazas</Box>}
      <EditorPlaza abierto={!!creando} sectores={t.sectores} sectorInicial={creando?.sectorId} puedeCrearSector={t.puedeCrearSector}
        onCerrar={() => setCreando(null)}
        onGuardado={(id) => { setCreando(null); if (id) navigate(`/tableros/${id}`); }} />
    </>
  );
}

// Segunda fila del header: las plazas del sector elegido, con el diseño de los chips de sucursal.
const CHIP = {
  height: 22, padding: '0 9px', borderRadius: 11, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', cursor: 'pointer',
  border: '1px solid color-mix(in srgb, var(--on-primary) 22%, transparent)',
  background: 'color-mix(in srgb, var(--on-primary) 8%, transparent)',
  color: 'var(--on-primary)', fontFamily: 'inherit', lineHeight: 1,
};
const CHIP_ON = { background: 'var(--on-primary)', color: 'var(--color-primary)', borderColor: 'var(--on-primary)' };
const REDONDO = {
  width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 700, fontSize: 13, lineHeight: 1, cursor: 'pointer', color: 'var(--on-primary)', background: 'transparent',
  fontFamily: 'inherit', padding: 0, flexShrink: 0,
};
const AYUDA = (
  <span style={{ display: 'block', lineHeight: 1.45, padding: 2 }}>
    <b>Sectores y plazas</b><br />
    Cada sector (Cocina, Barra) tiene sus plazas: los puestos de despacho. Cada plaza tiene su tablero con la
    lámina de armado de sus productos. En <b>Todos</b> ves el mapa completo y qué TV muestra cada plaza.
  </span>
);

export function TablerosChips({ celu = false }) {
  const t = useTableros();
  const navigate = useNavigate();
  const sel = useSeleccionTableros(t);
  if (!t) return null;
  const plazas = (t.plazas || []);
  const ayuda = (
    <Tooltip title={AYUDA} arrow>
      <span aria-label="Qué son los sectores y las plazas"
        style={{ ...REDONDO, width: 16, height: 16, fontSize: 10, cursor: 'help', opacity: 0.75,
          border: '1px solid color-mix(in srgb, var(--on-primary) 40%, transparent)' }}>?</span>
    </Tooltip>
  );
  const texto = (s) => <span style={{ fontSize: 11, opacity: 0.8, whiteSpace: 'nowrap' }}>{s}</span>;
  let contenido;
  if (sel.todos) {
    const tvs = plazas.reduce((a, p) => a + (Number(p.tvs) || 0), 0);
    const ns = sectoresDe(t).length;
    contenido = texto(`${ns} sector${ns !== 1 ? 'es' : ''} · ${plazas.length} plaza${plazas.length !== 1 ? 's' : ''} · ${tvs} TV`);
  } else {
    const delSector = plazas.filter((p) => Number(p.sectorId) === sel.sectorId);
    contenido = (
      <>
        {!delSector.length && texto('Sin plazas')}
        {delSector.map((p, i) => (
          <button key={p.id} type="button" onClick={() => navigate(`/tableros/${p.id}`)} title={p.nombre}
            style={{ ...CHIP, ...(sel.plazaId === Number(p.id) ? CHIP_ON : null), ...(celu ? { height: 30, borderRadius: 15, padding: '0 12px' } : null) }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: COLORES_PLAZA[i % COLORES_PLAZA.length], flexShrink: 0, border: '1px solid rgba(0,0,0,.15)' }} />
            {p.nombre}
          </button>
        ))}
        {t.puedeCrear && (
          <Tooltip title="Agregar plaza en este sector" arrow>
            <button type="button" onClick={() => pedirNuevaPlaza(sel.sectorId)} aria-label="Agregar plaza"
              style={{ ...REDONDO, ...(celu ? { width: 30, height: 30 } : null), border: '1px dashed color-mix(in srgb, var(--on-primary) 45%, transparent)' }}>+</button>
          </Tooltip>
        )}
      </>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: celu ? 'nowrap' : 'wrap' }}>
      {contenido}
      {!celu && ayuda}
    </div>
  );
}
