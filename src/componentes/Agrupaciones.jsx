import React, { useState, useEffect, useMemo } from "react";
import {
  Button, Modal, Typography, TextField, Checkbox,
  Accordion, AccordionSummary, AccordionDetails, Box,
  Snackbar, Alert
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import AgrupacionesList from "./AgrupacionesList";
import { ensureTodo } from '../servicios/apiAgrupacionesTodo';
import { BASE } from '../servicios/apiBase';

const evaluarCheckboxEstado = (articulos, articulosSeleccionados, isArticuloBloqueado) => {
  const disponibles = articulos.filter(art => !isArticuloBloqueado(art));
  const total = disponibles.length;
  const seleccionados = disponibles.filter(art => articulosSeleccionados.includes(art)).length;
  return {
    checked: total > 0 && seleccionados === total,
    indeterminate: seleccionados > 0 && seleccionados < total
  };
};

const Agrupaciones = ({ actualizarAgrupaciones }) => {
  const [rubro, setRubro] = useState("");
  const [todosArticulos, setTodosArticulos] = useState([]); // [{id, nombre, subrubros:[...]} por categoría]
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  console.log(categoriasSeleccionadas);
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
      const { data } = await axios.get(`${BASE}/agrupaciones`);
      setAgrupaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar agrupaciones:", error);
      mostrarSnackbar("Error al cargar agrupaciones", 'error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1) Maxi
        const token = await obtenerToken();
        const articulos = await obtenerArticulos(token);
        setTodosArticulos(articulos);
        setLoading(false);

        // 2) (Opcional) Garantizar que exista TODO
        try { await ensureTodo(); } catch { /* noop */ }

        // 3) Agrupaciones
        await cargarAgrupaciones();
      } catch (error) {
        console.error("Error al cargar los datos:", error);
        setLoading(false);
        mostrarSnackbar("Error al cargar datos", 'error');
      }
    };
    fetchData();
  }, []);

  // IDs asignados a alguna agrupación (EXCEPTO la agrupación llamada "TODO")
  const assignedIds = useMemo(() => {
    const set = new Set();
    (agrupaciones || [])
      .filter(g => (g?.nombre || '').toUpperCase() !== 'TODO')
      .forEach(g => (g.articulos || []).forEach(a => set.add(String(a.id))));
    return set;
  }, [agrupaciones]);

  // Artículo bloqueado = ya pertenece a alguna agrupación (excepto TODO)
  const isArticuloBloqueado = (articulo) => assignedIds.has(String(articulo.id));

  const handleSelectCategoria = (_categoriaNombre, articulos) => {
    const candidatos = articulos.filter(a => !isArticuloBloqueado(a));
    setCategoriasSeleccionadas((prev) =>
      prev.includes(_categoriaNombre)
        ? prev.filter((x) => x !== _categoriaNombre)
        : [...prev, _categoriaNombre]
    );
    setArticulosSeleccionados((prev) =>
      candidatos.some(a => prev.includes(a))
        ? prev.filter(a => !candidatos.includes(a))
        : [...prev, ...candidatos]
    );
  };

  const handleSelectArticulo = (articulo) => {
    if (isArticuloBloqueado(articulo)) return; // ya tomado por otra agrupación
    setArticulosSeleccionados((prev) =>
      prev.includes(articulo)
        ? prev.filter((x) => x !== articulo)
        : [...prev, articulo]
    );
  };

  const crearAgrupacion = async () => {
    if (!rubro.trim() || articulosSeleccionados.length === 0) {
      mostrarSnackbar("Debes ingresar un nombre y seleccionar artículos", 'error');
      return;
    }
    try {
      await axios.post(`${BASE}/agrupaciones`, {
        nombre: rubro,
        articulos: articulosSeleccionados.map((art) => ({
          id: art.id,
          nombre: art.nombre || '',
          categoria: art.categoria || 'Sin categoría',
          subrubro: art.subrubro || 'Sin subrubro',
          precio: art.precio ?? 0
        }))
      });

      await cargarAgrupaciones();
      setRubro("");
      setArticulosSeleccionados([]);
      setCategoriasSeleccionadas([]);
      actualizarAgrupaciones?.();
      setModalOpen(false);
      mostrarSnackbar(`Agrupación "${rubro}" creada correctamente`);
    } catch (error) {
      console.error("Error al crear agrupación:", error);
      mostrarSnackbar("Error al crear agrupación", 'error');
    }
  };

  const agruparPorSubrubro = (data) => {
    const agrupado = {};
    data.forEach(rubro => {
      rubro.subrubros.forEach(subrubro => {
        const subrubroNombre = subrubro.nombre;
        if (!agrupado[subrubroNombre]) agrupado[subrubroNombre] = [];
        agrupado[subrubroNombre].push({
          nombre: rubro.nombre,
          articulos: subrubro.articulos
        });
      });
    });
    return Object.entries(agrupado).map(([nombre, rubros]) => ({ nombre, rubros }));
  };

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
        <TextField
          label="Nombre del Rubro"
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          fullWidth
          className="mb-4"
        />

        <Button onClick={() => setModalOpen(true)} variant="contained" style={{ backgroundColor: '#285a73' }}>
          Buscar
        </Button>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          <Box
            sx={{
              overflowY: 'auto',
              maxHeight: '80vh',
              width: '90%',
              maxWidth: 700,
              margin: '50px auto',
              padding: 3,
              backgroundColor: 'white',
              borderRadius: 2,
              boxShadow: 24,
            }}
          >
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Selecciona Categorías y Artículos (solo los que aún están libres)
            </Typography>

            {loading ? (
              <Typography>Cargando artículos...</Typography>
            ) : (
              <Box sx={{ maxHeight: '60vh', overflowY: 'auto', pr: 1 }}>
                {agruparPorSubrubro(todosArticulos).map((subrubro, index) => {
                  // Solo contamos como “seleccionables” los que no están ya asignados
                  const subrubroArticulosDisponibles = subrubro.rubros.flatMap(r =>
                    r.articulos.filter(a => !isArticuloBloqueado(a))
                  );

                  const { checked, indeterminate } = evaluarCheckboxEstado(
                    subrubroArticulosDisponibles,
                    articulosSeleccionados,
                    isArticuloBloqueado
                  );

                  return (
                    <Accordion key={index}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Checkbox
                          checked={checked}
                          indeterminate={indeterminate}
                          onChange={() => {
                            // toggle todos los disponibles de este subrubro
                            const disponibles = subrubro.rubros.flatMap(r =>
                              r.articulos.filter(a => !isArticuloBloqueado(a))
                            );
                            setArticulosSeleccionados(prev =>
                              disponibles.some(a => prev.includes(a))
                                ? prev.filter(a => !disponibles.includes(a))
                                : [...prev, ...disponibles]
                            );
                          }}
                          sx={{ mr: 1 }}
                        />
                        <Typography fontWeight="bold">{subrubro.nombre}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        {subrubro.rubros.map((rubroCat, idx) => {
                          const { checked: rubroChecked, indeterminate: rubroIndeterminado } =
                            evaluarCheckboxEstado(rubroCat.articulos, articulosSeleccionados, isArticuloBloqueado);

                          return (
                            <Accordion key={idx} sx={{ mb: 1 }}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Checkbox
                                  checked={rubroChecked}
                                  indeterminate={rubroIndeterminado}
                                  onChange={() => handleSelectCategoria(rubroCat.nombre, rubroCat.articulos)}
                                  sx={{ mr: 1 }}
                                />
                                <Typography>{rubroCat.nombre}</Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                {rubroCat.articulos.map((articulo) => {
                                  const bloqueado = isArticuloBloqueado(articulo);
                                  const seleccionado = articulosSeleccionados.includes(articulo);
                                  return (
                                    <Box key={articulo.id} display="flex" alignItems="center" sx={{ pl: 2, opacity: bloqueado ? 0.5 : 1 }}>
                                      <Checkbox
                                        checked={seleccionado}
                                        onChange={() => handleSelectArticulo(articulo)}
                                        sx={{ mr: 1 }}
                                        disabled={bloqueado}
                                      />
                                      <Typography>
                                        {articulo.nombre} {bloqueado && '(ya asignado)'}
                                      </Typography>
                                    </Box>
                                  );
                                })}
                              </AccordionDetails>
                            </Accordion>
                          );
                        })}
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
            )}

            <Box display="flex" justifyContent="flex-end" mt={3}>
              <Button
                onClick={crearAgrupacion}
                variant="contained"
                color="success"
                disabled={!rubro.trim() || articulosSeleccionados.length === 0}
              >
                Guardar Agrupación
              </Button>
            </Box>
          </Box>
        </Modal>

        <AgrupacionesList
          agrupaciones={agrupaciones}
          onActualizar={() => {
            actualizarAgrupaciones?.();
            cargarAgrupaciones();
            mostrarSnackbar("Agrupación actualizada");
          }}
          // Podés pasar el id de TODO si querés identificarlo, pero ya no se usa para exclusiones
          todoGroupId={(agrupaciones.find(g => (g?.nombre || '').toUpperCase() === 'TODO') || {}).id}
        />
      </div>
    </>
  );
};

export default Agrupaciones;
