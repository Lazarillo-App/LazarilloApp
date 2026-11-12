// src/paginas/PlazaPage.jsx — /plaza/:id: la vista «diseño» de una plaza de despacho (Diego 11/11/2026).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import EditorPlaza from '@/componentes/plazas/EditorPlaza';
import { Box, Typography, Button, CircularProgress, Alert, Stack, Snackbar } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import VistaPlaza from '@/componentes/plazas/VistaPlaza';
import { PlazasAPI } from '@/servicios/apiPlazas';
import { useBusiness } from '@/context/BusinessContext';
import RecetaModal from '@/componentes/RecetaModal';
import { useOrganization } from '@/context/OrganizationContext';
import { BASE } from '@/servicios/apiBase';

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
  useEffect(() => { setT(null); PlazasAPI.tablero().then(setT).catch(() => setT({ plazas: [], puedeCrear: false, sectores: [] })); }, [activeId]);
  if (nueva) return <Navigate to={`/tableros/${nueva}`} replace />;
  if (!t) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={26} /></Stack>;
  if (t.plazas.length) return <Navigate to={`/tableros/${t.plazas[0].id}`} replace />;
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 10, bgcolor: '#fff', minHeight: '100%' }}>
      <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>Todavía no hay plazas</Typography>
      <Typography color="text.secondary" sx={{ fontSize: '0.9rem', textAlign: 'center', maxWidth: 420 }}>
        Una plaza es un puesto de cocina o barra (Ensaladas, Freidora, Tragos) con la lámina de armado de sus productos.
      </Typography>
      {t.puedeCrear && <Button variant="contained" disableElevation onClick={() => setCreando(true)} sx={{ height: 36 }}>+ Crear plaza</Button>}
      <EditorPlaza abierto={creando} sectores={t.sectores} onCerrar={() => setCreando(false)}
        onGuardado={(id) => { setCreando(false); if (id) setNueva(id); }} />
    </Stack>
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
  const [sumando, setSumando] = useState(false); // «+ Productos»: el editor de la plaza
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
  // Peso u observación: por ingrediente, en todas las tarjetas (como el color).
  const mostrarIngrediente = async (ref, mostrar) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.ref === ref ? { ...r, mostrar } : r)) })) }));
    try { await PlazasAPI.guardarColor(ref, undefined, mostrar); } catch (e) { setError(e.message); }
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
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2 }}>{data.plaza.nombre}</Typography>
          <Typography variant="caption" color="text.secondary">
            {data.plaza.sectorNombre} · {data.productos.length} producto{data.productos.length !== 1 ? 's' : ''}
            {armando ? ' · arrastrá para ordenar, tocá un color para cambiarlo' : ''}
          </Typography>
        </Box>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ py: 0 }}>{error}</Alert>}
        {/* «+ Productos» (Diego 12/11/2026): sumar o sacar productos sin ir a Configuración. */}
        {data.puedeArmar && (
          <Button size="small" variant="outlined" disableElevation onClick={() => setSumando(true)} sx={{ height: 34, whiteSpace: 'nowrap' }}>
            + Productos
          </Button>
        )}
        {data.puedeArmar && (
          <Button size="small" variant={armando ? 'contained' : 'outlined'} disableElevation
            startIcon={armando ? <CheckIcon /> : <EditOutlinedIcon />} onClick={() => setArmando((v) => !v)}
            sx={{ height: 34, whiteSpace: 'nowrap' }}>
            {armando ? 'Listo' : 'Armar'}
          </Button>
        )}
      </Stack>
      {!data.productos.length ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>Esta plaza todavía no tiene productos. Se asignan en ⚙ Configuración › Sectores.</Typography>
      ) : (
        <VistaPlaza productos={data.productos} armando={armando} onCambiar={cambiar} onColorIngrediente={colorIngrediente} onMostrarIngrediente={mostrarIngrediente} onAliasIngrediente={aliasIngrediente}
          onEditarItem={editarItem}
          onCrearEquivalencia={(articleId, r) => {
            const insumoId = String(r.ref || '').startsWith('i:') ? Number(String(r.ref).slice(2)) : null;
            if (insumoId) setInsumoEq({ id: insumoId, nombre: r.nombre, articleId });
          }}
          onAbrir={(p) => setReceta({ id: p.articleId, nombre: p.nombre })} />
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
      <Snackbar open={!!aviso} autoHideDuration={3500} onClose={() => setAviso('')} message={aviso}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
