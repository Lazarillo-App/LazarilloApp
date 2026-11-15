// src/hooks/useRecorrido.js
// Recorridos de Anthony "la primera vez" en cada lugar (pedido de la usuaria, 10/11). Uno por id
// (crear_articulo, receta, insumos, gestion, …). Aparece mientras el negocio no haya elegido
// "No mostrar más" (props.onboarding.recorrido_<id>_off). "Omitir" lo cierra solo hasta la próxima
// vez que se entra (sessionStorage); "No mostrar más" lo apaga para ese negocio.
import { useCallback, useEffect, useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { VER_GUIA, tomarGuiaPendiente, seguirConGuia } from '@/componentes/asistente/guias';

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

/** pasos = cantidad de pasos; activo = si el lugar está listo para mostrarlo (ej. el modal abierto).
 *  opciones.sinDatos (Diego 14/11/2026): si se pasa, arranca solo mientras la sección no tenga datos
 *  propios del negocio (en vez de mirar si el negocio es nuevo).
 *  opciones.siguiente = { id, label } (Diego 14/11/2026): en el último paso, en vez de «Entendido»,
 *  ofrece hacerlo ahora con la ayuda de Anthony (abre esa guía sobre el formulario real) o «Más tarde». */
export function useRecorrido(id, pasos, activo = true, opciones = {}) {
  const { active, activeBusinessId, refetchBusinesses } = useBusiness() || {};
  const [paso, setPaso] = useState(1);
  const [cerrado, setCerrado] = useState(() => omitidoEnSesion(activeBusinessId, id));
  // «Ver el paso a paso» (Diego 14/11/2026): cualquiera lo puede repetir a mano, también en
  // negocios viejos o después de «No mostrar más».
  const [forzado, setForzado] = useState(false);

  const apagado = !!active?.props?.onboarding?.[`recorrido_${id}_off`];
  // "Omitir" se relee cada vez: hay recorridos que viven en muchas copias (el menú de cada fila de la
  // tabla) y omitirlo en una tiene que valer para todas.
  const automatico = opciones.sinDatos !== undefined ? !!opciones.sinDatos : negocioConRecorridos(active);
  // Una vez que arrancó solo, sigue hasta Omitir/Entendido aunque mientras tanto el usuario cargue su
  // primer dato (Diego 14/11/2026: «se inicia la guía y se cierra sola»). Vale por negocio.
  const [enCurso, setEnCurso] = useState(null);
  const sigue = enCurso === activeBusinessId;
  const visible = !!activo && !!activeBusinessId && (forzado
    || ((automatico || sigue) && !cerrado && !omitidoEnSesion(activeBusinessId, id) && !apagado));
  useEffect(() => { if (visible && !forzado && !sigue) setEnCurso(activeBusinessId); }, [visible, forzado, sigue, activeBusinessId]);

  const siguiente = useCallback(() => setPaso((p) => Math.min(p + 1, pasos)), [pasos]);
  const ver = useCallback(() => { setPaso(1); setForzado(true); }, []);
  // Guías de Anthony (pestaña «Guías»): arranca al llegar a la pantalla o si ya estás en ella.
  // Se toma recién cuando el lugar está listo (activo): las guías de un modal esperan a que la
  // pantalla lo abra (useAbrirGuia) y arrancan ahí.
  useEffect(() => {
    if (!activo) return undefined;
    if (tomarGuiaPendiente(id)) ver();
    const f = (e) => { if (e?.detail === id && tomarGuiaPendiente(id)) ver(); };
    window.addEventListener(VER_GUIA, f);
    return () => window.removeEventListener(VER_GUIA, f);
  }, [id, ver, activo]);
  const omitir = useCallback(() => {
    setForzado(false);
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
    ver,
    // Sin «No mostrar más» (Diego 14/11/2026): se cierra con Omitir y se vuelve a ver desde Guías.
    props: (n) => {
      const sig = n >= pasos ? opciones.siguiente : null;
      if (sig) return { onSkip: omitir, paso: { actual: n, total: pasos }, onNext: () => { omitir(); seguirConGuia(sig.id); }, nextLabel: sig.label, skipLabel: 'Más tarde' };
      return { onSkip: omitir, paso: { actual: n, total: pasos }, onNext: n < pasos ? siguiente : undefined, nextLabel: n < pasos ? 'Siguiente' : undefined, skipLabel: n < pasos ? 'Omitir' : 'Entendido' };
    },
  };
}
