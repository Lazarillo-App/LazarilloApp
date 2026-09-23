// src/componentes/configuracion/SectoresTab.jsx
// Vista Operación — gestión de sectores (Barra, Cocina, Salón): un recorte de
// adentro del negocio armado tildando agrupaciones enteras o rubros/subrubros
// sueltos. Define qué recetas va a ver una persona con rol Staff (Fase 2+).
import React from 'react';
import {
  Box, Stack, Typography, Button, TextField, CircularProgress, Chip,
  Checkbox, IconButton, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GroupsIcon from '@mui/icons-material/Groups';
import { useArticlesTree } from '@/hooks/useArticlesTree';
import { obtenerAgrupaciones } from '@/servicios/apiAgrupaciones';
import { listarSectores, crearSector, actualizarSector, eliminarSector } from '@/servicios/apiSectores';
import { listarPendientes, aprobarPendiente, rechazarPendiente } from '@/servicios/apiAccesoEquipo';
import { showAlert } from '@/servicios/appAlert';
import { showConfirm } from '@/servicios/appConfirm';

const COLORES = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ef4444', '#64748b'];

/* ─── Componentes de layout (espejo de ConfigArticulosTab/ConfigInsumosTab) ─── */
function Card({ children }) {
  return (
    <Box sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e8eaf0', bgcolor: 'background.paper' }}>
      {children}
    </Box>
  );
}
function CardHeader({ icon, title, subtitle, action }) {
  const tc = 'var(--color-primary, #3b82f6)';
  return (
    <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 1.25 }}>
      {icon && React.cloneElement(icon, { sx: { color: tc, fontSize: 17 } })}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Box>
  );
}
function CardBody({ children }) {
  return <Box sx={{ p: 2.5 }}>{children}</Box>;
}

/* ─── agrupación.articulos/app_articles_ids → Set de ids (mismo criterio que ArticulosMain) ─── */
function idsDeAgrupacion(agr) {
  const ids = new Set();
  for (const it of Array.isArray(agr?.articulos) ? agr.articulos : []) {
    const id = Number(it?.id ?? it?.articulo_id ?? it);
    if (Number.isFinite(id)) ids.add(id);
  }
  for (const id of Array.isArray(agr?.app_articles_ids) ? agr.app_articles_ids : []) {
    const n = Number(id);
    if (Number.isFinite(n)) ids.add(n);
  }
  return ids;
}

// Poda el árbol global subrubro→categoría→artículos a solo los artículos de
// una agrupación — mismo criterio que SidebarCategorias.jsx usa para mostrar
// "los rubros de esta agrupación".
function podarArbol(treeGlobal, idsPermitidos) {
  const out = [];
  for (const sub of treeGlobal || []) {
    const categorias = [];
    for (const cat of sub.categorias || []) {
      const articulos = (cat.articulos || []).filter((a) => idsPermitidos.has(a.id));
      if (articulos.length) categorias.push({ categoria: cat.categoria, articulos });
    }
    if (categorias.length) out.push({ subrubro: sub.subrubro, categorias });
  }
  return out;
}

const esAgrupacionFlotante = (nombre) => /^Sin Agrupac|^Sin Agrupar|^Discontinuados|^Descontinuados/i.test(nombre || '');

