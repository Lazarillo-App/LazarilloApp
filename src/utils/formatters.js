export const formatCurrency = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n || 0));

export const formatPercent = (n) =>
  `${(Number(n || 0)).toFixed(1)}%`;
