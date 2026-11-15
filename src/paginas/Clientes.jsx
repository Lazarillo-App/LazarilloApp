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

const COLS = [
  { k: 'nombre', l: 'Cliente', izq: true },
  { k: 'email', l: 'Email', izq: true },
  { k: 'compras', l: 'Compras' },
  { k: 'total', l: 'Total' },
  { k: 'ticket', l: 'Ticket prom.' },
  { k: 'primera', l: 'Primera' },
  { k: 'ultima', l: 'Última' },
  { k: 'sin', l: 'Días sin venir' },
  { k: 'medio', l: 'Medio' },
  { k: 'suc', l: 'Sucursal' },
  { k: 'seg', l: 'Segmento' },
];

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

  useEffect(() => {
    if (!bid) return undefined;
    let vivo = true;
    setError('');
    MercadoPagoAPI.clientes(bid)
      .then((r) => { if (vivo) setDatos(r); })
      .catch(() => { if (vivo) setError('No pude traer los clientes. Probá de nuevo en un rato.'); });
    return () => { vivo = false; };
  }, [bid]);

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
      && (!q || `${c.nombre || ''} ${c.email || ''}`.toLowerCase().includes(q) || (qn && String(c.doc || '').includes(qn))));
    const k = orden.k;
    const val = (c) => (k === 'nombre' ? (c.nombre || '~').toLowerCase() : k === 'email' ? (c.email || '~') : c[k]);
    return f.sort((a, b) => { const x = val(a), y = val(b); const r = x < y ? -1 : x > y ? 1 : 0; return orden.asc ? r : -r; });
  }, [lista, seg, buscar, orden]);

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

  const pagina = { maxWidth: 1240, margin: '0 auto', padding: '18px 22px 40px', fontFamily: "'Archivo', system-ui, sans-serif", color: T.txt };
  const tarjeta = { background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12 };
  const chip = (on, c) => ({
    fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500, height: 34, padding: '0 12px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
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
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Todavía no hay clientes</div>
          <div style={{ color: T.txt2, fontSize: 14, marginBottom: 14 }}>
            Se arman solos con los cobros de Mercado Pago: cada persona que te paga queda con su email, documento y cuántas veces vino.
            Con Mercado Pago conectado, el historial se trae solo.
          </div>
          <RouterLink to="/movimientos-bancarios?vista=bancos"
            style={{ display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 16px', borderRadius: 8, background: T.celeste, color: '#12111F', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
            Conectá tu banco
          </RouterLink>
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
  const th = { padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#fff', fontWeight: 700, position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-primary, #2492C8)', textAlign: 'center', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
  const td = { padding: '7px 10px', fontSize: 13, borderBottom: `1px solid ${T.line2}`, textAlign: 'center', whiteSpace: 'nowrap' };
  const segInfo = Object.fromEntries(SEGMENTOS.map((s) => [s.k, s]));

  return (
    <div style={pagina}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, margin: 0 }}>Clientes</h1>
          <div style={{ color: T.txt2, fontSize: 13.5, marginTop: 4 }}>
            Los que te pagaron por Mercado Pago, en todas las sucursales · del {dma(datos.desde)} al {dma(datos.hasta)}
          </div>
        </div>
        <button type="button" onClick={exportar}
          style={{ marginLeft: 'auto', fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: T.celeste, color: '#12111F', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Exportar a Excel ({visibles.length.toLocaleString('es-AR')})
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
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
          <input type="search" value={buscar} onChange={(e) => { setBuscar(e.target.value); setMostrar(300); }} placeholder="Buscar nombre, email o documento"
            style={{ fontFamily: 'inherit', fontSize: 13.5, height: 34, boxSizing: 'border-box', padding: '0 10px', borderRadius: 8, border: '1px solid rgba(21,33,62,.16)', flex: '1 1 220px', minWidth: 180, marginLeft: 'auto' }} />
        </div>
        {!conSegmentos && (
          <div style={{ padding: '6px 14px', fontSize: 12.5, color: T.txt3, borderBottom: `1px solid ${T.line2}` }}>
            Los segmentos (frecuentes, en riesgo, nuevos…) aparecen con 60 días de historia.
          </div>
        )}
        <div style={{ maxHeight: 620, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {COLS.filter((c) => c.k !== 'seg' || conSegmentos).map((c) => (
                <th key={c.k} onClick={() => setOrden((o) => ({ k: c.k === 'suc' || c.k === 'seg' ? o.k : c.k, asc: o.k === c.k ? !o.asc : c.izq }))}
                  style={c.izq ? { ...th, textAlign: 'left' } : th}>
                  {c.l}{orden.k === c.k ? (orden.asc ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {visibles.slice(0, mostrar).map((c) => (
                <tr key={c.id}>
                  <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', minWidth: 170, maxWidth: 260, lineHeight: 1.3 }}>
                    {c.nombre ? <span>{c.nombre}</span> : <span style={{ color: T.txt3 }}>sin nombre</span>}
                    {c.docTxt ? <span style={{ display: 'block', color: T.txt3, fontSize: 12 }}>{c.docTxt}</span> : null}
                  </td>
                  <td style={{ ...td, textAlign: 'left', color: c.email ? T.txt : T.txt3, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.email || ''}>{c.email || '—'}</td>
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
      </div>
    </div>
  );
}
