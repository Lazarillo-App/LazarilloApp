/**
 * Servicio para mover artículos de una agrupación a una división
 */

import { getAuthToken } from './apiAuth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

/**
 * Mover todos los artículos de una agrupación a una división
 * @param {number} businessId - ID del negocio
 * @param {number} groupId - ID de la agrupación
 * @param {number} divisionId - ID de la división destino
 * @returns {Promise<Object>} - { moved: number, errors: [] }
 */
export async function moverArticulosADivision(businessId, groupId, divisionId) {
  const url = `${API_BASE}/api/divisions/move-articles`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      business_id: businessId,
      group_id: groupId,
      division_id: divisionId,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al mover artículos');
  }
  
  return response.json();
}

/**
 * Obtener artículos de una agrupación
 * @param {number} businessId - ID del negocio
 * @param {number} groupId - ID de la agrupación
 * @returns {Promise<Array>}
 */
export async function getArticulosDeAgrupacion(businessId, groupId) {
  const url = `${API_BASE}/api/businesses/${businessId}/agrupaciones/${groupId}/articulos`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener artículos');
  }
  
  return response.json();
}