/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, react-refresh/only-export-components -- módulo de Diego: se integró sin tocar su lógica (14/11/2026) */
import React from "react";
import { CORTE_DEFAULT, aplicarCorte, esInterno, C, COLS_BANCO, COLS_INGRESOS, FUENTES, HIDE_BAN_COMPARTIDO, HIDE_ING_COMPARTIDO, MESES_ES, autoConciliarCC, cliKey, conciliar, esMP, fmt, fmtFecha, memDesdeProp, memOlvidar, memRegistrar, pagadorCoincide, parseFacturasCC, refBan, refCob, useBrandFonts, useSheetJS } from './motorConciliacion';
import { BuscadorBox, ColErrorModal, CuentaModal, DynThead, Empty, Field, GrupoCCHead, ImportModal, InfoTip, InstructivoModal, NotaChip, NotaEditor, Panel, PanelColapsable, PanelHead, Rows, SubFilter, UploaderCard, fldLbl, ghostBtn, inputStyle } from './piezasConciliacion';
import { DayCompareBar, DayGroupedRows, DayNav, DiaCompartido, DynRow, PendItem, SugerenciasPanel } from './vistasDiaConciliacion';
import { calcBarTotals, calcCcPorDia, calcDifSigno, calcResComp, calcSugerencias, calcView } from './calculosConciliacion';
import { renderBarraSuperior, renderCuerpo } from './pantallaConciliacion';
// Lectores de MaxiRest que usa desdeMaxi.js
export { parseVentas, parsePagos, parseFacturasCC } from './motorConciliacion';


// ─── Componente principal ───────────────────────────────────────────
// JSON con las claves ordenadas: el servidor (jsonb) devuelve las claves en otro orden.
function estable(o) {
  if (o === undefined) return "null";
  if (o === null || typeof o !== "object") return JSON.stringify(o);
  if (Array.isArray(o)) return "[" + o.map(estable).join(",") + "]";
  return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + estable(o[k])).join(",") + "}";
}
// Mezcla de tres vías (base = lo último que este navegador guardó/leyó, local = lo mío, remoto = lo
// que hay ahora en el servidor): por cada registro, si yo lo cambié desde la base gana lo mío; si no,
// lo del servidor (lo cambió otra persona o pestaña).
function mezclarEstados(base, local, remoto) {
  const b = base || {}, r = remoto || {};
  const mapa = (kb, kl, kr) => {
    const out = {}; const keys = new Set([...Object.keys(kb || {}), ...Object.keys(kl || {}), ...Object.keys(kr || {})]);
    keys.forEach((k) => {
      const yoCambie = estable((kl || {})[k]) !== estable((kb || {})[k]);
      const v = yoCambie ? (kl || {})[k] : (kr || {})[k];
      if (v !== undefined) out[k] = v;
    });
    return out;
  };
  const porId = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
  const lista = (kb, kl, kr) => {
    const sb = new Set((kb || []).map(estable)), sl = new Set((kl || []).map(estable)), sr = new Set((kr || []).map(estable));
    const todos = new Map(); [...(kb || []), ...(kl || []), ...(kr || [])].forEach((x) => todos.set(estable(x), x));
    return [...todos.entries()].filter(([k]) => (sl.has(k) !== sb.has(k) ? sl.has(k) : sr.has(k))).map(([, x]) => x);
  };
  return {
    ...local,
    V: mapa(b.V, local.V, r.V), B: mapa(b.B, local.B, r.B),
    Vextra: Object.values(mapa(porId(b.Vextra), porId(local.Vextra), porId(r.Vextra))),
    Bextra: Object.values(mapa(porId(b.Bextra), porId(local.Bextra), porId(r.Bextra))),
    tips: mapa(b.tips, local.tips, r.tips), notas: mapa(b.notas, local.notas, r.notas), formaOverride: mapa(b.formaOverride, local.formaOverride, r.formaOverride),
    aprobadas: lista(b.aprobadas, local.aprobadas, r.aprobadas), faltantes: lista(b.faltantes, local.faltantes, r.faltantes),
    efecReclas: lista(b.efecReclas, local.efecReclas, r.efecReclas), sugDescartadas: lista(b.sugDescartadas, local.sugDescartadas, r.sugDescartadas),
    ccConc: lista(b.ccConc, local.ccConc, r.ccConc), ccNoAuto: lista(b.ccNoAuto, local.ccNoAuto, r.ccNoAuto),
  };
}

