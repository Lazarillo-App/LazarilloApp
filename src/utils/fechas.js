// src/utils/fechas.js

export function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Últimos N días, terminando en AYER (anclado a medianoche local) */
export function lastNDaysUntilYesterday(n) {
  const now = new Date();
  // hoy 00:00
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // AYER 00:00
  const endMid = new Date(todayMid);
  endMid.setDate(endMid.getDate() - 1);
  // desde = (n-1) días antes de AYER
  const startMid = new Date(endMid);
  startMid.setDate(startMid.getDate() - (n - 1));
  return { from: ymdLocal(startMid), to: ymdLocal(endMid) };
}

/**
 * Compatibilidad: antes devolvía hasta HOY; ahora delega a "hasta AYER"
 * para evitar parciales y resultados que varíen durante el día.
 */
export function lastNDaysLocal(n) {
  return lastNDaysUntilYesterday(n);
}

export function daysByMode(mode) {
  if (mode === '7') return 7;
  if (mode === '30') return 30;
  if (mode === '90') return 90;
  return 30; // default
}

/** Conveniencia: rango directo por modo (7|30|90) terminando en AYER */
export function rangeByModeUntilYesterday(mode) {
  return lastNDaysUntilYesterday(daysByMode(mode));
}

// ===================================================================
// ✅ NUEVAS FUNCIONES para presets MTD y YTD
// ===================================================================

/**
 * Month To Date (MTD) - Desde el primer día del mes hasta ayer
 * Ejemplo: Si hoy es 15 de enero, devuelve del 1 al 14 de enero
 */
export function monthToDateUntilYesterday() {
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // AYER
  const yesterday = new Date(todayMid);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Primer día del mes de AYER (por si hoy es día 1)
  const firstOfMonth = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
  
  return {
    from: ymdLocal(firstOfMonth),
    to: ymdLocal(yesterday)
  };
}

/**
 * Year To Date (YTD) - Desde el primer día del año hasta ayer
 * Ejemplo: Si hoy es 15 de enero 2024, devuelve del 1 enero al 14 enero 2024
 */
export function yearToDateUntilYesterday() {
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // AYER
  const yesterday = new Date(todayMid);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Primer día del año de AYER
  const firstOfYear = new Date(yesterday.getFullYear(), 0, 1);
  
  return {
    from: ymdLocal(firstOfYear),
    to: ymdLocal(yesterday)
  };
}

/**
 * ✅ FUNCIÓN UNIFICADA: Obtener rango según modo
 * Soporta: '7', '30', '90', 'mtd', 'ytd', 'custom'
 */
export function getRangeByMode(mode, customRange = null) {
  switch (mode) {
    case '7':
      return lastNDaysUntilYesterday(7);
    case '30':
      return lastNDaysUntilYesterday(30);
    case '90':
      return lastNDaysUntilYesterday(90);
    case 'mtd':
      return monthToDateUntilYesterday();
    case 'ytd':
      return yearToDateUntilYesterday();
    case 'custom':
      if (customRange && customRange.from && customRange.to) {
        return customRange;
      }
      // Fallback a 30 días si custom no tiene datos
      return lastNDaysUntilYesterday(30);
    default:
      return lastNDaysUntilYesterday(30);
  }
}

/**
 * ✅ Validar que un rango de fechas sea válido
 * @param {string} from - Fecha desde (YYYY-MM-DD)
 * @param {string} to - Fecha hasta (YYYY-MM-DD)
 * @param {boolean} allowFuture - Permitir fechas futuras (default: false)
 * @returns {boolean}
 */
export function isValidRange(from, to, allowFuture = false) {
  if (!from || !to) return false;
  
  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    // Verificar que sean fechas válidas
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return false;
    }
    
    // From debe ser anterior o igual a To
    if (fromDate > toDate) {
      return false;
    }
    
    // To no puede ser futuro (máximo ayer) - solo si no se permite futuro
    if (!allowFuture) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);
      
      if (toDate > yesterday) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * ✅ Calcular días entre dos fechas
 */
export function daysBetween(from, to) {
  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffMs = toDate - fromDate;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir ambos días
  } catch {
    return 0;
  }
}

/**
 * ✅ Obtener el label descriptivo de un rango
 */
export function getRangeLabel(mode, from, to) {
  switch (mode) {
    case '7':
      return '📅 Últimos 7 días';
    case '30':
      return '📊 Últimos 30 días';
    case '90':
      return '📈 Últimos 90 días';
    case 'mtd':
      return '🗓️ Mes actual';
    case 'ytd':
      return '📆 Año actual';
    case 'custom':
      if (from && to) {
        const days = daysBetween(from, to);
        return `📅 ${days} días (${from} a ${to})`;
      }
      return '📅 Personalizado';
    default:
      return 'Período';
  }
}