/* eslint-disable no-unused-vars */
// ============================================================================
// src/servicios/autoGrouping.js
// Sistema de auto-agrupación inteligente basado en rubros/subrubros
// ============================================================================

import { BusinessesAPI, httpBiz } from './apiBusinesses';

/**
 * Normaliza texto para comparaciones (sin acentos, lowercase, trim)
 */
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Construye árbol jerárquico de artículos desde items planos
 * (Asume que tienes una función buildTree en tu código, si no, adaptá esta)
 */
function buildTree(items = []) {
  // Esta es una implementación básica - adaptá según tu estructura real
  const bySubRubro = new Map();
  
  items.forEach(item => {
    const sub = item.subrubro || 'Sin clasificar';
    if (!bySubRubro.has(sub)) {
      bySubRubro.set(sub, {
        subrubro: sub,
        categorias: new Map(),
      });
    }
    
    const cat = item.categoria || 'Sin categoría';
    const subNode = bySubRubro.get(sub);
    
    if (!subNode.categorias.has(cat)) {
      subNode.categorias.set(cat, {
        categoria: cat,
        articulos: [],
      });
    }
    
    subNode.categorias.get(cat).articulos.push(item);
  });
  
  return Array.from(bySubRubro.values()).map(sub => ({
    subrubro: sub.subrubro,
    categorias: Array.from(sub.categorias.values()),
  }));
}

/**
 * Verifica si un grupo es el grupo "Sin agrupación" / "Todo"
 */
function esTodoGroup(grupo) {
  if (!grupo) return false;
  const nombre = norm(grupo.nombre || '');
  return nombre === 'sin agrupacion' || nombre === 'todo' || nombre === 'todos';
}

/**
 * Encuentra sugerencias de agrupación para artículos sin agrupar
 * 
 * @param {Array} newArticles - Artículos nuevos sin agrupación
 * @param {Array} agrupaciones - Lista de agrupaciones existentes
 * @param {Array} todosArticulos - Árbol completo de artículos (para contexto)
 * @returns {Array} Sugerencias de agrupación
 */
export function findAutoGroupSuggestions(newArticles = [], agrupaciones = [], todosArticulos = []) {
  if (!newArticles.length || !agrupaciones.length) return [];

  // 1️⃣ Construir mapa: subrubro/rubro → agrupaciones donde aparece
  const subrubroToGroups = new Map(); // subrubro normalizado → Set<groupId>
  const rubroToGroups = new Map();    // rubro normalizado → Set<groupId>

  agrupaciones.forEach((grupo) => {
    if (!grupo.articulos || !grupo.articulos.length) return;

    grupo.articulos.forEach((art) => {
      const subrubro = art.subrubro || art.categoria || '';
      const rubro = art.categoria || '';

      if (subrubro) {
        const key = norm(subrubro);
        if (!subrubroToGroups.has(key)) subrubroToGroups.set(key, new Set());
        subrubroToGroups.get(key).add(grupo.id);
      }

      if (rubro) {
        const key = norm(rubro);
        if (!rubroToGroups.has(key)) rubroToGroups.set(key, new Set());
        rubroToGroups.get(key).add(grupo.id);
      }
    });
  });

  // 2️⃣ Para cada artículo nuevo, buscar coincidencias
  const suggestions = [];

  newArticles.forEach((art) => {
    const subrubro = art.subrubro || art.categoria || '';
    const rubro = art.categoria || '';

    let matchedGroupId = null;
    let matchType = null;

    // Prioridad 1: Coincidencia exacta de subrubro
    if (subrubro) {
      const key = norm(subrubro);
      const groups = subrubroToGroups.get(key);
      if (groups && groups.size > 0) {
        // Si hay múltiples grupos con ese subrubro, elegir el primero
        // (podrías mejorar esto eligiendo el que tenga más artículos de ese subrubro)
        matchedGroupId = Array.from(groups)[0];
        matchType = 'subrubro';
      }
    }

    // Prioridad 2: Coincidencia de rubro (si no hubo match de subrubro)
    if (!matchedGroupId && rubro) {
      const key = norm(rubro);
      const groups = rubroToGroups.get(key);
      if (groups && groups.size > 0) {
        matchedGroupId = Array.from(groups)[0];
        matchType = 'rubro';
      }
    }

    // Si encontramos un grupo sugerido, agregamos la sugerencia
    if (matchedGroupId) {
      const grupo = agrupaciones.find(g => g.id === matchedGroupId);
      suggestions.push({
        articleId: art.id,
        articleName: art.nombre,
        articleSubrubro: subrubro,
        articleRubro: rubro,
        suggestedGroupId: matchedGroupId,
        suggestedGroupName: grupo?.nombre,
        matchType, // 'subrubro' | 'rubro'
        confidence: matchType === 'subrubro' ? 'high' : 'medium',
      });
    }
  });

  return suggestions;
}

/**
 * Agrupa sugerencias por grupo destino para mostrar en UI
 */
export function groupSuggestionsByTarget(suggestions = []) {
  const byGroup = new Map();

  suggestions.forEach((sug) => {
    const key = sug.suggestedGroupId;
    if (!byGroup.has(key)) {
      byGroup.set(key, {
        groupId: key,
        groupName: sug.suggestedGroupName,
        articles: [],
      });
    }
    byGroup.get(key).articles.push({
      articleId: sug.articleId,
      articleName: sug.articleName,
      subrubro: sug.articleSubrubro,
      rubro: sug.articleRubro,
      matchType: sug.matchType,
      confidence: sug.confidence,
    });
  });

  return Array.from(byGroup.values()).sort((a, b) =>
    a.groupName.localeCompare(b.groupName, 'es')
  );
}

