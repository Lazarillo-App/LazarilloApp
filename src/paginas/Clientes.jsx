// src/paginas/Clientes.jsx
// Administración › Clientes (Diego 14/11/2026: «una base de datos de clientes con lo que traigo de
// Mercado Pago, lista para exportar, con todos los datos relevantes orientados a marketing»).
// Sale de los cobros de Mercado Pago guardados enteros, de todas las sucursales del negocio
// (GET /mercadopago/clientes). Un cliente = una cuenta de MP que le pagó al negocio.
// Segmentos para marketing (se calculan acá con la fecha de hoy):
//   Frecuente: 3+ compras y vino en los últimos 45 días
//   En riesgo: 3+ compras y hace más de 45 días que no viene
//   Nuevo:     primera compra en los últimos 30 días
//   Dormido:   menos de 3 compras y hace más de 90 días que no viene
//   Ocasional: el resto
// Sin 60 días de historia no se muestran segmentos (no hay con qué comparar).
import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { MercadoPagoAPI, sucursalNum } from '@/servicios/apiConciliacion';
import { useCelular, EncabezadoPagina, ListaTarjetas } from '@/componentes/base';

const T = {
  txt: '#15213E', txt2: '#5b6577', txt3: '#8a93a3', line: 'rgba(21,33,62,.12)', line2: 'rgba(21,33,62,.07)',
  celeste: '#5BC2EA', celesteDeep: '#2492C8', verde: '#1a9c6e', rojo: '#c2410c', ambar: '#B7791F',
};
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;
const dma = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '—');
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const fmtDoc = (d, t) => {
  const n = String(d || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.length === 11) return `${t && !/dni/i.test(t) ? t : 'CUIT'} ${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`;
  return `${t || 'DNI'} ${Number(n).toLocaleString('es-AR')}`;
};

const SEGMENTOS = [
  { k: 'frecuente', uno: 'Frecuente', l: 'Frecuentes', c: T.verde, d: '3 o más compras y vino en los últimos 45 días' },
  { k: 'riesgo', uno: 'En riesgo', l: 'En riesgo', c: T.rojo, d: '3 o más compras pero hace más de 45 días que no viene' },
  { k: 'nuevo', uno: 'Nuevo', l: 'Nuevos', c: T.celesteDeep, d: 'Primera compra en los últimos 30 días' },
  { k: 'dormido', uno: 'Dormido', l: 'Dormidos', c: T.txt3, d: 'Pocas compras y hace más de 90 días que no viene' },
  { k: 'ocasional', uno: 'Ocasional', l: 'Ocasionales', c: T.ambar, d: 'El resto' },
];
const segmentoDe = (c, hoy) => {
  const sin = diasEntre(c.ultima, hoy);
  if (c.compras >= 3) return sin <= 45 ? 'frecuente' : 'riesgo';
  if (diasEntre(c.primera, hoy) <= 30) return 'nuevo';
  if (sin > 90) return 'dormido';
  return 'ocasional';
};

