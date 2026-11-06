// src/componentes/gestion/RubrosConfig.jsx
// ⚙ de rubros visibles (lazarillo_gestion/components/dashboard/rubros-config-modal.tsx): en
// Compras, los rubros del panel; en Resultados, los que suman a Ganancia. Con algún rubro
// apagado, el botón se marca y muestra cuántos SÍ están visibles. La visibilidad es del negocio.

import React, { useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, Switch, CircularProgress, Typography, Snackbar, Alert,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import InboxIcon from '@mui/icons-material/Inbox';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';

// Lo que depende de qué rubros se ven: se recalcula al cambiar uno.
const DEPENDIENTES = ['gestionPivot', 'gestionEquilibrio', 'gestionEquilibrioVariables', 'gestionDiferenciaCaja', 'gestionAnual', 'gestionCanasta'];

export default function RubrosConfig({ field = 'visibleEnDashboard', title = 'Rubros visibles en panel' }) {
  const { businessId } = usePanelGestion();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [guardando, setGuardando] = useState(null);
  const [aviso, setAviso] = useState(null);
  const queryKey = ['gestionRubrosVisibles', businessId, field];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => GestionAPI.rubrosVisibles(field),
    enabled: !!businessId,
  });
  const rubros = data ?? [];
  const visibles = rubros.filter((r) => r.visible).length;
  const hayOcultos = rubros.length > 0 && visibles < rubros.length;

  async function cambiar(codigo, visible) {
    const nombre = rubros.find((r) => r.codigo === codigo)?.nombre ?? codigo;
    setGuardando(codigo);
    try {
      await GestionAPI.guardarRubroVisible({ codigo, visible, field });
      queryClient.setQueryData(queryKey, rubros.map((r) => (r.codigo === codigo ? { ...r, visible } : r)));
      await Promise.all(DEPENDIENTES.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      setAviso({ sev: 'success', txt: `${nombre} ${visible ? 'visible' : 'oculto'}` });
    } catch {
      setAviso({ sev: 'error', txt: `No se pudo actualizar ${nombre}` });
    } finally {
      setGuardando(null);
    }
  }

  return (
    <>
      <Box
        component="button" type="button" title="Configurar rubros visibles" onClick={() => setOpen(true)}
        sx={{
          all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'relative', width: 32, height: 32, flexShrink: 0,
          display: 'grid', placeItems: 'center', borderRadius: 2, border: 1,
          ...(hayOcultos
            ? { borderColor: 'grey.400', bgcolor: 'grey.100', color: 'text.primary', '&:hover': { bgcolor: 'grey.200' } }
            : { borderColor: 'divider', bgcolor: 'background.paper', color: 'text.secondary', '&:hover': { color: 'text.primary', borderColor: 'grey.400' } }),
        }}
      >
        <TuneIcon sx={{ fontSize: 15 }} />
        {hayOcultos && (
          <Box
            component="span" title={`${visibles} visible${visibles === 1 ? '' : 's'} de ${rubros.length}`}
            sx={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, px: 0.25, borderRadius: 999, bgcolor: 'grey.800', color: '#fff', fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center' }}
          >
            {visibles}
          </Box>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 16, pb: 0.5 }}>
          <TuneIcon sx={{ fontSize: 18 }} />{title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
            Los rubros desactivados no aparecen en el panel ni se contabilizan en los totales.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
            {isLoading ? (
              <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>
            ) : error ? (
              <Box sx={{ py: 4, textAlign: 'center', fontSize: 14, color: 'error.main' }}>Error: {error.message}</Box>
            ) : rubros.length === 0 ? (
              <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, fontSize: 14, color: 'text.secondary' }}>
                <InboxIcon sx={{ fontSize: 32, opacity: 0.4 }} />No hay rubros cargados.
              </Box>
            ) : rubros.map((r) => (
              <Box
                key={r.codigo}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, px: 1.5, py: 0.5, borderRadius: 2, opacity: r.visible ? 1 : 0.5, '&:hover': r.visible ? { bgcolor: 'grey.50' } : undefined }}
              >
                <Box component="span" sx={{ fontSize: 14, color: r.visible ? 'text.primary' : 'text.secondary' }}>{r.nombre}</Box>
                <Switch size="small" checked={r.visible || !!r.fijo} disabled={!!r.fijo || guardando === r.codigo} title={r.fijo ? 'Siempre visible: es gasto y entra al total. Se va cuando le asignás rubro.' : undefined} onChange={(e) => cambiar(r.codigo, e.target.checked)} inputProps={{ 'aria-label': r.nombre }} />
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>
      <Snackbar open={!!aviso} autoHideDuration={2500} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aviso ? <Alert severity={aviso.sev} variant="filled" onClose={() => setAviso(null)}>{aviso.txt}</Alert> : undefined}
      </Snackbar>
    </>
  );
}
