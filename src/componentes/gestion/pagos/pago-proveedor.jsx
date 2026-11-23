/* eslint-disable */
// Traído de lazarillo_gestion/components/cta-cte/pago-proveedor.tsx (mismas pantallas; datos de Lazarillo vía @/gestion/compat).
import { useRef, useState } from "react";
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
export function FormPagoProveedor({ modo, proveedor, pdvs, pdvDefault, aCuenta, guardando, onCancel, onConfirm, leido, onLeido }) {
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
    const [arrastrando, setArrastrando] = useState(false);
    const archivoRef = useRef(null);
    const [pdvPaga, setPdvPaga] = useState(editando ? modo.pago.pdvPagaId : pdvDefault ?? pdvs[0]?.id ?? null);
    const [error, setError] = useState(null);
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
    async function adjuntar(file) {
        if (!file || leyendo) return;
        setError(null);
        setLeyendo(true);
        try {
            const r = await subirComprobante(file);
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
            onLeido?.(r);
        }
        catch (e) {
            setError(e?.message || "No se pudo subir el comprobante.");
        }
        finally {
            setLeyendo(false);
        }
    }
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
        const err = await onConfirm({ fecha, medio, referencia: ref, pdvPagaId: pdvPaga, importe: valor, comprobanteId: comp?.comprobanteId ?? null });
        if (err)
            setError(err);
    }
    const input = "h-11 sm:h-8 min-w-0 flex-1 sm:flex-none rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm";
    const etiqueta = "w-12 shrink-0 text-muted-foreground";
    const titulo = modo.tipo === "facturas" ? `Pagar ${modo.n} factura${modo.n === 1 ? "" : "s"} · ${proveedor}`
        : modo.tipo === "cuenta" ? `Pago a cuenta · ${proveedor}` : `Editar ${numeroPago(modo.pago.id)}`;
    const excedente = modo.tipo === "facturas" && !usado ? valor - modo.saldo : 0;
    const ayuda = editando
        ? (valor > modo.pago.importe + 0.005 ? `Lo que sumás (${fmtPesos(valor - modo.pago.importe)}) queda a cuenta de ${proveedor}.`
            : valor < modo.pago.importe - 0.005 ? "Si no alcanza para lo que ya pagó, se suelta primero lo de las facturas más nuevas (quedan parciales o impagas)."
                : "Fecha, medio, ID, PDV que paga e importe.")
        : usado ? `No crea un pago nuevo: se aplica el disponible de ${numeroPago(usado.id)}, de la factura más vieja a la más nueva.`
            : modo.tipo === "cuenta" ? `Queda a cuenta de ${proveedor}. Después lo aplicás tildando facturas.`
                : excedente > 0.5 ? `Salda las facturas tildadas y ${fmtPesos(excedente)} quedan a cuenta de ${proveedor}.`
                    : valor < modo.saldo - 0.005 ? "Se imputa de la más vieja a la más nueva; la última queda parcial."
                        : "Salda las facturas tildadas, de la más vieja a la más nueva.";
    const dc = comp?.datos || {};
    const difComp = !editando && modo.tipo === "facturas" && dc.importe > 0 ? dc.importe - modo.saldo : 0;
    return (<div onDragOver={(e) => { if (!usado) { e.preventDefault(); setArrastrando(true); } }} onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); if (!usado) void adjuntar(e.dataTransfer.files?.[0]); }}
        className={cn("border-t border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950 px-6 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.06)] shrink-0 -mx-6", arrastrando && "outline-2 outline-dashed outline-[#5BC2EA] -outline-offset-4")}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-baseline gap-2 text-sm">
            <b className="whitespace-nowrap">{titulo}</b>
            {modo.tipo === "facturas" && <span className="tabular-nums text-muted-foreground whitespace-nowrap">Saldo {fmtPesos(modo.saldo)}</span>}
          </div>
          <div className="grid w-full sm:w-fit grid-cols-1 sm:grid-cols-[auto_auto_auto] items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-1.5"><span className={etiqueta}>Importe</span>
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
          {leyendo && <div className="mt-1.5 text-xs text-[#0d6fa8]">Leyendo el comprobante…</div>}
          {comp && !leyendo && (<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
              <span className="inline-flex items-center gap-1 rounded-md border border-[#5BC2EA] bg-white px-1.5 py-0.5 text-[#0e7490] dark:bg-zinc-900">
                📎 <button type="button" onClick={() => void abrirComprobante(comp.comprobanteId).catch((e) => setError(e.message))} className="max-w-48 truncate hover:underline" title="Abrir el comprobante">{comp.nombre}</button>
                <button type="button" onClick={() => setComp(null)} className="text-zinc-400 hover:text-zinc-700" title="Sacar el comprobante (no cambia los datos)">×</button>
              </span>
              {comp.datos && (dc.importe > 0 || dc.fecha) && <span className="text-muted-foreground">
                  Leído: {[dc.importe > 0 && fmtPesos(dc.importe), dc.fecha && dc.fecha.split("-").reverse().join("/"), dc.banco, dc.operacion && `ID ${dc.operacion}`].filter(Boolean).join(" · ")}. Revisá y confirmá.
                </span>}
              {comp.error && <span className="text-[#b45309]">{comp.error}</span>}
              {comp.nota && <span className="font-semibold text-[#0e7490]">{comp.nota}</span>}
              {Math.abs(difComp) > 1 && !comp.nota && <span className="font-semibold text-[#b45309]">El comprobante es de {fmtPesos(dc.importe)} y las facturas tildadas suman {fmtPesos(modo.saldo)}{difComp > 0 ? `: ${fmtPesos(difComp)} quedan a cuenta.` : "."}</span>}
            </div>)}
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
              <button type="button" disabled={leyendo} onClick={() => archivoRef.current?.click()} title="PDF o foto de la transferencia: completa importe, fecha, medio e ID. También podés soltarlo sobre esta barra."
                className="h-11 sm:h-8 flex-1 sm:flex-none min-w-28 px-3 rounded-md border border-dashed border-[#5BC2EA] bg-white text-[#0e7490] text-sm whitespace-nowrap disabled:opacity-50 dark:bg-zinc-900">
                {leyendo ? "Leyendo…" : comp ? "📎 Cambiar comprobante" : "📎 Adjuntar comprobante"}
              </button>
              <input ref={archivoRef} type="file" accept={TIPOS_COMPROBANTE} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void adjuntar(f); }}/>
            </>)}
        </div>
      </div>
    </div>);
}
