// src/paginas/MovimientosBancarios.jsx
// Administración › Movimientos bancarios (Diego 14/11/2026: «quiero ver todo lo que trae Mercado
// Pago para empezar a entender cómo lo voy a aplicar»). Solo lectura: muestra lo que ya está
// guardado de la cuenta de Mercado Pago de la sucursal — los cobros (fuente "banco" de la
// conciliación) y lo que salió (fuente "egresos") — con totales, comisiones y filtros.
// Se traen desde acá (barra «Traer de Mercado Pago») o desde Conciliación («Traer»).
// Va por SUCURSAL, como la conciliación: cada sucursal cobra en su propia cuenta.
// 14/11 (Diego): se trae desde acá también (atajos de fechas, mes a mes) y ?vista=bancos es
// «Conectá tu banco»: tarjetas con Mercado Pago (listo) y los bancos con API (próximamente).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { ConciliacionAPI, MercadoPagoAPI, sucursalNum } from '@/servicios/apiConciliacion';
import MenuColumna from '@/componentes/base/MenuColumna';
import { pasaFiltro, filtroActivo } from '@/componentes/base/filtrosColumna';
import logoMercadoPago from '@/assets/bancos/mercadopago.svg';
import logoGalicia from '@/assets/bancos/galicia.svg';
import logoBbva from '@/assets/bancos/bbva.svg';
import logoComafi from '@/assets/bancos/comafi.svg';

const T = {
  txt: '#15213E', txt2: '#5b6577', txt3: '#8a93a3', line: 'rgba(21,33,62,.12)', line2: 'rgba(21,33,62,.07)',
  celeste: '#5BC2EA', celesteDeep: '#2492C8', verde: '#1a9c6e', rojo: '#c2410c', ambar: '#B7791F', fondo: '#F7F9FB',
};
const pesos = (n) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('es-AR');
};
const dma = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '—');
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Un renglón para las tres fuentes: entrada (cobro), salida (egreso) o devolución.
// 14/11 (Diego): columnas extra que trae MP — acreditación, comisión / cuotas / retenciones por
// separado, referencia (el código que se carga en el POS), CUIT/DNI, caja, cuotas y tarjeta. Los
// cobros traídos antes de eso no tienen el desglose: ahí «comisión» es todo lo descontado.
const fmtDoc = (d, t) => {
  const n = String(d || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.length === 11) return `${t && !/dni/i.test(t) ? t : 'CUIT'} ${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`;
  return `${t || 'DNI'} ${Number(n).toLocaleString('es-AR')}`;
};
// Cómo queda el número de operación de MP en el cupón de MaxiRest (informe 22): 10 dígitos, los
// primeros 9 y el último (verificado con Container Bar oct–nov 2026: 1.256 de 1.272 cupones).
const claveMx = (id) => {
  const s = String(id || '');
  if (!/^\d+$/.test(s)) return '';
  return s.length > 10 ? `${s.slice(0, 9)}${s.slice(-1)}` : s;
};
function normalizar(banco = [], egresos = [], devoluciones = []) {
  const ent = banco.map((b) => {
    const bruto = Number(b.imp) || 0;
    const neto = b.neto != null && b.neto !== '' ? Number(b.neto) : null;
    const desglose = b.comisionMp != null;
    const ret = desglose && b.retenciones != null ? Number(b.retenciones) || 0 : null;
    const comision = desglose ? (Number(b.comisionMp) || 0) + (Number(b.costoCuotas) || 0) : (neto != null ? Math.max(0, bruto - neto) : 0);
    return {
      id: String(b.id), lado: 'entrada', fecha: String(b.fecha || '').slice(0, 10), hora: b.hora || '',
      tipo: 'Cobro', medio: b.tipoMedio || b.medio || '—', quien: b.cliente || '', detalle: b.descripcion || '',
      bruto, comision, cuotasCosto: desglose ? Number(b.costoCuotas) || 0 : 0, retenciones: ret,
      neto: neto != null ? neto : bruto,
      ref: b.ref || '', doc: fmtDoc(b.doc, b.docTipo), acredita: b.acredita || '', cuotas: b.cuotas || null,
      op: String(b.op || b.mpId || ''), claveMx: b.claveMx || claveMx(b.mpId),
      caja: b.caja || '', tarjeta: b.tarjeta || '', cuenta: b.cuenta ? String(b.cuenta) : '', email: b.email || '',
    };
  });
  const dev = devoluciones.map((d) => ({
    id: String(d.id), lado: 'devolucion', fecha: String(d.fecha || '').slice(0, 10), hora: d.hora || '',
    tipo: d.tipo || 'Devolución', medio: d.medio || '—', quien: d.cliente || '',
    detalle: `${d.parcial ? 'parcial · ' : ''}cobro del ${dma(d.cobroFecha)} por ${pesos(d.cobro)}`,
    bruto: Number(d.imp) || 0, comision: 0, retenciones: null, neto: -(Number(d.imp) || 0), parcial: !!d.parcial,
    ref: d.ref || '', doc: '', acredita: '', cuotas: null, caja: '', tarjeta: '',
    op: String(d.mpId || ''), claveMx: claveMx(d.mpId), cuenta: d.cuenta ? String(d.cuenta) : '',
  }));
  const sal = egresos.map((e) => {
    const imp = Math.abs(Number(e.imp) || 0);
    return {
      id: String(e.id), lado: 'salida', fecha: String(e.fecha || '').slice(0, 10), hora: e.hora || '',
      tipo: e.tipo || 'Egreso', medio: e.medio || '—', quien: '', detalle: e.detalle || '',
      bruto: imp, comision: 0, retenciones: null, neto: -imp,
      ref: e.ref || '', doc: '', acredita: '', cuotas: null, caja: '', tarjeta: '',
      op: /^\d+$/.test(String(e.mpId || '')) ? String(e.mpId) : '', claveMx: claveMx(e.mpId), cuenta: e.cuenta ? String(e.cuenta) : '',
    };
  });
  return [...ent, ...sal, ...dev].sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
}

const PILL = {
  entrada: { background: '#1a9c6e1a', color: '#1a9c6e' },
  salida: { background: '#c2410c14', color: '#c2410c' },
  devolucion: { background: '#B7791F1f', color: '#8a5a12' },
};

