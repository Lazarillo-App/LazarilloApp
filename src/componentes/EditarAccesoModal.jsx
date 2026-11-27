/* eslint-disable no-empty */
// src/componentes/EditarAccesoModal.jsx
//
// Gestiona el acceso de una persona ya existente en el equipo:
// - Ver los negocios donde tiene acceso (con su rol).
// - Quitarle acceso a un negocio (revokeAssignment).
// - Agregarle acceso a otro negocio (createInvitation con su mismo email → el
//   backend hereda su alias automáticamente, así no diverge la identidad).
//
// Recibe la persona consolidada: { email, alias, negocios: [{assignmentId, scopeType, scopeId, scopeName, role, account_status}] }

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Box, Chip, IconButton, MenuItem,
  TextField, Alert, Divider, CircularProgress, Tooltip, Switch,
} from '@mui/material';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { createInvitation, revokeAssignment, updateAssignment, efectivosAcceso, pasarTitularidad } from '@/servicios/apiTeam';
import AjustesPersonaDialog from '@/componentes/configuracion/AjustesPersonaDialog';
import { cantidadAjustes } from '@/componentes/configuracion/catalogoPermisos';
import { listarSectores } from '@/servicios/apiSectores';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { showConfirm } from '@/servicios/appConfirm';
import { RolesAPI } from '@/servicios/apiRoles';
import GestionarSectoresModal from '@/componentes/GestionarSectoresModal';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';
import { Boton, Pastilla } from '@/componentes/produccion/ui';

const tc = 'var(--color-primary, #3b82f6)';

/* ─── Fila de un negocio con acceso: ver, editar rol/sector, o quitar ─── */
const ROL_LABEL = { owner: 'Dueño', admin: 'Administración', staff: 'Staff' };
// Valor del selector: 'admin' | 'staff' | 'rol:<id>' (rol a medida, se guarda como admin + customRoleId).
// Subroles de Staff (Diego 11/11/2026): 'staff:<id>' = subrol a medida (Jefe de cocina, Cocinero…).
const valorRol = (n) => (n.role === 'admin' && n.customRoleId ? `rol:${n.customRoleId}` : (n.role === 'staff' && n.customRoleId ? `staff:${n.customRoleId}` : n.role));
// Estilos del rediseño (usuaria 27/11/2026: mismo diseño que Producción y Mantenimiento).
const rotulo = { fontFamily: FB, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.text3, marginBottom: 6 };
const ayuda = { fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 6, lineHeight: 1.4 };
const linkSuave = { fontFamily: FB, fontSize: 12.5, fontWeight: 600, color: T.accentTxt, cursor: 'pointer' };
// Qué puede hacer un puesto, en una línea (para elegir sin ir a Roles).
const textoPermisos = (p) => {
  if (!p) return 'Lo básico del Staff: sin plata, solo lo de sus áreas.';
  const q = [];
  if (p.aprobar_equipo) q.push('aprueba al equipo');
  if (p.ver_precio) q.push('ve precios');
  if (p.ver_costo_pct) q.push('ve el % de costo');
  if (p.es_cocina) q.push('entra a Producción y Mantenimiento');
  return q.length ? `Este puesto ${q.join(', ')}.` : 'Lo básico del Staff: sin plata, solo lo de sus áreas.';
};
// Errores del back de co-dueño (Diego 14/11/2026) en castellano.
const ERRORES = {
  titular_pasa_primero: 'Es el titular de la cuenta: primero pasá la titularidad a otro Dueño.',
  only_owner_assigns_owner: 'Solo un Dueño puede hacer Dueño a otra persona.',
  cannot_revoke_owner: 'Al titular de la cuenta no se le puede quitar el acceso.',
  nuevo_no_es_duenio: 'La persona tiene que ser Dueño en todos los negocios antes de ser titular.',
  only_titular: 'Solo el titular puede pasar la titularidad.',
};
const textoError = (e, def) => {
  const c = e?.response?.data?.error || e?.data?.error || e?.message;
  return ERRORES[c] || c || def;
};
const nombreRol = (n) => (n.role === 'staff' && n.customRoleNombre ? `Staff · ${n.customRoleNombre}` : n.customRoleNombre) || ROL_LABEL[n.role] || n.role;
// "Igual a…": el acceso de otra persona que sirve de referencia (el del mismo negocio si tiene).
const accesoReferencia = (m, n) => (m.negocios || []).filter((x) => x.assignmentId)
  .sort((a, b) => Number(b.scopeType === n.scopeType && b.scopeId === n.scopeId) - Number(a.scopeType === n.scopeType && a.scopeId === n.scopeId))[0] || null;

