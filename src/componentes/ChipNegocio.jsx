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

// Botón de acción de Sin agrupación en 2 líneas: todos del mismo ancho y alto
// para que queden alineados en columna y no le roben ancho al Nombre.
export const SX_BOTON_2L = {
  fontSize: '0.64rem', lineHeight: 1.15, py: 0.25, px: 0.5,
  width: 118, minWidth: 118, height: 32, whiteSpace: 'normal',
  display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  textAlign: 'center', flexShrink: 0,
};

// Segunda línea del botón: el destino (cortado con … si no entra) + chip del negocio.
export function LineaDestino({ nombre, bizNombre }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', maxWidth: '100%', minWidth: 0 }} title={nombre}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{nombre}</span>
      {bizNombre ? <ChipNegocio nombre={bizNombre} /> : null}
    </span>
  );
}
