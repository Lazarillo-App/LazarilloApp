// src/componentes/Agrupaciones.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Button, Snackbar, Alert } from "@mui/material";

import AgrupacionesList from "./AgrupacionesList";
import ModalSeleccionArticulos from "./ModalSeleccionArticulos";
import { ensureTodo } from "../servicios/apiAgrupacionesTodo";
import { BusinessesAPI } from "../servicios/apiBusinesses";
import { obtenerAgrupaciones } from "../servicios/apiAgrupaciones";
import { httpBiz } from "../servicios/apiBusinesses";

const Agrupaciones = ({ actualizarAgrupaciones }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agrupaciones, setAgrupaciones] = useState([]);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMensaje, setSnackbarMensaje] = useState('');
  const [snackbarTipo, setSnackbarTipo] = useState('success');
  const mostrarSnackbar = (mensaje, tipo = 'success') => {
    setSnackbarMensaje(mensaje);
    setSnackbarTipo(tipo);
    setSnackbarOpen(true);
  };

  const cargarAgrupaciones = async () => {
    try {
      const data = await obtenerAgrupaciones();
      setAgrupaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar agrupaciones:", error);
      mostrarSnackbar("Error al cargar agrupaciones", 'error');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Garantizar negocio activo (solo para UX)
        const bizId = localStorage.getItem('activeBusinessId');
        if (!bizId) {
          setLoading(false);
          mostrarSnackbar("Seleccioná un local activo primero", 'warning');
          return;
        }

        // Garantizar TODO
        try { await ensureTodo(); } catch {}
        // Cargar agrupaciones
        await cargarAgrupaciones();
      } catch (error) {
        console.error("Error al cargar los datos:", error);
        mostrarSnackbar("Error al cargar datos", 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // IDs asignados a alguna agrupación (excepto TODO) para bloquear en el modal
  const assignedIds = useMemo(() => {
    const set = new Set();
    (agrupaciones || [])
      .filter(g => (g?.nombre || '').toUpperCase() !== 'TODO')
      .forEach(g => (g.articulos || []).forEach(a => set.add(Number(a.id))));
    return set;
  }, [agrupaciones]);

  return (
    <>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarTipo} sx={{ width: '100%' }}>
          {snackbarMensaje}
        </Alert>
      </Snackbar>

      <div className="p-4">
        <h2 className="text-xl font-bold">Crear Agrupación</h2>

        <Button
          onClick={() => setModalOpen(true)}
          variant="contained"
          style={{ backgroundColor: '#285a73' }}
          disabled={loading}
        >
          Abrir selector
        </Button>

        {/* Modal reutilizable */}
        <ModalSeleccionArticulos
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Crear nueva agrupación y mover artículos"
          preselectIds={[]}
          assignedIds={assignedIds}                // bloquea los que ya pertenecen a otra agrupación (no-TODO)
          notify={(m, t) => mostrarSnackbar(m, t)}
          onSubmit={async ({ nombre, ids }) => {
            // create-or-move (traspaso)
            await httpBiz('/agrupaciones/create-or-move', {
              method: 'POST',
              body: { nombre, ids }
            });
            await cargarAgrupaciones();
            actualizarAgrupaciones?.();
          }}
        />

        <div style={{ marginTop: 16 }}>
          <AgrupacionesList
            agrupaciones={agrupaciones}
            onActualizar={async () => {
              await cargarAgrupaciones();
              actualizarAgrupaciones?.();
              mostrarSnackbar("Agrupación actualizada");
            }}
            todoGroupId={(agrupaciones.find(g => (g?.nombre || '').toUpperCase() === 'TODO') || {}).id}
          />
        </div>
      </div>
    </>
  );
};

export default Agrupaciones;
