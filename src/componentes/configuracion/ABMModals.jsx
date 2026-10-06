// src/componentes/configuracion/ABMModals.jsx
// Modales de alta manual de artículos e insumos
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, InputAdornment, FormControl,
  InputLabel, Select, Divider, Alert, Stack, CircularProgress,
  Autocomplete, Checkbox, Typography, Box,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { BASE } from '@/servicios/apiBase';
import SpotlightTour from '@/componentes/SpotlightTour';
import { downwardMenuProps } from '@/utils/menuProps';
import { useConfig } from '@/context/ConfigContext';

const UNIDADES_INSUMO = ['gr', 'kg', 'ml', 'lt', 'u', 'oz', 'cc', 'taza', 'cdita', 'cda', 'doc'];

// Colapsa los candidatos de padrino agrupados como "Rubro: X" (el backend ya
// manda ahí TODOS los artículos/insumos de ese rubro) en un único renglón
// clicable — mostrarlos todos de entrada inundaba el dropdown si el rubro
// tenía muchos. Se reemplaza por sus ítems reales recién cuando ese rubro
// puntual está en `expandedRubros`.
function withCollapsedRubros(candidatos, expandedRubros) {
  const out = [];
  const porRubro = new Map();
  for (const c of candidatos) {
    if (c.grupo && c.grupo.startsWith('Rubro: ')) {
      const rubroName = c.grupo.slice('Rubro: '.length);
      if (!porRubro.has(rubroName)) porRubro.set(rubroName, []);
      porRubro.get(rubroName).push(c);
    } else {
      out.push(c);
    }
  }
  for (const [rubroName, items] of porRubro) {
    if (expandedRubros.has(rubroName)) {
      out.push(...items);
    } else {
      out.push({
        __rubroHeader: true,
        id: `__rubro__${rubroName}`,
        nombre: rubroName,
        count: items.length,
        grupo: `Rubro: ${rubroName}`,
      });
    }
  }
  return out;
}