// f = tipo de filtro estilo Excel (Diego 14/11): texto (contiene), num (mín–máx), fecha (desde–hasta),
// lista (tildar valores).
const COLS = [
  { k: 'nombre', l: 'Cliente', izq: true, f: 'texto' },
  { k: 'email', l: 'Email', izq: true, f: 'texto' },
  { k: 'compras', l: 'Compras', f: 'num' },
  { k: 'total', l: 'Total', f: 'num' },
  { k: 'ticket', l: 'Ticket prom.', f: 'num' },
  { k: 'primera', l: 'Primera', f: 'fecha' },
  { k: 'ultima', l: 'Última', f: 'fecha' },
  { k: 'sin', l: 'Días sin venir', f: 'num' },
  { k: 'medio', l: 'Medio', f: 'lista' },
  { k: 'suc', l: 'Sucursal', f: 'lista' },
  { k: 'segL', l: 'Segmento', f: 'lista' },
];
const textoDe = (c, k) => (k === 'nombre' ? `${c.nombre || ''} ${c.docTxt || ''}` : String(c[k] ?? ''));
function pasaFiltro(c, k, f) {
  if (!f) return true;
  const v = c[k];
  if (f.texto != null && f.texto !== '') return textoDe(c, k).toLowerCase().includes(f.texto.toLowerCase());
  if (f.valores) return k === 'suc' ? String(v || '').split(', ').some((x) => f.valores.includes(x)) : f.valores.includes(String(v ?? ''));
  if (f.min !== '' && f.min != null && !(Number(v) >= Number(f.min))) return false;
  if (f.max !== '' && f.max != null && !(Number(v) <= Number(f.max))) return false;
  if (f.desde && !(String(v || '') >= f.desde)) return false;
  if (f.hasta && !(String(v || '') <= f.hasta)) return false;
  return true;
}
const filtroActivo = (f) => !!f && ((f.texto != null && f.texto !== '') || !!f.valores || (f.min !== '' && f.min != null)
  || (f.max !== '' && f.max != null) || !!f.desde || !!f.hasta);

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function Clientes() {
  const { activeBusinessId } = useBusiness() || {};
  const { branches = [] } = useBranch() || {};
  const bid = Number(activeBusinessId) || null;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [seg, setSeg] = useState('');
  const [buscar, setBuscar] = useState('');
  const [orden, setOrden] = useState({ k: 'total', asc: false });
  const [mostrar, setMostrar] = useState(300);
  const [filtros, setFiltros] = useState({});
  const [abierto, setAbierto] = useState(null); // { k, x, y } del menú de la columna
  // Celular (Diego 15/11/2026, «todo sector tiene su vista mobile»): la tabla pasa a tarjetas.
  const celular = useCelular();
  const ponerFiltro = (k, f) => { setFiltros((o) => ({ ...o, [k]: f })); setMostrar(300); };

  useEffect(() => {
    if (!bid) return undefined;
    let vivo = true;
    setError('');
    let t = null;
    // Mientras una cuenta de MP recién vinculada trae su historial, se vuelve a mirar cada 30 s
    // (solo esta consulta, que tarda ~20 ms) y la lista se completa sola.
    const traer = () => MercadoPagoAPI.clientes(bid)
      .then((r) => {
        if (!vivo) return;
        setDatos(r);
        if ((r?.cuentas || []).some((c) => !c.completo)) t = setTimeout(traer, 30000);
      })
      .catch(() => { if (vivo) setError('No pude traer los clientes. Probá de nuevo en un rato.'); });
    traer();
    return () => { vivo = false; clearTimeout(t); };
  }, [bid]);
  const trayendo = (datos?.cuentas || []).filter((c) => !c.completo);

  const hoy = hoyIso();
  const nombreSuc = (s) => (Number(s) === 0 ? (branches.find((b) => b.id === 'main')?.name || 'Principal') : (branches.find((b) => sucursalNum(b.id) === Number(s))?.name || `Sucursal ${s}`));
  const historia = datos?.desde ? diasEntre(datos.desde, datos.hasta || hoy) : 0;
  const conSegmentos = historia >= 60;

  // Lo que no es una persona (14/11, visto en Container Bar): «ventapresencial@mercadopago.com» es el
  // pagador genérico de las ventas con Point; y sin email ni documento (MODO, bancos, billeteras del
  // QR interoperable) no hay a quién contactar. Quedan aparte, a un clic.
  const esGenerico = (c) => /^ventapresencial@mercadopago\./i.test(c.email || '');
  const sinContacto = (c) => !c.email && !c.doc;
  const [verSinContacto, setVerSinContacto] = useState(false);
  const todos = useMemo(() => (datos?.clientes || []).filter((c) => !esGenerico(c)), [datos]);
  const nSinContacto = useMemo(() => todos.filter(sinContacto).length, [todos]);
  const lista = useMemo(() => todos.filter((c) => verSinContacto === sinContacto(c)).map((c) => ({
    ...c,
    ticket: c.compras ? c.total / c.compras : 0,
    sin: diasEntre(c.ultima, hoy),
    seg: segmentoDe(c, hoy),
    segL: SEGMENTOS.find((s2) => s2.k === segmentoDe(c, hoy))?.uno || '',
    docTxt: fmtDoc(c.doc, c.doc_tipo),
    suc: (c.sucursales || []).map(nombreSuc).join(', '),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [todos, verSinContacto, hoy, branches]);

  const cuenta = useMemo(() => {
    const o = {};
    lista.forEach((c) => { o[c.seg] = (o[c.seg] || 0) + 1; });
    return o;
  }, [lista]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const qn = q.replace(/\D/g, '');
    const f = lista.filter((c) => (!seg || c.seg === seg)
      && (!q || `${c.nombre || ''} ${c.email || ''}`.toLowerCase().includes(q) || (qn && String(c.doc || '').includes(qn)))
      && Object.entries(filtros).every(([k, fl]) => pasaFiltro(c, k, fl)));
    const k = orden.k;
    const val = (c) => (k === 'nombre' ? (c.nombre || '~').toLowerCase() : k === 'email' ? (c.email || '~') : c[k]);
    return f.sort((a, b) => { const x = val(a), y = val(b); const r = x < y ? -1 : x > y ? 1 : 0; return orden.asc ? r : -r; });
  }, [lista, seg, buscar, orden, filtros]);

  const tot = useMemo(() => {
    const n = lista.length;
    const conEmail = lista.filter((c) => c.email).length;
    const recurrentes = lista.filter((c) => c.compras >= 2).length;
    const compras = lista.reduce((a, c) => a + c.compras, 0);
    const total = lista.reduce((a, c) => a + c.total, 0);
    const nuevos = lista.filter((c) => diasEntre(c.primera, hoy) <= 30).length;
    return { n, conEmail, recurrentes, ticket: compras ? total / compras : 0, nuevos };
  }, [lista, hoy]);

  const exportar = () => {
    const cab = ['Nombre', 'Email', 'Documento', 'Compras', 'Total', 'Ticket promedio', 'Primera compra', 'Última compra', 'Días sin venir', 'Medio más usado', 'Sucursal', 'Segmento'];
    const segL = Object.fromEntries(SEGMENTOS.map((s) => [s.k, s.l]));
    const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const filas = visibles.map((c) => [c.nombre || '', c.email || '', c.docTxt, c.compras, Math.round(c.total), Math.round(c.ticket),
      c.primera, c.ultima, c.sin, c.medio, c.suc, conSegmentos ? segL[c.seg] : '']);
    const csv = '﻿' + [cab, ...filas].map((f) => f.map(esc).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `clientes-${hoy}${seg ? `-${seg}` : ''}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const pagina = { maxWidth: 1360, margin: '0 auto', padding: celular ? '14px 12px 32px' : '18px 22px 40px', fontFamily: "'Archivo', system-ui, sans-serif", color: T.txt };
  const tarjeta = { background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12 };
  const chip = (on, c) => ({
    fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500, height: celular ? 40 : 34, padding: '0 12px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${on ? (c || T.celeste) : 'rgba(21,33,62,.16)'}`, background: on ? '#5BC2EA1F' : '#fff', color: T.txt,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  });

  if (!bid) return <div style={{ padding: 32 }}>Elegí un negocio.</div>;
  if (error) return <div style={{ padding: 32, color: '#991b1b' }}>{error}</div>;
  if (!datos) return <div style={{ padding: 32, color: '#64748b' }}>Cargando los clientes…</div>;

  if (!todos.length) {
    return (
      <div style={pagina}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, margin: 0 }}>Clientes</h1>
        <div style={{ ...tarjeta, padding: '22px 24px', maxWidth: 560, marginTop: 14 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {trayendo.length ? 'Estamos trayendo tu historial de Mercado Pago' : 'Todavía no hay clientes'}
          </div>
          <div style={{ color: T.txt2, fontSize: 14, marginBottom: trayendo.length || datos.cuentas?.length ? 0 : 14 }}>
            {trayendo.length
              ? <>Va mes por mes hacia atrás y tarda unos minutos. La lista aparece sola acá, y te avisamos en la campana cuando termine.
                {trayendo[0].hasta ? <> Ya va por {MESES_LARGO[Number(trayendo[0].hasta.slice(5, 7)) - 1]} {trayendo[0].hasta.slice(0, 4)}.</> : null}</>
              : datos.cuentas?.length
                ? 'Mercado Pago está conectado, pero todavía no hay cobros con datos del que pagó (email o documento).'
                : <>Se arman solos con los cobros de Mercado Pago: cada persona que te paga queda con su email, documento y cuántas veces vino.
                  Con Mercado Pago conectado, el historial se trae solo.</>}
          </div>
          {!datos.cuentas?.length && <RouterLink to="/movimientos-bancarios?vista=bancos"
            style={{ display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 16px', borderRadius: 8, background: T.celeste, color: '#12111F', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
            Conectá tu banco
          </RouterLink>}
        </div>
      </div>
    );
  }

  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const kpis = [
    { l: 'Clientes', v: tot.n.toLocaleString('es-AR'), s: `desde el ${dma(datos.desde)}` },
    { l: 'Con email', v: tot.conEmail.toLocaleString('es-AR'), s: `${pct(tot.conEmail, tot.n)} · para campañas` },
    { l: 'Volvieron', v: tot.recurrentes.toLocaleString('es-AR'), s: `${pct(tot.recurrentes, tot.n)} compró 2+ veces` },
    { l: 'Ticket promedio', v: pesos(tot.ticket), s: 'por compra' },
    { l: 'Nuevos (30 días)', v: tot.nuevos.toLocaleString('es-AR'), s: 'primera compra' },
  ];
  // borderRadius/boxShadow 0: el estilo global de thead th les pone esquinas redondeadas (dejaban
  // «piquitos» blancos entre columnas).
  const th = { padding: '8px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#fff', fontWeight: 700, position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-primary, #2492C8)', textAlign: 'center', whiteSpace: 'nowrap', userSelect: 'none', borderRadius: 0, boxShadow: 'none' };
  const td = { padding: '7px 8px', fontSize: 13, borderBottom: `1px solid ${T.line2}`, textAlign: 'center', whiteSpace: 'nowrap' };
  const abrirMenu = (e, k) => {
    // La app tiene zoom en #root: el rectángulo viene escalado y el menú fijo se vuelve a escalar.
    const z = parseFloat(getComputedStyle(document.getElementById('root') || document.body).zoom) || 1;
    const r = e.currentTarget.getBoundingClientRect();
    setAbierto(abierto?.k === k ? null : { k, x: Math.min(r.left / z, window.innerWidth / z - 270), y: r.bottom / z + 4 });
  };
  const segInfo = Object.fromEntries(SEGMENTOS.map((s) => [s.k, s]));

  return (
    <div style={pagina}>
      <EncabezadoPagina
        titulo="Clientes"
        bajada={<>
          Los que te pagaron por Mercado Pago, en todas las sucursales · del {dma(datos.desde)} al {dma(datos.hasta)}
          {datos.propios?.length ? ' · sin contar tus propias cuentas' : ''}
          {trayendo.length ? <> · <b style={{ fontWeight: 600 }}>trayendo el historial de {trayendo.map((c) => nombreSuc(c.sucursal)).join(', ')}…</b></> : null}
        </>}
        acciones={<>
        <input type="search" value={buscar} onChange={(e) => { setBuscar(e.target.value); setMostrar(300); }} placeholder="Buscar cliente, email o CUIT"
          style={{ fontFamily: 'inherit', fontSize: celular ? 16 : 13.5, height: celular ? 44 : 36, boxSizing: 'border-box', padding: '0 12px', borderRadius: 8, border: '1px solid rgba(21,33,62,.16)', width: celular ? 'auto' : 260, flex: celular ? 1 : undefined, flexShrink: 1, minWidth: celular ? 0 : 160 }} />
        <button type="button" onClick={exportar}
          style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, height: celular ? 44 : 36, padding: celular ? '0 12px' : '0 16px', borderRadius: 8, border: 'none', background: T.celeste, color: '#12111F', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {celular ? `Exportar (${visibles.length.toLocaleString('es-AR')})` : `Exportar a Excel (${visibles.length.toLocaleString('es-AR')})`}
        </button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: celular ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ ...tarjeta, padding: '12px 14px', minWidth: 0 }}>
            <div style={{ fontSize: 12, color: T.txt3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{k.l}</div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 20, marginTop: 4, whiteSpace: 'nowrap' }}>{k.v}</div>
            <div style={{ fontSize: 12, color: T.txt2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.s}</div>
          </div>
        ))}
      </div>

      <div style={{ ...tarjeta, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 12px', borderBottom: `1px solid ${T.line}` }}>
          <button type="button" onClick={() => setSeg('')} style={chip(!seg)}>Todos <b>{tot.n.toLocaleString('es-AR')}</b></button>
          {conSegmentos && SEGMENTOS.map((s) => (
            <button key={s.k} type="button" title={s.d} onClick={() => setSeg(seg === s.k ? '' : s.k)} style={chip(seg === s.k, s.c)}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: s.c }} />{s.l} <b>{(cuenta[s.k] || 0).toLocaleString('es-AR')}</b>
            </button>
          ))}
          {nSinContacto > 0 && (
            <button type="button" onClick={() => { setVerSinContacto((v) => !v); setSeg(''); }} style={chip(verSinContacto, T.txt3)}
              title="Pagos sin email ni documento: billeteras, bancos del QR interoperable. No hay a quién contactar.">
              {verSinContacto ? '← Volver a los clientes' : `Sin datos de contacto ${nSinContacto.toLocaleString('es-AR')}`}
            </button>
          )}
          {Object.values(filtros).some(filtroActivo) && (
            <button type="button" onClick={() => setFiltros({})} style={{ ...chip(true, T.celeste), marginLeft: 'auto' }}>
              {Object.values(filtros).filter(filtroActivo).length} filtro{Object.values(filtros).filter(filtroActivo).length === 1 ? '' : 's'} por columna · Limpiar ✕
            </button>
          )}
        </div>
        {!conSegmentos && (
          <div style={{ padding: '6px 14px', fontSize: 12.5, color: T.txt3, borderBottom: `1px solid ${T.line2}` }}>
            Los segmentos (frecuentes, en riesgo, nuevos…) aparecen con 60 días de historia.
          </div>
        )}
        {celular ? (
          <ListaTarjetas
            filas={visibles.slice(0, mostrar)}
            clave={(c) => c.id}
            titulo={(c) => (c.nombre ? c.nombre : <span style={{ color: T.txt3, fontWeight: 500 }}>sin nombre</span>)}
            subtitulo={(c) => c.email || c.docTxt}
            marca={conSegmentos ? (c) => (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${segInfo[c.seg].c}1f`, color: segInfo[c.seg].c, whiteSpace: 'nowrap' }}>{segInfo[c.seg].uno}</span>
            ) : undefined}
            datos={[
              { l: 'Compras', v: (c) => c.compras },
              { l: 'Total', v: (c) => pesos(c.total) },
              { l: 'Sin venir', v: (c) => `${c.sin} d`, color: (c) => (c.sin > 45 ? T.rojo : T.txt) },
              { l: 'Ticket prom.', v: (c) => pesos(c.ticket) },
              { l: 'Documento', v: (c) => c.docTxt || '—' },
              { l: 'Primera', v: (c) => dma(c.primera) },
              { l: 'Última', v: (c) => dma(c.ultima) },
              { l: 'Medio', v: (c) => c.medio || '—' },
              { l: 'Sucursal', v: (c) => c.suc || '—' },
            ]}
            vacio="Nada coincide con los filtros."
            pie={visibles.length > mostrar ? (
              <div style={{ padding: 4, textAlign: 'center' }}>
                <button type="button" onClick={() => setMostrar((m) => m + 500)} style={{ ...chip(false), height: 44 }}>
                  Ver {Math.min(500, visibles.length - mostrar).toLocaleString('es-AR')} más · quedan {(visibles.length - mostrar).toLocaleString('es-AR')}
                </button>
              </div>
            ) : null}
          />
        ) : (
        <div style={{ maxHeight: 620, overflow: 'auto' }} onScroll={() => setAbierto(null)}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0 }}>
            <thead><tr>
              {COLS.filter((c) => c.k !== 'segL' || conSegmentos).map((c) => {
                const act = filtroActivo(filtros[c.k]);
                const ord = orden.k === c.k || (c.k === 'segL' && orden.k === 'seg');
                return (
                  <th key={c.k} style={c.izq ? { ...th, textAlign: 'left' } : th}>
                    <button type="button" onClick={(e) => abrirMenu(e, c.k)} title="Ordenar y filtrar"
                      style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.l}
                      <span style={{ fontSize: 9, opacity: act || ord ? 1 : 0.6, width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: act ? '#fff' : 'transparent', color: act ? 'var(--color-primary, #2492C8)' : '#fff' }}>
                        {act ? '▼' : ord ? (orden.asc ? '▲' : '▼') : '▾'}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr></thead>
            <tbody>
              {visibles.slice(0, mostrar).map((c) => (
                <tr key={c.id}>
                  <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', minWidth: 150, maxWidth: 220, lineHeight: 1.3 }}>
                    {c.nombre ? <span>{c.nombre}</span> : <span style={{ color: T.txt3 }}>sin nombre</span>}
                    {c.docTxt ? <span style={{ display: 'block', color: T.txt3, fontSize: 12 }}>{c.docTxt}</span> : null}
                  </td>
                  <td style={{ ...td, textAlign: 'left', color: c.email ? T.txt : T.txt3, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.email || ''}>{c.email || '—'}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{c.compras}</td>
                  <td style={{ ...td, fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>{pesos(c.total)}</td>
                  <td style={{ ...td, color: T.txt2 }}>{pesos(c.ticket)}</td>
                  <td style={{ ...td, color: T.txt2 }}>{dma(c.primera)}</td>
                  <td style={td}>{dma(c.ultima)}</td>
                  <td style={{ ...td, color: c.sin > 45 ? T.rojo : T.txt2 }}>{c.sin}</td>
                  <td style={{ ...td, color: T.txt2 }}>{c.medio || '—'}</td>
                  <td style={{ ...td, color: T.txt2 }}>{c.suc || '—'}</td>
                  {conSegmentos && (
                    <td style={td}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${segInfo[c.seg].c}1f`, color: segInfo[c.seg].c }}>{segInfo[c.seg].uno}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {visibles.length > mostrar && (
            <div style={{ padding: 12, textAlign: 'center' }}>
              <button type="button" onClick={() => setMostrar((m) => m + 500)} style={chip(false)}>
                Ver {Math.min(500, visibles.length - mostrar).toLocaleString('es-AR')} más · quedan {(visibles.length - mostrar).toLocaleString('es-AR')}
              </button>
            </div>
          )}
          {!visibles.length && <div style={{ padding: 16, fontSize: 13, color: T.txt3, textAlign: 'center' }}>Nada coincide con los filtros.</div>}
        </div>
        )}
      </div>
      {abierto && (
        <MenuColumna col={COLS.find((c) => c.k === abierto.k)} pos={abierto} lista={lista} filtro={filtros[abierto.k]}
          onFiltro={(f) => ponerFiltro(abierto.k, f)} onOrden={(asc) => { setOrden({ k: abierto.k === 'segL' ? 'seg' : abierto.k, asc }); setAbierto(null); }}
          onCerrar={() => setAbierto(null)} />
      )}
    </div>
  );
}

// Menú de cada columna, estilo Excel: ordenar y filtrar.
function MenuColumna({ col, pos, lista, filtro, onFiltro, onOrden, onCerrar }) {
  const [busca, setBusca] = useState('');
  const f = filtro || {};
  const campo = { fontFamily: 'inherit', fontSize: 13, height: 32, boxSizing: 'border-box', padding: '0 8px', borderRadius: 6, border: '1px solid rgba(21,33,62,.18)', width: '100%' };
  const fila = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 6, background: 'none', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit', color: T.txt };
  const valores = useMemo(() => {
    if (col.f !== 'lista') return [];
    const n = {};
    lista.forEach((c) => {
      const vs = col.k === 'suc' ? String(c.suc || '').split(', ') : [String(c[col.k] ?? '')];
      vs.forEach((v) => { n[v] = (n[v] || 0) + 1; });
    });
    return Object.entries(n).sort((a, b) => b[1] - a[1]);
  }, [col, lista]);
  const elegidos = f.valores ? new Set(f.valores) : null;
  const alternar = (v) => {
    const set = new Set(elegidos || valores.map(([x]) => x));
    if (set.has(v)) set.delete(v); else set.add(v);
    onFiltro(set.size === valores.length ? null : { valores: [...set] });
  };
  const az = col.f === 'num' || col.f === 'fecha' ? ['Menor a mayor', 'Mayor a menor'] : ['A → Z', 'Z → A'];
  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 1300 }} />
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 1301, width: 260, background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: '0 10px 30px rgba(21,33,62,.18)', padding: 6, fontFamily: "'Archivo', system-ui, sans-serif", color: T.txt }}>
        <button type="button" style={fila} onClick={() => onOrden(true)}>↑ {az[0]}</button>
        <button type="button" style={fila} onClick={() => onOrden(false)}>↓ {az[1]}</button>
        <div style={{ height: 1, background: T.line, margin: '6px 4px' }} />
        <div style={{ padding: '2px 10px 6px', fontSize: 11.5, fontWeight: 700, color: T.txt3, textTransform: 'uppercase', letterSpacing: '.4px' }}>Filtrar {col.l}</div>
        <div style={{ padding: '0 10px 8px' }}>
          {col.f === 'texto' && (
            <input autoFocus type="search" value={f.texto || ''} placeholder="Contiene…" style={campo}
              onChange={(e) => onFiltro(e.target.value ? { texto: e.target.value } : null)} />
          )}
          {col.f === 'num' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" value={f.min ?? ''} placeholder="Desde" style={campo} onChange={(e) => onFiltro({ ...f, min: e.target.value })} />
              <span style={{ color: T.txt3 }}>a</span>
              <input type="number" value={f.max ?? ''} placeholder="Hasta" style={campo} onChange={(e) => onFiltro({ ...f, max: e.target.value })} />
            </div>
          )}
          {col.f === 'fecha' && (
            <div style={{ display: 'grid', gap: 6 }}>
              <input type="date" value={f.desde || ''} style={campo} onChange={(e) => onFiltro({ ...f, desde: e.target.value })} />
              <input type="date" value={f.hasta || ''} style={campo} onChange={(e) => onFiltro({ ...f, hasta: e.target.value })} />
            </div>
          )}
          {col.f === 'lista' && (
            <>
              {valores.length > 8 && <input type="search" value={busca} placeholder="Buscar…" style={{ ...campo, marginBottom: 6 }} onChange={(e) => setBusca(e.target.value)} />}
              <label style={{ ...fila, padding: '4px 2px', fontWeight: 700 }}>
                <input type="checkbox" checked={!elegidos} onChange={() => onFiltro(elegidos ? null : { valores: [] })} />
                (Seleccionar todo)
              </label>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {valores.filter(([v]) => !busca || v.toLowerCase().includes(busca.toLowerCase())).map(([v, n]) => (
                  <label key={v} style={{ ...fila, padding: '4px 2px' }}>
                    <input type="checkbox" checked={!elegidos || elegidos.has(v)} onChange={() => alternar(v)} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || '(vacío)'}</span>
                    <span style={{ color: T.txt3, fontSize: 12 }}>{n.toLocaleString('es-AR')}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        {filtroActivo(filtro) && (
          <button type="button" style={{ ...fila, color: T.rojo }} onClick={() => { onFiltro(null); onCerrar(); }}>✕ Quitar filtro de {col.l}</button>
        )}
      </div>
    </>
  );
}
