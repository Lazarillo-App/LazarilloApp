// src/paginas/PlazaPage.jsx — /plaza/:id: la vista «diseño» de una plaza de despacho (Diego 11/11/2026).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import EditorPlaza from '@/componentes/plazas/EditorPlaza';
import VincularTV from '@/componentes/plazas/VincularTV';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import { Box, Typography, Button, CircularProgress, Alert, Stack, Snackbar, ToggleButtonGroup, ToggleButton } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import VistaPlaza from '@/componentes/plazas/VistaPlaza';
import { PLAZAS_EJEMPLO } from '@/componentes/plazas/ejemploPlaza';
import { PlazasAPI } from '@/servicios/apiPlazas';
import { useBusiness } from '@/context/BusinessContext';
import RecetaModal from '@/componentes/RecetaModal';
import { useOrganization } from '@/context/OrganizationContext';
import { BASE } from '@/servicios/apiBase';
import SpotlightTour from '@/componentes/SpotlightTour';
import { usePasosHeader, usePasosPresentes } from '@/componentes/asistente/pasosHeader';
import { useSectorGuia } from '@/componentes/asistente/guias';
import { useRecorrido } from '@/hooks/useRecorrido';

// Guía de Tableros (Diego 15/11/2026: «tableros no tiene guía»). Una sola guía para las dos
// pantallas: sin plazas (ejemplo + primer paso) y la plaza. Sectores: Tablero y Header.
function GuiaTableros({ pasos, activo, sinDatos, clave = '' }) {
  const pasosHeader = usePasosHeader();
  const sector = useSectorGuia('tableros');
  const presentes = usePasosPresentes(pasos, pasos.map((p) => p.k).join() + clave);
  const todos = presentes.concat(pasosHeader).filter((p) => !sector || p.s === sector);
  const rec = useRecorrido('tableros', todos.length, activo && presentes.length > 0, { sinDatos });
  const paso = todos[rec.paso - 1];
  if (!rec.visible || !paso) return null;
  return <SpotlightTour key={paso.k} targetRef={paso.ref} pose={rec.paso === 1 ? 'presenta' : 'senala'}
    placement={paso.arriba ? 'top' : 'bottom'} text={paso.t} {...rec.props(rec.paso)} />;
}
// La primera tarjeta del tablero (el primer producto).
const primeraTarjeta = { get current() { return document.querySelector('[data-tour="tab-vista"] > div > div'); } };

// Lo que se guarda de cada tarjeta: orden de todos los renglones, ocultos y extras.
const fichaDe = (renglones) => ({
  orden: renglones.map((r) => r.key),
  ocultos: renglones.filter((r) => r.oculto && !r.extra).map((r) => r.key),
  extras: renglones.filter((r) => r.extra).map((r) => ({ id: r.key, texto: r.nombre, color: r.color })),
});