const PERIODOS = [
  { k: 'todo', l: 'Todo lo traído' },
  { k: 'mes', l: 'Este mes' },
  { k: 'ant', l: 'Mes anterior' },
  { k: 'fechas', l: 'Elegir fechas' },
];
const LADOS = [{ k: 'todos', l: 'Todos' }, { k: 'entrada', l: 'Entradas' }, { k: 'salida', l: 'Salidas' }, { k: 'devolucion', l: 'Devoluciones' }];

// Columnas de la lista (Diego 14/11): las fijas y las que se suman desde «Columnas».
const COLUMNAS = [
  { k: 'fecha', l: 'Fecha', fija: true, f: 'fecha' },
  { k: 'hora', l: 'Hora', f: 'texto' },
  { k: 'tipo', l: 'Tipo', fija: true, f: 'lista' },
  { k: 'pagador', l: 'Pagador', fija: true, f: 'texto' },
  { k: 'email', l: 'Email', f: 'texto' },
  { k: 'detalle', l: 'Descripción', f: 'texto' },
  { k: 'medio', l: 'Medio', f: 'lista' },
  { k: 'op', l: 'Nº operación', f: 'texto' },
  { k: 'ref', l: 'Referencia externa', f: 'texto' },
  { k: 'acredita', l: 'Acreditación', f: 'fecha' },
  { k: 'cuotas', l: 'Cuotas', f: 'lista' },
  { k: 'tarjeta', l: 'Tarjeta', f: 'texto' },
  { k: 'caja', l: 'Caja / QR', f: 'lista' },
  { k: 'cuenta', l: 'Cuenta', f: 'lista' },
  { k: 'importe', l: 'Importe', fija: true, f: 'num' },
  { k: 'comision', l: 'Comisión', f: 'num' },
  { k: 'retenciones', l: 'Impuestos', f: 'num' },
  { k: 'neto', l: 'Neto', fija: true, f: 'num' },
];
const COLS_DEFAULT = ['fecha', 'hora', 'tipo', 'pagador', 'medio', 'op', 'acredita', 'importe', 'comision', 'retenciones', 'neto'];
const COLS_KEY = 'movimientos-bancarios:columnas-v2';
const leerCols = () => {
  try { const v = JSON.parse(localStorage.getItem(COLS_KEY) || 'null'); if (Array.isArray(v) && v.length) return v; } catch { /* sin storage */ }
  return COLS_DEFAULT;
};

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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
  const [buscar, setBuscar] = useState('');
  // Títulos de la tabla estilo Excel (Diego 15/11/2026: «ordenarse en ambos sentidos y filtrarse»). Reemplazan
  // los desplegables de medio, cuenta y caja, que hacían lo mismo.
  const [filtros, setFiltros] = useState({});
  const [orden, setOrden] = useState({ k: 'fecha', asc: false });
  const [abierto, setAbierto] = useState(null); // { k, x, y }
  const ponerFiltro = (k, f) => setFiltros((o) => ({ ...o, [k]: f }));
  // El desglose por medio / por tipo arranca minimizado («así tengo más espacio para la tabla»); se recuerda.
  const [verDetalle, setVerDetalle] = useState(() => { try { return localStorage.getItem('movimientos-bancarios:detalle') === '1'; } catch { return false; } });
  const alternarDetalle = () => setVerDetalle((v) => { try { localStorage.setItem('movimientos-bancarios:detalle', v ? '0' : '1'); } catch { /* sin storage */ } return !v; });
  const [cols, setCols] = useState(leerCols);
  const [verCols, setVerCols] = useState(false);
  const [verComisiones, setVerComisiones] = useState(false);
  const alternarCol = (k) => setCols((c) => {
    const n = c.includes(k) ? c.filter((x) => x !== k) : [...c, k];
    try { localStorage.setItem(COLS_KEY, JSON.stringify(n)); } catch { /* sin storage */ }
    return n;
  });
  const ve = (k) => cols.includes(k) || COLUMNAS.find((c) => c.k === k)?.fija || (k === 'cuenta' && (mp?.cuentas || []).length > 1);
  const [ver, setVer] = useState(0);            // sube al traer de Mercado Pago (relee lo guardado)
  const [aviso, setAviso] = useState('');
  const avisoT = useRef(null);
  const avisar = (t, ms = 5000) => { setAviso(t); clearTimeout(avisoT.current); if (ms) avisoT.current = setTimeout(() => setAviso(''), ms); };
  const vistaBancos = new URLSearchParams(useLocation().search).get('vista') === 'bancos';

  useEffect(() => {
    if (!bid || suc === null) return;
    let vivo = true;
    setError('');
    ConciliacionAPI.cargar(bid, suc)
      .then((r) => {
        if (!vivo) return;
        const f = r?.fuentes || {};
        setDatos({ filas: normalizar(f.banco?.filas || [], f.egresos?.filas || [], f.devoluciones?.filas || []), origen: f.banco?.origen || '' });
      })
      .catch(() => { if (vivo) setError('No pude cargar los movimientos. Probá de nuevo en un rato.'); });
    MercadoPagoAPI.estado(bid, suc).then((r) => {
      if (!vivo) return;
      setMp(r);
      // El header muestra solo los bancos conectados (Diego 14/11/2026): le avisamos al Navbar.
      const on = !!r?.conectado;
      try { sessionStorage.setItem(`bancos:mp:${bid}`, on ? '1' : '0'); } catch { /* sin storage */ }
      window.dispatchEvent(new CustomEvent('bancos:estado', { detail: { bid, mp: on } }));
    }).catch(() => {});
    return () => { vivo = false; };
  }, [bid, suc, ver]);

  // Cuenta recién conectada (Diego 15/11/2026: «se vinculó perfecto pero mirá…» y la lista estaba vacía): mientras
  // alguna cuenta trae su historial, la pantalla lo dice y se vuelve a leer sola cada 30 s hasta que termina.
  const trayendoCuentas = (mp?.cuentas || []).filter((c) => !c.historial_completo);
  useEffect(() => {
    if (!trayendoCuentas.length) return undefined;
    const t = setTimeout(() => setVer((n) => n + 1), 30000);
    return () => clearTimeout(t);
  }, [mp]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const cuentasMp = mp?.cuentas || [];
  const variasCuentas = cuentasMp.length > 1;
  const nombreCuenta = (id) => cuentasMp.find((c) => String(c.user_id) === String(id))?.nickname || (id ? `#${id}` : '—');
  // Qué compara cada columna (filtro y orden) y qué se busca en las de texto.
  const valorDe = (f, k) => ({
    fecha: f.fecha, hora: f.hora, tipo: f.tipo, pagador: f.lado === 'salida' ? f.detalle : f.quien, email: f.email,
    detalle: f.detalle, medio: f.medio, op: f.op, ref: f.ref, acredita: f.acredita, cuotas: f.cuotas ? String(f.cuotas) : '',
    tarjeta: f.tarjeta, caja: f.caja, cuenta: f.cuenta, importe: f.bruto, comision: f.comision || 0, retenciones: f.retenciones || 0, neto: f.neto,
  }[k]);
  const textoDe = (f, k) => (k === 'pagador' ? `${valorDe(f, k) || ''} ${f.doc || ''}` : valorDe(f, k));
  const ordenDe = (f, k) => (k === 'fecha' ? `${f.fecha} ${f.hora || ''}` : valorDe(f, k) ?? '');
  const base = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return delPeriodo.filter((f) => (lado === 'todos' || f.lado === lado)
      && (!q || `${f.quien} ${f.email || ''} ${f.detalle} ${f.tipo} ${f.ref} ${f.doc} ${f.op} ${f.claveMx}`.toLowerCase().includes(q) || String(Math.round(f.bruto)).includes(q.replace(/\D/g, '') || '§')));
  }, [delPeriodo, lado, buscar]);
  const visibles = useMemo(() => {
    const ks = Object.keys(filtros).filter((k) => filtroActivo(filtros[k]));
    const out = base.filter((f) => ks.every((k) => pasaFiltro(valorDe(f, k), textoDe(f, k), filtros[k])));
    const COLS_NUM = { importe: 1, comision: 1, retenciones: 1, neto: 1 };
    return out.sort((a, b) => {
      const x = ordenDe(a, orden.k), y = ordenDe(b, orden.k);
      const r = COLS_NUM[orden.k] ? (Number(x) || 0) - (Number(y) || 0) : String(x).localeCompare(String(y), 'es', { numeric: true });
      return orden.asc ? r : -r;
    });
  }, [base, filtros, orden]); // eslint-disable-line react-hooks/exhaustive-deps
  // Valores posibles de una columna 'lista' (sobre lo filtrado por las OTRAS columnas, como Excel).
  const valoresDe = (k) => {
    const otras = Object.keys(filtros).filter((x) => x !== k && filtroActivo(filtros[x]));
    const n = {};
    base.filter((f) => otras.every((x) => pasaFiltro(valorDe(f, x), textoDe(f, x), filtros[x]))).forEach((f) => {
      const v = String(valorDe(f, k) ?? ''); n[v] = (n[v] || 0) + 1;
    });
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([v, c]) => [v, c, k === 'cuenta' ? nombreCuenta(v) : k === 'cuotas' && v ? `${v} cuotas` : v]);
  };
  const abrirMenu = (e, k) => {
    const r = e.currentTarget.getBoundingClientRect();
    const z = parseFloat(getComputedStyle(document.getElementById('root') || document.body).zoom) || 1;
    setAbierto(abierto?.k === k ? null : { k, x: Math.min(r.left / z, window.innerWidth / z - 270), y: r.bottom / z + 4 });
  };
  const hayFiltros = Object.values(filtros).some(filtroActivo);

  // Exportar (Diego 15/11/2026: «exportar los movimientos bancarios del período seleccionado»): lo que se ve
  // con el período y los filtros elegidos, TODOS (no solo los 1.500 de la lista) y con todas las columnas,
  // los importes como números para sumar en Excel. La librería se carga recién al tocar el botón.
  const [exportando, setExportando] = useState(false);
  const exportar = async () => {
    if (!visibles.length) return;
    setExportando(true);
    try {
      const XLSX = await import('xlsx');
      const n = (v) => (v ? Math.round(Number(v) * 100) / 100 : 0);
      const filas = visibles.map((f) => ({
        Fecha: f.fecha, Hora: f.hora || '', Tipo: f.tipo, 'Pagador / detalle': f.lado === 'salida' ? (f.detalle || '') : (f.quien || ''),
        'CUIT / DNI': f.doc || '', Email: f.email || '', Descripción: f.lado === 'entrada' && f.detalle !== 'Varios' ? (f.detalle || '') : '', Medio: f.medio || '',
        'Nº operación': f.op ? String(f.op) : '', 'Cupón (POS)': f.claveMx || '', 'Referencia externa': f.ref || '',
        ...(variasCuentas ? { Cuenta: nombreCuenta(f.cuenta) } : {}),
        Acreditación: f.acredita || '', Cuotas: f.cuotas || '', Tarjeta: f.tarjeta ? `•••• ${f.tarjeta}` : '', 'Caja / QR': f.caja || '',
        Importe: n(f.bruto), Comisión: -n(f.comision), Impuestos: -n(f.retenciones),
        // Igual que el KPI «Neto del período»: una devolución total no resta (MP ya sacó ese cobro de la
        // lista); la parcial sí. Así la suma de esta columna da el mismo neto que la pantalla.
        Neto: f.lado === 'devolucion' && !f.parcial ? 0 : n(f.neto),
        Nota: f.lado === 'devolucion' ? (f.parcial ? 'Devolución parcial: resta del neto' : 'Devolución total: el cobro ya no figura, no resta otra vez') : '',
      }));
      const hoja = XLSX.utils.json_to_sheet(filas);
      hoja['!cols'] = Object.keys(filas[0]).map((k) => ({ wch: Math.max(10, k.length + 2, ...filas.slice(0, 200).map((x) => String(x[k] ?? '').length + 1)) }));
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos');
      const fechas = visibles.map((f) => f.fecha).sort();
      const cuentaSel = filtros.cuenta?.valores?.length === 1 ? filtros.cuenta.valores[0] : '';
      const cuenta = String((cuentaSel ? nombreCuenta(cuentaSel) : variasCuentas ? (sucNombre || 'mercadopago') : mp?.cuenta?.nickname) || 'mercadopago').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      XLSX.writeFile(libro, `movimientos-${cuenta}-${fechas[0]}_${fechas[fechas.length - 1]}.xlsx`);
    } catch {
      avisar('No pude armar el Excel. Probá de nuevo.');
    } finally {
      setExportando(false);
    }
  };

  const tot = useMemo(() => {
    const ent = delPeriodo.filter((f) => f.lado === 'entrada');
    const sal = delPeriodo.filter((f) => f.lado === 'salida');
    const dev = delPeriodo.filter((f) => f.lado === 'devolucion');
    const s = (a, k) => a.reduce((x, f) => x + f[k], 0);
    const porMedio = {};
    ent.forEach((f) => {
      const m = porMedio[f.medio] || (porMedio[f.medio] = { n: 0, bruto: 0, comision: 0, cuotas: 0, ret: 0 });
      m.n++; m.bruto += f.bruto; m.comision += f.comision; m.cuotas += f.cuotasCosto || 0; m.ret += f.retenciones || 0;
    });
    const porTipo = {};
    sal.forEach((f) => { const m = porTipo[f.tipo] || (porTipo[f.tipo] = { n: 0, total: 0 }); m.n++; m.total += f.bruto; });
    return {
      nEnt: ent.length, nSal: sal.length, entro: s(ent, 'bruto'), comision: s(ent, 'comision'), netoEnt: s(ent, 'neto'), salio: s(sal, 'bruto'),
      cuotas: s(ent, 'cuotasCosto'), retenciones: ent.reduce((x, f) => x + (f.retenciones || 0), 0),
      // Las devoluciones totales ya no figuran como cobro (MP las saca); las parciales sí: esas restan.
      nDev: dev.length, devuelto: s(dev, 'bruto'), devParcial: dev.filter((f) => f.parcial).reduce((x, f) => x + f.bruto, 0),
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
  // Sin ningún banco conectado, la pantalla es «Conectá tu banco» (no hay movimientos que mostrar).
  if (vistaBancos || (mp && !mp.conectado)) return <ConectaTuBanco mp={mp} sucNombre={reales.length ? sucNombre : ''} />;
  if (error) return <div style={{ padding: 32, color: '#991b1b' }}>{error}</div>;
  if (!datos) return <div style={{ padding: 32, color: '#64748b' }}>Cargando los movimientos…</div>;

  const encabezado = (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, margin: 0 }}>Movimientos bancarios</h1>
        <div style={{ color: T.txt2, fontSize: 13.5, marginTop: 4 }}>
          🏦 Mercado Pago{cuentasMp.length ? ` · ${cuentasMp.map((c) => c.nickname || c.email || `#${c.user_id}`).join(' + ')}` : ''}{sucNombre && reales.length ? ` · ${sucNombre}` : ''}
        </div>
        {trayendoCuentas.map((c) => (
          <div key={c.user_id} style={{ marginTop: 8, marginRight: 8, display: 'inline-flex', alignItems: 'center', gap: 8, lineHeight: 1.35, fontSize: 13, color: '#12627F', background: '#5BC2EA1F', border: `1px solid ${T.celeste}`, borderRadius: 999, padding: '4px 12px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.celeste, flexShrink: 0 }} />
            <span>
              Trayendo el historial de <b>{c.nickname || c.email}</b>
              {c.historial_hasta ? ` · va por ${MESES_LARGO[Number(c.historial_hasta.slice(5, 7)) - 1]} ${c.historial_hasta.slice(0, 4)}` : ''}
              {' '}· la lista se completa sola
            </span>
          </div>
        ))}
      </div>
    </div>
  );
  const barra = <BarraTraerMP bid={bid} suc={suc} mp={mp} periodo={periodo} rango={rango}
    cubre={datos.filas.length ? { desde: datos.filas[datos.filas.length - 1].fecha, hasta: datos.filas[0].fecha, n: datos.filas.length } : null}
    onTraido={() => setVer((n) => n + 1)} avisar={avisar} />;
  const toast = aviso ? (
    <div style={{ position: 'fixed', left: 20, bottom: 20, zIndex: 1300, background: '#15213E', color: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13, boxShadow: '0 6px 20px rgba(0,0,0,.25)', maxWidth: 520 }}>{aviso}</div>
  ) : null;

  // Sin nada guardado todavía: el primer paso, con lo que ya existe.
  if (!datos.filas.length) {
    return (
      <div style={pagina}>
        {encabezado}
        {toast}
        {mp?.conectado && <div style={{ marginBottom: 14 }}>{barra}</div>}
        <div style={{ ...tarjeta, padding: '22px 24px', maxWidth: 560 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {mp?.conectado ? 'Todavía no se trajo ningún movimiento' : 'Conectá Mercado Pago'}
          </div>
          <div style={{ color: T.txt2, fontSize: 14, marginBottom: 14 }}>
            {mp?.conectado
              ? `${variasCuentas ? `Las cuentas ${cuentasMp.map((c) => c.nickname).join(' y ')} están conectadas` : `La cuenta ${mp.cuenta?.nickname || ''} está conectada`}. Se traen solas; si querés ya, tocá «Actualizar».`
              : 'Con la cuenta conectada, los cobros y lo que sale de Mercado Pago aparecen acá solos.'}
          </div>
          {!mp?.conectado && <RouterLink to="/configuracion?tab=7"
            style={{ display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 16px', borderRadius: 8, background: T.celeste, color: '#12111F', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
            Ir a Conexiones
          </RouterLink>}
        </div>
      </div>
    );
  }

  const pct = (n) => (tot.entro ? `${((n / tot.entro) * 100).toFixed(2).replace('.', ',')}%` : '—');
  const kpis = [
    { l: 'Entró', v: tot.entro, s: `${tot.nEnt.toLocaleString('es-AR')} cobros`, c: T.verde },
    { l: 'Comisiones MP', v: -tot.comision, s: `${pct(tot.comision)} · ${verComisiones ? 'ocultar ▴' : 'ver por medio ▾'}`, c: T.rojo,
      onClick: () => setVerComisiones((v) => !v), activo: verComisiones },
    { l: 'Impuestos y retenc.', v: -tot.retenciones, s: `${pct(tot.retenciones)} de lo cobrado`, c: T.ambar, t: 'Lo que MP descuenta de cada cobro y no es comisión: el impuesto a los débitos y créditos (0,6% en las transferencias recibidas) y las retenciones (IIBB, etc.). Buena parte se computa a cuenta de impuestos.' },
    { l: 'Salió', v: -tot.salio, s: `${tot.nSal.toLocaleString('es-AR')} movimientos`, c: T.rojo },
    { l: 'Devoluciones', v: -tot.devuelto, s: `${tot.nDev.toLocaleString('es-AR')} · ${tot.devParcial ? `${pesos(tot.devParcial)} parciales` : 'no suman en Entró'}`, c: T.ambar, t: 'Devoluciones, contracargos y disputas. Un cobro devuelto entero ya no figura en Entró; las devoluciones parciales sí se restan del neto.' },
    { l: 'Neto del período', v: tot.netoEnt - tot.salio - tot.devParcial, s: 'entró − descuentos − salió', c: T.txt },
  ];
  // encabezado con el color de la app (las tablas toman el color del negocio): texto blanco
  const th = { padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#fff', fontWeight: 700, position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-primary, #2492C8)', textAlign: 'center', whiteSpace: 'nowrap' };
  const td = { padding: '7px 10px', fontSize: 13, borderBottom: `1px solid ${T.line2}`, textAlign: 'center', whiteSpace: 'nowrap' };
  const num = { ...td, fontFamily: "'Sora', sans-serif", fontWeight: 600 };

  return (
    <div style={pagina}>
      {encabezado}
      {toast}
      {/* Período: una sola barra (Diego 15/11/2026: «esas acciones ¿no se duplican?»). Lo que se ve y lo
          que se actualiza de Mercado Pago es el mismo período; el historial ya se trae solo. */}
      <div style={{ ...tarjeta, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 14 }}>
        {PERIODOS.map((p) => <button key={p.k} type="button" onClick={() => setPeriodo(p.k)} style={chip(periodo === p.k)}>{p.l}</button>)}
        {periodo === 'fechas' && (
          <>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={campo} />
            <span>a</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={campo} />
          </>
        )}
        <span style={{ color: T.txt3, fontSize: 12.5, marginLeft: 6 }}>
          {tot.desde ? `Del ${dma(tot.desde)} al ${dma(tot.hasta)}` : 'Sin movimientos en ese período'}
        </span>
        <span style={{ marginLeft: 'auto' }}>{barra}</span>
      </div>

      {/* Totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 10, marginBottom: 12 }}>
        {kpis.map((k) => (
          <div key={k.l} title={k.t || ''} onClick={k.onClick} role={k.onClick ? 'button' : undefined}
            style={{ ...tarjeta, padding: '12px 14px', minWidth: 0, cursor: k.onClick ? 'pointer' : 'default', ...(k.activo ? { borderColor: T.celeste, boxShadow: `0 0 0 1px ${T.celeste}` } : {}) }}>
            <div style={{ fontSize: 12, color: T.txt3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{k.l}</div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 20, color: k.c, marginTop: 4, whiteSpace: 'nowrap' }}>{pesos(k.v)}</div>
            <div style={{ fontSize: 12, color: T.txt2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* Comisiones por medio (Diego 14/11: «cuánto es por tipo de cobro, en el KPI de comisiones») */}
      {verComisiones && (
        <div style={{ ...tarjeta, padding: '10px 14px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: T.txt3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>
            Comisiones por medio de cobro
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ color: T.txt3, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.3px' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 700 }}>Medio</th>
              <th style={{ padding: '4px 6px', fontWeight: 700 }}>Cobros</th>
              <th style={{ padding: '4px 6px', fontWeight: 700 }}>Cobrado</th>
              <th style={{ padding: '4px 6px', fontWeight: 700 }}>Comisión</th>
              <th style={{ padding: '4px 6px', fontWeight: 700 }}>% del medio</th>
              <th style={{ padding: '4px 6px', fontWeight: 700 }}>De eso, cuotas</th>
              <th style={{ padding: '4px 6px', fontWeight: 700 }}>Peso en el total</th>
            </tr></thead>
            <tbody>
              {tot.porMedio.slice().sort((a, b) => b[1].comision - a[1].comision).map(([m, v]) => {
                const pm = v.bruto ? (v.comision / v.bruto) * 100 : 0;
                const peso = tot.comision ? (v.comision / tot.comision) * 100 : 0;
                return (
                  <tr key={m} style={{ borderTop: `1px solid ${T.line2}` }}>
                    <td style={{ padding: '6px', textAlign: 'left' }}>{m}</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: T.txt2 }}>{v.n.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontFamily: "'Sora', sans-serif" }}>{pesos(v.bruto)}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontFamily: "'Sora', sans-serif", color: T.rojo, fontWeight: 600 }}>{pesos(-v.comision)}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>{pm.toFixed(2).replace('.', ',')}%</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: v.cuotas ? T.txt : T.txt3 }}>{v.cuotas ? pesos(v.cuotas) : '—'}</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 70, height: 6, borderRadius: 3, background: T.line2, overflow: 'hidden' }}>
                          <span style={{ display: 'block', width: `${Math.min(100, peso)}%`, height: '100%', background: T.rojo }} />
                        </span>
                        <span style={{ minWidth: 38, textAlign: 'right', color: T.txt2 }}>{peso.toFixed(0)}%</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Desglose: por medio (entradas) y por tipo (salidas). Minimizado; se abre a pedido. */}
      <button type="button" onClick={alternarDetalle}
        style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: T.celesteDeep, padding: '0 2px', margin: '0 0 10px' }}>
        {verDetalle ? 'Ocultar detalle por medio y por tipo ▴' : `Ver detalle: ${tot.porMedio.length} medios de cobro y ${tot.porTipo.length} tipos de salida ▾`}
      </button>
      {verDetalle && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ ...tarjeta, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: T.txt3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>Entradas por medio</div>
          {tot.porMedio.length ? tot.porMedio.map(([m, v]) => (
            <button key={m} type="button" onClick={() => { const on = filtros.medio?.valores?.length === 1 && filtros.medio.valores[0] === m; setLado('entrada'); ponerFiltro('medio', on ? null : { valores: [m] }); }}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '5px 6px', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: T.txt, background: filtros.medio?.valores?.length === 1 && filtros.medio.valores[0] === m ? '#5BC2EA1F' : 'transparent' }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{m} <span style={{ color: T.txt3 }}>· {v.n}</span></span>
              <span style={{ color: T.txt3, fontSize: 12 }}>comisión {pesos(v.comision)}</span>
              <b style={{ fontFamily: "'Sora', sans-serif", minWidth: 110, textAlign: 'right' }}>{pesos(v.bruto)}</b>
            </button>
          )) : <div style={{ fontSize: 13, color: T.txt3 }}>Sin cobros en el período</div>}
        </div>
        <div style={{ ...tarjeta, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: T.txt3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>Salidas por tipo</div>
          {tot.porTipo.length ? tot.porTipo.map(([t, v]) => (
            <button key={t} type="button" onClick={() => { setLado('salida'); ponerFiltro('tipo', { valores: [t] }); }}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '5px 6px', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: T.txt, background: 'transparent' }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{t} <span style={{ color: T.txt3 }}>· {v.n}</span></span>
              <b style={{ fontFamily: "'Sora', sans-serif", minWidth: 110, textAlign: 'right' }}>{pesos(v.total)}</b>
            </button>
          )) : <div style={{ fontSize: 13, color: T.txt3 }}>Sin salidas en el período. Retiros, impuestos y comisiones llegan con el reporte de Mercado Pago.</div>}
        </div>
      </div>}

      {/* Lista */}
      <div style={{ ...tarjeta, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 12px', borderBottom: `1px solid ${T.line}` }}>
          {LADOS.map((x) => <button key={x.k} type="button" onClick={() => setLado(x.k)} style={chip(lado === x.k)}>{x.l}</button>)}
          {hayFiltros && (
            <button type="button" onClick={() => setFiltros({})} style={{ ...chip(false), color: T.rojo }}>✕ Quitar filtros de columnas</button>
          )}
          <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar pagador, email, importe, Nº de operación o cupón del POS"
            style={{ ...campo, flex: '1 1 0', minWidth: 180 }} />
          <button type="button" onClick={exportar} disabled={!visibles.length || exportando} title="Bajar a Excel lo que se ve: período y filtros elegidos"
            style={{ ...chip(false), fontWeight: 700, background: T.celeste, border: 'none', color: '#12111F', opacity: !visibles.length || exportando ? 0.5 : 1 }}>
            {/* La cantidad va en el botón, como en Clientes: así entra la barra con varias cuentas. */}
            {exportando ? 'Armando…' : `Exportar a Excel (${visibles.length.toLocaleString('es-AR')})`}
          </button>
          <span style={{ position: 'relative' }}>
            <button type="button" onClick={() => setVerCols((v) => !v)} style={chip(verCols)} aria-expanded={verCols}>Columnas ▾</button>
            {verCols && (
              <>
                <div onClick={() => setVerCols(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 21, background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(21,33,62,.16)', padding: '8px 4px', minWidth: 210 }}>
                  <div style={{ fontSize: 11.5, color: T.txt3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', padding: '2px 10px 6px' }}>Qué columnas ver</div>
                  {COLUMNAS.filter((c) => !c.fija).map((c) => (
                    <label key={c.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: 13.5, cursor: 'pointer', borderRadius: 6 }}>
                      <input type="checkbox" checked={cols.includes(c.k)} onChange={() => alternarCol(c.k)} />
                      {c.l}
                    </label>
                  ))}
                </div>
              </>
            )}
          </span>
        </div>
        <div style={{ maxHeight: 620, overflow: 'auto' }} onScroll={() => setAbierto(null)}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {COLUMNAS.filter((c) => ve(c.k)).map((c) => {
                const act = filtroActivo(filtros[c.k]);
                const ord = orden.k === c.k;
                return (
                  <th key={c.k} style={{ ...(c.k === 'pagador' || c.k === 'detalle' || c.k === 'email' ? { ...th, textAlign: 'left' } : th), padding: 0 }}>
                    <button type="button" onClick={(e) => abrirMenu(e, c.k)} title={`Ordenar o filtrar ${c.l}`}
                      style={{ all: 'unset', boxSizing: 'border-box', width: '100%', padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        justifyContent: c.k === 'pagador' || c.k === 'detalle' || c.k === 'email' ? 'flex-start' : 'center', background: act ? 'rgba(255,255,255,.18)' : 'transparent' }}>
                      {c.l}
                      <span style={{ fontSize: 9, opacity: act || ord ? 1 : 0.6 }}>{act ? '⏷' : ord ? (orden.asc ? '▲' : '▼') : '▾'}</span>
                    </button>
                  </th>
                );
              })}
            </tr></thead>
            <tbody>
              {visibles.slice(0, 1500).map((f) => (
                <tr key={f.id}>
                  {ve('fecha') && <td style={td}>{dma(f.fecha)}</td>}
                  {ve('hora') && <td style={{ ...td, color: T.txt3 }}>{f.hora || '—'}</td>}
                  {ve('tipo') && <td style={td}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, ...PILL[f.lado] }}>{f.tipo}</span>
                  </td>}
                  {ve('pagador') && <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', minWidth: 170, maxWidth: 380, lineHeight: 1.3 }}>
                    {f.lado === 'salida' ? <span>{f.detalle || '—'}</span> : (
                      <>
                        {f.quien ? <span>{f.quien}</span> : <span style={{ color: T.txt3 }}>sin nombre</span>}
                        {f.doc ? <span style={{ display: 'block', color: T.txt3, fontSize: 12, whiteSpace: 'nowrap' }}>{f.doc}</span> : null}
                        {f.lado === 'devolucion' && f.detalle ? <span style={{ color: T.txt3 }}> · {f.detalle}</span> : null}
                      </>
                    )}
                  </td>}
                  {ve('email') && <td style={{ ...td, color: f.email ? T.txt2 : T.txt3, textAlign: 'left', fontSize: 12.5 }}>{f.email || '—'}</td>}
                  {ve('detalle') && <td style={{ ...td, color: T.txt3, whiteSpace: 'normal', maxWidth: 220, textAlign: 'left' }}>{f.lado === 'entrada' && f.detalle !== 'Varios' ? (f.detalle || '—') : '—'}</td>}
                  {ve('medio') && <td style={{ ...td, color: T.txt2 }}>{f.medio}</td>}
                  {ve('op') && <td title={f.claveMx ? `En MaxiRest (cupón del informe 22): ${f.claveMx}` : ''}
                    style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, color: f.op ? T.txt : T.txt3 }}>{f.op || '—'}</td>}
                  {ve('ref') && <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, color: f.ref ? T.txt : T.txt3 }}>{f.ref || '—'}</td>}
                  {ve('acredita') && <td style={{ ...td, color: f.acredita && f.acredita > hoyLocal() ? '#C8912B' : T.txt2 }}>{f.acredita ? dma(f.acredita) : '—'}</td>}
                  {ve('cuotas') && <td style={{ ...td, color: T.txt2 }}>{f.cuotas ? `${f.cuotas} cuotas` : '—'}</td>}
                  {ve('tarjeta') && <td style={{ ...td, color: T.txt2 }}>{f.tarjeta ? `•••• ${f.tarjeta}` : '—'}</td>}
                  {ve('caja') && <td style={{ ...td, color: T.txt2 }}>{f.caja || '—'}</td>}
                  {ve('cuenta') && <td style={{ ...td, color: T.txt2, fontSize: 12.5 }}>{f.cuenta ? nombreCuenta(f.cuenta) : '—'}</td>}
                  {ve('importe') && <td style={num}>{pesos(f.bruto)}</td>}
                  {ve('comision') && <td style={{ ...num, color: f.comision ? T.rojo : T.txt3, fontWeight: 500 }}>{f.comision ? pesos(-f.comision) : '—'}</td>}
                  {ve('retenciones') && <td style={{ ...num, color: f.retenciones ? T.ambar : T.txt3, fontWeight: 500 }}>{f.retenciones ? pesos(-f.retenciones) : '—'}</td>}
                  {ve('neto') && <td style={{ ...num, color: f.neto >= 0 ? T.verde : T.rojo, fontWeight: 700 }}>{pesos(f.neto)}</td>}
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
      {abierto && (
        <MenuColumna col={COLUMNAS.find((c) => c.k === abierto.k)} pos={abierto} filtro={filtros[abierto.k]}
          valores={COLUMNAS.find((c) => c.k === abierto.k)?.f === 'lista' ? valoresDe(abierto.k) : []}
          onFiltro={(f) => ponerFiltro(abierto.k, f)} onOrden={(asc) => { setOrden({ k: abierto.k, asc }); setAbierto(null); }}
          onCerrar={() => setAbierto(null)} />
      )}
    </div>
  );
}

// ─── Traer de Mercado Pago (14/11) ───────────────────────────────────────────
// Mismos atajos que pidió Diego para Conciliación. El servidor acepta hasta 3 meses por pedido:
// el período se parte en meses y se piden uno por uno, con avance y «Cortar». «Todo el historial»
// va hacia atrás hasta 2 meses seguidos sin cobros (tope 36). Los nombres de pagadores y los
// egresos llegan con el reporte de liberaciones, que Mercado Pago arma en unos minutos: los
// meses que quedan pendientes se vuelven a pedir solos cada 40 s.
const hoyLocal = () => isoLocal(new Date());
const restarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() - n); return isoLocal(d); };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (iso) => `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
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

// Actualizar de Mercado Pago (15/11/2026): ya no tiene sus propios atajos de período (se duplicaban con los
// de la vista). Trae el mismo período que se está viendo; «Todo lo traído» = este mes. El historial se trae solo.
function BarraTraerMP({ bid, suc, mp, cubre, periodo, rango, onTraido, avisar }) {
  const [avance, setAvance] = useState(null);
  const [esperando, setEsperando] = useState([]); // meses con el reporte de MP pendiente
  const cortar = useRef(false);
  const cb = useRef({ avisar, onTraido });
  cb.current = { avisar, onTraido };

  useEffect(() => {
    if (!esperando.length) return undefined;
    let intentos = 0;
    let vivo = true;
    const t = setInterval(async () => {
      intentos += 1;
      const quedan = [];
      let llegaron = 0;
      for (const r of esperando) {
        try {
          const x = await MercadoPagoAPI.reporte(bid, suc, r.desde, r.hasta);
          if (x.reporte === 'listo') llegaron += 1;
          else if (x.reporte !== 'error') quedan.push(r);
        } catch { quedan.push(r); }
      }
      if (!vivo) return;
      if (llegaron) { cb.current.onTraido(); cb.current.avisar(`Llegaron los nombres de pagadores y los egresos de ${llegaron} mes${llegaron === 1 ? '' : 'es'}`); }
      if (!quedan.length || intentos >= 10) {
        setEsperando([]);
        if (quedan.length) cb.current.avisar('El reporte de Mercado Pago está tardando: volvé a traer en un rato.', 8000);
      } else setEsperando(quedan);
    }, 40000);
    return () => { vivo = false; clearInterval(t); };
  }, [esperando, bid, suc]);

  if (!mp?.conectado) return null;

  const traer = async () => {
    const hoy = hoyLocal();
    let tramos;
    if (periodo === 'todo' || !rango || rango[0] === '0000') tramos = tramosPorMes(hoy.slice(0, 8) + '01', hoy);
    else {
      const [d, h] = rango;
      if (!d || !h || h === '9999' || d > h) { avisar('Elegí las dos fechas', 3000); return; }
      tramos = tramosPorMes(d, h > hoy ? hoy : h);
    }
    cortar.current = false;
    let cobros = 0, vacios = 0, hechos = 0, masViejo = null, fallo = null;
    const pendientes = [];
    for (let i = 0; i < tramos.length; i++) {
      const t = tramos[i];
      setAvance({ mes: nombreMes(t.desde), n: i + 1, de: tramos.length });
      try {
        const r = await MercadoPagoAPI.sincronizar(bid, suc, t.desde, t.hasta);
        const c = Number(r?.cobros) || 0;
        cobros += c; hechos++; if (c) masViejo = t.desde;
        vacios = c ? 0 : vacios + 1;
        if (r?.reporte === 'pendiente') pendientes.push(t);
      } catch (e) {
        const c = String(e?.message || '').split(':')[0].trim();
        fallo = c === 'mp_vencido' ? 'Venció la conexión con Mercado Pago: volvé a conectarla en Conexiones.' : `Mercado Pago no respondió en ${nombreMes(t.desde)}. Lo anterior quedó guardado; probá de nuevo en un rato.`;
        break;
      }
      if (cortar.current) break;
    }
    setAvance(null);
    if (hechos) onTraido();
    if (pendientes.length) setEsperando(pendientes);
    if (fallo) { avisar(fallo, 9000); return; }
    const rango = masViejo ? ` (${nombreMes(masViejo)} a ${nombreMes(tramos[0].desde)})` : '';
    avisar(`${cortar.current ? 'Cortado. ' : 'Listo: '}${cobros.toLocaleString('es-AR')} cobro${cobros === 1 ? '' : 's'}${rango}${pendientes.length ? ' · los nombres y egresos llegan en unos minutos' : ''}`, 7000);
  };

  const trayendo = !!avance;
  const chip = { fontFamily: 'inherit', fontSize: 13, fontWeight: 600, height: 34, padding: '0 12px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${T.celeste}`, background: '#fff', color: '#12627F' };
  const queTrae = periodo === 'todo' || !rango || rango[0] === '0000' ? 'este mes' : 'el período elegido';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: 12.5, color: T.txt3 }}>
      {trayendo ? (
        <>
          <span style={{ color: T.txt2 }}>Trayendo <b style={{ color: T.txt }}>{avance.mes}</b>{avance.de ? ` · ${avance.n} de ${avance.de}` : ''}…</span>
          <button type="button" onClick={() => { cortar.current = true; }} style={chip}>Cortar</button>
        </>
      ) : (
        <>
          <span title={cubre?.n ? `En Lazarillo: del ${dma(cubre.desde)} al ${dma(cubre.hasta)} · ${cubre.n.toLocaleString('es-AR')} movimientos` : ''}>
            Se trae sola todos los días{cubre?.hasta ? ` · al día hasta el ${dma(cubre.hasta)}` : ''}
            {esperando.length ? <b style={{ color: '#C8912B' }}> · armando el reporte…</b> : null}
          </span>
          <button type="button" onClick={traer} style={chip}
            title={`Vuelve a pedirle a Mercado Pago ${queTrae} y reemplaza lo que había de esos días`}>
            ↻ Actualizar
          </button>
        </>
      )}
    </span>
  );
}

