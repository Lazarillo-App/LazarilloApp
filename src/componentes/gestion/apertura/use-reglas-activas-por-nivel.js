// Traído de lazarillo_gestion/hooks/use-reglas-activas-por-nivel.ts (misma lógica).
import { useMemo } from "react";
import { origenAlcanza } from "@/gestion/apertura/validaciones";
import { estadoVigenciaRegla, hoyUTC } from "@/gestion/apertura/estado-vigencia";
// Función pura — separada del hook para poder testearla directo con Vitest
// (no hay infraestructura de test de hooks de React en este proyecto).
export function computeReglasActivasPorNivel(reglas, localId, pdvId, hoy = hoyUTC()) {
    const activas = reglas.filter((r) => r.estado === "activa");
    const alcanzaFiltro = (r) => {
        if (pdvId == null && localId == null)
            return true;
        if (pdvId != null) {
            return origenAlcanza({ localId: r.origenLocalId, puntoDeVentaId: r.origenPuntoDeVentaId }, { localId: localId ?? r.origenLocalId, puntoDeVentaId: pdvId });
        }
        return r.origenLocalId === localId;
    };
    const alcanzadas = activas.filter(alcanzaFiltro);
    const vigentes = alcanzadas.filter((r) => estadoVigenciaRegla(r, hoy) === "vigente");
    const soloVencidas = alcanzadas.filter((r) => estadoVigenciaRegla(r, hoy) === "vencida");
    const porNivel = (lista, nivel) => new Set(lista.filter((r) => r.nivel === nivel).map((r) => r.entidadId));
    const concepto = porNivel(vigentes, "concepto");
    const proveedor = porNivel(vigentes, "proveedor");
    const registro = porNivel(vigentes, "registro");
    // Vencida solo si la entidad no tiene, además, alguna vigente.
    const sinVigente = (s, vig) => new Set([...s].filter((id) => !vig.has(id)));
    return {
        concepto,
        proveedor,
        registro,
        vencidas: {
            concepto: sinVigente(porNivel(soloVencidas, "concepto"), concepto),
            proveedor: sinVigente(porNivel(soloVencidas, "proveedor"), proveedor),
            registro: sinVigente(porNivel(soloVencidas, "registro"), registro),
        },
    };
}
// Un solo pase sobre las reglas activas alcanzables por el filtro actual,
// separado por nivel — extraído tras aparecer duplicado byte a byte (salvo
// el nivel "proveedor") en pivot-table-por-concepto.tsx,
// pivot-table-por-proveedor.tsx y resultados-pivot-table.tsx.
export function useReglasActivasPorNivel(reglas, localId, pdvId) {
    return useMemo(() => computeReglasActivasPorNivel(reglas, localId, pdvId), [reglas, localId, pdvId]);
}
