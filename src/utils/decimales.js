// Acepta coma o punto como separador decimal.
export const sanitizeDecimal = (raw) =>
  String(raw ?? '').replace(/[^\d.,]/g, '').replace(',', '.').replace(/(\..*)\./g, '$1');

export const parseDecimal = (raw) => {
  const n = Number(sanitizeDecimal(raw));
  return Number.isFinite(n) ? n : 0;
};