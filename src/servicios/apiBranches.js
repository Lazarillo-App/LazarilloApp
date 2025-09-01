import { BASE } from './apiBase';
import { authHeaders } from './apiBusinesses';

async function http(path, { method='GET', body } = {}) {
  const bid = localStorage.getItem('activeBusinessId') || '';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(bid ? { 'X-Business-Id': bid } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const BranchesAPI = {
  list:   async () => (await http('/branches')).items,
  create: (payload) => http('/branches', { method: 'POST', body: payload }),
};
