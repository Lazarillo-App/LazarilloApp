// src/paginas/GestionConceptos.jsx
// Conceptos de caja (lazarillo_gestion/app/(shell)/conceptos/page.tsx). La lista es de la
// organización. Los propios van desde el 1000; los de MaxiRest se pueden modificar acá (vale solo
// en Lazarillo y el original queda a la vista). Las reglas de apertura llegan con ese bloque.

import React, { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, CircularProgress, IconButton, MenuItem, Paper, Select, Snackbar, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined';
import { useCelular } from '@/componentes/base';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/context/BusinessContext';
import { GestionAPI } from '@/servicios/apiGestion';
import { CODIGO_MIN_LAZARILLO, TIPOS_CONCEPTO, esPropio, proximoCodigoLazarillo } from '@/gestion/cargaUtils';
import { rangosLibres, cantidadLibres, textoRango, libreDesde, MAX_CODIGO_CONCEPTO } from '@/gestion/codigosLibres';
import DiscontinuarConcepto, { fechaCorta } from '@/componentes/gestion/DiscontinuarConcepto';

const sxLabel = { display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 12, color: 'text.secondary' };
const sxOriginal = { fontSize: 11, color: 'text.disabled' };
const sxEtiqueta = (bg, color) => ({ borderRadius: 0.5, bgcolor: bg, color, px: 0.5, fontSize: 10, fontWeight: 600 });

export function Buscador({ valor, opciones, placeholder, ancho, onCambio }) {
  const elegido = opciones.find((o) => o.valor === valor) ?? null;
  return (
    <Autocomplete
      size="small" value={elegido} options={opciones} sx={{ width: ancho }}
      getOptionLabel={(o) => o.texto}
      isOptionEqualToValue={(a, b) => a.valor === b.valor}
      noOptionsText="Sin resultados."
      onChange={(_, o) => onCambio(o?.valor ?? '')}
      renderInput={(p) => <TextField {...p} placeholder={placeholder} />}
    />
  );
}

// También lo usa el panel «Sin rubro · por qué» para corregir un concepto ahí mismo (mismo formulario).
export function Formulario({ inicial, proximo, rubros, conceptos, onCerrar, onGuardado, onAviso }) {
  const [f, setF] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const editando = inicial.codigo != null;
  const deMaxirest = editando && !esPropio(inicial.codigo);
  const orig = inicial.original;

  const elegirPadrino = (v) => {
    const p = conceptos.find((c) => String(c.codigo) === v);
    if (!p) { setF({ ...f, padrino: null }); return; }
    setF({
      ...f,
      padrino: v,
      tipo: p.tipo && ['-', '+', 'E'].includes(p.tipo) ? p.tipo : f.tipo,
      codRubro: p.codRubro != null ? String(p.codRubro) : f.codRubro,
    });
  };
  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = { nombre: f.nombre, tipo: f.tipo, codRubro: f.codRubro };
      const d = editando
        ? await GestionAPI.editarConcepto(inicial.codigo, cuerpo)
        : await GestionAPI.crearConcepto(cuerpo);
      onAviso({ sev: 'success', txt: editando ? `Concepto ${inicial.codigo} actualizado` : `Concepto ${d?.codigo} creado` });
      onGuardado(d);   // con lo creado: el que lo llamó desde un desplegable lo deja elegido
    } catch (e) {
      setError(e?.data?.error ?? 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }
  async function restaurar() {
    setGuardando(true);
    setError(null);
    try {
      await GestionAPI.editarConcepto(inicial.codigo, { restaurar: true });
      onAviso({ sev: 'success', txt: `Concepto ${inicial.codigo}: volvió al de MaxiRest` });
      onGuardado();
    } catch {
      setError('No se pudo volver al de MaxiRest');
    } finally {
      setGuardando(false);
    }
  }
  const original = (v) => (deMaxirest && orig ? <Box component="span" sx={sxOriginal} title="Original de MaxiRest">MaxiRest: {v || '—'}</Box> : null);
  const opcionesRubro = rubros.map((r) => ({ valor: String(r.codigo), texto: `${r.codigo} · ${r.nombre}` }));
  const opcionesPadrino = conceptos.map((c) => ({ valor: String(c.codigo), texto: `${c.codigo} · ${c.nombre}` }));

  return (
    <Box sx={{ mx: 2, my: 1.5, borderRadius: 2, border: '1px solid #bae6fd', bgcolor: 'rgba(240,249,255,.6)', p: 1.5 }}>
      <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography fontSize={12} fontWeight={500}>
          {deMaxirest ? `Modificar concepto ${inicial.codigo} de MaxiRest · lo que cambies vale solo en Lazarillo (el código no cambia)` : editando ? `Modificar concepto ${inicial.codigo}` : `Nuevo concepto de Lazarillo · código ${proximo}`}
        </Typography>
        {!editando && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: 'text.secondary' }}>
            Copiar de (padrino)
            <Buscador valor={f.padrino ?? ''} opciones={opcionesPadrino} placeholder="Ninguno" ancho={256} onCambio={elegirPadrino} />
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 1.5 }}>
        <Box sx={sxLabel}>Nombre
          <TextField size="small" autoFocus value={f.nombre} slotProps={{ htmlInput: { maxLength: 60 } }} onChange={(e) => setF({ ...f, nombre: e.target.value })} sx={{ width: 256 }} />
          {original(orig?.nombre)}
        </Box>
        <Box sx={sxLabel}>Tipo
          <Select size="small" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {TIPOS_CONCEPTO.map((t) => <MenuItem key={t.valor} value={t.valor}>{t.etiqueta}</MenuItem>)}
          </Select>
          {original(orig ? TIPOS_CONCEPTO.find((t) => t.valor === orig.tipo)?.etiqueta ?? orig.tipo : null)}
        </Box>
        <Box sx={sxLabel}>Rubro
          <Buscador valor={f.codRubro} opciones={opcionesRubro} placeholder="Elegí un rubro" ancho={256} onCambio={(v) => setF({ ...f, codRubro: v })} />
          {original(orig ? `${orig.codRubro ?? ''} · ${orig.rubro ?? ''}` : null)}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" disabled={guardando} onClick={onCerrar}>Cancelar</Button>
          <Button size="small" variant="contained" disabled={guardando || !f.nombre.trim() || !f.codRubro} onClick={guardar}>{editando ? 'Guardar' : 'Crear concepto'}</Button>
          {deMaxirest && inicial.editado && <Button size="small" disabled={guardando} onClick={restaurar}>Volver al de MaxiRest</Button>}
        </Box>
      </Box>
      {error && <Typography color="error" fontSize={12} sx={{ mt: 1 }}>{error}</Typography>}
    </Box>
  );
}

