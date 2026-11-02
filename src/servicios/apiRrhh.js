// src/servicios/apiRrhh.js
// API del módulo RRHH (Cronogramas, Etapa 1) — back: /api/businesses/:id/rrhh/*
// Usa el cliente liviano de apiBase (Bearer + X-Business-Id automáticos).

import { api, getSession, qs } from './apiBase';

const base = () => {
  const { activeBusinessId } = getSession();
  return `/businesses/${activeBusinessId}/rrhh`;
};

export const RrhhAPI = {
  // Config (empleados + puestos + fechas especiales + espacios con turnos).
  // El primer GET siembra los defaults del negocio (espacios, turnos,
  // referencias y feriados AR) en el back.
  getConfig: () => api(`${base()}/config`),
  putConfig: (body) => api(`${base()}/config`, { method: 'PUT', body }),

  // Nómina: la réplica de MaxiRest se lista para TILDAR (mezcla empleados
  // reales con usuarios técnicos del POS) y se importan solo los elegidos.
  nominaMaxirest: () => api(`${base()}/empleados/nomina-maxirest`),
  importarNomina: (codigos) =>
    api(`${base()}/empleados/importar`, {
      method: 'POST',
      body: Array.isArray(codigos) ? { codigos } : {},
    }),
  crearEmpleado: (body) => api(`${base()}/empleados`, { method: 'POST', body }),
  editarEmpleado: (id, body) =>
    api(`${base()}/empleados/${id}`, { method: 'PATCH', body }),

  // Semanas de cronograma (AAASS). El PUT reemplaza la semana completa del
  // espacio en una transacción: es el guardado tras cada acción del front.
  listarSemanas: () => api(`${base()}/semanas`),
  getSemana: (semana, espacioId) =>
    api(`${base()}/semanas/${semana}${qs({ espacioId })}`),
  putSemana: (semana, body) =>
    api(`${base()}/semanas/${semana}`, { method: 'PUT', body }),
  borrarSemana: (semana, espacioId) =>
    api(`${base()}/semanas/${semana}${qs({ espacioId })}`, { method: 'DELETE' }),
};

export default RrhhAPI;
