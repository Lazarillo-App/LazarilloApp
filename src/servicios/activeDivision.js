// src/servicios/activeDivision.js
const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

const getUserId = () => {
  const u = safeJson(localStorage.getItem('user') || 'null');
  return u?.id ? String(u.id) : null;
};

const keyFor = (businessId) => {
  const uid = getUserId();
  const bid = businessId ? String(businessId) : '';
  return uid ? `activeDivisionId:${uid}:${bid}` : `activeDivisionId:${bid}`;
};

export function getActiveDivisionId(businessId) {
  if (!businessId) return '';
  return localStorage.getItem(keyFor(businessId)) || '';
}

export function setActiveDivisionId(businessId, divisionId) {
  if (!businessId) return;
  const k = keyFor(businessId);

  if (divisionId === null || divisionId === undefined || divisionId === '') {
    localStorage.removeItem(k);
    return;
  }
  localStorage.setItem(k, String(divisionId));
}

export function clearActiveDivisionId(businessId) {
  if (!businessId) return;
  localStorage.removeItem(keyFor(businessId));
}
