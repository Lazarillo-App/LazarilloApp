/* eslint-disable */
// Traído de lazarillo_gestion/components/dashboard/apertura-origen-selector.tsx (misma lógica).
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/gestion/compat";
export function AperturaOrigenSelector({ value, locales, onChange, }) {
    const localSeleccionado = locales.find((l) => l.id === value.localId);
    const puntosDeVenta = localSeleccionado?.puntosDeVenta ?? [];
    return (<div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground">Origen de la regla</label>
      <div className="flex gap-2">
        <Select value={value.localId != null ? String(value.localId) : ""} 
    // Al cambiar de local se descarta el punto de venta anterior: puede no
    // existir en el local nuevo.
    onValueChange={(v) => onChange({ localId: Number(v), puntoDeVentaId: null })}>
          <SelectTrigger className="h-8 flex-1 text-xs" size="sm">
            <SelectValue placeholder="Local"/>
          </SelectTrigger>
          <SelectContent>
            {locales.map((l) => (<SelectItem key={l.id} value={String(l.id)} className="text-xs">
                {l.nombre}
              </SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={value.puntoDeVentaId != null ? String(value.puntoDeVentaId) : ""} disabled={value.localId == null} onValueChange={(v) => onChange({ ...value, puntoDeVentaId: Number(v) })}>
          <SelectTrigger className="h-8 flex-1 text-xs" size="sm">
            <SelectValue placeholder="Punto de venta"/>
          </SelectTrigger>
          <SelectContent>
            {puntosDeVenta.map((pv) => (<SelectItem key={pv.id} value={String(pv.id)} className="text-xs">
                {pv.nombre}
              </SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </div>);
}
