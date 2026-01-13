// src/servicios/apiVentasCSV.js
import { BASE } from './apiBase';

const CSV_BASE = `${BASE}/api/ventas-csv`;

function getToken() {
  return localStorage.getItem('token') || '';
}

function getBusinessId() {
  return localStorage.getItem('activeBusinessId') || '';
}

/**
 * GET /api/ventas-csv/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function getSummaryCSV({ businessId, from, to }) {
  const bid = businessId || getBusinessId();
  const token = getToken();
  
  const url = `${CSV_BASE}/summary?from=${from}&to=${to}`;
  
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Business-Id': bid,
    },
  });
  
  if (!resp.ok) {
    throw new Error(`Error ${resp.status}`);
  }
  
  return resp.json();
}

/**
 * GET /api/ventas-csv/top-articles?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=1000
 */
export async function getTopArticlesCSV({ businessId, from, to, limit = 1000 }) {
  const bid = businessId || getBusinessId();
  const token = getToken();
  
  const url = `${CSV_BASE}/top-articles?from=${from}&to=${to}&limit=${limit}`;
  
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Business-Id': bid,
    },
  });
  
  if (!resp.ok) {
    throw new Error(`Error ${resp.status}`);
  }
  
  return resp.json();
}

/**
 * GET /api/ventas-csv/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function getDailyCSV({ businessId, from, to }) {
  const bid = businessId || getBusinessId();
  const token = getToken();
  
  const url = `${CSV_BASE}/daily?from=${from}&to=${to}`;
  
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Business-Id': bid,
    },
  });
  
  if (!resp.ok) {
    throw new Error(`Error ${resp.status}`);
  }
  
  return resp.json();
}

/**
 * GET /api/ventas-csv/by-group?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function getByGroupCSV({ businessId, from, to }) {
  const bid = businessId || getBusinessId();
  const token = getToken();
  
  const url = `${CSV_BASE}/by-group?from=${from}&to=${to}`;
  
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Business-Id': bid,
    },
  });
  
  if (!resp.ok) {
    throw new Error(`Error ${resp.status}`);
  }
  
  return resp.json();
}