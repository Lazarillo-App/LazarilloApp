/* eslint-disable react-refresh/only-export-components */
// src/context/BarraGestionContext.jsx
// Estado de la barra única de Menú e Insumos (pedido de Diego, 02/11: "la
// barra que tiene el calendario, el buscador, el food cost etc. no se tiene
// que cargar de nuevo al pasar de Menú a Insumos, tiene que ser la misma").
//
// La barra vive en GestionLayout (arriba de las dos páginas) y no se desmonta
// al cambiar de página. Acá viven:
//  - los dos períodos, SEPARADOS (Menú = ventas, Insumos = compras), con las
//    mismas claves de localStorage que usaban las páginas;
//  - lo que cada página le pasa a la barra (buscador, acciones de sus modales)
//    vía useRegistrarBarra;
//  - el "hueco" (slotEl) donde cada página dibuja sus botones propios
//    (selección, listas, referencias) con un portal;
//  - una acción pendiente para cuando se elige algo de la otra página
//    (ej. "Importar ventas" estando en Insumos → va a Menú y abre el modal).
import React, {
  createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { lastNDaysUntilYesterday, daysByMode } from '@/utils/fechas';

const Ctx = createContext(null);
// Lo que solo dibuja la barra (buscador de cada página): contexto aparte para
// que escribir en el buscador no vuelva a renderizar la página entera.
const DatosCtx = createContext(null);

const RANGO_VENTAS_KEY = 'lazarillo:rangoVentas';
const RANGO_COMPRAS_KEY = 'lazarillo:rangoCompras';

function leerRango(key, modoDefault) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.from && parsed?.to && /^\d{4}-\d{2}-\d{2}$/.test(parsed.from)) return parsed;
    }
  } catch { /* localStorage no disponible */ }
  const def = lastNDaysUntilYesterday(daysByMode(modoDefault));
  return { mode: modoDefault, from: def.from, to: def.to };
}

function useRangoPersistido(key, modoDefault) {
  const [rango, setRangoState] = useState(() => leerRango(key, modoDefault));
  const setRango = useCallback((nuevo) => {
    setRangoState((prev) => {
      const next = typeof nuevo === 'function' ? nuevo(prev) : nuevo;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* sin storage */ }
      return next;
    });
  }, [key]);
  return [rango, setRango];
}

export function BarraGestionProvider({ children }) {
  const [rangoVentas, setRangoVentas] = useRangoPersistido(RANGO_VENTAS_KEY, '7');
  const [rangoCompras, setRangoCompras] = useRangoPersistido(RANGO_COMPRAS_KEY, '30');

  // Datos que la barra dibuja (cambian → re-render de la barra).
  const [datosPagina, setDatosPaginaState] = useState({});
  const setDatosPagina = useCallback((pagina, datos) => {
    setDatosPaginaState((prev) => {
      if (datos == null) {
        if (!(pagina in prev)) return prev;
        const { [pagina]: _omit, ...resto } = prev;
        return resto;
      }
      return { ...prev, [pagina]: datos };
    });
  }, []);

  // Funciones de cada página (no necesitan re-render: se leen al hacer clic).
  const handlersRef = useRef({});

  // Aviso de ventas atrasadas: lo calcula Menú, queda guardado acá para que el
  // punto de aviso no desaparezca al pasar a Insumos.
  const [alertaVentas, setAlertaVentas] = useState(null);

  const [slotEl, setSlotEl] = useState(null);
  // Las dos páginas pueden estar montadas a la vez (GestionLayout las deja
  // vivas): solo la activa dibuja sus botones en la barra.
  const { pathname } = useLocation();
  const paginaActiva = pathname.startsWith('/insumos') ? 'insumos' : 'menu';
  const [accionPendiente, setAccionPendiente] = useState(null);

  const value = useMemo(() => ({
    rangoVentas, setRangoVentas, rangoCompras, setRangoCompras,
    setDatosPagina, handlersRef,
    alertaVentas, setAlertaVentas,
    slotEl, setSlotEl, paginaActiva,
    accionPendiente, setAccionPendiente,
  }), [rangoVentas, setRangoVentas, rangoCompras, setRangoCompras, setDatosPagina,
    alertaVentas, slotEl, paginaActiva, accionPendiente]);

  return (
    <Ctx.Provider value={value}>
      <DatosCtx.Provider value={datosPagina}>{children}</DatosCtx.Provider>
    </Ctx.Provider>
  );
}

export const useBarraGestion = () => useContext(Ctx);
export const useDatosBarra = () => useContext(DatosCtx);

/**
 * Cada página (menu | insumos) le pasa a la barra su buscador y sus acciones.
 * `datos` = lo que se dibuja ({ placeholder, opciones, value }).
 * `handlers` = funciones ({ onBuscar, onPick, agregar(tipo), importar() }).
 */
export function useRegistrarBarra(pagina, datos, handlers) {
  const ctx = useContext(Ctx);
  const setDatosPagina = ctx?.setDatosPagina;
  const handlersRef = ctx?.handlersRef;

  const propios = useRef(handlers);
  propios.current = handlers;

  useLayoutEffect(() => {
    if (!handlersRef) return undefined;
    const llamar = new Proxy({}, {
      get: (_t, prop) => propios.current?.[prop],
    });
    handlersRef.current[pagina] = llamar;
    return () => {
      if (handlersRef.current[pagina] === llamar) delete handlersRef.current[pagina];
    };
  }, [handlersRef, pagina]);

  const { placeholder, opciones, value } = datos || {};
  useLayoutEffect(() => {
    setDatosPagina?.(pagina, { placeholder, opciones, value });
  }, [setDatosPagina, pagina, placeholder, opciones, value]);

  useLayoutEffect(() => () => setDatosPagina?.(pagina, null), [setDatosPagina, pagina]);
}
