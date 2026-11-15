// src/componentes/base/EncabezadoPagina.jsx
// Título de una página con su bajada y sus acciones (buscador, exportar…).
// Componentes base (Diego 15/11/2026): deciden cómo se COMPORTA la pantalla, no cómo se ve. Cada página
// pone sus textos, colores y botones; esto solo garantiza que en el celular nada se apriete ni se salga:
//   · escritorio: título a la izquierda, acciones a la derecha, en una fila;
//   · celular: título, bajada a todo el ancho y debajo las acciones (el buscador ocupa lo que sobra).
import React from 'react';
import useCelular from './useCelular';

export default function EncabezadoPagina({ titulo, bajada, acciones, estiloTitulo, style }) {
  const celular = useCelular();
  return (
    <div style={{
      display: 'flex', gap: celular ? 10 : 12, marginBottom: 14,
      flexDirection: celular ? 'column' : 'row', alignItems: celular ? 'stretch' : 'flex-end', ...style,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, margin: 0, ...estiloTitulo }}>{titulo}</h1>
        {bajada && <div style={{ color: '#5b6577', fontSize: 13.5, marginTop: 4 }}>{bajada}</div>}
      </div>
      {acciones && (
        <div className="encabezado-acciones" style={{
          display: 'flex', gap: 8, alignItems: 'center', flexShrink: celular ? 1 : 0,
          minWidth: 0, ...(celular ? { width: '100%' } : { marginLeft: 'auto' }),
        }}>
          {acciones}
        </div>
      )}
    </div>
  );
}
