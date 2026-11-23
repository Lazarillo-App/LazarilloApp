// RecetaServicio.jsx — cuerpo de la receta cuando el artículo es un SERVICIO (Diego 20/11/2026).
// Un servicio no lleva insumos: su costo sale de Tu canasta del local (alquiler, sueldos, servicios) y de
// cuántas horas se usa. Dos tipos:
//   · ancla:    elige qué costos le tocan y calcula el costo de una hora (promedio de 12 meses de horas).
//   · atado:    elige una ancla y cuánto usa de su hora (93 % = Cancha 1; 3,7 horas = un cumple).
// El servidor (services/servicioCosto.js) hace la cuenta y graba el costo de toda la familia.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Checkbox, Select, MenuItem, ListSubheader, Chip, Divider, Button, CircularProgress, Alert, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { BASE } from '@/servicios/apiBase';
import SelectorBuscable from '@/componentes/SelectorBuscable';
import { useBranch } from '@/hooks/useBranch';

const CELESTE = '#5BC2EA';
const pesos = (x) => `$ ${Math.round(Number(x) || 0).toLocaleString('es-AR')}`;
const pctTxt = (x, d = 1) => `${(Number(x) || 0).toLocaleString('es-AR', { maximumFractionDigits: d })} %`;
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesesTxt = (ms = []) => {
  const n = ms.map((m) => MES[Number(String(m).slice(5, 7)) - 1]).filter(Boolean);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join('');
};
const num = (s) => Number(String(s ?? '').replace(/\./g, '').replace(',', '.'));