/* ─── Estado de selección: Map<agrupacionId, 'all' | Map<rubro, 'all' | Set<subrubro>>> ─── */
function toggleAgrupacion(selected, agId) {
  const next = new Map(selected);
  if (next.get(agId) === 'all') next.delete(agId); else next.set(agId, 'all');
  return next;
}
function toggleRubro(selected, agId, rubro, agTree) {
  const next = new Map(selected);
  const current = next.get(agId);
  const rubroMap = current === 'all'
    ? new Map(agTree.map((r) => [r.subrubro, 'all']))
    : new Map(current instanceof Map ? current : []);

  if (rubroMap.get(rubro) === 'all') rubroMap.delete(rubro); else rubroMap.set(rubro, 'all');

  const allRubros = agTree.map((r) => r.subrubro);
  if (allRubros.length && allRubros.every((r) => rubroMap.get(r) === 'all')) next.set(agId, 'all');
  else if (rubroMap.size === 0) next.delete(agId);
  else next.set(agId, rubroMap);
  return next;
}
function toggleSubrubro(selected, agId, rubro, subrubro, agTree) {
  const next = new Map(selected);
  const current = next.get(agId);
  const rubroMap = current === 'all'
    ? new Map(agTree.map((r) => [r.subrubro, 'all']))
    : new Map(current instanceof Map ? current : []);

  const rTree = agTree.find((r) => r.subrubro === rubro);
  const allSubs = (rTree?.categorias || []).map((c) => c.categoria);
  const curVal = rubroMap.get(rubro);
  const subSet = new Set(curVal === 'all' ? allSubs : (curVal instanceof Set ? curVal : []));

  if (subSet.has(subrubro)) subSet.delete(subrubro); else subSet.add(subrubro);

  if (allSubs.length && allSubs.every((s) => subSet.has(s))) rubroMap.set(rubro, 'all');
  else if (subSet.size === 0) rubroMap.delete(rubro);
  else rubroMap.set(rubro, subSet);

  const allRubros = agTree.map((r) => r.subrubro);
  if (allRubros.length && allRubros.every((r) => rubroMap.get(r) === 'all')) next.set(agId, 'all');
  else if (rubroMap.size === 0) next.delete(agId);
  else next.set(agId, rubroMap);
  return next;
}
function selectedToScope(selected) {
  const scope = [];
  for (const [agrupacionId, val] of selected.entries()) {
    if (val === 'all') { scope.push({ tipo: 'agrupacion', agrupacionId }); continue; }
    if (!(val instanceof Map)) continue;
    for (const [rubro, rv] of val.entries()) {
      if (rv === 'all') { scope.push({ tipo: 'rubro', agrupacionId, rubro }); continue; }
      if (rv instanceof Set) for (const subrubro of rv) scope.push({ tipo: 'subrubro', agrupacionId, rubro, subrubro });
    }
  }
  return scope;
}
function scopeToSelected(scope) {
  const selected = new Map();
  for (const item of scope || []) {
    const agId = item.agrupacionId;
    if (item.tipo === 'agrupacion') { selected.set(agId, 'all'); continue; }
    let m = selected.get(agId);
    if (!(m instanceof Map)) m = new Map();
    if (item.tipo === 'rubro') { m.set(item.rubro, 'all'); }
    else if (item.tipo === 'subrubro') {
      let s = m.get(item.rubro);
      if (!(s instanceof Set)) s = new Set();
      s.add(item.subrubro);
      m.set(item.rubro, s);
    }
    selected.set(agId, m);
  }
  return selected;
}
function contarRubros(selected, treesByAgrupacion) {
  let n = 0;
  for (const [agId, val] of selected.entries()) {
    if (val === 'all') { n += (treesByAgrupacion.get(agId) || []).length; continue; }
    if (val instanceof Map) n += val.size;
  }
  return n;
}
function contarArticulos(selected, treesByAgrupacion) {
  const ids = new Set();
  for (const [agId, val] of selected.entries()) {
    const tree = treesByAgrupacion.get(agId) || [];
    if (val === 'all') {
      for (const r of tree) for (const c of r.categorias) for (const a of c.articulos) ids.add(a.id);
      continue;
    }
    if (!(val instanceof Map)) continue;
    for (const [rubro, rv] of val.entries()) {
      const rTree = tree.find((r) => r.subrubro === rubro);
      if (!rTree) continue;
      if (rv === 'all') { for (const c of rTree.categorias) for (const a of c.articulos) ids.add(a.id); continue; }
      if (rv instanceof Set) for (const subrubro of rv) {
        const cTree = rTree.categorias.find((c) => c.categoria === subrubro);
        if (cTree) for (const a of cTree.articulos) ids.add(a.id);
      }
    }
  }
  return ids.size;
}

