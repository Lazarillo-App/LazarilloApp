// src/gestion/cargaUtils.js
// Lógica pura de la carga manual: lib/medios-pago/abm.ts, lib/conceptos/abm.ts,
// lib/facturas/insumos.ts (factorEnvase) y lib/ventas-manuales/carga.ts de lazarillo_gestion.

// ── Medios de pago ──
export const TIPOS_MEDIO = [
  { valor: 'caja', etiqueta: 'Caja' },
  { valor: 'banco', etiqueta: 'Banco' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'descuento', etiqueta: 'Descuento' }, // salda deuda sin mover plata; viene en todos los negocios (Diego 12/11/2026)
  { valor: 'otro', etiqueta: 'Otro' },
];
export const etiquetaTipoMedio = (t) => TIPOS_MEDIO.find((x) => x.valor === t)?.etiqueta ?? 'Otro';

// Los que se ofrecen al pagar: los activos y, si se edita un pago con uno desactivado, también ese.
export function mediosParaElegir(medios, actual) {
  const lista = (medios ?? []).filter((m) => m.activo || (actual != null && m.nombre === actual));
  return [...lista].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
}

// ── Conceptos propios (desde el 1000: MaxiRest llega al 999) ──
export const CODIGO_MIN_LAZARILLO = 1000;
export const esPropio = (codigo) => Number(codigo) >= CODIGO_MIN_LAZARILLO;
export function proximoCodigoLazarillo(codigos) {
  let max = CODIGO_MIN_LAZARILLO - 1;
  for (const c of codigos) {
    const n = Number(c);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}
export const TIPOS_CONCEPTO = [
  { valor: '-', etiqueta: 'Egreso' },
  { valor: '+', etiqueta: 'Ingreso' },
  { valor: 'E', etiqueta: 'Empleados' },
];

// ── Insumos ──
const norm = (s) => (s ?? '').trim().toUpperCase();
// Unidades base que trae una medida de compra: 1 si es la del insumo, el factor si es un envase.
export function factorEnvase(ins, medida) {
  if (!ins || !norm(medida)) return null;
  if (norm(medida) === norm(ins.medida)) return 1;
  const e = (ins.envases ?? []).find((x) => norm(x.envase) === norm(medida));
  return e ? e.factor : null;
}

// ── Celda vacía del Panel → Gasto Vario ya armado ──
const p2 = (n) => String(n).padStart(2, '0');
// Último mes anterior (mismo año) con importe, o null.
export function mesAnteriorConValor(values, mes) {
  for (let m = mes - 1; m >= 1; m--) {
    const v = values[m];
    if (v != null && Math.abs(v) > 0.5) return { mes: m, importe: Math.round(v * 100) / 100 };
  }
  return null;
}
// La fecha de pago anterior, corrida esos meses (mismo día, tope fin de mes).
export function correrFecha(iso, meses) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const t = Number(m[1]) * 12 + Number(m[2]) - 1 + meses;
  const y = Math.floor(t / 12);
  const mo = (t % 12) + 1;
  const ult = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return `${y}-${p2(mo)}-${p2(Math.min(Number(m[3]), ult))}`;
}
export function ctxDesdeCelda(p, fechaPagoPrev) {
  return {
    modo: 'vario',
    conceptoCodigo: p.conceptoCodigo,
    periodo: `${p.anio}-${p2(p.mes)}`,
    importe: p.prev?.importe ?? 0,
    importeAnterior: p.prev ? `${p.anio}-${p2(p.prev.mes)}` : null,
    fechaPago: p.prev ? correrFecha(fechaPagoPrev, p.mes - p.prev.mes) : null,
  };
}

// ── Sueldos (lib/empleados/carga.ts) ──
export const MEDIO_ADELANTOS = 'Adelantos';
const r2 = (n) => Math.round(n * 100) / 100;
const iguales = (a, b) => Math.abs(a - b) < 0.005;
const fmt2 = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Problemas de una carga de sueldo (vacío = se puede guardar). adelantosPeriodo: lo adelantado en el período.
export function validarSueldo(c, adelantosPeriodo) {
  const out = [];
  const sumaConceptos = r2(c.conceptos.reduce((s, x) => s + x.importe, 0));
  if (!iguales(sumaConceptos, c.total)) out.push(`Los conceptos suman $ ${fmt2(sumaConceptos)} y el total es $ ${fmt2(c.total)}: tienen que dar exacto.`);
  c.conceptos.forEach((x, i) => {
    const pagos = r2(x.pagos.reduce((s, p) => s + p.importe, 0));
    if (!iguales(pagos, x.importe)) out.push(`Concepto ${i + 1}: las formas de pago suman $ ${fmt2(pagos)} y el concepto es $ ${fmt2(x.importe)}.`);
  });
  const usados = r2(c.conceptos.flatMap((x) => x.pagos).filter((p) => p.medio === MEDIO_ADELANTOS).reduce((s, p) => s + p.importe, 0));
  if (!iguales(usados, r2(adelantosPeriodo))) {
    out.push(adelantosPeriodo > 0
      ? `En el período hay $ ${fmt2(adelantosPeriodo)} de adelantos: tienen que descontarse (forma de pago "Adelantos"), y hay $ ${fmt2(usados)}.`
      : 'No hay adelantos cargados en el período: sacá la forma de pago "Adelantos".');
  }
  if (adelantosPeriodo > c.total + 0.005) out.push(`Los adelantos del período ($ ${fmt2(adelantosPeriodo)}) superan el sueldo.`);
  const rep = (c.reparto ?? []).filter((x) => x.pct > 0);
  if (rep.length >= 2 && !iguales(rep.reduce((s, x) => s + x.pct, 0), 100)) out.push('El reparto por sucursal tiene que sumar 100%.');
  return out;
}

// ── Ventas manuales ──
// Grilla día × columna → ítems (solo las celdas con importe).
export function itemsDeGrilla(modo, celdas, parse, detalle) {
  const out = [];
  for (const fecha of Object.keys(celdas).sort()) {
    for (const [col, valor] of Object.entries(celdas[fecha])) {
      const importe = Math.round(parse(valor) * 100) / 100;
      if (!Number.isFinite(importe) || Math.abs(importe) < 0.01) continue;
      out.push({ fecha, importe, detalle, cliente: null, tipo: modo === 'tipo' ? col : null, cobro: modo === 'cobro' ? col : null });
    }
  }
  return out;
}

// Días entre dos fechas ISO (incluidas), tope 62.
export function diasEntre(desde, hasta) {
  const out = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde) return out;
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`) && out.length < 62; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
