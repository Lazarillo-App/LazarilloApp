// src/paginas/Conciliacion.jsx
// Módulo de conciliación bancaria (14/11/2026). El módulo (ModuloConciliacion, de Diego) cruza
// las ventas del POS y las cobranzas de cuenta corriente de MaxiRest con Mercado Pago. Esta
// página lo monta para el negocio activo y le da el guardado en el servidor: lo que se sube,
// el trabajo de cada período y la memoria de pagadores. Solo dueño y admin (App.jsx).
// Va por SUCURSAL (usuaria 14/11: cada sucursal cobra en su propia cuenta de Mercado Pago): con
// "Todas" elegida y el negocio con sucursales, primero se pide elegir una.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { ConciliacionAPI, MercadoPagoAPI, sucursalNum } from '@/servicios/apiConciliacion';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import ModuloConciliacion from '@/componentes/conciliacion/ModuloConciliacion';
import { showConfirm } from '@/servicios/appConfirm';
import { fuentesDesdeMaxi } from '@/componentes/conciliacion/desdeMaxi';
import SpotlightTour from '@/componentes/SpotlightTour';
import { usePasosHeader, usePasosPresentes } from '@/componentes/asistente/pasosHeader';
import { useSectorGuia } from '@/componentes/asistente/guias';
import { useRecorrido } from '@/hooks/useRecorrido';

// Guía de Conciliación (Diego 15/11/2026: «conciliación no tiene guía»). Sectores: Fuentes (de
// dónde salen los datos y el período), Conciliar (buscar, la barra y los dos lados) y Header.
// Cada paso se muestra solo si esa parte está en pantalla (sin datos no hay tablas).
const PASOS_CONC = [
  { k: 'conc-elegir', s: 'fuentes', t: <>Cada sucursal cobra en su propia cuenta de <b>Mercado Pago</b>, así que se concilia por separado: elegí cuál.</> },
  { k: 'conc-traer', s: 'fuentes', t: <>Las <b>ventas</b> de tu punto de venta y los <b>cobros de Mercado Pago</b> llegan solos, sin subir archivos. El <b>punto del header</b> te dice cuándo se trajeron.</> },
  { k: 'conc-extras', s: 'fuentes', t: <>Acá ves la lista de lo que <b>entró al banco</b> y lo que <b>salió de Mercado Pago</b> (pagos, retiros, impuestos y comisiones).</> },
  { k: 'conc-fuentes', s: 'fuentes', t: <>Lo que no se trae solo lo subís con su <b>archivo</b>: ventas no efectivo, cobranzas de cuenta corriente y movimientos del banco. Cada tarjeta tiene su instructivo.</> },
  { k: 'conc-periodo', s: 'fuentes', t: <>Elegí el <b>mes</b> o las fechas. <b>Tolerancia</b>: si el cobro puede caer un día después. Debajo de <b>Auto-conciliar</b> se concilia solo; hasta <b>Margen sugerencias</b> te lo propone para que lo revises.</> },
  { k: 'conc-buscar', s: 'conciliar', t: <>Buscás un <b>comprobante o cliente</b> a la izquierda y un <b>pago por importe</b> o pagador a la derecha.</> },
  { k: 'conc-barra', s: 'conciliar', t: <>La barra compara lo que <b>vendiste</b> con lo que <b>entró al banco</b>. Tildás filas de los dos lados y con <b>Conciliar</b> las cerrás a mano.</> },
  { k: 'conc-paneles', s: 'conciliar', t: <>A la izquierda, tus <b>facturas y cobranzas</b>; a la derecha, el <b>banco</b>. Filtrás Todas, Conciliadas o Pendientes; en Pendientes vas día por día.</> },
];

// Ancho de la pantalla de Conciliación (19/11, Diego: «no podemos mejorar el diseño para que ocupe mejor el ancho?»):
// antes 1180 fijo; ahora usa la pantalla hasta 1760.
const ANCHO_CONC = 1760;

