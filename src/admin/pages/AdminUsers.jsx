import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAPI } from '../../servicios/apiAdmin';
import {
  TextField, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

function useUsers() {
  const [state, setState] = useState({ rows: [], total: 0, page: 1, pageSize: 20, q: '', status: '' });
  const refetch = async (patch = {}) => {
    const next = { ...state, ...patch };
    setState(next);
    const res = await AdminAPI.listUsers({ q: next.q, status: next.status, page: next.page, pageSize: next.pageSize });
    setState(s => ({ ...s, ...res }));
  };
  useEffect(() => { refetch({}); /* eslint-disable react-hooks/exhaustive-deps */ }, []);
  return { state, setState, refetch };
}

export default function AdminUsers() {
  const { state, setState, refetch } = useUsers();
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const nav = useNavigate();


  const roles = useMemo(() => ['app_admin', 'owner', 'staff', 'viewer'], []);
  const statuses = useMemo(() => ['active', 'suspended', 'deleted'], []);
  const isAppAdmin = (u) => String(u?.role) === 'app_admin';

  const runSearch = () => refetch({ page: 1 });

  return (
    <div className="au-wrap">
      <div className="au-search">
        <div className="row">
          <TextField
            size="small"
            placeholder="Buscar por nombre, email…"
            value={state.q}
            onChange={(e) => setState(s => ({ ...s, q: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            fullWidth
          />
        </div>
        <div className="row">
          <TextField
            size="small"
            select
            value={state.status}
            onChange={(e) => setState(s => ({ ...s, status: e.target.value }))}
            fullWidth
            label="Filtrar por estado"
          >
            <MenuItem value="">Todos</MenuItem>
            {statuses.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <Button variant="contained" onClick={runSearch} sx={{ borderRadius: 2 }}>Aplicar</Button>
        </div>
        <div className="stat">
          <div className="title">Usuarios activos</div>
          <div className="value">{state.rows.filter(u => u.status === 'active').length}</div>
        </div>
      </div>
      <div className="au-card">
        <div className="title">Todos los usuarios</div>
        {state.rows.map(u => (
          <div
            key={u.id}
            className="item"
            onClick={() => nav(`/admin/usuarios/${u.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <div className="avatar">{(u.name || u.email || '?')[0]?.toUpperCase()}</div>
            <div className="info">
              <div className="name">{u.name || '—'}</div>
              <div className="sub">{u.email}</div>
            </div>
            <span className={`pill role ${u.role}`}>{u.role}</span>
            <span className={`pill ${u.status === 'active' ? 'ok' : u.status === 'suspended' ? 'warn' : 'del'}`}>
              {u.status}
            </span>
            <div className="actions" onClick={(e) => e.stopPropagation()}>
              <IconButton
                title="Reset password"
                size="small"
                onClick={async () => {
                  const r = await AdminAPI.resetPassword(u.id);
                  alert(`Token temporal: ${r.token_preview}`);
                }}
              >
                <RestartAltIcon fontSize="small" />
              </IconButton>
              {u.status === 'deleted' ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => { await AdminAPI.restoreUser(u.id); refetch({}); }}
                >
                  Restaurar
                </Button>
              ) : (
                <IconButton
                  color="error"
                  size="small"
                  title={String(u.role) === 'app_admin' ? 'No se puede eliminar un administrador general' : 'Eliminar'}
                  disabled={String(u.role) === 'app_admin'}
                  onClick={() => setConfirmDel(u)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </div>
            <ChevronRightIcon className="chev" />
          </div>
        ))}
        {!state.rows.length && <div className="empty">Sin resultados.</div>}
      </div>
      <div className="pager">
        <span>Página {state.page}</span>
        <Button size="small" disabled={state.page <= 1} onClick={() => refetch({ page: state.page - 1 })}>Anterior</Button>
        <Button
          size="small"
          disabled={state.page * state.pageSize >= state.total}
          onClick={() => refetch({ page: state.page + 1 })}
        >
          Siguiente
        </Button>
        <span className="total">{state.total} usuarios</span>
      </div>

      {/* Editar */}
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

      {/* Eliminar */}
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

      <style>{`
        .au-wrap{ display:grid; gap:12px; color: var(--color-fg) }
        .au-search{ display:grid; gap:8px }
        .au-search .row{ display:flex; gap:8px; align-items:center }
        .stat{
          border:1px solid var(--color-border); border-radius:12px; padding:10px 12px;
          background: var(--color-surface);
        }
        .stat .title{ color: color-mix(in srgb, var(--color-fg) 60%, transparent); font-size:12px }
        .stat .value{ font-weight:800; font-size:22px }

        .au-card{
          background: var(--color-surface); border:1px solid var(--color-border);
          border-radius:12px; overflow:hidden;
        }
        .au-card .title{
          padding:10px 14px; font-weight:800; border-bottom:1px solid var(--color-border);
        }
        .item{
          display:grid; grid-template-columns: 40px 1fr auto auto auto 20px;
          align-items:center; gap:10px; padding:12px 14px; border-top:1px solid var(--color-border);
        }
        .item:first-of-type{ border-top:0 }
        .avatar{
          width:36px; height:36px; border-radius:999px; display:grid; place-items:center;
          background: color-mix(in srgb, var(--color-primary) 18%, #fff);
          border:1px solid var(--color-border); font-weight:800;
        }
        .info{ min-width:0 }
        .name{ font-weight:700; line-height:1.2 }
        .sub{ color: color-mix(in srgb, var(--color-fg) 55%, transparent); font-size:.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
        .pill{
          border-radius:999px; padding:6px 10px; font-size:.8rem; border:1px solid var(--color-border);
          background:#fff; color:#0b0f0c; text-transform: none;
        }
        .pill.ok{ background: color-mix(in srgb, var(--color-primary) 18%, #fff); color:#0a3620 }
        .pill.warn{ background:#fff8e6; color:#a15d00; border-color:#ffdfb0 }
        .pill.del{ background:#fff3f3; color:#b42318; border-color:#ffd8d8 }
        .pill.role{ background:#f5f7fb; color:#1f2937 }
        .actions{ display:flex; gap:4px; align-items:center }
        .chev{ color: color-mix(in srgb, var(--color-fg) 40%, transparent) }

        .pager{ display:flex; gap:8px; align-items:center; margin-top:4px }
        .pager .total{ margin-left:auto }
        @media (max-width:900px){
          .item{ grid-template-columns: 36px 1fr auto; grid-auto-rows:auto }
          .pill.role{ display:none }
          .actions{ display:none }
          .chev{ justify-self:end }
        }
      `}</style>
    </div>
  );
}
