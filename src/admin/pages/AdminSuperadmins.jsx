// src/admin/pages/AdminSuperadmins.jsx
// Super-admins (pedido de la usuaria, 10/11): todos los super-admins ven quién más tiene acceso al
// panel; agregar o quitar solo lo puede hacer la cuenta de control, y cada cambio pide un código
// que llega únicamente al mail de control.
import React, { useEffect, useState } from 'react';
import { TextField, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { AdminAPI } from '../../servicios/apiAdmin';
import { showAlert } from '../../servicios/appAlert';

const BRAND = { tinta: '#15213E' };
const tarjeta = { background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 };
const titulo = { fontWeight: 700, color: BRAND.tinta, fontSize: 15 };
const ayuda = { fontSize: 12.5, color: '#64748b' };

const ERRORES = {
  solo_cuenta_control: 'Solo la cuenta de control puede hacer este cambio.',
  email_invalido: 'Ese mail no es válido.',
  ya_es_superadmin: 'Esa cuenta ya es super-admin.',
  no_es_superadmin: 'Esa cuenta no es super-admin.',
  es_la_cuenta_de_control: 'A la cuenta de control no se le puede quitar el acceso.',
  cuenta_con_negocios: 'Esa cuenta ya usa negocios en Lazarillo. Un super-admin no puede entrar a negocios, así que perdería el acceso a los suyos: usá un mail aparte para el panel.',
  demasiados_codigos: 'Pediste muchos códigos en la última hora. Esperá un rato.',
  no_se_pudo_enviar_mail: 'No se pudo enviar el mail con el código. Revisá la configuración de mail.',
  pedi_un_codigo: 'Pedí un código nuevo.',
  codigo_vencido: 'El código venció. Pedí uno nuevo.',
  demasiados_intentos: 'Demasiados intentos con ese código. Pedí uno nuevo.',
  codigo_incorrecto: 'El código no es correcto.',
};
const mensajeError = (e) => {
  const code = e?.data?.error || e?.message || '';
  if (code === 'codigo_incorrecto' && e?.data?.quedan != null) return `El código no es correcto. Te quedan ${e.data.quedan} intentos.`;
  return ERRORES[code] || 'No se pudo hacer el cambio.';
};

export default function AdminSuperadmins() {
  const [data, setData] = useState(null);
  const [nuevoMail, setNuevoMail] = useState('');
  // { accion: 'dar'|'quitar', email } mientras se espera el código
  const [pendiente, setPendiente] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = () => AdminAPI.listSuperadmins().then(setData).catch(() => showAlert('No se pudo cargar la lista.', 'error'));
  useEffect(() => { cargar(); }, []);

  const pedir = async (accion, email) => {
    setOcupado(true);
    try {
      const r = await AdminAPI.pedirCodigoSuperadmin(accion, email);
      setPendiente({ accion, email, simulado: r.simulado });
      setCodigo('');
    } catch (e) {
      showAlert(mensajeError(e), 'error');
    } finally { setOcupado(false); }
  };

  const confirmar = async () => {
    setOcupado(true);
    try {
      const r = await AdminAPI.confirmarSuperadmin(pendiente.accion, pendiente.email, codigo);
      setPendiente(null);
      setNuevoMail('');
      if (r.quitado) showAlert(`Listo: ${r.email} ya no es super-admin.`, 'success');
      else if (r.creada) showAlert(`Listo: se creó la cuenta ${r.email}${r.linkEnviado ? ' y le llegó un link para elegir su contraseña' : ', pero no se pudo mandar el mail con el link'}.`, r.linkEnviado ? 'success' : 'warning');
      else showAlert(`Listo: ${r.email} ahora es super-admin.`, 'success');
      cargar();
    } catch (e) {
      showAlert(mensajeError(e), 'error');
    } finally { setOcupado(false); }
  };

  if (!data) return <div style={{ padding: 24 }}>Cargando…</div>;
  const { superadmins = [], puedoEditar, controlEmail } = data;

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '20px 28px', borderBottom: '0.5px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: BRAND.tinta }}>Super-admins</h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Quién tiene acceso a este panel.</p>
      </div>

      <div style={{ padding: '20px 28px', display: 'grid', gap: 18, maxWidth: 800 }}>
        <div style={tarjeta}>
          <div style={titulo}>Cuentas con acceso ({superadmins.length})</div>
          {superadmins.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #eef2f7', paddingTop: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, color: BRAND.tinta, fontSize: 14 }}>{u.email}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{u.name}{u.created_at ? ` · desde ${new Date(u.created_at).toLocaleDateString('es-AR')}` : ''}</div>
              </div>
              {u.control && <Chip size="small" color="primary" label="Cuenta de control" />}
              {u.status && u.status !== 'active' && <Chip size="small" color="warning" label={u.status} />}
              {puedoEditar && !u.control && (
                <Button size="small" color="error" disabled={ocupado} onClick={() => pedir('quitar', u.email)}>Quitar</Button>
              )}
            </div>
          ))}
        </div>

        <div style={tarjeta}>
          <div style={titulo}>Agregar super-admin</div>
          {puedoEditar ? (
            <>
              <div style={ayuda}>
                Usá un mail que no tenga negocios en Lazarillo: un super-admin solo entra al panel. Si la cuenta no existe, se crea y le llega un link para elegir su contraseña.
                Cada cambio pide un código que llega a {controlEmail}.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <TextField size="small" label="Mail" value={nuevoMail} onChange={(e) => setNuevoMail(e.target.value)} sx={{ flex: 1 }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && nuevoMail.trim()) pedir('dar', nuevoMail.trim()); }} />
                <Button variant="contained" disabled={ocupado || !nuevoMail.trim()} onClick={() => pedir('dar', nuevoMail.trim())}>Agregar</Button>
              </div>
            </>
          ) : (
            <div style={ayuda}>Solo la cuenta de control ({controlEmail}) puede agregar o quitar super-admins.</div>
          )}
        </div>
      </div>

      <Dialog open={!!pendiente} onClose={() => !ocupado && setPendiente(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Código de control</DialogTitle>
        <DialogContent>
          <div style={{ fontSize: 14, color: '#334155', marginBottom: 14 }}>
            {pendiente?.accion === 'dar' ? 'Para darle acceso a ' : 'Para quitarle el acceso a '}
            <b>{pendiente?.email}</b>, poné el código de 6 dígitos que llegó a {controlEmail}. Vence en 10 minutos.
            {pendiente?.simulado && <div style={{ marginTop: 8, color: '#b45309' }}>Ojo: el servidor no tiene mail configurado, el código quedó solo en los logs.</div>}
          </div>
          <TextField autoFocus fullWidth label="Código" value={codigo}
            inputProps={{ inputMode: 'numeric', maxLength: 6, style: { letterSpacing: 6, fontSize: 20, textAlign: 'center' } }}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter' && codigo.length === 6) confirmar(); }} />
        </DialogContent>
        <DialogActions>
          <Button disabled={ocupado} onClick={() => pedir(pendiente.accion, pendiente.email)}>Reenviar código</Button>
          <Button disabled={ocupado} onClick={() => setPendiente(null)}>Cancelar</Button>
          <Button variant="contained" disabled={ocupado || codigo.length !== 6} onClick={confirmar}>Confirmar</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