const iniciales = (nombre) => String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function Conciliacion() {
  const { activeBusinessId, active } = useBusiness() || {};
  const { branches = [], activeBranchId, setActiveBranch } = useBranch() || {};
  const bid = Number(activeBusinessId) || null;
  const reales = branches.filter((b) => b.id !== 'main');
  // Sucursal a conciliar: la elegida; con "Todas" solo vale si el negocio no tiene otras.
  const suc = activeBranchId == null ? (reales.length ? null : 0) : sucursalNum(activeBranchId);
  const sucNombre = suc === null ? '' : (branches.find((b) => sucursalNum(b.id) === suc)?.name || '');

  const [inicial, setInicial] = useState(null);   // { fuentes, pagadores } del servidor
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');         // "Guardado" / errores de guardado
  const avisoT = useRef(null);
  const pagT = useRef(null);
  const [ver, setVer] = useState(0);             // sube cuando se recargan las fuentes (rearma el módulo)
  const [mp, setMp] = useState(null);            // estado de la conexión con Mercado Pago
  const [maxi, setMaxi] = useState(null);        // ¿hay datos de MaxiRest (kit) para esta sucursal?
  const [verBanco, setVerBanco] = useState(false); // lista simple de lo cargado (sirve sin ventas)
  // CLIENTES del header (Diego 19/11/2026): /conciliacion?clientes=1 abre el modal del cliente vacío, con el buscador.
  const [params, setParams] = useSearchParams();
  const [abrirClientes, setAbrirClientes] = useState(0);
  useEffect(() => {
    if (params.get('clientes') !== '1') return;
    setAbrirClientes((n) => n + 1);
    setParams((p) => { const n = new URLSearchParams(p); n.delete('clientes'); return n; }, { replace: true });
  }, [params, setParams]);
  const [verEgresos, setVerEgresos] = useState(false); // lo que salió de Mercado Pago (14/11)

  const avisar = useCallback((t, ms = 2500) => {
    setAviso(t);
    clearTimeout(avisoT.current);
    if (ms) avisoT.current = setTimeout(() => setAviso(''), ms);
  }, []);

  useEffect(() => {
    setMp(null);
    if (!bid || suc === null) return;
    MercadoPagoAPI.estado(bid, suc).then(setMp).catch(() => setMp(null));
  }, [bid, suc, ver]);

  useEffect(() => {
    setMaxi(null);
    if (!bid || suc === null) return;
    ConciliacionAPI.maxiEstado(bid, suc).then(setMaxi).catch(() => setMaxi({ disponible: false }));
  }, [bid, suc, ver]);

  useEffect(() => {
    if (!bid || suc === null) return;
    let vivo = true;
    setInicial(null); setError('');
    ConciliacionAPI.cargar(bid, suc)
      .then((r) => {
        if (!vivo) return;
        const f = r?.fuentes || {};
        setInicial({
          fuentes: {
            ventas: f.ventas?.filas || null,
            pagos: f.pagos?.filas || null,
            banco: f.banco?.filas || null,
            facturas_cc: f.facturas_cc?.filas || [],
          },
          pagadores: r?.pagadores || {},
          egresos: f.egresos?.filas || [],   // lo que salió de Mercado Pago (no va al módulo de Diego)
        });
      })
      .catch(() => { if (vivo) setError('No pude cargar la conciliación. Probá de nuevo en un rato.'); });
    return () => { vivo = false; clearTimeout(pagT.current); };
  }, [bid, suc, ver]);

  const persist = useMemo(() => (bid && suc !== null && inicial ? {
    fuentes: inicial.fuentes,
    onFuente: (tipo, filas, archivo) => {
      avisar('Guardando el archivo…', 0);
      ConciliacionAPI.guardarFuente(bid, suc, tipo, filas, archivo)
        .then(() => avisar('Archivo guardado'))
        .catch(() => avisar('No se pudo guardar el archivo en el servidor: si cerrás, se pierde.', 8000));
    },
    cargarEstado: (periodo) => ConciliacionAPI.leerEstado(bid, suc, periodo).then((r) => r?.estado || null),
    guardarEstado: (periodo, estado) => {
      ConciliacionAPI.guardarEstado(bid, suc, periodo, estado)
        .then(() => avisar('Cambios guardados', 1500))
        .catch(() => avisar('No se pudieron guardar los últimos cambios. Revisá la conexión.', 8000));
    },
  } : null), [bid, suc, inicial, avisar]);

  // La memoria de pagadores cambia seguido (cada conciliación de cuenta corriente): se manda
  // con una pausa corta.
  const onPagadorMap = useCallback((mapa) => {
    if (!bid || suc === null) return;
    clearTimeout(pagT.current);
    pagT.current = setTimeout(() => { ConciliacionAPI.guardarPagadores(bid, suc, mapa).catch(() => {}); }, 1500);
  }, [bid, suc]);

  // Sacar los movimientos del banco cargados (ej. se trajo una cuenta equivocada de Mercado Pago).
  const borrarBanco = async () => {
    if (!(await showConfirm('¿Borrar todos los movimientos del banco cargados en esta sucursal? Lo que esté conciliado con ellos vuelve a pendiente. Después podés volver a subir el extracto o traer los cobros.'))) return;
    try { await ConciliacionAPI.borrarFuente(bid, suc, 'banco'); avisar('Movimientos del banco borrados'); setVer((n) => n + 1); }
    catch { avisar('No se pudieron borrar. Probá de nuevo.', 6000); }
  };

  // Guía (arranca sola mientras la sucursal no tiene nada cargado; si no, desde Guías).
  const sinFuentes = !!inicial && !Object.values(inicial.fuentes || {}).some((a) => a?.length);
  const pasosConc = usePasosPresentes(PASOS_CONC, `${suc}:${!!inicial}:${ver}:${verBanco}:${verEgresos}`);
  const pasosHeaderConc = usePasosHeader();
  const sectorConc = useSectorGuia('conciliacion');
  const pasosTourConc = pasosConc.concat(pasosHeaderConc).filter((p) => !sectorConc || p.s === sectorConc);
  const recConc = useRecorrido('conciliacion', pasosTourConc.length, !!bid && (suc === null || !!inicial) && pasosConc.length > 0,
    { sinDatos: sinFuentes });
  const pasoConc = pasosTourConc[recConc.paso - 1];
  const guiaConc = recConc.visible && pasoConc ? (
    <SpotlightTour key={pasoConc.k} targetRef={pasoConc.ref} pose={recConc.paso === 1 ? 'presenta' : 'senala'}
      placement="bottom" text={pasoConc.t} {...recConc.props(recConc.paso)} />
  ) : null;

  if (!bid) return <div style={{ padding: 32 }}>Elegí un negocio para conciliar.</div>;

  // "Todas" no se concilia junto: cada sucursal tiene su cuenta de Mercado Pago.
  if (suc === null) {
    return (
      <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 16px', fontFamily: "'Archivo', system-ui, sans-serif", color: '#15213E' }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, margin: '0 0 6px' }}>¿Qué sucursal querés conciliar?</h2>
        <p style={{ color: '#5b6577', margin: '0 0 18px', fontSize: 14 }}>
          Cada sucursal se concilia por separado, porque cada una cobra en su propia cuenta de Mercado Pago.
        </p>
        {guiaConc}
        <div data-tour="conc-elegir" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {branches.map((b) => (
            <button key={b.id} type="button" onClick={() => setActiveBranch(b.id)}
              style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(21,33,62,.16)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#15213E' }}>
              {b.name}{b.id === 'main' ? <span style={{ color: '#8a93a3', fontWeight: 400 }}> · principal</span> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <div style={{ padding: 32, color: '#991b1b' }}>{error}</div>;
  if (!inicial) return <div style={{ padding: 32, color: '#64748b' }}>Cargando la conciliación…</div>;

  const business = {
    id: `${bid}:${suc}`, // para recordar período, día y corte por negocio y sucursal
    group: active?.organization_name || active?.org_name || '',
    name: reales.length && sucNombre ? `${active?.name || 'Negocio'} · ${sucNombre}` : (active?.name || 'Negocio'),
    initials: iniciales(active?.name),
    color: 'var(--color-primary, #5BC2EA)',
  };

  return (
    <div style={{ position: 'relative' }}>
      {aviso && (
        <div style={{
          position: 'fixed', left: 20, bottom: 20, zIndex: 1300, background: '#15213E', color: '#fff',
          borderRadius: 10, padding: '8px 14px', fontSize: 13, boxShadow: '0 6px 20px rgba(0,0,0,.25)',
        }}>{aviso}</div>
      )}
      {guiaConc}
      <TraerSolo bid={bid} suc={suc} sucNombre={reales.length ? sucNombre : ''} mp={mp} maxi={maxi}
        guardadas={inicial.fuentes} onTraido={() => setVer((n) => n + 1)} avisar={avisar} />
      {(inicial.fuentes.banco?.length > 0 || inicial.egresos.length > 0) && (
        <div data-tour="conc-extras" style={{ maxWidth: ANCHO_CONC, margin: '6px auto 0', padding: '0 22px', display: 'flex', gap: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {inicial.egresos.length > 0 && (
            <button type="button" onClick={() => setVerEgresos((v) => !v)}
              style={{ border: 'none', background: 'none', color: '#2492C8', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0, textDecoration: 'underline', fontWeight: 600 }}>
              {verEgresos ? 'Ocultar egresos de Mercado Pago' : `Ver egresos de Mercado Pago (${inicial.egresos.length})`}
            </button>
          )}
          {inicial.fuentes.banco?.length > 0 && <>
          <button type="button" onClick={() => setVerBanco((v) => !v)}
            style={{ border: 'none', background: 'none', color: '#2492C8', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0, textDecoration: 'underline', fontWeight: 600 }}>
            {verBanco ? 'Ocultar movimientos del banco' : `Ver movimientos del banco (${inicial.fuentes.banco.length})`}
          </button>
          <button type="button" onClick={borrarBanco}
            title="Saca todos los movimientos del banco cargados en esta sucursal (por archivo o traídos de Mercado Pago)"
            style={{ border: 'none', background: 'none', color: '#8a93a3', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0, textDecoration: 'underline' }}>
            Borrar los movimientos del banco cargados ({inicial.fuentes.banco.length})
          </button>
          </>}
        </div>
      )}
      {verEgresos && inicial.egresos.length > 0 && <ListaEgresos filas={inicial.egresos} />}
      {verBanco && inicial.fuentes.banco?.length > 0 && <ListaBanco filas={inicial.fuentes.banco} />}
      {/* key: al cambiar de negocio o sucursal (o al traer cobros nuevos) se arma de cero */}
      <ModuloConciliacion key={`${bid}:${suc}:${ver}`} business={business} embedded persist={persist}
        pagadorMap={inicial.pagadores} onPagadorMap={onPagadorMap} abrirClientes={abrirClientes} />
    </div>
  );
}

// Lista simple de los movimientos del banco cargados (13/11): el módulo arma sus tablas recién
// cuando hay ventas y banco; esto deja ver lo traído de Mercado Pago (o subido) igual.
const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
function ListaBanco({ filas }) {
  const orden = [...filas].sort((a, b) => String(b.ts || b.fecha || '').localeCompare(String(a.ts || a.fecha || '')));
  const total = orden.reduce((a, f) => a + (Number(f.imp) || 0), 0);
  const th = { textAlign: 'left', padding: '7px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#8a93a3', fontWeight: 700, borderBottom: '1px solid rgba(21,33,62,.12)', position: 'sticky', top: 0, background: '#F7F9FB' };
  const td = { padding: '6px 10px', fontSize: 13, borderBottom: '1px solid rgba(21,33,62,.07)', color: '#15213E' };
  return (
    <div style={{ maxWidth: ANCHO_CONC, margin: '8px auto 0', padding: '0 22px' }}>
      <div style={{ background: '#fff', border: '1px solid rgba(21,33,62,.16)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', fontSize: 13, color: '#5b6577', borderBottom: '1px solid rgba(21,33,62,.1)' }}>
          {orden.length} movimiento{orden.length === 1 ? '' : 's'} · total <b style={{ color: '#15213E' }}>{pesos(total)}</b>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Archivo', system-ui, sans-serif" }}>
            <thead><tr>
              <th style={th}>Fecha</th><th style={th}>Hora</th><th style={th}>Pagador</th><th style={th}>Medio</th><th style={th}>Descripción</th><th style={{ ...th, textAlign: 'right' }}>Importe</th>
            </tr></thead>
            <tbody>
              {orden.map((f) => (
                <tr key={f.id}>
                  <td style={td}>{f.fecha ? `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)}` : '—'}</td>
                  <td style={{ ...td, color: '#8a93a3' }}>{f.hora || '—'}</td>
                  <td style={td}>{f.cliente || <span style={{ color: '#8a93a3' }}>sin nombre</span>}</td>
                  <td style={{ ...td, color: '#5b6577' }}>{f.tipoMedio || f.medio || '—'}</td>
                  <td style={{ ...td, color: '#5b6577', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.descripcion || ''}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>{pesos(f.imp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Egresos de Mercado Pago (14/11): pagos hechos desde la cuenta, retiros, impuestos, comisiones,
// devoluciones. Arriba, el total por tipo; abajo, el detalle.
function ListaEgresos({ filas }) {
  const orden = [...filas].sort((a, b) => `${b.fecha} ${b.hora || ''}`.localeCompare(`${a.fecha} ${a.hora || ''}`));
  const porTipo = new Map();
  orden.forEach((f) => porTipo.set(f.tipo || 'Otro', (porTipo.get(f.tipo || 'Otro') || 0) + (Number(f.imp) || 0)));
  const total = orden.reduce((a, f) => a + (Number(f.imp) || 0), 0);
  const th = { textAlign: 'left', padding: '7px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#8a93a3', fontWeight: 700, borderBottom: '1px solid rgba(21,33,62,.12)', position: 'sticky', top: 0, background: '#F7F9FB' };
  const td = { padding: '6px 10px', fontSize: 13, borderBottom: '1px solid rgba(21,33,62,.07)', color: '#15213E' };
  return (
    <div style={{ maxWidth: ANCHO_CONC, margin: '8px auto 0', padding: '0 22px' }}>
      <div style={{ background: '#fff', border: '1px solid rgba(21,33,62,.16)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', fontSize: 13, color: '#5b6577', borderBottom: '1px solid rgba(21,33,62,.1)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>{orden.length} egreso{orden.length === 1 ? '' : 's'} · total <b style={{ color: '#D64545' }}>{pesos(total)}</b></span>
          {[...porTipo.entries()].sort((a, b) => b[1] - a[1]).map(([t, v]) => <span key={t}>{t}: <b style={{ color: '#15213E' }}>{pesos(v)}</b></span>)}
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Archivo', system-ui, sans-serif" }}>
            <thead><tr>
              <th style={th}>Fecha</th><th style={th}>Hora</th><th style={th}>Tipo</th><th style={th}>Detalle</th><th style={{ ...th, textAlign: 'right' }}>Importe</th>
            </tr></thead>
            <tbody>
              {orden.map((f) => (
                <tr key={f.id}>
                  <td style={td}>{f.fecha ? `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)}` : '—'}</td>
                  <td style={{ ...td, color: '#8a93a3' }}>{f.hora || '—'}</td>
                  <td style={td}>{f.tipo || 'Otro'}</td>
                  <td style={{ ...td, color: '#5b6577', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={f.cuenta ? `Cuenta destino ${f.cuenta}` : undefined}>{f.detalle || ''}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontFamily: "'Sora', sans-serif", color: '#D64545' }}>−{pesos(f.imp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Barra de arriba del módulo (13/11): con un solo botón trae lo del período sin subir archivos.
//  - MaxiRest: ventas detalladas (22) y cobranzas de cuenta corriente, de lo que el kit sube a
//    Render todos los días (llegan hasta el día anterior). Reemplaza lo guardado de esas fechas.
//  - Mercado Pago: los cobros de la cuenta conectada de la sucursal, como movimientos del banco.
// Lo que no esté disponible se sigue pudiendo subir con el archivo, como antes.
// 19/11 (vuelven los atajos de #286, que se perdieron al igualar con main en #294): Este mes /
// Últimos 3 meses / Todo el historial / Elegir fechas. El servidor acepta hasta 3 meses por pedido:
// el período se parte en meses y se trae uno por uno, con avance y botón Cortar. «Todo el historial»
// va hacia atrás hasta 2 meses seguidos sin ventas ni cobros (tope 36). Lo de MaxiRest se junta y
// se guarda una sola vez al final (o al cortar / fallar), para no subir todo en cada mes.
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyISO = () => isoLocal(new Date()); // fecha de Argentina (toISOString daba mañana después de las 21)
const restarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() - n); return isoLocal(d); };
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (iso) => `${MESES_C[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
// [desde, hasta] partido por mes calendario, del más nuevo al más viejo
function tramosPorMes(desde, hasta) {
  const out = [];
  let fin = hasta;
  while (fin >= desde) {
    const ini = fin.slice(0, 8) + '01';
    out.push({ desde: ini < desde ? desde : ini, hasta: fin });
    fin = restarDias(ini, 1);
  }
  return out;
}
const MAX_MESES_HISTORIAL = 36;
// 19/11 (Diego: «¿esa barra no debería estar en otro lado? … el MP se puede sumar al pulso y el traer se
// debería dar cuenta si ya está todo el historial y después queda en automático»). Sin barra ni botón:
//  - Mercado Pago se trae solo todos los días (y su historial al conectarlo); cuándo, lo dice el punto del header.
//  - Las ventas y cobranzas del POS se traen solas al abrir: la primera vez todo el historial (mes a mes hacia
//    atrás, hasta 2 meses seguidos sin nada, tope 36); después solo lo que falta desde la última venta guardada
//    (con 2 días de margen) hasta lo último que subió el POS. Lo de esos días se reemplaza.
//  - Sin POS integrado: una línea que dice dónde subir los informes. Sin Mercado Pago: el link para conectarlo.
// Una vez por sucursal mientras la app está abierta: al recargar las fuentes la pantalla se rearma (y este
// componente también), y un día sin ventas al final no tiene que hacer que se vuelva a traer en bucle.
const yaTraido = new Set();
function TraerSolo({ bid, suc, sucNombre, mp, maxi, guardadas, onTraido, avisar }) {
  const [avance, setAvance] = useState(null); // { mes } mientras trae
  const cb = useRef({ avisar, onTraido });
  cb.current = { avisar, onTraido };
  const conMaxi = !!maxi?.disponible;

  useEffect(() => {
    if (!conMaxi || !guardadas) return;
    const clave = `${bid}:${suc}`;
    if (yaTraido.has(clave)) return;
    yaTraido.add(clave);
    const hoy = hoyISO();
    const tope = maxi.datos_hasta && maxi.datos_hasta < hoy ? maxi.datos_hasta : hoy;
    const dias = (guardadas.ventas || []).map((x) => String(x.fecha || '').slice(0, 10)).filter(Boolean).sort();
    const ultima = dias[dias.length - 1] || null;
    if (ultima && ultima >= tope) return; // al día: no hay nada que traer
    const todo = !ultima;
    const tramos = tramosPorMes(todo ? tope.slice(0, 8) + '01' : restarDias(ultima, 2), tope);
    (async () => {
      let acc = { ventas: guardadas.ventas || [], pagos: guardadas.pagos || [], facturas_cc: guardadas.facturas_cc || [] };
      let nVentas = 0, nCobranzas = 0, hechos = 0, vacios = 0, pdv = '';
      let fallo = false;
      for (let i = 0; i < tramos.length; i++) {
        const t = tramos[i];
        setAvance({ mes: nombreMes(t.desde) });
        try {
          const r = await ConciliacionAPI.maxiTraer(bid, suc, t.desde, t.hasta);
          const f = fuentesDesdeMaxi(r, acc, t.desde, t.hasta);
          acc = { ventas: f.ventas, pagos: f.pagos, facturas_cc: f.facturas_cc };
          nVentas += f.cuantas.ventas; nCobranzas += f.cuantas.pagos; hechos++; pdv = r.pdv || pdv;
          vacios = f.cuantas.ventas || f.cuantas.pagos ? 0 : vacios + 1;
        } catch {
          fallo = true;
          break;
        }
        if (todo && i === tramos.length - 1 && vacios < 2 && tramos.length < MAX_MESES_HISTORIAL) {
          const ini = restarDias(t.desde, 1).slice(0, 8) + '01';
          tramos.push({ desde: ini, hasta: restarDias(t.desde, 1) });
        }
      }
      if (hechos) {
        setAvance({ mes: 'guardando' });
        try {
          const nombre = `POS ${pdv} hasta ${tramos[0].hasta}`;
          await ConciliacionAPI.guardarFuente(bid, suc, 'ventas', acc.ventas, nombre);
          await ConciliacionAPI.guardarFuente(bid, suc, 'pagos', acc.pagos, nombre);
          await ConciliacionAPI.guardarFuente(bid, suc, 'facturas_cc', acc.facturas_cc, nombre);
        } catch {
          fallo = true;
        }
      }
      setAvance(null);
      if (hechos) {
        cb.current.onTraido();
        if (nVentas || nCobranzas) cb.current.avisar(`Se trajeron del POS ${nVentas.toLocaleString('es-AR')} venta${nVentas === 1 ? '' : 's'} y ${nCobranzas.toLocaleString('es-AR')} cobranza${nCobranzas === 1 ? '' : 's'}`, 5000);
      }
      if (fallo) cb.current.avisar('No se pudieron traer todas las ventas del POS: se vuelve a intentar la próxima vez que abras Conciliación.', 8000);
    })();
  }, [conMaxi, guardadas, bid, suc, maxi]);

  const linea = { maxWidth: ANCHO_CONC, margin: '10px auto 0', padding: '0 22px', fontSize: 13, color: '#5b6577', display: 'flex', gap: 16, flexWrap: 'wrap' };
  const avisos = [];
  if (avance) avisos.push(<span key="t">{avance.mes === 'guardando' ? 'Guardando las ventas del POS…' : <>Trayendo las ventas del POS · <b style={{ color: '#15213E' }}>{avance.mes}</b>…</>}</span>);
  if (maxi && !conMaxi) avisos.push(<span key="p">Este negocio no está integrado con tu POS: subí las ventas con su archivo en las tarjetas de abajo.</span>);
  if (mp && !mp.conectado) avisos.push(<span key="m">Mercado Pago sin conectar{sucNombre ? ` en ${sucNombre}` : ''} · <RouterLink to="/configuracion?tab=7" style={{ fontWeight: 700 }}>Conectar</RouterLink></span>);
  if (!avisos.length) return null;
  return <div data-tour="conc-traer" style={linea}>{avisos}</div>;
}