/**
 * 🆕 Verifica automáticamente si hay artículos nuevos sin agrupar
 * y devuelve sugerencias de agrupación
 * 
 * @param {string|number} businessId - ID del negocio
 * @returns {Promise<Array>} Sugerencias agrupadas por grupo destino
 */
export async function checkNewArticlesAndSuggest(businessId) {
  console.log('[autoGrouping] 🔍 Verificando artículos nuevos...');
  
  try {
    // 1️⃣ Cargar todos los artículos desde la BD
    const articlesRes = await BusinessesAPI.articlesFromDB(businessId);
    const items = articlesRes?.items || [];
    
    if (!items.length) {
      console.log('[autoGrouping] ℹ️ No hay artículos en la BD');
      return [];
    }

    // 2️⃣ Cargar agrupaciones actuales
    const agrupacionesRes = await httpBiz(`/businesses/${businessId}/articulos/agrupaciones`);
    const agrupaciones = agrupacionesRes?.agrupaciones || [];

    if (!agrupaciones.length) {
      console.log('[autoGrouping] ℹ️ No hay agrupaciones creadas');
      return [];
    }

    // 3️⃣ Identificar artículos ya agrupados
    const assignedIds = new Set();
    agrupaciones
      .filter(g => !esTodoGroup(g))
      .forEach(g => {
        (g.articulos || []).forEach(a => {
          assignedIds.add(Number(a.id));
        });
      });

    // 4️⃣ Encontrar artículos SIN agrupar
    const newArticles = items
      .filter(art => !assignedIds.has(Number(art.id)))
      .map(art => ({
        id: art.id,
        nombre: art.nombre || art.name,
        categoria: art.categoria || art.rubro,
        subrubro: art.subrubro || art.subcategoria,
      }));

    console.log(`[autoGrouping] 📦 ${newArticles.length} artículo(s) nuevo(s) detectado(s)`);

    // 5️⃣ Si no hay nuevos, retornar vacío
    if (newArticles.length === 0) {
      return [];
    }

    // 6️⃣ Construir árbol (opcional, para contexto)
    const todosArticulos = buildTree(items);

    // 7️⃣ Buscar coincidencias con grupos existentes
    const suggestions = findAutoGroupSuggestions(
      newArticles,
      agrupaciones.filter(g => !esTodoGroup(g)),
      todosArticulos
    );

    console.log(`[autoGrouping] 💡 ${suggestions.length} sugerencia(s) encontrada(s)`);

    // 8️⃣ Agrupar sugerencias por grupo destino
    if (suggestions.length > 0) {
      return groupSuggestionsByTarget(suggestions);
    }

    return [];
    
  } catch (error) {
    console.error('[autoGrouping] ❌ Error verificando artículos nuevos:', error);
    return [];
  }
}

/**
 * 🆕 Aplica las selecciones del modal de auto-agrupación
 * 
 * @param {Object} selections - { articleId: { groupId, groupName }, ... }
 * @param {Function} httpClient - Cliente HTTP (httpBiz)
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function applyAutoGrouping(selections, httpClient) {
  console.log('[autoGrouping] ✅ Aplicando auto-agrupación...', selections);
  
  if (!selections || typeof selections !== 'object') {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  // Agrupar por groupId para hacer bulk updates
  const byGroup = new Map();
  
  Object.entries(selections).forEach(([articleId, data]) => {
    const groupId = data?.groupId;
    if (!groupId) return;
    
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, []);
    }
    byGroup.get(groupId).push(Number(articleId));
  });

  // Aplicar cada grupo
  for (const [groupId, articleIds] of byGroup.entries()) {
    try {
      await httpClient(`/agrupaciones/${groupId}/articulos`, {
        method: 'PUT',
        body: JSON.stringify({ articulos: articleIds }),
      });
      success += articleIds.length;
      console.log(`[autoGrouping] ✅ ${articleIds.length} artículo(s) agregado(s) al grupo ${groupId}`);
    } catch (error) {
      console.error(`[autoGrouping] ❌ Error agrupando artículos al grupo ${groupId}:`, error);
      failed += articleIds.length;
    }
  }

  return { success, failed };
}

/**
 * 🆕 Crea una nueva agrupación
 * 
 * @param {string|number} businessId - ID del negocio
 * @param {string} nombre - Nombre de la nueva agrupación
 * @param {Array<number>} articulos - IDs de artículos a incluir (opcional)
 * @returns {Promise<number>} ID de la agrupación creada
 */
export async function createNewAgrupacion(businessId, nombre, articulos = []) {
  console.log(`[autoGrouping] 📝 Creando nueva agrupación: "${nombre}"`);
  
  try {
    const response = await httpBiz(`/businesses/${businessId}/articulos/agrupaciones`, {
      method: 'POST',
      body: JSON.stringify({
        nombre: nombre.trim(),
        articulos,
      }),
    });

    const newId = response?.id || response?.agrupacion?.id;
    console.log('[autoGrouping] ✅ Agrupación creada:', newId);
    return newId;
  } catch (error) {
    console.error('[autoGrouping] ❌ Error creando agrupación:', error);
    throw error;
  }
}