// src/componentes/ChipNegocio.jsx
// Nombre corto del negocio destino cuando "Mover a su rubro" apunta a otro
// negocio de la org (ej. "FC"). Mismo alto que el texto del botón.
export default function ChipNegocio({ nombre }) {
  if (!nombre) return null;
  return (
    <span style={{
      display: 'inline-block', marginLeft: 6, padding: '0 5px', borderRadius: 3,
      background: '#e0f2fe', color: '#0369a1', fontSize: '0.62rem', fontWeight: 700,
      lineHeight: 1.5, verticalAlign: 'middle', letterSpacing: 0.2,
    }}>{nombre}</span>
  );
}
