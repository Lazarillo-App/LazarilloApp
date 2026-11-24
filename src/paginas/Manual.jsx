// src/paginas/Manual.jsx — /manual y /manual/:capitulo: el Manual de Lazarillo como un libro
// (Diego 16/11/2026: «el manual más que llevarte al paso a paso debería ser tipo un libro con imágenes
// y textos, con una barra de navegación lateral»). Índice a la izquierda (módulo › capítulo › secciones)
// con buscador, el capítulo en el centro y «En esta página» a la derecha. El paso a paso de Anthony
// queda como complemento («Mostrámelo en la app»). Los capítulos viven en la base (GET /api/manual);
// las guías que todavía no tienen capítulo escrito aparecen igual, con su paso a paso.
// /guia/:id(/:sector) es el link que abre una guía de Anthony directo en su pantalla.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Navigate, Link } from 'react-router-dom';
import { useAccess } from '@/context/AccessContext';
import { api, BASE } from '@/servicios/apiBase';
import { GUIAS, GRUPOS_GUIAS, NOMBRE_SECTOR, pedirGuia } from '@/componentes/asistente/guias';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

// /guia/:id(/:sector): el link que se comparte. Abre la pantalla de la guía y la arranca.
export function AbrirGuia() {
  const { id, sector } = useParams();
  const navigate = useNavigate();
  const g = GUIAS.find((x) => x.id === id);
  useEffect(() => {
    if (g) pedirGuia(g, (ruta) => navigate(ruta, { replace: true }), g.sectores?.includes(sector) ? sector : null);
  }, [g, sector, navigate]);
  if (!g) return <Navigate to="/manual" replace />;
  return <div style={{ padding: 32, fontFamily: FB, color: T.text2 }}>Abriendo la guía…</div>;
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sin permiso */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

// Sin acentos: el rango de diacríticos se arma con fromCharCode (el conector de GitHub convierte los escapes).
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
// Las imágenes propias del manual vienen como /api/manual/imagen/:id (del back de cada entorno).
const urlImagen = (u) => (String(u || '').startsWith('/api/') ? String(BASE).replace(/\/api\/?$/, '') + u : u);
const slugGuia = (id) => id.replace(/_/g, '-');

// Capítulos incorporados en el código para que siempre estén disponibles en el Manual y su buscador
// (si además existen en la tabla manual_capitulos del servidor, prevalece la versión de la base).
const CAPITULOS_PROPIOS = [
  {
    id: 'produccion',
    grupo: 'Operación',
    titulo: 'Producción',
    resumen: 'Programación semanal de elaborados y mise en place por sucursal, ejecución con cronómetro, cambios de ingredientes, avisos en pantalla, mermas, etiquetas y sugerencias según ventas.',
    guia_id: 'produccion',
    orden: 20,
    secciones: [
      {
        id: 'quien-ve-que',
        titulo: 'Para qué sirve y quién ve qué',
        texto: `El módulo de **Producción** organiza el trabajo diario de la cocina por sucursal: qué elaborados y mise en place hay que preparar cada día, en qué turno y plaza, quién los hace y cuánto rinden.

Cada rol ve lo que necesita para su trabajo:

- **Cocinero (staff):** entra directo a **Mis tareas** con las producciones asignadas para hoy (o sin responsable en su plaza o sector), puede consultar su **Semana** y registrar **Mermas y desperdicios**. Nunca ve costos ni precios.
- **Jefe de cocina:** además de ejecutar tareas, programa la **Semana** (por turno, por persona o por plaza), consulta **Según ventas**, sigue los tiempos en **Panel** y configura **Mise en place**, **Estimados** y **Equipo**.
- **Dueño y administrador:** tienen acceso completo a todas las pestañas, incluyendo **Cambios** y **Consumos**, y aprueban o rechazan las propuestas de cambio permanente de receta en **Configuración › Aprobaciones**.`,
      },
      {
        id: 'programar-semana',
        titulo: 'Cómo se programa la semana y Según ventas',
        texto: `En las vistas **Semana**, **Por persona** o **Por plaza** podés armar la producción día por día:

- **+ Programar:** elegís el elaborado (o una tarea de **Mise en place** de una plaza, o una tarea libre), la cantidad de **tandas** (1, ½, 2…), el día, el turno, la plaza y el responsable. El rinde esperado y los minutos estimados se calculan solos a partir de la receta.
- **Reorganizar:** podés arrastrar cualquier tarea pendiente a otro día, turno, persona o plaza.
- **⟳ Repetir semana anterior:** copia todas las tareas no canceladas de la semana pasada como pendientes en la semana actual, para que solo ajustes lo que cambie.
- **Según ventas:** cruza las ventas reales del POS con las recetas y lo ya producido en la semana para mostrarte qué elaborados faltan y programar las tandas sugeridas con un clic.`,
        tip: 'En **Estimados** podés definir para cada elaborado cuántos minutos lleva una tanda, su plaza, su responsable habitual y los **días de vida útil**; esos valores se usan solos al programar y al imprimir etiquetas.',
      },
      {
        id: 'ejecucion-y-cambios',
        titulo: 'Cronómetro y cambios de ingrediente',
        texto: `Cuando el cocinero toca una tarea en **Mis tareas** (o desde la grilla semanal), se abre la ficha con los ingredientes de la receta **escalados a las tandas** programadas y los pasos de preparación.

- **Cronómetro:** con **▶ Iniciar**, **⏸ Pausar** y **✓ Terminar** se mide el tiempo real de elaboración. Al terminar, el cocinero indica cuánto rindió realmente y puede dejar notas u observaciones.
- **Cambio de ingrediente:** si faltó un insumo, se reemplazó por otro, se agregó uno o se usó otra cantidad, se registra ahí mismo eligiendo el alcance:
- **Solo esta producción:** el cambio se aplica únicamente a esa tanda para que los consumos reales queden bien registrados y aparece en la pestaña **Cambios** para control del dueño o administrador, sin modificar la receta maestra.
- **Cambio de receta:** si la receta cambió de forma permanente, genera automáticamente una propuesta en **Configuración › Aprobaciones** (escalada a 1 tanda, con el antes, el después y el impacto en costo) para que el dueño o administrador la apruebe o la rechace.`,
      },
      {
        id: 'avisos-en-pantalla',
        titulo: 'Avisos de cocina en pantalla',
        texto: `Los eventos operativos de la cocina generan avisos que suben por la cadena de responsabilidad y quedan visibles en pantalla hasta que se descartan:

- Lo que registra un **cocinero** (cambios de ingrediente, observaciones al terminar, mermas o desperdicios y fallas de equipos) le avisa al **jefe de cocina** y al **dueño / administrador**.
- Lo que programa o registra el **jefe de cocina** le avisa al **dueño / administrador** (y al cocinero cuando se le asignan tareas de la semana).
- Al tocar un aviso en pantalla (o desde la campana de notificaciones), Lazarillo te lleva directo a la tarea o registro correspondiente.`,
      },
      {
        id: 'mermas-y-etiquetas',
        titulo: 'Mermas, desperdicios y etiquetas',
        texto: `El control de lo producido se completa con las etiquetas de trazabilidad y el registro de pérdidas:

- **🏷 Etiquetas:** dentro de cualquier tarea en curso o terminada, el botón de etiquetas arma e imprime desde el navegador etiquetas de **60 × 40 mm** con el nombre del elaborado, contenido opcional por envase, fecha de **Elaboración**, fecha de **Vencimiento** (calculada sola sumando los días de vida útil del elaborado), número de **lote** automático (**L** + fecha + número de tarea), responsable y conservación en heladera o freezer.
- **Mermas de limpieza:** en **Mermas y desperdicios** podés pesar un insumo antes y después de limpiarlo. El sistema calcula el porcentaje de merma real y lo compara con la merma configurada del insumo.
- **Desperdicios:** permite anotar mercadería o elaborados que hubo que descartar indicando el motivo; todo queda reflejado en la pestaña **Consumos**.`,
      },
    ],
  },
  {
    id: 'mantenimiento',
    grupo: 'Operación',
    titulo: 'Mantenimiento',
    resumen: 'Inventario de equipos por sucursal, planes de mantenimiento preventivo que generan órdenes solas, reporte de fallas urgentes y registros rápidos de temperatura, limpieza y aceite.',
    guia_id: 'mantenimiento',
    orden: 21,
    secciones: [
      {
        id: 'para-que-sirve',
        titulo: 'Para qué sirve y quién ve qué',
        texto: `El módulo de **Mantenimiento** reúne en un solo lugar las máquinas e instalaciones de cada sucursal (heladeras, freidoras, hornos, máquinas y otros equipos), sus mantenimientos preventivos, los arreglos por fallas y los controles diarios de cocina.

- **Cualquiera del equipo (staff):** ve **Mis órdenes** (los mantenimientos asignados a él o sin responsable), puede tocar **⚠ Reportar falla** cuando algo se rompe y cargar **Registros** diarios de aceite, limpieza o temperatura. No ve precios de compra ni costos de reparación.
- **Jefe de cocina:** además de lo anterior, ve la **Agenda** completa de la sucursal, da de alta y edita **Equipos**, configura los planes preventivos que se repiten y crea órdenes con **+ Orden**.
- **Dueño y administrador:** tienen acceso completo y son los únicos que ven y cargan los importes de plata (**Precio de compra** en la ficha del equipo y **Costo** al cerrar una orden).`,
      },
      {
        id: 'equipos-y-planes',
        titulo: 'Equipos y planes preventivos',
        texto: `En la pestaña **Equipos** (o con el botón **+ Equipo**) armás el padrón de máquinas de la sucursal:

- **Ficha del equipo:** nombre, rubro (heladera, freidora, horno, máquina u otro), marca, modelo, ubicación, área, responsable, proveedor o service, código interno, fechas de compra e instalación, estado (**Activo**, **En reparación** o **De baja**) y notas.
- **Mantenimientos que se repiten (planes):** dentro de cada equipo podés cargar tareas preventivas (por ejemplo *Limpieza de radiador* o *Service de quemadores*) indicando cada cuántos **días, semanas o meses** se hacen, en qué días de la semana se permiten y si exigen nota obligatoria al marcarlas como hechas.
- **Generación automática:** las órdenes preventivas aparecen solas en la **Agenda** cuando falta una semana o menos para su próxima fecha. Al marcar la orden como hecha (o al saltearla), el plan calcula automáticamente el próximo vencimiento.`,
      },
      {
        id: 'fallas-y-agenda',
        titulo: 'Fallas y órdenes en la Agenda',
        texto: `La pestaña **Agenda** agrupa todo por prioridad: **🔴 Fallas abiertas**, **Vencidas**, **Hoy**, **Próximos días** y **Hechas (últimos 14 días)**.

- **⚠ Reportar falla:** cualquier persona del equipo elige el equipo, escribe qué le pasa y puede marcar **No funciona** (cambia el equipo a estado *En reparación*) y **Es urgente**.
- **Aviso inmediato:** al reportar una falla se crea la orden correctiva y les llega un aviso en pantalla y en Notificaciones al jefe de cocina, al dueño y al administrador.
- **Resolver o reprogramar:** al abrir una orden pendiente podés anotar qué se hizo y tocar **✓ Hecho** (sumando costo y técnico/proveedor si sos dueño o admin), o cambiar la fecha en **Pasarlo a** y tocar **Reprogramar**. Cuando se resuelve la última falla de un equipo que estaba *En reparación*, vuelve solo a **Activo** y le avisa a quien la había reportado.`,
      },
      {
        id: 'registros-diarios',
        titulo: 'Registros rápidos (aceite, limpieza y temperatura)',
        texto: `Para las tareas rutinarias del día a día que no requieren abrir una orden de mantenimiento:

- **Desde la tarjeta del equipo:** en la pestaña **Equipos**, cada heladera o freidora activa tiene botones rápidos de un toque para registrar **Temperatura (°C)**, **Limpieza** y **Filtrado, cambio o carga de aceite (litros)**.
- **Pestaña Registros:** permite cargar esos mismos controles para cualquier equipo activo agregando una nota opcional, y muestra el listado de todos los registros de los últimos 30 días con la persona, la fecha y la hora.`,
        tip: 'Si te equivocaste al cargar un registro rápido, podés borrarlo con **✕** durante el mismo día (el jefe de cocina, el dueño y el administrador pueden borrarlo en cualquier momento).',
      },
    ],
  },
];

// Texto del capítulo: párrafos separados por línea en blanco, **negrita** y renglones «- » como lista.
function Negritas({ t }) {
  const partes = String(t).split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i} style={{ color: T.text }}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>));
}
function Texto({ texto }) {
  const bloques = String(texto || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return bloques.map((b, i) => {
    const renglones = b.split('\n');
    if (renglones.every((r) => /^\s*-\s+/.test(r))) {
      return <ul key={i} style={{ margin: '0 0 12px', paddingLeft: 22, color: T.text2, fontSize: 15, lineHeight: 1.6 }}>{renglones.map((r, j) => <li key={j}><Negritas t={r.replace(/^\s*-\s+/, '')} /></li>)}</ul>;
    }
    return <p key={i} style={{ margin: '0 0 12px', color: T.text2, fontSize: 15, lineHeight: 1.65 }}><Negritas t={b} /></p>;
  });
}

const btn = (principal, alto = 38) => ({
  fontFamily: FB, fontWeight: 700, fontSize: 13.5, height: alto, padding: '0 16px', borderRadius: 10, cursor: 'pointer',
  whiteSpace: 'nowrap', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  border: `1px solid ${principal ? T.accent : T.border2}`, background: principal ? T.accent : T.band, color: principal ? T.ink : T.text2,
});

function useAncho() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}

