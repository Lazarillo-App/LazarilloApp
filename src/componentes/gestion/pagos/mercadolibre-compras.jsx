/* eslint-disable react-refresh/only-export-components */
// Compras de Mercado Libre por cargar (usuaria 14/11/2026): pestaña de "Sin carga" en el Panel de
// Gestión. Cada compra se carga como factura con el modal de siempre (proveedor y fecha precargados,
// el detalle de lo comprado en el aviso de arriba) o se marca que no va.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useBusiness } from "@/context/BusinessContext";
import { MercadoLibreAPI } from "@/servicios/apiMercadoLibre";
import { fmtPesos } from "@/gestion/impagasClasificar";

export const ML_KEY = (bid) => ["ml-compras", bid ?? null];
const dmy = (f) => String(f || "").slice(0, 10).split("-").reverse().join("/");
const hoyISO = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

/** Estado de la conexión + compras. Sin conexión no se piden las compras. */
export function useComprasML() {
    const { activeBusinessId } = useBusiness() || {};
    const bid = Number(activeBusinessId) || null;
    const estado = useQuery({ queryKey: ["ml-estado", bid], queryFn: () => MercadoLibreAPI.estado(bid), enabled: !!bid, staleTime: 60_000 });
    const conectado = !!estado.data?.conectado;
    const compras = useQuery({ queryKey: ML_KEY(bid), queryFn: () => MercadoLibreAPI.compras(bid), enabled: !!bid && conectado, staleTime: 60_000 });
    const lista = compras.data?.compras ?? [];
    return { bid, estado: estado.data, conectado, pendientes: lista.filter((c) => c.estado_carga === "pendiente"), lista, cargando: compras.isLoading };
}

const resumenItems = (c) => (c.items || []).map((i) => `${i.cantidad > 1 ? `${i.cantidad} × ` : ""}${i.titulo}`).join(" · ");

/** Contexto del modal de carga para una compra de Mercado Libre, y el aviso que va arriba. */
export function ctxML(c) {
    return {
        ctx: { prov: c.vendedor || "Mercado Libre", fecha: String(c.fecha).slice(0, 10) },
        aviso: `Viene de Mercado Libre: compra #${c.order_id} del ${dmy(c.fecha)} por ${fmtPesos(c.total)}${c.vendedor ? ` a ${c.vendedor}` : ""}. Compraste: ${resumenItems(c) || "—"}. Elegí el proveedor (o dalo de alta) y cargá los ítems con el número de la factura que te mandó el vendedor.`,
    };
}

