// Colores e importe de la carga de facturas y gastos varios: los comparten ModalCargaFactura y
// HistorialConcepto (Últimas cargas), que se separó del modal el 20/11/2026 por tamaño.
export const C = { ii: "#6d28d9", iiBorde: "#a78bfa", neg: "#111", gris: "#8a8a8a", verde: "#159457", nar: "#e08900", rojo: "#c62828", cel: "#0d6fa8", borde: "#e8e8e6", fondo: "#f6f6f4" };
export const $fmt = (n) => (n ? "$ " + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
