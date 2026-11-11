// src/componentes/Top20Panel.jsx
// Panel lateral del Top 20 (Diego 11/11): cuatro números y la curva acumulada del ingreso.
// El % de artículos se calcula sobre los que VENDIERON en el período (los que están en 0 no cuentan).
const fmtM = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `$ ${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  return `$ ${Math.round(v).toLocaleString('es-AR')}`;
};
const fmtPct = (n) => `${(Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} %`;

function Curva({ curva = [], n }) {
  const W = 220, H = 70, P = 4;
  if (!curva.length) return null;
  const N = curva.length;
  const x = (i) => P + (i / Math.max(1, N - 1)) * (W - 2 * P);
  const y = (pct) => H - P - (Math.min(100, pct) / 100) * (H - 2 * P);
  // Hasta 120 puntos para no dibujar miles de vértices
  const paso = Math.max(1, Math.floor(N / 120));
  const pts = [];
  for (let i = 0; i < N; i += paso) pts.push(`${x(i).toFixed(1)},${y(curva[i]).toFixed(1)}`);
  pts.push(`${x(N - 1).toFixed(1)},${y(curva[N - 1]).toFixed(1)}`);
  const iCorte = Math.max(0, Math.min(N, n) - 1);
  const xc = x(iCorte);
  const yc = y(curva[iCorte]);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} aria-label="Curva acumulada del ingreso">
      <rect x={P} y={P} width={Math.max(0, xc - P)} height={H - 2 * P} fill="var(--color-primary, #3b82f6)" opacity="0.10" />
      <line x1={P} x2={W - P} y1={yc} y2={yc} stroke="#cbd5e1" strokeDasharray="3 3" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--color-primary, #3b82f6)" strokeWidth="1.8" />
      <line x1={xc} x2={xc} y1={P} y2={H - P} stroke="var(--color-primary, #3b82f6)" strokeWidth="1" />
      <circle cx={xc} cy={yc} r="2.6" fill="var(--color-primary, #3b82f6)" />
    </svg>
  );
}

export default function Top20Panel({ datos }) {
  if (!datos) return null;
  const { n, monto, pctIngreso, conVentas, pctConVentas, n50, nUltimo5, curva } = datos;
  const fila = (valor, texto) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '3px 0' }}>
      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', minWidth: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{valor}</span>
      <span style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>{texto}</span>
    </div>
  );
  return (
    <div style={{ padding: '2px 4px 8px' }}>
      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 6, lineHeight: 1.4 }}>
        Los {n || 20} artículos que más facturaron ($) en el período elegido arriba.
      </div>
      {!conVentas ? (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sin ventas en el período.</div>
      ) : (
        <>
          {fila(fmtM(monto), `${fmtPct(pctIngreso)} del ingreso`)}
          {fila(n, `artículos · ${fmtPct(pctConVentas)} de los ${conVentas} que vendieron`)}
          {fila(n50, 'hacen el 50 % del ingreso')}
          {fila(nUltimo5, 'suman el último 5 % (letra C)')}
          <div style={{ marginTop: 8 }}>
            <Curva curva={curva} n={n} />
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 4, lineHeight: 1.4 }}>
            Cada punto es un artículo, de mayor a menor venta; la línea muestra cuánto del ingreso
            se va juntando. La zona celeste es el Top {n}: llega hasta el {fmtPct(pctIngreso)}.
          </div>
        </>
      )}
    </div>
  );
}