export default function ModuloConciliacion({
  business = { group: "Contenedores", name: "Container Bar", initials: "CB", color: "#5BC2EA" },
  embedded = false, // cuando va dentro del Shell (que ya trae su header), se oculta el header propio
  pagadorMap = {}, // memoria de pagadores (formato nuevo por cuenta, o el viejo pagador → cliente)
  onPagadorMap, // callback(memoria) para que el Shell la persista
  abrirClientes = 0, // CLIENTES del header (19/11): cada vez que sube, abre el modal del cliente vacío
  // Lazarillo (14/11): guardado en el servidor. { fuentes, onFuente(tipo, filas, archivo),
  // cargarEstado(periodo) → Promise<estado|null>, guardarEstado(periodo, estado) }. Sin esto,
  // el módulo funciona igual que el prototipo (todo en memoria).
  persist = null,
}) {
  useBrandFonts();
  const [dataBase, setData] = React.useState(() => {
    const f = (persist && persist.fuentes) || {};
    return { ventas: f.ventas || null, pagos: f.pagos || null, banco: f.banco || null };
  });
  // Corte del día (17/11): los cobros de madrugada cuentan como del día anterior. Se recuerda por negocio.
  const corteKey = "lz-conc-corte:" + ((business && (business.id || business.name)) || "");
  const [corte, setCorteSt] = React.useState(() => { try { const v = localStorage.getItem(corteKey); return v == null ? CORTE_DEFAULT : (parseInt(v, 10) || 0); } catch (e) { return CORTE_DEFAULT; } });
  const setCorte = (v) => { setCorteSt(v); try { localStorage.setItem(corteKey, String(v)); } catch (e) { /* sin storage */ } };
  const data = React.useMemo(() => (dataBase.banco ? { ...dataBase, banco: aplicarCorte(dataBase.banco.filter((b) => !esInterno(b)), corte) } : dataBase), [dataBase, corte]);
  const [result, setResult] = React.useState(null);
  const [tol, setTol] = React.useState(0); // arranca en "mismo día"
  // Período y día elegidos (19/11, Diego: «la fecha a conciliar la debe recordar entre sesiones»).
  // Se recuerdan por negocio y sucursal en este navegador.
  const periodoKey0 = "lz-conc-periodo:" + ((business && (business.id || business.name)) || "");
  const periodoGuardado = React.useMemo(() => { try { return JSON.parse(localStorage.getItem(periodoKey0) || "null") || {}; } catch (e) { return {}; } }, []);
  const [desde, setDesde] = React.useState(periodoGuardado.desde || null);
  const [hasta, setHasta] = React.useState(periodoGuardado.hasta || null);
  const [mesActivo, setMesActivo] = React.useState(periodoGuardado.mes || null);
  const [filterV, setFilterV] = React.useState("all");
  const [subFilterV, setSubFilterV] = React.useState("all");
  const [difFiltro, setDifFiltro] = React.useState(null); // filtro de conciliaciones por signo de diferencia: null | 'mas' | 'menos'
  const editSnap = React.useRef(null); // snapshot para cancelar una edición (Editar → ×)
  const [tips, setTips] = React.useState({}); // propina marcada por movimiento de banco: { id: monto }
  const [facturasCC, setFacturasCC] = React.useState(() => (persist && persist.fuentes && persist.fuentes.facturas_cc) || []); // facturas a cuenta corriente (del 22), para el modal de cuenta
  const [cuentaModal, setCuentaModal] = React.useState(abrirClientes ? "" : null); // cliente del modal de cuenta corriente ("" = abierto sin cliente)
  React.useEffect(() => { if (abrirClientes) setCuentaModal(""); }, [abrirClientes]);
  // override de forma de pago por comprobante (errores de carga del cajero): "mp" | "efec".
  // Mueve la fila entre la conciliación (MercadoPago) y el grupo de efectivo.
  const [formaOverride, setFormaOverride] = React.useState({});
  const [formaEdit, setFormaEdit] = React.useState(null); // comprobante cuyo selector de forma está abierto
  const formaReal = (comp, def) => (comp && formaOverride[comp]) || def;
  const [efectivoOpen, setEfectivoOpen] = React.useState(new Set()); // días con el grupo de efectivo desplegado
  const [selEfec, setSelEfec] = React.useState(new Set()); // tickets de efectivo tildados (para conciliar)
  const [efecReclas, setEfecReclas] = React.useState(new Set()); // efectivo ya reclasificado (conciliado) → sale del grupo
  // ventas en EFECTIVO por día (no se concilian; se muestran agrupadas a la izquierda)
  const efectivoPorDia = React.useMemo(() => {
    const m = {};
    facturasCC.filter((f) => formaReal(f.comp, f.c) === "efec" && !efecReclas.has(f.id)).forEach((f) => { (m[f.fecha] = m[f.fecha] || { items: [], total: 0 }); m[f.fecha].items.push(f); m[f.fecha].total += f.total; });
    return m;
  }, [facturasCC, efecReclas, formaOverride]);
  const efecById = React.useMemo(() => { const m = {}; facturasCC.filter((f) => formaReal(f.comp, f.c) === "efec").forEach((f) => { m[f.id] = f; }); return m; }, [facturasCC, formaOverride]);
  const selEfecTotal = React.useMemo(() => [...selEfec].reduce((a, id) => a + (efecById[id] ? efecById[id].total : 0), 0), [selEfec, efecById]);
  const [ccOpen, setCcOpen] = React.useState(new Set()); // días con el grupo de cuenta corriente desplegado
  // cobranzas de cuenta corriente del día: se pueden tildar para conciliarlas a mano con su pago
  const [selCC, setSelCC] = React.useState(new Set()); // cobranzas CC tildadas
  const [ccConc, setCcConc] = React.useState(new Set()); // cobranzas CC ya conciliadas a mano
  const ccById = React.useMemo(() => { const m = {}; (data.pagos || []).forEach((p) => { m[p.id] = p; }); return m; }, [data.pagos]);
  // Cuenta corriente por DÍA DE VENTA: cada ticket vendido a cta. cte. queda en su día
  // hasta que su pago aparece en el banco. La guía es el 72 (qué ticket paga cada cobro):
  //  · impaga  → el ERP no tiene cobro de ese ticket
  //  · erp     → el ERP dice que se cobró, pero ese pago todavía no está en el banco
  //  · saldada → su(s) cobro(s) se conciliaron con el banco → sale de pendientes
  // Los cobros de tickets de otro período (no están en el 22 cargado) van en el día del cobro.
  const ccPorDia = React.useMemo(() => calcCcPorDia({ ccConc, data, facturasCC }), [data.pagos, facturasCC, ccConc]);
  const selCCTotal = React.useMemo(() => [...selCC].reduce((a, id) => a + (ccById[id] ? ccById[id].imp : 0), 0), [selCC, ccById]);
  // buscadores
  const [busqComp, setBusqComp] = React.useState(""); // comprobante / cliente
  const [busqPago, setBusqPago] = React.useState(""); // pago por importe (o pagador)
  // cobranzas de cuenta corriente (72) por día — control de avance diario, NO se concilian
  // ni se totalizan como pendientes; solo se muestran agrupadas para seguir el cobro.
  // DETECTOR de posible error de caja: efectivo cuyo importe coincide EXACTO con un
  // movimiento de banco pendiente del mismo día → probablemente esa operación entró por
  // banco pero se cargó como efectivo. (Probé sumar cercanía horaria pero las horas de MP
  // son de acreditación, no de la venta, así que sumaban ruido; el monto es la señal.)
  const efectivoSospechoso = React.useMemo(() => {
    const res = {};
    if (!result) return res;
    const banByDay = {};
    result.B.filter((b) => b.status === "pend").forEach((b) => { (banByDay[b.fecha] = banByDay[b.fecha] || []).push(b); });
    Object.keys(efectivoPorDia).forEach((dia) => {
      const banks = (banByDay[dia] || []).slice();
      efectivoPorDia[dia].items.forEach((f) => {
        const idx = banks.findIndex((b) => b.imp === f.total);
        if (idx >= 0) { res[f.id] = { banImp: banks[idx].imp, banHora: banks[idx].hora, banId: banks[idx].id, exacto: true }; banks.splice(idx, 1); }
      });
    });
    return res;
  }, [result, efectivoPorDia]);
  // arma la cuenta corriente de un cliente: sus facturas (débitos) + cobranzas (créditos)
  const cuentaDe = (cliente) => {
    const k = cliKey(cliente);
    const fact = facturasCC.filter((f) => cliKey(f.cli) === k).sort((a, b) => a.fecha.localeCompare(b.fecha));
    // quién pagó cada cobranza conciliada (el pagador del movimiento de banco)
    const pagadorDe = (id) => { if (!result) return ""; const v = result.V.find((x) => x.id === "cc-" + id); const bid = v && (v.matchedWith || [])[0]; const b = bid && result.B.find((x) => x.id === bid); return b ? (b.cliente || "") : ""; };
    const cob = (data.pagos || []).filter((v) => cliKey(v.cliente) === k)
      .map((v) => ({ fecha: v.fecha, imp: v.imp, medio: v.cobro || "MercadoPago", conc: ccConc.has(v.id), pagador: ccConc.has(v.id) ? pagadorDe(v.id) : "", paga: v.comp, pagaFecha: v.fechaFact })).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const facturado = fact.reduce((a, f) => a + f.total, 0);
    const contado = fact.filter((f) => f.c !== "cc").reduce((a, f) => a + f.total, 0); // pagas al momento (efec/MP)
    const cob72 = cob.reduce((a, c) => a + c.imp, 0);
    const cobrado = contado + cob72;
    const mp = memPag[k];
    const pagadores = mp ? Object.keys(mp.pags).map((pk) => ({ key: pk, ...mp.pags[pk] })).sort((a, b) => b.veces - a.veces || (b.ultimo || "").localeCompare(a.ultimo || "")) : [];
    // Ficha (19/11): lo que el POS trae del cliente en sus ventas (22) y cobranzas (72).
    const pagosCli = (data.pagos || []).filter((v) => cliKey(v.cliente) === k);
    const ventasCli = (data.ventas || []).filter((v) => cliKey(v.cliente) === k);
    const primero = (arr, f) => { for (let i = arr.length - 1; i >= 0; i--) { const x = f(arr[i]); if (x) return x; } return ""; };
    const codCli = primero(pagosCli, (v) => v.codCli && v.codCli !== "0" ? v.codCli : "");
    const tel = primero(pagosCli, (v) => v.tel);
    const cuit = primero(ventasCli, (v) => v.cuit && !/^0*$/.test(v.cuit) ? v.cuit : "");
    const sucursales = [...new Set(ventasCli.map((v) => v.sucursal).filter(Boolean))];
    return { cliente: cliente, fact, cob, facturado, contado, cob72, cobrado, saldo: facturado - cobrado, pagadores, codCli, tel, cuit, sucursales };
  };
  // el nombre es clickeable si el cliente tiene ventas en el 22 (todas tienen cliente)
  const clientesConCuenta = React.useMemo(() => { const s = new Set(); facturasCC.forEach((f) => { if (f.cli) s.add(cliKey(f.cli)); }); return s; }, [facturasCC]);
  const tieneCuenta = (cli) => cli && clientesConCuenta.has(cliKey(cli));
  // Lista para el buscador del modal (CLIENTES del header, 19/11): cada cliente con su saldo de cta cte.
  const listaClientes = React.useMemo(() => {
    const m = new Map();
    const de = (nom) => { const k = cliKey(nom); if (!k) return null; if (!m.has(k)) m.set(k, { key: k, nombre: nom, saldo: 0 }); return m.get(k); };
    facturasCC.forEach((f) => { const x = de(f.cli); if (x && f.c === "cc") x.saldo += f.total; });
    (data.pagos || []).forEach((v) => { const x = de(v.cliente); if (x) x.saldo -= v.imp; });
    return [...m.values()].sort((a, b) => (b.saldo > 0) - (a.saldo > 0) || a.nombre.localeCompare(b.nombre));
  }, [facturasCC, data.pagos]);
  // Cambiar la forma de pago de un comprobante (error de carga). Recoloca la fila sin
  // recalcular todo: a "efec" sale de la conciliación (y libera su banco si estaba
  // conciliada); a "mp" entra como ingreso pendiente a conciliar.
  function cambiarForma(row, nueva) {
    const comp = row.comp; if (!comp) { setFormaEdit(null); return; }
    const def = (row.c === "efec" || row.origen === "efec") ? "efec" : "mp";
    if (nueva === formaReal(comp, def)) { setFormaEdit(null); return; }
    setFormaOverride((o) => ({ ...o, [comp]: nueva }));
    setResult((res) => {
      if (!res) return res;
      let V = res.V, B = res.B;
      if (nueva === "efec") {
        const v = V.find((x) => x.comp === comp);
        if (v) {
          if (v.status === "ok" && (v.matchedWith || []).length) { const ids = new Set(v.matchedWith); B = B.map((b) => ids.has(b.id) ? { ...b, status: "pend", matchedWith: [], manual: false } : b); }
          V = V.filter((x) => x.comp !== comp);
        }
      } else if (nueva === "mp") {
        if (!V.some((x) => x.comp === comp)) {
          V = [...V, { id: "fv-" + comp, origen: "pos", status: "pend", matchedWith: [], fecha: row.fecha, imp: row.imp != null ? row.imp : row.total, cliente: row.cli || row.cliente || "", comp, hora: row.hora, cobro: "MERCADOPAGO", reclasForma: true }];
        }
      }
      return { V, B };
    });
    setFormaEdit(null);
    limpiarSeleccion();
  }
  // mapa aprendido pagador(banco) → cliente(CC): al conciliar una cobranza de cuenta
  // corriente con un movimiento de banco, guardamos qué pagador corresponde a qué cliente.
  // MEMORIA DE PAGADORES por cuenta corriente: cada vez que una cobranza de CC se
  // concilia (a mano, por sugerencia o automática) se graba quién la pagó, con cuántas
  // veces y la última fecha. La usan la conciliación automática y las sugerencias.
  const [memPag, setMemPag] = React.useState(() => memDesdeProp(pagadorMap));
  const memPagRef = React.useRef(memPag); memPagRef.current = memPag;
  const [ccNoAuto, setCcNoAuto] = React.useState(new Set()); // cobranzas que desarmaste: no se re-concilian solas
  const ccNoAutoRef = React.useRef(ccNoAuto); ccNoAutoRef.current = ccNoAuto;
  const conocePagador = (cli, pag) => { const c = memPagRef.current[cliKey(cli)]; return !!(c && pag && c.pags[cliKey(pag)]); };
  const grabarPagadores = (pares) => { if (pares && pares.length) setMemPag((m) => { const nm = memRegistrar(m, pares); if (onPagadorMap) onPagadorMap(nm); return nm; }); };
  const aprenderPagadores = (ingObjs, banObjs) => {
    const clis = (ingObjs || []).filter((v) => v.origen === "cc" && v.cliente);
    const pags = (banObjs || []).filter((b) => b && b.cliente && !/^cardholder[_ ]?name$/i.test(String(b.cliente).trim()));
    const pares = [];
    clis.forEach((v) => pags.forEach((b) => pares.push({ cli: v.cliente, pag: b.cliente, fecha: b.fecha, ref: refCob(v) + "@" + refBan(b) })));
    grabarPagadores(pares);
  };
  const olvidarCobranzas = (ccIdsSinPrefijo) => {
    const refs = ccIdsSinPrefijo.map((id) => ccById[id]).filter(Boolean).map(refCob);
    if (refs.length) setMemPag((m) => { const nm = memOlvidar(m, refs); if (nm !== m && onPagadorMap) onPagadorMap(nm); return nm; });
  };
  const quitarPagador = (cli, pagK) => setMemPag((m) => {
    const ck = cliKey(cli); if (!m[ck]) return m;
    const pags = { ...m[ck].pags }; delete pags[pagK];
    const nm = { ...m, [ck]: { ...m[ck], pags } }; if (onPagadorMap) onPagadorMap(nm); return nm;
  });
  const [tipEdit, setTipEdit] = React.useState(null); // id del movimiento con el editor de propina abierto
  // propina efectiva de un movimiento: lo marcado por el usuario, o el total si la
  // descripción es "tips", o 0. Nunca mayor al importe.
  const tipDe = (b) => { const t = tips[b.id] != null ? tips[b.id] : (b && b.tipDesc ? b.imp : 0); return Math.max(0, Math.min(t, b.imp)); };
  const [filterB, setFilterB] = React.useState("all");
  const [sortV, setSortV] = React.useState({ campo: "fecha", dir: 1 });
  const [sortB, setSortB] = React.useState({ campo: "fecha", dir: 1 });
  // multi-selección para conciliación manual sobre las 2 tablas
  const [selIng, setSelIng] = React.useState(new Set()); // ids de ingresos seleccionados
  const [selBan, setSelBan] = React.useState(new Set()); // ids de banco seleccionados
  const [modal, setModal] = React.useState(null); // {fuente} abierto
  const [instructivo, setInstructivo] = React.useState(null); // instructivo abierto
  // columnas visibles (arrancan con las fijas + tipoMedio en banco)
  const [colsB, setColsB] = React.useState(() => new Set(COLS_BANCO.filter((c) => c.fixed || c.key === "tipoMedio").map((c) => c.key)));
  const [colsV, setColsV] = React.useState(() => new Set(COLS_INGRESOS.filter((c) => c.fixed).map((c) => c.key)));
  // columnas extra que se muestran SOLO en la vista de pendientes (para identificar)
  const PEND_EXTRA_V = ["cobro", "mesa"];
  const PEND_EXTRA_B = ["medio"];
  const colsVeff = new Set([...colsV, ...PEND_EXTRA_V]); // base + extras (solo pendientes)
  const colsBeff = new Set([...colsB, ...PEND_EXTRA_B]);
  const [colMenu, setColMenu] = React.useState(null); // 'banco' | 'ingresos' | null
  // filtros por columna: { banco: {campo: Set(valores excluidos)}, ingresos: {...} }
  const [colFilterB, setColFilterB] = React.useState({});
  const [colFilterV, setColFilterV] = React.useState({});
  const [colFilterOpen, setColFilterOpen] = React.useState(null); // "banco:campo" | "ingresos:campo" | null
  // vista "por día" para pendientes: modo on/off + día centro (YYYY-MM-DD)
  const [dayView, setDayView] = React.useState(false);
  const [dayCenter, setDayCenter] = React.useState(periodoGuardado.dia || null);
  React.useEffect(() => {
    if (!desde || !hasta) return;
    try { localStorage.setItem(periodoKey0, JSON.stringify({ desde, hasta, mes: mesActivo, dia: dayCenter })); } catch (e) { /* sin storage */ }
  }, [desde, hasta, mesActivo, dayCenter]);
  const [expandedGroups, setExpandedGroups] = React.useState(new Set()); // grupos de importe expandidos en banco
  // ── Sugerencias de conciliación manual ──
  const [sugerir, setSugerir] = React.useState(true); // panel de sugerencias (activo por defecto en pendientes)
  const [margenTipo, setMargenTipo] = React.useState("pct"); // 'monto' | 'pct'
  const [margenVal, setMargenVal] = React.useState(10); // default 10% (escala con el monto); 0 = solo exactas
  const [setupOpen, setSetupOpen] = React.useState(false); // sector de fuentes+período: se minimiza cuando está todo cargado
  const [aprobOpen, setAprobOpen] = React.useState(true);   // panel de conciliados manuales (minimizar/maximizar)
  const [aprobExp, setAprobExp] = React.useState(new Set()); // conciliaciones manuales desplegadas (para ver las relaciones)
  const estadoFileRef = React.useRef(null); // input oculto para cargar estado guardado
  const [pendOpen, setPendOpen] = React.useState(true);     // panel de pendientes por mes (minimizar/maximizar)
  const [ctrlOpen, setCtrlOpen] = React.useState(false);    // panel de control: cobros por MP según el ERP sin pago en el banco
  const [mesesPend, setMesesPend] = React.useState(new Set()); // meses abiertos (compartido entre ambos lados)
  const [diasPend, setDiasPend] = React.useState(new Set()); // días abiertos en el panel de pendientes por mes
  const [limiteFilas, setLimiteFilas] = React.useState(150); // paginación de Todas/Conciliadas (evita renderizar miles de filas)
  const [ccListaOpen, setCcListaOpen] = React.useState(false); // grupo "Cuenta corriente" en Todas/Conciliadas (abre los dos lados)
  const [autoMargenVal, setAutoMargenVal] = React.useState(1); // margen de conciliación automática (default 1%); 0 = solo exactas
  const [autoMargenTipo, setAutoMargenTipo] = React.useState("pct"); // 'monto' | 'pct'
  const [sugActiva, setSugActiva] = React.useState(null); // índice de la sugerencia resaltada
  const [sugDescartadas, setSugDescartadas] = React.useState(new Set()); // keys de sugerencias descartadas
  // faltantes de conciliación manual: {id, fecha, monto, origenDesc, ingId}
  const [faltantes, setFaltantes] = React.useState([]);
  const [aprobadas, setAprobadas] = React.useState([]); // sugerencias aplicadas (para listar y deshacer)
  const [notas, setNotas] = React.useState({}); // observaciones por id de registro / grupo / conciliación
  const [notaEdit, setNotaEdit] = React.useState(null); // id de la nota que se está editando
  const [fileError, setFileError] = React.useState(null); // {fuente, columnas:[...], encontradas:[...]}

  // cerrar menús flotantes al hacer clic fuera (aplica y cierra)
  React.useEffect(() => {
    if (!colMenu && !colFilterOpen) return;
    const onDocClick = (e) => {
      const inMenu = e.target.closest && (e.target.closest("[data-colmenu]") || e.target.closest("[data-colfilter]"));
      if (!inMenu) { setColMenu(null); setColFilterOpen(null); }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [colMenu, colFilterOpen]);


  const xlsxReady = useSheetJS();

  // meses disponibles según los datos cargados
  const allDates = React.useMemo(() => {
    const src = [].concat(data.ventas || [], data.pagos || [], data.banco || []);
    return src.map((x) => x.fecha).filter(Boolean).sort();
  }, [data]);
  const months = React.useMemo(() => {
    const set = new Set(allDates.map((f) => f.slice(0, 7)));
    return [...set].sort();
  }, [allDates]);

  // al cargar datos, si no hay mes elegido, tomar el último
  React.useEffect(() => {
    if (months.length && !mesActivo && !desde) selectMonth(months[months.length - 1]); // si había un período recordado, se respeta
     
  }, [months.length]);

  function lastDayOfMonth(ym) { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); }
  function selectMonth(ym) {
    setMesActivo(ym);
    setDesde(ym + "-01");
    setHasta(ym + "-" + String(lastDayOfMonth(ym)).padStart(2, "0"));
  }
  function inRange(f) {
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  }

  // Lee la hoja como matriz de filas (header:1) para poder ubicar la fila real
  // de encabezados aunque el archivo traiga títulos/logo arriba.
  async function readSheetMatrix(file) {
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: "array" });
    return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  }
  // Busca en las primeras filas cuál es la de encabezados: la que contiene más
  // columnas requeridas. Devuelve {headerIdx, headers} o null si no la encuentra.
  function ubicarEncabezados(matrix, reqCols) {
    const wanted = (reqCols || []).flat().map((c) => c.trim().toUpperCase());
    let mejor = { idx: -1, hits: 0, headers: [] };
    const limite = Math.min(matrix.length, 15); // buscar en las primeras 15 filas
    for (let i = 0; i < limite; i++) {
      const celdas = (matrix[i] || []).map((c) => String(c).trim());
      const upper = celdas.map((c) => c.toUpperCase());
      const hits = wanted.filter((w) => upper.includes(w)).length;
      if (hits > mejor.hits) mejor = { idx: i, hits, headers: celdas };
    }
    return mejor.idx >= 0 ? { headerIdx: mejor.idx, headers: mejor.headers, hits: mejor.hits } : null;
  }
  // Convierte la matriz en objetos usando la fila de encabezados detectada.
  function matrixAObjetos(matrix, headerIdx, headers) {
    const out = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
      const fila = matrix[i] || [];
      if (fila.every((c) => c === "" || c == null)) continue; // saltar filas vacías
      const obj = {};
      headers.forEach((h, j) => { if (h) obj[h] = fila[j] !== undefined ? fila[j] : ""; });
      out.push(obj);
    }
    return out;
  }
  async function onFile(fuente, file) {
    if (!file) return;
    // esperar a que SheetJS esté disponible (por si el archivo se cargó antes)
    if (!window.XLSX) {
      await new Promise((res) => {
        const t = setInterval(() => { if (window.XLSX) { clearInterval(t); res(); } }, 100);
        setTimeout(() => { clearInterval(t); res(); }, 8000);
      });
    }
    if (!window.XLSX) return; // no cargó (sin conexión al CDN)
    const matrix = await readSheetMatrix(file);
    // ubicar la fila de encabezados (tolerante a títulos arriba)
    const ub = ubicarEncabezados(matrix, fuente.reqCols);
    const headers = ub ? ub.headers : (matrix[0] || []).map((c) => String(c).trim());
    // validar que estén las columnas imprescindibles
    if (fuente.reqCols) {
      const presentes = headers.map((k) => k.trim().toUpperCase());
      const faltan = fuente.reqCols.filter((alts) => !alts.some((a) => presentes.includes(a.toUpperCase())));
      if (faltan.length) {
        // ¿es un informe equivocado conocido? (trae las señales de otro informe)
        let pista = null;
        const ie = fuente.informeEquivocado;
        if (ie && ie.señales.every((s) => presentes.includes(s.toUpperCase()))) {
          pista = { correcto: ie.correcto, bajado: ie.bajado };
        }
        setFileError({
          fuente: fuente.titulo,
          columnas: faltan.map((alts) => alts[0]),
          encontradas: headers.filter((h) => h),
          pista,
        });
        setModal(null);
        return; // no cargar datos rotos
      }
    }
    const rows = matrixAObjetos(matrix, ub ? ub.headerIdx : 0, headers);
    const parsed = fuente.parser(rows);
    setData((d) => ({ ...d, [fuente.key]: parsed }));
    const factCC = fuente.key === "ventas" ? parseFacturasCC(rows) : null;
    if (factCC) setFacturasCC(factCC); // facturas a CC para el modal de cuenta
    // Lazarillo: queda guardado en el servidor para la próxima vez
    if (persist && persist.onFuente) {
      persist.onFuente(fuente.key, parsed, file.name);
      if (factCC) persist.onFuente("facturas_cc", factCC, file.name);
    }
    setModal(null);
  }

  // correr conciliación cuando cambian datos/período/tolerancia
  React.useEffect(() => {
    if (!(data.ventas && data.banco)) return;
    // Las cobranzas de cuenta corriente (72) NO van a la conciliación: son ventas a
    // crédito que no se cobran esa jornada, y su pago casi nunca aparece en el banco MP
    // (el cliente no figura como pagador). Solo alimentan la CC del cliente. Se concilia
    // solo el POS (MercadoPago). El 72 se sigue usando para la cuenta corriente.
    const ingresos = (data.ventas || []).filter((x) => inRange(x.fecha));
    const banco = (data.banco || []).filter((x) => inRange(x.fecha));
    // Orden: lo EXACTO primero (ventas y cuenta corriente), después lo aproximado.
    // Así un pago que es exacto para una cobranza no se lo lleva una venta "parecida".
    const exacto = conciliar(ingresos, banco, tol, 0, "pct");
    const autoCC = autoConciliarCC(exacto, (data.pagos || []).filter((x) => esMP(x) && inRange(x.fecha) && !ccNoAutoRef.current.has(x.id)), conocePagador);
    let res = autoCC.res;
    if (autoMargenVal > 0) {
      const pV = res.V.filter((v) => v.status === "pend" && !String(v.id).startsWith("cc-")), pB = res.B.filter((b) => b.status === "pend");
      const ap = conciliar(pV, pB, tol, autoMargenVal, autoMargenTipo);
      const mV = {}, mB = {}; ap.V.forEach((v) => { mV[v.id] = v; }); ap.B.forEach((b) => { mB[b.id] = b; });
      res = { V: res.V.map((v) => mV[v.id] || v), B: res.B.map((b) => mB[b.id] || b) };
    }
    setResult(res);
    grabarPagadores(autoCC.pares);
    setSelIng(new Set()); setSelBan(new Set()); setSelEfec(new Set()); setEfecReclas(new Set()); setSelCC(new Set()); setCcConc(new Set(autoCC.ccIds));
    setParV(new Set()); setParB(new Set());
    setFaltantes([]);
    setAprobadas([]);
    editSnap.current = null;
    setTips({}); setTipEdit(null);
     
  }, [data, tol, desde, hasta, autoMargenVal, autoMargenTipo]);

  const puedeConciliar = data.ventas && data.banco;

  // al cargar datos por primera vez, arrancar en Pendientes (vista por día)
  const arranco = React.useRef(false);
  React.useEffect(() => {
    if (puedeConciliar && !arranco.current) {
      arranco.current = true;
      setFilterV("pend"); setFilterB("pend"); setSubFilterV("all"); setDayView(true); setSugerir(true);
    }
  }, [puedeConciliar]);


  // Navegación de tabs espejada: cambiar de tab en un lado cambia ambos.
  const goTab = (f) => { editSnap.current = null; setFilterV(f); setFilterB(f); setSubFilterV("all"); setDifFiltro(null); setDayView(f === "pend"); setParV(new Set()); setParB(new Set()); setLimiteFilas(150); if (f === "pend") setSugerir(true); };
  // Tab "activo" mostrado: si hay un tipo de subfiltro elegido → Conciliadas;
  // Todas solo cuando el subfiltro es "Todos". Pendientes manda siempre.
  const activeTab = filterV === "pend" ? "pend" : (subFilterV !== "all" ? "ok" : filterV);
  // al elegir el subfiltro "grupo cliente", ordenar por cliente por default
  const onSubFiltro = (v) => { setSubFilterV(v); setDifFiltro(null); setLimiteFilas(150); if (v === "cliente") setSortV({ campo: "cliente", dir: 1 }); };
  // filtrar conciliaciones por signo de diferencia (a favor / en contra) desde la barra
  const filtrarPorDif = (sign) => {
    setFilterV("ok"); setFilterB("ok"); setSubFilterV("all"); setDayView(false); setLimiteFilas(150);
    setParV(new Set()); setParB(new Set());
    setDifFiltro((cur) => (cur === sign ? null : sign));
  };
  // desarmar una conciliación resaltada: manda sus registros a pendientes
  // cobranzas CC / efectivo reclasificado dentro de un cluster: al desarmar vuelven a su grupo
  const sacarExtras = (ids) => {
    const ef = ids.filter((id) => id.startsWith("ef-")).map((id) => id.slice(3));
    const cc = ids.filter((id) => id.startsWith("cc-")).map((id) => id.slice(3));
    if (ef.length) setEfecReclas((s) => { const n = new Set(s); ef.forEach((id) => n.delete(id)); return n; });
    if (cc.length) { setCcConc((s) => { const n = new Set(s); cc.forEach((id) => n.delete(id)); return n; }); olvidarCobranzas(cc); setCcNoAuto((s) => { const n = new Set(s); cc.forEach((id) => n.add(id)); return n; }); }
    return { ef, cc };
  };
  const desarmarCluster = () => {
    if (!result || (parV.size === 0 && parB.size === 0)) return;
    const extra = [...parV].filter((id) => id.startsWith("ef-") || id.startsWith("cc-"));
    sacarExtras(extra);
    const V = result.V.filter((v) => !extra.includes(v.id)).map((v) => parV.has(v.id) ? { ...v, status: "pend", desarmado: true, matchedWith: [], matchTipo: null, manual: false, manualDif: undefined, autoDif: undefined, porHora: false, serieNota: undefined, serieMult: undefined } : v);
    const B = result.B.map((b) => parB.has(b.id) ? { ...b, status: "pend", desarmado: true, matchedWith: null, matchTipo: null, porHora: false, serieNota: undefined, serieMult: undefined } : b);
    setResult({ V, B });
    setParV(new Set()); setParB(new Set());
  };
  // editar una conciliación: la desarma, deja sus registros SELECCIONADOS y te lleva
  // a Pendientes de ese día para destildar/agregar y volver a conciliar.
  const editarCluster = () => {
    if (!result || (parV.size === 0 && parB.size === 0)) return;
    editSnap.current = result; // snapshot para poder cancelar la edición
    const anchor = result.V.find((v) => parV.has(v.id)) || result.B.find((b) => parB.has(b.id));
    const fecha = anchor ? anchor.fecha : dayCenter;
    const extra = [...parV].filter((id) => id.startsWith("ef-") || id.startsWith("cc-"));
    const ex = sacarExtras(extra);
    if (ex.ef.length) setSelEfec(new Set(ex.ef));
    if (ex.cc.length) { setSelCC(new Set(ex.cc)); if (fecha) setCcOpen((s) => new Set(s).add(fecha)); }
    const V = result.V.filter((v) => !extra.includes(v.id)).map((v) => parV.has(v.id) ? { ...v, status: "pend", desarmado: true, matchedWith: [], matchTipo: null, manual: false, manualDif: undefined, autoDif: undefined, porHora: false, serieNota: undefined, serieMult: undefined } : v);
    const B = result.B.map((b) => parB.has(b.id) ? { ...b, status: "pend", desarmado: true, matchedWith: null, matchTipo: null, porHora: false, serieNota: undefined, serieMult: undefined } : b);
    setResult({ V, B });
    setSelIng(new Set([...parV].filter((id) => !extra.includes(id)))); setSelBan(new Set([...parB]));
    setParV(new Set()); setParB(new Set());
    setFilterV("pend"); setFilterB("pend"); setSubFilterV("all"); setDifFiltro(null); setDayView(true);
    if (fecha) setDayCenter(fecha);
  };

  // ── cálculos de vista ──
  // signo de la diferencia por CLUSTER (de más = banco > ingreso), para poder
  // filtrar las conciliaciones a favor / en contra. Union-find sobre ids conciliados.
  const difSigno = React.useMemo(() => calcDifSigno({ result, tipDe }), [result, tips]);

  // propinas: total del período y por día (movimientos con propina marcada / detectada)
  const tipsInfo = React.useMemo(() => {
    if (!result) return { total: 0, porDia: {} };
    let total = 0; const porDia = {};
    result.B.forEach((b) => { const t = tipDe(b); if (t > 0) { total += t; porDia[b.fecha] = (porDia[b.fecha] || 0) + t; } });
    return { total, porDia };
  }, [result, tips]);

  const viewBase = React.useMemo(() => calcView({ colFilterB, colFilterV, difFiltro, difSigno, filterB, filterV, margenTipo, margenVal, result, sortB, sortV, subFilterV }), [result, filterV, subFilterV, filterB, sortV, sortB, colFilterV, colFilterB, margenTipo, margenVal, difFiltro, difSigno]);
  // Todas / Conciliadas filtradas a un día desde la tira del mes (19/11, Diego: «la vista de conciliadas
  // saca la fecha, no debería»). En Pendientes manda el día en foco, no este filtro.
  const [diaFiltro, setDiaFiltro] = React.useState(null);
  React.useEffect(() => { setDiaFiltro(null); }, [desde, hasta]);
  const view = React.useMemo(() => {
    if (!viewBase || dayView || !diaFiltro) return viewBase;
    return { ...viewBase, fV: viewBase.fV.filter((v) => v.fecha === diaFiltro), fB: viewBase.fB.filter((b) => b.fecha === diaFiltro) };
  }, [viewBase, dayView, diaFiltro]);
  // Cambiar el período desde la barra del día: ‹ mes › o un rango elegido.
  const cambiarMes = (ym) => selectMonth(ym);
  const cambiarPeriodo = (d, h) => { setMesActivo(null); setDesde(d); setHasta(h); };

  // conteos del día en foco (dayCenter): los KPIs/headers muestran el día que estás
  // trabajando, no todo el período. Aplica en cualquier pestaña mientras haya día en foco.
  const diaCounts = React.useMemo(() => {
    if (!result || !dayCenter) return null;
    return {
      v: result.V.filter((v) => v.status === "pend" && v.fecha === dayCenter).length,
      b: result.B.filter((b) => b.status === "pend" && b.fecha === dayCenter).length,
    };
  }, [result, dayCenter]);

  const kpis = React.useMemo(() => {
    if (!result) return null;
    const { V, B } = result;
    const ok = V.filter((v) => v.status === "ok").length;
    const uno = V.filter((v) => v.status === "ok" && (v.matchedWith || []).length === 1).length;
    const varios = V.filter((v) => v.status === "ok" && (v.matchedWith || []).length > 1).length;
    return { ok, uno, varios, deMas: difSigno.deMas, deMenos: difSigno.deMenos, pendV: V.filter((v) => v.status === "pend").length, pendB: B.filter((b) => b.status === "pend").length };
  }, [result, difSigno]);

  // días que tienen algún pendiente (en cualquiera de las dos tablas), ordenados
  const pendingDays = React.useMemo(() => {
    if (!result) return [];
    const set = new Set();
    result.V.forEach((v) => { if (v.status === "pend") set.add(v.fecha); });
    result.B.forEach((b) => { if (b.status === "pend") set.add(b.fecha); });
    return [...set].sort();
  }, [result]);

  // cuando la memoria de pagadores aprende algo, revisar en el momento si hay otras
  // cobranzas de CC que ya se pueden cerrar solas (exacto + mismo día + pagador conocido)
  React.useEffect(() => {
    if (!result || editSnap.current) return;
    const pend = (data.pagos || []).filter((x) => esMP(x) && inRange(x.fecha) && !ccConc.has(x.id) && !ccNoAutoRef.current.has(x.id));
    if (!pend.length) return;
    const r = autoConciliarCC(result, pend, conocePagador);
    if (!r.ccIds.length) return;
    setResult(r.res);
    setCcConc((s) => { const n = new Set(s); r.ccIds.forEach((id) => n.add(id)); return n; });
    grabarPagadores(r.pares);
     
  }, [memPag]);

  // Todas / Conciliadas: las cobranzas de cuenta corriente y los pagos de banco que
  // las cubren van en un grupo aparte (igual que en Pendientes), no mezclados.
  const ccSplit = React.useMemo(() => {
    if (!view || !result) return null;
    const banCC = new Set(), banOtros = new Set();
    result.V.forEach((v) => { if (v.status !== "ok") return; (v.matchedWith || []).forEach((id) => (v.origen === "cc" ? banCC : banOtros).add(id)); });
    const esBanCC = (b) => b.status === "ok" && banCC.has(b.id) && !banOtros.has(b.id);
    const ingCC = view.fV.filter((v) => v.origen === "cc"), banCCr = view.fB.filter(esBanCC);
    return {
      ingCC, ingOtros: view.fV.filter((v) => v.origen !== "cc"),
      banCC: banCCr, banOtros: view.fB.filter((b) => !esBanCC(b)),
      totIng: ingCC.reduce((a, v) => a + v.imp, 0), totBan: banCCr.reduce((a, b) => a + b.imp, 0),
    };
  }, [view, result]);

  // pendientes por día (ingresos + banco), para marcar el calendario
  const pendPorDia = React.useMemo(() => {
    const m = {};
    if (!result) return m;
    result.V.forEach((v) => { if (v.status === "pend") m[v.fecha] = (m[v.fecha] || 0) + 1; });
    result.B.forEach((b) => { if (b.status === "pend") m[b.fecha] = (m[b.fecha] || 0) + 1; });
    return m;
  }, [result]);

  // fijar el día en foco en el primer día con pendientes apenas hay datos
  // (no solo al entrar a la vista por día), para que barra y KPIs muestren el día
  React.useEffect(() => {
    if (pendingDays.length && (!dayCenter || (desde && dayCenter < desde) || (hasta && dayCenter > hasta))) {
      setDayCenter(pendingDays[0]);
    }
     
  }, [pendingDays.length, desde, hasta]);

  // navegar día centro (± dentro de los días con pendientes)
  function moveDay(dir) {
    if (!pendingDays.length) return;
    // salta al día con pendientes más cercano (funciona aunque el día elegido no tenga)
    const cand = dir > 0 ? pendingDays.filter((d) => d > dayCenter) : pendingDays.filter((d) => d < dayCenter);
    if (!cand.length) return;
    setDayCenter(dir > 0 ? cand[0] : cand[cand.length - 1]);
  }
  // elegir un día desde el calendario
  function elegirDia(iso) {
    if (!iso) return;
    if (!(dayView && filterV === "pend")) goTab("pend");
    setDayCenter(iso);
  }
  // ventana de fechas visible según tolerancia (centro ± tol)
  function dayWindow() {
    if (!dayCenter) return [];
    const days = [];
    for (let d = -tol; d <= tol; d++) {
      const dt = new Date(dayCenter + "T12:00:00");
      dt.setDate(dt.getDate() + d);
      days.push(dt.toISOString().slice(0, 10));
    }
    return days;
  }
  // ── Motor de sugerencias de conciliación manual ──
  // Para el día centro, busca pares probables: 1 ingreso ↔ 1+ movimientos de banco
  // (o al revés) cuya diferencia esté dentro del margen configurado.
  const autoAvanzar = React.useRef(false); // al aceptar la última sugerencia del día, pasar al siguiente
  const sugerencias = React.useMemo(() => calcSugerencias({ ccConc, conocePagador, data, dayCenter, dayWindow, margenTipo, margenVal, result, sugDescartadas, sugerir, tipDe }), [sugerir, result, dayCenter, tol, margenTipo, margenVal, sugDescartadas, tips, memPag, data.pagos, ccConc]);

  // auto-avance: si acabás de aceptar una sugerencia y el día se quedó sin más
  // sugerencias, pasar automáticamente al día pendiente siguiente.
  React.useEffect(() => {
    if (!autoAvanzar.current) return;
    autoAvanzar.current = false;
    if (sugerir && dayView && filterV === "pend" && sugerencias.length === 0) {
      const siguiente = pendingDays.filter((d) => d > dayCenter).sort()[0];
      if (siguiente) setDayCenter(siguiente);
    }
  }, [sugerencias]);

  // aplicar una sugerencia = conciliar ese par como manual
  function aplicarSugerencia(s) {
    if (!result) return;
    const ccIds = s.ingIds.filter((id) => id.startsWith("cc-"));
    const ccObjs = ccIds.map((id) => ccById[id.slice(3)]).filter(Boolean);
    const ccComoIng = ccObjs.map((p) => ({ id: "cc-" + p.id, origen: "cc", status: "ok", cliente: p.cliente, comp: p.comp, imp: p.imp, fecha: p.fecha, hora: p.hora, cobro: p.cobro, matchedWith: s.banIds, manual: true, matchTipo: "manual", manualDif: s.dif, ccCobranza: p.id }));
    const V = [...result.V.map((v) => s.ingIds.includes(v.id)
      ? { ...v, status: "ok", matchedWith: s.banIds, manual: true, matchTipo: "manual", manualDif: s.dif } : v), ...ccComoIng];
    if (ccObjs.length) setCcConc((st) => { const n = new Set(st); ccObjs.forEach((x) => n.add(x.id)); return n; });
    const B = result.B.map((b) => s.banIds.includes(b.id)
      ? { ...b, status: "ok", matchedWith: s.ingIds[0] || null, manual: true, manualDif: s.dif } : b);
    setResult({ V, B });
    aprenderPagadores([...result.V.filter((v) => s.ingIds.includes(v.id)), ...ccComoIng], result.B.filter((b) => s.banIds.includes(b.id)));
    // registrar la aprobada para listarla bajo su día y poder deshacerla
    const dia = (result.V.find((v) => v.id === s.ingIds[0]) || ccComoIng[0] || result.B.find((b) => b.id === s.banIds[0]) || {}).fecha || dayCenter;
    setAprobadas((prev) => [...prev, { key: s.key, ingIds: s.ingIds, banIds: s.banIds, dia, ingTotal: s.ingTotal, banTotal: s.banTotal, dif: s.dif }]);
    autoAvanzar.current = true; // si el día queda sin sugerencias, pasa al siguiente
    setSelIng(new Set()); setSelBan(new Set()); setSelCC(new Set()); // limpiar la marca de selección
    setSugActiva(null);
  }
  // deshacer una sugerencia aprobada: vuelve el par a pendiente
  function deshacerAprobada(ap) {
    if (!result) return;
    // efectivo reclasificado / cobranzas CC: no vuelven como pendientes, vuelven a su grupo
    const extra = ap.ingIds.filter((id) => id.startsWith("ef-") || id.startsWith("cc-"));
    const V = result.V.filter((v) => !extra.includes(v.id)).map((v) => ap.ingIds.includes(v.id)
      ? { ...v, status: "pend", desarmado: true, matchedWith: [], manual: false, matchTipo: undefined, manualDif: undefined } : v);
    const efX = extra.filter((id) => id.startsWith("ef-")).map((id) => id.slice(3));
    const ccX = extra.filter((id) => id.startsWith("cc-")).map((id) => id.slice(3));
    if (efX.length) setEfecReclas((s) => { const n = new Set(s); efX.forEach((id) => n.delete(id)); return n; });
    if (ccX.length) { setCcConc((s) => { const n = new Set(s); ccX.forEach((id) => n.delete(id)); return n; }); olvidarCobranzas(ccX); setCcNoAuto((s) => { const n = new Set(s); ccX.forEach((id) => n.add(id)); return n; }); }
    const B = result.B.map((b) => ap.banIds.includes(b.id)
      ? { ...b, status: "pend", desarmado: true, matchedWith: [], manual: false, matchTipo: undefined, manualDif: undefined } : b);
    setResult({ V, B });
    setAprobadas((prev) => prev.filter((a) => a.key !== ap.key));
  }
  function descartarSugerencia(s) { setSugDescartadas((set) => new Set(set).add(s.key)); setSugActiva(null); }
  // seleccionar una sugerencia: fija el resaltado y scrollea las DOS columnas al par
  function verSugerencia(i) {
    const s = sugerencias[i];
    if (sugActiva === i) { setSugActiva(null); setSelIng(new Set()); setSelBan(new Set()); setSelCC(new Set()); return; }
    setSugActiva(i);
    if (s) {
      // marcar los registros como seleccionados (celeste + tilde), igual que a mano
      const cc = s.ingIds.filter((id) => id.startsWith("cc-"));
      setSelIng(new Set(s.ingIds.filter((id) => !id.startsWith("cc-"))));
      setSelCC(new Set(cc.map((id) => id.slice(3))));
      if (cc.length) { const f = (ccById[cc[0].slice(3)] || {}).fecha; if (f) setCcOpen((st) => new Set(st).add(f)); }
      setSelBan(new Set(s.banIds));
      if (s.ingIds[0]) scrollTo(rowsVref, s.ingIds[0]);
      if (s.banIds[0]) scrollTo(rowsBref, s.banIds[0]);
    }
  }
  // ids resaltados por la sugerencia activa (para pintar en las tablas)
  const sugResaltados = React.useMemo(() => {
    if (sugActiva === null || !sugerencias[sugActiva]) return { ing: new Set(), ban: new Set() };
    const s = sugerencias[sugActiva];
    return { ing: new Set(s.ingIds), ban: new Set(s.banIds) };
  }, [sugActiva, sugerencias]);

  // totales de la barra: en Pendientes barriendo día a día → lo del DÍA en foco
  // (con referencia al total del período); en Todas/Conciliadas → lo PENDIENTE del período.
  const barTotals = React.useMemo(() => calcBarTotals({ dayCenter, dayView, faltantes, filterV, result }), [result, dayView, filterV, dayCenter, faltantes]);

  // pendientes agrupados por mes, para el panel de abajo (izq: comprobantes, der: pagos)
  const pendPorMes = React.useMemo(() => {
    const group = (rows) => {
      const m = {};
      (rows || []).filter((r) => r.status === "pend").forEach((r) => { const k = (r.fecha || "").slice(0, 7); (m[k] = m[k] || []).push(r); });
      return Object.keys(m).sort().map((k) => ({ mes: k, items: m[k], total: m[k].reduce((a, r) => a + r.imp, 0) }));
    };
    if (!result) return { ing: [], ban: [] };
    return { ing: group(result.V), ban: group(result.B) };
  }, [result]);

  // estructura unificada mes → día → {comprobantes, pagos}, para que la banda del día
  // sea una sola a lo ancho y al desplegar abra los dos lados a la vez
  const pendUnif = React.useMemo(() => {
    if (!result) return [];
    const M = {};
    const add = (r, side) => {
      if (r.status !== "pend" || !r.fecha) return;
      const mes = r.fecha.slice(0, 7);
      M[mes] = M[mes] || { mes, dias: {}, totIng: 0, totBan: 0 };
      const D = (M[mes].dias[r.fecha] = M[mes].dias[r.fecha] || { dia: r.fecha, ing: [], ban: [], totIng: 0, totBan: 0 });
      D[side].push(r); D[side === "ing" ? "totIng" : "totBan"] += r.imp;
      M[mes][side === "ing" ? "totIng" : "totBan"] += r.imp;
    };
    result.V.forEach((v) => add(v, "ing"));
    result.B.forEach((b) => add(b, "ban"));
    return Object.keys(M).sort().map((m) => ({ ...M[m], dias: Object.keys(M[m].dias).sort().map((d) => M[m].dias[d]) }));
  }, [result]);
  // los meses del panel de pendientes arrancan ABIERTOS
  React.useEffect(() => { if (pendUnif.length) setMesesPend(new Set(pendUnif.map((m) => m.mes))); }, [pendUnif.length]);
  // el panel "Pendientes por mes" sigue al día en foco: abre ese día y el siguiente (con
  // pendientes) y se actualiza a medida que navegás día a día.
  React.useEffect(() => {
    if (!dayCenter || !pendUnif.length) return;
    const allDays = pendUnif.flatMap((m) => m.dias.map((d) => d.dia)).sort();
    const next = allDays.filter((d) => d > dayCenter)[0];
    const set = new Set([dayCenter]);
    if (next) set.add(next);
    setDiasPend(set);
  }, [dayCenter, pendUnif]);

  // ── Selección múltiple para conciliación manual ──
  // totales y objetos de lo seleccionado en cada lado
  const selIngTotal = React.useMemo(() => {
    if (!result) return 0;
    return result.V.filter((v) => selIng.has(v.id)).reduce((a, v) => a + v.imp, 0) + selEfecTotal + selCCTotal;
  }, [result, selIng, selEfecTotal, selCCTotal]);
  const selBanTotal = React.useMemo(() => {
    if (!result) return 0;
    return result.B.filter((b) => selBan.has(b.id)).reduce((a, b) => a + (b.imp - tipDe(b)), 0);
  }, [result, selBan, tips]);
  const haySeleccion = selIng.size > 0 || selBan.size > 0 || selEfec.size > 0 || selCC.size > 0;

  // refs para auto-scroll
  const rowsVref = React.useRef(null);
  const rowsBref = React.useRef(null);
  function scrollTo(containerRef, rowId) {
    const cont = containerRef.current;
    if (!cont || !rowId) return;
    const el = cont.querySelector('[data-rowid="' + rowId + '"]');
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  // resaltado cruzado en vistas de conciliados: al tocar un registro, marcar su par
  const [parV, setParV] = React.useState(new Set()); // ids de ingreso resaltados
  const [parB, setParB] = React.useState(new Set()); // ids de banco resaltados (su par)
  // si resaltás algo que está dentro del grupo, se abre solo
  React.useEffect(() => {
    if (!ccSplit) return;
    if (ccSplit.ingCC.some((v) => parV.has(v.id)) || ccSplit.banCC.some((b) => parB.has(b.id))) setCcListaOpen(true);
  }, [parV, parB]);
  // dado un registro conciliado, devuelve el CLUSTER completo (todos los ingresos
  // y todos los movimientos de banco conectados), sin importar la dirección del match.
  function clusterOf(rec, side) {
    if (!result) return { ingIds: [], banIds: [] };
    const { V } = result;
    const banIds = new Set(side === "ban" ? [rec.id] : (rec.matchedWith || []));
    const ingIds = new Set();
    // expandir hasta cubrir todo el componente conectado
    for (let pasada = 0; pasada < 3; pasada++) {
      V.forEach((v) => {
        if (v.status !== "ok") return;
        if ((v.matchedWith || []).some((id) => banIds.has(id))) {
          ingIds.add(v.id);
          (v.matchedWith || []).forEach((id) => banIds.add(id));
        }
      });
    }
    return { ingIds: [...ingIds], banIds: [...banIds] };
  }
  // tocar un INGRESO conciliado → resaltar todo el cluster y scrollear al banco
  function verParDeIngreso(v) {
    if (v.status !== "ok") return;
    const { ingIds, banIds } = clusterOf(v, "ing");
    setParV(new Set(ingIds)); setParB(new Set(banIds));
    if (banIds[0]) scrollTo(rowsBref, banIds[0]);
  }
  // tocar un MOVIMIENTO de banco conciliado → resaltar todo el cluster y scrollear al ingreso
  function verParDeBanco(b) {
    if (b.status !== "ok" || !b.matchedWith) return;
    const { ingIds, banIds } = clusterOf(b, "ban");
    setParV(new Set(ingIds)); setParB(new Set(banIds));
    if (ingIds[0]) scrollTo(rowsVref, ingIds[0]);
  }
  // ── Buscadores ──
  // comprobante / cliente: busca en ventas (pendientes y conciliadas), efectivo y cobranzas de CC
  const resComp = React.useMemo(() => calcResComp({ busqComp, ccConc, data, efecById, efecReclas, result }), [busqComp, result, efecById, efecReclas, data.pagos, ccConc]);
  // pago por importe (exacto primero, después los más cercanos ±1%); con texto busca por pagador
  const resPago = React.useMemo(() => {
    const q = busqPago.trim();
    if (!q || !result) return [];
    const mk = (b) => ({ tipo: "ban", row: b, fecha: b.fecha, hora: b.hora, nombre: b.cliente || b.medio || "", comp: "", imp: b.imp, estado: b.status === "ok" ? "ok" : "pend", forma: b.medio || "" });
    const qn = parseInt(q.replace(/,\d{1,2}$/, "").replace(/[^\d]/g, ""), 10);
    if (!qn || /[a-zA-Z]/.test(q)) {
      const ql = q.toLowerCase(); if (ql.length < 2) return [];
      return result.B.filter((b) => (b.cliente || "").toLowerCase().includes(ql)).slice(0, 40).map(mk);
    }
    const tolI = Math.max(1, Math.round(qn * 0.01));
    return result.B.filter((b) => Math.abs(b.imp - qn) <= tolI || (String(qn).length >= 4 && String(b.imp).includes(String(qn))))
      .sort((a, b) => Math.abs(a.imp - qn) - Math.abs(b.imp - qn) || a.fecha.localeCompare(b.fecha)).slice(0, 40).map(mk);
  }, [busqPago, result]);
  // ir a un resultado: los pendientes quedan TILDADOS en su día (listos para conciliar);
  // los conciliados se muestran resaltados con su par en Conciliadas.
  function irAResultado(r) {
    if (!r) return;
    if (r.tipo === "ban") setBusqPago(""); else setBusqComp("");
    if (r.tipo === "efec") {
      if (!(dayView && filterV === "pend")) goTab("pend");
      setDayCenter(r.fecha); setEfectivoOpen((s) => new Set(s).add(r.fecha)); setSelEfec((s) => new Set(s).add(r.row.id));
    } else if (r.tipo === "cc") {
      if (!(dayView && filterV === "pend")) goTab("pend");
      setDayCenter(r.fecha); setCcOpen((s) => new Set(s).add(r.fecha)); setSelCC((s) => new Set(s).add(r.row.id));
    } else if (r.row.status === "pend") {
      if (!(dayView && filterV === "pend")) goTab("pend");
      setDayCenter(r.fecha);
      if (r.tipo === "ing") setSelIng((s) => new Set(s).add(r.row.id)); else setSelBan((s) => new Set(s).add(r.row.id));
      setTimeout(() => scrollTo(r.tipo === "ing" ? rowsVref : rowsBref, r.row.id), 150);
    } else {
      goTab("ok"); setLimiteFilas(100000);
      setTimeout(() => {
        if (r.tipo === "ing") { verParDeIngreso(r.row); scrollTo(rowsVref, r.row.id); }
        else { verParDeBanco(r.row); scrollTo(rowsBref, r.row.id); }
        setTimeout(() => scrollTo(r.tipo === "ing" ? rowsVref : rowsBref, r.row.id), 120); // por si se abrió el grupo de cta. cte.
      }, 150);
    }
  }

  // totales del cluster resaltado en Conciliadas (al tocar un registro conciliado)
  const hlIngTotal = React.useMemo(() => {
    if (!result) return 0;
    return result.V.filter((v) => parV.has(v.id)).reduce((a, v) => a + v.imp, 0);
  }, [result, parV]);
  const hlBanTotal = React.useMemo(() => {
    if (!result) return 0;
    return result.B.filter((b) => parB.has(b.id)).reduce((a, b) => a + b.imp, 0);
  }, [result, parB]);
  const hayHighlight = filterV !== "pend" && (parV.size > 0 || parB.size > 0);

  // toggles de selección (multi, ambos lados)
  function toggleIng(id) { setSelIng((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleBan(id) { setSelBan((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  // seleccionar/deseleccionar un grupo entero de banco (todos sus ids)
  function toggleBanGroup(ids) {
    setSelBan((s) => {
      const n = new Set(s);
      const todosSel = ids.every((id) => n.has(id));
      ids.forEach((id) => todosSel ? n.delete(id) : n.add(id));
      return n;
    });
  }
  function limpiarSeleccion() {
    setSelIng(new Set()); setSelBan(new Set()); setSelEfec(new Set()); setSelCC(new Set());
    if (editSnap.current) { // estábamos editando y se canceló → restaurar y volver a Conciliadas
      setResult(editSnap.current);
      // re-sincronizar los grupos (CC / efectivo) con lo que vuelve a estar conciliado
      setCcConc(new Set(editSnap.current.V.filter((v) => v.status === "ok" && String(v.id).startsWith("cc-")).map((v) => v.id.slice(3))));
      setEfecReclas(new Set(editSnap.current.V.filter((v) => v.status === "ok" && String(v.id).startsWith("ef-")).map((v) => v.id.slice(3))));
      { const snap = editSnap.current; const pares = [];
        snap.V.filter((v) => v.status === "ok" && String(v.id).startsWith("cc-")).forEach((v) => (v.matchedWith || []).forEach((bid) => { const b = snap.B.find((x) => x.id === bid); if (b && b.cliente) pares.push({ cli: v.cliente, pag: b.cliente, fecha: b.fecha, ref: refCob(v) + "@" + refBan(b) }); }));
        grabarPagadores(pares); }
      editSnap.current = null;
      setFilterV("ok"); setFilterB("ok"); setSubFilterV("all"); setDayView(false);
    }
  }

  // conciliar lo seleccionado (se permite aunque no coincidan los totales)
  function conciliarManual() {
    if (!result || (selIng.size === 0 && selBan.size === 0 && selEfec.size === 0 && selCC.size === 0)) return;
    const ingIds = [...selIng], banIds = [...selBan];
    // el efectivo tildado se reclasifica: se convierte en ingreso conciliado y sale del grupo de efectivo
    const efecObjs = [...selEfec].map((id) => efecById[id]).filter(Boolean);
    const efecComoIng = efecObjs.map((f) => ({ id: "ef-" + f.id, origen: "efec", status: "ok", cliente: f.cli, comp: f.comp, imp: f.total, fecha: f.fecha, hora: f.hora, matchedWith: banIds, manual: true, matchTipo: "efectivo reclasificado", reclasEfec: true }));
    // las cobranzas de cuenta corriente tildadas se concilian contra su pago y quedan marcadas en su grupo
    const ccObjs = [...selCC].map((id) => ccById[id]).filter(Boolean);
    const ccComoIng = ccObjs.map((p) => ({ id: "cc-" + p.id, origen: "cc", status: "ok", cliente: p.cliente, comp: p.comp, imp: p.imp, fecha: p.fecha, hora: p.hora, cobro: p.cobro, matchedWith: banIds, manual: true, matchTipo: "manual", ccCobranza: p.id }));
    const ingObjs = [...result.V.filter((v) => selIng.has(v.id)), ...efecComoIng, ...ccComoIng];
    const totIng = ingObjs.reduce((a, v) => a + v.imp, 0);
    const totBan = result.B.filter((b) => selBan.has(b.id)).reduce((a, b) => a + (b.imp - tipDe(b)), 0);
    const diferencia = totIng - totBan; // + = falta que entre al banco (sin acreditar)
    const allIngIds = [...ingIds, ...efecComoIng.map((v) => v.id), ...ccComoIng.map((v) => v.id)];
    const V = [...result.V.map((v) => selIng.has(v.id)
      ? { ...v, status: "ok", matchedWith: banIds, manual: true, matchTipo: "manual", manualDif: diferencia } : v),
      ...efecComoIng.map((v) => ({ ...v, manualDif: diferencia })), ...ccComoIng.map((v) => ({ ...v, manualDif: diferencia }))];
    const B = result.B.map((b) => selBan.has(b.id)
      ? { ...b, status: "ok", matchedWith: allIngIds[0] || null, manual: true, manualDif: diferencia } : b);
    setResult({ V, B });
    if (efecObjs.length) setEfecReclas((s) => { const n = new Set(s); efecObjs.forEach((f) => n.add(f.id)); return n; });
    if (ccObjs.length) setCcConc((s) => { const n = new Set(s); ccObjs.forEach((x) => n.add(x.id)); return n; });
    aprenderPagadores(ingObjs, result.B.filter((b) => selBan.has(b.id)));
    const diaM = ingObjs[0] ? ingObjs[0].fecha : (result.B.find((b) => selBan.has(b.id)) || {}).fecha;
    setAprobadas((prev) => [...prev, { key: "m" + Date.now(), ingIds: allIngIds, banIds, dia: diaM, ingTotal: totIng, banTotal: totBan, dif: diferencia }]);
    // acreditar → se registra como faltante del lado ingresos, ligado a la conciliación
    if (diferencia > 0) {
      const fecha = ingObjs[0] ? ingObjs[0].fecha : null;
      const desc = "resto de conciliación de " + fmt(totIng);
      setFaltantes((fs) => [...fs, { id: "f" + Date.now(), fecha, monto: diferencia, origenDesc: desc, ingId: allIngIds[0] }]);
    }
    editSnap.current = null; // conciliación confirmada: ya no se puede "cancelar la edición"
    limpiarSeleccion();
  }

  function exportar() {
    if (!result || !xlsxReady) return;
    const { V, B } = result;
    const wb = window.XLSX.utils.book_new();
    const vData = V.map((v) => ({ Fecha: v.fecha, Origen: v.origen === "cc" ? "Cuenta corriente" : "Venta POS", Cliente: v.cliente || "",
      Comprobante: v.comp || "", Importe: v.imp, Estado: v.status === "ok" ? "Conciliado" : "Pendiente",
      Tipo: v.matchTipo || "", Movimientos: (v.matchedWith || []).length, Manual: v.manual ? "Sí" : "" }));
    const bData = B.map((b) => ({ Fecha: b.fecha, Pagador: b.cliente || "", Medio: b.medio, Importe: b.imp,
      Estado: b.status === "ok" ? "Conciliado" : "Pendiente", Manual: b.manual ? "Sí" : "" }));
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(vData), "Ingresos");
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(bData), "Banco");
    window.XLSX.writeFile(wb, "conciliacion.xlsx");
  }

  // LISTADO DE CONTROL: cobros de cuenta corriente que el ERP registra por MercadoPago y
  // que no aparecen en el banco (no se pudieron conciliar). Un renglón por cliente y fecha
  // de pago; adentro, los tickets que cancela. Para que caja los revise uno por uno.
  const controlCC = React.useMemo(() => {
    if (!result) return { filas: [], total: 0, cobros: 0 };
    const g = {};
    (data.pagos || []).filter((p) => esMP(p) && !ccConc.has(p.id) && inRange(p.fecha)).forEach((p) => {
      const k = p.fecha + "|" + cliKey(p.cliente); (g[k] = g[k] || []).push(p);
    });
    const filas = Object.values(g).map((ps) => ({ fecha: ps[0].fecha, cliente: ps[0].cliente, items: ps, total: ps.reduce((a, p) => a + p.imp, 0) }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || b.total - a.total);
    return { filas, total: filas.reduce((a, f) => a + f.total, 0), cobros: filas.reduce((a, f) => a + f.items.length, 0) };
  }, [result, data.pagos, ccConc, desde, hasta]);
  function exportarControl() {
    if (!xlsxReady || !controlCC.filas.length) return;
    const rows = [];
    controlCC.filas.forEach((f) => f.items.forEach((p) => rows.push({ "Fecha de pago (ERP)": p.fecha, Cliente: p.cliente || "", Ticket: p.comp || "", "Fecha del ticket": p.fechaFact || "", Importe: p.imp, "Forma (ERP)": "MercadoPago", Estado: "Sin pago en el banco", "Revisado por caja": "", Observación: "" })));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rows), "Control CC");
    window.XLSX.writeFile(wb, "control-cuenta-corriente-" + (desde || "periodo") + ".xlsx");
  }

  // ── Lazarillo (14/11): guardado automático del trabajo de cada período en el servidor ──
  // Se guarda compacto: de cada fila que vino de un archivo, solo su estado de conciliación
  // (las filas en sí ya están guardadas como fuentes); las filas que crea el módulo (cobranzas
  // conciliadas "cc-", efectivo reclasificado "ef-", forma corregida "fv-") van enteras.
  // Al volver a abrir el período: se recalcula igual que siempre y encima se aplica lo guardado.
  const periodoKey = (desde || "") + "|" + (hasta || "");
  const restaurarRef = React.useRef(null);   // { periodo, estado } esperando a que haya resultado
  const listoRef = React.useRef(null);       // período ya revisado: desde ahí se guarda solo
  const [restaurarTick, setRestaurarTick] = React.useState(0);
  const CAMPOS_ESTADO = ["status", "matchedWith", "matchTipo", "manual", "manualDif", "autoDif", "porHora", "serieNota", "serieMult", "cuponDif", "desarmado"];
  const compactar = (rows, baseIds) => {
    const est = {}, extra = [];
    // 19/11: se guarda solo lo que hizo una persona (conciliado a mano / sugerencia aprobada = manual,
    // o desarmado). Lo automático se recalcula cada vez, así las mejoras del motor (cupón, corte,
    // venta + cobro de cuenta corriente…) llegan también a los períodos ya trabajados.
    (rows || []).forEach((r) => {
      if (!baseIds.has(r.id)) { if (!(String(r.id).startsWith("cc-") && !r.manual)) extra.push(r); return; }
      if (!(r.manual || r.desarmado)) return;
      const o = {}; CAMPOS_ESTADO.forEach((k) => { if (r[k] !== undefined && r[k] !== null) o[k] = r[k]; });
      est[r.id] = o;
    });
    return { est, extra };
  };
  const mismaConfig = (e) => e && e.tol === tol && e.autoMargenVal === autoMargenVal && e.autoMargenTipo === autoMargenTipo;

  // 1) al cambiar de período, se busca si había trabajo guardado
  React.useEffect(() => {
    listoRef.current = null; restaurarRef.current = null; baseRef.current = null;
    if (!persist || !persist.cargarEstado || !(data.ventas && data.banco) || !desde || !hasta) return;
    const periodo = periodoKey; let vivo = true;
    persist.cargarEstado(periodo).then((est) => {
      if (!vivo) return;
      if (!est) { listoRef.current = periodo; return; }
      // la configuración primero (eso recalcula); el resto se aplica cuando haya resultado
      if (typeof est.tol === "number" && est.tol !== tol) setTol(est.tol);
      if (est.autoMargenVal != null && est.autoMargenVal !== autoMargenVal) setAutoMargenVal(est.autoMargenVal);
      if (est.autoMargenTipo && est.autoMargenTipo !== autoMargenTipo) setAutoMargenTipo(est.autoMargenTipo);
      if (est.margenVal != null) setMargenVal(est.margenVal);
      if (est.margenTipo) setMargenTipo(est.margenTipo);
      restaurarRef.current = { periodo, estado: est };
      setRestaurarTick((n) => n + 1);
    }).catch(() => { if (vivo) listoRef.current = periodo; });
    return () => { vivo = false; };
     
  }, [periodoKey, !!(data.ventas && data.banco)]);

  // 2) cuando ya hay resultado con la misma configuración, se aplica lo guardado
  // Aplica un estado guardado encima de un resultado (solo las filas que vienen de los archivos;
  // las que arma el módulo —cobranzas "cc-", efectivo "ef-"— se reemplazan por las guardadas).
  const aplicarEstado = (res, e) => {
    // Solo se aplica lo que hizo una persona (manual o desarmado). Lo automático guardado por
    // versiones anteriores se ignora: se usa el cálculo de ahora.
    const util = (o) => o && (o.manual || o.desarmado);
    const filtrar = (m) => { const out = {}; Object.keys(m || {}).forEach((k) => { if (util(m[k])) out[k] = m[k]; }); return out; };
    const extrasDe = (arr) => (arr || []).filter((x) => !(String(x.id).startsWith("cc-") && !x.manual));
    const estV = filtrar(e.V), estB = filtrar(e.B);
    const baseV = new Set((data.ventas || []).map((x) => x.id));
    const baseB = new Set((data.banco || []).map((x) => x.id));
    const limpio = (x) => ({ matchedWith: Array.isArray(x.matchedWith) ? [] : null, matchTipo: null, manual: false, manualDif: undefined, autoDif: undefined, porHora: false, serieNota: undefined, serieMult: undefined });
    let V = res.V.map((x) => (baseV.has(x.id) && estV[x.id] ? { ...x, ...limpio(x), ...estV[x.id] } : x));
    let B = res.B.map((x) => (baseB.has(x.id) && estB[x.id] ? { ...x, ...limpio(x), ...estB[x.id] } : x));
    const exV = extrasDe(e.Vextra), exB = extrasDe(e.Bextra);
    const ponerExtras = (rows, ex) => { const m = new Map(ex.map((x) => [x.id, x])); const ya = new Set(rows.map((r) => r.id)); return [...rows.map((r) => m.get(r.id) || r), ...ex.filter((x) => !ya.has(x.id))]; };
    V = ponerExtras(V, exV); B = ponerExtras(B, exB);
    // lo restaurado manda: lo automático que usaba esos mismos registros vuelve a pendiente
    const restV = new Set([...Object.keys(estV), ...exV.map((x) => x.id)]), restB = new Set([...Object.keys(estB), ...exB.map((x) => x.id)]);
    const tocB = new Set(restB); V.forEach((v) => { if (restV.has(v.id)) (v.matchedWith || []).forEach((id) => tocB.add(id)); });
    const tocV = new Set(restV); B.forEach((b) => { if (restB.has(b.id)) [].concat(b.matchedWith || []).forEach((id) => tocV.add(id)); });
    const revV = new Set();
    V = V.map((v) => {
      if (restV.has(v.id) || v.status !== "ok") return v;
      if (tocV.has(v.id) || (v.matchedWith || []).some((id) => tocB.has(id))) { revV.add(v.id); return { ...v, status: "pend", ...limpio(v) }; }
      return v;
    }).filter((v) => !(revV.has(v.id) && String(v.id).startsWith("cc-")));
    B = B.map((b) => {
      if (restB.has(b.id) || b.status !== "ok") return b;
      const refs = [].concat(b.matchedWith || []);
      if (tocB.has(b.id) || refs.some((id) => revV.has(id) || tocV.has(id))) return { ...b, status: "pend", ...limpio(b) };
      return b;
    });
    // y sus pagos quedan del lado de lo restaurado
    const idxB = new Map(B.map((b, i) => [b.id, i]));
    V.forEach((v) => { if (!restV.has(v.id) || v.status !== "ok") return; (v.matchedWith || []).forEach((bid) => { const i = idxB.get(bid); if (i !== undefined && !restB.has(bid)) B[i] = { ...B[i], status: "ok", matchedWith: v.id, matchTipo: v.matchTipo, manual: v.manual }; }); });
    return { V, B };
  };
  // las cobranzas conciliadas son las filas "cc-" conciliadas del resultado (así quedan bien también
  // después de restaurar o mezclar)
  React.useEffect(() => {
    if (!result) return;
    const s = new Set(result.V.filter((v) => String(v.id).startsWith("cc-") && v.status === "ok" && v.ccCobranza != null).map((v) => v.ccCobranza));
    setCcConc((prev) => (prev.size === s.size && [...s].every((x) => prev.has(x)) ? prev : s));
  }, [result]);
  const aplicarResto = (e) => {
    setTips(e.tips || {}); setAprobadas(e.aprobadas || []); setFaltantes(e.faltantes || []);
    setNotas(e.notas || {});
    setEfecReclas(new Set(e.efecReclas || [])); setSugDescartadas(new Set(e.sugDescartadas || []));
    setFormaOverride(e.formaOverride || {}); setCcConc(new Set(e.ccConc || [])); setCcNoAuto(new Set(e.ccNoAuto || []));
  };
  // Último estado que este navegador sabe que está en el servidor (para mezclar con lo que guardó otro).
  const baseRef = React.useRef(null);
  React.useEffect(() => {
    const r = restaurarRef.current;
    if (!r || !result || r.periodo !== periodoKey || !mismaConfig(r.estado)) return;
    restaurarRef.current = null;
    setResult(aplicarEstado(result, r.estado));
    aplicarResto(r.estado);
    baseRef.current = { periodo: periodoKey, obj: r.estado, json: estable(r.estado) };
    listoRef.current = periodoKey;
     
  }, [result, restaurarTick]);

  // 3) cada cambio se guarda solo (con una pausa corta para no mandar uno por clic).
  // 19/11 (Diego: «las conciliaciones manuales no las guarda»): antes cada pestaña pisaba el período
  // entero con lo suyo, así que si dos personas (o dos pestañas) trabajaban a la vez, la última que
  // guardaba borraba lo de la otra. Ahora, antes de guardar se lee lo que hay en el servidor y, si
  // otro lo cambió, se mezcla registro por registro: lo que cambié yo queda mío, el resto toma lo del
  // otro (y se ve en pantalla). Si no cambió nada, no se manda.
  React.useEffect(() => {
    if (!persist || !persist.guardarEstado || !result || listoRef.current !== periodoKey) return;
    const periodo = periodoKey;
    const t = setTimeout(async () => {
      if (listoRef.current !== periodo) return;
      const baseV = new Set((data.ventas || []).map((x) => x.id));
      const baseB = new Set((data.banco || []).map((x) => x.id));
      const cv = compactar(result.V, baseV), cb = compactar(result.B, baseB);
      const local = {
        v: 2, tol, autoMargenVal, autoMargenTipo, margenVal, margenTipo,
        V: cv.est, Vextra: cv.extra, B: cb.est, Bextra: cb.extra,
        tips, aprobadas, faltantes, notas, efecReclas: [...efecReclas], sugDescartadas: [...sugDescartadas],
        formaOverride, ccConc: [...ccConc], ccNoAuto: [...ccNoAuto],
      };
      const base = baseRef.current && baseRef.current.periodo === periodo ? baseRef.current : null;
      const jsonLocal = estable(local);
      if (base && jsonLocal === base.json) return; // nada nuevo
      let final = local;
      try {
        const remoto = persist.cargarEstado ? await persist.cargarEstado(periodo) : null;
        if (listoRef.current !== periodo) return;
        if (remoto && base && estable(remoto) !== base.json) final = mezclarEstados(base.obj, local, remoto);
      } catch (e) { /* si no se pudo leer, se guarda lo local */ }
      persist.guardarEstado(periodo, final);
      baseRef.current = { periodo, obj: final, json: estable(final) };
      if (final !== local) { setResult((res) => (res ? aplicarEstado(res, final) : res)); aplicarResto(final); }
    }, 1500);
    return () => clearTimeout(t);
     
  }, [result, tips, aprobadas, faltantes, notas, efecReclas, sugDescartadas, formaOverride, ccConc, ccNoAuto, margenVal, margenTipo]);

  // Guardar / cargar el TRABAJO (conciliaciones, propinas, notas, reclasificaciones) en
  // un archivo. Persistencia manual y portable; la automática irá en el Shell/backend.
  function guardarEstado() {
    if (!result) return;
    const estado = { v: 1, guardado: new Date().toISOString(), desde, hasta, tol, autoMargenVal, autoMargenTipo, margenVal, margenTipo,
      result, tips, aprobadas, faltantes, notas, memPag, efecReclas: [...efecReclas], sugDescartadas: [...sugDescartadas], formaOverride, ccConc: [...ccConc], ccNoAuto: [...ccNoAuto], facturasCC };
    const blob = new Blob([JSON.stringify(estado)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "conciliacion-" + (desde || "estado") + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function cargarEstado(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const s = JSON.parse(e.target.result);
        if (!s.result) throw new Error("sin estado");
        if (s.desde) setDesde(s.desde); if (s.hasta) setHasta(s.hasta);
        if (typeof s.tol === "number") setTol(s.tol);
        if (s.autoMargenVal != null) setAutoMargenVal(s.autoMargenVal);
        if (s.autoMargenTipo) setAutoMargenTipo(s.autoMargenTipo);
        if (s.margenVal != null) setMargenVal(s.margenVal);
        if (s.margenTipo) setMargenTipo(s.margenTipo);
        setResult(s.result);
        setTips(s.tips || {}); setAprobadas(s.aprobadas || []); setFaltantes(s.faltantes || []);
        setNotas(s.notas || {}); if (s.memPag || s.pagMap) setMemPag((m) => ({ ...m, ...memDesdeProp(s.memPag || s.pagMap) }));
        setEfecReclas(new Set(s.efecReclas || [])); setSugDescartadas(new Set(s.sugDescartadas || [])); setFormaOverride(s.formaOverride || {}); setCcConc(new Set(s.ccConc || [])); setCcNoAuto(new Set(s.ccNoAuto || []));
        if (s.facturasCC) setFacturasCC(s.facturasCC);
        limpiarSeleccion();
      } catch (err) { window.alert("No se pudo leer el archivo de estado (¿es un archivo guardado desde acá?)."); }
    };
    reader.readAsText(file);
  }

  const color = (business && business.color) || C.celeste;
  const onColor = (() => {
    try { const h = color.replace("#", ""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? C.tinta : "#ffffff"; } catch (e) { return "#ffffff"; }
  })();
  const allLoaded = !!(data.ventas && data.pagos && data.banco);
  // props de propina para un movimiento de banco (por id)
  const tipProps = (b) => ({
    tip: tipDe(b), tipImp: b.imp, tipEditing: tipEdit === b.id,
    // si hay selección de los dos lados y este movimiento está seleccionado, el default
    // de la propina es la diferencia (lo que el banco tiene "de más" sobre el ingreso).
    defaultDif: (selBan.has(b.id) && (selIng.size + selEfec.size + selCC.size) > 0) ? Math.max(0, Math.round(selBanTotal - selIngTotal)) : 0,
    onToggleTip: () => setTipEdit(tipEdit === b.id ? null : b.id),
    onSaveTip: (amt) => { setTips((t) => ({ ...t, [b.id]: Math.max(0, Math.min(amt || 0, b.imp)) })); setTipEdit(null); },
    onTodoTip: () => { setTips((t) => ({ ...t, [b.id]: b.imp })); setTipEdit(null); },
    onQuitarTip: () => { setTips((t) => { const n = { ...t }; n[b.id] = 0; return n; }); setTipEdit(null); },
  });
  // props para editar la forma de pago de un comprobante (corregir errores de carga)
  const formaProps = (row) => ({
    formaEditing: formaEdit === row.comp,
    formaActual: formaReal(row.comp, (row.c === "efec" || row.origen === "efec") ? "efec" : "mp"),
    onToggleForma: () => setFormaEdit(formaEdit === row.comp ? null : row.comp),
    onSetForma: (nueva) => cambiarForma(row, nueva),
  });
  // diferencia comprobantes vs pagos con formato de más / de menos (para las bandas)
  const difPend = (totIng, totBan) => { const d = totIng - totBan; const verde = d <= 0;
    return <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, color: verde ? C.green : C.red, whiteSpace: "nowrap" }}>{d === 0 ? "$0" : (d > 0 ? "-" : "") + fmt(Math.abs(d)) + (d < 0 ? " de más" : " de menos")}</span>;
  };
  // props de observación para una fila/registro (por id)
  const notaProps = (id) => ({
    nota: notas[id], notaEditing: notaEdit === id,
    onToggleNota: () => setNotaEdit(notaEdit === id ? null : id),
    onSaveNota: (t) => {
      // si el registro es parte de una selección de varios, la nota va a todos
      const sel = new Set([...selIng, ...selBan]);
      const targets = (sel.has(id) && sel.size > 1) ? [...sel] : [id];
      setNotas((n) => { const c = { ...n }; targets.forEach((k) => { if (t) c[k] = t; else delete c[k]; }); return c; });
      setNotaEdit(null);
    },
  });
  const resumenPeriodo = mesActivo
    ? (MESES_ES[parseInt(mesActivo.split("-")[1]) - 1] + " " + mesActivo.split("-")[0])
    : (desde && hasta ? (fmtFecha(desde) + " → " + fmtFecha(hasta)) : "período completo");

  return (
    <div onClick={(e) => {
        const haySel = selIng.size || selBan.size || selEfec.size || selCC.size;
        const hayHl = parV.size || parB.size;
        if (!haySel && !hayHl) return;
        const t = e.target;
        if (t && t.closest && (t.closest("[data-rowid]") || t.closest("button") || t.closest("input") || t.closest("select") || t.closest("textarea") || t.closest("[data-keep-sel]"))) return;
        if (haySel) limpiarSeleccion();
        if (hayHl) { setParV(new Set()); setParB(new Set()); }
      }} style={{ fontFamily: "'Archivo',sans-serif", background: C.paper, minHeight: "100%", color: C.txt }}>
      <style>{".cx-row .cx-note{opacity:0;transition:opacity .12s}.cx-row:hover .cx-note{opacity:.6}.cx-row .cx-note.has{opacity:1}.cx-row .cx-note:hover{opacity:1}"}</style>
      {/* Header con la estética del Home/Shell. Si el módulo va dentro del Shell
          (embedded), no se muestra porque el Shell ya pone su propio header. */}
      {!embedded && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", background: color }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: onColor, letterSpacing: ".2px" }}>Conciliación bancaria</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,.22)", border: "1px solid rgba(255,255,255,.35)", borderRadius: 11, padding: "5px 12px 5px 6px" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: C.white, display: "inline-flex", alignItems: "center", justifyContent: "center", color: color, fontWeight: 800, fontSize: 10, fontFamily: "'Sora',sans-serif" }}>{business.initials}</span>
              <span style={{ lineHeight: 1.12 }}>
                <span style={{ display: "block", fontSize: 8.5, color: onColor, opacity: 0.7, textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>{business.group}</span>
                <span style={{ display: "block", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: onColor }}>{business.name}</span>
              </span>
              <span style={{ color: onColor, opacity: 0.7, fontSize: 11 }}>{"▾"}</span>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,.32)", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{"⚙️"}</div>
            <div style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,.32)", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{"🔔"}</div>
          </div>
        </header>
      )}
      <div style={{ maxWidth: 1760, margin: "0 auto", padding: 22 }}>
        <p style={{ fontSize: 15, color: C.txt2, marginTop: 0, marginBottom: 20 }}>
          Cruzá las ventas del POS (no efectivo) y las cobranzas de cuenta corriente con los movimientos del banco. Lo que no cierre automático, lo conciliás a mano.
        </p>

        {/* SETUP: fuentes + período + config (tolerancia y margen). Se minimiza cuando está todo cargado. */}
        {renderBarraSuperior({ corte, setCorte, allDates, allLoaded, autoMargenTipo, autoMargenVal, cargarEstado, data, desde, estadoFileRef, guardarEstado, hasta, margenTipo, margenVal, mesActivo, months, resumenPeriodo, selectMonth, setAutoMargenTipo, setAutoMargenVal, setDesde, setHasta, setMargenTipo, setMargenVal, setMesActivo, setModal, setSetupOpen, setTol, setupOpen, tol, xlsxReady })}

        {/* RESULTADOS */}
        {renderCuerpo({ diaFiltro, setDiaFiltro, months, cambiarMes, cambiarPeriodo, activeTab, aplicarSugerencia, aprobExp, aprobOpen, aprobadas, barTotals, busqComp, busqPago, ccById, ccConc, ccListaOpen, ccOpen, ccPorDia, ccSplit, colFilterB, colFilterOpen, colFilterV, colMenu, colsB, colsBeff, colsV, colsVeff, conciliarManual, conocePagador, controlCC, ctrlOpen, dayCenter, dayView, dayWindow, desarmarCluster, descartarSugerencia, desde, deshacerAprobada, diaCounts, diasPend, difFiltro, difPend, editarCluster, efectivoOpen, efectivoPorDia, efectivoSospechoso, elegirDia, expandedGroups, exportarControl, faltantes, filterB, filterV, filtrarPorDif, formaProps, goTab, hasta, hayHighlight, haySeleccion, hlBanTotal, hlIngTotal, irAResultado, kpis, limiteFilas, limpiarSeleccion, mesesPend, moveDay, notaProps, onSubFiltro, parB, parV, pendOpen, pendPorDia, pendPorMes, pendUnif, pendingDays, resComp, resPago, result, rowsBref, rowsVref, selBan, selBanTotal, selCC, selEfec, selIng, selIngTotal, setAprobExp, setAprobOpen, setBusqComp, setBusqPago, setCcListaOpen, setCcOpen, setColFilterB, setColFilterOpen, setColFilterV, setColMenu, setColsB, setColsV, setCtrlOpen, setCuentaModal, setDayCenter, setDayView, setDiasPend, setEfectivoOpen, setExpandedGroups, setFilterB, setFilterV, setLimiteFilas, setMesesPend, setParB, setParV, setPendOpen, setSelBan, setSelCC, setSelEfec, setSelIng, setSortB, setSortV, setSubFilterV, sortB, sortV, subFilterV, sugActiva, sugResaltados, sugerencias, sugerir, tieneCuenta, tipDe, tipProps, tipsInfo, toggleBan, toggleBanGroup, toggleIng, tol, verParDeBanco, verParDeIngreso, verSugerencia, view, xlsxReady })}
      </div>

      {/* MODAL DE CUENTA CORRIENTE (al tocar el nombre del cliente) */}
      {cuentaModal != null && <CuentaModal cuenta={cuentaModal ? cuentaDe(cuentaModal) : null} clientes={listaClientes} onElegir={setCuentaModal} diaFoco={dayCenter} onClose={() => setCuentaModal(null)} onQuitarPagador={(pk) => quitarPagador(cuentaModal, pk)} />}
      {/* MODAL DE IMPORTACIÓN */}
      {modal && (
        <ImportModal fuente={modal} business={business} onClose={() => setModal(null)}
          onFile={(file) => onFile(modal, file)} onHelp={() => setInstructivo(modal.instructivo)} />
      )}
      {/* INSTRUCTIVO */}
      {instructivo && <InstructivoModal instructivo={instructivo} onClose={() => setInstructivo(null)} />}
      {/* AVISO DE COLUMNAS FALTANTES */}
      {fileError && <ColErrorModal error={fileError} onClose={() => setFileError(null)} />}
    </div>
  );
}
