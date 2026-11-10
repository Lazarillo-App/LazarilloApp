// src/componentes/gestion/MediosPagoAbm.jsx
// ABM de medios de pago desde el mismo desplegable (Diego 10/11/2026): los desplegables de
// maestros tienen como PRIMERA opción su alta/edición, en vez de una entrada en el menú.
// Uso en un <select> nativo:
//   const abm = useAbmMediosPago();
//   <select value={medio} onChange={abm.alElegir(setMedio)}>{abm.opcion}{…medios…}</select>
//   {abm.dialogo}
import React, { useState } from 'react';
import { Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ContenidoMediosPago } from '@/paginas/GestionMediosPago';

export const OPCION_ABM_MEDIOS = '__abm_medios__';

export function MediosPagoDialog({ open, onClose }) {
  return (
    // stopPropagation: el Dialog va por portal, pero los eventos de React suben por el árbol de
    // componentes y llegarían al fondo del modal que lo contiene (que cierra al hacer clic).
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth sx={{ zIndex: 1500 }}
      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
      slotProps={{ paper: { sx: { borderRadius: 3, position: 'relative' } } }}>
      <IconButton size="small" title="Cerrar" onClick={onClose} sx={{ position: 'absolute', top: 10, right: 10 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
      <ContenidoMediosPago />
    </Dialog>
  );
}

export function useAbmMediosPago() {
  const [abierto, setAbierto] = useState(false);
  // El select es controlado: al elegir la opción del ABM no cambia el valor, solo abre el gestor.
  const alElegir = (set) => (e) => {
    const v = e.target.value;
    if (v === OPCION_ABM_MEDIOS) { setAbierto(true); return; }
    set(v);
  };
  return {
    alElegir,
    opcion: <option key={OPCION_ABM_MEDIOS} value={OPCION_ABM_MEDIOS}>＋ Agregar o editar medios de pago…</option>,
    dialogo: <MediosPagoDialog open={abierto} onClose={() => setAbierto(false)} />,
  };
}