// Qué rubros/categorías de esta agrupación coinciden con la búsqueda —
// null en el Map = "todas las categorías del rubro" (coincidió el rubro entero).
function coincidenciasBusqueda(agTree, q) {
  const rubros = new Map();
  for (const r of agTree) {
    if (r.subrubro.toLowerCase().includes(q)) { rubros.set(r.subrubro, null); continue; }
    const cats = r.categorias.filter((c) => c.categoria.toLowerCase().includes(q)).map((c) => c.categoria);
    if (cats.length) rubros.set(r.subrubro, new Set(cats));
  }
  return rubros;
}

/* ─── Árbol tri-state de un sector ─── */
function ArbolAgrupacion({ agrupacion, agTree, selected, busqueda, onToggleAgrupacion, onToggleRubro, onToggleSubrubro }) {
  const [abiertaManual, setAbiertaManual] = React.useState(false);
  const q = (busqueda || '').trim().toLowerCase();
  const agNombreMatch = !!q && agrupacion.nombre.toLowerCase().includes(q);

  const filtro = React.useMemo(() => {
    if (!q || agNombreMatch) return null; // sin filtro: se muestra todo
    return coincidenciasBusqueda(agTree, q);
  }, [agTree, q, agNombreMatch]);

  const tieneCoincidencias = !q || agNombreMatch || (filtro && filtro.size > 0);
  if (!tieneCoincidencias) return null;

  const abierta = (!!q && tieneCoincidencias) || abiertaManual;

  const val = selected.get(agrupacion.id);
  const checked = val === 'all';
  const indeterminate = val instanceof Map && val.size > 0;
  const articleCount = agTree.reduce((n, r) => n + r.categorias.reduce((m, c) => m + c.articulos.length, 0), 0);

  return (
    <Box sx={{ border: '1px solid #e8eaf0', borderRadius: 1.5, mb: 1 }}>
      <Stack direction="row" alignItems="center" sx={{ px: 1 }}>
        <IconButton size="small" onClick={() => setAbiertaManual((v) => !v)} disabled={!agTree.length}>
          {abierta ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" sx={{ opacity: agTree.length ? 1 : 0.25 }} />}
        </IconButton>
        <Checkbox size="small" checked={checked} indeterminate={indeterminate} onChange={() => onToggleAgrupacion(agrupacion.id)} />
        <Typography fontWeight={700} sx={{ fontSize: '0.82rem', flex: 1 }}>{agrupacion.nombre}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>{articleCount} art.</Typography>
      </Stack>
      <Collapse in={abierta}>
        <Box sx={{ pl: 5, pb: 1 }}>
          {agTree.map((r) => {
            if (filtro && !filtro.has(r.subrubro)) return null;
            const catSet = filtro?.get(r.subrubro);

            const rChecked = val === 'all' || (val instanceof Map && val.get(r.subrubro) === 'all');
            const rIndet = val instanceof Map && val.get(r.subrubro) instanceof Set && val.get(r.subrubro).size > 0;
            const rCount = r.categorias.reduce((n, c) => n + c.articulos.length, 0);
            return (
              <Box key={r.subrubro}>
                <Stack direction="row" alignItems="center">
                  <Checkbox size="small" checked={rChecked} indeterminate={rIndet}
                    onChange={() => onToggleRubro(agrupacion.id, r.subrubro)} />
                  <Typography sx={{ fontSize: '0.78rem', flex: 1 }}>{r.subrubro}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>{rCount} art.</Typography>
                </Stack>
                {r.categorias.length > 1 && (
                  <Box sx={{ pl: 4 }}>
                    {r.categorias.map((c) => {
                      if (catSet && !catSet.has(c.categoria)) return null;
                      const sChecked = rChecked
                        || (val instanceof Map && val.get(r.subrubro) instanceof Set && val.get(r.subrubro).has(c.categoria));
                      return (
                        <Stack key={c.categoria} direction="row" alignItems="center">
                          <Checkbox size="small" checked={sChecked}
                            onChange={() => onToggleSubrubro(agrupacion.id, r.subrubro, c.categoria)} />
                          <Typography sx={{ fontSize: '0.74rem', color: '#666', flex: 1 }}>{c.categoria}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>{c.articulos.length} art.</Typography>
                        </Stack>
                      );
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}

/* ─── Editor de un sector (crear o editar) ─── */
function EditorSector({ businessId, sector, agrupaciones, treesByAgrupacion, onGuardado, onCancelar }) {
  const [nombre, setNombre] = React.useState(sector?.nombre || '');
  const [color, setColor] = React.useState(sector?.color || COLORES[0]);
  const [selected, setSelected] = React.useState(() => scopeToSelected(sector?.scope));
  const [guardando, setGuardando] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState('');

  const totalArticulos = contarArticulos(selected, treesByAgrupacion);
  const totalRubros = contarRubros(selected, treesByAgrupacion);

  const guardar = async () => {
    if (!nombre.trim()) { showAlert('Ponele un nombre al sector', 'error'); return; }
    setGuardando(true);
    try {
      const scope = selectedToScope(selected);
      if (sector?.id) {
        await actualizarSector(sector.id, { nombre: nombre.trim(), color, scope });
      } else {
        await crearSector(businessId, { nombre: nombre.trim(), color, scope });
      }
      showAlert('Sector guardado', 'success');
      onGuardado?.();
    } catch (e) {
      showAlert(e?.message || 'No se pudo guardar el sector', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={<GroupsIcon />}
        title={sector?.id ? `Editar ${sector.nombre}` : 'Nuevo sector'}
        subtitle={sector?.id ? `${sector.personas} persona${sector.personas !== 1 ? 's' : ''}` : null}
      />
      <CardBody>
        <Stack spacing={2}>
          <TextField label="Nombre" size="small" value={nombre} onChange={(e) => setNombre(e.target.value)} sx={{ maxWidth: 280 }} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Color</Typography>
            <Stack direction="row" spacing={1}>
              {COLORES.map((c) => (
                <Box key={c} onClick={() => setColor(c)} sx={{
                  width: 24, height: 24, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                  border: color === c ? '2px solid #2a2320' : '2px solid transparent',
                }} />
              ))}
            </Stack>
          </Box>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">ALCANCE SELECCIONADO</Typography>
              <Typography variant="caption" color="text.secondary">
                {totalRubros} rubro{totalRubros !== 1 ? 's' : ''} · {totalArticulos} artículo{totalArticulos !== 1 ? 's' : ''}
              </Typography>
            </Stack>
            <TextField
              size="small" fullWidth placeholder="Buscar agrupación, rubro o subrubro…"
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              sx={{ mb: 1.5 }}
            />
            {agrupaciones.map((ag) => (
              <ArbolAgrupacion
                key={ag.id}
                agrupacion={ag}
                agTree={treesByAgrupacion.get(ag.id) || []}
                selected={selected}
                busqueda={busqueda}
                onToggleAgrupacion={(agId) => setSelected((s) => toggleAgrupacion(s, agId))}
                onToggleRubro={(agId, rubro) => setSelected((s) => toggleRubro(s, agId, rubro, treesByAgrupacion.get(agId) || []))}
                onToggleSubrubro={(agId, rubro, sub) => setSelected((s) => toggleSubrubro(s, agId, rubro, sub, treesByAgrupacion.get(agId) || []))}
              />
            ))}
          </Box>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onCancelar} disabled={guardando}>Cancelar</Button>
            <Button variant="contained" onClick={guardar} disabled={guardando}
              sx={{ bgcolor: 'var(--color-primary, #3b82f6)', '&:hover': { bgcolor: 'var(--color-primary, #3b82f6)', filter: 'brightness(0.9)' } }}>
              {guardando ? 'Guardando…' : 'Guardar sector'}
            </Button>
          </Stack>
        </Stack>
      </CardBody>
    </Card>
  );
}

/* ─── Pendientes de aprobación (alta por QR) ─── */
function FilaPendiente({ p, sectores, onDecidido }) {
  const [role, setRole] = React.useState('staff');
  const [sectorIds, setSectorIds] = React.useState(() => new Set());
  const [busy, setBusy] = React.useState(false);

  const contacto = p.canal === 'celular' ? p.celular : p.email;

  const aprobar = async () => {
    setBusy(true);
    try {
      await aprobarPendiente(p.id, {
        role,
        sectorIds: role === 'staff' ? Array.from(sectorIds) : undefined,
      });
      showAlert(`${p.nombre} fue aprobado`, 'success');
      onDecidido();
    } catch (e) {
      showAlert(e?.message || 'No se pudo aprobar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const rechazar = async () => {
    if (!(await showConfirm(`¿Rechazar el pedido de ${p.nombre}?`))) return;
    setBusy(true);
    try {
      await rechazarPendiente(p.id);
      showAlert('Pedido rechazado', 'success');
      onDecidido();
    } catch (e) {
      showAlert(e?.message || 'No se pudo rechazar', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid #e8eaf0' }}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <Typography fontWeight={700} sx={{ fontSize: '0.85rem' }}>{p.nombre}</Typography>
        <Typography variant="caption" color="text.secondary">{contacto}</Typography>
        {p.branch_name && <Chip label={p.branch_name} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        <Box sx={{ flex: 1 }} />
        {['staff', 'admin'].map((r) => (
          <Button key={r} size="small" variant={role === r ? 'contained' : 'outlined'}
            onClick={() => setRole(r)} sx={{ minWidth: 0, px: 1.25, fontSize: '0.72rem' }}>
            {r === 'admin' ? 'Admin' : 'Staff'}
          </Button>
        ))}
      </Stack>
      {role === 'staff' && (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {sectores.map((s) => {
            const activo = sectorIds.has(s.id);
            return (
              <Chip key={s.id} label={s.nombre} size="small"
                onClick={() => setSectorIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                  return next;
                })}
                sx={{
                  cursor: 'pointer', fontWeight: 600,
                  bgcolor: activo ? 'var(--color-primary, #3b82f6)' : 'transparent',
                  color: activo ? '#fff' : 'text.primary',
                  border: `1px solid ${activo ? 'var(--color-primary, #3b82f6)' : '#d8d3ca'}`,
                }}
              />
            );
          })}
        </Stack>
      )}
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1 }}>
        <Button size="small" color="error" onClick={rechazar} disabled={busy}>Rechazar</Button>
        <Button size="small" variant="contained" onClick={aprobar} disabled={busy}
          sx={{ bgcolor: 'var(--color-primary, #3b82f6)', '&:hover': { bgcolor: 'var(--color-primary, #3b82f6)', filter: 'brightness(0.9)' } }}>
          Aprobar
        </Button>
      </Stack>
    </Box>
  );
}

function PendientesCard({ businessId, sectores }) {
  const [pendientes, setPendientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const cargar = React.useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setPendientes(await listarPendientes(businessId));
    } catch (e) {
      showAlert(e?.message || 'No se pudieron cargar los pendientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => { cargar(); }, [cargar]);

  if (!loading && pendientes.length === 0) return null;

  return (
    <Card>
      <CardHeader icon={<GroupsIcon />} title="Pendientes de aprobación"
        subtitle="Gente que pidió acceso escaneando el QR de una sucursal" />
      <CardBody>
        {loading ? (
          <Stack alignItems="center" py={2}><CircularProgress size={20} /></Stack>
        ) : (
          <Stack spacing={1}>
            {pendientes.map((p) => (
              <FilaPendiente key={p.id} p={p} sectores={sectores} onDecidido={cargar} />
            ))}
          </Stack>
        )}
      </CardBody>
    </Card>
  );
}

export default function SectoresTab({ businessId }) {
  const [sectores, setSectores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editando, setEditando] = React.useState(null); // null | 'nuevo' | sector

  const { data: treeGlobal } = useArticlesTree(Number(businessId));
  const [agrupaciones, setAgrupaciones] = React.useState([]);

  const cargar = React.useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [secs, { list }] = await Promise.all([
        listarSectores(businessId),
        obtenerAgrupaciones(businessId),
      ]);
      setSectores(secs);
      setAgrupaciones((list || []).filter((a) => !esAgrupacionFlotante(a.nombre) && !a.moved_to_business_id));
    } catch (e) {
      showAlert(e?.message || 'No se pudieron cargar los sectores', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => { cargar(); }, [cargar]);

  const treesByAgrupacion = React.useMemo(() => {
    const map = new Map();
    for (const ag of agrupaciones) {
      map.set(ag.id, podarArbol(treeGlobal || [], idsDeAgrupacion(ag)));
    }
    return map;
  }, [agrupaciones, treeGlobal]);

  const borrar = async (sector) => {
    if (sector.esFijo) return;
    if (sector.personas > 0) {
      showAlert(`No se puede borrar: tiene ${sector.personas} persona(s) asignada(s)`, 'error');
      return;
    }
    if (!(await showConfirm(`¿Eliminar el sector "${sector.nombre}"?`, { danger: true }))) return;
    try {
      await eliminarSector(sector.id);
      showAlert('Sector eliminado', 'success');
      cargar();
    } catch (e) {
      showAlert(e?.message || 'No se pudo eliminar', 'error');
    }
  };

  if (editando) {
    return (
      <EditorSector
        businessId={businessId}
        sector={editando === 'nuevo' ? null : editando}
        agrupaciones={agrupaciones}
        treesByAgrupacion={treesByAgrupacion}
        onGuardado={() => { setEditando(null); cargar(); }}
        onCancelar={() => setEditando(null)}
      />
    );
  }

  return (
    <Stack spacing={2.5}>
    <PendientesCard businessId={businessId} sectores={sectores} />
    <Card>
      <CardHeader icon={<GroupsIcon />} title="Sectores" subtitle="Barra, Cocina, Salón — qué recetas ve cada uno del equipo operativo"
        action={
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('nuevo')}
            sx={{ bgcolor: 'var(--color-primary, #3b82f6)', '&:hover': { bgcolor: 'var(--color-primary, #3b82f6)', filter: 'brightness(0.9)' } }}>
            Crear sector
          </Button>
        }
      />
      <CardBody>
        {loading ? (
          <Stack alignItems="center" py={3}><CircularProgress size={22} /></Stack>
        ) : (
          <Stack spacing={1}>
            {sectores.map((s) => (
              <Stack key={s.id} direction="row" alignItems="center" spacing={1.25}
                sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid #e8eaf0' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color || '#999', flexShrink: 0 }} />
                <Typography fontWeight={700} sx={{ fontSize: '0.85rem', minWidth: 110 }}>{s.nombre}</Typography>
                <Stack direction="row" spacing={0.5} sx={{ flex: 1, flexWrap: 'wrap', gap: 0.5 }}>
                  {s.esFijo ? (
                    <Chip label="Todo el negocio" size="small" sx={{ height: 20, fontSize: '0.68rem' }} />
                  ) : s.scope.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">Sin alcance definido</Typography>
                  ) : (
                    [...new Set(s.scope.map((it) => it.agrupacionNombre))].map((n) => (
                      <Chip key={n} label={n} size="small" sx={{ height: 20, fontSize: '0.68rem' }} />
                    ))
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ width: 80, textAlign: 'right' }}>
                  {s.personas} persona{s.personas !== 1 ? 's' : ''}
                </Typography>
                <IconButton size="small" disabled={s.esFijo} onClick={() => setEditando(s)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" disabled={s.esFijo || s.personas > 0} onClick={() => borrar(s)}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Stack>
        )}
      </CardBody>
    </Card>
    </Stack>
  );
}
