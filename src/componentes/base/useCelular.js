// src/componentes/base/useCelular.js
// ¿La pantalla es de celular? (menos de 600 px de ancho). Cambia en vivo si se gira el teléfono o se
// achica la ventana. Mismo corte que el header (Navbar) y que la regla «Vista celular» de la Guía.
import { useEffect, useState } from 'react';

export const CORTE_CELULAR = 599.95;
const consulta = `(max-width: ${CORTE_CELULAR}px)`;

export default function useCelular() {
  const [celular, setCelular] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(consulta);
    if (!mq) return undefined;
    const cambio = () => setCelular(mq.matches);
    cambio();
    mq.addEventListener?.('change', cambio);
    return () => mq.removeEventListener?.('change', cambio);
  }, []);
  return celular;
}
