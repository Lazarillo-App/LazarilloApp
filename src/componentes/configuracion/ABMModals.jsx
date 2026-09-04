// src/componentes/configuracion/ABMModals.jsx
// Modales de alta manual de artículos e insumos
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, InputAdornment, FormControl,
  InputLabel, Select, Divider, Alert, Stack, CircularProgress,
  Autocomplete, Checkbox, Typography, Box,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { BASE } from '@/servicios/apiBase';

const UNIDADES_INSUMO = ['gr', 'kg', 'ml', 'lt', 'u', 'oz', 'cc', 'taza', 'cdita', 'cda', 'doc'];

/* ─── Alta de Insumo ─── */
export function InsumoNuevoModal({ open, onClose, businessId, onCreated }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const [form, setForm] = useState({
    nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'u', precioRef: '',
    esElaborado: false, sku: '', agrupacionId: '',
  });
  const [rubros, setRubros] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  // Padrino (insumo de referencia para heredar rubro/unidad/precio/agrupación)
  const [usarPadrino, setUsarPadrino] = useState(false);
  const [padrinoSelected, setPadrinoSelected] = useState(null);
  const [padrinoQuery, setPadrinoQuery] = useState('');
  const [padrinoCandidates, setPadrinoCandidates] = useState([]);
  const [padrinoLoading, setPadrinoLoading] = useState(false);

  // Cargar rubros y agrupaciones al abrir
  useEffect(() => {
    if (!open || !businessId) return;
    const token = localStorage.getItem('token') || '';
    const headers = { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) };
    // Rubros (el endpoint devuelve { items: [{ codigo, nombre, ... }] })
    fetch(`${BASE}/insumos/rubros`, { headers })
      .then(r => r.json()).catch(() => ({}))
      .then(d => setRubros((d?.items || []).map(r => r.nombre)));
    // Agrupaciones de insumos (groups_list → { data: [{ id, nombre, ... }] })
    fetch(`${BASE}/insumos/groups`, { headers })
      .then(r => r.json()).catch(() => ({}))
      .then(d => setAgrupaciones((d?.data || []).map(g => ({ id: g.id, nombre: g.nombre }))));
  }, [open, businessId]);

  // Buscar candidatos de padrino con debounce
  useEffect(() => {
    if (!usarPadrino || padrinoQuery.trim().length < 2) { setPadrinoCandidates([]); return; }
    const token = localStorage.getItem('token') || '';
    setPadrinoLoading(true);
    const t = setTimeout(() => {
      fetch(`${BASE}/insumos/search-padrino?q=${encodeURIComponent(padrinoQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      })
        .then(r => r.json()).catch(() => ({}))
        .then(d => setPadrinoCandidates(d?.candidatos || []))
        .finally(() => setPadrinoLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [usarPadrino, padrinoQuery, businessId]);

  // Reset total al cerrar (incluye estado del padrino)
  useEffect(() => {
    if (!open) {
      setForm({ nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'u', precioRef: '', esElaborado: false, sku: '', agrupacionId: '' });
      setError(''); setSuccess(null);
      setUsarPadrino(false); setPadrinoSelected(null); setPadrinoQuery(''); setPadrinoCandidates([]);
    }
  }, [open]);

  const rubroFinal = form.rubro === '__nuevo__' ? form.rubroNuevo.trim() : form.rubro;

  const onPadrinoSelected = (padrino) => {
    setPadrinoSelected(padrino);
    if (!padrino) return;

    // El backend ya devuelve el rubro resuelto a NOMBRE (no código)
    const rubroPadrino = padrino.rubro || '';
    // Mapear unidad de MaxiRest a las opciones del select (formatos inconsistentes)
    const MAPA_UNIDADES = {
      l: 'lt', lt: 'lt', k: 'kg', kg: 'kg', g: 'gr', gr: 'gr',
      u: 'u', un: 'u', m: 'ml', ml: 'ml', cc: 'cc', oz: 'oz',
    };
    const rawUnidad = (padrino.unidad_med || '').trim().toLowerCase();
    const unidadPadrino = MAPA_UNIDADES[rawUnidad] || null; // null si no matchea → no tocar el form

    // Resolver el rubro del padrino contra la lista existente para evitar duplicados
    let rubroParaForm = rubroPadrino;
    if (rubroPadrino) {
      const norm = s => String(s || '').trim().toLowerCase();
      const existente = rubros.find(r => norm(r) === norm(rubroPadrino));
      if (existente) {
        rubroParaForm = existente;
      } else {
        setRubros(prev => [...prev, rubroPadrino]);
      }
    }
    // Si la agrupación del padrino no está en la lista local, la sumamos
    if (padrino.agrupacion_id && padrino.agrupacion_nombre) {
      setAgrupaciones(prev => {
        const exists = prev.some(a => Number(a.id) === Number(padrino.agrupacion_id));
        return exists ? prev : [...prev, { id: padrino.agrupacion_id, nombre: padrino.agrupacion_nombre }];
      });
    }

    setForm(f => ({
      ...f,
      rubro: rubroParaForm || f.rubro,
      rubroNuevo: '',
      unidadMed: unidadPadrino || f.unidadMed,
      precioRef: padrino.precio ? String(padrino.precio) : f.precioRef,
      agrupacionId: padrino.agrupacion_id ?? '',
    }));
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!rubroFinal) { setError('El rubro es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/insumos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: form.nombre.trim(), rubro: rubroFinal,
          unidadMed: form.unidadMed || 'u',
          precioRef: form.precioRef ? Number(form.precioRef) : null,
          skuExterno: form.sku?.trim() || null,
          agrupacionId: form.agrupacionId || null,
          es_elaborado: form.esElaborado, origen: 'manual',
        }),
      });
      const data = await res.json();
      if (res.status === 409) { setError(data.error + (data.existing ? ` (ID: ${data.existing.id})` : '')); setSaving(false); return; }
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setSuccess(data.data);
      onCreated?.(data.data);
      setTimeout(() => {
        setSuccess(null);
        setForm({ nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'u', precioRef: '', esElaborado: false, sku: '', agrupacionId: '' });
        onClose();
      }, 1500);
    } catch (e) {
      setError(e.message || 'Error al crear el insumo');
    } finally { setSaving(false); }
  };

  const handleClose = () => {
    if (saving) return;
    setForm({ nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'u', precioRef: '', esElaborado: false, sku: '', agrupacionId: '' });
    setError(''); setSuccess(null); onClose();
    setUsarPadrino(false); setPadrinoSelected(null); setPadrinoQuery(''); setPadrinoCandidates([]);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>Nuevo insumo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={0.5}>
          {error && <Alert severity="error" sx={{ py: 0.5, fontSize: '0.82rem' }}>{error}</Alert>}
          {success && (
            <Alert severity="success" sx={{ py: 0.5, fontSize: '0.82rem' }}>
              Insumo <strong>{success.nombre}</strong> creado — SKU: <code>{success.codigo_maxi}</code>
            </Alert>
          )}

          {/* Padrino: heredar rubro/unidad/precio/agrupación de otro insumo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Checkbox size="small" checked={usarPadrino} disabled={saving || !!success}
              onChange={e => { setUsarPadrino(e.target.checked); if (!e.target.checked) { setPadrinoSelected(null); setPadrinoQuery(''); } }} />
            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Usar un insumo de referencia (padrino)</Typography>
          </Box>
          {usarPadrino && (
            <Autocomplete
              size="small"
              options={padrinoCandidates}
              loading={padrinoLoading}
              value={padrinoSelected}
              getOptionLabel={(o) => o?.nombre || ''}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              onChange={(_, val) => onPadrinoSelected(val)}
              onInputChange={(_, val) => setPadrinoQuery(val)}
              renderOption={(props, o) => (
                <li {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{o.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {o.rubro || 'Sin rubro'} · {o.unidad_med} · ${o.precio_ref}
                      {o.agrupacion_nombre ? ` · 📁 ${o.agrupacion_nombre}` : ''}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Buscar insumo padrino" placeholder="Escribí para buscar…"
                  InputProps={{ ...params.InputProps, endAdornment: (<>{padrinoLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
              )}
              disabled={saving || !!success}
            />
          )}

          <TextField label="Nombre *" size="small" fullWidth autoFocus
            value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            disabled={saving || !!success} />

            <TextField label="SKU / Código Maxi" size="small" fullWidth
            value={form.sku} disabled={saving || !!success}
            onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
            placeholder="Opcional — si Maxi trae este código, se fusionan"
            helperText="Dejalo vacío para generar un SKU provisorio (L-)" />

          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Rubro *</InputLabel>
              <Select label="Rubro *" value={form.rubro} disabled={saving || !!success}
                onChange={e => setForm(f => ({ ...f, rubro: e.target.value, rubroNuevo: '' }))}>
                {rubros.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                <Divider />
                <MenuItem value="__nuevo__" sx={{ color: themeColor, fontStyle: 'italic' }}>+ Rubro nuevo…</MenuItem>
              </Select>
            </FormControl>
            {form.rubro === '__nuevo__' && (
              <TextField label="Nombre del rubro" size="small" sx={{ flex: 1 }} autoFocus
                value={form.rubroNuevo} disabled={saving || !!success}
                onChange={e => setForm(f => ({ ...f, rubroNuevo: e.target.value }))} />
            )}
          </Stack>

          {/* Agrupación (opcional) */}
          <FormControl size="small" fullWidth>
            <InputLabel>Agrupación</InputLabel>
            <Select label="Agrupación" value={form.agrupacionId} disabled={saving || !!success}
              onChange={e => setForm(f => ({ ...f, agrupacionId: e.target.value }))}>
              <MenuItem value=""><em>Sin agrupación</em></MenuItem>
              {agrupaciones.map(a => <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>)}
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ width: 140 }}>
              <InputLabel>Unidad</InputLabel>
              <Select label="Unidad" value={form.unidadMed} disabled={saving || !!success}
                onChange={e => setForm(f => ({ ...f, unidadMed: e.target.value }))}>
                {UNIDADES_INSUMO.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Precio de referencia" size="small" type="number" sx={{ flex: 1 }}
              value={form.precioRef} disabled={saving || !!success}
              onChange={e => setForm(f => ({ ...f, precioRef: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
          </Stack>

          <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem' }}>
            Se generará un SKU provisorio automáticamente (<code>LAZ-...</code>).
            Cuando Maxi sincronice un insumo con el mismo nombre y rubro, lo reemplazará.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button size="small" color="inherit" onClick={handleClose} disabled={saving}>Cancelar</Button>
        <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !!success}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
          sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
          {saving ? 'Creando…' : 'Crear insumo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Alta de Artículo ─── */
export function ArticuloNuevoModal({ open, onClose, businessId, onCreated, articulo = null }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const EMPTY_FORM = { nombre: '', rubro: '', subrubro: '', precio: '', agrupacionId: '', skuExterno: '' };
  const isEdit = !!articulo;
  // Artículo manual (id < 0): la edición de SKU/código externo tiene sentido (aún no
  // sincronizó con Maxi). Artículo ya sincronizado (id > 0): el backend ni siquiera
  // procesa ese campo en el PATCH, así que no se muestra.
  const isManualArticulo = isEdit && Number(articulo?.id) < 0;
  const [form, setForm] = useState(EMPTY_FORM);
  const [rubroNuevo, setRubroNuevo] = useState('');
  const [subrubroNuevo, setSubrubroNuevo] = useState('');
  const [rubros, setRubros] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Padrino
  const [usarPadrino, setUsarPadrino] = useState(false);
  const [padrinoSelected, setPadrinoSelected] = useState(null);
  const [padrinoQuery, setPadrinoQuery] = useState('');
  const [padrinoCandidates, setPadrinoCandidates] = useState([]);
  const [padrinoLoading, setPadrinoLoading] = useState(false);

  const subrubrosDelRubro = useMemo(() => {
    const r = rubros.find(r => r.nombre === form.rubro);
    return r?.subrubros || [];
  }, [rubros, form.rubro]);

  const esRubroNuevo = form.rubro === '__nuevo__';
  const esSubrubroNuevo = form.subrubro === '__nuevo__';

  // Cargar rubros y agrupaciones al abrir
  useEffect(() => {
    if (!open || !businessId) return;
    const token = localStorage.getItem('token') || '';
    const headers = { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) };
    Promise.all([
      fetch(`${BASE}/businesses/${businessId}/rubros`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${BASE}/businesses/${businessId}/agrupaciones`, { headers }).then(r => r.json()).catch(() => ({})),
    ]).then(([rubrosData, agData]) => {
      setRubros(rubrosData?.categorias || []);
      setAgrupaciones(Array.isArray(agData) ? agData : (agData?.agrupaciones || []));
    });
  }, [open, businessId]);

  // Reset TOTAL al abrir/cerrar — incluye estado del padrino
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setRubroNuevo('');
      setSubrubroNuevo('');
      setError('');
      setUsarPadrino(false);
      setPadrinoSelected(null);
      setPadrinoQuery('');
      setPadrinoCandidates([]);
    }
  }, [open]);

  // Precarga del form en modo edición. En maxi_articles (y en el objeto `articulo` que
  // ya trae ArticuloAccionesMenu) la columna `subrubro` es el "Rubro" que ve el usuario
  // y `categoria` es el "Subrubro" — nomenclatura invertida histórica, ver rubroActual
  // en ArticuloAccionesMenu.jsx.
  useEffect(() => {
    if (!open || !articulo) return;
    setForm({
      nombre: articulo.nombre || '',
      rubro: articulo.subrubro || '',
      subrubro: articulo.categoria || '',
      precio: articulo.precio != null ? String(articulo.precio) : '',
      agrupacionId: '',
      skuExterno: '',
    });
  }, [open, articulo]);

  // Buscar candidatos de padrino con debounce
  useEffect(() => {
    if (!usarPadrino || !businessId) {
      setPadrinoCandidates([]);
      return;
    }
    const q = padrinoQuery.trim();
    if (q.length < 2) {
      setPadrinoCandidates([]);
      return;
    }
    let cancel = false;
    setPadrinoLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const url = `${BASE}/businesses/${businessId}/articles/search-padrino?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
        });
        const data = await res.json();
        if (!cancel) setPadrinoCandidates(data?.candidatos || []);
      } catch {
        if (!cancel) setPadrinoCandidates([]);
      } finally {
        if (!cancel) setPadrinoLoading(false);
      }
    }, 300);
    return () => { cancel = true; clearTimeout(timeoutId); };
  }, [usarPadrino, padrinoQuery, businessId]);

  // Autocompletar formulario al seleccionar padrino
  const onPadrinoSelected = (padrino) => {
    setPadrinoSelected(padrino);
    if (!padrino) return;

    const rubroPadrino = padrino.rubro || '';
    const subrubroPadrino = padrino.subrubro || '';

    setRubros(prev => {
      if (!rubroPadrino) return prev;
      const exists = prev.some(r => r.nombre === rubroPadrino);
      if (!exists) {
        return [
          ...prev,
          { nombre: rubroPadrino, subrubros: subrubroPadrino ? [subrubroPadrino] : [] },
        ];
      }
      if (!subrubroPadrino) return prev;
      return prev.map(r => {
        if (r.nombre !== rubroPadrino) return r;
        if ((r.subrubros || []).includes(subrubroPadrino)) return r;
        return { ...r, subrubros: [...(r.subrubros || []), subrubroPadrino] };
      });
    });

    // Si el padrino tiene agrupación que no está en la lista local, la sumamos
    if (padrino.agrupacion_id && padrino.agrupacion_nombre) {
      setAgrupaciones(prev => {
        const exists = prev.some(a => Number(a.id) === Number(padrino.agrupacion_id));
        if (exists) return prev;
        return [...prev, { id: padrino.agrupacion_id, nombre: padrino.agrupacion_nombre }];
      });
    }

    setForm(f => ({
      ...f,
      rubro: rubroPadrino || f.rubro,
      subrubro: subrubroPadrino || '',
      precio: String(padrino.precio || ''),
      agrupacionId: padrino.agrupacion_id ?? '',
    }));
  };

  const rubroEfectivo = esRubroNuevo ? rubroNuevo.trim() : form.rubro;
  const subrubroEfectivo = esSubrubroNuevo ? subrubroNuevo.trim() : form.subrubro;

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!rubroEfectivo) { setError('El rubro es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const token = localStorage.getItem('token') || '';
      const url = isEdit
        ? `${BASE}/businesses/${businessId}/articles/${articulo.id}`
        : `${BASE}/businesses/${businessId}/articles/manual`;
      const body = isEdit
        ? {
            nombre: form.nombre.trim(),
            rubro: rubroEfectivo,
            subrubro: subrubroEfectivo || null,
            precio: form.precio ? Number(form.precio) : 0,
            ...(isManualArticulo ? { codigoExterno: form.skuExterno?.trim() || null } : {}),
          }
        : {
            nombre: form.nombre.trim(),
            rubro: rubroEfectivo,
            subrubro: subrubroEfectivo || null,
            precio: form.precio ? Number(form.precio) : 0,
            agrupacionId: form.agrupacionId ? Number(form.agrupacionId) : null,
            skuExterno: form.skuExterno?.trim() || null,
          };
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      onCreated?.(data.articulo);
      onClose();
    } catch (e) {
      setError(e.message || (isEdit ? 'Error al guardar los cambios' : 'Error al crear el artículo'));
    } finally { setSaving(false); }
  };

  const sinSku = !form.skuExterno?.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>
        {isEdit ? 'Editar artículo' : 'Nuevo artículo'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={0.5}>
          {error && <Alert severity="error" sx={{ py: 0.5, fontSize: '0.82rem' }}>{error}</Alert>}

          {/* Toggle padrino + autocomplete — no aplica al editar un artículo existente */}
          {!isEdit && (
          <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px dashed', borderColor: 'divider' }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: -1 }}>
              <Checkbox size="small" checked={usarPadrino}
                onChange={(e) => {
                  setUsarPadrino(e.target.checked);
                  if (!e.target.checked) {
                    setPadrinoSelected(null);
                    setPadrinoQuery('');
                    setPadrinoCandidates([]);
                  }
                }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Crear a partir de otro artículo
              </Typography>
            </Stack>

            {usarPadrino && (
              <Autocomplete
                size="small" sx={{ mt: 1 }}
                options={padrinoCandidates}
                loading={padrinoLoading}
                value={padrinoSelected}
                onChange={(_, val) => onPadrinoSelected(val)}
                onInputChange={(_, val) => setPadrinoQuery(val)}
                getOptionLabel={(opt) => opt?.nombre || ''}
                isOptionEqualToValue={(opt, val) => Number(opt?.id) === Number(val?.id)}
                renderOption={(props, opt) => (
                  <li {...props} key={opt.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{opt.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {opt.rubro || 'Sin rubro'}{opt.subrubro ? ` › ${opt.subrubro}` : ''}
                        {' · '}${Number(opt.precio).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {opt.agrupacion_nombre ? ` · 📁 ${opt.agrupacion_nombre}` : ''}
                        {opt.sku ? ` · ${opt.sku}` : ''}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Buscar por nombre o SKU…" size="small"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {padrinoLoading && <CircularProgress size={14} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                noOptionsText={padrinoQuery.trim().length < 2 ? 'Escribí al menos 2 caracteres' : 'Sin resultados'}
              />
            )}
          </Box>
          )}

          <TextField label="Nombre *" size="small" fullWidth autoFocus
            value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />

          {/* SKU externo — solo aplica a creación, o edición de un artículo manual
              (uno ya sincronizado con Maxi no procesa este campo en el PATCH) */}
          {(!isEdit || isManualArticulo) && (
          <TextField
            label="SKU / Código de Maxi"
            size="small" fullWidth
            value={form.skuExterno}
            onChange={e => setForm(f => ({ ...f, skuExterno: e.target.value }))}
            placeholder="Ej: 3092"
            helperText={sinSku
              ? '⚠ Sin SKU el artículo no se sincronizará con Maxi'
              : 'Se usará para el match con MaxiRest al sincronizar'}
            FormHelperTextProps={{
              sx: { color: sinSku ? '#d97706' : 'text.secondary', fontWeight: sinSku ? 600 : 400 },
            }}
          />
          )}

          {/* Rubro */}
          <Stack direction="row" spacing={1.5}>
            <Stack sx={{ flex: 1 }} spacing={0.75}>
              <FormControl size="small" fullWidth>
                <InputLabel>Rubro *</InputLabel>
                <Select label="Rubro *" value={form.rubro}
                  onChange={e => setForm(f => ({
                    ...f, rubro: e.target.value, subrubro: '',
                  }))}>
                  {rubros.length === 0 && (
                    <MenuItem disabled value="">
                      <em style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Sin rubros aún</em>
                    </MenuItem>
                  )}
                  {rubros.map(r => <MenuItem key={r.nombre} value={r.nombre}>{r.nombre}</MenuItem>)}
                  <Divider />
                  <MenuItem value="__nuevo__" sx={{ color: themeColor, fontStyle: 'italic' }}>
                    + Crear rubro nuevo…
                  </MenuItem>
                </Select>
              </FormControl>
              {esRubroNuevo && (
                <TextField size="small" fullWidth autoFocus
                  label="Nombre del rubro nuevo"
                  placeholder="Ej: Bebidas, Comidas, Postres…"
                  value={rubroNuevo}
                  onChange={e => setRubroNuevo(e.target.value)}
                />
              )}
            </Stack>

            <Stack sx={{ flex: 1 }} spacing={0.75}>
              <FormControl size="small" fullWidth>
                <InputLabel>Subrubro</InputLabel>
                <Select label="Subrubro" value={form.subrubro}
                  onChange={e => setForm(f => ({ ...f, subrubro: e.target.value }))}
                  disabled={!rubroEfectivo}>
                  <MenuItem value="">Sin subrubro</MenuItem>
                  {subrubrosDelRubro.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  {(subrubrosDelRubro.length > 0 || esRubroNuevo) && <Divider />}
                  <MenuItem value="__nuevo__" sx={{ color: themeColor, fontStyle: 'italic' }}>
                    + Crear subrubro nuevo…
                  </MenuItem>
                </Select>
              </FormControl>
              {esSubrubroNuevo && (
                <TextField size="small" fullWidth autoFocus
                  label="Nombre del subrubro nuevo"
                  placeholder="Ej: Cócteles, Sin alcohol…"
                  value={subrubroNuevo}
                  onChange={e => setSubrubroNuevo(e.target.value)}
                />
              )}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1.5}>
            <TextField label={isEdit ? 'Precio' : 'Precio inicial'} size="small" type="number" fullWidth
              value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
            {/* Agrupación: solo al crear — moverla ya es una acción aparte en el menú */}
            {!isEdit && (
            <FormControl size="small" fullWidth>
              <InputLabel>Agrupación</InputLabel>
              <Select label="Agrupación" value={form.agrupacionId}
                onChange={e => setForm(f => ({ ...f, agrupacionId: e.target.value }))}>
                <MenuItem value="">Sin agrupación</MenuItem>
                {agrupaciones
                  .filter(a => !a.nombre?.toLowerCase().includes('sin agrupac') && !a.nombre?.toLowerCase().includes('discontinu'))
                  .map(a => <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>)
                }
              </Select>
            </FormControl>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
        <Button size="small" variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
          sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
          {saving ? (isEdit ? 'Guardando…' : 'Creando…') : (isEdit ? 'Guardar cambios' : 'Crear artículo')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}