function CopiarCodigo({ codigo, grande = false }) {
  const [ok, setOk] = useState(false);
  return (
    <Box
      component="button" type="button" title="Copiar código"
      onClick={() => {
        navigator.clipboard?.writeText(String(codigo)).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
      sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.75, border: 1, borderColor: 'divider', borderRadius: 1.5, fontVariantNumeric: 'tabular-nums', '&:hover': { bgcolor: 'grey.100' }, ...(grande ? { height: 36, px: 1.5, fontSize: 18, fontWeight: 600 } : { height: 28, px: 1, fontSize: 14 }) }}
    >
      {codigo}
      {ok ? <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} /> : <ContentCopyIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
    </Box>
  );
}

// Uso (Diego 20/11/2026): «sin uso» = nada en los últimos 12 meses (con la fecha del último), «nunca usado»
// = ningún registro. Se ve con una etiqueta de color, no con un punto gris que no se nota.
const sxChip = (estado) => ({
  display: 'inline-flex', alignItems: 'center', height: 20, px: 1, borderRadius: 10, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
  ...(estado === 'nunca' ? { bgcolor: '#fdecec', color: '#a32d2d' } : estado === 'dormido' ? { bgcolor: '#fdf3e0', color: '#8a5300' } : { bgcolor: 'grey.200', color: 'text.secondary' }),
});
const estadoUso = (u) => (!u?.ultimo ? 'nunca' : u.n12 > 0 ? 'activo' : 'dormido');
const textoChip = (u, corto) => (!u?.ultimo ? (corto ? 'Nunca' : 'Nunca usado') : `${corto ? '' : 'Sin uso desde '}${fechaCorta(u.ultimo).slice(3)}`);
const sxBotonTexto = { all: 'unset', cursor: 'pointer', fontSize: 12, color: 'text.secondary', px: 0.75, height: 24, display: 'inline-flex', alignItems: 'center', borderRadius: 1, flexShrink: 0, '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } };

const Flecha = ({ abierta }) => <ExpandMoreIcon sx={{ fontSize: 16, flexShrink: 0, color: 'text.secondary', transition: 'transform .15s', transform: abierta ? 'none' : 'rotate(-90deg)' }} />;

export default function GestionConceptos() {
  const { activeBusinessId } = useBusiness() || {};
  const queryClient = useQueryClient();
  const celular = useCelular();
  const { data, isLoading, error } = useQuery({
    queryKey: ['gestionConceptos', activeBusinessId],
    queryFn: () => GestionAPI.conceptos(),
    enabled: !!activeBusinessId,
    staleTime: 60_000,
  });
  const [desde, setDesde] = useState('');
  // ?q= viene de «Ver la regla ›» de la carga de Gastos Varios (Diego 20/11/2026).
  const [q, setQ] = useState(() => { try { return new URLSearchParams(window.location.search).get('q') || ''; } catch { return ''; } });
  const [libresAbierta, setLibresAbierta] = useState(false);
  const [rubrosAbiertos, setRubrosAbiertos] = useState(() => new Set());
  const [form, setForm] = useState(null);
  // Dónde se abre el formulario: arriba (null) o dentro de un rubro.
  const [formEn, setFormEn] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [verDiscontinuados, setVerDiscontinuados] = useState(false);
  const [aDiscontinuar, setADiscontinuar] = useState(null);

  // Crear o cambiar un concepto también cambia lo que ofrecen la carga y el modal de edición.
  const refrescar = () => {
    for (const k of ['gestionConceptos', 'gestionMaestrosFactura', 'gestionConceptosEdicion', 'gestionPivot']) queryClient.invalidateQueries({ queryKey: [k] });
  };
  const nuevo = (codRubro = '', en = null) => { setFormEn(en); setForm({ codigo: null, nombre: '', tipo: '-', codRubro, padrino: null }); };
  async function darDeBaja(codigo) {
    setABorrar(null);
    try {
      await GestionAPI.borrarConcepto(codigo);
      setAviso({ sev: 'success', txt: `Concepto ${codigo} dado de baja` });
      refrescar();
    } catch (e) {
      setAviso({ sev: 'error', txt: e?.data?.error ?? 'No se pudo dar de baja' });
    }
  }

  const conceptos = useMemo(() => data?.conceptos ?? [], [data]);
  const conRegistros = useMemo(() => (data?.conRegistros ? new Set(data.conRegistros) : null), [data]);
  const sinUso = (c) => conRegistros != null && !conRegistros.has(String(c.codigo));
  const negocios = useMemo(() => data?.negocios ?? [], [data]);
  // Uso por concepto: total y por negocio.
  const uso = useMemo(() => {
    const m = new Map();
    for (const f of data?.uso ?? []) {
      const k = String(f.c);
      const t = m.get(k) ?? { ultimo: null, n12: 0, porNegocio: new Map() };
      if (!t.ultimo || f.ultimo > t.ultimo) t.ultimo = f.ultimo;
      t.n12 += f.n12;
      t.porNegocio.set(f.b, { ultimo: f.ultimo, n12: f.n12 });
      m.set(k, t);
    }
    return m;
  }, [data]);
  const usoDe = (cs) => {
    const t = { ultimo: null, n12: 0, porNegocio: new Map() };
    for (const c of cs) {
      const u = uso.get(String(c.codigo));
      if (!u) continue;
      if (!t.ultimo || u.ultimo > t.ultimo) t.ultimo = u.ultimo;
      t.n12 += u.n12;
      for (const [b, x] of u.porNegocio) {
        const y = t.porNegocio.get(b) ?? { ultimo: null, n12: 0 };
        t.porNegocio.set(b, { ultimo: !y.ultimo || x.ultimo > y.ultimo ? x.ultimo : y.ultimo, n12: y.n12 + x.n12 });
      }
    }
    return t;
  };
  // Discontinuados: alcance 'org' (toda la organización) o la lista de negocios.
  const alcance = useMemo(() => {
    const m = new Map();
    for (const d of data?.discontinuados ?? []) {
      const k = `${d.tipo}:${d.codigo}`;
      if (d.businessId == null) m.set(k, 'org');
      else if (m.get(k) !== 'org') m.set(k, [...(m.get(k) ?? []), d.businessId]);
    }
    return m;
  }, [data]);
  const textoAlcance = (a) => (a === 'org' || negocios.length <= 1 ? 'Discontinuado' : `Discontinuado en ${a.map((id) => negocios.find((n) => n.id === id)?.nombre ?? id).join(', ')}`);
  const alcanceRubro = (cs) => (cs[0]?.codRubro != null ? alcance.get(`rubro:${cs[0].codRubro}`) : undefined);
  const nDiscontinuados = (data?.discontinuados ? new Set(data.discontinuados.map((d) => `${d.tipo}:${d.codigo}`)).size : 0);
  async function discontinuar(item, businessIds) {
    try {
      await GestionAPI.discontinuarConcepto({ tipo: item.tipo, codigo: String(item.codigo), businessIds });
      setADiscontinuar(null);
      setAviso({ sev: 'success', txt: `«${item.nombre}» discontinuado` });
      refrescar();
    } catch (e) {
      setAviso({ sev: 'error', txt: e?.data?.error ?? 'No se pudo discontinuar' });
    }
  }
  async function reactivar(item) {
    try {
      await GestionAPI.reactivarConcepto({ tipo: item.tipo, codigo: String(item.codigo) });
      setAviso({ sev: 'success', txt: `«${item.nombre}» reactivado` });
      refrescar();
    } catch (e) {
      setAviso({ sev: 'error', txt: e?.data?.error ?? 'No se pudo reactivar' });
    }
  }
  const porCodigo = useMemo(() => new Map(conceptos.map((c) => [c.codigo, c])), [conceptos]);
  const deMaxirest = useMemo(() => conceptos.filter((c) => !esPropio(c.codigo)), [conceptos]);
  const maximo = useMemo(() => Math.max(MAX_CODIGO_CONCEPTO, ...deMaxirest.map((c) => c.codigo)), [deMaxirest]);
  const rangos = useMemo(() => rangosLibres(deMaxirest.map((c) => c.codigo), maximo), [deMaxirest, maximo]);
  const nDesde = Number(desde);
  const consulta = desde !== '' && Number.isInteger(nDesde) && nDesde >= 1 ? nDesde : null;
  const ocupadoPor = consulta != null ? porCodigo.get(consulta) : undefined;
  const sugerido = libreDesde(rangos, consulta ?? 1);
  const primerLibre = libreDesde(rangos, 1);
  const proximoPropio = proximoCodigoLazarillo(conceptos.map((c) => c.codigo));

  const grupos = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtrados = t
      ? conceptos.filter((c) => String(c.codigo).includes(t) || c.nombre.toLowerCase().includes(t) || (c.rubro ?? '').toLowerCase().includes(t))
      : conceptos;
    const m = new Map();
    for (const c of filtrados) {
      const k = c.rubro ? `${c.codRubro ?? ''} · ${c.rubro}` : 'Sin rubro';
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    const visibles = [...m.entries()]
      .map(([k, cs]) => {
        const rubroFuera = cs[0]?.codRubro != null && alcance.has(`rubro:${cs[0].codRubro}`);
        if (verDiscontinuados || t) return [k, cs];
        if (rubroFuera) return null;
        const quedan = cs.filter((c) => !alcance.has(`concepto:${c.codigo}`));
        return quedan.length ? [k, quedan] : null;
      })
      .filter(Boolean);
    return visibles.sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
  }, [conceptos, q, alcance, verDiscontinuados]);

  const formulario = form && (
    <Formulario
      key={form.codigo ?? 'nuevo'} inicial={form} proximo={proximoPropio} rubros={data?.rubros ?? []} conceptos={conceptos}
      onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); refrescar(); }} onAviso={setAviso}
    />
  );
  const sinRubros = (data?.rubros ?? []).length === 0;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div>
        <Typography variant="h5" fontWeight={600}>Conceptos de caja</Typography>
        <Typography variant="body2" color="text.secondary">
          Conceptos propios de Lazarillo (desde el {CODIGO_MIN_LAZARILLO}) y códigos libres para dar de alta en MaxiRest. Los de MaxiRest también se pueden modificar acá: vale solo en Lazarillo y el original queda en gris.
        </Typography>
      </div>
      {isLoading ? (
        <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={32} /></Box>
      ) : error ? (
        <Typography color="error" fontSize={14}>No se pudieron leer los conceptos.</Typography>
      ) : (
        <>
          {/* Los códigos libres solo sirven a quien da de alta conceptos en MaxiRest. */}
          {deMaxirest.length > 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
                <Box component="button" type="button" aria-expanded={libresAbierta} onClick={() => setLibresAbierta(!libresAbierta)} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ pt: 0.25 }}><Flecha abierta={libresAbierta} /></Box>
                  <span>
                    <Box sx={{ fontSize: 14, fontWeight: 500 }}>Códigos libres</Box>
                    <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{cantidadLibres(rangos)} libres de {maximo} en MaxiRest · {deMaxirest.length} en uso</Box>
                  </span>
                </Box>
                {!libresAbierta ? (
                  primerLibre != null && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: 'text.secondary' }}>Próximo libre <CopiarCodigo codigo={primerLibre} grande /></Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5 }}>
                    <Box sx={sxLabel}>Buscar libre desde
                      <TextField size="small" placeholder="ej. 300" value={desde} onChange={(e) => setDesde(e.target.value.replace(/\D/g, ''))} slotProps={{ htmlInput: { inputMode: 'numeric' } }} sx={{ width: 112 }} />
                    </Box>
                    {sugerido != null && (
                      <Box sx={sxLabel}>
                        {consulta != null && ocupadoPor
                          ? <span>El {consulta} es <b>{ocupadoPor.nombre}</b> · libre:</span>
                          : consulta != null && sugerido === consulta
                            ? <Box component="span" sx={{ color: 'success.dark' }}>El {consulta} está libre</Box>
                            : <span>Primer libre</span>}
                        <CopiarCodigo codigo={sugerido} grande />
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
              {libresAbierta && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {rangos.map((r) => (
                    <Box
                      key={r.desde} component="button" type="button" onClick={() => setDesde(String(r.desde))}
                      title={`${r.hasta - r.desde + 1} libre${r.hasta === r.desde ? '' : 's'}`}
                      sx={{ all: 'unset', cursor: 'pointer', height: 28, px: 1, display: 'inline-flex', alignItems: 'center', border: 1, borderColor: consulta != null && consulta >= r.desde && consulta <= r.hasta ? '#38bdf8' : 'divider', borderRadius: 1.5, fontSize: 12, fontVariantNumeric: 'tabular-nums', '&:hover': { bgcolor: 'grey.100' } }}
                    >
                      {textoRango(r)}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          )}

          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 14, fontWeight: 500 }}><LocalOfferOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> En uso</Box>
                <Box component="button" type="button" onClick={() => setRubrosAbiertos(rubrosAbiertos.size >= grupos.length ? new Set() : new Set(grupos.map(([r]) => r)))} sx={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: 'text.secondary', '&:hover': { textDecoration: 'underline' } }}>
                  {rubrosAbiertos.size >= grupos.length ? 'Cerrar todos' : 'Abrir todos'}
                </Box>
                {conRegistros && <Box component="span" title="Sin registros en los últimos 12 meses" sx={sxChip('dormido')}>Sin uso +12 meses</Box>}
                {conRegistros && <Box component="span" title="Sin ningún registro" sx={sxChip('nunca')}>Nunca usado</Box>}
                {nDiscontinuados > 0 && (
                  <Box component="button" type="button" onClick={() => setVerDiscontinuados(!verDiscontinuados)} sx={{ ...sxBotonTexto, color: verDiscontinuados ? '#0369a1' : 'text.secondary' }}>
                    {verDiscontinuados ? 'Ocultar' : 'Ver'} discontinuados ({nDiscontinuados})
                  </Box>
                )}
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, color: 'text.secondary' }}><Box component="span" sx={sxEtiqueta('#e0f2fe', '#0369a1')}>LZ</Box> de Lazarillo (desde {CODIGO_MIN_LAZARILLO})</Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' }, width: { xs: '100%', sm: 'auto' } }}>
                <Button size="small" variant="contained" startIcon={<AddIcon />} disabled={sinRubros} onClick={() => nuevo()}>Nuevo concepto</Button>
                <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, concepto o rubro" sx={{ width: { xs: '100%', sm: 256 } }} />
              </Box>
            </Box>
            {sinRubros && <Box sx={{ px: 2, py: 1.5, fontSize: 13, color: 'text.secondary' }}>Esta organización todavía no tiene rubros: sin rubros no se pueden crear conceptos.</Box>}
            {form && formEn == null && formulario}
            <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              {grupos.map(([rubro, cs]) => {
                const abierto = q.trim() !== '' || rubrosAbiertos.has(rubro);
                const nSinUso = cs.filter(sinUso).length;
                // El uso del rubro es de todos sus conceptos, aunque el buscador muestre solo algunos.
                const uR = usoDe(cs[0]?.codRubro != null ? conceptos.filter((c) => c.codRubro === cs[0].codRubro) : cs);
                const eR = conRegistros ? estadoUso(uR) : 'activo';
                const aR = alcanceRubro(cs);
                const itemR = cs[0]?.codRubro != null ? { tipo: 'rubro', codigo: cs[0].codRubro, nombre: cs[0].rubro, usoPorNegocio: uR.porNegocio, alcance: aR === 'org' ? null : aR } : null;
                return (
                  <Box key={rubro} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, ...(aR ? { bgcolor: 'grey.50' } : {}) }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, '&:hover > .accion-uso': { opacity: 1 } }}>
                      <Box
                        component="button" type="button" aria-expanded={abierto}
                        onClick={() => {
                          const n = new Set(rubrosAbiertos);
                          if (n.has(rubro)) n.delete(rubro); else n.add(rubro);
                          setRubrosAbiertos(n);
                        }}
                        sx={{ all: 'unset', cursor: 'pointer', minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, fontWeight: 500, color: 'text.secondary' }}
                      >
                        <Flecha abierta={abierto} />
                        <Box component="span" sx={{ color: aR ? 'text.secondary' : 'text.primary', ...(aR ? { textDecoration: 'line-through' } : {}) }}>{rubro}</Box>
                        <Box component="span" sx={{ fontWeight: 400 }}>· {cs.length} concepto{cs.length === 1 ? '' : 's'}{nSinUso && eR === 'activo' ? ` · ${nSinUso} nunca usado${nSinUso === 1 ? '' : 's'}` : ''}</Box>
                        {aR ? <Box component="span" sx={sxChip()}>{celular ? 'Discontinuado' : textoAlcance(aR)}</Box> : eR !== 'activo' && <Box component="span" title={textoChip(uR)} sx={sxChip(eR)}>{textoChip(uR, celular)}</Box>}
                      </Box>
                      {conRegistros && uR.ultimo && (
                        <Box component="span" title="Último registro · registros en los últimos 12 meses" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {fechaCorta(uR.ultimo)} · {uR.n12.toLocaleString('es-AR')} en 12 m
                        </Box>
                      )}
                      {itemR && (aR
                        ? <Box component="button" type="button" onClick={() => reactivar(itemR)} sx={{ ...sxBotonTexto, color: '#0369a1' }}>Reactivar</Box>
                        : celular
                          ? <IconButton size="small" title="Discontinuar…" aria-label="Discontinuar rubro" onClick={() => setADiscontinuar(itemR)} sx={{ width: 36, height: 36, color: eR === 'activo' ? 'text.disabled' : 'text.secondary' }}><DoNotDisturbOnOutlinedIcon sx={{ fontSize: 18 }} /></IconButton>
                          : <Box component="button" type="button" className="accion-uso" onClick={() => setADiscontinuar(itemR)} sx={{ ...sxBotonTexto, opacity: eR === 'activo' ? 0 : 1, '&:focus-visible': { opacity: 1 } }}>Discontinuar…</Box>)}
                      {cs[0]?.codRubro != null && (
                        <IconButton
                          size="small" title={`Nuevo concepto en ${rubro}`}
                          onClick={() => { setRubrosAbiertos(new Set(rubrosAbiertos).add(rubro)); nuevo(String(cs[0].codRubro), rubro); }}
                          sx={{ width: 24, height: 24, border: 1, borderColor: 'divider', borderRadius: 1 }}
                        >
                          <AddIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                    {form && formEn === rubro && <Box sx={{ mx: -2 }}>{formulario}</Box>}
                    {abierto && (
                      <Box sx={{ mt: 0.5, columnCount: { xs: 1, sm: 2 }, columnGap: 4, fontSize: 14 }}>
                        {cs.map((c) => (
                          <Box key={c.codigo} sx={{ display: 'flex', breakInside: 'avoid', alignItems: 'center', gap: 1.5, py: 0.25, '&:hover .accion-uso': { opacity: 1 } }}>
                            <Box component="span" sx={{ width: 40, flexShrink: 0, textAlign: 'right', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{c.codigo}</Box>
                            <Box component="span" sx={{ minWidth: { xs: 96, sm: 0 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(sinUso(c) || alcance.has(`concepto:${c.codigo}`) ? { color: 'text.secondary' } : {}), ...(alcance.has(`concepto:${c.codigo}`) ? { textDecoration: 'line-through' } : {}) }}>
                              {c.nombre}
                              {c.editado && c.original && <Box component="span" sx={{ ml: 0.75, ...sxOriginal }}>MaxiRest: {c.original.nombre}</Box>}
                            </Box>
                            {(() => {
                              const aC = alcance.get(`concepto:${c.codigo}`);
                              const uC = uso.get(String(c.codigo));
                              const eC = conRegistros ? estadoUso(uC) : 'activo';
                              if (aC) return <Box component="span" sx={sxChip()}>{celular ? 'Discontinuado' : textoAlcance(aC)}</Box>;
                              if (aR || eC === 'activo') return null;
                              return <Box component="span" title={textoChip(uC)} sx={sxChip(eC)}>{textoChip(uC, celular)}</Box>;
                            })()}
                            <Box component="span" sx={{ ml: 'auto', display: 'flex', flexShrink: 0, alignItems: 'center', gap: 0.5 }}>
                              {(() => {
                                const aC = alcance.get(`concepto:${c.codigo}`);
                                const uC = uso.get(String(c.codigo));
                                const itemC = { tipo: 'concepto', codigo: c.codigo, nombre: c.nombre, usoPorNegocio: uC?.porNegocio ?? new Map(), alcance: aC === 'org' ? null : aC };
                                if (aC) return <Box component="button" type="button" onClick={() => reactivar(itemC)} sx={{ ...sxBotonTexto, color: '#0369a1' }}>Reactivar</Box>;
                                if (aR) return null;
                                const quieto = conRegistros && estadoUso(uC) !== 'activo';
                                if (celular) return <IconButton size="small" title="Discontinuar…" aria-label="Discontinuar" onClick={() => setADiscontinuar(itemC)} sx={{ width: 36, height: 36, color: quieto ? 'text.secondary' : 'text.disabled' }}><DoNotDisturbOnOutlinedIcon sx={{ fontSize: 18 }} /></IconButton>;
                                return <Box component="button" type="button" className="accion-uso" onClick={() => setADiscontinuar(itemC)} sx={{ ...sxBotonTexto, opacity: quieto ? 1 : 0, '&:focus-visible': { opacity: 1 } }}>Discontinuar…</Box>;
                              })()}
                              {esPropio(c.codigo)
                                ? <Box component="span" sx={sxEtiqueta('#e0f2fe', '#0369a1')}>LZ</Box>
                                : c.editado && <Box component="span" title="Modificado en Lazarillo" sx={sxEtiqueta('#ede9fe', '#6d28d9')}>EDITADO</Box>}
                              <IconButton
                                size="small"
                                title={esPropio(c.codigo) ? 'Modificar' : 'Modificar en Lazarillo (el original de MaxiRest queda guardado)'}
                                onClick={() => {
                                  setFormEn(rubro);
                                  setForm({
                                    codigo: c.codigo, nombre: c.nombre, tipo: c.tipo ?? '-', codRubro: c.codRubro != null ? String(c.codRubro) : '', padrino: null,
                                    ...(esPropio(c.codigo) ? {} : { original: c.original ?? { nombre: c.nombre, tipo: c.tipo, codRubro: c.codRubro, rubro: c.rubro }, editado: !!c.editado }),
                                  });
                                }}
                                sx={{ width: 24, height: 24 }}
                              >
                                <EditIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                              {esPropio(c.codigo) && (aBorrar === c.codigo ? (
                                <Button size="small" color="error" variant="contained" autoFocus onClick={() => darDeBaja(c.codigo)} onBlur={() => setABorrar(null)} sx={{ height: 24, fontSize: 11, textTransform: 'none' }}>¿Dar de baja?</Button>
                              ) : (
                                <IconButton size="small" title="Dar de baja" color="error" onClick={() => setABorrar(c.codigo)} sx={{ width: 24, height: 24 }}><DeleteOutlineIcon sx={{ fontSize: 14 }} /></IconButton>
                              ))}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })}
              {grupos.length === 0 && <Box sx={{ px: 2, py: 3, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>Sin resultados.</Box>}
            </Box>
          </Paper>
        </>
      )}
      {aDiscontinuar && (
        <DiscontinuarConcepto item={aDiscontinuar} negocios={negocios} onCerrar={() => setADiscontinuar(null)} onConfirmar={(ids) => discontinuar(aDiscontinuar, ids)} />
      )}
      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aviso ? <Alert severity={aviso.sev} variant="filled" onClose={() => setAviso(null)}>{aviso.txt}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
