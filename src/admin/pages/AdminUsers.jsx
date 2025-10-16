import React, { useEffect, useMemo, useState } from 'react';
import { AdminAPI } from '../../servicios/apiAdmin';
import {
  TextField, IconButton, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

function useUsers() {
  const [state, setState] = useState({ rows: [], total: 0, page: 1, pageSize: 20, q: '' });
  const refetch = async (patch = {}) => {
    const next = { ...state, ...patch };
    setState(next);
    const res = await AdminAPI.listUsers({ q: next.q, page: next.page, pageSize: next.pageSize });
    setState(s => ({ ...s, ...res }));
  };
  useEffect(() => { refetch({}); /* eslint-disable react-hooks/exhaustive-deps */ }, []);
  return { state, setState, refetch };
}

export default function AdminUsers() {
  const { state, setState, refetch } = useUsers();
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const onSearch = (e) => setState(s => ({ ...s, q: e.target.value }));
  const runSearch = () => refetch({ page: 1 });

  // 👇 roles y estados soportados por el backend
  const roles = useMemo(() => ['app_admin', 'owner', 'staff', 'viewer'], []);
  const statuses = useMemo(() => ['active', 'suspended', 'deleted'], []);

  const isAppAdmin = (u) => String(u?.role) === 'app_admin';

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <TextField
          size="small"
          placeholder="Buscar por email o nombre…"
          value={state.q}
          onChange={onSearch}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          style={{ flex: 1 }}
        />
        <Button variant="contained" onClick={runSearch}>Buscar</Button>
      </div>

      <div className="table" style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 10 }}>Email</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Nombre</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Rol</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Estado</th>
              <th style={{ textAlign: 'left', padding: 10, width: 220 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: 10 }}>{u.email}</td>
                <td style={{ padding: 10 }}>{u.name || '—'}</td>
                <td style={{ padding: 10 }}><Chip size="small" label={u.role} /></td>
                <td style={{ padding: 10 }}><Chip size="small" label={u.status} /></td>
                <td style={{ padding: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button
                    size="small"
                    onClick={() => setEdit(u)}
                    disabled={isAppAdmin(u)} // no editar app_admin (o edita sólo name/email si quieres)
                  >
                    Editar
                  </Button>

                  <IconButton
                    title="Reset password"
                    onClick={async () => {
                      const r = await AdminAPI.resetPassword(u.id);
                      alert(`Token temporal: ${r.token_preview}`);
                    }}
                  >
                    <RestartAltIcon />
                  </IconButton>

                  {u.status === 'deleted' ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={async () => {
                        await AdminAPI.restoreUser(u.id);
                        refetch({});
                      }}
                    >
                      Restaurar
                    </Button>
                  ) : (
                    <IconButton
                      color="error"
                      title={isAppAdmin(u) ? 'No se puede eliminar un administrador general' : 'Eliminar'}
                      disabled={isAppAdmin(u)}
                      onClick={() => setConfirmDel(u)}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
            {!state.rows.length && (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center' }}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Página {state.page}</span>
        <Button size="small" disabled={state.page <= 1} onClick={() => refetch({ page: state.page - 1 })}>Anterior</Button>
        <Button
          size="small"
          disabled={state.page * state.pageSize >= state.total}
          onClick={() => refetch({ page: state.page + 1 })}
        >
          Siguiente
        </Button>
        <span style={{ marginLeft: 'auto' }}>{state.total} usuarios</span>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!edit} onClose={() => setEdit(null)}>
        <DialogTitle>Editar usuario</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, minWidth: 360 }}>
          <TextField
            label="Nombre"
            value={edit?.name || ''}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          />

          <TextField
            label="Rol"
            select
            value={edit?.role || 'owner'}
            onChange={(e) => setEdit({ ...edit, role: e.target.value })}
            disabled={isAppAdmin(edit)}
            helperText={isAppAdmin(edit) ? 'El rol del administrador general no se puede modificar' : ''}
          >
            {roles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>

          <TextField
            label="Estado"
            select
            value={edit?.status || 'active'}
            onChange={(e) => setEdit({ ...edit, status: e.target.value })}
            disabled={isAppAdmin(edit)}
            helperText={isAppAdmin(edit) ? 'El estado del administrador general no se puede modificar' : ''}
          >
            {statuses.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={async () => {
              // si es app_admin, sólo permitimos cambiar name (el backend ya refuerza igual)
              const payload = isAppAdmin(edit)
                ? { name: edit.name }
                : { name: edit.name, role: edit.role, status: edit.status };

              await AdminAPI.updateUser(edit.id, payload);
              setEdit(null);
              refetch({});
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)}>
        <DialogTitle>Eliminar usuario</DialogTitle>
        <DialogContent>¿Seguro que deseas eliminar (soft-delete) este usuario?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDel(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              await AdminAPI.deleteUser(confirmDel.id);
              setConfirmDel(null);
              refetch({});
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
