// Portado de lazarillo_gestion/lib/dashboard/compra-lineas.ts (misma lógica).
function toNum(v) {
  return v == null ? null : Number(v);
}

// TOTALINS del ERP viene sin impuestos. El importe de la fila de compras
// cuadra con TOTALINS + IVATOT + IMPINTTOT (verificado contra la base:
// las percepciones NO entran — sumarlas descuadra).
export function totalLinea(l) {
  const partes = [l.totalIns, l.ivaTot, l.impNtTot].map(toNum);
  if (partes.every((p) => p == null)) return null;
  return partes.reduce ((acc, p) => acc + (p ?? 0), 0);
}

export function totalComprobante(lineas) {
  const totales = lineas.map(totalLinea).filter((t) => t != null);
  if (totales.length === 0) return null;
  return totales.reduce((acc, t) => acc + t, 0);
}

// Se busca por comprobante (no por compraId) para mostrar la factura completa
// aunque esté dividida en varias filas de compras — ver el route. El proveedor
// entra en el filtro porque un mismo número de ticket se repite entre
// proveedores distintos (821 comprobantes en producción, 14-oct-2026): sin él
// el modal mezclaba líneas de facturas ajenas.
export function whereLineasDeCompra(compra, compraId) {
  if (!compra?.comprobante) return { compraId };
  return {
    comprobante: compra.comprobante,
    localId: compra.localId,
    ...(compra.codigo ? { codPro: compra.codigo } : {}),
  };
}

const NUMERIC_KEYS = {
  cantidad: (l) => toNum(l.cantidad),
  neto: (l) => toNum(l.neto),
  ivaTot: (l) => toNum(l.ivaTot),
  impNtTot: (l) => toNum(l.impNtTot),
  total: totalLinea,
};

const TEXT_KEYS = {
  codigo: (l) => l.codigo,
  nombre: (l) => l.nombre,
  medida: (l) => l.medida,
  observac: (l) => l.observac,
};

// Los vacíos van siempre al final (en asc y en desc) para que no tapen las
// líneas con dato al buscar diferencias.
function compareNullsLast (va, vb, dir, cmp) {
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  const r = cmp(va, vb);
  return dir === "asc" ? r : -r;
}

export function sortCompraLineas(a, b, sort) {
  if (!sort) return 0;
  if (sort.key in NUMERIC_KEYS) {
    const get = NUMERIC_KEYS[sort.key];
    return compareNullsLast(get(a), get(b), sort.dir, (x, y) => x - y);
  }
  if (sort.key in TEXT_KEYS) {
    const get = TEXT_KEYS[sort.key];
    // `numeric: true` para que el código 59 quede antes que el 201.
    return compareNullsLast(get(a), get(b), sort.dir, (x, y) => x.localeCompare(y, "es", { numeric: true }));
  }
  return 0;
}
