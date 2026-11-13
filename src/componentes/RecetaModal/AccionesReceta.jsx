// Acciones y diálogos del modal de receta, sacados de index.jsx tal cual (12/11/2026) para
// que index.jsx entre en un envío al repo. No cambia la lógica: el estado sigue en index.jsx.
//  - BotonesReceta: Borrar · Cancelar · Guardar. Con enPie (artículo) van en la misma franja
//    que el pie de costos, apilados a la derecha (Diego, PR 2 del pie: se gana el renglón del footer).
//  - RecorridoReceta: los 5 pasos del recorrido guiado.
//  - DialogosReceta: confirmar romper recetas, borrar receta, deshacer promo y reemplazar insumo.
import React from 'react';
import {
  Box, Typography, Button, CircularProgress, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, DialogContentText,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SpotlightTour from '@/componentes/SpotlightTour';
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

export function RecorridoReceta({ rec, recResumenRef, recAgregarRef, recIngredientesRef, recFotoRef, recGuardarRef }) {
  return (
    <>
    {rec.visible && rec.paso === 1 && (
      <SpotlightTour targetRef={recResumenRef} pose="presenta" {...rec.props(1)}
        text={<>Acá ves el <b>precio de venta</b>, cuánto te cuesta hacer el plato y qué porcentaje del precio se lleva el costo (<b>food cost</b>).</>} />
    )}
    {rec.visible && rec.paso === 2 && (
      <SpotlightTour targetRef={recAgregarRef} pose="senala" {...rec.props(2)}
        text={<>Tocá <b>Agregar ingrediente</b> y escribí el nombre del insumo. Si todavía no existe, lo creás desde acá mismo.</>} />
    )}
    {rec.visible && rec.paso === 3 && (
      <SpotlightTour targetRef={recIngredientesRef} pose="investiga" {...rec.props(3)}
        text={<>En cada ingrediente poné <b>cuánto lleva</b> por porción y en qué <b>unidad</b> (gr, ml, unidad). El costo se calcula solo.</>} />
    )}
    {rec.visible && rec.paso === 4 && (
      <SpotlightTour targetRef={recFotoRef} pose="presenta" {...rec.props(4)}
        text={<>Acá va la <b>foto</b> del plato terminado y el <b>paso a paso</b> de la preparación.</>} />
    )}
    {rec.visible && rec.paso === 5 && (
      <SpotlightTour targetRef={recGuardarRef} pose="saluda" {...rec.props(5)}
        text="Cuando termines, guardá. Si cambia el precio de un insumo, el costo de la receta se actualiza solo." />
    )}
    </>
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