export function ListaComprasML({ ml, onCargar }) {
    const queryClient = useQueryClient();
    const [desde, setDesde] = useState(() => haceDias(60));
    const [hasta, setHasta] = useState(hoyISO);
    const [trayendo, setTrayendo] = useState(false);
    const [verMarcadas, setVerMarcadas] = useState(false);
    const refrescar = () => { void queryClient.invalidateQueries({ queryKey: ML_KEY(ml.bid) }); void queryClient.invalidateQueries({ queryKey: ["ml-estado", ml.bid] }); };

    if (!ml.conectado) {
        return (<p className="p-6 text-sm text-muted-foreground">
        {ml.estado?.configurado === false ? "La conexión con Mercado Libre todavía no está habilitada en Lazarillo." : <>Conectá la cuenta de Mercado Libre del negocio en <Link to="/configuracion?tab=7" className="font-semibold text-sky-700 underline">Configuración › Conexiones</Link> y las compras aparecen acá para cargarlas.</>}
      </p>);
    }
    async function traer() {
        if (!desde || !hasta || desde > hasta) { toast.error("Revisá las fechas"); return; }
        setTrayendo(true);
        try {
            const r = await MercadoLibreAPI.sincronizar(ml.bid, desde, hasta);
            toast.success(`Listo: ${r.compras} compra${r.compras === 1 ? "" : "s"} de Mercado Libre`);
            refrescar();
        } catch (e) {
            const c = String(e?.message || "").split(":")[0].trim();
            toast.error(c === "ml_vencido" ? "Venció la conexión con Mercado Libre: volvé a conectarla en Conexiones." : c === "periodo_muy_largo" ? "Elegí hasta un año por vez." : "Mercado Libre no respondió. Probá de nuevo en un rato.");
        } finally { setTrayendo(false); }
    }
    async function marcar(c, estado) {
        try {
            await MercadoLibreAPI.marcar(ml.bid, c.order_id, estado);
            toast.success(estado === "descartada" ? "Listo: no va" : estado === "pendiente" ? "Vuelve a la lista" : "Marcada como cargada");
            refrescar();
        } catch { toast.error("No se pudo marcar"); }
    }
    const marcadas = ml.lista.filter((c) => c.estado_carga !== "pendiente");
    return (<div>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-6 py-2.5 text-xs dark:border-zinc-800">
        <span className="text-muted-foreground">Cuenta <b className="text-zinc-700 dark:text-zinc-200">{ml.estado?.cuenta?.nickname || "conectada"}</b></span>
        <span className="ml-auto flex items-center gap-1.5">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-7 rounded-md border border-zinc-200 px-2 dark:border-zinc-700 dark:bg-zinc-900"/>
          a
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-7 rounded-md border border-zinc-200 px-2 dark:border-zinc-700 dark:bg-zinc-900"/>
          <button type="button" disabled={trayendo} onClick={traer} className="h-7 rounded-md bg-zinc-900 px-2.5 font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900">{trayendo ? "Trayendo…" : "Traer compras"}</button>
        </span>
      </div>
      {ml.cargando && <p className="p-6 text-sm text-muted-foreground">Buscando…</p>}
      {!ml.cargando && !ml.pendientes.length && <p className="p-6 text-sm text-muted-foreground">No hay compras de Mercado Libre por cargar.{ml.estado?.ultimo_sync_at ? "" : " Tocá «Traer compras» para buscarlas."}</p>}
      {ml.pendientes.map((c) => (<div key={c.order_id} className="grid grid-cols-[90px_1fr_110px_auto] items-center gap-3 border-b border-zinc-50 px-6 py-2 text-sm dark:border-zinc-800">
          <span className="text-xs text-zinc-500">{dmy(c.fecha)}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{c.vendedor || "Vendedor sin nombre"}</span>
            <span className="block truncate text-[11px] text-zinc-500" title={resumenItems(c)}>{resumenItems(c) || `Compra #${c.order_id}`}</span>
          </span>
          <span className="text-right font-semibold tabular-nums">{fmtPesos(c.total)}</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={() => onCargar(c)} className="h-7 rounded-md bg-zinc-900 px-2.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">Cargar</button>
            <button type="button" onClick={() => void marcar(c, "cargada")} title="Ya la cargué por otro lado" className="h-7 rounded-md border border-zinc-200 px-2 text-xs dark:border-zinc-700">Ya está</button>
            <button type="button" onClick={() => void marcar(c, "descartada")} title="No es un gasto del negocio" className="h-7 rounded-md border border-zinc-200 px-2 text-xs text-zinc-500 dark:border-zinc-700">No va</button>
          </span>
        </div>))}
      {marcadas.length > 0 && (<div className="px-6 py-3">
          <button type="button" onClick={() => setVerMarcadas((v) => !v)} className="text-xs font-semibold text-sky-700 underline">{verMarcadas ? "Ocultar" : "Ver"} las ya marcadas ({marcadas.length})</button>
          {verMarcadas && marcadas.map((c) => (<div key={c.order_id} className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
              <span>{dmy(c.fecha)}</span><span className="truncate">{c.vendedor || "—"} · {fmtPesos(c.total)}</span>
              <span>{c.estado_carga === "cargada" ? "cargada" : "no va"}</span>
              <button type="button" onClick={() => void marcar(c, "pendiente")} className="ml-auto underline">Deshacer</button>
            </div>))}
        </div>)}
    </div>);
}