// Horas y % de la hora de un servicio atado (Diego 23/11/2026: «hay que agregar cantidad: el colegio son
// 40 horas y se cobra el total»). Las configs viejas solo tienen factor: ≥ 1,5 eran horas, si no un %.
const horasYPct = (cfg) => {
  if (cfg?.horas > 0 && cfg?.pctHora > 0) return { horas: cfg.horas, pct: cfg.pctHora };
  const f = Number(cfg?.factor) || 0;
  return f >= 1.5 ? { horas: f, pct: 100 } : { horas: 1, pct: Math.round(f * 1000) / 10 };
};
const numTxt = (x) => String(Math.round((Number(x) || 0) * 10) / 10).replace('.', ',');

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
  const [verTodos, setVerTodos] = useState(false);
  const onCostoRef = useRef(onCosto);
  onCostoRef.current = onCosto;

  // Sucursal del chip del header (Diego 23/11/2026): cada sucursal con sus gastos y ventas; «Todas» suma.
  const { activeBranchFilter } = useBranch() || {};
  const sucursal = activeBranchFilter?.mode === 'main' ? 'main'
    : activeBranchFilter?.mode === 'branch' ? String(activeBranchFilter.branchId) : 'all';
  const pedir = useCallback(async (ruta, opts = {}) => {
    const token = localStorage.getItem('token') || '';
    const conSuc = ruta === '/anclas' ? ruta : `${ruta}${ruta.includes('?') ? '&' : '?'}sucursal=${encodeURIComponent(sucursal)}`;
    const res = await fetch(`${BASE}/businesses/${businessId}/servicios${conSuc}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId), 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || json?.error || `Error ${res.status}`);
    return json;
  }, [businessId, sucursal]);

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
      // La tabla de Artículos refresca el costo de toda la familia (Diego 23/11/2026: el Colegio
      // seguía en $ 11.744 y 0,3 % después de cargarle las horas).
      try {
        const ids = [...new Set([artId, articleId, ...((r.calculo?.familia || []).map((f) => Number(f.articleId)))])].filter(Boolean);
        window.dispatchEvent(new CustomEvent('servicio:costos', { detail: { ids } }));
      } catch { /* sin tabla abierta */ }
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  }, [pedir, articleId]);

  const quitarDeFamilia = useCallback(async (artId) => {
    setGuardando(true); setError('');
    try {
      await pedir(`/${artId}`, { method: 'DELETE' });
      const s = await pedir(`/${articleId}`);
      setCalculo(s.calculo);
      try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { /* idem */ }
      try { window.dispatchEvent(new CustomEvent('servicio:costos', { detail: { ids: [artId, articleId] } })); } catch { /* idem */ }
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
    const { horas, pct } = horasYPct(config);
    const ancla = anclas.find((a) => a.articleId === config.ancla);
    const costoHora = calculo?.costoHora ?? ancla?.costoHora ?? 0;
    const nomAncla = String(ancla?.nombre || 'la ancla').trim().replace(/\.$/, '');
    const nom = String(articulo?.nombre || 'este artículo').trim().replace(/\.$/, '');
    const guardarHP = (h, p) => guardar({ tipo: 'derivado', ancla: config.ancla, horas: h, pctHora: p });
    return (
      <Box sx={{ mb: 2.5 }}>
        <Titulo>Costo de {nom} · sale de la hora de {nomAncla}</Titulo>
        {error && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'minmax(0,1fr) 130px 130px 150px' }, gap: '4px 12px', alignItems: 'center', px: 0.5 }}>
          <Typography sx={{ ...th, textAlign: 'left', gridColumn: { xs: '1 / -1', sm: 'auto' } }}>Sale de</Typography>
          <Typography sx={{ ...th, display: { xs: 'none', sm: 'block' } }}>Horas</Typography>
          <Typography sx={{ ...th, display: { xs: 'none', sm: 'block' } }}>De cada hora</Typography>
          <Typography sx={{ ...th, display: { xs: 'none', sm: 'block' } }}>Costo</Typography>
          <Select size="small" value={config.ancla} disabled={soloLectura || guardando} sx={{ height: 40, fontSize: 14, gridColumn: { xs: '1 / -1', sm: 'auto' } }}
            onChange={(e) => guardar({ ...config, ancla: Number(e.target.value) })}>
            {anclas.filter((a) => a.articleId !== articleId).map((a) => <MenuItem key={a.articleId} value={a.articleId}>{a.nombre}</MenuItem>)}
          </Select>
          <CampoNumero value={horas} sufijo="h" deshabilitado={soloLectura || guardando} onCommit={(n) => n > 0 && guardarHP(n, pct)} />
          <CampoNumero value={pct} sufijo="%" deshabilitado={soloLectura || guardando} onCommit={(n) => n > 0 && guardarHP(horas, n)} />
          <Box sx={{ ...valor, justifyContent: 'center', fontWeight: 700, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>{pesos(costoPropio ?? costoHora * horas * pct / 100)}</Box>
        </Box>
        <Typography sx={{ ...gris, mt: 1, px: 0.5 }}>
          Una hora de {nomAncla} cuesta {pesos(costoHora)}. {nom} {horas === 1 ? 'es 1 hora' : `son ${numTxt(horas)} horas`}{pct !== 100 ? ` y cada una vale el ${numTxt(pct)} % de la de ${nomAncla}` : ''}: {pesos(costoHora)} × {numTxt(horas)}{pct !== 100 ? ` × ${numTxt(pct)} %` : ''} = {pesos(costoHora * horas * pct / 100)}. El precio sugerido sale de ahí.
        </Typography>
      </Box>
    );
  }

  // ── Ancla ──
  const c = calculo;
  const familiaSinAncla = (c?.familia || []).filter((f) => !f.ancla);
  const enFamilia = new Set((c?.familia || []).map((f) => Number(f.articleId)));
  // Sumar servicios (Diego 23/11/2026: «toma todo, insumos y conceptos, no los diferencia»): de
  // entrada solo los artículos del mismo rubro que la ancla (primera palabra de su rubro o subrubro:
  // «Canchas.», «Canchas promos.», «Alquileres grandes»…); «ver todos» abre la lista completa.
  const palabra = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[a-z0-9ñ]+/)?.[0] || '';
  const yo = (allArticulos || []).find((x) => Number(x.id ?? x.articulo_id) === articleId);
  const claves = new Set([palabra(yo?.categoria), palabra(yo?.subrubro)].filter((x) => x.length > 2));
  const todosCand = (allArticulos || []).filter((a) => !enFamilia.has(Number(a.id ?? a.articulo_id)));
  const delRubro = todosCand.filter((a) => claves.has(palabra(a.categoria)) || claves.has(palabra(a.subrubro)));
  const candidatos = verTodos || !delRubro.length ? todosCand : delRubro;
  const rubroAncla = yo?.categoria ? String(yo.categoria).replace(/\.$/, '') : null;
  const sugerido = (costo) => (objetivoPct > 0 ? costo / (objetivoPct / 100) : null);
  // Diego 23/11/2026: «"este servicio" se confunde con los servicios que integran su costo»: se nombra
  // al artículo (Cancha 3) en vez de decir «el servicio».
  const nom = String(articulo?.nombre || yo?.nombre || 'este artículo').trim().replace(/\.$/, '');
  const conAtados = familiaSinAncla.length;
  const pesoTxt = pctTxt((c?.parteVentas || 0) * 100);
  const caida = c?.horasUltimos3 != null && c.horas > 0 ? c.horasUltimos3 / c.horas - 1 : null;
  const gridC = { xs: '36px minmax(0,1fr) 110px', md: '36px minmax(160px,1fr) 140px 120px 150px' };
  return (
    <Box sx={{ mb: 2.5, opacity: guardando ? 0.7 : 1, transition: 'opacity .15s' }}>
      {error && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{error}</Alert>}
      {c?.sinDatos && (
        <Typography sx={{ ...gris, mb: 1.5, px: 0.5 }}>
          Todavía no hay ventas de {nom} o gastos cargados en Tu canasta para calcular. Se completa solo a medida que el POS manda ventas y se cargan los gastos del local.
        </Typography>
      )}

      <Titulo>Costo de {nom} · {c?.sucursal === 'all' && (c?.sucursales?.length || 0) > 1 ? `todas las sucursales (${c.sucursales.map((x) => x.nombre).join(' + ')})` : (c?.sucursalNombre || 'sale de Tu canasta del local')}</Titulo>
      {/* Diego 23/11/2026: «no entiendo "para el servicio 10,4 %" ni el total por mes». Cada fila dice
          cuánto gasta el local, qué parte le toca a este servicio y cuánto es; el total va adentro de
          la tabla, abajo de su columna, y la frase de abajo explica de dónde sale el %. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: gridC, gap: '4px 8px', alignItems: 'center', px: 0.5 }}>
        <span /><Typography sx={{ ...th, textAlign: 'left' }}>Gasto del local</Typography>
        <Typography sx={{ ...th, display: { xs: 'none', md: 'block' } }}>Gasta el local por mes</Typography>
        <Typography sx={{ ...th, display: { xs: 'none', md: 'block' } }}>Le toca a {nom}</Typography>
        <Typography sx={th}>Costo para {nom}</Typography>
        {(c?.rubros || []).map((r) => (
          <React.Fragment key={r.clave}>
            <Checkbox size="small" checked={r.incluido} disabled={soloLectura || guardando}
              onChange={(e) => guardar({ ...config, incluir: { ...config.incluir, [r.clave]: e.target.checked } })}
              sx={{ p: 0.5, color: CELESTE, '&.Mui-checked': { color: CELESTE } }} />
            <Box sx={{ minWidth: 0, color: r.incluido ? 'text.primary' : 'text.disabled' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.nombre}</Typography>
                {/* Alquiler de otro PDV (Diego 23/11/2026): una sucursal puede tomar el alquiler de otra
                    (San Justo cobra como si pagara el de Ramos). */}
                {r.clave === 'alquiler' && c?.sucursal !== 'all' && (c?.sucursales?.length || 0) > 1 && (
                  <Select size="small" value={c.alquilerDe || c.sucursal} disabled={soloLectura || guardando}
                    renderValue={(v) => (v === c.sucursal ? 'de esta sucursal' : `de ${c.sucursales.find((x) => x.key === v)?.nombre || v}`)}
                    onChange={(e) => {
                      const v = String(e.target.value);
                      const alq = { ...(config.alquilerDe || {}) };
                      if (v === c.sucursal) delete alq[c.sucursal]; else alq[c.sucursal] = v;
                      guardar({ ...config, alquilerDe: alq });
                    }}
                    sx={{ height: 30, fontSize: 12, color: '#2492C8', '& .MuiSelect-select': { py: 0.25 } }}>
                    {c.sucursales.map((x) => (
                      <MenuItem key={x.key} value={x.key} sx={{ fontSize: 13 }}>{x.key === c.sucursal ? 'De esta sucursal' : `Usar el de ${x.nombre}`}</MenuItem>
                    ))}
                  </Select>
                )}
              </Box>
              {r.propios.length > 0 && r.incluido && (
                <Typography sx={{ ...gris, fontSize: 11.5 }}>incluye {r.propios.map((p) => p.nombre).join(', ')} entero</Typography>
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
        <Box sx={{ gridColumn: '1 / -1', borderTop: '1px solid', borderColor: 'divider', mt: 0.5 }} />
        <span />
        <Typography sx={{ fontSize: 14, fontWeight: 700, gridColumn: { xs: '2 / 3', md: '2 / 5' } }}>Costo de {nom} por mes</Typography>
        <Box sx={{ ...valor, fontWeight: 800, fontSize: 15 }}>{pesos(c?.costoMes)}</Box>
      </Box>
      {c?.sucursal === 'all' && (c?.porSucursal?.length || 0) > 1 && (
        <Typography sx={{ ...gris, fontSize: 11.5, mt: 0.5, px: 0.5 }}>
          {c.porSucursal.map((p) => `${p.nombre}: ${pesos(p.costoMes)} (${Math.round(p.horas)} h, ${pesos(p.costoHora)} la hora)`).join(' · ')}. Elegí una sucursal arriba para ver o cambiar la suya.
        </Typography>
      )}

      {/* Dos filas con la misma grilla (Diego 23/11/2026: alinear «según lo que vende» y «+ Agregar
          gasto»): título a la izquierda en una columna fija y el desplegable del mismo ancho. */}
      <Box sx={{ mt: 1.5, px: 0.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '260px 300px minmax(0,1fr)' }, columnGap: 1.5, rowGap: 0.75, alignItems: 'center' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Cómo se reparten los gastos</Typography>
        <Select size="small" value={config.reparto} disabled={soloLectura || guardando} sx={{ height: 40, fontSize: 13, width: { xs: '100%', sm: 300 } }}
          onChange={(e) => guardar({ ...config, reparto: e.target.value, pct: e.target.value === 'manual' && c
            ? Object.fromEntries(c.rubros.map((r) => [r.clave, Math.round(r.pct * 10) / 10])) : config.pct })}>
          <MenuItem value="ventas">según su peso en las ventas ({pesoTxt})</MenuItem>
          <MenuItem value="manual">a mano, gasto por gasto</MenuItem>
        </Select>
        <span />
        <Typography sx={{ ...gris, fontSize: 11.5, gridColumn: '1 / -1', mb: 0.75 }}>
          {config.reparto === 'manual'
            ? `Escribí en cada gasto qué parte le toca a ${nom}.`
            : `${conAtados ? `${nom} y los ${conAtados} que salen de ella facturan` : `${nom} factura`} el ${pesoTxt} de todo lo que vende el local en los últimos 12 meses: ese es su peso, y por eso se lleva el ${pesoTxt} de cada gasto (el mismo % en los tres). Si un gasto le toca distinto, elegí «a mano».`}
          {' '}Los gastos son el promedio de {mesesTxt(c?.mesesCosto)}.
        </Typography>

        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Gastos que son solo de {nom}</Typography>
        {soloLectura ? <span /> : (
          <Select size="small" value="" displayEmpty disabled={guardando} sx={{ height: 40, fontSize: 13, width: { xs: '100%', sm: 300 } }}
            renderValue={() => <span style={{ color: '#2492C8', fontWeight: 600 }}>+ Agregar gasto</span>}
            MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
            onChange={(e) => e.target.value && guardar({ ...config, propios: [...config.propios, String(e.target.value)] })}>
            {['alquiler', 'sueldos', 'servicios'].flatMap((rub) => {
              const items = (c?.conceptos || []).filter((x) => x.rubro === rub && !config.propios.includes(String(x.codigo)));
              if (!items.length) return [];
              return [
                <ListSubheader key={`h-${rub}`} sx={{ lineHeight: '30px', fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>
                  {(c?.rubros || []).find((r) => r.clave === rub)?.nombre || rub}
                </ListSubheader>,
                ...items.map((x) => (
                  <MenuItem key={x.codigo} value={String(x.codigo)} sx={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <span>{x.nombre}</span><span style={{ color: '#8a93a3', fontVariantNumeric: 'tabular-nums' }}>{pesos(x.mensual)}</span>
                  </MenuItem>
                )),
              ];
            })}
          </Select>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {(c?.conceptos || []).filter((x) => config.propios.includes(String(x.codigo))).map((x) => (
            <Chip key={x.codigo} label={`${x.nombre} · ${pesos(x.mensual)}`}
              onDelete={soloLectura || guardando ? undefined : () => guardar({ ...config, propios: config.propios.filter((p) => p !== String(x.codigo)) })}
              sx={{ height: 32, bgcolor: '#E6F6FC', fontSize: 12.5 }} />
          ))}
        </Box>
        <Typography sx={{ ...gris, fontSize: 11.5, gridColumn: '1 / -1' }}>
          Un gasto que es solo de {nom} (el césped, una cámara) entra entero en su costo, no repartido.
        </Typography>
      </Box>

      <Box sx={{ mt: 2.5 }}><Titulo>Cuánto se usa</Titulo></Box>
      {/* Diego 23/11/2026: el costo de una hora ya está en el pie (Costo total) y los últimos 3 meses
          van como línea debajo de las horas. */}
      <Box sx={{ bgcolor: caida != null && caida < -0.1 ? '#fdecea' : 'action.hover', borderRadius: 1.5, p: 1.25, textAlign: 'center', maxWidth: 420, mx: 'auto' }}>
        <Typography sx={th}>Horas por mes (promedio de 12 meses)</Typography>
        <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', my: 0.25 }}>{Math.round(c?.horas || 0).toLocaleString('es-AR')}</Typography>
        <Typography sx={{ ...gris, fontSize: 11.5, lineHeight: 1.3, color: caida != null && caida < -0.1 ? 'error.main' : 'text.secondary' }}>
          {c?.horasUltimos3 != null
            ? `Últimos 3 meses: ${Math.round(c.horasUltimos3).toLocaleString('es-AR')} h (${caida >= 0 ? '+' : ''}${pctTxt((caida || 0) * 100)})${caida != null && caida < -0.1 ? ' · no subas el precio, empujá la venta' : ''}`
            : 'Lo que facturan esta ancla y los que salen de ella ÷ su precio de cada mes'}
          {c && c.mesesConDatos < 12 ? ` · calculado con ${c.mesesConDatos} meses` : ''}
        </Typography>
      </Box>

      {/* Último aumento (Diego 23/11/2026): Lazarillo lo detecta solo en las ventas de la hora; ya no
          hace falta marcarlo. El próximo también se toma solo cuando cambia el precio en el POS. */}
      <Box sx={{ mt: 1.5, p: 1.25, px: 1.5, borderRadius: 1.5,
        border: '1px solid', borderColor: c?.vsBase?.suba >= 0.05 ? '#f5c4b3' : 'divider', bgcolor: c?.vsBase?.suba >= 0.05 ? '#fff7ed' : 'transparent' }}>
        {c?.vsBase ? (
          <>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
              Último aumento: {`${c.vsBase.desde.slice(8, 10)}/${c.vsBase.desde.slice(5, 7)}/${c.vsBase.desde.slice(2, 4)}`}
              {c.vsBase.precioAntes && c.vsBase.precioBase ? <span style={{ fontWeight: 500 }}> ({pesos(c.vsBase.precioAntes)} → {pesos(c.vsBase.precioBase)})</span> : null}
              {' · '}desde entonces tus costos {c.vsBase.suba >= 0 ? 'subieron' : 'bajaron'} {pctTxt(Math.abs((c.vsBase.suba || 0) * 100))}
              {c.vsBase.precioSugerido ? <> → la hora a <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesos(Math.round(c.vsBase.precioSugerido / 100) * 100)}</span></> : null}
            </Typography>
            <Typography sx={{ ...gris, fontSize: 11.5 }}>
              {c.vsBase.detectado ? 'Lo vimos en las ventas: es el día que la hora empezó a cobrarse al precio nuevo. ' : ''}
              {c.vsBase.suba >= 0.05 ? 'Pasaste el 5 %: es momento de actualizar la hora; los servicios atados se recalculan solos.' : 'Te avisamos en la campanita cuando acumulen 5 % (y en marzo, para revisar).'}
              {c.margen != null && c.vsBase.margenBase != null ? ` Margen hoy ${pctTxt(c.margen * 100)} (al aumentar: ${pctTxt(c.vsBase.margenBase * 100)}).` : ''}
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Todavía no vimos un aumento en las ventas de esta hora</Typography>
            <Typography sx={{ ...gris, fontSize: 11.5 }}>Cuando cambies el precio en tu POS lo tomamos solo, y desde ese día medimos cuánto suben tus costos y te avisamos a cuánto llevar la hora.</Typography>
          </>
        )}
      </Box>

      <Box sx={{ mt: 2.5 }}><Titulo>Artículos que salen de {nom} ({familiaSinAncla.length})</Titulo></Box>
      {familiaSinAncla.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr) 160px 32px', md: 'minmax(160px,1fr) 170px 140px 140px 32px' }, gap: '6px 8px', alignItems: 'center', px: 0.5 }}>
          <Typography sx={{ ...th, textAlign: 'left' }}>Artículo</Typography>
          <Typography sx={th}>Horas × % de la hora</Typography>
          <Typography sx={{ ...th, display: { xs: 'none', md: 'block' } }}>Costo</Typography>
          <Typography sx={{ ...th, display: { xs: 'none', md: 'block' } }}>Sugerido ({pctTxt(objetivoPct, 1)} costo)</Typography>
          <span />
          {familiaSinAncla.map((f) => {
            const hp = horasYPct(f);
            return (
              <React.Fragment key={f.articleId}>
                <Typography sx={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreDe(f.articleId) || f.nombre}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                  <CampoNumero value={hp.horas} sufijo="h" ancho={72} deshabilitado={soloLectura || guardando}
                    onCommit={(n) => n > 0 && guardar({ tipo: 'derivado', ancla: articleId, horas: n, pctHora: hp.pct }, f.articleId)} />
                  <CampoNumero value={hp.pct} sufijo="%" ancho={80} deshabilitado={soloLectura || guardando}
                    onCommit={(n) => n > 0 && guardar({ tipo: 'derivado', ancla: articleId, horas: hp.horas, pctHora: n }, f.articleId)} />
                </Box>
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
          <SelectorBuscable label={!verTodos && delRubro.length && rubroAncla ? `+ Sumar artículo de ${rubroAncla}` : `+ Sumar artículo a ${nom}`} value={null} deshabilitado={guardando}
            opciones={candidatos.map((a) => a.nombre || a.name).filter(Boolean)}
            onChange={(nombreElegido) => {
              const a = candidatos.find((x) => (x.nombre || x.name) === nombreElegido);
              if (a) guardar({ tipo: 'derivado', ancla: articleId, factor: 1 }, Number(a.id ?? a.articulo_id));
            }} />
        </Box>
      )}
      {!soloLectura && delRubro.length > 0 && delRubro.length < todosCand.length && (
        <Typography component="button" type="button" onClick={() => setVerTodos((v) => !v)}
          style={{ all: 'unset', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2492C8', marginTop: 4, marginLeft: 4 }}>
          {verTodos ? `Ver solo los de ${rubroAncla || 'su rubro'}` : 'Ver todos los artículos'}
        </Typography>
      )}
      <Typography sx={{ ...gris, fontSize: 11.5, mt: 0.75, px: 0.5 }}>
        Cada uno es una cantidad de horas (el colegio, 40 h) por el % que vale cada hora contra la de {nom} (una promo, 80 %). Cuando suben tus costos, sube la hora y todos se recalculan solos.
      </Typography>
    </Box>
  );
}
