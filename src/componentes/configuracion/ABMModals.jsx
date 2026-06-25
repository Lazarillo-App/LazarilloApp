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
    nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'u', precioRef: '', esElaborado: false,
  });
  const [rubros, setRubros] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!open || !businessId) return;
    const token = localStorage.getItem('token') || '';
    fetch(`${BASE}/insumos/rubros`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
    }).then(r => r.json()).catch(() => ({}))
      .then(d => setRubros((d?.rubros || []).map(r => r.nombre)));
  }, [open, businessId]);

  const rubroFinal = form.rubro === '__nuevo__' ? form.rubroNuevo.trim() : form.rubro;

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
        setForm({ nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'u', precioRef: '', esElaborado: false });
        onClose();
      }, 1500);
    } catch (e) {
      setError(e.message || 'Error al crear el insumo');
    } finally { setSaving(false); }
  };

  const handleClose = () => {
    if (saving) return;
    setForm({ nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'u', precioRef: '', esElaborado: false });
    setError(''); setSuccess(null); onClose();
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

          <TextField label="Nombre *" size="small" fullWidth autoFocus
            value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            disabled={saving || !!success} />

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

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
              Tipo de insumo
            </Typography>
            <Stack direction="row" spacing={1}>
              {[
                { value: false, label: 'De compra', desc: 'Se compra a proveedor', icon: '🛒' },
                { value: true, label: 'Elaborado', desc: 'Se produce internamente', icon: '👨‍🍳' },
              ].map(opt => {
                const active = form.esElaborado === opt.value;
                return (
                  <Box key={String(opt.value)}
                    onClick={() => !saving && !success && setForm(f => ({ ...f, esElaborado: opt.value }))}
                    sx={{
                      flex: 1, p: 1.25, borderRadius: 1.5, cursor: 'pointer',
                      border: `2px solid ${active ? themeColor : '#e2e8f0'}`,
                      bgcolor: active ? `${themeColor}0d` : 'transparent',
                      transition: 'all .15s',
                      '&:hover': { borderColor: themeColor, bgcolor: `${themeColor}06` },
                    }}>
                    <Typography sx={{ fontSize: '1rem', mb: 0.25 }}>{opt.icon}</Typography>
                    <Typography variant="body2" fontWeight={active ? 700 : 500} sx={{ fontSize: '0.83rem', color: active ? themeColor : 'text.primary' }}>
                      {opt.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                      {opt.desc}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>

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
export function ArticuloNuevoModal({ open, onClose, businessId, onCreated }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const EMPTY_FORM = { nombre: '', rubro: '', subrubro: '', precio: '', agrupacionId: '', skuExterno: '' };
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
      const res = await fetch(`${BASE}/businesses/${businessId}/articles/manual`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          rubro: rubroEfectivo,
          subrubro: subrubroEfectivo || null,
          precio: form.precio ? Number(form.precio) : 0,
          agrupacionId: form.agrupacionId ? Number(form.agrupacionId) : null,
          skuExterno: form.skuExterno?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      onCreated?.(data.articulo);
      onClose();
    } catch (e) {
      setError(e.message || 'Error al crear el artículo');
    } finally { setSaving(false); }
  };

  const sinSku = !form.skuExterno?.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>Nuevo artículo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={0.5}>
          {error && <Alert severity="error" sx={{ py: 0.5, fontSize: '0.82rem' }}>{error}</Alert>}

          {/* Toggle padrino + autocomplete */}
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

          <TextField label="Nombre *" size="small" fullWidth autoFocus
            value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />

          {/* SKU externo */}
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
            <TextField label="Precio inicial" size="small" type="number" fullWidth
              value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
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
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
        <Button size="small" variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
          sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
          {saving ? 'Creando…' : 'Crear artículo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}