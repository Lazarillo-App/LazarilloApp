// src/componentes/VendenPocoPanel.jsx
// Panel lateral de «Venden poco» (Diego 11/11): los artículos que suman el último 5 %
// del ingreso del período (letra C). Solo cuentan los que vendieron algo.
const fmtM = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `$ ${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  return `$ ${Math.round(v).toLocaleString('es-AR')}`;
};
const fmtPct = (n) => `${(Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} %`;

export default function VendenPocoPanel({ datos }) {
  if (!datos) return null;
  const { n, monto, pctIngreso, conVentas } = datos;
  const fila = (valor, texto) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '3px 0' }}>
      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', minWidth: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{valor}</span>
      <span style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>{texto}</span>
    </div>
  );
  return (
    <div style={{ padding: '2px 4px 8px' }}>
      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 6, lineHeight: 1.4 }}>
        Los artículos que entre todos suman el último 5 % del ingreso del período elegido arriba.
      </div>
      {!conVentas ? (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sin ventas en el período.</div>
      ) : (
        <>
          {fila(n, `artículos de los ${conVentas} que vendieron`)}
          {fila(fmtM(monto), `${fmtPct(pctIngreso)} del ingreso`)}
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 6, lineHeight: 1.4 }}>
            Agrupados por agrupación y de mayor a menor venta. Son los candidatos a revisar:
            sacar de la carta, cambiar el precio o empujar la venta.
          </div>
        </>
      )}
    </div>
  );
}