// ─── Conectá tu banco (14/11) ────────────────────────────────────────────────
// Tarjetas por banco: Mercado Pago ya funciona; el resto son bancos argentinos con API para
// empresas (movimientos de cuenta), que se van a ir sumando. Manuales en la memoria del proyecto
// (areas/bancos-apis.md).
const PROXIMOS = [
  { id: 'galicia', nombre: 'Banco Galicia', logo: logoGalicia, desc: 'Open Galicia: cuentas y movimientos para empresas.' },
  { id: 'bbva', nombre: 'BBVA', logo: logoBbva, desc: 'BBVA API Market: cuentas, movimientos y pagos.' },
  { id: 'comafi', nombre: 'Banco Comafi', logo: logoComafi, desc: 'API Banking: movimientos en cuenta, notificaciones y DEBIN.' },
];

function ConectaTuBanco({ mp, sucNombre }) {
  const card = { background: '#fff', border: `1px solid ${T.line}`, borderRadius: 14, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 190 };
  const logoBox = { height: 44, display: 'flex', alignItems: 'center' };
  const pill = (bg, fg) => ({ alignSelf: 'flex-start', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.4px' });
  const conectado = !!mp?.conectado;
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 22px 40px', fontFamily: "'Archivo', system-ui, sans-serif", color: T.txt }}>
      <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, margin: 0 }}>Conectá tu banco</h1>
      <p style={{ color: T.txt2, fontSize: 14, margin: '4px 0 18px' }}>
        Con el banco conectado, los cobros y lo que sale de la cuenta llegan solos a Lazarillo{sucNombre ? ` (${sucNombre})` : ''}: sin bajar ni subir extractos.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        <div style={{ ...card, border: `1.5px solid ${T.celeste}` }}>
          <div style={logoBox}><img src={logoMercadoPago} alt="" style={{ height: 40 }} /></div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16 }}>Mercado Pago</div>
          <div style={{ color: T.txt2, fontSize: 13, flex: 1 }}>
            {conectado
              ? `Conectado con ${(mp.cuentas?.length ? mp.cuentas : [mp.cuenta]).map((c) => c?.nickname || c?.email || 'tu cuenta').join(' y ')}.`
              : 'Cobros, pagos, retiros, impuestos y comisiones de la cuenta.'}
            {conectado && <span style={{ display: 'block', marginTop: 6 }}>
              <RouterLink to="/configuracion?tab=7" style={{ color: T.celesteDeep, fontWeight: 600 }}>+ Conectar otra cuenta de esta sucursal</RouterLink>
            </span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={conectado ? pill('#1a9c6e1a', T.verde) : pill('#5BC2EA1F', '#12627F')}>{conectado ? '✓ Conectado' : 'Disponible'}</span>
            <RouterLink to={conectado ? '/movimientos-bancarios' : '/configuracion?tab=7'} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: T.celesteDeep, whiteSpace: 'nowrap' }}>
              {conectado ? 'Ver movimientos →' : 'Conectar →'}
            </RouterLink>
          </div>
        </div>
        {PROXIMOS.map((b) => (
          <div key={b.id} style={{ ...card, opacity: 0.8 }}>
            <div style={logoBox}><img src={b.logo} alt="" style={{ maxHeight: 40, maxWidth: 150 }} /></div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16 }}>{b.nombre}</div>
            <div style={{ color: T.txt2, fontSize: 13, flex: 1 }}>{b.desc}</div>
            <span style={pill('#F2F4F7', T.txt3)}>Próximamente</span>
          </div>
        ))}
      </div>
    </div>
  );
}
