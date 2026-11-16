// Acciones y diálogos del modal de receta, sacados de index.jsx tal cual (12/11/2026) para
// que index.jsx entre en un envío al repo. No cambia la lógica: el estado sigue en index.jsx.
//  - BotonesReceta: Borrar · Cancelar · Guardar. Con enPie (artículo) van en la misma franja
//    que el pie de costos, apilados a la derecha (Diego, PR 2 del pie: se gana el renglón del footer).
//  - usePasosReceta + RecorridoReceta: los pasos del recorrido guiado (ampliado el 15/11/2026, por sector).
//  - DialogosReceta: confirmar romper recetas, borrar receta, deshacer promo y reemplazar insumo.
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, DialogContentText,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SpotlightTour from '@/componentes/SpotlightTour';
import { refTour, seVe } from '@/componentes/asistente/pasosHeader';
import { useSectorGuia, pasosDelSector } from '@/componentes/asistente/guias';
import { PRIMARY, ON_PRIMARY } from './helpers';

export function BotonesReceta({ receta, promoMode, modoPromoNueva, saving, deleting, loading, hasDuplicates, onBorrar, onCancel, onSave, guardarRef, enPie = false }) {
  if (enPie) {
    // Artículo: Guardar arriba a lo ancho, Borrar y Cancelar abajo — entra en el alto del pie.
    return (
      <Stack spacing={1} sx={{ width: 196, flexShrink: 0, alignSelf: 'center' }}>
        <Button
          ref={guardarRef}
          onClick={onSave}
          variant="contained"
          disabled={saving || deleting || loading || hasDuplicates}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          sx={{ height: 40, bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
        <Stack direction="row" spacing={1}>
          {receta && (
            <Button
              size="small" color="error" variant="outlined" fullWidth
              disabled={saving || deleting}
              startIcon={deleting ? <CircularProgress size={13} color="inherit" /> : <DeleteForeverIcon />}
              onClick={onBorrar}
              sx={{ height: 32 }}
            >
              Borrar
            </Button>
          )}
          <Button onClick={onCancel} disabled={saving || deleting} color="inherit" size="small" fullWidth sx={{ height: 32 }}>
            Cancelar
          </Button>
        </Stack>
      </Stack>
    );
  }
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {/* Borrar receta — solo si ya existe */}
      {receta && (
        <Button
          size="small"
          color="error"
          variant="outlined"
          disabled={saving || deleting}
          startIcon={deleting ? <CircularProgress size={13} color="inherit" /> : <DeleteForeverIcon />}
          onClick={onBorrar}
        >
          {promoMode ? 'Borrar' : 'Borrar'}
        </Button>
      )}
      <Button onClick={onCancel} disabled={saving || deleting} color="inherit" size="small">
        Cancelar
      </Button>

      <Button
        ref={guardarRef}
        onClick={onSave}
        variant="contained"
        size="small"
        disabled={saving || deleting || loading || hasDuplicates}
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
        sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}
      >
        {saving ? 'Guardando…' : (modoPromoNueva ? 'Guardar' : 'Guardar')}
      </Button>
    </Stack>
  );
}

