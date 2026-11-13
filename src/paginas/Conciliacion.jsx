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
import { Link as RouterLink } from 'react-router-dom';
import ModuloConciliacion from '@/componentes/conciliacion/ModuloConciliacion';
import { showConfirm } from '@/servicios/appConfirm';
import { fuentesDesdeMaxi } from '@/componentes/conciliacion/desdeMaxi';

const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : ''); // 2026-11-01 → 01/11

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

  if (!bid) return <div style={{ padding: 32 }}>Elegí un negocio para conciliar.</div>;

  // "Todas" no se concilia junto: cada sucursal tiene su cuenta de Mercado Pago.
  if (suc === null) {
    return (
      <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 16px', fontFamily: "'Archivo', system-ui, sans-serif", color: '#15213E' }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, margin: '0 0 6px' }}>¿Qué sucursal querés conciliar?</h2>
        <p style={{ color: '#5b6577', margin: '0 0 18px', fontSize: 14 }}>
          Cada sucursal se concilia por separado, porque cada una cobra en su propia cuenta de Mercado Pago.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
      {reales.length > 0 && (
        <div style={{ maxWidth: 1180, margin: '16px auto 0', padding: '0 22px', fontSize: 14, color: '#15213E', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Conciliando: <b>{sucNombre || 'Sucursal'}</b></span>
          <button type="button" onClick={() => setActiveBranch(null)}
            style={{ border: 'none', background: 'none', color: '#2492C8', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, padding: 0, textDecoration: 'underline' }}>
            Cambiar de sucursal
          </button>
        </div>
      )}
      <BarraTraer bid={bid} suc={suc} sucNombre={reales.length ? sucNombre : ''} mp={mp} maxi={maxi}
        guardadas={inicial.fuentes} onTraido={() => setVer((n) => n + 1)} avisar={avisar} />
      {inicial.fuentes.banco?.length > 0 && (
        <div style={{ maxWidth: 1180, margin: '6px auto 0', padding: '0 22px', display: 'flex', gap: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setVerBanco((v) => !v)}
            style={{ border: 'none', background: 'none', color: '#2492C8', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0, textDecoration: 'underline', fontWeight: 600 }}>
            {verBanco ? 'Ocultar movimientos del banco' : `Ver movimientos del banco (${inicial.fuentes.banco.length})`}
          </button>
          <button type="button" onClick={borrarBanco}
            title="Saca todos los movimientos del banco cargados en esta sucursal (por archivo o traídos de Mercado Pago)"
            style={{ border: 'none', background: 'none', color: '#8a93a3', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0, textDecoration: 'underline' }}>
            Borrar los movimientos del banco cargados ({inicial.fuentes.banco.length})
          </button>
        </div>
      )}
      {verBanco && inicial.fuentes.banco?.length > 0 && <ListaBanco filas={inicial.fuentes.banco} />}
      {/* key: al cambiar de negocio o sucursal (o al traer cobros nuevos) se arma de cero */}
      <ModuloConciliacion key={`${bid}:${suc}:${ver}`} business={business} embedded persist={persist}
        pagadorMap={inicial.pagadores} onPagadorMap={onPagadorMap} />
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
    <div style={{ maxWidth: 1180, margin: '8px auto 0', padding: '0 22px' }}>
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

// Barra de arriba del módulo (13/11): con un solo botón trae lo del período sin subir archivos.
//  - MaxiRest: ventas detalladas (22) y cobranzas de cuenta corriente, de lo que el kit sube a
//    Render todos los días (llegan hasta el día anterior). Reemplaza lo guardado de esas fechas.
//  - Mercado Pago: los cobros de la cuenta conectada de la sucursal, como movimientos del banco.
// Lo que no esté disponible se sigue pudiendo subir con el archivo, como antes.
const hoyISO = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => hoyISO().slice(0, 8) + '01';
const ERROR_MP = { periodo_muy_largo: 'Elegí hasta 3 meses por vez.', mp_vencido: 'Venció la conexión con Mercado Pago: volvé a conectarla en Conexiones.' };
function BarraTraer({ bid, suc, sucNombre, mp, maxi, guardadas, onTraido, avisar }) {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoyISO);
  const [trayendo, setTrayendo] = useState(false);
  if (!mp && !maxi) return null;
  const conMaxi = !!maxi?.disponible;
  const conMp = !!mp?.conectado;
  const caja = { maxWidth: 1180, margin: '12px auto 0', padding: '10px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13.5 };
  const codigo = (e) => String(e?.message || '').split(':')[0].trim();

  const traer = async () => {
    if (!desde || !hasta || desde > hasta) { avisar('Revisá las fechas', 3000); return; }
    setTrayendo(true);
    const partes = [];
    const errores = [];
    if (conMaxi) {
      try {
        const r = await ConciliacionAPI.maxiTraer(bid, suc, desde, hasta);
        const f = fuentesDesdeMaxi(r, guardadas, desde, hasta);
        await ConciliacionAPI.guardarFuente(bid, suc, 'ventas', f.ventas, `MaxiRest ${r.pdv} ${desde} a ${hasta}`);
        await ConciliacionAPI.guardarFuente(bid, suc, 'pagos', f.pagos, `MaxiRest ${r.pdv} ${desde} a ${hasta}`);
        await ConciliacionAPI.guardarFuente(bid, suc, 'facturas_cc', f.facturas_cc, `MaxiRest ${r.pdv} ${desde} a ${hasta}`);
        partes.push(`${f.cuantas.ventas} venta${f.cuantas.ventas === 1 ? '' : 's'} y ${f.cuantas.pagos} cobranza${f.cuantas.pagos === 1 ? '' : 's'} de MaxiRest`);
      } catch (e) {
        errores.push(codigo(e) === 'periodo_muy_largo' ? 'Elegí hasta 3 meses por vez.' : 'MaxiRest: no pude traer las ventas.');
      }
    }
    if (conMp) {
      try {
        const r = await MercadoPagoAPI.sincronizar(bid, suc, desde, hasta);
        partes.push(`${r.cobros} cobro${r.cobros === 1 ? '' : 's'} de Mercado Pago`);
      } catch (e) {
        errores.push(ERROR_MP[codigo(e)] || 'Mercado Pago no respondió. Probá de nuevo en un rato.');
      }
    }
    setTrayendo(false);
    if (partes.length) onTraido();
    avisar([partes.length ? `Listo: ${partes.join(' · ')}` : '', ...errores].filter(Boolean).join(' — '), errores.length ? 9000 : 5000);
  };

  const inp = { fontFamily: 'inherit', fontSize: 13.5, padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(21,33,62,.16)' };
  const fuente = { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#5b6577' };
  return (
    <div style={{ ...caja, background: '#fff', border: '1px solid rgba(21,33,62,.16)', color: '#15213E' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={fuente}>
          <b style={{ color: '#15213E' }}>🧾 MaxiRest</b>
          {conMaxi
            ? <span>ventas y cuenta corriente{maxi.datos_hasta ? ` · datos hasta el ${dm(maxi.datos_hasta)}` : ''}</span>
            : <span>{maxi ? 'esta sucursal no tiene el kit: subí los informes con el archivo' : '…'}</span>}
        </span>
        <span style={fuente}>
          <b style={{ color: '#15213E' }}>🏦 Mercado Pago</b>
          {conMp
            ? <span>{mp.cuenta?.nickname || mp.cuenta?.email || 'conectado'}{mp.ultimo_sync_hasta ? ` · últimos traídos: del ${dm(String(mp.ultimo_sync_desde))} al ${dm(String(mp.ultimo_sync_hasta))}` : ''}</span>
            : mp?.configurado
              ? <span>sin conectar{sucNombre ? ` en ${sucNombre}` : ''} · <RouterLink to="/configuracion?tab=7" style={{ fontWeight: 700 }}>Conectar</RouterLink></span>
              : <span>{mp ? 'no disponible todavía' : '…'}</span>}
        </span>
      </div>
      {(conMaxi || conMp) && (
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inp} />
          <span>a</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inp} />
          <button type="button" onClick={traer} disabled={trayendo}
            title="Trae lo de esas fechas y reemplaza lo que había cargado de esos días"
            style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#5BC2EA', color: '#12111F', cursor: trayendo ? 'wait' : 'pointer' }}>
            {trayendo ? 'Trayendo…' : 'Traer'}
          </button>
        </span>
      )}
    </div>
  );
}
