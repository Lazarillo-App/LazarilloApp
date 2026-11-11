/* eslint-disable */
// Traído de lazarillo_gestion/components/actividad-campana.tsx (misma lógica).
import { gestionFetch } from "@/servicios/apiGestion";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/gestion/compat";
import { Spinner } from "@/gestion/compat";
import { useFetchQuery } from "@/gestion/compat";
import { cn } from "@/gestion/compat";
import { agruparPorDia, horaDe, partesDescripcion, TITULO_ACCION } from "@/gestion/actividadFormato";
import { refrescarCompras } from "@/gestion/hooksPanel";
const CLAVE_VISTO = "actividad:visto";
const leerVisto = () => { try {
    return localStorage.getItem(CLAVE_VISTO) ?? "";
}
catch {
    return "";
} };
const ICONO = {
    creada: { Icono: Plus, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
    editada: { Icono: Pencil, cls: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
    eliminada: { Icono: Trash2, cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
    restaurada: { Icono: RotateCcw, cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
};
// Lo nuevo de Actividad (lo mío desde la última vez que se miró). Lo usa la campana única del
// header (NotificationsPanel, Diego 10/11/2026 opción A: una campana, solapas por módulo).
export function useActividadNuevos(habilitado = true) {
    const [visto, setVisto] = useState(leerVisto);
    const { data: mia } = useFetchQuery(["actividad", false, 20], "/api/actividad?limite=20", { staleTime: 30_000, enabled: habilitado });
    const nuevos = habilitado ? (mia?.data ?? []).filter((a) => a.creadoEn > visto).length : 0;
    const marcarVisto = () => {
        const ahora = new Date().toISOString();
        try {
            localStorage.setItem(CLAVE_VISTO, ahora);
        }
        catch { /* sin storage */ }
        setVisto(ahora);
    };
    return { nuevos, visto, marcarVisto };
}
// Contenido de Actividad (Mía/Todos, días, Ver/editar, Restaurar), sin el botón: va adentro de la
// campana del header. vistoAlAbrir marca con punto lo que es nuevo.
export function ActividadContenido({ vistoAlAbrir = "", onVer }) {
    const [todos, setTodos] = useState(false);
    const [limite, setLimite] = useState(20);
    const [restaurando, setRestaurando] = useState(null);
    const queryClient = useQueryClient();
    const { data, isLoading } = useFetchQuery(["actividad", todos, limite], `/api/actividad?limite=${limite}${todos ? "&todos=1" : ""}`, { staleTime: 30_000 });
    const grupos = useMemo(() => agruparPorDia(data?.data ?? []), [data]);
    async function restaurar(a) {
        setRestaurando(a.id);
        const r = await gestionFetch(`/api/actividad/${a.id}/restaurar`, { method: "POST" }).catch(() => null);
        const d = r ? await r.json().catch(() => null) : null;
        setRestaurando(null);
        if (!r?.ok) {
            toast.error(d?.error ?? "No se pudo restaurar");
            return;
        }
        toast.success("Factura restaurada");
        refrescarCompras(queryClient);
    }
    return (<>
      <div className="flex items-center justify-end px-3.5 pb-1.5">
        <div className="flex overflow-hidden rounded-lg border text-[11.5px]">
          {[["Mía", false], ["Todos", true]].map(([t, v]) => (<button key={String(t)} type="button" onClick={() => { setTodos(v); setLimite(20); }} className={cn("px-2.5 py-0.5", todos === v ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-muted-foreground")}>{t}</button>))}
        </div>
      </div>
      <div className="pb-1">
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {!isLoading && grupos.length === 0 && (<p className="px-3.5 py-6 text-center text-xs text-muted-foreground">Todavía no hay actividad. Acá van a aparecer las facturas que cargues, edites o elimines.</p>)}
        {grupos.map((g) => (<div key={g.dia}>
            <div className="px-3.5 pt-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{g.dia}</div>
            {g.items.map((a) => {
            const { nombre, detalle } = partesDescripcion(a.descripcion);
            const ic = ICONO[a.accion] ?? ICONO.creada;
            const abrible = a.tipo === "factura" && a.accion !== "eliminada" && !!a.refId;
            const nuevo = a.creadoEn > vistoAlAbrir && (!todos || a.usuario === data?.yo);
            return (<div key={a.id} onClick={() => { if (abrible) {
                onVer?.({ rowId: a.refId, detalle: detalle.split(" · ")[0] });
            } }} className={cn("flex items-start gap-2.5 px-3.5 py-2", abrible && "cursor-pointer hover:bg-sky-50/60 dark:hover:bg-sky-950/20")}>
                  <span className={cn("mt-2.5 size-1.5 shrink-0 rounded-full", nuevo ? "bg-[#5BC2EA]" : "bg-transparent")}/>
                  <span className={cn("mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-md", ic.cls)}><ic.Icono className="h-3.5 w-3.5"/></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug">
                      {TITULO_ACCION[a.tipo]?.[a.accion] ?? `${a.tipo} ${a.accion}`}
                      {nombre && <> · <b className="font-semibold">{nombre}</b></>}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground" title={detalle}>{detalle}</span>
                    {todos && a.usuario && a.usuario !== data?.yo && <span className="block text-[10.5px] text-muted-foreground/80">{a.usuario}</span>}
                    {abrible && <span className="mt-0.5 block text-[11px] font-semibold text-[#0d6fa8]">Ver / editar ›</span>}
                    {a.restaurable && (<button type="button" disabled={restaurando === a.id} onClick={(e) => { e.stopPropagation(); void restaurar(a); }} className="mt-0.5 text-[11px] font-semibold text-[#0d6fa8] hover:underline disabled:opacity-50">
                        {restaurando === a.id ? "Restaurando…" : "Restaurar ›"}
                      </button>)}
                  </span>
                  <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground tabular-nums">{horaDe(new Date(a.creadoEn))}</span>
                </div>);
        })}
          </div>))}
      </div>
      {data?.hayMas && (<button type="button" onClick={() => setLimite((n) => n + 40)} className="w-full border-t py-2 text-center text-xs text-[#0d6fa8] hover:bg-muted/50">
          Ver más actividad
        </button>)}
    </>);
}
