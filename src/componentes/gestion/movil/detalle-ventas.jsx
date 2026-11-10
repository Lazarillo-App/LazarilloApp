// Detalle de ventas de un día o de un mes, debajo del gráfico de Ventas de la versión celular
// (Diego 08/11/2026, mockups mockup_detalle_dia_v2/v3 y mockup_mes_dia).
//  - El gráfico de meses elige el mes (tocar una barra); la tira de días del mes elige el día.
//  - «Día | Mes», ‹ › de a un día o un mes, turnos juntos o separados.
//  - Pestañas: Servicio · Cobro · Rubro (rubro/subrubro + top 10 por $ o unidades) · Mozo · Revisar.
//  - Varios PDV elegidos: se pide uno por uno a /api/m/detalle y se suman acá.
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { gestionFetch } from "@/servicios/apiGestion";

const AZUL = "#0369a1";
const CELESTE = "#5BC2EA";
const GRIS = "#71717a";
const BORDE = "#e4e4e7";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_PL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const COLORES = ["#0ea5e9", "#22c55e", "#a78bfa", "#f59e0b", "#f97316", "#ec4899", "#14b8a6", "#94a3b8"];

const $ = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");
const num = (n) => Math.round(n || 0).toLocaleString("es-AR");
const pct = (x, t) => (t ? Math.round((x / t) * 100) : 0);
const pct1 = (x, t) => `${(t ? (x / t) * 100 : 0).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
const pad = (n) => String(n).padStart(2, "0");
const fechaDe = (s) => new Date(`${s}T12:00:00`);
const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sumarDias = (s, n) => { const d = fechaDe(s); d.setDate(d.getDate() + n); return isoDe(d); };
const finDeMes = (ym) => { const [a, m] = ym.split("-").map(Number); return isoDe(new Date(a, m, 0)); };
const mesMas = (ym, n) => { const [a, m] = ym.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const leer = (k, def) => { try { return localStorage.getItem(k) || def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

const titulo = (s) => String(s || "").toLowerCase().replace(/(^|[\s(/-])([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase());
const SERVICIO = { SALON: "Salón", TAKEA: "Take away", DOMIC: "Delivery", MOSTR: "Mostrador" };
const nombreServicio = (t) => SERVICIO[String(t).toUpperCase()] || titulo(t);
const TURNO = { "MAÑ": "Mañana", MAN: "Mañana", TAR: "Tarde", NOC: "Noche" };
const nombreTurno = (t) => TURNO[String(t).toUpperCase()] || titulo(t);
// «378.SALON» → «Salón»; «3029.Julieta Belen» → «Julieta Belen»
const nombreMozo = (m) => { const s = String(m || "").replace(/^\d+\./, "").trim() || "—"; return s === s.toUpperCase() ? titulo(s) : s; };

// Suma por clave los campos numéricos de las listas de cada PDV.
function unir(listas, clave) {
  const mapa = new Map();
  for (const lista of listas) for (const x of lista || []) {
    const k = clave(x);
    const y = mapa.get(k);
    if (!y) { mapa.set(k, { ...x }); continue; }
    for (const [c, v] of Object.entries(x)) if (typeof v === "number") y[c] = (y[c] || 0) + v;
  }
  return [...mapa.values()];
}
const porImporte = (l) => l.sort((a, b) => b.importe - a.importe);

function sumar(datos) {
  const ok = datos.filter((d) => d && !d.vacio);
  if (!ok.length) return null;
  const s = (f) => ok.reduce((t, d) => t + (f(d) || 0), 0);
  const comps = ok.map((d) => d.comparacion).filter(Boolean);
  const arts = ok.map((d) => d.articulos).filter(Boolean);
  const top = (campo, orden) => unir(arts.map((a) => a[campo]), (x) => x.nombre).filter((x) => x.importe > 0).sort(orden).slice(0, 10);
  return {
    periodo: ok[0].periodo,
    ultimoDia: ok.map((d) => d.ultimoDia).sort().pop(),
    ultimoCompleto: ok.map((d) => d.ultimoCompleto).filter(Boolean).sort()[0],
    total: s((d) => d.total), tickets: s((d) => d.tickets), cubiertos: s((d) => d.cubiertos), bruto: s((d) => d.bruto),
    comparacion: comps.length === ok.length ? { ...comps[0], valor: comps.reduce((t, c) => t + c.valor, 0) } : null,
    turnos: porImporte(unir(ok.map((d) => d.turnos), (x) => x.turno)),
    servicio: porImporte(unir(ok.map((d) => d.servicio), (x) => x.tipo)),
    cobro: porImporte(unir(ok.map((d) => d.cobro), (x) => x.cobro)),
    mozos: porImporte(unir(ok.map((d) => d.mozos), (x) => nombreMozo(x.mozo))),
    descuentos: {
      importe: s((d) => d.descuentos?.importe), tickets: s((d) => d.descuentos?.tickets),
      porTurno: porImporte(unir(ok.map((d) => d.descuentos?.porTurno), (x) => x.turno)),
      porMozo: unir(ok.map((d) => d.descuentos?.porMozo), (x) => nombreMozo(x.mozo)).sort((a, b) => b.importe - a.importe),
      porTipo: unir(ok.map((d) => d.descuentos?.porTipo), (x) => x.tipo).sort((a, b) => b.importe - a.importe),
      detalle: ok.flatMap((d) => d.descuentos?.detalle || []).sort((a, b) => b.descuento - a.descuento),
    },
    stock: (() => {
      const ss = ok.map((d) => d.stock).filter(Boolean);
      if (!ss.length) return null;
      return {
        importe: ss.reduce((t, x) => t + x.importe, 0), remitos: ss.reduce((t, x) => t + x.remitos, 0),
        porConcepto: unir(ss.map((x) => x.porConcepto), (x) => x.concepto).sort((a, b) => b.importe - a.importe),
        porTurno: unir(ss.map((x) => x.porTurno), (x) => nombreTurno(x.turno)).sort((a, b) => b.importe - a.importe),
        articulos: unir(ss.map((x) => x.articulos), (x) => `${x.concepto}|${x.nombre}`).sort((a, b) => b.importe - a.importe),
      };
    })(),
    pagosCaja: ok.flatMap((d) => d.pagosCaja || []).sort((a, b) => b.importe - a.importe),
    anulaciones: (() => {
      const det = ok.flatMap((d) => d.anulaciones?.detalle || []).sort((a, b) => b.importe - a.importe);
      return { importe: det.reduce((t, a) => t + a.importe, 0), n: det.length, detalle: det };
    })(),
    dias: unir(ok.map((d) => d.dias), (x) => x.fecha).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    articulos: arts.length ? {
      rubros: porImporte(unir(arts.map((a) => a.rubros), (x) => x.rubro)),
      subrubros: porImporte(unir(arts.map((a) => a.subrubros), (x) => `${x.rubro}|${x.subrubro}`)),
      topImporte: top("topImporte", (a, b) => b.importe - a.importe),
      topUnidades: top("topUnidades", (a, b) => b.unidades - a.unidades || b.importe - a.importe),
      total: arts.reduce((t, a) => t + (a.total || 0), 0),
    } : null,
  };
}

// ── piezas de UI ────────────────────────────────────────────────────────────
const Pastilla = ({ on, alerta, onClick, children }) => (
  <button type="button" onClick={onClick} style={{ border: 0, cursor: "pointer", whiteSpace: "nowrap", fontSize: 12, fontWeight: 600, padding: "6px 9px", borderRadius: 15,
    background: on ? "#18181b" : alerta ? "#fff7ed" : "#f4f4f5", color: on ? "#fff" : alerta ? "#c2410c" : GRIS }}>{children}</button>
);
const Segmento = ({ opciones, valor, onCambio, oscuro }) => (
  <div style={{ display: "inline-flex", background: "#f4f4f5", borderRadius: 9, padding: 3 }}>
    {opciones.map(([v, t]) => (
      <button key={v} type="button" onClick={() => onCambio(v)} style={{ border: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 700, padding: "3px 12px", borderRadius: 7,
        background: valor === v ? (oscuro ? "#18181b" : "#fff") : "transparent", color: valor === v ? (oscuro ? "#fff" : "#18181b") : GRIS,
        boxShadow: valor === v && !oscuro ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>{t}</button>
    ))}
  </div>
);
const Flecha = ({ onClick, deshabilitada, children }) => (
  <button type="button" onClick={onClick} disabled={deshabilitada} aria-label={children === "‹" ? "Anterior" : "Siguiente"}
    style={{ width: 30, height: 30, borderRadius: 15, border: `1px solid ${BORDE}`, background: "#fff", color: deshabilitada ? "#d4d4d8" : AZUL, fontSize: 16, cursor: deshabilitada ? "default" : "pointer", flexShrink: 0 }}>{children}</button>
);
const Seccion = ({ children, derecha }) => (
  <div style={{ marginTop: 14, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, letterSpacing: ".05em", color: GRIS, textTransform: "uppercase" }}>
    <span>{children}</span>{derecha && <span style={{ marginLeft: "auto" }}>{derecha}</span>}
  </div>
);
function Fila({ nombre, importe, total, sub, color = CELESTE }) {
  const p = pct(importe, total);
  return (
    <div style={{ marginTop: 9 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 14 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre}</span>
        <em style={{ fontStyle: "normal", color: GRIS, fontSize: 12, flexShrink: 0 }}>{p}%</em>
        <b style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{$(importe)}</b>
      </div>
      <div style={{ height: 6, background: "#f4f4f5", borderRadius: 3, marginTop: 3 }}><div style={{ height: "100%", width: `${Math.max(0, Math.min(100, (importe / (total || 1)) * 100))}%`, background: color, borderRadius: 3 }} /></div>
      {sub && <div style={{ fontSize: 11.5, color: GRIS, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Lista({ items, render, inicial = 5, etiqueta, valor = (x) => x.importe }) {
  const [todos, setTodos] = useState(false);
  const vis = todos ? items : items.slice(0, inicial);
  const resto = items.slice(inicial);
  return (<>
    {vis.map(render)}
    {resto.length > 0 && (
      <button type="button" onClick={() => setTodos((v) => !v)} style={{ display: "block", width: "100%", marginTop: 10, border: 0, background: "none", color: AZUL, fontSize: 12.5, cursor: "pointer" }}>
        {todos ? "Ver menos" : `+ ${resto.length} ${etiqueta} más · ${$(resto.reduce((t, x) => t + (valor(x) || 0), 0))}`}
      </button>
    )}
  </>);
}

// ── hoja de detalle de Revisar ─────────────────────────────────────────────
const LINEA = { display: "flex", alignItems: "baseline", gap: 6, padding: "7px 0", borderBottom: "1px solid #f4f4f5", fontSize: 13.5 };
// Ancho fijo: así los comprobantes / artículos de la lista quedan alineados.
const Chip = ({ children }) => <span style={{ flexShrink: 0, width: 84, boxSizing: "border-box", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, background: "#f4f4f5", color: "#52525b", borderRadius: 10, padding: "1px 7px" }}>{children}</span>;
const fechaCorta = (f) => `${f.slice(8)}/${f.slice(5, 7)}`;
function HojaRevisar({ tipo, d, esMes, tituloPeriodo, onCerrar, mover, sigDeshabilitado }) {
  // Anulaciones: tocar «Re-facturadas» o «Sin re-facturar» filtra la hoja (Diego 10/11/2026).
  const [filtroAnul, setFiltroAnul] = useState(null);
  const ventas = d.total;
  let encabezado, total, sub, cuerpo;
  if (tipo === "stock" && !d.stock) {
    encabezado = "Movimientos de stock"; total = 0; sub = "todavía sin datos para este lugar";
    cuerpo = <Nota>El kit de esta PC todavía no subió los informes 27 y 28.</Nota>;
  } else if (tipo === "stock") {
    const st = d.stock;
    encabezado = "Movimientos de stock"; total = st.importe;
    sub = `${num(st.remitos)} ${st.remitos === 1 ? "remito" : "remitos"} · ${pct1(st.importe, ventas)} de la venta · a precio de venta`;
    cuerpo = (<>
      {(st.porTurno || []).length > 1 && (<>
        <Seccion>Por turno</Seccion>
        {st.porTurno.map((x) => <div key={x.turno} style={LINEA}>{nombreTurno(x.turno)}<small style={{ color: GRIS }}>{num(x.remitos)} {x.remitos === 1 ? "remito" : "remitos"}</small><b style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{$(x.importe)}</b></div>)}
      </>)}
      <Seccion>Por concepto</Seccion>
      {st.porConcepto.map((c, i) => <Fila key={c.concepto} nombre={titulo2(c.concepto)} importe={c.importe} total={st.importe} color={COLORES[(i + 3) % COLORES.length]} sub={`${num(c.remitos)} ${c.remitos === 1 ? "remito" : "remitos"}`} />)}
      <Seccion derecha="cant · $">Qué salió</Seccion>
      <Lista items={st.articulos} inicial={8} etiqueta="artículos" render={(a) => (
        <div key={`${a.concepto}|${a.nombre}`} style={LINEA}>
          {st.porConcepto.length > 1 && <Chip>{titulo2(a.concepto)}</Chip>}
          <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo(a.nombre)}</span>
          <small style={{ color: GRIS, flexShrink: 0 }}>× {num(a.cantidad)}</small>
          <b style={{ whiteSpace: "nowrap" }}>{$(a.importe)}</b>
        </div>)} />
      <Nota>Salidas de stock que no son venta (informes 27 y 28 de MaxiRest), valuadas a precio de venta.</Nota>
    </>);
  } else if (tipo === "anulaciones") {
    const an = d.anulaciones;
    encabezado = "Anulaciones"; total = an.importe;
    sub = `${num(an.n)} ${an.n === 1 ? "nota de crédito" : "notas de crédito"} · ${pct1(an.importe, ventas)} de la venta`;
    const sinRefact = an.detalle.filter((a) => a.refacturada === null);
    const conRefact = an.detalle.filter((a) => a.refacturada);
    const vistas = filtroAnul === "sin" ? sinRefact : filtroAnul === "con" ? conRefact : an.detalle;
    const totVista = vistas.reduce((t, a) => t + a.importe, 0);
    const porTurno = unir(vistas.map((a) => [{ turno: a.turno, importe: a.importe }]), (x) => x.turno).sort((a, b) => b.importe - a.importe);
    // Por servicio (Diego 10/11/2026): salón, delivery, take away…
    const porServicio = unir(vistas.map((a) => [{ tipo: nombreServicio(a.tipo || "—"), importe: a.importe, n: 1 }]), (x) => x.tipo).sort((a, b) => b.importe - a.importe);
    const caja = (on, alerta) => ({ textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer", borderRadius: 12, padding: "8px 10px",
      border: `${on ? 2 : 1}px solid ${on ? AZUL : alerta ? "#fdba74" : BORDE}`, background: alerta ? "#fff7ed" : "#fff" });
    cuerpo = (<>
      {(conRefact.length > 0 || sinRefact.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => setFiltroAnul((f) => (f === "con" ? null : "con"))} style={caja(filtroAnul === "con", false)}>
            <div style={{ fontSize: 11.5, color: GRIS }}>Re-facturadas</div>
            <b style={{ display: "block", fontSize: 16, whiteSpace: "nowrap", color: "#047857" }}>{num(conRefact.length)}</b>
            <div style={{ fontSize: 11.5, color: GRIS, whiteSpace: "nowrap" }}>{$(conRefact.reduce((t, a) => t + a.refacturada.importe, 0))}</div>
          </button>
          <button type="button" onClick={() => setFiltroAnul((f) => (f === "sin" ? null : "sin"))} style={caja(filtroAnul === "sin", sinRefact.length > 0)}>
            <div style={{ fontSize: 11.5, color: GRIS }}>Sin re-facturar</div>
            <b style={{ display: "block", fontSize: 16, whiteSpace: "nowrap", color: sinRefact.length ? "#c2410c" : undefined }}>{num(sinRefact.length)}</b>
            <div style={{ fontSize: 11.5, color: GRIS, whiteSpace: "nowrap" }}>{$(sinRefact.reduce((t, a) => t + a.importe, 0))}</div>
          </button>
        </div>)}
      {filtroAnul && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: GRIS }}>
          <span>Viendo {filtroAnul === "sin" ? "sin re-facturar" : "re-facturadas"}: {num(vistas.length)} · {$(totVista)}</span>
          <button type="button" onClick={() => setFiltroAnul(null)} style={{ marginLeft: "auto", border: 0, background: "none", color: AZUL, fontSize: 12, cursor: "pointer" }}>Ver todas</button>
        </div>)}
      <Seccion>Por servicio</Seccion>
      {porServicio.map((x, i) => <Fila key={x.tipo} nombre={x.tipo} importe={x.importe} total={totVista} color={COLORES[i % COLORES.length]} sub={`${num(x.n)} ${x.n === 1 ? "anulación" : "anulaciones"}`} />)}
      <Seccion>Por turno</Seccion>
      {porTurno.map((x) => <div key={x.turno} style={LINEA}>{nombreTurno(x.turno)}<b style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{$(x.importe)}</b></div>)}
      <Seccion>{esMes ? "Todas las del mes" : "Detalle"}</Seccion>
      <Lista key={filtroAnul || "todas"} items={[...vistas].sort((a, b) => (esMes ? (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : b.importe - a.importe) : b.importe - a.importe))} inicial={esMes ? 100 : 10} etiqueta="anulaciones" render={(a) => (
        <div key={`${a.fecha}|${a.comprobante}`} style={{ ...LINEA, flexWrap: "wrap" }}>
          <span style={{ minWidth: 0, flex: 1 }}>{a.anula || a.comprobante}</span>
          <b style={{ whiteSpace: "nowrap" }}>{$(a.importe)}</b>
          <div style={{ width: "100%", fontSize: 11.5, color: GRIS }}>
            {[esMes && fechaCorta(a.fecha), a.hora, a.mesa && `mesa ${a.mesa}`, nombreTurno(a.turno), a.tipo && nombreServicio(a.tipo), `anulada con ${a.comprobante}`].filter(Boolean).join(" · ")}
          </div>
          {a.refacturada && (() => {
            const r = a.refacturada; const dif = r.importe - a.importe;
            return (<div style={{ width: "100%", fontSize: 11.5, marginTop: 2, color: Math.abs(dif) < 1 ? "#047857" : "#b45309" }}>
              ↳ re-facturada en {r.comprobante} · {r.cobro || "—"} · {r.minutos <= 0 ? "en el momento" : `${r.minutos} min después de la factura`}
              {Math.abs(dif) < 1 ? " · mismo importe" : ` · ${$(r.importe)} (${dif > 0 ? "+" : "−"}${$(Math.abs(dif)).replace("$ ", "$ ")})`}
            </div>);
          })()}
          {a.refacturada === null && (
            <div style={{ width: "100%", fontSize: 11.5, marginTop: 2, color: "#c2410c" }}>↳ sin re-facturar: no hay otro ticket de {a.mesa ? `la mesa ${a.mesa}` : "esa mesa"} en los 90 minutos siguientes a la factura</div>
          )}
        </div>)} />
    </>);
  } else if (tipo === "descuentos") {
    const ds = d.descuentos;
    encabezado = "Descuentos"; total = ds.importe;
    sub = `${num(ds.tickets)} tickets · ${pct1(ds.importe, d.bruto)} de lo bruto`;
    const tipos = (ds.porTipo || []);
    const hayTipos = tipos.some((t) => t.tipo !== "Sin tipo");
    cuerpo = (<>
      {hayTipos && (<>
        <Seccion>Por tipo</Seccion>
        {tipos.map((t, i) => <Fila key={t.tipo} nombre={t.tipo} importe={t.importe} total={ds.importe} color={COLORES[(i + 2) % COLORES.length]} sub={`${num(t.tickets)} tickets`} />)}
      </>)}
      {ds.porTurno.length > 0 && <Seccion>Por turno</Seccion>}
      {ds.porTurno.map((x) => <div key={x.turno} style={LINEA}>{nombreTurno(x.turno)}<b style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{$(x.importe)}</b></div>)}
      {ds.porMozo.length > 1 && (<>
        <Seccion>Por mozo</Seccion>
        {ds.porMozo.map((x) => <div key={x.mozo} style={LINEA}>{nombreMozo(x.mozo)}<small style={{ color: GRIS }}>{num(x.tickets)} tickets</small><b style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{$(x.importe)}</b></div>)}
      </>)}
      <Seccion derecha="descuento · %">Cada ticket</Seccion>
      <Lista items={ds.detalle} inicial={10} etiqueta="tickets" valor={(t) => t.descuento} render={(t) => (
        <div key={`${t.fecha}|${t.comprobante}|${t.turno}`} style={{ ...LINEA, flexWrap: "wrap" }}>
          {t.tipo && <Chip>{t.tipo}</Chip>}
          <span style={{ minWidth: 0, flex: 1 }}>{t.comprobante || "Ticket"}</span>
          <b style={{ whiteSpace: "nowrap" }}>{$(t.descuento)}</b>
          <small style={{ color: GRIS, width: 44, textAlign: "right" }}>{pct1(t.descuento, t.cobrado + t.descuento)}</small>
          <div style={{ width: "100%", fontSize: 11.5, color: GRIS }}>
            {[esMes && fechaCorta(t.fecha), t.hora, t.mesa && `mesa ${t.mesa}`, nombreTurno(t.turno), nombreMozo(t.mozo), `cobrado ${$(t.cobrado)}`].filter(Boolean).join(" · ")}
          </div>
        </div>)} />
    </>);
  } else {
    const ps = d.pagosCaja;
    encabezado = "Pagos desde la caja"; total = ps.reduce((t, p) => t + p.importe, 0);
    sub = `${num(ps.length)} ${ps.length === 1 ? "pago" : "pagos"} · con la caja del turno (adición)`;
    const porConcepto = unir(ps.map((p) => [{ concepto: p.concepto || p.proveedor || "Pago", importe: p.importe, n: 1 }]), (x) => x.concepto).sort((a, b) => b.importe - a.importe);
    cuerpo = (<>
      <Seccion>Por concepto</Seccion>
      {porConcepto.map((c, i) => <Fila key={c.concepto} nombre={titulo2(c.concepto)} importe={c.importe} total={total} color={COLORES[i % COLORES.length]} sub={`${num(c.n)} ${c.n === 1 ? "pago" : "pagos"}`} />)}
      <Seccion>Cada pago</Seccion>
      <Lista items={ps} inicial={10} etiqueta="pagos" render={(p, i) => (
        <div key={i} style={{ ...LINEA, flexWrap: "wrap" }}>
          <span style={{ minWidth: 0, flex: 1 }}>{titulo2(p.concepto || p.proveedor || "Pago")}</span>
          <b style={{ whiteSpace: "nowrap" }}>{$(p.importe)}</b>
          {(p.observacion || esMes) && <div style={{ width: "100%", fontSize: 11.5, color: GRIS }}>{[esMes && p.fecha && fechaCorta(p.fecha), p.observacion].filter(Boolean).join(" · ")}</div>}
        </div>)} />
    </>);
  }
  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 1360, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
        style={{ width: "100%", maxHeight: "85svh", overflowY: "auto", background: "#fff", borderRadius: "22px 22px 0 0", padding: "10px 16px calc(18px + env(safe-area-inset-bottom))" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#d4d4d8", margin: "0 auto 10px" }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <b style={{ fontSize: 17 }}>{encabezado}</b>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <Flecha onClick={() => mover(-1)}>‹</Flecha>
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{tituloPeriodo}</span>
            <Flecha onClick={() => mover(1)} deshabilitada={sigDeshabilitado}>›</Flecha>
          </span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ border: 0, background: "#f4f4f5", borderRadius: 14, width: 28, height: 28, fontSize: 15, color: GRIS, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, whiteSpace: "nowrap" }}>{$(total)}</div>
        <div style={{ fontSize: 12, color: GRIS }}>{sub}</div>
        {cuerpo}
      </div>
    </div>
  );
}
const Nota = ({ children }) => <div style={{ marginTop: 12, border: "1px dashed #d4d4d8", borderRadius: 12, padding: "9px 11px", fontSize: 12, color: GRIS, lineHeight: 1.45 }}>{children}</div>;
// «Comida de Personal» se respeta; «BOX BRUNCHEAR» → «Box Brunchear».
const titulo2 = (t) => { const x = String(t || ""); return x === x.toUpperCase() ? titulo(x) : x; };

// ── componente ─────────────────────────────────────────────────────────────
export function DetalleVentas({ sel, periodo, setPeriodo }) {
  const [turno, setTurno] = useState(null);
  const [tab, setTab] = useState("servicio");
  const [hoja, setHoja] = useState(null);
  const [vistaRubro, setVistaRubroCrudo] = useState(() => leer("m:vista-rubro", "rubro"));
  const [modoTop, setModoTopCrudo] = useState(() => leer("m:modo-top", "importe"));
  const setVistaRubro = (v) => { setVistaRubroCrudo(v); guardar("m:vista-rubro", v); };
  const setModoTop = (v) => { setModoTopCrudo(v); guardar("m:modo-top", v); };

  const qs = (s) => {
    const p = new URLSearchParams({ pdvId: String(s.pdvId) });
    if (periodo.modo === "mes" && periodo.mes) p.set("mes", periodo.mes);
    else if (periodo.dia) p.set("dia", periodo.dia);
    if (turno) p.set("turno", turno);
    return `/api/m/detalle?${p}`;
  };
  const consultas = useQueries({
    queries: sel.map((s) => ({
      queryKey: ["m-detalle-ventas", s.pdvId, periodo.modo, periodo.dia, periodo.mes, turno],
      queryFn: async () => { const r = await gestionFetch(qs(s)); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
      staleTime: 5 * 60_000, retry: 1,
      // Al pasar de día con una hoja de Revisar abierta, lo anterior queda hasta que llega lo nuevo.
      placeholderData: keepPreviousData,
    })),
  });
  const listo = consultas.length > 0 && consultas.every((q) => q.data !== undefined);
  const error = consultas.some((q) => q.isError);
  const d = useMemo(() => (listo ? sumar(consultas.map((q) => q.data)) : null), [listo, consultas]);

  // Sin día elegido: el último con todo cargado (el más viejo entre los PDV, así todos lo tienen).
  useEffect(() => {
    if (periodo.modo === "dia" && !periodo.dia && d?.ultimoCompleto) setPeriodo({ modo: "dia", dia: d.ultimoCompleto, mes: null });
  }, [periodo, d, setPeriodo]);

  const caja = { marginTop: 14, border: `1px solid ${BORDE}`, borderRadius: 16, padding: 14 };
  if (error) return <div style={{ ...caja, fontSize: 13, color: GRIS }}>No se pudo traer el detalle de ventas.</div>;
  if (!d) return <div style={{ ...caja, fontSize: 13, color: GRIS }}>Cargando el detalle…</div>;

  const esMes = periodo.modo === "mes";
  const desde = d.periodo?.desde;
  const mesAct = (esMes ? periodo.mes : desde?.slice(0, 7)) || d.ultimoDia.slice(0, 7);
  const dow = desde ? fechaDe(desde).getDay() : 0;
  const tituloPeriodo = esMes ? `${MESES[Number(mesAct.slice(5)) - 1]} ${mesAct.slice(0, 4)}` : desde ? `${DIAS[dow]} ${desde.slice(8)}/${desde.slice(5, 7)}` : "";
  const sigDeshabilitado = esMes ? mesAct >= d.ultimoDia.slice(0, 7) : !desde || desde >= d.ultimoDia;
  const mover = (n) => (esMes ? setPeriodo({ modo: "mes", dia: null, mes: mesMas(mesAct, n) }) : setPeriodo({ modo: "dia", dia: sumarDias(desde, n), mes: null }));
  const aDia = () => {
    if (!esMes) return;
    const conVenta = d.dias.filter((x) => x.importe > 0);
    setPeriodo({ modo: "dia", dia: conVenta.length ? conVenta[conVenta.length - 1].fecha : `${mesAct}-01`, mes: null });
  };
  const aMes = () => { if (!esMes) setPeriodo({ modo: "mes", dia: null, mes: mesAct }); };

  let comp = null;
  if (d.comparacion?.valor > 0) {
    const v = d.total / d.comparacion.valor - 1;
    const txt = esMes
      ? `vs ${MESES[Number(mesMas(mesAct, -1).slice(5)) - 1].slice(0, 3).toLowerCase()}${d.comparacion.hastaDia ? ` al ${d.comparacion.hastaDia}` : ""}`
      : `vs ${DIAS_PL[dow]}`;
    comp = { v, txt };
  }
  const turnosReales = d.turnos.filter((t) => t.turno !== "—");
  // Con un turno elegido los botones quedan siempre, para poder volver al día completo.
  const conTurnos = turnosReales.length > 1 || !!turno;
  const alertaRevisar = (d.bruto > 0 && d.descuentos.importe / d.bruto > 0.05) || d.anulaciones.n > 0;
  const ultimoDiaMes = Number(finDeMes(mesAct).slice(8));
  const porDia = new Map(d.dias.map((x) => [Number(x.fecha.slice(8)), x.importe]));
  const maxDia = Math.max(1, ...d.dias.map((x) => x.importe));
  const diaSel = !esMes && desde ? Number(desde.slice(8)) : null;
  const arts = d.articulos;

  return (
    <div style={caja}>
      {/* período */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Segmento opciones={[["dia", "Día"], ["mes", "Mes"]]} valor={periodo.modo} onCambio={(v) => (v === "mes" ? aMes() : aDia())} oscuro />
        <span style={{ flex: 1 }} />
        <Flecha onClick={() => mover(-1)}>‹</Flecha>
        <b style={{ fontSize: 15, whiteSpace: "nowrap" }}>{tituloPeriodo}</b>
        <Flecha onClick={() => mover(1)} deshabilitada={sigDeshabilitado}>›</Flecha>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
        <b style={{ fontSize: 26, whiteSpace: "nowrap" }}>{$(d.total)}</b>
        {comp && <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", color: comp.v >= 0 ? "#047857" : "#dc2626" }}>{comp.v >= 0 ? "▲" : "▼"} {Math.abs(Math.round(comp.v * 100))}% {comp.txt}</span>}
      </div>
      <div style={{ fontSize: 12, color: GRIS, marginTop: 2 }}>
        {num(d.tickets)} tickets
        {esMes && d.dias.length > 0 && <> · <span style={{ whiteSpace: "nowrap" }}>{$(d.total / d.dias.filter((x) => x.importe > 0).length || 0)}</span> por día</>}
        {!esMes && d.comparacion && <> · promedio de los últimos {d.comparacion.n} {DIAS_PL[dow]} <span style={{ whiteSpace: "nowrap" }}>{$(d.comparacion.valor)}</span></>}
      </div>

      {/* tira de días del mes */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 46, marginTop: 12, borderBottom: `1px solid ${BORDE}` }}>
        {Array.from({ length: ultimoDiaMes }, (_, i) => i + 1).map((n) => {
          const v = porDia.get(n) || 0;
          const fecha = `${mesAct}-${pad(n)}`;
          const futuro = fecha > d.ultimoDia;
          return (
            <button key={n} type="button" disabled={futuro} onClick={() => setPeriodo({ modo: "dia", dia: fecha, mes: null })} aria-label={`Día ${n}`}
              style={{ flex: 1, height: "100%", border: 0, padding: 0, background: "none", display: "flex", alignItems: "flex-end", cursor: futuro ? "default" : "pointer" }}>
              <i style={{ display: "block", width: "100%", height: v > 0 ? `${Math.max(6, (v / maxDia) * 100)}%` : 2, borderRadius: "2px 2px 0 0", background: diaSel === n ? "#0284c7" : v > 0 ? "#bae6fd" : "#f4f4f5" }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#a1a1aa", marginTop: 2 }}>
        {[1, 8, 15, 22, ultimoDiaMes].map((n) => <span key={n}>{n}</span>)}
      </div>
      <div style={{ fontSize: 11, color: GRIS, textAlign: "center", marginTop: 4 }}>{esMes ? "tocá un día para ver su detalle" : "tocá otro día o una barra del gráfico"}</div>

      {/* turnos */}
      {conTurnos && (
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {[[null, esMes ? "Todos" : "Día completo"], ...turnosReales.map((t) => [t.turno, nombreTurno(t.turno)])].map(([v, t]) => (
            <button key={t} type="button" onClick={() => setTurno(v)} style={{ flex: 1, cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: "6px 0", borderRadius: 9,
              border: `1px solid ${turno === v ? "#7dd3fc" : BORDE}`, background: turno === v ? "#e0f2fe" : "#fff", color: turno === v ? AZUL : "#52525b" }}>{t}</button>
          ))}
        </div>
      )}
      {conTurnos && !turno && (
        <div style={{ fontSize: 11.5, color: GRIS, marginTop: 4 }}>
          {turnosReales.map((t, i) => <span key={t.turno}>{i > 0 ? " · " : ""}<span style={{ whiteSpace: "nowrap" }}>{nombreTurno(t.turno)} {$(t.importe)} · {num(t.tickets)} tickets</span></span>)}
        </div>
      )}

      {/* pestañas */}
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {[["servicio", "Servicio"], ["cobro", "Cobro"], ["rubro", "Rubro"], ["mozo", "Mozo"], ["revisar", "Revisar"]].map(([k, t]) => (
          <Pastilla key={k} on={tab === k} alerta={k === "revisar" && alertaRevisar} onClick={() => setTab(k)}>{t}{k === "revisar" && alertaRevisar && tab !== k ? " ●" : ""}</Pastilla>
        ))}
      </div>

      {tab === "servicio" && d.servicio.map((s) => {
        const prom = s.tickets ? s.importe / s.tickets : 0;
        const sub = s.cubiertos > 0
          ? `${num(s.tickets)} tickets · ${num(s.cubiertos)} cubiertos · ${$(s.importe / s.cubiertos)} por cubierto`
          : `${num(s.tickets)} ${String(s.tipo).toUpperCase() === "DOMIC" ? "pedidos" : "tickets"} · ${$(prom)} promedio`;
        return <Fila key={s.tipo} nombre={nombreServicio(s.tipo)} importe={s.importe} total={d.total} sub={sub} />;
      })}

      {tab === "cobro" && (<>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginTop: 12 }}>
          {d.cobro.map((c, i) => <div key={c.cobro} style={{ width: `${(c.importe / (d.total || 1)) * 100}%`, background: COLORES[i % COLORES.length] }} />)}
        </div>
        {d.cobro.map((c, i) => <Fila key={c.cobro} nombre={c.cobro} importe={c.importe} total={d.total} color={COLORES[i % COLORES.length]} sub={`${num(c.n)} cobros`} />)}
      </>)}

      {tab === "rubro" && (<>
        {turno && <div style={{ fontSize: 11.5, color: GRIS, marginTop: 10 }}>Los artículos no tienen turno: rubros y top 10 son del {esMes ? "mes" : "día"} completo.</div>}
        {!arts ? (
          <div style={{ marginTop: 12, border: "1px dashed #d4d4d8", borderRadius: 12, padding: "9px 11px", fontSize: 12, color: GRIS }}>
            No hay ventas por artículo para este {esMes ? "mes" : "día"}{d.ultimoCompleto && !esMes && desde > d.ultimoCompleto ? " todavía (llegan un día después que la caja)" : ""}.
          </div>
        ) : (<>
          <div style={{ marginTop: 12 }}><Segmento opciones={[["rubro", "Rubro"], ["subrubro", "Subrubro"]]} valor={vistaRubro} onCambio={setVistaRubro} /></div>
          {vistaRubro === "rubro"
            ? <Lista key="r" items={arts.rubros} etiqueta="rubros" render={(r) => <Fila key={r.rubro} nombre={titulo(r.rubro)} importe={r.importe} total={arts.total} />} />
            : <Lista key="s" items={arts.subrubros} etiqueta="subrubros" render={(r) => <Fila key={`${r.rubro}|${r.subrubro}`} nombre={titulo(r.subrubro)} importe={r.importe} total={arts.total} sub={titulo(r.rubro)} />} />}
          <Seccion derecha={<Segmento opciones={[["importe", "$"], ["unidades", "Unidades"]]} valor={modoTop} onCambio={setModoTop} />}>Top 10 artículos</Seccion>
          <div style={{ marginTop: 6, fontSize: 13.5 }}>
            {(modoTop === "importe" ? arts.topImporte : arts.topUnidades).map((a, i) => (
              <div key={a.nombre} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: "1px solid #f4f4f5" }}>
                <span style={{ width: 18, textAlign: "right", color: "#a1a1aa", fontSize: 12 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo(a.nombre)}</span>
                {modoTop === "importe"
                  ? <><em style={{ fontStyle: "normal", color: GRIS, fontSize: 12, whiteSpace: "nowrap" }}>{num(a.unidades)} u</em><b style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{$(a.importe)}</b></>
                  : <><b style={{ whiteSpace: "nowrap" }}>{num(a.unidades)} u</b><em style={{ fontStyle: "normal", color: GRIS, fontSize: 12, whiteSpace: "nowrap", minWidth: 76, textAlign: "right" }}>{$(a.importe)}</em></>}
              </div>
            ))}
          </div>
          {modoTop === "importe" && arts.total > 0 && <div style={{ marginTop: 6, fontSize: 12, color: GRIS }}>los 10 = {pct(arts.topImporte.reduce((t, a) => t + a.importe, 0), arts.total)}% de la venta {esMes ? "del mes" : "del día"}</div>}
          {modoTop === "unidades" && <div style={{ marginTop: 6, fontSize: 12, color: GRIS }}>sin lo que va a $ 0 dentro de un combo (cubierto, guarniciones…)</div>}
        </>)}
      </>)}

      {tab === "mozo" && (<>
        {d.mozos.map((m) => <Fila key={m.mozo} nombre={nombreMozo(m.mozo)} importe={m.importe} total={d.total} sub={`${num(m.tickets)} tickets · ${$(m.tickets ? m.importe / m.tickets : 0)} promedio`} />)}
        {d.mozos.length > 0 && d.mozos.every((m) => /SALON|DELIVERY|PEDIDOSYA|RAPPI|TAKEAWAY|EATS|CAJERO|^—$/i.test(nombreMozo(m.mozo)) || /^\d+$/.test(nombreMozo(m.mozo))) && (
          <div style={{ marginTop: 10, border: "1px dashed #d4d4d8", borderRadius: 12, padding: "9px 11px", fontSize: 12, color: GRIS }}>En este PDV la caja no carga el mozo de cada mesa (va como «Salón» o la app), así que no hay venta por mozo.</div>
        )}
      </>)}

      {tab === "revisar" && (<>
        {/* Revisar (Diego 09/11/2026, mockup_revisar_detalle): 4 tarjetas del mismo alto; cada una abre
            una hoja con su resumen y su detalle. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: 8, marginTop: 12 }}>
          {[
            ["descuentos", "Descuentos", $(d.descuentos.importe), `${num(d.descuentos.tickets)} tickets · ${pct1(d.descuentos.importe, d.bruto)} de lo bruto`],
            ["pagos", "Pagos desde la caja", $(d.pagosCaja.reduce((t, p) => t + p.importe, 0)), `${num(d.pagosCaja.length)} ${d.pagosCaja.length === 1 ? "pago" : "pagos"}`],
            ["anulaciones", "Anulaciones", $(d.anulaciones.importe), (() => {
              const sin = d.anulaciones.detalle.filter((a) => a.refacturada === null).length;
              return sin ? `${num(sin)} sin re-facturar` : `${num(d.anulaciones.n)} ${d.anulaciones.n === 1 ? "nota de crédito" : "notas de crédito"}`;
            })()],
            d.stock
              ? ["stock", "Movimientos de stock", $(d.stock.importe), `${num(d.stock.remitos)} ${d.stock.remitos === 1 ? "remito" : "remitos"}`]
              : ["stock", "Movimientos de stock", "—", "todavía sin datos", true],
          ].map(([k, t, v, sub, gris]) => (
            <button key={k} type="button" disabled={gris} onClick={() => setHoja(k)}
              style={{ position: "relative", textAlign: "left", font: "inherit", color: "inherit", cursor: gris ? "default" : "pointer", border: `1px solid ${BORDE}`, borderRadius: 12, padding: "8px 22px 8px 10px", background: gris ? "#fafafa" : "#fff", minWidth: 0 }}>
              {!gris && <span style={{ position: "absolute", right: 9, top: 7, color: AZUL, fontSize: 15 }}>›</span>}
              <div style={{ fontSize: 11.5, color: GRIS }}>{t}</div>
              <b style={{ display: "block", fontSize: 16, marginTop: 1, whiteSpace: "nowrap", color: gris ? "#a1a1aa" : undefined }}>{v}</b>
              <div style={{ fontSize: 11.5, color: GRIS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: GRIS, textAlign: "center", marginTop: 8 }}>tocá una tarjeta para ver el detalle</div>
        {hoja && <HojaRevisar tipo={hoja} d={d} esMes={esMes} tituloPeriodo={tituloPeriodo} mover={mover} sigDeshabilitado={sigDeshabilitado} onCerrar={() => setHoja(null)} />}
      </>)}
    </div>
  );
}
