// src/componentes/bancos/DescuentosMP.jsx
// Movimientos bancarios › «Lo que descuenta Mercado Pago» (Diego 15/11/2026).
// Cada tipo de cargo (comisión de MP, cargos de Mercado Libre, envíos, la app de un tercero, el 0,6%,
// IIBB e IGET) con su total del mes, el proveedor al que va y su concepto de caja (se eligen una vez,
// para toda la organización). Encendido, Lazarillo lo carga solo como gasto vario pagado (uno por día,
// cuenta y tipo); cuando llega la factura del proveedor, sus pagos se le aplican. Ver back services/mpCargos.js.
import React, { useEffect, useMemo, useState } from 'react';
import { MercadoPagoAPI } from '@/servicios/apiConciliacion';
import { GestionAPI } from '@/servicios/apiGestion';
import SelectorBuscable from '@/componentes/SelectorBuscable';

const T = {
  txt: '#15213E', txt2: '#5b6577', txt3: '#8a93a3', line: 'rgba(21,33,62,.12)', line2: 'rgba(21,33,62,.07)',
  celeste: '#5BC2EA', celesteDeep: '#2492C8', verde: '#1a9c6e', ambar: '#B7791F', ambarFondo: '#FFF8EC',
};
const pesos = (n) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('es-AR');
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesHoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const mover = (m, n) => { const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
const nombreMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const etiquetaConcepto = (c) => `${c.codigo} · ${c.nombre}`;

function useAncho() {
  const [w, setW] = useState(typeof window === 'undefined' ? 1366 : window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}

export default function DescuentosMP({ bid, avisar }) {
  const [mes, setMes] = useState(mesHoy);
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [provs, setProvs] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [ver, setVer] = useState(0);
  const [guardando, setGuardando] = useState('');
  const celu = useAncho() < 720;

  useEffect(() => {
    let vivo = true;
    MercadoPagoAPI.cargos(bid, mes).then((x) => { if (vivo) { setR(x); setError(''); } })
      .catch((e) => { if (vivo) setError(e?.message || 'No se pudo leer lo que descuenta Mercado Pago.'); });
    return () => { vivo = false; };
  }, [bid, mes, ver]);
  useEffect(() => {
    GestionAPI.maestrosFactura().then((m) => setProvs(m?.proveedores || [])).catch(() => setProvs([]));
    GestionAPI.conceptos().then((c) => setConceptos(c?.conceptos || [])).catch(() => setConceptos([]));
  }, [bid]);

  const opcProv = useMemo(() => provs.map((p) => ({ id: p.codigo, nombre: p.nombre })), [provs]);
  const opcConc = useMemo(() => conceptos.map((c) => ({ id: String(c.codigo), nombre: etiquetaConcepto(c) })), [conceptos]);

  const configurar = async (g, cambio) => {
    setGuardando(g.grupo);
    // Optimista: se ve al instante; si el servidor falla, vuelve.
    const antes = r;
    setR((x) => ({ ...x, grupos: x.grupos.map((y) => (y.grupo !== g.grupo ? y : {
      ...y,
      ...(cambio.proveedor !== undefined ? { proveedor: provs.find((p) => p.codigo === cambio.proveedor) ? { codigo: cambio.proveedor, nombre: provs.find((p) => p.codigo === cambio.proveedor).nombre } : null, proveedorSugerido: false } : {}),
      ...(cambio.concepto !== undefined ? { concepto: conceptos.find((c) => String(c.codigo) === cambio.concepto) ? { codigo: cambio.concepto, nombre: conceptos.find((c) => String(c.codigo) === cambio.concepto).nombre } : null } : {}),
    })) }));
    try {
      const res = await MercadoPagoAPI.cargosConfig(bid, { grupo: g.grupo, ...cambio });
      if (res?.error) throw new Error(res.error);
      avisar?.(`${g.nombre}: guardado`);
    } catch {
      setR(antes);
      avisar?.('No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando('');
    }
  };
  const encender = async (activo) => {
    setGuardando('activo');
    try {
      const res = await MercadoPagoAPI.cargosActivar(bid, { activo, desde: `${mes}-01` });
      avisar?.(res?.activo ? `Encendido: se carga desde el ${ddmm(res.desde)}` : 'Apagado: deja de cargarse (lo ya cargado queda)');
      setVer((n) => n + 1);
    } catch {
      avisar?.('No se pudo cambiar. Probá de nuevo.');
    } finally {
      setGuardando('');
    }
  };

  const tarjeta = { background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12 };
  const flecha = { width: 40, height: 40, borderRadius: 8, border: `1px solid ${T.line}`, background: '#fff', cursor: 'pointer', fontSize: 16, color: T.txt, fontFamily: 'inherit' };

  if (error) return <div style={{ ...tarjeta, padding: 20, color: '#991b1b' }}>{error}</div>;
  if (!r) return <div style={{ padding: 24, color: T.txt3 }}>Cargando lo que descuenta Mercado Pago…</div>;

  const visibles = r.grupos.filter((g) => g.total || g.cargado || g.grupo === 'comision_mp' || g.grupo === 'imp_debcred');
  const total = visibles.reduce((a, g) => a + g.total, 0);
  const faltan = visibles.filter((g) => g.total > 0 && (!g.proveedor || !g.concepto)).length;

  const estado = (g) => {
    if (!r.activo) return { t: 'Solo se muestra', c: T.txt3 };
    if (!g.proveedor || !g.concepto) return { t: 'Falta elegir', c: T.ambar };
    if (g.facturado && g.facturado >= g.cargado - 1) return { t: 'En la factura', c: T.verde };
    if (g.cargado) return { t: `${g.tickets} día${g.tickets === 1 ? '' : 's'} cargado${g.tickets === 1 ? '' : 's'}${g.facturado ? ` · ${pesos(g.facturado)} en factura` : ''}`, c: T.verde };
    return { t: 'Se carga con la próxima actualización', c: T.txt2 };
  };
  const selProv = (g) => (
    <div style={{ minWidth: 0 }}>
      <SelectorBuscable label="Proveedor" placeholder="Elegí el proveedor…" value={g.proveedor?.nombre || null} opciones={opcProv}
        deshabilitado={guardando === g.grupo}
        onChange={(nombre) => { const p = provs.find((x) => x.nombre === nombre); if (p) configurar(g, { proveedor: p.codigo }); }} />
    </div>
  );
  const selConc = (g) => (
    <div style={{ minWidth: 0, borderRadius: 6, ...(g.concepto || !g.total ? {} : { boxShadow: `0 0 0 2px ${T.ambar}` }) }}>
      <SelectorBuscable label="Concepto de caja" placeholder="Elegí el concepto de caja…" value={g.concepto ? etiquetaConcepto(g.concepto) : null} opciones={opcConc}
        deshabilitado={guardando === g.grupo}
        onChange={(nombre) => { const c = conceptos.find((x) => etiquetaConcepto(x) === nombre); if (c) configurar(g, { concepto: String(c.codigo) }); }} />
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...tarjeta, padding: celu ? '14px 14px' : '16px 20px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>Lo que descuenta Mercado Pago</div>
            <div style={{ color: T.txt2, fontSize: 13.5, marginTop: 4, lineHeight: 1.45 }}>
              Cada cargo va al proveedor que lo cobra, con su concepto de caja. Se elige una vez y vale para toda la organización.
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: guardando === 'activo' ? 'wait' : 'pointer', minHeight: 44 }}>
            <input type="checkbox" checked={r.activo} disabled={guardando === 'activo'} onChange={(e) => encender(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: T.celesteDeep, margin: 0 }} />
            <span style={{ lineHeight: 1.3 }}>
              <b style={{ fontSize: 14 }}>Cargarlo solo en el tablero</b><br />
              <span style={{ fontSize: 12.5, color: T.txt2 }}>
                {r.activo ? `Encendido desde el ${ddmm(r.desde)}: un gasto pagado por día, cuenta y tipo` : 'Apagado: hoy solo se muestra, no se carga nada'}
              </span>
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 6px' }}>
          <button type="button" aria-label="Mes anterior" onClick={() => setMes((m) => mover(m, -1))} style={flecha}>‹</button>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>{nombreMes(mes)}</div>
          <button type="button" aria-label="Mes siguiente" onClick={() => setMes((m) => mover(m, 1))} disabled={mes >= mesHoy()} style={{ ...flecha, opacity: mes >= mesHoy() ? 0.4 : 1 }}>›</button>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: T.txt3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>Total del mes</div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, whiteSpace: 'nowrap' }}>{pesos(total)}</div>
          </div>
        </div>

        {faltan > 0 && (
          <div style={{ border: `1px solid ${T.ambar}`, background: T.ambarFondo, borderRadius: 10, padding: '9px 12px', fontSize: 13.5, margin: '8px 0' }}>
            Falta elegir proveedor o concepto en {faltan === 1 ? 'un tipo de cargo' : `${faltan} tipos de cargo`}. {r.activo ? 'Hasta entonces ese tipo no se carga.' : ''}
          </div>
        )}

        {celu ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {visibles.map((g) => {
              const e = estado(g);
              return (
                <div key={g.grupo} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0 }}>{g.nombre}</div>
                    <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, whiteSpace: 'nowrap' }}>{pesos(g.total)}</div>
                  </div>
                  {selProv(g)}
                  {selConc(g)}
                  <div style={{ fontSize: 12.5, color: e.c }}>{e.t}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '28%' }} /><col style={{ width: '11%' }} /><col style={{ width: '13%' }} /></colgroup>
            <thead>
              <tr style={{ fontSize: 11, color: T.txt3, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Qué descuenta</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Proveedor</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Concepto de caja</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', textTransform: 'capitalize' }}>{MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3)} {mes.slice(0, 4)}</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((g) => {
                const e = estado(g);
                return (
                  <tr key={g.grupo} style={{ borderTop: `1px solid ${T.line2}` }}>
                    <td style={{ padding: '10px 8px', fontSize: 14, verticalAlign: 'top' }}>
                      {g.nombre}
                      <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>{g.facturable ? 'Pago a la factura del mes' : 'Retención: no hay factura'}</div>
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>{selProv(g)}</td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>{selConc(g)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: "'Sora', sans-serif", fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{pesos(g.total)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12.5, color: e.c, verticalAlign: 'top' }}>{e.t}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ fontSize: 12.5, color: T.txt3, marginTop: 12, lineHeight: 1.5 }}>
          No es costo tuyo y no se carga: {pesos(r.noEsCosto)} que pagó el comprador (procesamiento, recargo por cuotas) o puso Mercado Libre (cupones).
          {r.diasNegativos ? ` · ${r.diasNegativos} día${r.diasNegativos === 1 ? '' : 's'} con más devoluciones que cargos (no se cargan).` : ''}
        </div>
      </div>

      <div style={{ ...tarjeta, padding: celu ? '12px 14px' : '14px 20px', fontSize: 13.5, color: T.txt2, lineHeight: 1.55 }}>
        <b style={{ color: T.txt }}>Cómo entra al tablero.</b> Cada día, por cuenta y tipo, un gasto vario del proveedor ya pagado con su forma de pago:
        suma en el Económico por su fecha y en el Financiero por su pago. Cuando llega la factura del proveedor (la de comisiones del mes),
        los pagos anteriores a su fecha se le aplican y el gasto vario se saca: el gasto queda en la factura y cada pago en su día. Nunca se cuenta dos veces.
      </div>
    </div>
  );
}