// /tableros: entra a la primera plaza; si no hay, lo dice (y deja crear si se puede).
export function TablerosInicio() {
  const { activeId } = useBusiness() || {};
  const [t, setT] = useState(null);
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState(null);
  const [conReceta, setConReceta] = useState(null); // productos con receta del negocio (dato real del primer paso)
  const [ej, setEj] = useState(0); // qué tablero de ejemplo se muestra
  useEffect(() => { setT(null); PlazasAPI.tablero().then(setT).catch(() => setT({ plazas: [], puedeCrear: false, sectores: [] })); }, [activeId]);
  useEffect(() => {
    if (!t || t.plazas.length) return;
    PlazasAPI.articulos().then((r) => setConReceta(r.articulos.length)).catch(() => setConReceta(null));
  }, [t]);
  if (nueva) return <Navigate to={`/tableros/${nueva}`} replace />;
  if (!t) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={26} /></Stack>;
  if (t.plazas.length) return <Navigate to={`/tableros/${t.plazas[0].id}`} replace />;
  // Sin plazas (negocio nuevo): tarjeta del primer paso + tableros de EJEMPLO atenuados que no se
  // pueden tocar y no se guardan (regla del proyecto para pantallas vacías). Se ve el diseño real
  // de la lámina —colores, pesos, observaciones— para que se entienda qué se va a armar.
  const ejemplo = PLAZAS_EJEMPLO[ej];
  return (
    <Box sx={{ px: 2, py: 2, bgcolor: '#fff', minHeight: '100%' }}>
      <GuiaTableros activo={!creando} sinDatos pasos={[
        { k: 'tab-primer-paso', s: 'tablero', t: t.puedeCrear
          ? <>Una <b>plaza</b> es un puesto de despacho: un sector de la cocina o de la barra. Con <b>+ Crear plaza</b> armás la primera y elegís sus productos.</>
          : <>Una <b>plaza</b> es un puesto de despacho: un sector de la cocina o de la barra. Las crea el jefe de cocina, un encargado o el dueño.</> },
        { k: 'tab-ejemplos', s: 'tablero', t: <>Mirá los <b>ejemplos</b>: cada uno es el tablero de una plaza distinta.</> },
        { k: 'tab-ejemplo', s: 'tablero', arriba: true, t: <>Así se ve un tablero: cada producto con sus ingredientes, cantidades y colores. Sale de tus <b>recetas</b>: no cargás nada dos veces.</> },
      ]} />
      <Box data-tour="tab-primer-paso" sx={{ maxWidth: 720, mx: 'auto', mb: 3, p: 2.5, borderRadius: 2, border: '1px solid #5BC2EA', bgcolor: 'rgba(91,194,234,.06)', textAlign: 'center' }}>
        <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>Armá tu primera plaza</Typography>
        <Typography color="text.secondary" sx={{ fontSize: '0.9rem', mt: 0.75, mb: 1.5 }}>
          Una plaza es un puesto de despacho: un sector de la cocina o de la barra (Ensaladas, Freidora, Frozen). Su tablero es la lámina de armado de sus productos, para que la comunicación no falle.
        </Typography>
        {t.puedeCrear
          ? <Button variant="contained" disableElevation onClick={() => setCreando(true)} sx={{ height: 36 }}>+ Crear plaza</Button>
          : <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Las plazas las crea el dueño, un admin o el jefe de cocina de su sector.</Typography>}
        {conReceta != null && (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 1 }}>
            {conReceta > 0
              ? `Tenés ${conReceta} producto${conReceta === 1 ? '' : 's'} con receta listo${conReceta === 1 ? '' : 's'} para sumar.`
              : 'Primero cargá la receta de tus productos en Recetas › Artículos: la plaza los muestra tal cual.'}
          </Typography>
        )}
      </Box>
      <Stack data-tour="tab-ejemplos" direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box component="span" sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: 'text.secondary', border: '1px solid #d8dde6', borderRadius: 1, px: 1, py: 0.25 }}>EJEMPLO</Box>
        {PLAZAS_EJEMPLO.map((pz, i) => (
          <Box key={pz.nombre} component="button" type="button" onClick={() => setEj(i)}
            sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: i === ej ? 700 : 500, color: i === ej ? 'text.primary' : 'text.secondary', px: 0.5, borderBottom: i === ej ? '2px solid #5BC2EA' : '2px solid transparent' }}>
            {pz.nombre}
          </Box>
        ))}
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>· {ejemplo.sector} · así se ve un tablero, no se guarda</Typography>
      </Stack>
      <Box data-tour="tab-ejemplo" aria-hidden sx={{ opacity: 0.85, pointerEvents: 'none', userSelect: 'none' }}>
        <VistaPlaza productos={ejemplo.productos} />
      </Box>
      <EditorPlaza abierto={creando} sectores={t.sectores} puedeCrearSector={t.puedeCrearSector} onCerrar={() => setCreando(false)}
        onGuardado={(id) => { setCreando(false); if (id) setNueva(id); }} />
    </Box>
  );
}
// Atajo viejo /plaza/:id → /tableros/:id
export function PlazaViejaRedirect() {
  const { id } = useParams();
  return <Navigate to={`/tableros/${id}`} replace />;
}