export default function Manual() {
  useEffect(() => { cargarFuentes(); }, []);
  const { capitulo: capId } = useParams();
  const navigate = useNavigate();
  const { isStaff } = useAccess() || {};
  const ancho = useAncho();
  const cel = ancho < 1000;
  const conToc = ancho >= 1280;
  const [datos, setDatos] = useState(null);
  const [q, setQ] = useState('');
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const [aviso, setAviso] = useState('');
  const [activa, setActiva] = useState(null);
  // La app tiene zoom (0.9): el índice lateral ocupa el alto real de la ventana (100vh no alcanza).
  const asideRef = useRef(null);
  const [altoLat, setAltoLat] = useState(null);
  useEffect(() => {
    const medir = () => { const el = asideRef.current; if (!el || !el.offsetHeight) return; const z = el.getBoundingClientRect().height / el.offsetHeight || 1; setAltoLat(Math.round(window.innerHeight / z)); };
    medir(); window.addEventListener('resize', medir); return () => window.removeEventListener('resize', medir);
  }, [cel]);

  useEffect(() => {
    let vivo = true;
    api('/manual').then((r) => { if (vivo) setDatos(r?.capitulos || []); }).catch(() => { if (vivo) setDatos([]); });
    return () => { vivo = false; };
  }, []);

  // Capítulos escritos + las guías que todavía no tienen capítulo (con su paso a paso).
  const capitulos = useMemo(() => {
    const base = [
      ...(datos || []),
      ...CAPITULOS_PROPIOS.filter((p) => !(datos || []).some((d) => d.id === p.id || (p.guia_id && d.guia_id === p.guia_id))),
    ];
    const escritos = base.filter((c) => !(isStaff && GUIAS.find((g) => g.id === c.guia_id)?.soloGestion));
    const conCap = new Set(escritos.map((c) => c.guia_id).filter(Boolean));
    const faltan = GUIAS.filter((g) => !conCap.has(g.id) && !(g.soloGestion && isStaff)).map((g, i) => ({
      id: slugGuia(g.id), grupo: g.grupo, titulo: g.titulo, resumen: g.detalle, guia_id: g.id, orden: 100 + i, secciones: [], pendiente: true,
    }));
    const todos = [...escritos, ...faltan];
    const grupos = [...GRUPOS_GUIAS, ...new Set(todos.map((c) => c.grupo).filter((x) => !GRUPOS_GUIAS.includes(x)))];
    const pos = (g) => { const i = grupos.indexOf(g); return i < 0 ? 99 : i; };
    return todos.sort((a, b) => pos(a.grupo) - pos(b.grupo) || a.orden - b.orden || a.titulo.localeCompare(b.titulo));
  }, [datos, isStaff]);
  const grupos = useMemo(() => [...new Set(capitulos.map((c) => c.grupo))], [capitulos]);
  const actual = capitulos.find((c) => c.id === capId) || (!capId ? capitulos.find((c) => !c.pendiente) || capitulos[0] : null);
  const idx = actual ? capitulos.indexOf(actual) : -1;
  const guia = actual?.guia_id ? GUIAS.find((g) => g.id === actual.guia_id) : null;

  // Buscador: título, resumen y texto de cada sección (todas las palabras, sin acentos).
  const resultados = useMemo(() => {
    const palabras = norm(q).split(/\s+/).filter(Boolean);
    if (!palabras.length) return null;
    const out = [];
    capitulos.forEach((c) => {
      const g = GUIAS.find((x) => x.id === c.guia_id);
      const base = norm([c.titulo, c.resumen, c.grupo, g?.claves].join(' '));
      if (palabras.every((w) => base.includes(w))) out.push({ c, s: null });
      (c.secciones || []).forEach((s) => {
        const t = norm([c.titulo, s.titulo, s.texto, s.tip].join(' '));
        if (palabras.every((w) => t.includes(w))) out.push({ c, s });
      });
    });
    return out.slice(0, 40);
  }, [q, capitulos]);

  // «En esta página»: la sección que se está leyendo.
  const refs = useRef({});
  useEffect(() => {
    setActiva(actual?.secciones?.[0]?.id || null);
    const els = (actual?.secciones || []).map((s) => refs.current[s.id]).filter(Boolean);
    if (!els.length) return undefined;
    const obs = new IntersectionObserver((ents) => {
      const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActiva(vis[0].target.dataset.sec);
    }, { rootMargin: '-80px 0px -60% 0px' });
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [actual]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [actual?.id]);

  const irA = (cId, sId = null) => {
    setIndiceAbierto(false); setQ('');
    if (cId !== actual?.id) navigate(`/manual/${cId}${sId ? `#${sId}` : ''}`);
    if (sId) setTimeout(() => refs.current[sId]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), cId !== actual?.id ? 350 : 0);
  };
  useEffect(() => { // link a una sección (#id)
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (h && actual) setTimeout(() => refs.current[h]?.scrollIntoView({ block: 'start' }), 300);
  }, [actual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso((a) => (a === t ? '' : a)), 2500); };
  const copiarLink = async (sId = null) => {
    const ok = await copiar(`${window.location.origin}/manual/${actual.id}${sId ? `#${sId}` : ''}`);
    avisar(ok ? 'Link copiado' : 'No se pudo copiar el link');
  };

  if (capId && datos && !actual) return <Navigate to="/manual" replace />;

  /* ── índice (barra lateral o cajón en el celular) ── */
  const indice = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el manual…"
        style={{ height: 40, boxSizing: 'border-box', padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.band,
          fontFamily: FB, fontSize: 13.5, color: T.text, outline: 'none', marginBottom: 10 }} />
      {resultados ? (
        resultados.length ? resultados.map(({ c, s }, i) => (
          <button key={i} type="button" onClick={() => irA(c.id, s?.id)} style={{ all: 'unset', cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: T.band, marginBottom: 4, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.text3 }}>{c.grupo} › {c.titulo}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{s ? s.titulo : c.titulo}</div>
          </button>
        )) : <div style={{ fontSize: 13, color: T.text2, padding: '6px 4px' }}>No encontré nada con «{q}». Probá con otra palabra o preguntale a Anthony.</div>
      ) : grupos.map((g) => (
        <div key={g}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: T.text3, margin: '12px 10px 4px' }}>{g}</div>
          {capitulos.filter((c) => c.grupo === g).map((c) => {
            const on = c.id === actual?.id;
            return (
              <div key={c.id}>
                <button type="button" onClick={() => irA(c.id)} style={{
                  all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', padding: cel ? '11px 10px' : '7px 10px', borderRadius: 8, fontSize: 13.5,
                  color: on ? T.text : c.pendiente ? T.text3 : T.text2, fontWeight: on ? 700 : 500,
                  background: on ? T.band : 'transparent', boxShadow: on ? `inset 3px 0 0 ${T.accent}` : 'none',
                }}>{c.titulo}</button>
                {on && c.secciones?.length > 0 && (
                  <div style={{ margin: '2px 0 6px 14px', borderLeft: `1px solid ${T.border2}` }}>
                    {c.secciones.map((s) => (
                      <button key={s.id} type="button" onClick={() => irA(c.id, s.id)} style={{
                        all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', padding: cel ? '9px 10px' : '5px 10px', fontSize: 12.5,
                        color: activa === s.id ? T.accentTxt : T.text2, fontWeight: activa === s.id ? 700 : 500,
                      }}>{s.titulo}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ background: T.band, minHeight: 'calc(100vh - 64px)', fontFamily: FB, color: T.text }}>
      <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : conToc ? '280px minmax(0,1fr) 220px' : '280px minmax(0,1fr)', alignItems: 'start' }}>
        {!cel && (
          <aside ref={asideRef} style={{ position: 'sticky', top: 0, height: altoLat || 'calc(100vh - 64px)', overflowY: 'auto', background: T.bg, borderRight: `1px solid ${T.border}`, padding: '16px 12px 30px', boxSizing: 'border-box' }}>
            {indice}
          </aside>
        )}

        <main style={{ padding: cel ? '14px 16px 60px' : '26px 48px 80px', maxWidth: 880, boxSizing: 'border-box', minWidth: 0 }}>
          {cel && (
            <button type="button" onClick={() => setIndiceAbierto(true)} style={{ ...btn(false, 44), width: '100%', justifyContent: 'flex-start', marginBottom: 14 }}>☰ Índice del manual</button>
          )}
          {!datos && <div style={{ color: T.text2, padding: 20 }}>Cargando el manual…</div>}
          {datos && actual && (
            <>
              <div style={{ fontSize: 12, color: T.text3, marginBottom: 6 }}>Manual › {actual.grupo} › {actual.titulo}</div>
              <h1 style={{ fontFamily: FT, fontWeight: 800, fontSize: cel ? 24 : 30, margin: '0 0 8px', lineHeight: 1.2 }}>{actual.titulo}</h1>
              {actual.resumen && <p style={{ fontSize: 16, lineHeight: 1.6, color: T.text2, margin: '0 0 16px' }}>{actual.resumen}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
                {guia && <button type="button" onClick={() => pedirGuia(guia, navigate)} style={{ ...btn(true, cel ? 44 : 38), flex: cel ? 1 : 'none' }}>▶ Mostrámelo en la app</button>}
                <button type="button" onClick={() => copiarLink()} style={{ ...btn(false, cel ? 44 : 38), flex: cel ? 1 : 'none' }}>🔗 Copiar link</button>
              </div>

              {actual.pendiente && (
                <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, color: T.text2, fontSize: 14.5, lineHeight: 1.6 }}>
                  Este capítulo se está escribiendo. Mientras tanto, Anthony te lo muestra paso a paso en la pantalla real.
                  {guia?.sectores?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: T.text3 }}>Por partes:</span>
                      {guia.sectores.map((s) => (
                        <button key={s} type="button" onClick={() => pedirGuia(guia, navigate, s)} style={{ ...btn(false, cel ? 40 : 30), fontSize: 12.5, padding: '0 12px', color: T.accentTxt }}>{NOMBRE_SECTOR[s] || s}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(actual.secciones || []).map((s, i) => (
                <section key={s.id} id={s.id} data-sec={s.id} ref={(el) => { refs.current[s.id] = el; }} style={{ scrollMarginTop: 80, marginTop: i ? 34 : 0 }}>
                  <h2 style={{ fontFamily: FT, fontWeight: 700, fontSize: cel ? 18 : 20, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 14, background: T.accent, color: T.ink, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    {s.titulo}
                  </h2>
                  <Texto texto={s.texto} />
                  {s.imagen && (
                    <figure style={{ margin: '6px 0 4px' }}>
                      <a href={urlImagen(s.imagen)} target="_blank" rel="noreferrer" title="Ver la imagen grande"><img src={urlImagen(s.imagen)} alt={s.pie || s.titulo} loading="lazy"
                        // Las capturas son al doble de resolución: se muestran a la mitad de su ancho (un modal
                        // chico no se agranda a todo el ancho), nunca más anchas que la columna.
                        onLoad={(e) => { e.currentTarget.style.maxWidth = `${Math.round(e.currentTarget.naturalWidth / 2)}px`; }}
                        style={{ display: 'block', width: '100%', borderRadius: 12, border: `1px solid ${T.border}`, boxShadow: T.sombraSuave }} /></a>
                      {s.pie && <figcaption style={{ fontSize: 12.5, color: T.text3, marginTop: 6 }}>{s.pie}</figcaption>}
                    </figure>
                  )}
                  {s.tip && <div style={{ background: '#EEF8FD', border: '1px solid #bfdcef', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: T.accentTxt, marginTop: 12, lineHeight: 1.55 }}>💡 <Negritas t={s.tip} /></div>}
                </section>
              ))}

              {/* anterior / siguiente, como en un libro */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 44, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
                {idx > 0 ? <Link to={`/manual/${capitulos[idx - 1].id}`} style={{ textDecoration: 'none', color: T.accentTxt, fontSize: 13.5, fontWeight: 600 }}>‹ {capitulos[idx - 1].titulo}</Link> : <span />}
                {idx < capitulos.length - 1 ? <Link to={`/manual/${capitulos[idx + 1].id}`} style={{ textDecoration: 'none', color: T.accentTxt, fontSize: 13.5, fontWeight: 600, textAlign: 'right' }}>{capitulos[idx + 1].titulo} ›</Link> : <span />}
              </div>
            </>
          )}
        </main>

        {conToc && (
          <nav style={{ position: 'sticky', top: 0, padding: '28px 16px', fontSize: 13 }}>
            {actual?.secciones?.length > 0 && (<>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: T.text3, marginBottom: 8 }}>En esta página</div>
              {actual.secciones.map((s) => (
                <button key={s.id} type="button" onClick={() => irA(actual.id, s.id)} style={{
                  all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', padding: '4px 0 4px 10px', lineHeight: 1.4,
                  borderLeft: `2px solid ${activa === s.id ? T.accent : T.border}`, color: activa === s.id ? T.text : T.text2, fontWeight: activa === s.id ? 600 : 400,
                }}>{s.titulo}</button>
              ))}
            </>)}
          </nav>
        )}
      </div>

      {/* celular: el índice a pantalla completa */}
      {cel && indiceAbierto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: T.bg, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${T.border}`, background: T.band }}>
            <span style={{ fontFamily: FT, fontWeight: 800, fontSize: 17 }}>Índice del manual</span>
            <button type="button" onClick={() => setIndiceAbierto(false)} aria-label="Cerrar" style={{ all: 'unset', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: T.text2 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{indice}</div>
        </div>
      )}
      {aviso && (
        <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: T.ink, color: '#fff', fontFamily: FB,
          fontSize: 13.5, fontWeight: 600, padding: '10px 16px', borderRadius: 12, boxShadow: T.sombra, zIndex: 1400 }}>{aviso}</div>
      )}
    </div>
  );
}
