// RecetaServicio.jsx — cuerpo de la receta cuando el artículo es un SERVICIO (Diego 20/11/2026).
// Un servicio no lleva insumos: su costo sale de Tu canasta del local (alquiler, sueldos, servicios) y de
// cuántas horas se usa. Dos tipos:
//   · ancla:    elige qué costos le tocan y calcula el costo de una hora (promedio de 12 meses de horas).
//   · atado:    elige una ancla y cuánto usa de su hora (93 % = Cancha 1; 3,7 horas = un cumple).
// El servidor (services/servicioCosto.js) hace la cuenta y graba el costo de toda la familia.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Checkbox, Select, MenuItem, Divider, Button, CircularProgress, Alert, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { BASE } from '@/servicios/apiBase';
import SelectorBuscable from '@/componentes/SelectorBuscable';

const CELESTE = '#5BC2EA';
const pesos = (x) => `$ ${Math.round(Number(x) || 0).toLocaleString('es-AR')}`;
const pctTxt = (x, d = 1) => `${(Number(x) || 0).toLocaleString('es-AR', { maximumFractionDigits: d })} %`;
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesesTxt = (ms = []) => {
  const n = ms.map((m) => MES[Number(String(m).slice(5, 7)) - 1]).filter(Boolean);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join('');
};
const num = (s) => Number(String(s ?? '').replace(/\./g, '').replace(',', '.'));

const th = { fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textAlign: 'center' };
const gris = { fontSize: 12, color: 'text.secondary' };
const valor = { height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 14, fontVariantNumeric: 'tabular-nums' };

