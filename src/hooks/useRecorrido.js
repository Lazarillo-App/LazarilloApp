// src/hooks/useRecorrido.js
// Recorridos de Anthony "la primera vez" en cada lugar (pedido de la usuaria, 10/11). Uno por id
// (crear_articulo, receta, insumos, gestion, …). Aparece mientras el negocio no haya elegido
// "No mostrar más" (props.onboarding.recorrido_<id>_off). "Omitir" lo cierra solo hasta la próxima
// vez que se entra (sessionStorage); "No mostrar más" lo apaga para ese negocio.
import { useCallback, useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { BusinessesAPI } from '@/servicios/apiBusinesses';

// Solo para negocios nuevos (pedido de la usuaria, 10/11): los creados desde que salieron los
// recorridos, tengan datos o no (un cliente nuevo de MaxiRest trae todo pero nunca usó Lazarillo).
// Los negocios que ya existían no los ven. También los que pasaron por el asistente de alta nuevo.
const DESDE = new Date('2026-11-10T00:00:00-03:00').getTime();
export function negocioConRecorridos(negocio) {
  if (!negocio) return false;
  if (negocio.props?.onboarding?.alta_estado) return true;
  const creado = new Date(negocio.created_at || 0).getTime();
  return Number.isFinite(creado) && creado >= DESDE;
}

const claveSesion = (biz, id) => `lazarillo:recorrido-omitido:${biz}:${id}`;
const omitidoEnSesion = (biz, id) => { try { return sessionStorage.getItem(claveSesion(biz, id)) === '1'; } catch { return false; } };

/** pasos = cantidad de pasos; activo = si el lugar está listo para mostrarlo (ej. el modal abierto). */
export function useRecorrido(id, pasos, activo = true) {
  const { active, activeBusinessId, refetchBusinesses } = useBusiness() || {};
  const [paso, setPaso] = useState(1);
  const [cerrado, setCerrado] = useState(() => omitidoEnSesion(activeBusinessId, id));

  const apagado = !!active?.props?.onboarding?.[`recorrido_${id}_off`];
  // "Omitir" se relee cada vez: hay recorridos que viven en muchas copias (el menú de cada fila de la
  // tabla) y omitirlo en una tiene que valer para todas.
  const visible = !!activo && negocioConRecorridos(active) && !cerrado && !omitidoEnSesion(activeBusinessId, id) && !apagado && !!activeBusinessId;

  const siguiente = useCallback(() => setPaso((p) => Math.min(p + 1, pasos)), [pasos]);
  const omitir = useCallback(() => {
    setCerrado(true);
    try { sessionStorage.setItem(claveSesion(activeBusinessId, id), '1'); } catch { /* sin storage */ }
  }, [activeBusinessId, id]);
  const noMostrarMas = useCallback(async () => {
    omitir();
    try { await BusinessesAPI.setOnboardingFlag(activeBusinessId, `recorrido_${id}_off`, true); await refetchBusinesses?.(); } catch { /* ya se cerró */ }
  }, [omitir, activeBusinessId, id, refetchBusinesses]);
  // Al terminar el último paso cuenta como visto en esta sesión (vuelve la próxima, hasta "No mostrar más").
  const terminar = omitir;

  return {
    visible,
    paso,
    total: pasos,
    siguiente,
    omitir,
    noMostrarMas,
    terminar,
    props: (n) => ({ onSkip: omitir, onNever: noMostrarMas, paso: { actual: n, total: pasos }, onNext: n < pasos ? siguiente : undefined, nextLabel: n < pasos ? 'Siguiente' : undefined, skipLabel: n < pasos ? 'Omitir' : 'Entendido' }),
  };
}
