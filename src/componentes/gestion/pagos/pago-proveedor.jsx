/* eslint-disable */
// Traído de lazarillo_gestion/components/cta-cte/pago-proveedor.tsx (mismas pantallas; datos de Lazarillo vía @/gestion/compat).
import React, { useRef, useState } from "react";
import { cn } from "@/gestion/compat";
import { fmtPesos } from "@/gestion/impagasClasificar";
import { importeAInput, normalizarReferencia, parsearImporteAR } from "@/gestion/impagasAperturas";
import { FechaInput, ImporteInput, hoyISO } from "./deuda-pdv";
import { useMediosPago } from "@/gestion/hooksPanel";
import { useAbmMediosPago } from "../MediosPagoAbm";
import { mediosParaElegir, medioPorDefecto } from "@/gestion/cargaUtils";
import { numeroPago } from "@/gestion/pagosImputar";
import { TIPOS_COMPROBANTE, abrirComprobante, subirComprobante } from "@/gestion/comprobantePago";
// Comprobante adjunto (Diego 23/11/2026): «Adjuntar comprobante» (o soltarlo sobre la barra) lo sube,
// lo lee y completa importe, fecha, medio e ID; queda guardado con el pago. `leido` viene del padre
// para no perderlo si la barra se vuelve a armar (p. ej. al tildar solas las facturas que suman).
// Cuenta de un comprobante: titular · banco · CBU/CVU · alias · CUIT (Diego 23/11/2026: «cuenta receptor e
// ID de cuenta o CVU, ídem emisor», solo cuando se adjunta el comprobante).
const fmtCuit = (c) => (c && c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c);
// Más de un comprobante (Diego 23/11/2026: «se paga de 2 bancos distintos»): cada comprobante es un pago
// aparte, con su importe, medio, fecha, ID y quién paga; se imputan uno detrás del otro a las facturas
// tildadas, de la más vieja a la más nueva.
const filaDeComprobante = (r, pdvDefault) => {
    const d = r?.datos || {};
    return { comp: r, importe: d.importe > 0 ? importeAInput(d.importe) : "", fecha: d.fecha || hoyISO(), medio: r?.medio || "", referencia: d.operacion || "", pdvPaga: pdvDefault, fechaVer: 0 };
};
// Cuotas (usuaria 27/11/2026): mismo día de los meses siguientes (si el mes es más corto, el último día).
const sumarMeses = (iso, k) => {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y || !m || !d) return "";
    const ult = new Date(y, m - 1 + k + 1, 0).getDate();
    const f = new Date(y, m - 1 + k, Math.min(d, ult));
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};
const textoCuenta = (c) => [c.titular, c.banco, c.cbu && `${c.tipoCuenta || "CBU"} ${c.cbu}`, c.alias && `alias ${c.alias}`, c.cuit && `CUIT ${fmtCuit(c.cuit)}`].filter(Boolean).join(" · ");
export function FormPagoProveedor({ modo, proveedor, proveedorCuit, pdvs, pdvDefault, aCuenta, guardando, onCancel, onConfirm, leido, onLeido }) {
    const editando = modo.tipo === "editar";
    const base = modo.tipo === "facturas" ? modo.saldo : editando ? modo.pago.importe : 0;
    const dl = !editando && leido?.datos ? leido.datos : {};
    const [importe, setImporte] = useState(dl.importe > 0 ? importeAInput(dl.importe) : base > 0 ? importeAInput(base) : "");
    const [fecha, setFecha] = useState(editando ? modo.pago.fecha : dl.fecha || hoyISO());
    const [fechaVer, setFechaVer] = useState(0); // remonta FechaInput cuando la fecha llega del comprobante
    const { data: medios } = useMediosPago();
    const abmMedios = useAbmMediosPago();
    const lista = mediosParaElegir(medios, editando ? modo.pago.medio : null);
    const [medioSel, setMedio] = useState(editando ? modo.pago.medio : (!editando && leido?.medio) || "");
    const medio = medioSel || medioPorDefecto(lista)?.nombre || "";
    const [referencia, setReferencia] = useState(editando ? modo.pago.referencia ?? "" : dl.operacion || "");
    const [comp, setComp] = useState(editando ? (modo.pago.comprobanteId ? { comprobanteId: modo.pago.comprobanteId, nombre: "comprobante" } : null) : leido ?? null);
    const [leyendo, setLeyendo] = useState(false);
    const [extras, setExtras] = useState(() => (!editando && Array.isArray(leido?.extras) ? leido.extras.map((r) => filaDeComprobante(r, null)) : []));
    // Lo leído hasta ahora (principal + otros), para el padre: tilda las facturas que suma el total.
    const leidosRef = useRef({ main: !editando ? leido ?? null : null, extras: !editando && Array.isArray(leido?.extras) ? leido.extras : [] });
    const [arrastrando, setArrastrando] = useState(false);
    const archivoRef = useRef(null);
    const [pdvPaga, setPdvPagaSel] = useState(editando ? modo.pago.pdvPagaId : pdvDefault ?? pdvs[0]?.id ?? null);
    // Si nadie eligió quién paga y cambian las facturas tildadas, sigue a la sucursal de esas facturas.
    const pdvElegido = useRef(editando);
    const setPdvPaga = (v) => { pdvElegido.current = true; setPdvPagaSel(v); };
    const [pdvDefVista, setPdvDefVista] = useState(pdvDefault);
    if (pdvDefVista !== pdvDefault) {
        setPdvDefVista(pdvDefault);
        if (!pdvElegido.current && pdvDefault != null) setPdvPagaSel(pdvDefault);
    }
    const [error, setError] = useState(null);
    // ── En cuotas (usuaria 27/11/2026): el Importe de arriba es la 1ª cuota (se paga hoy); las demás quedan
    // en un plan con su vencimiento y, si se tilda, un aviso flotante el día que vence cada una.
    const [enCuotas, setEnCuotas] = useState(false);
    const [cantCuotas, setCantCuotas] = useState(3);
    const [resto, setResto] = useState([]); // cuotas 2..N: { importe: "texto", vence: "YYYY-MM-DD", ver }
    const [recordarCuotas, setRecordarCuotas] = useState(true);
    function armarCuotas(n, fechaBase = fecha) {
        const total = modo.tipo === "facturas" ? modo.saldo : 0;
        const nn = Math.max(2, Math.min(120, Math.round(Number(n) || 2)));
        const una = Math.floor((total / nn) * 100) / 100;
        const ultima = Math.round((total - una * (nn - 1)) * 100) / 100;
        setImporte(importeAInput(una));
        setResto(Array.from({ length: nn - 1 }, (_, i) => ({ importe: importeAInput(i === nn - 2 ? ultima : una), vence: sumarMeses(fechaBase, i + 1), ver: Date.now() + i })));
    }
    // "cuenta:ID" = usar el disponible de un pago a cuenta (no crea otro pago).
    const usado = medio.startsWith("cuenta:") ? aCuenta.find((p) => p.id === Number(medio.slice(7))) ?? null : null;
    const conId = !usado && ((lista.find((m) => m.nombre === medio)?.pideId ?? false) || !!referencia || !!comp);
    // Al tildar o destildar, el importe se rearma con la nueva suma (salvo que venga del comprobante).
    const [baseVista, setBaseVista] = useState(base);
    if (baseVista !== base) {
        setBaseVista(base);
        if (!(comp?.datos?.importe > 0) || editando)
            setImporte(importeAInput(usado ? Math.min(base, usado.disponible) : base));
    }
    async function adjuntar(files) {
        const lista = Array.from(files || []).filter(Boolean);
        if (!lista.length || leyendo) return;
        setError(null);
        setLeyendo(true);
        try {
            for (const file of lista) await adjuntarUno(file);
        }
        finally {
            setLeyendo(false);
        }
    }
    async function adjuntarUno(file) {
        try {
            const r = await subirComprobante(file);
            // Ya hay uno: este va como otro pago (no en edición, ni aplicando un pago a cuenta).
            if (!editando && leidosRef.current.main) {
                leidosRef.current = { ...leidosRef.current, extras: [...leidosRef.current.extras, r] };
                setExtras((xs) => [...xs, filaDeComprobante(r, null)]);
                const total = [leidosRef.current.main, ...leidosRef.current.extras].reduce((a, x) => a + (Number(x?.datos?.importe) || 0), 0);
                onLeido?.({ ...leidosRef.current.main, extras: leidosRef.current.extras }, total);
                return;
            }
            if (!editando) leidosRef.current = { ...leidosRef.current, main: r };
            setComp(r);
            const d = r.datos || {};
            if (editando) {
                if (!referencia && d.operacion) setReferencia(d.operacion);
            }
            else {
                if (d.importe > 0) setImporte(importeAInput(d.importe));
                if (d.fecha) { setFecha(d.fecha); setFechaVer((n) => n + 1); }
                if (r.medio) setMedio(r.medio);
                if (d.operacion) setReferencia(d.operacion);
            }
            if (!editando) {
                const total = [r, ...leidosRef.current.extras].reduce((a, x) => a + (Number(x?.datos?.importe) || 0), 0);
                onLeido?.({ ...r, extras: leidosRef.current.extras }, total);
            }
            else onLeido?.(r);
        }
        catch (e) {
            setError(`${file?.name ? `${file.name}: ` : ""}${e?.message || "No se pudo subir el comprobante."}`);
        }
    }
    const cambiarExtra = (i, cambio) => setExtras((xs) => xs.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
    const quitarExtra = (i) => {
        leidosRef.current = { ...leidosRef.current, extras: leidosRef.current.extras.filter((r) => r !== extras[i]?.comp) };
        setExtras((xs) => xs.filter((_, j) => j !== i));
    };
    const valorExtras = extras.reduce((a, x) => a + (parsearImporteAR(x.importe) ?? 0), 0);
    const valor = parsearImporteAR(importe) ?? 0;
    function cambiarMedio(v) {
        setMedio(v);
        const p = v.startsWith("cuenta:") ? aCuenta.find((x) => x.id === Number(v.slice(7))) : null;
        if (p && valor > p.disponible)
            setImporte(importeAInput(p.disponible));
    }
    async function confirmar() {
        setError(null);
        if (editando) {
            if (!medio) {
                setError("Elegí un medio de pago.");
                return;
            }
            if (pdvPaga == null) {
                setError("Elegí qué PDV paga.");
                return;
            }
            let ref = null;
            if (conId && referencia.trim()) {
                ref = normalizarReferencia(referencia);
                if (!ref) {
                    setError("El ID tiene que ser de letras y números.");
                    return;
                }
            }
            if (!(valor > 0)) {
                setError("Cargá un importe.");
                return;
            }
            const err = await onConfirm({ fecha, medio, referencia: ref, pdvPagaId: pdvPaga, importe: valor, comprobanteId: comp?.comprobanteId ?? null });
            if (err)
                setError(err);
            return;
        }
        if (!(valor > 0)) {
            setError("Cargá un importe.");
            return;
        }
        if (usado) {
            if (valor > usado.disponible + 0.005) {
                setError(`${numeroPago(usado.id)} tiene ${fmtPesos(usado.disponible)} disponibles.`);
                return;
            }
            const err = await onConfirm({ usarPago: usado.id, importe: valor });
            if (err)
                setError(err);
            return;
        }
        if (!medio) {
            setError("Elegí un medio de pago (se dan de alta desde el mismo desplegable).");
            return;
        }
        if (pdvPaga == null) {
            setError("Elegí qué PDV paga.");
            return;
        }
        let ref = null;
        if (conId && referencia.trim()) {
            ref = normalizarReferencia(referencia);
            if (!ref) {
                setError("El ID tiene que ser de letras y números.");
                return;
            }
        }
        const otros = [];
        for (const [i, x] of extras.entries()) {
            const imp = parsearImporteAR(x.importe) ?? 0;
            const med = x.medio || medioPorDefecto(lista)?.nombre || "";
            if (!(imp > 0)) { setError(`Cargá el importe del comprobante ${i + 2}.`); return; }
            if (!med) { setError(`Elegí el medio del comprobante ${i + 2}.`); return; }
            const r = x.referencia.trim() ? normalizarReferencia(x.referencia) : null;
            if (x.referencia.trim() && !r) { setError(`El ID del comprobante ${i + 2} tiene que ser de letras y números.`); return; }
            if (r && r === ref) { setError(`El comprobante ${i + 2} tiene el mismo ID que el primero.`); return; }
            otros.push({ fecha: x.fecha, medio: med, referencia: r, pdvPagaId: x.pdvPaga ?? pdvPaga, importe: imp, comprobanteId: x.comp?.comprobanteId ?? null });
        }
        let cuotasPlan = null;
        if (enCuotas && modo.tipo === "facturas") {
            const cs = [];
            for (const [i, x] of resto.entries()) {
                const imp = parsearImporteAR(x.importe) ?? 0;
                if (!(imp > 0)) { setError(`Cargá el importe de la cuota ${i + 2}.`); return; }
                if (!x.vence) { setError(`Cargá cuándo vence la cuota ${i + 2}.`); return; }
                cs.push({ importe: imp, vence: x.vence });
            }
            const suma = valor + cs.reduce((a, c) => a + c.importe, 0);
            if (suma > modo.saldo + 0.5) { setError(`Las cuotas suman ${fmtPesos(suma)} y el saldo es ${fmtPesos(modo.saldo)}.`); return; }
            cuotasPlan = { cuotas: cs, recordar: recordarCuotas };
        }
        const err = await onConfirm({ fecha, medio, referencia: ref, pdvPagaId: pdvPaga, importe: valor, comprobanteId: comp?.comprobanteId ?? null, ...(otros.length ? { extras: otros } : {}), ...(cuotasPlan ? { cuotasPlan } : {}) });
        if (err)
            setError(err);
    }
    const input = "h-11 sm:h-8 min-w-0 flex-1 sm:flex-none rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm";
    const etiqueta = "w-12 shrink-0 text-muted-foreground";
    const titulo = modo.tipo === "facturas" ? `Pagar ${modo.n} factura${modo.n === 1 ? "" : "s"} · ${proveedor}`
        : modo.tipo === "cuenta" ? `Pago a cuenta · ${proveedor}` : `Editar ${numeroPago(modo.pago.id)}`;
    const totalPagos = valor + (usado ? 0 : valorExtras);
    const excedente = modo.tipo === "facturas" && !usado ? totalPagos - modo.saldo : 0;
    const ayuda = editando
        ? (valor > modo.pago.importe + 0.005 ? `Lo que sumás (${fmtPesos(valor - modo.pago.importe)}) queda a cuenta de ${proveedor}.`
            : valor < modo.pago.importe - 0.005 ? "Si no alcanza para lo que ya pagó, se suelta primero lo de las facturas más nuevas (quedan parciales o impagas)."
                : "Fecha, medio, ID, PDV que paga e importe.")
        : enCuotas ? `Hoy se paga la 1ª cuota (el Importe de arriba): las facturas quedan parciales y las otras ${resto.length} cuotas quedan en el plan.`
        : usado ? `No crea un pago nuevo: se aplica el disponible de ${numeroPago(usado.id)}, de la factura más vieja a la más nueva.`
            : modo.tipo === "cuenta" ? `Queda a cuenta de ${proveedor}. Después lo aplicás tildando facturas.`
                : excedente > 0.5 ? `Salda las facturas tildadas y ${fmtPesos(excedente)} quedan a cuenta de ${proveedor}.`
                    : totalPagos < modo.saldo - 0.005 ? "Se imputa de la más vieja a la más nueva; la última queda parcial."
                        : "Salda las facturas tildadas, de la más vieja a la más nueva.";
    const dc = comp?.datos || {};
    const importeLeido = (Number(dc.importe) || 0) + extras.reduce((a, x) => a + (Number(x.comp?.datos?.importe) || 0), 0);
    const difComp = !editando && modo.tipo === "facturas" && importeLeido > 0 ? importeLeido - modo.saldo : 0;
    return (<div onDragOver={(e) => { if (!usado) { e.preventDefault(); setArrastrando(true); } }} onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); if (!usado) void adjuntar(editando ? [e.dataTransfer.files?.[0]] : e.dataTransfer.files); }}
        className={cn("border-t border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950 px-6 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.06)] shrink-0 -mx-6", arrastrando && "outline-2 outline-dashed outline-[#5BC2EA] -outline-offset-4")}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm">
            <b className="whitespace-nowrap">{titulo}</b>
            {modo.tipo === "facturas" && <span className="tabular-nums text-muted-foreground whitespace-nowrap">Saldo {fmtPesos(modo.saldo)}</span>}
            {extras.length > 0 && !usado && <span className="tabular-nums font-semibold whitespace-nowrap">· {extras.length + 1} pagos por {fmtPesos(totalPagos)}</span>}
          </div>
          <div className="grid w-full sm:w-fit grid-cols-1 sm:grid-cols-[auto_auto_auto] items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-1.5"><span className={cn(etiqueta, enCuotas && "w-auto whitespace-nowrap")} title={enCuotas ? "1ª cuota (se paga hoy)" : undefined}>{enCuotas ? "1ª cuota" : "Importe"}</span>
              <ImporteInput value={importe} onChange={setImporte} className={cn(input, "sm:w-40 text-right tabular-nums")}/>
            </label>
            <label className="flex items-center gap-1.5"><span className={etiqueta}>Medio</span>
              <select value={medio} onChange={abmMedios.alElegir(cambiarMedio)} className={cn(input, "sm:w-56")}>
              {!medio && <option value="">Elegí el medio…</option>}
                {abmMedios.opcion}
                {lista.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}{m.activo ? "" : " (desactivado)"}</option>)}
                {modo.tipo === "facturas" && aCuenta.length > 0 && (<optgroup label="Usar un pago a cuenta">
                    {aCuenta.map((p) => <option key={p.id} value={`cuenta:${p.id}`}>A cuenta — {numeroPago(p.id)} · disponible {fmtPesos(p.disponible)}</option>)}
                  </optgroup>)}
              </select>{abmMedios.dialogo}
            </label>
            {!usado ? (<label className="flex items-center gap-1.5"><span className={etiqueta}>Fecha</span>
                <FechaInput key={fechaVer} value={fecha} onChange={setFecha} className={cn(input, "sm:w-32 tabular-nums")}/>
              </label>) : <span />}
            {!usado && (<label className="flex items-center gap-1.5"><span className={etiqueta}>Paga</span>
                <select value={pdvPaga ?? ""} onChange={(e) => setPdvPaga(Number(e.target.value))} className={cn(input, "sm:w-56")}>
                  {pdvs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>)}
            {conId && (<label className="flex items-center gap-1.5"><span className={etiqueta}>ID</span>
                <input value={referencia} onChange={(e) => setReferencia(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} placeholder="opcional" className={cn(input, "sm:w-56 font-mono")}/>
              </label>)}
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground">{ayuda}</div>
          {modo.tipo === "facturas" && !editando && !usado && extras.length === 0 && modo.saldo > 0.5 && (<div className="mt-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none min-h-9">
                  <input type="checkbox" checked={enCuotas} onChange={(e) => { const v = e.target.checked; setEnCuotas(v); if (v) armarCuotas(cantCuotas); else setImporte(importeAInput(modo.saldo)); }} className="h-4 w-4"/>
                  <b>En cuotas</b>
                </label>
                {enCuotas && <span className="inline-flex items-center gap-1.5">· <input type="number" min={2} max={120} value={cantCuotas} aria-label="Cantidad de cuotas"
                    onChange={(e) => { const n = Number(e.target.value); setCantCuotas(e.target.value); if (n >= 2 && n <= 120) armarCuotas(n); }}
                    className={cn(input, "w-16 flex-none sm:w-16 text-center")}/> cuotas</span>}
              </div>
              {enCuotas && (<div className="mt-1.5 rounded-md border border-sky-200 dark:border-sky-900 bg-white dark:bg-zinc-900 p-2">
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-[13px]">
                    <span className="text-muted-foreground">1ª</span>
                    <span className="text-muted-foreground">hoy · {fecha ? fecha.split("-").reverse().join("/") : ""}</span>
                    <span className="tabular-nums text-right font-semibold">{fmtPesos(valor)}</span>
                    {resto.map((x, i) => (<React.Fragment key={x.ver}>
                        <span className="text-muted-foreground">{i + 2}ª</span>
                        <span className="flex items-center gap-1.5">vence <FechaInput key={`v${x.ver}`} value={x.vence} onChange={(v) => setResto((rs) => rs.map((r, j) => (j === i ? { ...r, vence: v } : r)))} className={cn(input, "w-32 sm:w-32 tabular-nums")}/></span>
                        <ImporteInput value={x.importe} onChange={(v) => setResto((rs) => rs.map((r, j) => (j === i ? { ...r, importe: v } : r)))} className={cn(input, "w-32 sm:w-32 text-right tabular-nums")}/>
                      </React.Fragment>))}
                  </div>
                  {(() => {
                    const suma = valor + resto.reduce((a, x) => a + (parsearImporteAR(x.importe) ?? 0), 0);
                    const dif = modo.saldo - suma;
                    return <div className={cn("mt-1.5 text-[11.5px]", Math.abs(dif) > 0.5 ? "font-semibold text-[#b45309]" : "text-muted-foreground")}>
                        Las {resto.length + 1} cuotas suman {fmtPesos(suma)}{Math.abs(dif) > 0.5 ? (dif > 0 ? ` · faltan ${fmtPesos(dif)} para el saldo` : ` · se pasan ${fmtPesos(-dif)} del saldo`) : " = saldo de las facturas"}.
                      </div>;
                  })()}
                  <label className="mt-1.5 flex items-center gap-2 cursor-pointer select-none text-[12.5px] min-h-9">
                    <input type="checkbox" checked={recordarCuotas} onChange={(e) => setRecordarCuotas(e.target.checked)} className="h-4 w-4"/>
                    Avisarme el día que vence cada cuota (aviso en pantalla con «Marcar como paga»)
                  </label>
                </div>)}
            </div>)}
          {leyendo && <div className="mt-1.5 text-xs text-[#0d6fa8]">Leyendo el comprobante…</div>}
          {comp && !leyendo && (<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
              <span className="inline-flex items-center gap-1 rounded-md border border-[#5BC2EA] bg-white px-1.5 py-0.5 text-[#0e7490] dark:bg-zinc-900">
                📎 <button type="button" onClick={() => void abrirComprobante(comp.comprobanteId).catch((e) => setError(e.message))} className="max-w-48 truncate hover:underline" title="Abrir el comprobante">{comp.nombre}</button>
                <button type="button" onClick={() => { setComp(null); leidosRef.current = { ...leidosRef.current, main: null }; }} className="text-zinc-400 hover:text-zinc-700" title="Sacar el comprobante (no cambia los datos)">×</button>
              </span>
              {comp.datos && (dc.importe > 0 || dc.fecha) && <span className="text-muted-foreground">
                  Leído: {[dc.importe > 0 && fmtPesos(dc.importe), dc.fecha && dc.fecha.split("-").reverse().join("/"), dc.banco, dc.operacion && `ID ${dc.operacion}`].filter(Boolean).join(" · ")}. Revisá y confirmá.
                </span>}
              {comp.error && <span className="text-[#b45309]">{comp.error}</span>}
              {comp.nota && <span className="font-semibold text-[#0e7490]">{comp.nota}</span>}
              {Math.abs(difComp) > 1 && !comp.nota && <span className="font-semibold text-[#b45309]">{extras.length ? `Los comprobantes suman ${fmtPesos(importeLeido)}` : `El comprobante es de ${fmtPesos(dc.importe)}`} y las facturas tildadas suman {fmtPesos(modo.saldo)}{difComp > 0 ? `: ${fmtPesos(difComp)} quedan a cuenta.` : "."}</span>}
            </div>)}
          {comp && !leyendo && (dc.emisor || dc.receptor) && (<div className="mt-1 grid gap-0.5 text-[11.5px] text-muted-foreground">
              {dc.emisor && <div className="min-w-0 break-words"><b className="font-semibold text-zinc-600 dark:text-zinc-300">De:</b> {textoCuenta(dc.emisor)}</div>}
              {dc.receptor && <div className="min-w-0 break-words"><b className="font-semibold text-zinc-600 dark:text-zinc-300">Para:</b> {textoCuenta(dc.receptor)}</div>}
              {proveedorCuit && dc.receptor?.cuit && String(proveedorCuit).replace(/\D/g, "") !== dc.receptor.cuit && (<div className="font-semibold text-[#b45309]">
                  ⚠ El comprobante es para CUIT {fmtCuit(dc.receptor.cuit)} y {proveedor} tiene CUIT {fmtCuit(String(proveedorCuit).replace(/\D/g, ""))}. Revisá que sea el pago de este proveedor.
                </div>)}
            </div>)}
          {!usado && extras.map((x, i) => {
                const dx = x.comp?.datos || {};
                const medX = x.medio || medioPorDefecto(lista)?.nombre || "";
                return (<div key={x.comp?.comprobanteId ?? i} className="mt-3 border-t border-dashed border-sky-200 pt-2.5 dark:border-sky-900">
                  <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300">
                    Pago {i + 2}
                    {x.comp && <span className="inline-flex items-center gap-1 rounded-md border border-[#5BC2EA] bg-white px-1.5 py-0.5 font-normal text-[#0e7490] dark:bg-zinc-900">
                      📎 <button type="button" onClick={() => void abrirComprobante(x.comp.comprobanteId).catch((e) => setError(e.message))} className="max-w-48 truncate hover:underline" title="Abrir el comprobante">{x.comp.nombre}</button>
                    </span>}
                    <button type="button" onClick={() => quitarExtra(i)} className="ml-auto font-normal text-zinc-400 hover:text-red-600" title="Sacar este pago">quitar</button>
                  </div>
                  <div className="grid w-full sm:w-fit grid-cols-1 sm:grid-cols-[auto_auto_auto] items-center gap-x-5 gap-y-2 text-sm">
                    <label className="flex items-center gap-1.5"><span className={etiqueta}>Importe</span>
                      <ImporteInput value={x.importe} onChange={(v) => cambiarExtra(i, { importe: v })} className={cn(input, "sm:w-40 text-right tabular-nums")}/>
                    </label>
                    <label className="flex items-center gap-1.5"><span className={etiqueta}>Medio</span>
                      <select value={medX} onChange={abmMedios.alElegir((v) => cambiarExtra(i, { medio: v }))} className={cn(input, "sm:w-56")}>
                        {!medX && <option value="">Elegí el medio…</option>}
                        {abmMedios.opcion}
                        {lista.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}{m.activo ? "" : " (desactivado)"}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5"><span className={etiqueta}>Fecha</span>
                      <FechaInput key={`${i}-${x.fechaVer}`} value={x.fecha} onChange={(v) => cambiarExtra(i, { fecha: v })} className={cn(input, "sm:w-32 tabular-nums")}/>
                    </label>
                    <label className="flex items-center gap-1.5"><span className={etiqueta}>Paga</span>
                      <select value={x.pdvPaga ?? pdvPaga ?? ""} onChange={(e) => cambiarExtra(i, { pdvPaga: Number(e.target.value) })} className={cn(input, "sm:w-56")}>
                        {pdvs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5"><span className={etiqueta}>ID</span>
                      <input value={x.referencia} onChange={(e) => cambiarExtra(i, { referencia: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() })} placeholder="opcional" className={cn(input, "sm:w-56 font-mono")}/>
                    </label>
                  </div>
                  {(dx.importe > 0 || x.comp?.error) && <div className="mt-1 text-[11.5px] text-muted-foreground">
                      {dx.importe > 0 ? `Leído: ${[fmtPesos(dx.importe), dx.fecha && dx.fecha.split("-").reverse().join("/"), dx.banco, dx.operacion && `ID ${dx.operacion}`].filter(Boolean).join(" · ")}.` : null}
                      {x.comp?.error && <span className="text-[#b45309]"> {x.comp.error}</span>}
                    </div>}
                  {(dx.emisor || dx.receptor) && (<div className="mt-0.5 grid gap-0.5 text-[11.5px] text-muted-foreground">
                      {dx.emisor && <div className="min-w-0 break-words"><b className="font-semibold text-zinc-600 dark:text-zinc-300">De:</b> {textoCuenta(dx.emisor)}</div>}
                      {dx.receptor && <div className="min-w-0 break-words"><b className="font-semibold text-zinc-600 dark:text-zinc-300">Para:</b> {textoCuenta(dx.receptor)}</div>}
                    </div>)}
                </div>);
            })}
          {error && <div className="mt-1.5 text-xs text-destructive">{error}</div>}
        </div>
        <div className="flex shrink-0 flex-row flex-wrap sm:flex-col gap-1.5">
          <button type="button" disabled={guardando} onClick={() => void confirmar()} className="h-11 sm:h-8 flex-1 sm:flex-none min-w-28 px-3 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm disabled:opacity-40">
            {usado ? `Aplicar ${numeroPago(usado.id)}` : editando ? "Guardar" : "Confirmar"}
          </button>
          <button type="button" onClick={onCancel} className="h-11 sm:h-8 flex-1 sm:flex-none min-w-28 px-3 rounded-md border border-zinc-300 dark:border-zinc-600 text-sm">
            {modo.tipo === "facturas" ? "Limpiar" : "Cancelar"}
          </button>
          {!usado && (<>
              <button type="button" disabled={leyendo} onClick={() => archivoRef.current?.click()} title={comp && !editando ? "Otro comprobante: va como otro pago (ej. la parte que salió de otro banco). Para cambiar el primero, sacalo con la ×." : "PDF o foto de la transferencia: completa importe, fecha, medio e ID. Podés elegir varios o soltarlos sobre esta barra."}
                className="h-11 sm:h-8 flex-1 max-sm:basis-full sm:flex-none min-w-28 px-3 rounded-md border border-dashed border-[#5BC2EA] bg-white text-[#0e7490] text-sm whitespace-nowrap disabled:opacity-50 dark:bg-zinc-900">
                {leyendo ? "Leyendo…" : comp && editando ? "📎 Cambiar comprobante" : comp ? "📎 Otro comprobante" : "📎 Adjuntar comprobante"}
              </button>
              <input ref={archivoRef} type="file" accept={TIPOS_COMPROBANTE} multiple={!editando} className="hidden" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; void adjuntar(fs); }}/>
            </>)}
        </div>
      </div>
    </div>);
}
