// Portado de lazarillo_gestion/lib/cta-cte/estado.ts (misma lógica).
// Estado de pago de un comprobante del 14 cruzado con el informe 80.
// Puro (sin Prisma): lo usan el semáforo de Detalle de compras y la cuenta
// corriente del proveedor.

// null = no lleva estado (sin comprobante, o número interno E/G de un gasto
// vario: en MaxiRest se carga siempre con su pago).
export function estadoPago(d, desdeCobertura) {
  const c = d.comprobante?.trim().toUpperCase();
  if (!c || c.startsWith("E") || c.startsWith("G")) return null;
  if (c.startsWith("N")) return "nc";
  if (d.fecha && d.fecha < desdeCobertura && Math.abs(d.pagado) < 0.5) return "sin-datos";
  const saldo = d.total - d.pagado;
  if (Math.abs(d.pagado) > 0.5 && Math.abs(saldo) <= 1) return "paga";
  if (Math.abs(d.pagado) > 0.5) return "parcial";
  if (Math.abs(d.total) <= 1) return "paga";
  return d.pagoAutomatico ? "auto" : "impaga";
}

export const ETIQUETA_ESTADO = {
  paga: "Paga",
  parcial: "Parcial",
  impaga: "Impaga",
  auto: "Pago automático",
  nc: "Nota de crédito",
  "sin-datos": "Sin datos de pago",
};

// Color del punto del semáforo.
export const PUNTO_ESTADO = {
  paga: { color: "#d4d4d8" },
  parcial: { color: "#f59e0b" },
  impaga: { color: "#dc2626" },
  auto: { color: "#d4d4d8" },
  nc: { color: "#38bdf8" },
  "sin-datos": { color: "transparent", borde: "#d4d4d8" },
};

// Clave de comprobante dentro de un PDV (en el 14 una factura viene en varias filas).
export const claveComprobante = (pdvId, comprobante, codigo) =>
  pdvId != null && comprobante && codigo ? `${pdvId}|${comprobante}|${codigo}` : null;

export function filtrarPorPeriodo (l, p) {
  return p.modo === "todo" ? l : l.filter((f) => f.fecha.startsWith(String(p.anio)));
}

// Totales de la cuenta corriente: el saldo cuenta solo lo que es deuda real.
export function totalesCtaCte(l) {
  let total = 0, pagado = 0, saldo = 0, impagas = 0;
  for (const f of l) {
    total += f.total;
    pagado += f.pagado;
    if (f.estado === "impaga" || f.estado === "parcial") { saldo += f.total - f.pagado; impagas++; }
  }
  return { total, pagado, saldo, impagas };
}
