// Portado de lazarillo_gestion/lib/dashboard/edicion-lote.ts (misma lógica).
// Edición de varias compras tildadas a la vez (✎ con selección, Diego 24/10/2026).
// Solo viajan a las otras filas los campos que el usuario cambió en el
// formulario; el importe nunca se replica (es propio de cada compra), SALVO ponerlo en $0
// (Diego 28/10/2026: "necesito poder poner varios registros en cero en lote").

export function cambiosLote(inicial, actual, enCero = false) {
  const body = {};
  if (enCero) body.importeManual = 0;
  if (actual.fecha !== inicial.fecha) {
    body.fechaManual = actual.fecha !== "" ? new Date(`${actual.fecha}T12:00:00Z`).toISOString() : null;
  }
  if (actual.concepto !== inicial.concepto) {
    body.conceptoCodigoManual = actual.concepto !== "" ? actual.concepto : null;
  }
  if (actual.observac !== inicial.observac) {
    body.observacManual = actual.observac !== "" ? actual.observac : null;
  }
  return body;
}

// Texto corto de qué se va a aplicar, para la confirmación ("fecha y concepto").
export function describirCambios(body) {
  const partes = [
    "fechaManual" in body ? "fecha" : null,
    "conceptoCodigoManual" in body ? "concepto" : null,
    "observacManual" in body ? "observación" : null,
    "importeManual" in body ? "importe en $0" : null,
  ].filter((x) => x !== null);
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}
