// src/componentes/configuracion/catalogoPermisos.js
// Catálogo de permisos que usan Roles (RolesTab) y los ajustes por persona (AjustesPersonaDialog).

// Catálogo de lo que se puede ocultar. Cada clave = un permiso (lo que no figura, se ve).
export const SECCIONES = [
  {
    id: 'resultados', nombre: 'Resultados', desc: 'Panel de gestión',
    grupos: [
      { nombre: 'Tarjetas del mes', items: [
        ['tarjeta.ventas', 'Ventas'], ['tarjeta.equilibrio', 'Equilibrio'], ['tarjeta.resultado', 'Resultado'],
        ['tarjeta.mix', 'Mix (food cost y personal)'], ['tarjeta.canasta', 'Tu canasta'],
      ] },
      { nombre: 'Tabla', items: [
        ['tabla.totales_rubro', 'Totales por rubro'],
        ['tabla.ing_egr', 'Ingresos, egresos, resultado y equilibrio'],
        ['tabla.dif_caja', 'Flujo y diferencia de caja'], ['tabla.pct', 'Vista en % de ingresos'],
        ['tabla.col_total', 'Columna Total (oculta salvo que la habilites)'],
      ] },
      { nombre: 'Pestañas y botones', items: [
        ['tab.ventas', 'Pestaña Ventas'], ['tab.resultados', 'Pestaña Resultados'],
        ['btn.impagas', 'Impagas'], ['btn.sin_carga', 'Sin carga'], ['btn.eco_fin', 'Switch Económica / Financiera'],
      ] },
    ],
  },
  { id: 'carga', nombre: 'Carga de gastos', desc: 'Facturas, gastos varios y sueldos', grupos: [] },
  { id: 'recetas', nombre: 'Recetas', desc: 'Menú, insumos y costos', grupos: [] },
  { id: 'rrhh', nombre: 'RRHH', desc: 'Cronogramas y nómina', grupos: [] },
  { id: 'conceptos', nombre: 'Conceptos de caja', desc: 'Rubros y conceptos', grupos: [] },
  { id: 'medios', nombre: 'Medios de pago', desc: 'Cuentas, tarjetas y cheques', grupos: [] },
  { id: 'configuracion', nombre: 'Configuración', desc: 'Negocio, sucursales y sectores', grupos: [] },
  { id: 'conexiones', nombre: 'Conexiones', desc: 'Vincular PC y bajar el instalador', grupos: [] },
];


// Staff y sus subroles (Diego 11/11/2026): por defecto restringidos; el dueño habilita lo que quiera.
// Las claves son las de AccessContext.staffPuede y las del back (services/auth/permisos.js).
export const PERMISOS_STAFF = [
  { grupo: 'Recetas', items: [
    ['ver_precio', 'Ver el precio de venta'],
    ['ver_costo_pct', 'Ver el % de costo'],
    ['ver_objetivo', 'Ver el costo objetivo'],
    ['ver_sugerido', 'Ver el precio sugerido'],
    ['mover_agrupacion', 'Mover de Sin agrupación a otras agrupaciones'],
    ['ver_menu', 'Ver el Menú (vista diseño de la carta)'],
  ] },
  { grupo: 'Equipo', items: [
    ['es_cocina', 'Es de cocina (entra a Producción, Mantenimiento y Novedades)'],
    ['aprobar_equipo', 'Dar el OK a los cambios de su equipo (es el jefe de sus sectores)'],
  ] },
];

// ─── Ajustes solo para esta persona (Diego 14/11/2026): excepciones guardadas sobre el rol ───
/** Lo que ve la persona: rol (base) + ajustes. */
export function aplicarAjustes(tipo, base, ajustes = {}) {
  if (tipo === 'staff') {
    const permisos = { ...(base?.permisos || {}) };
    for (const [k, v] of Object.entries(ajustes?.staff || {})) { if (v) permisos[k] = true; else delete permisos[k]; }
    return { permisos };
  }
  const secciones = { ...(base?.secciones || {}) };
  for (const [s, v] of Object.entries(ajustes?.secciones || {})) { if (v === 'no') delete secciones[s]; else secciones[s] = v; }
  const menos = new Set(ajustes?.ocultosMenos || []);
  const ocultos = [...new Set([...(base?.ocultos || []), ...(ajustes?.ocultosMas || [])])].filter((k) => !menos.has(k));
  return { secciones, ocultos };
}

/** Diferencia entre lo elegido y el rol (lo que se guarda). */
export function diferencia(tipo, base, efectivo) {
  if (tipo === 'staff') {
    const staff = {};
    const b = base?.permisos || {};
    const e = efectivo?.permisos || {};
    for (const [, items] of PERMISOS_STAFF.map((g) => [g.grupo, g.items])) {
      for (const [k] of items) if (!!b[k] !== !!e[k]) staff[k] = !!e[k];
    }
    return Object.keys(staff).length ? { staff } : {};
  }
  const out = {};
  const secciones = {};
  for (const s of SECCIONES) {
    const b = base?.secciones?.[s.id] || null;
    const e = efectivo?.secciones?.[s.id] || null;
    if (b !== e) secciones[s.id] = e || 'no';
  }
  if (Object.keys(secciones).length) out.secciones = secciones;
  const B = new Set(base?.ocultos || []);
  const E = new Set(efectivo?.ocultos || []);
  const mas = [...E].filter((k) => !B.has(k));
  const menos = [...B].filter((k) => !E.has(k));
  if (mas.length) out.ocultosMas = mas;
  if (menos.length) out.ocultosMenos = menos;
  return out;
}

export const cantidadAjustes = (a) => Object.keys(a?.secciones || {}).length + (a?.ocultosMas || []).length
  + (a?.ocultosMenos || []).length + Object.keys(a?.staff || {}).length;

