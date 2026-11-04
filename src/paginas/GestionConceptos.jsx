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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/context/BusinessContext';
import { GestionAPI } from '@/servicios/apiGestion';
import { CODIGO_MIN_LAZARILLO, TIPOS_CONCEPTO, esPropio, proximoCodigoLazarillo } from '@/gestion/cargaUtils';
import { rangosLibres, cantidadLibres, textoRango, libreDesde, MAX_CODIGO_CONCEPTO } from '@/gestion/codigosLibres';

const sxLabel = { display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 12, color: 'text.secondary' };
const sxOriginal = { fontSize: 11, color: 'text.disabled' };
const sxEtiqueta = (bg, color) => ({ borderRadius: 0.5, bgcolor: bg, color, px: 0.5, fontSize: 10, fontWeight: 600 });

function Buscador({ valor, opciones, placeholder, ancho, onCambio }) {
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

function Formulario({ inicial, proximo, rubros, conceptos, onCerrar, onGuardado, onAviso }) {
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
      onGuardado();
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

const Flecha = ({ abierta }) => <ExpandMoreIcon sx={{ fontSize: 16, flexShrink: 0, color: 'text.secondary', transition: 'transform .15s', transform: abierta ? 'none' : 'rotate(-90deg)' }} />;

export default function GestionConceptos() {
  const { activeBusinessId } = useBusiness() || {};
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['gestionConceptos', activeBusinessId],
    queryFn: () => GestionAPI.conceptos(),
    enabled: !!activeBusinessId,
    staleTime: 60_000,
  });
  const [desde, setDesde] = useState('');
  const [q, setQ] = useState('');
  const [libresAbierta, setLibresAbierta] = useState(false);
  const [rubrosAbiertos, setRubrosAbiertos] = useState(() => new Set());
  const [form, setForm] = useState(null);
  // Dónde se abre el formulario: arriba (null) o dentro de un rubro.
  const [formEn, setFormEn] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [aviso, setAviso] = useState(null);

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
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
  }, [conceptos, q]);

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
                {conRegistros && <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, color: 'text.secondary' }}><Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'grey.300' }} /> sin registros en el Panel</Box>}
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, color: 'text.secondary' }}><Box component="span" sx={sxEtiqueta('#e0f2fe', '#0369a1')}>LZ</Box> de Lazarillo (desde {CODIGO_MIN_LAZARILLO})</Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Button size="small" variant="contained" startIcon={<AddIcon />} disabled={sinRubros} onClick={() => nuevo()}>Nuevo concepto</Button>
                <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, concepto o rubro" sx={{ width: 256 }} />
              </Box>
            </Box>
            {sinRubros && <Box sx={{ px: 2, py: 1.5, fontSize: 13, color: 'text.secondary' }}>Esta organización todavía no tiene rubros: sin rubros no se pueden crear conceptos.</Box>}
            {form && formEn == null && formulario}
            <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              {grupos.map(([rubro, cs]) => {
                const abierto = q.trim() !== '' || rubrosAbiertos.has(rubro);
                const nSinUso = cs.filter(sinUso).length;
                return (
                  <Box key={rubro} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                        <Box component="span" sx={{ color: 'text.primary' }}>{rubro}</Box>
                        <Box component="span" sx={{ fontWeight: 400 }}>· {cs.length} concepto{cs.length === 1 ? '' : 's'}{nSinUso ? ` · ${nSinUso} sin registros` : ''}</Box>
                      </Box>
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
                          <Box key={c.codigo} title={sinUso(c) ? 'Sin registros en el Panel' : undefined} sx={{ display: 'flex', breakInside: 'avoid', alignItems: 'center', gap: 1.5, py: 0.25 }}>
                            <Box component="span" sx={{ width: 40, flexShrink: 0, textAlign: 'right', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{c.codigo}</Box>
                            <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(sinUso(c) ? { color: 'text.secondary' } : {}) }}>
                              {c.nombre}
                              {c.editado && c.original && <Box component="span" sx={{ ml: 0.75, ...sxOriginal }}>MaxiRest: {c.original.nombre}</Box>}
                            </Box>
                            {sinUso(c) && <Box component="span" sx={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%', bgcolor: 'grey.300' }} />}
                            <Box component="span" sx={{ ml: 'auto', display: 'flex', flexShrink: 0, alignItems: 'center', gap: 0.5 }}>
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
      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aviso ? <Alert severity={aviso.sev} variant="filled" onClose={() => setAviso(null)}>{aviso.txt}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
