// src/componentes/super/AjusteDialog.jsx
// Crear o editar un ajuste a medida (13/11/2026): una clave con su valor, para todos o para una
// organización, un negocio o un usuario. Desde un pedido viene precargado con el cliente/negocio.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Autocomplete,
  Switch, FormControlLabel, Stack, Typography, Alert,
} from '@mui/material';
import { SuperAPI } from '@/servicios/apiSoporte';

const ALCANCES = [
  ['global', 'Todos los clientes'],
  ['organizacion', 'Una organización'],
  ['negocio', 'Un negocio'],
  ['usuario', 'Un usuario'],
];
const ERRORES = {
  clave_invalida: 'La clave va en minúsculas, sin espacios (ej. aviso_cliente).',
  alcance_invalido: 'Elegí a quién se aplica.',
  falta_a_quien: 'Elegí la organización, el negocio o el usuario.',
  valor_muy_largo: 'El valor es demasiado largo.',
};

// Valor guardado (JSON) ↔ lo que se edita en pantalla según el tipo de la clave.
const aTexto = (v, tipo) => {
  if (tipo === 'lista') return Array.isArray(v) ? v.join(', ') : '';
  if (tipo === 'texto') return typeof v === 'string' ? v : '';
  if (tipo === 'bool') return v === false ? 'false' : 'true';
  return v === undefined ? 'true' : JSON.stringify(v);
};
const deTexto = (t, tipo) => {
  if (tipo === 'lista') return t.split(',').map((x) => x.trim()).filter(Boolean);
  if (tipo === 'texto') return t;
  if (tipo === 'bool') return t !== 'false';
  try { return JSON.parse(t); } catch { return t; }
};

export default function AjusteDialog({ open, onClose, onGuardado, catalogo = [], inicial = null, opcionesRapidas = [] }) {
  const [a, setA] = useState(null);
  const [texto, setTexto] = useState('');
  const [aQuien, setAQuien] = useState(null);       // { id, nombre }
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = { clave: '', alcance: 'negocio', scope_id: null, valor: true, activo: true, nota: '', solicitud_id: null, ...(inicial || {}) };
    setA(base);
    const tipo = catalogo.find((c) => c.clave === base.clave)?.tipo || 'json';
    setTexto(aTexto(base.valor, tipo));
    setAQuien(base.scope_id ? { id: base.scope_id, nombre: base.scope_nombre || `#${base.scope_id}` } : null);
    setError(''); setResultados([]); setBusqueda('');
  }, [open, inicial, catalogo]);

  const info = useMemo(() => catalogo.find((c) => c.clave === a?.clave), [catalogo, a?.clave]);
  const tipo = info?.tipo || 'json';

  useEffect(() => {
    if (!a || a.alcance === 'global' || busqueda.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(() => {
      SuperAPI.buscarAlcance(a.alcance, busqueda.trim()).then((r) => setResultados(r?.resultados || [])).catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, a]);

  if (!a) return null;
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const rapidas = opcionesRapidas.filter((o) => o.alcance === a.alcance);

  const guardar = async () => {
    setGuardando(true); setError('');
    try {
      const r = await SuperAPI.guardarAjuste({
        ...a, clave: String(a.clave || '').trim().toLowerCase(),
        scope_id: a.alcance === 'global' ? null : aQuien?.id || null,
        valor: deTexto(texto, tipo),
      });
      onGuardado?.(r?.ajuste);
      onClose?.();
    } catch (e) {
      setError(ERRORES[e?.data?.error] || 'No se pudo guardar el ajuste.');
    } finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{inicial?.id ? 'Editar ajuste' : 'Nuevo ajuste a medida'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            freeSolo
            options={catalogo.map((c) => c.clave)}
            value={a.clave}
            onInputChange={(_e, v) => {
              set('clave', v);
              const t = catalogo.find((c) => c.clave === v)?.tipo;
              if (t && t !== tipo) setTexto(aTexto(t === 'texto' ? '' : t === 'lista' ? [] : true, t));
            }}
            getOptionLabel={(o) => o}
            renderOption={(props, o) => {
              const c = catalogo.find((x) => x.clave === o);
              return <li {...props} key={o}><div><b>{o}</b><div style={{ fontSize: 12, color: '#64748b' }}>{c?.titulo}</div></div></li>;
            }}
            renderInput={(p) => <TextField {...p} size="small" label="Clave" helperText={info ? info.descripcion : 'Una del catálogo o una nueva (para algo programado a medida).'} />}
          />
          <TextField select size="small" label="Para quién" value={a.alcance} onChange={(e) => { set('alcance', e.target.value); setAQuien(null); setBusqueda(''); }}>
            {ALCANCES.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
          </TextField>
          {a.alcance !== 'global' && (
            <>
              {rapidas.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {rapidas.map((o) => (
                    <Button key={`${o.alcance}-${o.id}`} size="small" variant={aQuien?.id === o.id ? 'contained' : 'outlined'}
                      onClick={() => setAQuien({ id: o.id, nombre: o.nombre })} sx={{ textTransform: 'none' }}>{o.nombre}</Button>
                  ))}
                </Stack>
              )}
              <Autocomplete
                options={resultados}
                value={aQuien}
                onChange={(_e, v) => setAQuien(v)}
                inputValue={busqueda}
                onInputChange={(_e, v) => setBusqueda(v)}
                getOptionLabel={(o) => (o ? `${o.nombre} (#${o.id})` : '')}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                filterOptions={(x) => x}
                noOptionsText={busqueda.trim().length < 2 ? 'Escribí al menos 2 letras o el id' : 'Sin resultados'}
                renderInput={(p) => <TextField {...p} size="small" label="Buscar por nombre, mail o id" />}
              />
            </>
          )}
          {tipo === 'bool' ? (
            <FormControlLabel control={<Switch checked={texto !== 'false'} onChange={(e) => setTexto(e.target.checked ? 'true' : 'false')} />} label={texto !== 'false' ? 'Prendido' : 'Apagado'} />
          ) : (
            <TextField size="small" label={tipo === 'lista' ? 'Valores (separados por coma)' : tipo === 'texto' ? 'Texto' : 'Valor (JSON o texto)'}
              multiline={tipo !== 'lista'} minRows={tipo === 'texto' ? 2 : 1} value={texto} onChange={(e) => setTexto(e.target.value)} />
          )}
          <TextField size="small" label="Nota interna (por qué existe este ajuste)" value={a.nota || ''} onChange={(e) => set('nota', e.target.value)} />
          <FormControlLabel control={<Switch checked={a.activo !== false} onChange={(e) => set('activo', e.target.checked)} />} label="Activo" />
          {a.solicitud_id && <Typography variant="caption" color="text.secondary">Queda atado al pedido #{a.solicitud_id}.</Typography>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={guardar} disabled={guardando || !a.clave}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      </DialogActions>
    </Dialog>
  );
}