function Titulo({ children }) {
  return (
    <Divider sx={{ mb: 1.5, mt: 0.5 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{children}</Typography>
    </Divider>
  );
}

/** Campo chico con la unidad adentro (regla de grillas: % adentro del campo, 40 px de alto). */
function CampoNumero({ value, onCommit, sufijo, deshabilitado, ancho = 110 }) {
  const [txt, setTxt] = useState('');
  useEffect(() => { setTxt(value == null ? '' : String(Math.round(value * 10) / 10).replace('.', ',')); }, [value]);
  return (
    <Box sx={{ width: ancho, height: 40, mx: 'auto', display: 'flex', alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.25, bgcolor: deshabilitado ? 'action.hover' : 'background.paper' }}>
      <Box component="input" inputMode="decimal" value={txt} disabled={deshabilitado}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => { const n = num(txt); if (Number.isFinite(n) && n !== value) onCommit(n); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        sx={{ all: 'unset', flex: 1, minWidth: 0, textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums', color: deshabilitado ? 'text.secondary' : 'text.primary' }} />
      <Box component="span" sx={{ ml: 0.5, fontSize: 13, color: 'text.secondary' }}>{sufijo}</Box>
    </Box>
  );
}

export default function RecetaServicio({ businessId, articulo, allArticulos = [], soloLectura = false, objetivoPct, onCosto }) {
  const articleId = Number(articulo?.id);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(null);
  const [calculo, setCalculo] = useState(null);
  const [anclas, setAnclas] = useState([]);
  const onCostoRef = useRef(onCosto);
  onCostoRef.current = onCosto;

  const pedir = useCallback(async (ruta, opts = {}) => {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${BASE}/businesses/${businessId}/servicios${ruta}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId), 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || json?.error || `Error ${res.status}`);
    return json;
  }, [businessId]);

  // Costo de ESTE artículo dentro de su familia (lo que va al pie de la receta).
  const costoPropio = useMemo(() => {
    const f = calculo?.familia?.find((x) => Number(x.articleId) === articleId);
    return f ? f.costo : null;
  }, [calculo, articleId]);
  useEffect(() => { onCostoRef.current?.(costoPropio); }, [costoPropio]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    Promise.all([pedir(`/${articleId}`), pedir('/anclas')])
      .then(([s, a]) => { if (!vivo) return; setConfig(s.config); setCalculo(s.calculo); setAnclas(a.anclas || []); })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [articleId, pedir]);

  const guardar = useCallback(async (nueva, artId = articleId, extra = {}) => {
    setGuardando(true); setError('');
    try {
      const r = await pedir(`/${artId}`, { method: 'PUT', body: JSON.stringify({ config: nueva, ...extra }) });
      if (artId === articleId) setConfig(r.config);
      if (r.calculo) setCalculo(r.calculo);
      if (r.config?.tipo === 'ancla' || artId !== articleId) setAnclas((await pedir('/anclas')).anclas || []);
      try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { /* sin tabla abierta */ }
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  }, [pedir, articleId]);

  const quitarDeFamilia = useCallback(async (artId) => {
    setGuardando(true); setError('');
    try {
      await pedir(`/${artId}`, { method: 'DELETE' });
      const s = await pedir(`/${articleId}`);
      setCalculo(s.calculo);
      try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { /* idem */ }
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  }, [pedir, articleId]);

  const nombreDe = useCallback((id) => {
    const a = (allArticulos || []).find((x) => Number(x.id ?? x.articulo_id) === Number(id));
    return a?.nombre || a?.name || `#${id}`;
  }, [allArticulos]);

  if (cargando) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={22} /></Box>;

  // ── Todavía no eligió qué tipo de servicio es ──
  if (!config) {
    return (
      <Box sx={{ mb: 2.5 }}>
        <Titulo>Servicio · sin insumos, el costo sale de tus costos del local</Titulo>
        {error && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Es una ancla</Typography>
            <Typography sx={{ ...gris, mb: 1.5 }}>La hora de referencia (ej. la hora pico de una cancha). Su costo sale de Tu canasta del local ÷ las horas que se usan.</Typography>
            <Button variant="outlined" disabled={soloLectura || guardando} onClick={() => guardar({ tipo: 'ancla' })}
              sx={{ height: 44, borderColor: CELESTE, color: '#0C447C' }}>Marcar como ancla</Button>
          </Box>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Sale de una ancla</Typography>
            <Typography sx={{ ...gris, mb: 1.5 }}>Vale un % de la hora de la ancla (93 %) o varias horas (un cumple = 3,7 horas).</Typography>
            {anclas.length ? (
              <Select size="small" value="" displayEmpty disabled={soloLectura || guardando} sx={{ height: 44, minWidth: 220 }}
                onChange={(e) => guardar({ tipo: 'derivado', ancla: Number(e.target.value), factor: 1 })}>
                <MenuItem value="" disabled>Elegí la ancla…</MenuItem>
                {anclas.filter((a) => a.articleId !== articleId).map((a) => (
                  <MenuItem key={a.articleId} value={a.articleId}>{a.nombre}</MenuItem>
                ))}
              </Select>
            ) : <Typography sx={{ ...gris, fontStyle: 'italic' }}>Todavía no hay ninguna ancla en este negocio: marcá primero la hora de referencia.</Typography>}
          </Box>
        </Box>
      </Box>
    );
  }

  // ── Servicio atado a una ancla ──
  if (config.tipo === 'derivado') {
    const esHoras = config.factor >= 1.5;
    const ancla = anclas.find((a) => a.articleId === config.ancla);
    const costoHora = calculo?.costoHora ?? ancla?.costoHora ?? 0;
    return (
      <Box sx={{ mb: 2.5 }}>
        <Titulo>Costo del servicio · atado a una ancla</Titulo>
        {error && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,1fr) 150px 150px' }, gap: '4px 12px', alignItems: 'center', px: 0.5 }}>
          <Typography sx={{ ...th, textAlign: 'left' }}>Ancla</Typography>
          <Typography sx={th}>Usa de la ancla</Typography>
          <Typography sx={th}>Costo</Typography>
          <Select size="small" value={config.ancla} disabled={soloLectura || guardando} sx={{ height: 40, fontSize: 14 }}
            onChange={(e) => guardar({ ...config, ancla: Number(e.target.value) })}>
            {anclas.filter((a) => a.articleId !== articleId).map((a) => <MenuItem key={a.articleId} value={a.articleId}>{a.nombre}</MenuItem>)}
          </Select>
          <CampoNumero value={esHoras ? config.factor : config.factor * 100} sufijo={esHoras ? 'h' : '%'} deshabilitado={soloLectura || guardando}
            onCommit={(n) => n > 0 && guardar({ ...config, factor: esHoras ? n : n / 100 })} />
          <Box sx={{ ...valor, justifyContent: 'center', fontWeight: 700 }}>{pesos(costoPropio ?? costoHora * config.factor)}</Box>
        </Box>
        <Typography sx={{ ...gris, mt: 1, px: 0.5 }}>
          Una hora de {ancla?.nombre || 'la ancla'} cuesta {pesos(costoHora)}. Este servicio usa {esHoras ? `${String(config.factor).replace('.', ',')} horas` : pctTxt(config.factor * 100)} de esa hora: el costo y el precio sugerido salen de ahí.
          {' '}Para cargarlo en horas, escribí un número mayor a 150 % (ej. 370 % = 3,7 horas).
        </Typography>
      </Box>
    );
  }

  // ── Ancla ──
  const c = calculo;
  const familiaSinAncla = (c?.familia || []).filter((f) => !f.ancla);
  const enFamilia = new Set((c?.familia || []).map((f) => Number(f.articleId)));
  const candidatos = (allArticulos || []).filter((a) => !enFamilia.has(Number(a.id ?? a.articulo_id)));
  const sugerido = (costo) => (objetivoPct > 0 ? costo / (objetivoPct / 100) : null);
  const caida = c?.horasUltimos3 != null && c.horas > 0 ? c.horasUltimos3 / c.horas - 1 : null;
  const gridC = { xs: '36px minmax(0,1fr) 110px', md: '36px minmax(160px,1fr) 140px 120px 150px' };
  return (
    <Box sx={{ mb: 2.5, opacity: guardando ? 0.7 : 1, transition: 'opacity .15s' }}>
      {error && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{error}</Alert>}
      {c?.sinDatos && (
        <Typography sx={{ ...gris, mb: 1.5, px: 0.5 }}>
          Todavía no hay ventas de este servicio o gastos cargados en Tu canasta para calcular. Se completa solo a medida que el POS manda ventas y se cargan los gastos del local.
        </Typography>
      )}

      <Titulo>Costo del servicio · sale de Tu canasta del local</Titulo>
      <Box sx={{ display: 'grid', gridTemplateColumns: gridC, gap: '4px 8px', alignItems: 'center', px: 0.5 }}>
        <span /><Typography sx={{ ...th, textAlign: 'left' }}>Costo de la canasta</Typography>
        <Typography sx={{ ...th, display: { xs: 'none', md: 'block' } }}>Por mes</Typography>
        <Typography sx={{ ...th, display: { xs: 'none', md: 'block' } }}>Para el servicio</Typography>
        <Typography sx={th}>Costo del servicio</Typography>
        {(c?.rubros || []).map((r) => (
          <React.Fragment key={r.clave}>
            <Checkbox size="small" checked={r.incluido} disabled={soloLectura || guardando}
              onChange={(e) => guardar({ ...config, incluir: { ...config.incluir, [r.clave]: e.target.checked } })}
              sx={{ p: 0.5, color: CELESTE, '&.Mui-checked': { color: CELESTE } }} />
            <Box sx={{ minWidth: 0, color: r.incluido ? 'text.primary' : 'text.disabled' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.nombre}</Typography>
              {r.propios.length > 0 && (
                <Typography sx={{ ...gris, fontSize: 11.5 }}>{r.propios.map((p) => p.nombre).join(', ')} al 100 %</Typography>
              )}
            </Box>
            <Box sx={{ ...valor, display: { xs: 'none', md: 'flex' }, color: r.incluido ? 'text.primary' : 'text.disabled' }}>{pesos(r.mensual)}</Box>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              {config.reparto === 'manual'
                ? <CampoNumero value={r.pct} sufijo="%" deshabilitado={soloLectura || guardando || !r.incluido}
                    onCommit={(n) => guardar({ ...config, pct: { ...config.pct, [r.clave]: n } })} />
                : <Box sx={{ ...valor, justifyContent: 'center', color: r.incluido ? 'text.primary' : 'text.disabled' }}>{r.incluido ? pctTxt(r.pct) : '—'}</Box>}
            </Box>
            <Box sx={{ ...valor, fontWeight: 700, color: r.incluido ? 'text.primary' : 'text.disabled' }}>{r.incluido ? pesos(r.asignado) : '—'}</Box>
          </React.Fragment>
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mt: 1, pt: 1, px: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={gris}>Lo compartido se reparte</Typography>
          <Select size="small" value={config.reparto} disabled={soloLectura || guardando} sx={{ height: 40, fontSize: 13 }}
            onChange={(e) => guardar({ ...config, reparto: e.target.value, pct: e.target.value === 'manual' && c
              ? Object.fromEntries(c.rubros.map((r) => [r.clave, Math.round(r.pct * 10) / 10])) : config.pct })}>
            <MenuItem value="ventas">por ventas ({pctTxt((c?.parteVentas || 0) * 100)} del local)</MenuItem>
            <MenuItem value="manual">a mano, rubro por rubro</MenuItem>
          </Select>
          <Box sx={{ minWidth: 220 }}>
            <SelectorBuscable label="Propio del servicio (al 100 %)" value={null} deshabilitado={soloLectura || guardando}
              opciones={(c?.conceptos || []).filter((x) => !config.propios.includes(String(x.codigo))).map((x) => `${x.nombre} · ${pesos(x.mensual)}`)}
              onChange={(txt) => {
                const elegido = (c?.conceptos || []).find((x) => `${x.nombre} · ${pesos(x.mensual)}` === txt);
                if (elegido) guardar({ ...config, propios: [...config.propios, String(elegido.codigo)] });
              }} />
          </Box>
          {config.propios.length > 0 && !soloLectura && (
            <Typography component="button" type="button" onClick={() => guardar({ ...config, propios: [] })}
              sx={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: 'text.secondary', textDecoration: 'underline' }}>quitar propios</Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: 14 }}>Total por mes <b style={{ marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{pesos(c?.costoMes)}</b></Typography>
      </Box>
      <Typography sx={{ ...gris, fontSize: 11.5, mt: 0.5, px: 0.5 }}>
        Promedio de los últimos 3 meses cerrados ({mesesTxt(c?.mesesCosto)}). «Por ventas» = lo que facturan esta ancla y sus servicios ÷ lo que factura el local en 12 meses.
      </Typography>

      <Box sx={{ mt: 2.5 }}><Titulo>Cuánto se usa</Titulo></Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0,1fr))' }, gap: 1.5 }}>
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 1.25, textAlign: 'center' }}>
          <Typography sx={th}>Horas por mes (promedio de 12)</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', my: 0.25 }}>{Math.round(c?.horas || 0).toLocaleString('es-AR')}</Typography>
          <Typography sx={{ ...gris, fontSize: 11.5, lineHeight: 1.3 }}>
            Lo que facturan los servicios de esta ancla ÷ su precio de cada mes{c && c.mesesConDatos < 12 ? ` · calculado con ${c.mesesConDatos} meses` : ''}
          </Typography>
        </Box>
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 1.25, textAlign: 'center' }}>
          <Typography sx={th}>Costo de una hora</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', my: 0.25 }}>{pesos(c?.costoHora)}</Typography>
          <Typography sx={{ ...gris, fontSize: 11.5 }}>{pesos(c?.costoMes)} ÷ {Math.round(c?.horas || 0).toLocaleString('es-AR')} horas</Typography>
        </Box>
        <Box sx={{ bgcolor: caida != null && caida < -0.1 ? '#fdecea' : 'action.hover', borderRadius: 1.5, p: 1.25, textAlign: 'center' }}>
          <Typography sx={th}>Últimos 3 meses</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', my: 0.25, color: caida != null && caida < -0.1 ? 'error.main' : 'text.primary' }}>
            {c?.horasUltimos3 != null ? `${Math.round(c.horasUltimos3).toLocaleString('es-AR')} h` : '—'}
          </Typography>
          <Typography sx={{ ...gris, fontSize: 11.5, lineHeight: 1.3 }}>
            {caida == null ? 'Sin datos' : caida < -0.1 ? `${pctTxt(caida * 100)} contra el año: no subas el precio, empujá la venta` : `${caida >= 0 ? '+' : ''}${pctTxt(caida * 100)} contra el promedio del año`}
          </Typography>
        </Box>
      </Box>

      {/* Desde el último aumento (parte 3): la hora sube lo mismo que suben los costos del servicio. */}
      <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, p: 1.25, px: 1.5, borderRadius: 1.5,
        border: '1px solid', borderColor: c?.vsBase?.suba >= 0.05 ? '#f5c4b3' : 'divider', bgcolor: c?.vsBase?.suba >= 0.05 ? '#fff7ed' : 'transparent' }}>
        <Box sx={{ minWidth: 0 }}>
          {c?.vsBase ? (
            <>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                Desde el aumento del {c.vsBase.desde.slice(8, 10)}/{c.vsBase.desde.slice(5, 7)}/{c.vsBase.desde.slice(2, 4)} tus costos {c.vsBase.suba >= 0 ? 'subieron' : 'bajaron'} {pctTxt(Math.abs((c.vsBase.suba || 0) * 100))}
                {c.vsBase.precioSugerido ? <> → hora a <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesos(Math.round(c.vsBase.precioSugerido / 100) * 100)}</span></> : null}
              </Typography>
              <Typography sx={{ ...gris, fontSize: 11.5 }}>
                {c.vsBase.suba >= 0.05 ? 'Pasaste el 5 %: es momento de actualizar la hora y los servicios atados se recalculan solos.' : 'Te avisamos en la campanita cuando acumulen 5 % (y en marzo, para revisar).'}
                {c.margen != null && c.vsBase.margenBase != null ? ` Margen hoy ${pctTxt(c.margen * 100)} (al aumentar: ${pctTxt(c.vsBase.margenBase * 100)}).` : ''}
              </Typography>
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Marcá el día que aumentás</Typography>
              <Typography sx={{ ...gris, fontSize: 11.5 }}>Desde ese día Lazarillo mide cuánto suben tus costos y te avisa a cuánto llevar la hora para sostener el margen.</Typography>
            </>
          )}
        </Box>
        {!soloLectura && (
          <Button variant="outlined" disabled={guardando} onClick={() => guardar(config, articleId, { tomarBase: true })}
            sx={{ height: 44, flexShrink: 0, borderColor: CELESTE, color: '#0C447C', textTransform: 'none', fontWeight: 700 }}>
            Aumenté hoy: tomar como base
          </Button>
        )}
      </Box>

      <Box sx={{ mt: 2.5 }}><Titulo>Servicios que salen de esta ancla ({familiaSinAncla.length})</Titulo></Box>
      {familiaSinAncla.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr) 100px 32px', md: 'minmax(160px,1fr) 130px 140px 140px 32px' }, gap: '6px 8px', alignItems: 'center', px: 0.5 }}>
          <Typography sx={{ ...th, textAlign: 'left' }}>Servicio</Typography>
          <Typography sx={th}>De la ancla</Typography>
          <Typography sx={{ ...th, display: { xs: 'none', md: 'block' } }}>Costo</Typography>
          <Typography sx={{ ...th, display: { xs: 'none', md: 'block' } }}>Sugerido ({pctTxt(objetivoPct, 1)} costo)</Typography>
          <span />
          {familiaSinAncla.map((f) => {
            const esHoras = f.factor >= 1.5;
            return (
              <React.Fragment key={f.articleId}>
                <Typography sx={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreDe(f.articleId) || f.nombre}</Typography>
                <CampoNumero value={esHoras ? f.factor : f.factor * 100} sufijo={esHoras ? 'h' : '%'} ancho={100} deshabilitado={soloLectura || guardando}
                  onCommit={(n) => n > 0 && guardar({ tipo: 'derivado', ancla: articleId, factor: esHoras ? n : n / 100 }, f.articleId)} />
                <Box sx={{ ...valor, display: { xs: 'none', md: 'flex' } }}>{pesos(f.costo)}</Box>
                <Box sx={{ ...valor, display: { xs: 'none', md: 'flex' }, fontWeight: 700 }}>{sugerido(f.costo) != null ? pesos(sugerido(f.costo)) : '—'}</Box>
                {soloLectura ? <span /> : (
                  <Tooltip title="Sacar de esta ancla (vuelve a ser producto)">
                    <IconButton size="small" onClick={() => quitarDeFamilia(f.articleId)} disabled={guardando}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
                  </Tooltip>
                )}
              </React.Fragment>
            );
          })}
        </Box>
      )}
      {!soloLectura && (
        <Box sx={{ mt: 1, px: 0.5, maxWidth: 360 }}>
          <SelectorBuscable label="+ Sumar servicio a esta ancla" value={null} deshabilitado={guardando}
            opciones={candidatos.map((a) => a.nombre || a.name).filter(Boolean)}
            onChange={(nombreElegido) => {
              const a = candidatos.find((x) => (x.nombre || x.name) === nombreElegido);
              if (a) guardar({ tipo: 'derivado', ancla: articleId, factor: 1 }, Number(a.id ?? a.articulo_id));
            }} />
        </Box>
      )}
      <Typography sx={{ ...gris, fontSize: 11.5, mt: 0.75, px: 0.5 }}>
        Cada servicio vale un % de la hora de la ancla (más de 150 % se toma como horas: 370 % = 3,7 horas). Cuando suben tus costos, sube la hora y todos se recalculan solos.
      </Typography>
    </Box>
  );
}
