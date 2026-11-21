// src/funciones.jsx
// Funciones por negocio (Diego 17/11/2026): qué áreas y funciones ve cada negocio. Las prende y
// apaga Lazarillo desde el panel super («Funciones por negocio»); viajan en el ajuste
// modulos_ocultos (lista de ids de área o de función). Los negocios cuyo dueño es super usuario
// ven todo (lo resuelve el servidor). Inicio, el menú de módulos y las rutas usan esto mismo.
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAjuste } from '@/hooks/useAjustes';

export const AREAS = [
  { id: 'operacion', label: 'Operación', funciones: [['tableros', 'Tableros'], ['produccion', 'Producción'], ['mantenimiento', 'Mantenimiento'], ['rrhh', 'RRHH']] },
  { id: 'rentabilidad', label: 'Rentabilidad', funciones: [['resultados', 'Resultados'], ['recetas', 'Recetas'], ['stock', 'Stock'], ['compras', 'Compras']] },
  { id: 'administracion', label: 'Administración', funciones: [['conciliacion', 'Conciliación'], ['movimientos-bancarios', 'Movimientos bancarios'], ['clientes', 'Clientes']] },
];

export const areaDe = (funcionId) => AREAS.find((a) => a.funciones.some(([f]) => f === funcionId))?.id || null;

/** ¿Está oculta esta función (o su área) para el negocio activo? */
export function estaOculta(ocultos, funcionId) {
  if (!Array.isArray(ocultos) || !ocultos.length) return false;
  return ocultos.includes(funcionId) || ocultos.includes(areaDe(funcionId));
}

export function useFuncionesOcultas() {
  const v = useAjuste('modulos_ocultos', []);
  return Array.isArray(v) ? v : [];
}

/** Envuelve una ruta: si la función está oculta para este negocio, vuelve a Inicio. */
export function FuncionVisible({ id, children }) {
  const ocultos = useFuncionesOcultas();
  if (estaOculta(ocultos, id)) return <Navigate to="/inicio" replace />;
  return children;
}
