/* eslint-disable */
// Traído de lazarillo_gestion/components/notas-sidebar.tsx (misma lógica).
import { gestionFetch } from "@/servicios/apiGestion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/gestion/compat";
export function NotasSidebar() {
    const [texto, setTexto] = useState("");
    const [estado, setEstado] = useState("cargando");
    const ultimoGuardado = useRef("");
    const timer = useRef(null);
    useEffect(() => {
        let vivo = true;
        gestionFetch("/api/notas")
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((j) => {
            if (!vivo)
                return;
            setTexto(j.texto ?? "");
            ultimoGuardado.current = j.texto ?? "";
            setEstado("listo");
        })
            .catch(() => vivo && setEstado("error"));
        return () => { vivo = false; };
    }, []);
    async function guardar(valor) {
        if (valor === ultimoGuardado.current)
            return;
        setEstado("guardando");
        try {
            const r = await gestionFetch("/api/notas", {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: valor }),
            });
            if (!r.ok)
                throw new Error(String(r.status));
            ultimoGuardado.current = valor;
            setEstado("guardado");
        }
        catch {
            setEstado("error");
        }
    }
    function cambiar(valor) {
        setTexto(valor);
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => void guardar(valor), 800);
    }
    const leyenda = estado === "cargando" ? "Cargando…"
        : estado === "guardando" ? "Guardando…"
            : estado === "guardado" ? "Guardado"
                : estado === "error" ? "No se pudo guardar"
                    : "";
    return (<div className="flex h-full min-h-0 flex-col px-2 pb-2">
      <div className="flex items-center justify-between px-2 pb-1.5 text-xs font-medium text-muted-foreground">
        <span>Notas</span>
        <span className={cn("text-[10px] font-normal", estado === "error" ? "text-red-600" : "text-muted-foreground")}>{leyenda}</span>
      </div>
      <textarea value={texto} disabled={estado === "cargando"} onChange={(e) => cambiar(e.target.value)} onBlur={() => { if (timer.current)
        clearTimeout(timer.current); void guardar(texto); }} placeholder="Anotaciones rápidas…" maxLength={20000} style={{ resize: "none" }} className="block w-full min-h-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-[13px] leading-snug outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"/>
    </div>);
}
