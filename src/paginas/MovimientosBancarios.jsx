// src/paginas/MovimientosBancarios.jsx
// Administración › Movimientos bancarios (Diego 14/11/2026: «quiero ver todo lo que trae Mercado
// Pago para empezar a entender cómo lo voy a aplicar»). Solo lectura: muestra lo que ya está
// guardado de la cuenta de Mercado Pago de la sucursal — los cobros (fuente "banco" de la
// conciliación) y lo que salió (fuente "egresos") — con totales, comisiones y filtros.
// Los movimientos se traen desde Conciliación («Traer»); acá no se pide nada a Mercado Pago.
// Va por SUCURSAL, como la conciliación: cada sucursal cobra en su propia cuenta.
import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { ConciliacionAPI, MercadoPagoAPI, sucursalNum } from '@/servicios/apiConciliacion';

const T = {
  txt: '#15213E', txt2: '#5b6577', txt3: '#8a93a3', line: 'rgba(21,33,62,.12)', line2: 'rgba(21,33,62,.07)',
  celeste: '#5BC2EA', celesteDeep: '#2492C8', verde: '#1a9c6e', rojo: '#c2410c', fondo: '#F7F9FB',
};
const pesos = (n) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('es-AR');
};
const dma = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '—');
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Un renglón para las dos fuentes: entrada (cobro) o salida (egreso).
function normalizar(banco = [], egresos = []) {
  const ent = banco.map((b) => {
    const bruto = Number(b.imp) || 0;
    const neto = b.neto != null && b.neto !== '' ? Number(b.neto) : null;
    return {
      id: String(b.id), lado: 'entrada', fecha: String(b.fecha || '').slice(0, 10), hora: b.hora || '',
      tipo: 'Cobro', medio: b.tipoMedio || b.medio || '—', quien: b.cliente || '', detalle: b.descripcion || '',
      bruto, comision: neto != null ? Math.max(0, bruto - neto) : 0, neto: neto != null ? neto : bruto,
    };
  });
  const sal = egresos.map((e) => {
    const imp = Math.abs(Number(e.imp) || 0);
    return {
      id: String(e.id), lado: 'salida', fecha: String(e.fecha || '').slice(0, 10), hora: e.hora || '',
      tipo: e.tipo || 'Egreso', medio: e.medio || '—', quien: '', detalle: e.detalle || '',
      bruto: imp, comision: 0, neto: -imp,
    };
  });
  return [...ent, ...sal].sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
}

const PERIODOS = [
  { k: 'todo', l: 'Todo lo traído' },
  { k: 'mes', l: 'Este mes' },
  { k: 'ant', l: 'Mes anterior' },
  { k: 'fechas', l: 'Elegir fechas' },
];
const LADOS = [{ k: 'todos', l: 'Todos' }, { k: 'entrada', l: 'Entradas' }, { k: 'salida', l: 'Salidas' }];

