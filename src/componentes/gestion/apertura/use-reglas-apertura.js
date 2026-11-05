// Traído de lazarillo_gestion/hooks/use-reglas-apertura.ts (misma lógica).
import { useFetchQuery } from "@/gestion/compat";
// Una sola query cacheada por TanStack Query, compartida entre el badge/ícono
// de pivot-table.tsx (Task 12) y la lista/línea de tiempo de
// apertura-gastos-modal.tsx (Task 11) — volumen de reglas bajo (decenas, no
// miles), sin endpoint filtrado nuevo (YAGNI).
export function useReglasApertura() {
    const { data, isLoading, error } = useFetchQuery(["apertura-reglas"], "/api/apertura/reglas");
    return { reglas: data?.data ?? [], isLoading, error };
}