function FilaNegocio({ n, persona, equipo = [], esYo, puedeInvitarAdmin, busy, onQuitar, onGuardado }) {
  const { isOwner, businesses = [] } = useAccess() || {};
  const editando = true; // siempre a la vista (sin lápiz)
  const [rol, setRol] = useState(valorRol(n));
  const [rolesMedida, setRolesMedida] = useState([]);
  const [subroles, setSubroles] = useState([]);
  const [creando, setCreando] = useState(null); // null | '' | nombre en edición
  const [sectorIds, setSectorIds] = useState(() => new Set(n.sectorIds || []));
  const [sectores, setSectores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState(null);
  const [gestionando, setGestionando] = useState(false);
  const [igualA, setIgualA] = useState(''); // email de la persona de referencia
  const [ajustesCopia, setAjustesCopia] = useState(null); // ajustes copiados con "Igual a…"
  const [ajustesDlg, setAjustesDlg] = useState(null); // { tipo, base, ajustes } al abrir "Ajustes solo para…"
  const [titularDlg, setTitularDlg] = useState(false);

  // Roles a medida de la organización de este acceso (solo los asigna el dueño).
  const bizDeFila = n.scopeType === 'business'
    ? n.scopeId
    : businesses.find((b) => Number(b.organization_id) === Number(n.scopeId))?.id;
  const cargarSubroles = () => RolesAPI.listStaff(bizDeFila).then((st) => { setSubroles(st?.subroles || []); return st?.subroles || []; }).catch(() => []);
  useEffect(() => {
    if (!editando || !bizDeFila) return;
    if (isOwner) RolesAPI.list(bizDeFila).then(setRolesMedida).catch(() => setRolesMedida([]));
    cargarSubroles();
  }, [editando, isOwner, n.scopeType, n.scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const crearSubrol = async () => {
    const nombre = String(creando || '').trim();
    if (!nombre) return;
    try {
      const res = await RolesAPI.createStaff(nombre, bizDeFila);
      await cargarSubroles();
      if (res?.subrol?.id) setRol(`staff:${res.subrol.id}`);
      setCreando(null);
    } catch (e) {
      const err = e?.response?.data?.error || e?.data?.error || e?.message;
      setErrorEdit(err === 'nombre_repetido' ? 'Ya hay un rol con ese nombre.' : err === 'nombre_reservado' ? 'Ese nombre lo usa un rol fijo.' : (err || 'No se pudo crear'));
    }
  };

  const cargarSectores = () => {
    if (!rol.startsWith('staff') || n.scopeType !== 'business') { setSectores([]); return; }
    listarSectores(n.scopeId)
      .then((list) => setSectores(Array.isArray(list) ? list : []))
      .catch(() => setSectores([]));
  };

  useEffect(() => {
    if (!editando) return;
    cargarSectores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, rol, n.scopeType, n.scopeId]);

  const empezarEdicion = () => {
    setRol(valorRol(n));
    setSectorIds(new Set(n.sectorIds || []));
    setErrorEdit(null);
    setIgualA(''); setAjustesCopia(null);
    setErrorEdit(null);
  };
  // Lo guardado cambió (se recargó el equipo): la tarjeta muestra lo nuevo.
  useEffect(() => { empezarEdicion(); }, [n.assignmentId, n.role, n.customRoleId, (n.sectorIds || []).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Personas que sirven de referencia: con acceso propio y cuyo rol puedo asignar.
  const referencias = useMemo(() => equipo
    .filter((m) => m.email !== persona?.email)
    .map((m) => ({ m, ref: accesoReferencia(m, n) }))
    .filter(({ ref }) => ref && (isOwner || (ref.role !== 'owner' && (puedeInvitarAdmin || ref.role === 'staff'))))
    .sort((a, b) => String(a.m.alias || a.m.email).localeCompare(String(b.m.alias || b.m.email))),
  [equipo, persona?.email, n, isOwner, puedeInvitarAdmin]);

  const elegirIgualA = (email) => {
    setIgualA(email);
    const r = referencias.find((x) => x.m.email === email)?.ref;
    if (!r) { setAjustesCopia(null); return; }
    setRol(valorRol(r));
    // Los sectores son de cada negocio: se copian solo si es el mismo.
    if (r.scopeType === 'business' && n.scopeType === 'business' && Number(r.scopeId) === Number(n.scopeId)) setSectorIds(new Set(r.sectorIds || []));
    setAjustesCopia(r.role === 'owner' ? {} : (r.ajustes || {}));
  };

  const abrirAjustes = async () => {
    setErrorEdit(null);
    try {
      const r = await efectivosAcceso(n.assignmentId);
      setAjustesDlg({ tipo: r.tipo === 'staff' ? 'staff' : 'admin', base: r.base || {}, ajustes: r.ajustes || {} });
    } catch (e) { setErrorEdit(textoError(e, 'No se pudieron leer sus permisos')); }
  };
  const guardarAjustes = async (ajustes) => {
    await updateAssignment(n.assignmentId, { ajustes });
    try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
    onGuardado?.();
  };

  const guardar = async () => {
    setGuardando(true); setErrorEdit(null);
    try {
      const esMedida = rol.startsWith('rol:');
      const role = esMedida ? 'admin' : (rol.startsWith('staff') ? 'staff' : rol);
      await updateAssignment(n.assignmentId, {
        role,
        ...(ajustesCopia && role !== 'owner' ? { ajustes: ajustesCopia } : {}),
        ...(role === 'staff' ? { customRoleId: rol.startsWith('staff:') ? Number(rol.slice(6)) : null } : {}),
        sectorIds: role === 'staff' ? Array.from(sectorIds) : [],
        // Solo el dueño toca el rol a medida (null = Administración completa).
        ...(isOwner && role === 'admin' ? { customRoleId: esMedida ? Number(rol.slice(4)) : null } : {}),
      });
      try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
      setIgualA(''); setAjustesCopia(null);
      onGuardado?.();
    } catch (e) {
      setErrorEdit(textoError(e, 'No se pudo guardar'));
    } finally {
      setGuardando(false);
    }
  };

  // Co-dueño (Diego 14/11/2026): un Dueño puede cambiar a otro Dueño; el titular solo pasando la titularidad.
  const puedeEditar = !!n.assignmentId && !n.esTitular && (n.role !== 'owner' || isOwner);
  // Ajustes solo para esta persona: el Dueño a cualquiera; el resto solo al Staff.
  const puedeAjustar = !!n.assignmentId && n.role !== 'owner' && (isOwner || n.role === 'staff');
  const nAjustes = cantidadAjustes(n.ajustes);
  const bizTitularidad = n.scopeType === 'business' ? n.scopeId : bizDeFila;

  // ¿Cambió algo respecto de lo guardado? (usuaria 27/11/2026: un solo «Guardar cambios», sin lápiz)
  const sectoresGuardados = new Set(n.sectorIds || []);
  const cambioSectores = rol.startsWith('staff') && (sectorIds.size !== sectoresGuardados.size || [...sectorIds].some((x) => !sectoresGuardados.has(x)));
  const hayCambios = puedeEditar && (rol !== valorRol(n) || cambioSectores || !!ajustesCopia);
  const esStaff = rol === 'staff' || rol.startsWith('staff:');
  const opcionesRol = [
    ...(isOwner ? [{ v: 'owner', l: 'Dueño' }] : []),
    ...(puedeInvitarAdmin ? [{ v: 'admin', l: 'Administración' }] : []),
    ...(puedeInvitarAdmin ? rolesMedida.map((r) => ({ v: `rol:${r.id}`, l: r.nombre })) : []),
    ...(rol.startsWith('rol:') && !rolesMedida.some((r) => `rol:${r.id}` === rol) ? [{ v: rol, l: n.customRoleNombre || 'Rol a medida' }] : []),
    { v: 'staff', l: 'Staff' },
  ];
  const subrolActual = rol.startsWith('staff:') ? (subroles.find((x) => `staff:${x.id}` === rol) || { id: rol.slice(6), nombre: n.customRoleNombre || 'Subrol', permisos: {} }) : null;
  const listaSubroles = subrolActual && !subroles.some((x) => `staff:${x.id}` === rol) ? [...subroles, subrolActual] : subroles;
  const rolNombreVista = rol === 'owner' ? 'Dueño' : rol === 'admin' ? 'Administración' : rol.startsWith('rol:') ? (opcionesRol.find((o) => o.v === rol)?.l || 'Rol a medida')
    : subrolActual ? subrolActual.nombre : 'Staff';

  return (
    <div style={{ border: `1px solid ${hayCambios ? T.accent : T.border}`, borderRadius: 14, background: T.band, overflow: 'hidden', fontFamily: FB }}>
      {/* encabezado del negocio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: T.head, borderBottom: `1px solid ${T.border}` }}>
        <BusinessIcon sx={{ fontSize: 18, color: T.text3 }} />
        <span style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, flex: 1, minWidth: 0 }}>{n.scopeName}</span>
        {n.esTitular && <Pastilla color="#9a6b00" fondo="#f5b30118" title="Titular de la cuenta">★ Titular</Pastilla>}
        {n.account_status === 'invited' && <Pastilla color={T.warn} fondo="#FFF6E5">Pendiente</Pastilla>}
        {!n.esTitular && (n.role !== 'owner' || isOwner) && (
          <Tooltip title="Quitar el acceso a este negocio">
            <span><IconButton size="small" onClick={() => onQuitar(n)} disabled={busy} sx={{ color: T.bad }}><DeleteOutlineIcon fontSize="small" /></IconButton></span>
          </Tooltip>
        )}
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {errorEdit && <Alert severity="error" onClose={() => setErrorEdit(null)}>{errorEdit}</Alert>}
        {!puedeEditar ? (
          <div style={{ fontSize: 13.5, color: T.text2 }}>
            Rol: <b style={{ color: T.text }}>{nombreRol(n)}</b>{n.esTitular ? ' · es el titular: para cambiarlo, primero pasá la titularidad.' : ''}
          </div>
        ) : (<>
          {/* Rol */}
          <div>
            <div style={rotulo}>Rol</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {opcionesRol.map((o) => (
                <Boton key={o.v} chico activo={o.v === 'staff' ? esStaff : rol === o.v} onClick={() => { setRol(o.v === 'staff' && esStaff ? rol : o.v); setIgualA(''); setAjustesCopia(null); }}>{o.l}</Boton>
              ))}
            </div>
            {rol === 'owner' && n.role !== 'owner' && <div style={ayuda}>Como Dueño ve y edita todo, puede sumar Dueños y gestionar roles. El titular de la cuenta sigue siendo uno solo.</div>}
            {rol === 'admin' && <div style={ayuda}>Administración ve y maneja todo el negocio, menos lo que es solo del Dueño.</div>}
          </div>

          {/* Puesto dentro del Staff */}
          {esStaff && (
            <div>
              <div style={rotulo}>Puesto</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Boton chico activo={rol === 'staff'} onClick={() => setRol('staff')}>Staff común</Boton>
                {listaSubroles.map((x) => (
                  <Boton key={x.id} chico activo={rol === `staff:${x.id}`} onClick={() => setRol(`staff:${x.id}`)}>{x.nombre}</Boton>
                ))}
                <Boton chico onClick={() => setCreando('')} style={{ borderStyle: 'dashed', color: T.accentTxt }}>+ Nuevo puesto</Boton>
              </div>
              <div style={ayuda}>{textoPermisos(subrolActual?.permisos)} Qué puede hacer cada puesto se cambia en Configuración › Roles.</div>
            </div>
          )}

          {/* Áreas */}
          {esStaff && n.scopeType === 'business' && (
            <div>
              <div style={rotulo}>{subrolActual?.permisos?.aprobar_equipo ? 'Áreas que conduce' : 'Áreas'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {sectores.map((s) => (
                  <Boton key={s.id} chico activo={sectorIds.has(s.id)} onClick={() => setSectorIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                    return next;
                  })}>{s.nombre}</Boton>
                ))}
                <span onClick={() => setGestionando(true)} style={{ ...linkSuave, marginLeft: 4 }}>Editar áreas</span>
              </div>
              <div style={ayuda}>
                {subrolActual?.permisos?.aprobar_equipo
                  ? 'Da el OK a los cambios de su equipo de estas áreas antes de que lleguen a vos.'
                  : 'Define qué artículos y recetas ve. Podés tildar más de una.'}
              </div>
              <GestionarSectoresModal open={gestionando} onClose={() => { setGestionando(false); cargarSectores(); }} businessId={n.scopeId} />
            </div>
          )}

          {/* Atajos y extras */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
            {referencias.length > 0 && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.text2 }}>
                Copiar de
                <select value={igualA} onChange={(e) => elegirIgualA(e.target.value)}
                  style={{ fontFamily: FB, fontSize: 12.5, padding: '4px 6px', borderRadius: 8, border: `1px solid ${T.border2}`, background: T.band, color: T.text, maxWidth: 190 }}>
                  <option value="">otra persona…</option>
                  {referencias.map(({ m, ref }) => <option key={m.email} value={m.email}>{m.alias || m.email} · {nombreRol(ref)}</option>)}
                </select>
              </label>
            )}
            {puedeAjustar && <span onClick={abrirAjustes} style={linkSuave}>Ajustes solo para esta persona{nAjustes ? ` (${nAjustes})` : ''}</span>}
            {n.esTitular && esYo && isOwner && <span onClick={() => setTitularDlg(true)} style={linkSuave}>Pasar titularidad…</span>}
          </div>
          {igualA && (
            <div style={ayuda}>
              Copia el rol{esStaff && n.scopeType === 'business' && referencias.find((x) => x.m.email === igualA)?.ref?.scopeId === n.scopeId ? ', las áreas' : ''} y los ajustes de {referencias.find((x) => x.m.email === igualA)?.m.alias || igualA}. Es una copia: si después le cambiás algo a esa persona, este acceso no se toca.
            </div>
          )}
        </>)}
      </div>

      {/* Guardar: solo cuando hay algo distinto */}
      {hayCambios && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderTop: `1px solid ${T.border}`, background: '#F2FAFE' }}>
          <span style={{ fontSize: 12.5, color: T.text2, flex: '1 1 200px' }}>Queda como <b style={{ color: T.text }}>{rolNombreVista}</b>{esStaff && sectorIds.size ? ` · ${sectores.filter((s) => sectorIds.has(s.id)).map((s) => s.nombre).join(', ')}` : ''}</span>
          <Boton chico onClick={empezarEdicion} deshabilitado={guardando}>Descartar</Boton>
          <Boton chico primario onClick={guardar} deshabilitado={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Boton>
        </div>
      )}
      <Dialog open={creando !== null} onClose={() => setCreando(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Nuevo subrol de Staff</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" placeholder="Ej. Cocinero, Mozo, Jefe de barra" value={creando || ''}
            onChange={(e) => setCreando(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') crearSubrol(); }} sx={{ mt: 0.5 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Nace con lo básico del Staff. Qué más puede hacer se tilda en Mi equipo › Roles.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreando(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!String(creando || '').trim()} onClick={crearSubrol} sx={{ bgcolor: tc }}>Crear</Button>
        </DialogActions>
      </Dialog>
      {ajustesDlg && (
        <AjustesPersonaDialog open onClose={() => setAjustesDlg(null)}
          persona={persona?.alias || persona?.email} rolNombre={nombreRol(n)}
          tipo={ajustesDlg.tipo} base={ajustesDlg.base} ajustes={ajustesDlg.ajustes} onGuardar={guardarAjustes} />
      )}
      {titularDlg && (
        <PasarTitularidadDialog onClose={() => setTitularDlg(false)} equipo={equipo} yoEmail={persona?.email}
          businessId={bizTitularidad} onHecho={() => { try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {} onGuardado?.(); }} />
      )}
    </div>
  );
}

/* ─── Pasar la titularidad de la cuenta a otro Dueño (Diego 14/11/2026) ─── */
function PasarTitularidadDialog({ onClose, equipo, yoEmail, businessId, onHecho }) {
  const duenios = equipo.filter((m) => m.email !== yoEmail && (m.negocios || []).some((x) => x.role === 'owner'));
  const [userId, setUserId] = useState(duenios[0]?.user_id || '');
  const [sigoDuenio, setSigoDuenio] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const pasar = async () => {
    setGuardando(true); setError(null);
    try {
      await pasarTitularidad({ businessId: Number(businessId), userId: Number(userId), yoQuedo: sigoDuenio ? 'owner' : 'admin' });
      onHecho?.(); onClose();
    } catch (e) { setError(textoError(e, 'No se pudo pasar la titularidad')); }
    finally { setGuardando(false); }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
        <StarRoundedIcon sx={{ color: '#f5b301' }} /> Pasar titularidad
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
        {!duenios.length ? (
          <Typography variant="body2" color="text.secondary">
            La titularidad pasa a otro Dueño. Primero hacé Dueño a alguien: Editar acceso › Rol › Dueño.
          </Typography>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField select size="small" label="Nuevo titular" value={userId} onChange={(e) => setUserId(e.target.value)} fullWidth>
              {duenios.map((m) => <MenuItem key={m.email} value={m.user_id}>{m.alias || m.email}</MenuItem>)}
            </TextField>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Yo sigo como Dueño</Typography>
              <Switch checked={sigoDuenio} onChange={(e) => setSigoDuenio(e.target.checked)} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {sigoDuenio ? 'Seguís viendo y editando todo; solo deja de ser tuya la cuenta.' : 'Quedás como Administración.'} Pasa en todos los negocios de la cuenta.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
        {!!duenios.length && (
          <Button variant="contained" disableElevation onClick={pasar} disabled={guardando || !userId} sx={{ bgcolor: tc }}>
            {guardando ? 'Pasando…' : 'Pasar titularidad'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function EditarAccesoModal({ open, onClose, persona, equipo = [], esYo = false, onChanged }) {
  const { items: allBusinesses, activeId } = useBusiness() || {};
  const { canDo, isOwner } = useAccess() || {};
  const puedeInvitarAdmin = canDo?.('invite_admin');

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Fila "agregar negocio"
  const [nuevoBizId, setNuevoBizId] = useState('');
  const [nuevoRol, setNuevoRol] = useState(puedeInvitarAdmin ? 'admin' : 'staff');
  const [sectores, setSectores] = useState([]);
  const [sectorIds, setSectorIds] = useState(() => new Set());
  const [gestionandoSectores, setGestionandoSectores] = useState(false);
  const [agregando, setAgregando] = useState(false);
  useEffect(() => { cargarFuentes(); }, []);

  const negocios = persona?.negocios || [];

  // Roles a medida (Gerente, etc.) del negocio elegido para agregar — igual que en
  // la fila de cada negocio: solo el dueño los asigna (Diego 10/11/2026).
  const [rolesMedidaNuevo, setRolesMedidaNuevo] = useState([]);
  // Sin negocio elegido todavía se muestran los del negocio activo (los roles son de la
  // organización); al elegir negocio se recargan con los de ése (Diego 10/11/2026: «no veo el de gerente»).
  const bizParaRoles = nuevoBizId || activeId || allBusinesses?.[0]?.id || null;
  useEffect(() => {
    if (!isOwner || !bizParaRoles) { setRolesMedidaNuevo([]); return; }
    let alive = true;
    RolesAPI.list(bizParaRoles)
      .then((l) => { if (alive) setRolesMedidaNuevo((Array.isArray(l) ? l : []).filter((r) => !r.es_administracion && !r.esAdministracion)); })
      .catch(() => { if (alive) setRolesMedidaNuevo([]); });
    return () => { alive = false; };
  }, [isOwner, bizParaRoles]);
  useEffect(() => {
    if (nuevoRol.startsWith('rol:') && !rolesMedidaNuevo.some((r) => `rol:${r.id}` === nuevoRol)) setNuevoRol('admin');
  }, [rolesMedidaNuevo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Subroles de Staff (Jefe de cocina…) del negocio elegido: también al agregar a otro negocio
  // (Diego 12/11/2026). El back ya acepta role 'staff' + customRoleId en la invitación.
  const [subrolesNuevo, setSubrolesNuevo] = useState([]);
  useEffect(() => {
    if (!bizParaRoles) { setSubrolesNuevo([]); return; }
    let alive = true;
    RolesAPI.listStaff(bizParaRoles)
      .then((st) => { if (alive) setSubrolesNuevo(st?.subroles || []); })
      .catch(() => { if (alive) setSubrolesNuevo([]); });
    return () => { alive = false; };
  }, [bizParaRoles]);
  useEffect(() => {
    if (nuevoRol.startsWith('staff:') && !subrolesNuevo.some((x) => `staff:${x.id}` === nuevoRol)) setNuevoRol('staff');
  }, [subrolesNuevo]); // eslint-disable-line react-hooks/exhaustive-deps
  const esStaffNuevo = nuevoRol === 'staff' || nuevoRol.startsWith('staff:');

  // Sector (Vista Operación): mismo criterio que InvitarMiembroModal — solo
  // tiene sentido con rol Staff, y se carga para el negocio recién elegido.
  useEffect(() => {
    if (!esStaffNuevo || !nuevoBizId) { setSectores([]); setSectorIds(new Set()); return; }
    let alive = true;
    listarSectores(nuevoBizId)
      .then((list) => { if (alive) setSectores(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setSectores([]); });
    return () => { alive = false; };
  }, [esStaffNuevo, nuevoBizId]);

  // Negocios donde la persona YA tiene acceso (por scopeId de tipo business)
  const idsConAcceso = useMemo(() => {
    const s = new Set();
    negocios.forEach(n => { if (n.scopeType === 'business') s.add(Number(n.scopeId)); });
    return s;
  }, [negocios]);

  // Negocios disponibles para agregar (los que no tiene todavía)
  const negociosDisponibles = useMemo(() => {
    return (allBusinesses || [])
      .filter(b => !idsConAcceso.has(Number(b.id)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [allBusinesses, idsConAcceso]);

  const quitarAcceso = async (n) => {
    if (!n?.assignmentId) return;
    if (!(await showConfirm(`¿Quitar el acceso de "${persona.alias || persona.email}" a ${n.scopeName}?`, { danger: true }))) return;
    setBusy(true); setError(null);
    try {
      await revokeAssignment(n.assignmentId);
      try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
      onChanged?.();
    } catch (e) {
      setError(textoError(e, 'No se pudo quitar el acceso'));
    } finally {
      setBusy(false);
    }
  };

  const agregarAcceso = async () => {
    if (!nuevoBizId) { setError('Elegí un negocio para agregar'); return; }
    setBusy(true); setError(null);
    try {
      // Mismo email → el backend hereda el alias existente de la persona.
      await createInvitation({
        email: persona.email,
        scopeType: 'business',
        scopeId: Number(nuevoBizId),
        role: nuevoRol.startsWith('rol:') ? 'admin' : esStaffNuevo ? 'staff' : nuevoRol,
        ...(nuevoRol.startsWith('rol:') ? { customRoleId: Number(nuevoRol.slice(4)) } : {}),
        ...(nuevoRol.startsWith('staff:') ? { customRoleId: Number(nuevoRol.slice(6)) } : {}),
        alias: persona.alias || persona.email, // el backend igual lo pisa con el heredado
        sectorIds: esStaffNuevo && sectorIds.size ? Array.from(sectorIds) : undefined,
      });
      try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
      setNuevoBizId('');
      setSectorIds(new Set());
      setAgregando(false);
      onChanged?.();
    } catch (e) {
      setError(textoError(e, 'No se pudo agregar el acceso'));
    } finally {
      setBusy(false);
    }
  };

  if (!persona) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px', bgcolor: T.bg, fontFamily: FB } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: T.band, borderBottom: `1px solid ${T.border}` }}>
        <ManageAccountsOutlinedIcon sx={{ color: T.ink }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text, lineHeight: 1.25 }}>Acceso de {persona.alias || persona.email}</div>
          <div style={{ fontFamily: FB, fontSize: 12.5, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{persona.email}</div>
        </div>
        <span onClick={onClose} role="button" aria-label="Cerrar" style={{ cursor: 'pointer', color: T.text3, fontSize: 20, padding: 6 }}>✕</span>
      </div>
      <DialogContent sx={{ p: '16px 18px !important', fontFamily: FB }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          {negocios.length === 0 ? (
            <div style={{ fontSize: 13.5, color: T.text3 }}>Todavía no tiene acceso a ningún negocio.</div>
          ) : negocios.map((n) => (
            <FilaNegocio
              key={n.assignmentId ?? `${n.scopeType}-${n.scopeId}`}
              n={n} persona={persona} equipo={equipo} esYo={esYo}
              puedeInvitarAdmin={puedeInvitarAdmin} busy={busy}
              onQuitar={quitarAcceso} onGuardado={onChanged}
            />
          ))}

          {/* Otro negocio: aparte y solo si se pide, para no mezclarlo con el de arriba */}
          {negociosDisponibles.length > 0 && !agregando && (
            <Boton onClick={() => setAgregando(true)} style={{ alignSelf: 'flex-start', borderStyle: 'dashed', color: T.accentTxt }}>+ Dar acceso a otro negocio</Boton>
          )}
          {agregando && (
            <div style={{ border: `1px dashed ${T.border2}`, borderRadius: 14, background: T.band, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, flex: 1 }}>Dar acceso a otro negocio</span>
                <span onClick={() => { setAgregando(false); setNuevoBizId(''); setSectorIds(new Set()); }} style={{ ...linkSuave, color: T.text3 }}>Cancelar</span>
              </div>
              <div>
                <div style={rotulo}>Negocio</div>
                <select value={nuevoBizId} onChange={(e) => setNuevoBizId(e.target.value)}
                  style={{ fontFamily: FB, fontSize: 14, padding: '9px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.band, color: T.text, width: '100%', minHeight: 40 }}>
                  <option value="">Elegí el negocio…</option>
                  {negociosDisponibles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <div style={rotulo}>Rol</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {isOwner && <Boton chico activo={nuevoRol === 'owner'} onClick={() => setNuevoRol('owner')}>Dueño</Boton>}
                  {puedeInvitarAdmin && <Boton chico activo={nuevoRol === 'admin'} onClick={() => setNuevoRol('admin')}>Administración</Boton>}
                  {puedeInvitarAdmin && rolesMedidaNuevo.map((r) => <Boton key={r.id} chico activo={nuevoRol === `rol:${r.id}`} onClick={() => setNuevoRol(`rol:${r.id}`)}>{r.nombre}</Boton>)}
                  <Boton chico activo={esStaffNuevo} onClick={() => { if (!esStaffNuevo) setNuevoRol('staff'); }}>Staff</Boton>
                </div>
              </div>
              {esStaffNuevo && (
                <div>
                  <div style={rotulo}>Puesto</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Boton chico activo={nuevoRol === 'staff'} onClick={() => setNuevoRol('staff')}>Staff común</Boton>
                    {subrolesNuevo.map((x) => <Boton key={x.id} chico activo={nuevoRol === `staff:${x.id}`} onClick={() => setNuevoRol(`staff:${x.id}`)}>{x.nombre}</Boton>)}
                  </div>
                  <div style={ayuda}>{textoPermisos(subrolesNuevo.find((x) => `staff:${x.id}` === nuevoRol)?.permisos)}</div>
                </div>
              )}
              {esStaffNuevo && nuevoBizId && (
                <div>
                  <div style={rotulo}>Áreas</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {sectores.map((s) => (
                      <Boton key={s.id} chico activo={sectorIds.has(s.id)} onClick={() => setSectorIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                        return next;
                      })}>{s.nombre}</Boton>
                    ))}
                    <span onClick={() => setGestionandoSectores(true)} style={{ ...linkSuave, marginLeft: 4 }}>Editar áreas</span>
                  </div>
                  <div style={ayuda}>Define qué artículos y recetas ve. Podés tildar más de una.</div>
                  <GestionarSectoresModal
                    open={gestionandoSectores}
                    onClose={() => { setGestionandoSectores(false); listarSectores(nuevoBizId).then((list) => setSectores(Array.isArray(list) ? list : [])).catch(() => {}); }}
                    businessId={nuevoBizId}
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Boton primario onClick={agregarAcceso} deshabilitado={busy || !nuevoBizId}>{busy ? 'Guardando…' : 'Dar acceso'}</Boton>
              </div>
            </div>
          )}
          {negociosDisponibles.length === 0 && negocios.length > 0 && (
            <div style={{ fontSize: 12.5, color: T.text3 }}>Ya tiene acceso a todos tus negocios.</div>
          )}
        </div>
      </DialogContent>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 18px', background: T.band, borderTop: `1px solid ${T.border}` }}>
        <Boton onClick={onClose}>Cerrar</Boton>
      </div>
    </Dialog>
  );
}