export default function MovimientosBancarios() {
  const { activeBusinessId } = useBusiness() || {};
  const { branches = [], activeBranchId, setActiveBranch } = useBranch() || {};
  const bid = Number(activeBusinessId) || null;
  const reales = branches.filter((b) => b.id !== 'main');
  const suc = activeBranchId == null ? (reales.length ? null : 0) : sucursalNum(activeBranchId);
  const sucNombre = suc === null ? '' : (branches.find((b) => sucursalNum(b.id) === suc)?.name || '');

  const [datos, setDatos] = useState(null);   // { filas, origen }
  const [mp, setMp] = useState(null);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [lado, setLado] = useState('todos');
  const [medio, setMedio] = useState('');
  const [buscar, setBuscar] = useState('');

  useEffect(() => {
    if (!bid || suc === null) return;
    let vivo = true;
    setError('');
    ConciliacionAPI.cargar(bid, suc)
      .then((r) => {
        if (!vivo) return;
        const f = r?.fuentes || {};
        setDatos({ filas: normalizar(f.banco?.filas || [], f.egresos?.filas || []), origen: f.banco?.origen || '' });
      })
      .catch(() => { if (vivo) setError('No pude cargar los movimientos. Probá de nuevo en un rato.'); });
    MercadoPagoAPI.estado(bid, suc).then((r) => { if (vivo) setMp(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [bid, suc]);

  const rango = useMemo(() => {
    const hoy = new Date();
    if (periodo === 'mes') return [isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), isoLocal(hoy)];
    if (periodo === 'ant') return [isoLocal(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 0))];
    if (periodo === 'fechas') return [desde || '0000', hasta || '9999'];
    return ['0000', '9999'];
  }, [periodo, desde, hasta]);

  const delPeriodo = useMemo(
    () => (datos?.filas || []).filter((f) => f.fecha >= rango[0] && f.fecha <= rango[1]),
    [datos, rango],
  );
  const medios = useMemo(() => [...new Set(delPeriodo.map((f) => f.medio))].sort(), [delPeriodo]);
  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return delPeriodo.filter((f) => (lado === 'todos' || f.lado === lado)
      && (!medio || f.medio === medio)
      && (!q || `${f.quien} ${f.detalle} ${f.tipo}`.toLowerCase().includes(q) || String(Math.round(f.bruto)).includes(q.replace(/\D/g, '') || '§')));
  }, [delPeriodo, lado, medio, buscar]);

  const tot = useMemo(() => {
    const ent = delPeriodo.filter((f) => f.lado === 'entrada');
    const sal = delPeriodo.filter((f) => f.lado === 'salida');
    const s = (a, k) => a.reduce((x, f) => x + f[k], 0);
    const porMedio = {};
    ent.forEach((f) => { const m = porMedio[f.medio] || (porMedio[f.medio] = { n: 0, bruto: 0, comision: 0 }); m.n++; m.bruto += f.bruto; m.comision += f.comision; });
    const porTipo = {};
    sal.forEach((f) => { const m = porTipo[f.tipo] || (porTipo[f.tipo] = { n: 0, total: 0 }); m.n++; m.total += f.bruto; });
    return {
      nEnt: ent.length, nSal: sal.length, entro: s(ent, 'bruto'), comision: s(ent, 'comision'), netoEnt: s(ent, 'neto'), salio: s(sal, 'bruto'),
      porMedio: Object.entries(porMedio).sort((a, b) => b[1].bruto - a[1].bruto),
      porTipo: Object.entries(porTipo).sort((a, b) => b[1].total - a[1].total),
      desde: delPeriodo.length ? delPeriodo[delPeriodo.length - 1].fecha : null, hasta: delPeriodo.length ? delPeriodo[0].fecha : null,
    };
  }, [delPeriodo]);

  const pagina = { maxWidth: 1180, margin: '0 auto', padding: '18px 22px 40px', fontFamily: "'Archivo', system-ui, sans-serif", color: T.txt };
  const chip = (on) => ({
    fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500, height: 34, padding: '0 12px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${on ? T.celeste : 'rgba(21,33,62,.16)'}`, background: on ? '#5BC2EA1F' : '#fff', color: on ? '#12627F' : T.txt,
  });
  const campo = { fontFamily: 'inherit', fontSize: 13.5, height: 34, boxSizing: 'border-box', padding: '0 10px', borderRadius: 8, border: '1px solid rgba(21,33,62,.16)', background: '#fff', color: T.txt };
  const tarjeta = { background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12 };

  if (!bid) return <div style={{ padding: 32 }}>Elegí un negocio.</div>;
  if (suc === null) {
    return (
      <div style={{ ...pagina, maxWidth: 640, paddingTop: 48 }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, margin: '0 0 6px' }}>¿De qué sucursal querés ver los movimientos?</h2>
        <p style={{ color: T.txt2, margin: '0 0 18px', fontSize: 14 }}>Cada sucursal cobra en su propia cuenta de Mercado Pago.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {branches.map((b) => (
            <button key={b.id} type="button" onClick={() => setActiveBranch(b.id)}
              style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(21,33,62,.16)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: T.txt }}>
              {b.name}{b.id === 'main' ? <span style={{ color: T.txt3, fontWeight: 400 }}> · principal</span> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (error) return <div style={{ padding: 32, color: '#991b1b' }}>{error}</div>;
  if (!datos) return <div style={{ padding: 32, color: '#64748b' }}>Cargando los movimientos…</div>;

  const encabezado = (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, margin: 0 }}>Movimientos bancarios</h1>
        <div style={{ color: T.txt2, fontSize: 13.5, marginTop: 4 }}>
          🏦 Mercado Pago{mp?.cuenta?.nickname ? ` · ${mp.cuenta.nickname}` : ''}{sucNombre && reales.length ? ` · ${sucNombre}` : ''}
          {reales.length > 0 && (
            <button type="button" onClick={() => setActiveBranch(null)}
              style={{ border: 'none', background: 'none', color: T.celesteDeep, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: '0 0 0 8px', textDecoration: 'underline' }}>
              Cambiar de sucursal
            </button>
          )}
        </div>
      </div>
      <RouterLink to="/conciliacion" style={{ marginLeft: 'auto', fontSize: 13, color: T.celesteDeep, fontWeight: 600 }}>Traer más desde Conciliación →</RouterLink>
    </div>
  );

  // Sin nada guardado todavía: el primer paso, con lo que ya existe.
  if (!datos.filas.length) {
    return (
      <div style={pagina}>
        {encabezado}
        <div style={{ ...tarjeta, padding: '22px 24px', maxWidth: 560 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {mp?.conectado ? 'Todavía no se trajo ningún movimiento' : 'Conectá Mercado Pago'}
          </div>
          <div style={{ color: T.txt2, fontSize: 14, marginBottom: 14 }}>
            {mp?.conectado
              ? `La cuenta ${mp.cuenta?.nickname || ''} está conectada. Traé los cobros desde Conciliación y aparecen acá.`
              : 'Con la cuenta conectada, los cobros y lo que sale de Mercado Pago aparecen acá solos.'}
          </div>
          <RouterLink to={mp?.conectado ? '/conciliacion' : '/configuracion?tab=7'}
            style={{ display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 16px', borderRadius: 8, background: T.celeste, color: '#12111F', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
            {mp?.conectado ? 'Ir a Conciliación' : 'Ir a Conexiones'}
          </RouterLink>
        </div>
      </div>
    );
  }

  const kpis = [
    { l: 'Entró', v: tot.entro, s: `${tot.nEnt.toLocaleString('es-AR')} cobros`, c: T.verde },
    { l: 'Comisiones Mercado Pago', v: -tot.comision, s: tot.entro ? `${((tot.comision / tot.entro) * 100).toFixed(2).replace('.', ',')}% de lo cobrado` : '—', c: T.rojo },
    { l: 'Salió', v: -tot.salio, s: `${tot.nSal.toLocaleString('es-AR')} movimientos`, c: T.rojo },
    { l: 'Neto del período', v: tot.netoEnt - tot.salio, s: 'entró − comisiones − salió', c: T.txt },
  ];
  // encabezado con el color de la app (las tablas toman el color del negocio): texto blanco
  const th = { padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#fff', fontWeight: 700, position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-primary, #2492C8)', textAlign: 'center', whiteSpace: 'nowrap' };
  const td = { padding: '7px 10px', fontSize: 13, borderBottom: `1px solid ${T.line2}`, textAlign: 'center', whiteSpace: 'nowrap' };
  const num = { ...td, fontFamily: "'Sora', sans-serif", fontWeight: 600 };

  return (
    <div style={pagina}>
      {encabezado}

      {/* Período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {PERIODOS.map((p) => <button key={p.k} type="button" onClick={() => setPeriodo(p.k)} style={chip(periodo === p.k)}>{p.l}</button>)}
        {periodo === 'fechas' && (
          <>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={campo} />
            <span>a</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={campo} />
          </>
        )}
      </div>
      <div style={{ color: T.txt3, fontSize: 12.5, marginBottom: 14 }}>
        {tot.desde ? `Mostrando del ${dma(tot.desde)} al ${dma(tot.hasta)}. ` : 'No hay movimientos en ese período. '}
        Lo que se ve acá es lo que ya se trajo de Mercado Pago (desde Conciliación).
      </div>

      {/* Totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginBottom: 12 }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ ...tarjeta, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: T.txt3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{k.l}</div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 22, color: k.c, marginTop: 4, whiteSpace: 'nowrap' }}>{pesos(k.v)}</div>
            <div style={{ fontSize: 12.5, color: T.txt2, marginTop: 2 }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* Desglose: por medio (entradas) y por tipo (salidas) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ ...tarjeta, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: T.txt3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>Entradas por medio</div>
          {tot.porMedio.length ? tot.porMedio.map(([m, v]) => (
            <button key={m} type="button" onClick={() => { setLado('entrada'); setMedio(medio === m ? '' : m); }}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '5px 6px', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: T.txt, background: medio === m ? '#5BC2EA1F' : 'transparent' }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{m} <span style={{ color: T.txt3 }}>· {v.n}</span></span>
              <span style={{ color: T.txt3, fontSize: 12 }}>comisión {pesos(v.comision)}</span>
              <b style={{ fontFamily: "'Sora', sans-serif", minWidth: 110, textAlign: 'right' }}>{pesos(v.bruto)}</b>
            </button>
          )) : <div style={{ fontSize: 13, color: T.txt3 }}>Sin cobros en el período</div>}
        </div>
        <div style={{ ...tarjeta, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: T.txt3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>Salidas por tipo</div>
          {tot.porTipo.length ? tot.porTipo.map(([t, v]) => (
            <button key={t} type="button" onClick={() => { setLado('salida'); setMedio(''); setBuscar(t); }}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '5px 6px', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: T.txt, background: 'transparent' }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{t} <span style={{ color: T.txt3 }}>· {v.n}</span></span>
              <b style={{ fontFamily: "'Sora', sans-serif", minWidth: 110, textAlign: 'right' }}>{pesos(v.total)}</b>
            </button>
          )) : <div style={{ fontSize: 13, color: T.txt3 }}>Sin salidas en el período. Retiros, impuestos y comisiones llegan con el reporte de Mercado Pago.</div>}
        </div>
      </div>

      {/* Lista */}
      <div style={{ ...tarjeta, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 12px', borderBottom: `1px solid ${T.line}` }}>
          {LADOS.map((x) => <button key={x.k} type="button" onClick={() => setLado(x.k)} style={chip(lado === x.k)}>{x.l}</button>)}
          <select value={medio} onChange={(e) => setMedio(e.target.value)} style={{ ...campo, minWidth: 170 }}>
            <option value="">Todos los medios</option>
            {medios.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar pagador, detalle o importe"
            style={{ ...campo, flex: '1 1 220px', minWidth: 180 }} />
          <span style={{ color: T.txt2, fontSize: 13, whiteSpace: 'nowrap' }}>{visibles.length.toLocaleString('es-AR')} movimientos</span>
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Fecha</th><th style={th}>Hora</th><th style={th}>Tipo</th>
              <th style={{ ...th, textAlign: 'left' }}>Pagador / detalle</th><th style={th}>Medio</th>
              <th style={th}>Importe</th><th style={th}>Comisión</th><th style={th}>Neto</th>
            </tr></thead>
            <tbody>
              {visibles.slice(0, 1500).map((f) => (
                <tr key={f.id}>
                  <td style={td}>{dma(f.fecha)}</td>
                  <td style={{ ...td, color: T.txt3 }}>{f.hora || '—'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: f.lado === 'entrada' ? '#1a9c6e1a' : '#c2410c14', color: f.lado === 'entrada' ? T.verde : T.rojo }}>{f.tipo}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', maxWidth: 380 }}>
                    {f.quien ? <span>{f.quien}</span> : (f.lado === 'entrada' ? <span style={{ color: T.txt3 }}>sin nombre</span> : null)}
                    {f.detalle && f.detalle !== 'Varios' ? <span style={{ color: T.txt3 }}>{f.quien || f.lado === 'entrada' ? ' · ' : ''}{f.detalle}</span> : null}
                  </td>
                  <td style={{ ...td, color: T.txt2 }}>{f.medio}</td>
                  <td style={num}>{pesos(f.bruto)}</td>
                  <td style={{ ...num, color: f.comision ? T.rojo : T.txt3, fontWeight: 500 }}>{f.comision ? pesos(-f.comision) : '—'}</td>
                  <td style={{ ...num, color: f.neto >= 0 ? T.verde : T.rojo, fontWeight: 700 }}>{pesos(f.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibles.length > 1500 && (
            <div style={{ padding: 10, fontSize: 12.5, color: T.txt3, textAlign: 'center' }}>Se muestran los 1.500 más nuevos: achicá el período o filtrá para ver el resto.</div>
          )}
          {!visibles.length && <div style={{ padding: 16, fontSize: 13, color: T.txt3, textAlign: 'center' }}>Nada coincide con los filtros.</div>}
        </div>
      </div>
    </div>
  );
}
