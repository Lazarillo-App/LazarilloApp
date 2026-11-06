// src/componentes/gestion/BloqueSeguro.jsx
// Si un bloque del Panel falla al dibujarse (datos que no llegaron, una consulta cortada por la base),
// se muestra el aviso EN ESE BLOQUE y el resto del tablero sigue andando. Antes la pantalla entera
// quedaba en blanco (Diego 06/11/2026, Container Bar).
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

class Barrera extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[Panel] falló el bloque "${this.props.nombre}"`, error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { nombre, compacto, onReintentar } = this.props;
    const reintentar = () => { onReintentar?.(); this.setState({ error: null }); };
    if (compacto) {
      return (
        <button type="button" onClick={reintentar} title={`No se pudo mostrar ${nombre}. Tocá para reintentar.`}
          style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid #f3c4c4', background: '#fdf3f3', color: '#c62828', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          ⚠ {nombre} · reintentar
        </button>
      );
    }
    return (
      <div style={{ border: '1px solid #f3c4c4', background: '#fdf3f3', color: '#c62828', borderRadius: 12, padding: '12px 16px', margin: '8px 0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>⚠ No se pudo mostrar <b>{nombre}</b>. El resto del Panel sigue andando.</span>
        <button type="button" onClick={reintentar} style={{ marginLeft: 'auto', height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #e8a3a3', background: '#fff', color: '#c62828', fontWeight: 600, cursor: 'pointer' }}>Reintentar</button>
      </div>
    );
  }
}

// Al reintentar se vuelven a pedir los datos del Panel que fallaron.
export default function BloqueSeguro({ nombre, compacto = false, children }) {
  const queryClient = useQueryClient();
  return (
    <Barrera nombre={nombre} compacto={compacto} onReintentar={() => queryClient.refetchQueries({ type: 'active', predicate: (q) => q.state.status === 'error' })}>
      {children}
    </Barrera>
  );
}
