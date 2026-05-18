/* eslint-disable react-refresh/only-export-components */
// src/context/ConfigContext.jsx
// Contexto global que mantiene la config del negocio activo
// Cualquier componente puede leer globalCostoIdeal, insumosCostoIdeal, etc.
// sin hacer su propio fetch. Se actualiza automáticamente al cambiar el negocio
// o al guardar desde ConfiguracionMain.

import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import { useActiveBusiness } from './BusinessContext';
import { useAuth } from './AuthContext';
import { BASE } from '@/servicios/apiBase';

const ConfigContext = createContext({
  articulosCostoIdeal:  30,
  insumosCostoIdeal:    30,
  comprasAlertaSemanas: 4,
  ventasAlertaDias:     30,
  precioCosteoInsumos:  'ultima_compra',
  redondeoPrecios:      null,
  divisa:               'ARS',
  loading:              false,
  reload:               () => {},
});

export function ConfigProvider({ children }) {
  const { businessId } = useActiveBusiness();
  const { booting, isLogged } = useAuth() || {};

  const [cfg, setCfg] = useState({
    articulosCostoIdeal:  30,
    insumosCostoIdeal:    30,
    comprasAlertaSemanas: 4,
    ventasAlertaDias:     30,
    precioCosteoInsumos:  'ultima_compra',
    redondeoPrecios:      null,
    divisa:               'ARS',
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (bizId) => {
    if (!bizId || booting || !isLogged) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/businesses/${bizId}/config`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(bizId),
        },
      });
      const d = await res.json().catch(() => ({}));
      if (d?.config) {
        setCfg({
          articulosCostoIdeal:  Number(d.config.articulos_costo_ideal  ?? 30),
          insumosCostoIdeal:    Number(d.config.insumos_costo_ideal    ?? 30),
          comprasAlertaSemanas: Number(d.config.compras_alerta_semanas ?? 4),
          ventasAlertaDias:     Number(d.config.ventas_alerta_dias     ?? 30),
          precioCosteoInsumos:  d.config.precio_costeo_insumos          || 'ultima_compra',
          redondeoPrecios:      d.config.redondeo_precios               ?? null,
          divisa:               d.config.divisa                         || 'ARS',
        });
      }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [booting, isLogged]);

  // Recargar cuando cambia el negocio activo o cuando termina el booting
  useEffect(() => {
    if (businessId && !booting && isLogged) load(businessId);
  }, [businessId, booting, isLogged, load]);

  // Escuchar cambios desde ConfiguracionMain — actualización en tiempo real
  useEffect(() => {
    const onUpdated = (e) => {
      const { key, value } = e?.detail || {};
      if (!key || value == null) return;
      const MAP = {
        articulos_costo_ideal:  'articulosCostoIdeal',
        insumos_costo_ideal:    'insumosCostoIdeal',
        compras_alerta_semanas: 'comprasAlertaSemanas',
        ventas_alerta_dias:     'ventasAlertaDias',
        precio_costeo_insumos:  'precioCosteoInsumos',
        redondeo_precios:       'redondeoPrecios',
        divisa:                 'divisa',
      };
      const cfgKey = MAP[key];
      if (cfgKey) setCfg(prev => ({ ...prev, [cfgKey]: value }));
    };
    window.addEventListener('config:updated', onUpdated);
    return () => window.removeEventListener('config:updated', onUpdated);
  }, []);

  return (
    <ConfigContext.Provider value={{ ...cfg, loading, reload: () => load(businessId) }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}