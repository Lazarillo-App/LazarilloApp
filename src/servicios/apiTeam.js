// src/servicios/apiTeam.js
//
// Cliente API para gestión de equipo (invitaciones, asignaciones, alias).
// Usa el wrapper `http` de apiBusinesses para mantener consistencia.

import { http } from './apiBusinesses';

const qs = (params = {}) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    u.append(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
};

export const TeamAPI = {
  /**
   * Lista miembros de un scope (business u organization).
   * Si no se pasa scope, devuelve todos los miembros visibles para el caller.
   */
  async listMembers({ scopeType, scopeId } = {}) {
    const url = `/team/members${qs({ scopeType, scopeId })}`;
    const data = await http(url, { withBusinessId: false });
    return data?.members || [];
  },

  /**
   * Lista invitaciones pendientes (account_status='invited').
   */
  async listPendingInvitations({ scopeType, scopeId }) {
    const url = `/team/invitations${qs({ scopeType, scopeId })}`;
    const data = await http(url, { withBusinessId: false });
    return data?.invitations || [];
  },

  /**
   * Crea una invitación. Manda mail si está configurado el SMTP.
   */
  async createInvitation({ email, scopeType, scopeId, role, alias }) {
    return http('/team/invitations', {
      method: 'POST',
      body: { email, scopeType, scopeId, role, alias },
      withBusinessId: false,
    });
  },

  /**
   * Reenvía la invitación (regenera token).
   */
  async resendInvitation(assignmentId) {
    return http(`/team/invitations/${assignmentId}/resend`, {
      method: 'POST',
      withBusinessId: false,
    });
  },

  /**
   * Actualiza alias o rol de un miembro.
   */
  async updateAssignment(assignmentId, { alias, role } = {}) {
    return http(`/team/assignments/${assignmentId}`, {
      method: 'PATCH',
      body: { alias, role },
      withBusinessId: false,
    });
  },

  /**
   * Revoca el acceso (soft-delete).
   */
  async revokeAssignment(assignmentId) {
    return http(`/team/assignments/${assignmentId}`, {
      method: 'DELETE',
      withBusinessId: false,
    });
  },

  /**
   * Acepta una invitación. ENDPOINT PÚBLICO (no requiere token).
   */
  async acceptInvitation({ token, email, password }) {
    return http('/auth/accept-invitation', {
      method: 'POST',
      body: { token, email, password },
      withBusinessId: false,
      noAuthRedirect: true,
    });
  },
};

// Exports nombrados sueltos para conveniencia (los uso así en los componentes)
export const listMembers          = TeamAPI.listMembers;
export const listPendingInvitations = TeamAPI.listPendingInvitations;
export const createInvitation     = TeamAPI.createInvitation;
export const resendInvitation     = TeamAPI.resendInvitation;
export const updateAssignment     = TeamAPI.updateAssignment;
export const revokeAssignment     = TeamAPI.revokeAssignment;
export const acceptInvitation     = TeamAPI.acceptInvitation;