// Pasos de la guía de la receta (Diego 15/11/2026: «no habla de los paso a paso de las recetas y su foto,
// las promociones, las vinculaciones…»). Sectores: Datos (arriba), Ingredientes, Encabezado y Pie.
// Solo entran los que se ven (en una promo no hay rendimiento ni vincular; el staff no ve Marcar).
export function usePasosReceta({ open, recResumenRef, recAgregarRef, recIngredientesRef, recFotoRef, recGuardarRef }) {
  const sector = useSectorGuia('receta');
  const TODOS = [
    { k: 'resumen', s: 'pie', ref: recResumenRef, pose: 'presenta', t: <>Acá ves el <b>precio de venta</b>, cuánto te cuesta hacer el plato y qué parte del precio se lleva el costo, contra tu <b>costo objetivo</b>. El <b>precio sugerido</b> es el que necesitás para llegar a ese objetivo.</> },
    { k: 'rec-tipo', s: 'datos', ref: refTour('rec-tipo'), t: <><b>Producto</b> es un plato o bebida con su receta. <b>Promoción</b> arma un combo con otros artículos: su costo suma el de cada uno.</> },
    { k: 'rec-rendimiento', s: 'datos', ref: refTour('rec-rendimiento'), t: <><b>Rendimiento</b>: cuántas porciones (o kilos, litros) salen de esta receta. El costo de los ingredientes se reparte en eso.</> },
    { k: 'rec-vincular', s: 'datos', ref: refTour('rec-vincular'), t: <><b>Vincular</b>: si otro artículo se hace igual (el mismo plato en otra carta o en el delivery), lo vinculás y usa esta misma receta.</> },
    { k: 'agregar', s: 'ingredientes', ref: recAgregarRef, t: <>Tocá <b>Agregar ingrediente</b> y escribí el nombre del insumo. Si todavía no existe, lo creás desde acá mismo.</> },
    { k: 'ingredientes', s: 'ingredientes', ref: recIngredientesRef, pose: 'investiga', t: <>En cada ingrediente poné <b>cuánto lleva</b> por porción y en qué <b>unidad</b> (gr, ml, unidad). El costo se calcula solo. En <b>Observaciones</b> dejás una nota para la cocina.</> },
    { k: 'rec-avanzadas', s: 'ingredientes', ref: refTour('rec-avanzadas'), t: <>En el <b>⚙</b> de cada ingrediente cargás la <b>merma</b> (lo que se pierde al limpiarlo o cocinarlo), si va al <b>pedido</b> y qué <b>costo</b> usar.</> },
    { k: 'foto', s: 'encabezado', ref: recFotoRef, pose: 'presenta', t: <>Tocando la <b>foto</b> abrís «Notas e imagen»: subís la foto del plato terminado y armás el <b>paso a paso</b> de la preparación (lo ordenás y lo separás en secciones, como Preparación o Cocción).</> },
    { k: 'rec-marcar', s: 'encabezado', ref: refTour('rec-marcar'), t: <><b>Marcar</b>: tildás ingredientes y los mandás a <b>revisión</b> con una nota.</> },
    { k: 'rec-cocina', s: 'encabezado', ref: refTour('rec-cocina'), t: <><b>Vista Cocina</b>: la receta como la ve la cocina, con la foto, los ingredientes y el paso a paso.</> },
    { k: 'rec-buscar', s: 'encabezado', ref: refTour('rec-buscar'), t: <>Con la <b>lupa</b> buscás otro artículo y lo abrís sin cerrar este.</> },
    { k: 'guardar', s: 'pie', ref: recGuardarRef, pose: 'saluda', t: <>Cuando termines, <b>guardá</b>. Si cambia el precio de un insumo, el costo de la receta se actualiza solo.</> },
  ];
  // Los pasos de refs propias (resumen, foto…) siempre van; los de data-tour, si se ven.
  const [claves, setClaves] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    const medir = () => {
      const ok = TODOS.filter((p) => !p.k.startsWith('rec-') || seVe(document.querySelector(`[data-tour="${p.k}"]`))).map((p) => p.k);
      setClaves((prev) => (prev && prev.join() === ok.join() ? prev : ok));
    };
    const t1 = setTimeout(medir, 300);
    const t2 = setTimeout(medir, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const lista = claves ? TODOS.filter((p) => claves.includes(p.k)) : TODOS.filter((p) => !p.k.startsWith('rec-'));
  return pasosDelSector(lista, sector);
}

export function RecorridoReceta({ rec, pasos }) {
  const paso = pasos[rec.paso - 1];
  if (!rec.visible || !paso) return null;
  return (
    <SpotlightTour key={paso.k} targetRef={paso.ref} pose={paso.pose || 'senala'} {...rec.props(rec.paso)} text={paso.t} />
  );
}

export function DialogosReceta({
  confirmRompeRotos, resolverConfirmRompe, confirmDelete, setConfirmDelete, handleDelete, deleting, artNombre,
  confirmarDesactivar, setConfirmarDesactivar, desactivarPromo, articulo, reemplazarAviso, setReemplazarAviso,
}) {
  return (
    <>
    {/* ── Aviso: cambiar el rendimiento/Equivalente de este elaborado deja sin unidad
        válida a otras recetas que lo usan ── */}
    <Dialog open={!!confirmRompeRotos} onClose={() => resolverConfirmRompe(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: '#ea580c' }}>⚠ Esto va a romper otras recetas</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          Este cambio deja sin una unidad válida a {confirmRompeRotos?.length}{' '}
          {confirmRompeRotos?.length === 1 ? 'receta' : 'recetas'} que usan este insumo:
          <Box sx={{ my: 1.5, pl: 0.5 }}>
            {(confirmRompeRotos || []).map((u, i) => (
              <Typography key={i} variant="body2" sx={{ color: 'text.primary' }}>
                • {u.nombre} (usa "{u.unidad}")
              </Typography>
            ))}
          </Box>
          Van a quedar marcadas para revisar la próxima vez que se abran — no se arreglan solas.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => resolverConfirmRompe(false)} color="inherit" size="small">Cancelar</Button>
        <Button onClick={() => resolverConfirmRompe(true)} variant="contained" size="small" sx={{ bgcolor: '#ea580c', '&:hover': { bgcolor: '#c2410c' } }}>
          Guardar igual
        </Button>
      </DialogActions>
    </Dialog>

    {/* ── Confirmar borrar ── */}
    <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>¿Borrar receta?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Esta acción eliminará permanentemente la receta de <strong>{artNombre}</strong>.
          Los costos calculados dejarán de mostrarse.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmDelete(false)} color="inherit" size="small">Cancelar</Button>
        <Button
          onClick={handleDelete}
          color="error" variant="contained" size="small"
          startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverIcon />}
          disabled={deleting}
        >
          {deleting ? 'Borrando…' : 'Sí, borrar'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* ── Confirmación al desactivar promo (switch Promoción → Producto) ── */}
    <Dialog open={confirmarDesactivar} onClose={() => setConfirmarDesactivar(false)} maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>
        ¿Deshacer la promoción?
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {Number(articulo?.id) < 0
            ? <>Esto eliminará por completo la promoción <strong>{artNombre}</strong>: se borra la promo y sus componentes dejan de estar vinculados. Esta acción no se puede deshacer.</>
            : <>Esto quitará todos los artículos agregados a <strong>{artNombre}</strong> y la devolverá a producto normal. Sus insumos propios se conservan. ¿Continuar?</>}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmarDesactivar(false)} color="inherit" size="small">
          Cancelar
        </Button>
        <Button
          onClick={async () => {
            setConfirmarDesactivar(false);
            await desactivarPromo();
          }}
          color="error"
          variant="contained"
          size="small"
        >
          Sí, deshacer
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={reemplazarAviso} onClose={() => setReemplazarAviso(false)} maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Reemplazar insumo</DialogTitle>
      <DialogContent>
        <DialogContentText>Esta función está en construcción. Pronto vas a poder reemplazar el insumo en todas las recetas.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setReemplazarAviso(false)}>Entendido</Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