/* ─── Alta / edición de Insumo ─── */
export function InsumoNuevoModal({ open, onClose, businessId, onCreated, initialNombre = '', insumo = null }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const { notificarAltaArticuloInsumo } = useConfig();
  const isEdit = !!insumo;
  // Insumo manual (no sincronizado con Maxi todavía): el código es provisorio
  // (L-...) y tiene sentido poder editarlo. Uno ya sincronizado no — el backend
  // ni siquiera procesa ese campo en el PUT (ver actualizar, insumosController).
  const isManualInsumo = isEdit && String(insumo?.origen || '').toLowerCase() === 'manual';
  const [form, setForm] = useState({
    nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'kg', precioRef: '',
    esElaborado: false, sku: '', agrupacionId: '',
  });
  const [rubros, setRubros] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [precioFocus, setPrecioFocus] = useState(false);
  // Padrino (insumo de referencia para heredar rubro/unidad/precio/agrupación)
  const [usarPadrino, setUsarPadrino] = useState(false);
  const [padrinoSelected, setPadrinoSelected] = useState(null);
  const [padrinoQuery, setPadrinoQuery] = useState('');
  const [padrinoCandidates, setPadrinoCandidates] = useState([]);
  const [padrinoLoading, setPadrinoLoading] = useState(false);
  const [expandedRubros, setExpandedRubros] = useState(() => new Set());
  const displayedPadrinoCandidates = useMemo(
    () => withCollapsedRubros(padrinoCandidates, expandedRubros),
    [padrinoCandidates, expandedRubros]
  );
  const rubroNuevoInsumoRef = useRef(null);

  // Código y nombre original (POS/sync) — solo lectura, se piden frescos al abrir
  // en modo edición (mismo patrón que ArticuloNuevoModal).
  const [infoOrigen, setInfoOrigen] = useState(null);
  useEffect(() => {
    if (!open || !isEdit || !insumo?.id || !businessId) { setInfoOrigen(null); return; }
    const token = localStorage.getItem('token') || '';
    fetch(`${BASE}/insumos/${insumo.id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
    })
      .then(r => r.json())
      .then(d => { if (d?.ok) setInfoOrigen(d.data); })
      .catch(() => { });
  }, [open, isEdit, insumo?.id, businessId]);

  // Mismo fix que en ArticuloNuevoModal: el <Select> de MUI devuelve el foco a sí
  // mismo al cerrar su menú, ganándole la carrera al autoFocus del campo nuevo.
  useEffect(() => {
    if (form.rubro !== '__nuevo__') return;
    const t = setTimeout(() => rubroNuevoInsumoRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [form.rubro]);

  // Cargar rubros y agrupaciones al abrir
  useEffect(() => {
    if (!open || !businessId) return;
    const token = localStorage.getItem('token') || '';
    const headers = { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) };
    // Rubros (el endpoint devuelve { items: [{ codigo, nombre, ... }] }) — mismo
    // endpoint que usa la tabla de Insumos (useInsumosRubros); /insumos/rubros
    // (sin "maxi/") no es el real, por eso venía siempre vacío acá.
    fetch(`${BASE}/insumos/maxi/rubros`, { headers })
      .then(r => r.json()).catch(() => ({}))
      .then(d => setRubros((d?.items || []).map(r => r.nombre)));
    // Agrupaciones de insumos (groups_list → { data: [{ id, nombre, ... }] })
    fetch(`${BASE}/insumos/groups`, { headers })
      .then(r => r.json()).catch(() => ({}))
      .then(d => {
        // El backend incluye "Sin agrupación" (grupo Todo) como una agrupación
        // real más — pero el Select ya tiene esa opción fija con value="" más
        // abajo, así que sin filtrarla acá quedaba duplicada en la lista.
        const norm = s => String(s || '').trim().toLowerCase();
        const items = (d?.data || [])
          .filter(g => {
            const n = norm(g.nombre);
            if (['todo', 'sin agrupacion', 'sin agrupación', 'sin agrupar', 'sin grupo'].includes(n)) return false;
            if (n.includes('discontinu')) return false; // mismo criterio que ArticuloNuevoModal
            return true;
          })
          .map(g => ({ id: g.id, nombre: g.nombre }));
        setAgrupaciones(items);
      });
  }, [open, businessId]);

  // Buscar candidatos de padrino con debounce
  useEffect(() => {
    setExpandedRubros(new Set());
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
      setForm({ nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'kg', precioRef: '', esElaborado: false, sku: '', agrupacionId: '' });
      setError(''); setSuccess(null);
      setUsarPadrino(false); setPadrinoSelected(null); setPadrinoQuery(''); setPadrinoCandidates([]); setExpandedRubros(new Set());
    }
  }, [open]);

  // Precarga el nombre cuando se abre desde el buscador de ingredientes de una
  // receta (el insumo tipeado no existía todavía).
  useEffect(() => {
    if (open && initialNombre) {
      setForm(f => ({ ...f, nombre: initialNombre }));
    }
  }, [open, initialNombre]);

  // Precarga del form en modo edición.
  useEffect(() => {
    if (!open || !insumo) return;
    setForm({
      nombre: insumo.nombre || '',
      rubro: insumo.rubro_nombre || '',
      rubroNuevo: '',
      unidadMed: insumo.unidad_med || 'u',
      precioRef: insumo.precio_ref != null ? String(insumo.precio_ref) : '',
      esElaborado: !!insumo.es_elaborado,
      sku: String(insumo.origen || '').toLowerCase() === 'manual' ? (insumo.codigo_maxi || '') : '',
      agrupacionId: '',
    });
  }, [open, insumo]);

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
      const url = isEdit ? `${BASE}/insumos/${insumo.id}` : `${BASE}/insumos`;
      const body = isEdit
        ? {
            nombre: form.nombre.trim(), rubro: rubroFinal,
            unidadMed: form.unidadMed || 'kg',
            precioRef: form.precioRef ? Number(form.precioRef) : null,
            es_elaborado: form.esElaborado,
            ...(isManualInsumo ? { codigoMaxi: form.sku?.trim() || null } : {}),
          }
        : {
            nombre: form.nombre.trim(), rubro: rubroFinal,
            unidadMed: form.unidadMed || 'u',
            precioRef: form.precioRef ? Number(form.precioRef) : null,
            skuExterno: form.sku?.trim() || null,
            agrupacionId: form.agrupacionId || null,
            es_elaborado: form.esElaborado, origen: 'manual',
          };
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 409) { setError(data.error + (data.existing ? ` (ID: ${data.existing.id})` : '')); setSaving(false); return; }
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      onCreated?.(data.data);
      if (isEdit) {
        window.dispatchEvent(new CustomEvent('insumos:updated', { detail: { insumoId: insumo.id } }));
        onClose();
        setSaving(false);
        return;
      }
      setSuccess(data.data);
      if (notificarAltaArticuloInsumo ?? true) {
        try {
          window.dispatchEvent(new CustomEvent('ui:action', {
            detail: {
              businessId,
              kind: 'insumo_create',
              scope: 'insumo',
              title: `🆕 ${data.data?.nombre || form.nombre} creado`,
              message: `En "${rubroFinal}"`,
              createdAt: new Date().toISOString(),
              payload: { ids: [data.data?.id], rubro: rubroFinal },
            },
          }));
        } catch { /* no bloquear el alta si falla la notificación */ }
      }
      setTimeout(() => {
        setSuccess(null);
        setForm({ nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'kg', precioRef: '', esElaborado: false, sku: '', agrupacionId: '' });
        onClose();
      }, 1500);
    } catch (e) {
      setError(e.message || 'Error al crear el insumo');
    } finally { setSaving(false); }
  };

  const handleClose = () => {
    if (saving) return;
    setForm({ nombre: '', rubro: '', rubroNuevo: '', unidadMed: 'kg', precioRef: '', esElaborado: false, sku: '', agrupacionId: '' });
    setError(''); setSuccess(null); onClose();
    setUsarPadrino(false); setPadrinoSelected(null); setPadrinoQuery(''); setPadrinoCandidates([]);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>
        {isEdit ? 'Editar insumo' : 'Nuevo insumo'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={0.5}>
          {error && <Alert severity="error" sx={{ py: 0.5, fontSize: '0.82rem' }}>{error}</Alert>}
          {success && (
            <Alert severity="success" sx={{ py: 0.5, fontSize: '0.82rem' }}>
              Insumo <strong>{success.nombre}</strong> creado — SKU: <code>{success.codigo_maxi}</code>
            </Alert>
          )}

          {/* Padrino: heredar rubro/unidad/precio/agrupación de otro insumo —
              también disponible al editar, para recategorizar copiando de otro
              insumo ya cargado (mismo criterio que ArticuloNuevoModal). */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Checkbox size="small" checked={usarPadrino} disabled={saving || !!success}
              onChange={e => { setUsarPadrino(e.target.checked); if (!e.target.checked) { setPadrinoSelected(null); setPadrinoQuery(''); } }} />
            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
              {isEdit ? 'Tomar rubro/unidad/precio de otro insumo' : 'Usar un insumo de referencia (padrino)'}
            </Typography>
          </Box>
          {usarPadrino && (
            <Autocomplete
              size="small"
              options={displayedPadrinoCandidates}
              // El backend ya decide qué candidatos mandar (nombre, rubro, "otros en
              // rubro"...) — sin esto, el filtro de texto propio de MUI (que compara
              // contra getOptionLabel) descartaba en el cliente todo lo que no
              // contuviera el texto tipeado en el NOMBRE, aunque viniera a propósito
              // por pertenecer al mismo rubro.
              filterOptions={(x) => x}
              groupBy={(o) => o.grupo || (o.esMatch === false ? 'También en ese rubro' : 'Coincide con la búsqueda')}
              loading={padrinoLoading}
              value={padrinoSelected}
              getOptionLabel={(o) => o?.nombre || ''}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              onChange={(_, val) => { if (val?.__rubroHeader) return; onPadrinoSelected(val); }}
              onInputChange={(_, val) => setPadrinoQuery(val)}
              renderOption={(props, o) => {
                if (o.__rubroHeader) {
                  return (
                    <li
                      {...props}
                      key={o.id}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setExpandedRubros(prev => new Set(prev).add(o.nombre));
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 700, color: themeColor }}>
                        ▸ Ver {o.count} insumo{o.count === 1 ? '' : 's'} en este rubro
                      </Typography>
                    </li>
                  );
                }
                return (
                  <li {...props} key={o.id}>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{o.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Rubro: {o.rubro || 'Sin rubro'} · {o.unidad_med} · ${o.precio_ref}
                        {o.agrupacion_nombre ? ` · 📁 ${o.agrupacion_nombre}` : ''}
                        {' · Cód: '}{o.codigo ?? o.sku ?? '—'}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} label="Buscar insumo padrino" placeholder="Escribí para buscar…"
                  InputProps={{ ...params.InputProps, endAdornment: (<>{padrinoLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
              )}
              disabled={saving || !!success}
            />
          )}

          {isEdit && (
            <Stack direction="row" spacing={1.5}>
              {/* Código: codigo_maxi del insumo — la llave de fusión con MaxiRest,
                  igual provisoria (L-...) si todavía no sincronizó. */}
              <TextField label="Código" size="small" fullWidth disabled
                value={infoOrigen?.codigo_maxi ?? insumo?.codigo_maxi ?? ''} />
              {/* Nombre original: el de Maxi/POS, o el mismo actual si todavía
                  nunca se renombró desde Lazarillo — se congela la primera vez
                  que se edita el nombre (ver actualizar, backend). */}
              <TextField label="Nombre original" size="small" fullWidth disabled
                value={infoOrigen?.nombre_original || infoOrigen?.nombre || form.nombre || ''} />
            </Stack>
          )}

          <TextField label="Nombre *" size="small" fullWidth autoFocus
            value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            disabled={saving || !!success} />

          {/* SKU externo — solo aplica a creación, o edición de un insumo manual
              (uno ya sincronizado con Maxi no procesa este campo en el PUT) */}
          {(!isEdit || isManualInsumo) && (
            <TextField label="SKU / Código Maxi" size="small" fullWidth
            value={form.sku} disabled={saving || !!success}
            onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
            placeholder="Opcional — si Maxi trae este código, se fusionan"
            helperText="Dejalo vacío para generar un SKU provisorio (L-)" />
          )}

          <Stack direction="row" spacing={1.5}>
            <Autocomplete
              size="small" sx={{ flex: 1 }} freeSolo autoHighlight
              options={rubros}
              disabled={saving || !!success}
              value={form.rubro === '__nuevo__' ? (form.rubroNuevo || null) : (form.rubro || null)}
              filterOptions={(opts, { inputValue }) => {
                const q = inputValue.trim().toLowerCase();
                const filtradas = q ? opts.filter(o => String(o).toLowerCase().includes(q)) : opts;
                const existe = opts.some(o => String(o).toLowerCase() === q);
                return q && !existe ? [{ __crear: true, nombre: inputValue.trim() }, ...filtradas] : filtradas;
              }}
              getOptionLabel={(o) => (typeof o === 'string' ? o : o.nombre)}
              isOptionEqualToValue={(o, v) => (typeof o === 'string' ? o : o.nombre) === (typeof v === 'string' ? v : v.nombre)}
              onInputChange={(_, v, reason) => {
                if (reason !== 'input') return;
                const existente = rubros.find(r => r.toLowerCase() === v.trim().toLowerCase());
                setForm(f => existente ? { ...f, rubro: existente, rubroNuevo: '' } : { ...f, rubro: v.trim() ? '__nuevo__' : '', rubroNuevo: v });
              }}
              onChange={(_, val) => {
                if (val && typeof val === 'object') setForm(f => ({ ...f, rubro: '__nuevo__', rubroNuevo: val.nombre }));
                else if (typeof val === 'string') setForm(f => ({ ...f, rubro: val, rubroNuevo: '' }));
                else setForm(f => ({ ...f, rubro: '', rubroNuevo: '' }));
              }}
              renderOption={(props, o) => (
                <li {...props} key={typeof o === 'string' ? o : 'crear-' + o.nombre}
                  style={typeof o === 'string' ? undefined : { color: themeColor, fontStyle: 'italic' }}>
                  {typeof o === 'string' ? o : `+ Crear rubro "${o.nombre}"`}
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Rubro *" placeholder="Escribí para buscar o crear…" />
              )}
            />
          </Stack>

          {/* Agrupación: solo al crear — moverlo ya es una acción aparte en el menú */}
          {!isEdit && (
          <FormControl size="small" fullWidth>
            <InputLabel>Agrupación</InputLabel>
            <Select MenuProps={downwardMenuProps()} label="Agrupación" value={form.agrupacionId} disabled={saving || !!success}
              onChange={e => setForm(f => ({ ...f, agrupacionId: e.target.value }))}>
              <MenuItem value=""><em>Sin agrupación</em></MenuItem>
              {agrupaciones.map(a => <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          )}

          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ width: 140 }}>
              <InputLabel>Unidad</InputLabel>
              <Select MenuProps={downwardMenuProps()} label="Unidad" value={form.unidadMed} disabled={saving || !!success}
                onChange={e => setForm(f => ({ ...f, unidadMed: e.target.value }))}>
                {UNIDADES_INSUMO.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Precio de referencia" size="small" sx={{ flex: 1 }} inputMode="decimal"
              value={precioFocus ? form.precioRef : (form.precioRef === '' ? '' : Number(form.precioRef).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
              onFocus={() => setPrecioFocus(true)}
              onBlur={() => setPrecioFocus(false)}
              disabled={saving || !!success}
              onChange={e => setForm(f => ({ ...f, precioRef: e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') }))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
          </Stack>

          {!isEdit && (
          <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem' }}>
            Se generará un SKU provisorio automáticamente (<code>LAZ-...</code>).
            Cuando Maxi sincronice un insumo con el mismo nombre y rubro, lo reemplazará.
          </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button size="small" color="inherit" onClick={handleClose} disabled={saving}>Cancelar</Button>
        <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !!success}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
          sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
          {saving ? (isEdit ? 'Guardando…' : 'Creando…') : (isEdit ? 'Guardar cambios' : 'Crear insumo')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Alta de Artículo ─── */
export function ArticuloNuevoModal({
  open, onClose, businessId, onCreated, articulo = null,
  tourStep = null, onTourNext, onTourSkip,
}) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const { notificarAltaArticuloInsumo } = useConfig();
  const campoNombreRubroRef = useRef(null);
  const padrinoRef = useRef(null);
  const guardarRef = useRef(null);
  const rubroNuevoRef = useRef(null);
  const subrubroNuevoRef = useRef(null);
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

  // Código y nombre original (POS/sync) — solo lectura, para ubicar el artículo
  // en el sistema de origen. El objeto `articulo` de la fila de la tabla no
  // siempre los trae, así que se piden frescos al abrir en modo edición.
  const [infoOrigen, setInfoOrigen] = useState(null);
  useEffect(() => {
    if (!open || !isEdit || !articulo?.id || !businessId) { setInfoOrigen(null); return; }
    const token = localStorage.getItem('token') || '';
    fetch(`${BASE}/businesses/${businessId}/articles/${articulo.id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
    })
      .then(r => r.json())
      .then(d => { if (d?.ok) setInfoOrigen(d.articulo); })
      .catch(() => { });
  }, [open, isEdit, articulo?.id, businessId]);

  // Padrino
  const [usarPadrino, setUsarPadrino] = useState(false);
  const [padrinoSelected, setPadrinoSelected] = useState(null);
  const [padrinoQuery, setPadrinoQuery] = useState('');
  const [padrinoCandidates, setPadrinoCandidates] = useState([]);
  const [padrinoLoading, setPadrinoLoading] = useState(false);
  const [expandedRubros, setExpandedRubros] = useState(() => new Set());
  const displayedPadrinoCandidates = useMemo(
    () => withCollapsedRubros(padrinoCandidates, expandedRubros),
    [padrinoCandidates, expandedRubros]
  );

  const subrubrosDelRubro = useMemo(() => {
    const r = rubros.find(r => r.nombre === form.rubro);
    return r?.subrubros || [];
  }, [rubros, form.rubro]);

  const esRubroNuevo = form.rubro === '__nuevo__';
  const esSubrubroNuevo = form.subrubro === '__nuevo__';

  // El campo "Nombre del rubro/subrubro nuevo" tiene autoFocus, pero el propio
  // <Select> de MUI devuelve el foco a sí mismo al cerrar su menú (accesibilidad) —
  // esa devolución gana la carrera y el autoFocus del TextField se pierde. Forzar
  // el foco acá, un tick después de que el Select termine su propia restauración.
  useEffect(() => {
    if (!esRubroNuevo) return;
    const t = setTimeout(() => rubroNuevoRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [esRubroNuevo]);
  useEffect(() => {
    if (!esSubrubroNuevo) return;
    const t = setTimeout(() => subrubroNuevoRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [esSubrubroNuevo]);

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
      setExpandedRubros(new Set());
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
    setExpandedRubros(new Set());
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
      if (!isEdit && (notificarAltaArticuloInsumo ?? true)) {
        try {
          window.dispatchEvent(new CustomEvent('ui:action', {
            detail: {
              businessId,
              kind: 'articulo_create',
              scope: 'articulo',
              title: `🆕 ${data.articulo?.nombre || form.nombre} creado`,
              message: rubroEfectivo ? `En "${rubroEfectivo}"` : 'Artículo manual',
              createdAt: new Date().toISOString(),
              payload: { ids: [data.articulo?.id], rubro: rubroEfectivo, subrubro: subrubroEfectivo },
            },
          }));
        } catch { /* no bloquear el alta si falla la notificación */ }
      }
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

          {/* Toggle padrino + autocomplete — también disponible al editar, para
              recategorizar (rubro/subrubro/precio) copiando de otro artículo ya
              cargado, sin tener que cargarlo todo de nuevo a mano. */}
          <Box ref={padrinoRef} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px dashed', borderColor: 'divider' }}>
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
                {isEdit ? 'Tomar rubro/subrubro/precio de otro artículo' : 'Crear a partir de otro artículo'}
              </Typography>
            </Stack>

            {usarPadrino && (
              <Autocomplete
                size="small" sx={{ mt: 1 }}
                options={displayedPadrinoCandidates}
                filterOptions={(x) => x}
                groupBy={(o) => o.grupo || (o.esMatch === false ? 'También en ese rubro' : 'Coincide con la búsqueda')}
                loading={padrinoLoading}
                value={padrinoSelected}
                onChange={(_, val) => { if (val?.__rubroHeader) return; onPadrinoSelected(val); }}
                onInputChange={(_, val) => setPadrinoQuery(val)}
                getOptionLabel={(opt) => opt?.nombre || ''}
                isOptionEqualToValue={(opt, val) => Number(opt?.id) === Number(val?.id)}
                renderOption={(props, opt) => {
                  if (opt.__rubroHeader) {
                    return (
                      <li
                        {...props}
                        key={opt.id}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          setExpandedRubros(prev => new Set(prev).add(opt.nombre));
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 700, color: themeColor }}>
                          ▸ Ver {opt.count} artículo{opt.count === 1 ? '' : 's'} en este rubro
                        </Typography>
                      </li>
                    );
                  }
                  return (
                    <li {...props} key={opt.id}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{opt.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Rubro: {opt.rubro || 'Sin rubro'}{opt.subrubro ? ` › ${opt.subrubro}` : ''}
                          {' · '}${Number(opt.precio).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {opt.agrupacion_nombre ? ` · 📁 ${opt.agrupacion_nombre}` : ''}
                          {' · Cód: '}{opt.codigo ?? opt.sku ?? '—'}
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
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

          <Stack ref={campoNombreRubroRef} spacing={2}>
          {isEdit && (
            <Stack direction="row" spacing={1.5}>
              {/* Código: el id del artículo en la DB — ya cumple ese rol para
                  sincronizados (viene de Maxi) y manuales (lo genera Lazarillo). */}
              <TextField label="Código" size="small" fullWidth disabled
                value={infoOrigen?.id ?? articulo?.id ?? ''} />
              {/* Nombre original: el de Maxi/POS, o el mismo actual si todavía
                  nunca se renombró desde Lazarillo — se congela la primera vez
                  que se edita el nombre (ver actualizarArticulo, backend). */}
              <TextField label="Nombre original" size="small" fullWidth disabled
                value={infoOrigen?.nombre_original || infoOrigen?.nombre || form.nombre || ''} />
            </Stack>
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
                <Select MenuProps={downwardMenuProps()} label="Rubro *" value={form.rubro}
                  onChange={e => setForm(f => ({
                    ...f, rubro: e.target.value, subrubro: '',
                  }))}>
                  <MenuItem value="__nuevo__" sx={{ color: themeColor, fontStyle: 'italic' }}>
                    + Crear rubro nuevo…
                  </MenuItem>
                  <Divider />
                  {rubros.length === 0 && (
                    <MenuItem disabled value="">
                      <em style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Sin rubros aún</em>
                    </MenuItem>
                  )}
                  {rubros.map(r => <MenuItem key={r.nombre} value={r.nombre}>{r.nombre}</MenuItem>)}
                </Select>
              </FormControl>
              {esRubroNuevo && (
                <TextField size="small" fullWidth autoFocus inputRef={rubroNuevoRef}
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
                <Select MenuProps={downwardMenuProps()} label="Subrubro" value={form.subrubro}
                  onChange={e => setForm(f => ({ ...f, subrubro: e.target.value }))}
                  disabled={!rubroEfectivo}>
                  <MenuItem value="">Sin subrubro</MenuItem>
                  <MenuItem value="__nuevo__" sx={{ color: themeColor, fontStyle: 'italic' }}>
                    + Crear subrubro nuevo…
                  </MenuItem>
                  {(subrubrosDelRubro.length > 0 || esRubroNuevo) && <Divider />}
                  {subrubrosDelRubro.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
              {esSubrubroNuevo && (
                <TextField size="small" fullWidth autoFocus inputRef={subrubroNuevoRef}
                  label="Nombre del subrubro nuevo"
                  placeholder="Ej: Cócteles, Sin alcohol…"
                  value={subrubroNuevo}
                  onChange={e => setSubrubroNuevo(e.target.value)}
                />
              )}
            </Stack>
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
              <Select MenuProps={downwardMenuProps()} label="Agrupación" value={form.agrupacionId}
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
        <Button ref={guardarRef} size="small" variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
          sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
          {saving ? (isEdit ? 'Guardando…' : 'Creando…') : (isEdit ? 'Guardar cambios' : 'Crear artículo')}
        </Button>
      </DialogActions>

      {tourStep === 2 && (
        <SpotlightTour
          targetRef={campoNombreRubroRef}
          pose="presenta"
          text={<>Completá el <b>nombre</b> y el <b>rubro</b> del artículo — son los únicos datos obligatorios. El resto (precio, subrubro, SKU) lo podés completar después.</>}
          onSkip={onTourSkip}
          onNext={onTourNext}
        />
      )}
      {tourStep === 3 && (
        <SpotlightTour
          targetRef={padrinoRef}
          pose="investiga"
          text={<>Si tildás esto, podés elegir un artículo que ya tengas cargado como <b>referencia</b>: copia su rubro, subrubro, precio y agrupación automáticamente, así no completás todo desde cero.</>}
          onSkip={onTourSkip}
          onNext={onTourNext}
        />
      )}
      {tourStep === 4 && (
        <SpotlightTour
          targetRef={guardarRef}
          pose="saluda"
          text="Cuando estés list@, guardá — tu artículo va a aparecer al instante en la tabla."
          onSkip={onTourSkip}
        />
      )}
    </Dialog>
  );
}