export default function PlazaPage() {
  const { id } = useParams();
  const { activeId } = useBusiness() || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [armando, setArmando] = useState(false);
  const [receta, setReceta] = useState(null); // { id, nombre } del producto abierto
  const [insumoEq, setInsumoEq] = useState(null); // { id, nombre, articleId }: «+ Crear equivalencia»
  const [aviso, setAviso] = useState('');
  const [quitado, setQuitado] = useState(null); // { producto, idx }: el último quitado, para «Deshacer»
  const [sumando, setSumando] = useState(false); // «+ Productos»: el editor de la plaza
  const [tv, setTv] = useState(false);           // «TV»: vincular la pantalla de la cocina
  // Negocio donde viven los insumos (el principal de la organización), igual que InsumosMain.
  const { rootBusiness, organization } = useOrganization() || {};
  const enOrg = (organization?.businesses || []).some((b) => String(b.id) === String(activeId));
  const insumosBizId = rootBusiness?.id && enOrg ? String(rootBusiness.id) : activeId;

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await PlazasAPI.vista(id)); } catch (e) { setError(e.message); }
  }, [id]);
  // Al cambiar de negocio, la plaza abierta es del negocio anterior (daba «not_found», Diego 12/11/2026):
  // se vuelve a /tableros, que entra a la primera plaza del negocio nuevo.
  const negocioInicial = useRef(activeId);
  if (negocioInicial.current == null && activeId != null) negocioInicial.current = activeId;
  const cambioNegocio = negocioInicial.current != null && activeId != null && String(activeId) !== String(negocioInicial.current);
  useEffect(() => { if (cambioNegocio) return; setData(null); setArmando(false); cargar(); }, [cargar, activeId, cambioNegocio]);

  // Se actualiza al toque en pantalla y se guarda atrás (sin recargar la plaza).
  const cambiar = async (articleId, renglones) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => (p.articleId === articleId ? { ...p, renglones } : p)) }));
    try { await PlazasAPI.guardarFicha(id, articleId, fichaDe(renglones)); } catch (e) { setError(e.message); }
  };
  // Peso / observación / ambos: lo pone la plaza para todos (Diego 14/11/2026: «debe ser global de la plaza y
  // después, si quiero, gestiono individualmente»). Cambia al toque los renglones que siguen a la plaza.
  const mostrarDePlaza = async (mostrar) => {
    setData((d) => ({ ...d, plaza: { ...d.plaza, mostrar },
      productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.extra || r.mostrarPropio ? r : { ...r, mostrar })) })) }));
    try { await PlazasAPI.mostrar(id, mostrar); } catch (e) { setError(e.message); cargar(); }
  };
  // Excepción de un ingrediente (vale en todas las tarjetas, como el color); 'plaza' se la saca.
  const mostrarIngrediente = async (ref, mostrar) => {
    const vista = mostrar === 'plaza' ? { mostrar: data.plaza.mostrar || 'peso', mostrarPropio: false } : { mostrar, mostrarPropio: true };
    setData((d) => ({ ...d, productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.ref === ref ? { ...r, ...vista } : r)) })) }));
    try { await PlazasAPI.guardarColor(ref, undefined, mostrar); } catch (e) { setError(e.message); }
  };
  // Ojito: el ingrediente queda «Oculto» en todas sus recetas (no solo en esta plaza).
  const ocultarIngrediente = async (ref, oculto) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.ref === ref ? { ...r, oculto } : r)) })) }));
    try {
      const r = await PlazasAPI.ocultar(id, ref, oculto);
      if (r?.renglones > 1) setAviso(`${oculto ? 'Oculto' : 'Visible'} en ${r.renglones} recetas`);
    } catch (e) { setError(e.message); }
  };
  // Alias: solo cambia cómo se ve el ingrediente en las plazas (no la receta).
  const aliasIngrediente = async (ref, alias) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.ref === ref ? { ...r, alias } : r)) })) }));
    try { await PlazasAPI.guardarColor(ref, undefined, undefined, alias); } catch (e) { setError(e.message); }
  };
  const colorIngrediente = async (ref, color) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.ref === ref ? { ...r, color } : r)) })) }));
    try { await PlazasAPI.guardarColor(ref, color); } catch (e) { setError(e.message); }
  };

  // ✕ en la tarjeta (modo Armar): sale de la plaza al toque y se guarda atrás; «Deshacer» lo vuelve a
  // poner en el mismo lugar. Su ficha (orden, colores, renglones extra) queda guardada en el servidor.
  const guardarProductos = async (productos) => {
    await PlazasAPI.editar(id, data.plaza.nombre, productos.map((x) => Number(x.articleId)));
    try { window.dispatchEvent(new CustomEvent('plazas:changed')); } catch { /* sin evento */ }
  };
  const quitarProducto = async (prod) => {
    const idx = data.productos.findIndex((x) => x.articleId === prod.articleId);
    const resto = data.productos.filter((x) => x.articleId !== prod.articleId);
    setData((d) => ({ ...d, productos: resto }));
    setQuitado({ producto: prod, idx });
    try { await guardarProductos(resto); } catch (e) { setError(e.message); setQuitado(null); cargar(); }
  };
  const deshacerQuitar = async () => {
    const q = quitado;
    setQuitado(null);
    if (!q) return;
    const lista = [...data.productos];
    lista.splice(Math.min(q.idx, lista.length), 0, q.producto);
    setData((d) => ({ ...d, productos: lista }));
    try { await guardarProductos(lista); } catch (e) { setError(e.message); cargar(); }
  };

  // Después de guardar la receta se refresca SOLO esa tarjeta (no la plaza entera).
  const refrescarProducto = async (articleId) => {
    try {
      const r = await PlazasAPI.vista(id, articleId);
      const nuevo = r?.productos?.[0];
      if (nuevo) setData((d) => ({ ...d, productos: d.productos.map((p) => (p.articleId === articleId ? nuevo : p)) }));
    } catch (e) { setError(e.message); }
  };

  // «En esta receta»: guarda cantidad / unidad / observación de un ingrediente y refresca solo esa tarjeta.
  const editarItem = async (articleId, datos) => {
    try {
      const r = await PlazasAPI.editarItem(id, articleId, datos);
      if (r.pending) setAviso('Quedó como propuesta: se aplica cuando la aprueben');
      else { setAviso('Guardado en la receta'); await refrescarProducto(articleId); }
      return true;
    } catch (e) { setError(e.message); return false; }
  };

  if (cambioNegocio) return <Navigate to="/tableros" replace />;
  // La plaza no existe (borrada, o es de otro negocio): a la primera del negocio actual.
  if (error && !data && /not_found|no encontrad/i.test(String(error))) return <Navigate to="/tableros" replace />;
  if (error && !data) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!data) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={26} /></Stack>;

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100%', px: 3, py: 2 }}>
      <GuiaTableros activo={!receta && !insumoEq && !sumando && !tv} sinDatos={false} clave={`${data.plaza.id}:${data.productos.length}`} pasos={[
        { k: 'tab-plaza', s: 'tablero', t: <>Esta es la plaza <b>{data.plaza.nombre}</b>: un puesto de despacho. Su tablero es la lámina de armado de cada producto, para que se arme siempre igual.</> },
        { k: 'tab-tarjeta', tour: 'tab-vista', ref: primeraTarjeta, s: 'tablero', t: <>Cada tarjeta es un producto con sus ingredientes y cantidades, tal como su <b>receta</b>. Tocá el nombre y abrís la receta: lo que cambies ahí se ve acá.</> },
        { k: 'tab-vacia', s: 'tablero', t: <>Esta plaza todavía no tiene productos: sumalos con <b>+ Productos</b>.</> },
        { k: 'tab-armar', s: 'tablero', t: <>Con <b>Armar</b> ordenás los renglones arrastrando, cambiás colores, ocultás lo que no va, agregás notas y elegís si se ve el <b>peso</b>, la <b>observación</b> o ambos.</> },
        { k: 'tab-productos', s: 'tablero', t: <>Con <b>+ Productos</b> sumás o sacás productos de esta plaza.</> },
        { k: 'tab-tv', s: 'tablero', t: <>Con <b>TV</b> vinculás la pantalla de la cocina: muestra esta plaza sola, todos los días.</> },
      ]} />
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2.5 }}>
        <Box data-tour="tab-plaza" sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2 }}>{data.plaza.nombre}</Typography>
          <Typography variant="caption" color="text.secondary">
            {data.plaza.sectorNombre} · {data.productos.length} producto{data.productos.length !== 1 ? 's' : ''}
            {armando ? ' · arrastrá para ordenar, tocá un color para cambiarlo, ✕ para quitar un producto' : ''}
          </Typography>
        </Box>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ py: 0 }}>{error}</Alert>}
        {/* Qué muestran los ingredientes de esta plaza; cada uno puede tener el suyo desde su panel. */}
        {data.puedeArmar && armando && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '.04em' }}>MOSTRAR</Typography>
            <ToggleButtonGroup exclusive size="small" value={data.plaza.mostrar || 'peso'} onChange={(_, v) => { if (v && v !== data.plaza.mostrar) mostrarDePlaza(v); }}
              sx={{ height: 34, '& .MuiToggleButton-root': { px: 1.5, textTransform: 'none', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' } }}>
              <ToggleButton value="peso">Peso</ToggleButton>
              <ToggleButton value="obs">Observación</ToggleButton>
              <ToggleButton value="ambos">Ambos</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        )}
        {/* «TV» (Diego 14/11/2026): la TV de la cocina muestra esta plaza sola, todos los días. */}
        {data.puedeArmar && (
          <Button data-tour="tab-tv" size="small" variant="outlined" disableElevation startIcon={<TvOutlinedIcon />} onClick={() => setTv(true)}
            sx={{ height: 34, whiteSpace: 'nowrap' }}>
            TV
          </Button>
        )}
        {/* «+ Productos» (Diego 12/11/2026): sumar o sacar productos sin ir a Configuración. */}
        {data.puedeArmar && (
          <Button data-tour="tab-productos" size="small" variant="outlined" disableElevation onClick={() => setSumando(true)} sx={{ height: 34, whiteSpace: 'nowrap' }}>
            + Productos
          </Button>
        )}
        {data.puedeArmar && (
          <Button data-tour="tab-armar" size="small" variant={armando ? 'contained' : 'outlined'} disableElevation
            startIcon={armando ? <CheckIcon /> : <EditOutlinedIcon />} onClick={() => setArmando((v) => !v)}
            sx={{ height: 34, whiteSpace: 'nowrap' }}>
            {armando ? 'Listo' : 'Armar'}
          </Button>
        )}
      </Stack>
      {!data.productos.length ? (
        <Typography data-tour="tab-vacia" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>Esta plaza todavía no tiene productos. Sumalos con «+ Productos».</Typography>
      ) : (
        <Box data-tour="tab-vista"><VistaPlaza productos={data.productos} armando={armando} mostrarPlaza={data.plaza.mostrar || 'peso'} onQuitar={quitarProducto} onCambiar={cambiar} onColorIngrediente={colorIngrediente} onMostrarIngrediente={mostrarIngrediente} onAliasIngrediente={aliasIngrediente} onOcultarIngrediente={ocultarIngrediente}
          onEditarItem={editarItem}
          onCrearEquivalencia={(articleId, r) => {
            const insumoId = String(r.ref || '').startsWith('i:') ? Number(String(r.ref).slice(2)) : null;
            if (insumoId) setInsumoEq({ id: insumoId, nombre: r.nombre, articleId });
          }}
          onAbrir={(p) => setReceta({ id: p.articleId, nombre: p.nombre })} /></Box>
      )}
      {receta && (
        <RecetaModal open onClose={() => setReceta(null)} articulo={receta}
          businessId={activeId} activeBizId={activeId} recetasElaborados={{}}
          onSaved={() => refrescarProducto(receta.id)} />
      )}
      {insumoEq && (
        // El insumo, directo en su pestaña Equivalencias; al cerrar se refresca la tarjeta para que
        // la equivalencia nueva aparezca en «Unidad».
        <RecetaModal open modoInsumo saltarSelector initialTab="equivalencias"
          onClose={() => { const a = insumoEq.articleId; setInsumoEq(null); refrescarProducto(a); setAviso('Elegí la equivalencia nueva en «Unidad»'); }}
          articulo={{ id: insumoEq.id, nombre: insumoEq.nombre, precio: 0 }}
          businessId={insumosBizId} activeBizId={activeId}
          getRecetaUrl={`${BASE}/businesses/${insumosBizId}/insumos/${insumoEq.id}/receta`}
          saveRecetaUrl={`${BASE}/businesses/${insumosBizId}/insumos/${insumoEq.id}/receta`}
          onSaved={() => {}} />
      )}
      <EditorPlaza abierto={sumando} onCerrar={() => setSumando(false)}
        sector={{ id: data.plaza.sectorId, nombre: data.plaza.sectorNombre }}
        plaza={{ id: data.plaza.id, nombre: data.plaza.nombre, productos: data.productos.map((p) => ({ articleId: p.articleId, nombre: p.nombre })) }}
        onGuardado={() => { setSumando(false); cargar(); }} />
      <VincularTV abierto={tv} plaza={data.plaza} onCerrar={() => setTv(false)} onAviso={setAviso} />
      <Snackbar open={!!quitado} autoHideDuration={6000} onClose={(_, motivo) => { if (motivo !== 'clickaway') setQuitado(null); }}
        message={quitado ? `Quitaste ${quitado.producto.nombre} de la plaza` : ''}
        action={<Button size="small" onClick={deshacerQuitar} sx={{ color: '#5BC2EA', fontWeight: 700 }}>Deshacer</Button>}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
      <Snackbar open={!!aviso} autoHideDuration={3500} onClose={() => setAviso('')} message={aviso}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
