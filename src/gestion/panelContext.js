// src/gestion/panelContext.js
// Estado compartido del Panel de gestion (en gestion: el store useDashboard): año, sucursal,
// modo Económica/Financiera y el negocio. Lo provee GestionPanel; lo leen los hooks de
// src/gestion/hooksPanel.js y las piezas del bloque Operación / tarjetas.

import { createContext, useContext } from 'react';

export const PanelGestionContext = createContext({
  businessId: null,
  year: new Date().getFullYear(),
  sucursal: undefined,
  modo: 'economica',
  abrirDetalle: () => {},
  abrirVentas: () => {},
});

export const usePanelGestion = () => useContext(PanelGestionContext);
