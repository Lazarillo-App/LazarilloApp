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
const etiquetaRubro = (x) => `${x.codigo} · ${x.nombre}`;

function useAncho() {
  const [w, setW] = useState(typeof window === 'undefined' ? 1366 : window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}

export default function DescuentosMP({ bid, avisar }) {
  // ?mes=AAAA-MM: llega desde «Desde el banco» del tablero con el mes clickeado.
  const [mes, setMes] = useState(() => {
    const m = new URLSearchParams(window.location.search).get('mes') || '';
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m <= mesHoy() ? m : mesHoy();
  });
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [provs, setProvs] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [rubroNuevo, setRubroNuevo] = useState('');
  const [abierto, setAbierto] = useState(null);   // tipo de cargo con el detalle abierto
  const [det, setDet] = useState(null);            // { grupo, filas, total } | { grupo, cargando }
  // Concepto nuevo de un renglón (Diego 19/11: «solo me tiene que dar a elegir el rubro, o a lo sumo un padrino»).
  const [nuevo, setNuevo] = useState(null);        // { grupo, nombre, rubro, padrino }
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
    GestionAPI.conceptos().then((c) => { setConceptos(c?.conceptos || []); setRubros(c?.rubros || []); }).catch(() => setConceptos([]));
  }, [bid]);

  const opcProv = useMemo(() => provs.map((p) => ({ id: p.codigo, nombre: p.nombre })), [provs]);
  const opcConc = useMemo(() => conceptos.map((c) => ({ id: String(c.codigo), nombre: etiquetaConcepto(c) })), [conceptos]);
  // Sugeridos de cada tipo (Diego 20/11/2026: «¿por qué no me sugiere conceptos relacionados a este proveedor?»):
  // primero los que comparten palabras con la leyenda (ej. «Retención IIBB CABA» → «Ret.iibb Caba»), después los
  // que ya se usaron en compras de su proveedor (los más usados primero). Hasta 6.
  const sugeridosObj = (g) => {
    // «Buenos Aires» es «Provincia» en los conceptos (y no «Mantenimiento Aires»); «Ib» es IIBB.
    const pal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/buenos aires|bs\.? ?as\.?/g, 'provincia').replace(/\bib\b/g, 'iibb').split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !['con', 'por', 'del', 'los', 'las', 'que', 'cobro', 'pago'].includes(w));
    const deLeyenda = pal(g.nombre);
    const parecido = (c) => pal(c.nombre).filter((w) => deLeyenda.some((x) => x === w || (w.length >= 3 && x.startsWith(w)) || (x.length >= 3 && w.startsWith(x)))).length;
    const usados = (r?.sugeridos?.[g.proveedor?.codigo] || []).map(String);
    const puntaje = (c) => parecido(c) * 10 + (usados.includes(String(c.codigo)) ? 5 + (8 - usados.indexOf(String(c.codigo))) / 10 : 0);
    return conceptos.map((c) => ({ c, p: puntaje(c) })).filter((x) => x.p >= 5 || parecido(x.c) >= 2)
      .sort((a, b) => b.p - a.p).slice(0, 6).map((x) => x.c);
  };
  const sugeridosDe = (g) => sugeridosObj(g).map(etiquetaConcepto);

  const configurar = async (g, cambio) => {
    setGuardando(g.grupo);
    // Optimista: se ve al instante; si el servidor falla, vuelve.
    const antes = r;
    setR((x) => ({ ...x, grupos: x.grupos.map((y) => (y.grupo !== g.grupo ? y : {
      ...y,
      ...(cambio.proveedor !== undefined ? { proveedor: provs.find((p) => p.codigo === cambio.proveedor) ? { codigo: cambio.proveedor, nombre: provs.find((p) => p.codigo === cambio.proveedor).nombre } : null, proveedorSugerido: false, proveedorHeredado: false } : {}),
      ...(cambio.concepto !== undefined ? { concepto: conceptos.find((c) => String(c.codigo) === cambio.concepto) ? { codigo: cambio.concepto, nombre: conceptos.find((c) => String(c.codigo) === cambio.concepto).nombre } : null, conceptoHeredado: false } : {}),
    })) }));
    try {
      const res = await MercadoPagoAPI.cargosConfig(bid, { grupo: g.grupo, ...cambio });
      if (res?.error) throw new Error(res.error);
      avisar?.(`${g.nombre}: ${cambio.proveedor === '' || cambio.concepto === '' ? 'quitado' : 'guardado'}`);
    } catch {
      setR(antes);
      avisar?.('No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando('');
    }
  };
  // Crear conceptos con la leyenda del cargo (uno o todos los que faltan), con el rubro elegido arriba.
  const rubroPorDefecto = () => rubroNuevo || r?.grupos.find((g) => g.concepto?.rubro)?.concepto.rubro || '';
  const abrirNuevo = (g, nombre) => {
    // Padrino ya puesto (Diego 20/11/2026: los sugeridos son «más que nada para usarlos como padrino»): el concepto
    // del tipo si tiene, si no el primer sugerido; su rubro queda elegido. Se cambia con un toque en los chips.
    const sug = sugeridosObj(g)[0];
    const padrino = g.concepto ? String(g.concepto.codigo) : sug ? String(sug.codigo) : '';
    const rubro = g.concepto?.rubro || (sug?.codRubro != null ? String(sug.codRubro) : rubroPorDefecto());
    setNuevo({ grupo: g.grupo, nombre: nombre || g.nombre, padrino, rubro });
  };
  const crearConceptos = async (grupos, nombres = {}, rubroElegido = null) => {
    const codRubro = rubroElegido || rubroPorDefecto();
    if (!codRubro) { avisar?.('Elegí arriba el rubro para los conceptos nuevos.'); return; }
    setGuardando('crear');
    try {
      const res = await MercadoPagoAPI.cargosCrearConceptos(bid, { grupos, codRubro, nombres });
      if (res?.error) throw new Error(res.detalle || res.error);
      const n = res.creados;
      avisar?.(n ? `${n} concepto${n === 1 ? '' : 's'} de caja nuevo${n === 1 ? '' : 's'}` : 'Concepto elegido');
      GestionAPI.conceptos().then((c) => setConceptos(c?.conceptos || [])).catch(() => {});
      setVer((x) => x + 1);
      setNuevo(null);
    } catch (e) {
      avisar?.(`No se pudo crear: ${e.message || 'probá de nuevo'}`);
    } finally {
      setGuardando('');
    }
  };
  const crearProveedor = async (g, nombre) => {
    const n = String(nombre || '').trim();
    if (!n) { avisar?.('Escribí el nombre del proveedor en el buscador y tocá Crear.'); return; }
    setGuardando(g.grupo);
    try {
      const res = await MercadoPagoAPI.cargosCrearProveedor(bid, { grupo: g.grupo, nombre: n });
      if (res?.error) throw new Error(res.detalle || res.error);
      avisar?.(`Proveedor nuevo: ${res.proveedor.nombre}`);
      GestionAPI.maestrosFactura().then((m) => setProvs(m?.proveedores || [])).catch(() => {});
      setVer((x) => x + 1);
    } catch (e) {
      avisar?.(`No se pudo crear: ${e.message || 'probá de nuevo'}`);
    } finally {
      setGuardando('');
    }
  };
  // Detalle de un tipo: cobro por cobro (Diego 19/11: «¿cómo puedo ver qué son esos $1.976?»).
  const verDetalle = (g) => {
    if (abierto === g.grupo) { setAbierto(null); return; }
    setAbierto(g.grupo); setDet({ grupo: g.grupo, cargando: true });
    MercadoPagoAPI.cargosDetalle(bid, mes, g.grupo).then((x) => setDet(x?.error ? { grupo: g.grupo, error: true } : x)).catch(() => setDet({ grupo: g.grupo, error: true }));
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

  const visibles = r.grupos.filter((g) => g.total || g.cargado);
  const sinConcepto = visibles.filter((g) => g.total > 0 && !g.concepto);
  const total = visibles.reduce((a, g) => a + g.total, 0);
  const faltan = visibles.filter((g) => g.total > 0 && (!g.proveedor || !g.concepto)).length;

  const estado = (g) => {
    // Antes del día en que arranca la carga sola (o apagada): solo se muestra.
    if (!r.activo || (r.desde && `${mes}-31` < r.desde)) return { t: 'Solo se muestra', c: T.txt3 };
    if (!g.proveedor) return { t: 'Falta elegir proveedor', c: T.ambar };
    // Sin concepto se carga igual (Diego 20/11/2026): queda en «Sin concepto de caja asociado» hasta que se elige.
    if (!g.concepto) return { t: g.cargado ? `${g.tickets} día${g.tickets === 1 ? '' : 's'} sin concepto` : 'Entra sin concepto', c: T.ambar };
    if (g.facturado && g.facturado >= g.cargado - 1) return { t: 'En la factura', c: T.verde };
    if (g.cargado) return { t: `${g.tickets} día${g.tickets === 1 ? '' : 's'} cargado${g.tickets === 1 ? '' : 's'}${g.facturado ? ` · ${pesos(g.facturado)} en factura` : ''}`, c: T.verde };
    return { t: 'Se carga con la próxima actualización', c: T.txt2 };
  };
  const quitar = (g, campo) => (
    <button type="button" title={`Quitar ${campo === 'proveedor' ? 'el proveedor' : 'el concepto'}`} aria-label="Quitar" disabled={guardando === g.grupo}
      onClick={() => configurar(g, { [campo]: '' })}
      style={{ flex: '0 0 auto', width: 32, height: 40, border: 'none', background: 'none', color: T.txt3, cursor: 'pointer', fontSize: 16 }}>✕</button>
  );
  const pista = (t) => <div style={{ fontSize: 11.5, color: T.txt3, marginTop: 3 }}>{t}</div>;
  const selProv = (g) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <SelectorBuscable label="Proveedor" placeholder="Elegí el proveedor…" value={g.proveedor?.nombre || null} opciones={opcProv}
          deshabilitado={guardando === g.grupo} textoCrear="Crear proveedor nuevo…" onCrear={(nombre) => crearProveedor(g, nombre)}
          onChange={(nombre) => { const p = provs.find((x) => x.nombre === nombre); if (p) configurar(g, { proveedor: p.codigo }); }} />
        {g.proveedor && quitar(g, 'proveedor')}
      </div>
      {g.proveedorSugerido ? pista('Sugerido: el que cobra') : g.proveedorHeredado ? pista('El que elegiste para todo este tipo') : null}
    </div>
  );
  const selConc = (g) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <div style={{ flex: 1, minWidth: 0, borderRadius: 6, ...(g.concepto || !g.total ? {} : { boxShadow: `0 0 0 2px ${T.ambar}` }) }}>
          <SelectorBuscable label="Concepto de caja" placeholder="Elegí el concepto de caja…" value={g.concepto ? etiquetaConcepto(g.concepto) : null} opciones={opcConc}
            deshabilitado={guardando === g.grupo} textoCrear={`Crear «${g.nombre}»…`} nombreCrear={g.nombre}
            destacadas={sugeridosDe(g)} rotuloDestacadas={`Sugeridos para ${g.proveedor?.nombre || 'este cargo'}`}
            onCrear={(nombre) => abrirNuevo(g, nombre)}
            onChange={(nombre) => { const c = conceptos.find((x) => etiquetaConcepto(x) === nombre); if (c) configurar(g, { concepto: String(c.codigo) }); }} />
        </div>
        {g.concepto && quitar(g, 'concepto')}
      </div>
      {nuevo?.grupo === g.grupo ? panelNuevo(g) : !g.concepto && g.total > 0 ? (
        <button type="button" disabled={guardando === 'crear'} onClick={() => abrirNuevo(g)}
          style={{ marginTop: 4, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: T.celesteDeep, textAlign: 'left' }}>
          + Crear «{g.nombre}»
        </button>
      ) : g.conceptoHeredado ? pista('El que elegiste para todo este tipo: podés separarlo') : null}
    </div>
  );
  // Concepto nuevo, ahí mismo: el nombre viene con la leyenda; se elige el rubro o un concepto «igual que»
  // (padrino: se usa su rubro). Con un concepto ya puesto (el del tipo general), ese es el padrino.
  const panelNuevo = (g) => {
    const campo = { height: celu ? 44 : 36, borderRadius: 8, border: '1px solid rgba(21,33,62,.18)', padding: '0 8px', fontFamily: 'inherit', fontSize: 13, background: '#fff', width: '100%', boxSizing: 'border-box' };
    const rubroDePadrino = (cod) => conceptos.find((c) => String(c.codigo) === String(cod))?.codRubro;
    const listo = nuevo.nombre.trim() && nuevo.rubro;
    return (
      <div style={{ marginTop: 6, padding: 10, border: `1px solid ${T.celeste}`, borderRadius: 10, background: '#F7FBFD', display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.txt3, textTransform: 'uppercase', letterSpacing: '.3px' }}>Concepto nuevo</div>
        <input value={nuevo.nombre} maxLength={60} onChange={(e) => setNuevo((x) => ({ ...x, nombre: e.target.value }))} style={campo} aria-label="Nombre del concepto" />
        {sugeridosObj(g).length > 0 && (<>
          <span style={{ fontSize: 11.5, color: T.txt3 }}>Igual que (copia su rubro) · sugeridos para {g.proveedor?.nombre || 'este cargo'}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sugeridosObj(g).slice(0, 4).map((c) => {
              const sel = String(nuevo.padrino) === String(c.codigo);
              return (
                <button key={c.codigo} type="button" title={`Copiar el rubro de ${etiquetaConcepto(c)}`}
                  onClick={() => setNuevo((n) => (sel ? { ...n, padrino: '' } : { ...n, padrino: String(c.codigo), rubro: c.codRubro != null ? String(c.codRubro) : n.rubro }))}
                  style={{ minHeight: celu ? 44 : 30, padding: '0 10px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, textAlign: 'left',
                    border: `1px solid ${sel ? T.celeste : 'rgba(21,33,62,.18)'}`, background: sel ? '#E3F4FB' : '#fff', fontWeight: sel ? 700 : 400, color: T.txt }}>
                  {sel ? '✓ ' : ''}{c.nombre}
                </button>
              );
            })}
          </div>
        </>)}
        {/* Rubro primero y, debajo, los conceptos de ese rubro para copiar (Diego 20/11/2026: «elegir rubro no me
            filtra los conceptos de ese rubro»). Los dos con buscador. */}
        <SelectorBuscable label="Rubro" placeholder="Elegí el rubro…" opciones={rubros.map(etiquetaRubro)}
          value={rubros.find((x) => String(x.codigo) === String(nuevo.rubro)) ? etiquetaRubro(rubros.find((x) => String(x.codigo) === String(nuevo.rubro))) : null}
          onChange={(t) => { const x = rubros.find((y) => etiquetaRubro(y) === t); if (x) setNuevo((n) => ({ ...n, rubro: String(x.codigo), padrino: n.padrino && String(rubroDePadrino(n.padrino)) === String(x.codigo) ? n.padrino : '' })); }} />
        <SelectorBuscable label="Igual que (opcional)" placeholder="Ninguno"
          opciones={conceptos.filter((c) => !nuevo.rubro || String(c.codRubro) === String(nuevo.rubro)).map(etiquetaConcepto)}
          destacadas={sugeridosDe(g)} rotuloDestacadas={`Sugeridos para ${g.proveedor?.nombre || 'este cargo'}`}
          value={nuevo.padrino ? etiquetaConcepto(conceptos.find((c) => String(c.codigo) === String(nuevo.padrino)) || { codigo: nuevo.padrino, nombre: '' }) : null}
          onChange={(t) => { const c = conceptos.find((x) => etiquetaConcepto(x) === t); if (c) setNuevo((n) => ({ ...n, padrino: String(c.codigo), rubro: c.codRubro != null ? String(c.codRubro) : n.rubro })); }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setNuevo(null)}
            style={{ height: celu ? 44 : 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(21,33,62,.18)', background: '#fff', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button type="button" disabled={!listo || guardando === 'crear'} onClick={() => crearConceptos([g.grupo], { [g.grupo]: nuevo.nombre.trim() }, nuevo.rubro)}
            style={{ height: celu ? 44 : 32, padding: '0 14px', borderRadius: 8, border: 'none', background: T.celeste, color: '#12111F', fontWeight: 700, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', opacity: !listo || guardando === 'crear' ? 0.5 : 1 }}>
            {guardando === 'crear' ? 'Creando…' : 'Crear y usar'}
          </button>
        </div>
      </div>
    );
  };
  const fmtHora = (f) => `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)} ${f.hora}`;
  const MED = { credit_card: 'Crédito', debit_card: 'Débito', account_money: 'Dinero en cuenta', prepaid_card: 'Prepaga', bank_transfer: 'Transferencia', ticket: 'Efectivo' };
  const panelDetalle = (g) => {
    if (abierto !== g.grupo || !det || det.grupo !== g.grupo) return null;
    if (det.cargando) return <div style={{ padding: '10px 4px', color: T.txt3, fontSize: 13 }}>Trayendo el detalle…</div>;
    if (det.error) return <div style={{ padding: '10px 4px', color: '#991b1b', fontSize: 13 }}>No se pudo traer el detalle.</div>;
    const cel = { padding: '5px 8px', fontSize: 12.5, borderTop: `1px solid ${T.line2}`, textAlign: 'center', whiteSpace: 'nowrap' };
    const numc = { ...cel, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
    return (
      <div style={{ background: '#F7F9FB', border: `1px solid ${T.line}`, borderRadius: 10, padding: '8px 10px', margin: '4px 0 8px' }}>
        <div style={{ fontSize: 12, color: T.txt2, marginBottom: 6 }}>
          {det.filas.length.toLocaleString('es-AR')} cargo{det.filas.length === 1 ? '' : 's'} · total {pesos(det.total)}{det.recortado ? ' · se muestran los 2.000 más nuevos' : ''}
        </div>
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ fontSize: 11, color: T.txt3, textTransform: 'uppercase', letterSpacing: '.3px' }}>
              <th style={{ padding: '4px 8px', textAlign: 'center' }}>Fecha</th>
              <th style={{ padding: '4px 8px', textAlign: 'center' }}>Nº operación</th>
              {!celu && <th style={{ padding: '4px 8px', textAlign: 'center' }}>Medio</th>}
              {!celu && <th style={{ padding: '4px 8px', textAlign: 'right' }}>{g.grupo.startsWith('imp:') || g.grupo.startsWith('mp:') ? 'Cobro' : 'Pago'}</th>}
              <th style={{ padding: '4px 8px', textAlign: 'right' }}>Cargo</th>
            </tr></thead>
            <tbody>
              {det.filas.map((f, i) => (
                <tr key={`${f.op}-${i}`}>
                  <td style={cel}>{fmtHora(f)}{f.devol ? <span style={{ color: T.verde }}> · devuelto</span> : null}</td>
                  <td style={{ ...cel, fontFamily: 'ui-monospace, Menlo, monospace' }}>{f.op}</td>
                  {!celu && <td style={cel}>{MED[f.medio] || f.medio || '—'}</td>}
                  {!celu && <td style={numc}>{f.cobro != null ? pesos(f.cobro) : '—'}</td>}
                  <td style={{ ...numc, fontWeight: 600, color: f.importe < 0 ? T.verde : T.txt }}>{pesos(f.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  const botonTotal = (g) => (
    <button type="button" onClick={() => verDetalle(g)} title="Ver cobro por cobro"
      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 'inherit', color: T.celesteDeep, whiteSpace: 'nowrap', textDecoration: 'underline dotted', fontVariantNumeric: 'tabular-nums' }}>
      {pesos(g.total)} {abierto === g.grupo ? '▴' : '▾'}
    </button>
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
            Falta elegir proveedor o concepto en {faltan === 1 ? 'un tipo de cargo' : `${faltan} tipos de cargo`}. {r.activo ? 'Mientras tanto se carga igual, como «Sin concepto de caja asociado»: cuando lo elegís, lo ya cargado pasa a ese concepto.' : ''}
          </div>
        )}

        {sinConcepto.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '8px 0', fontSize: 13.5 }}>
            <span style={{ color: T.txt2 }}>Conceptos nuevos con el nombre de cada cargo, en el rubro</span>
            <select value={rubroPorDefecto()} onChange={(e) => setRubroNuevo(e.target.value)}
              style={{ height: celu ? 44 : 36, borderRadius: 8, border: '1px solid rgba(21,33,62,.18)', padding: '0 8px', fontFamily: 'inherit', fontSize: 13.5, background: '#fff', maxWidth: 260 }}>
              <option value="">Elegí el rubro…</option>
              {rubros.map((x) => <option key={x.codigo} value={String(x.codigo)}>{x.codigo} · {x.nombre}</option>)}
            </select>
            <button type="button" disabled={guardando === 'crear' || !rubroPorDefecto()} onClick={() => crearConceptos(sinConcepto.map((g) => g.grupo))}
              style={{ height: celu ? 44 : 36, padding: '0 14px', borderRadius: 8, border: 'none', background: T.celeste, color: '#12111F', fontWeight: 700, fontFamily: 'inherit', fontSize: 13.5, cursor: 'pointer', opacity: guardando === 'crear' || !rubroPorDefecto() ? 0.5 : 1 }}>
              {guardando === 'crear' ? 'Creando…' : `Crear los ${sinConcepto.length} que faltan`}
            </button>
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
                    <div style={{ fontWeight: 700 }}>{botonTotal(g)}</div>
                  </div>
                  {panelDetalle(g)}
                  {selProv(g)}
                  {selConc(g)}
                  <div style={{ fontSize: 12.5, color: e.c }}>{e.t}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '25%' }} /><col style={{ width: '23%' }} /><col style={{ width: '27%' }} /><col style={{ width: '13%' }} /><col style={{ width: '12%' }} /></colgroup>
            <thead>
              <tr style={{ fontSize: 11, color: T.txt3, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Qué descuenta</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Proveedor</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Concepto de caja</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', textTransform: 'capitalize' }}>{MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3)} {mes.slice(0, 4)}</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((g) => {
                const e = estado(g);
                return (
                  <React.Fragment key={g.grupo}>
                  <tr style={{ borderTop: `1px solid ${T.line2}` }}>
                    <td style={{ padding: '10px 8px', fontSize: 14, verticalAlign: 'top' }}>
                      {g.nombre}
                      <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>{g.facturable ? 'Pago a la factura del mes' : 'Retención: no hay factura'}</div>
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>{selProv(g)}</td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>{selConc(g)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>{botonTotal(g)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12.5, color: e.c, verticalAlign: 'top' }}>{e.t}</td>
                  </tr>
                  {abierto === g.grupo && <tr><td colSpan={5} style={{ padding: '0 8px' }}>{panelDetalle(g)}</td></tr>}
                  </React.Fragment>
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
