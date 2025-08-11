import React, { useState, useEffect } from "react";
import {
  Button, Modal, Typography, TextField, Checkbox,
  Accordion, AccordionSummary, AccordionDetails, Box,
  Snackbar, Alert
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import AgrupacionesList from "./AgrupacionesList";
import axios from 'axios';

const evaluarCheckboxEstado = (articulos, articulosSeleccionados, isArticuloSeleccionado) => {
  const disponibles = articulos.filter(art => !isArticuloSeleccionado(art));
  const total = disponibles.length;
  const seleccionados = disponibles.filter(art => articulosSeleccionados.includes(art)).length;

  return {
    checked: total > 0 && seleccionados === total,
    indeterminate: seleccionados > 0 && seleccionados < total
  };
};

const Agrupaciones = ({ actualizarAgrupaciones }) => {
  const [rubro, setRubro] = useState("");
  const [todosArticulos, setTodosArticulos] = useState([]);
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");   
  console.log(setSearchQuery)
  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMensaje, setSnackbarMensaje] = useState('');
  const [snackbarTipo, setSnackbarTipo] = useState('success'); // 'success' | 'error' | 'info'

  const mostrarSnackbar = (mensaje, tipo = 'success') => {
    setSnackbarMensaje(mensaje);
    setSnackbarTipo(tipo);
    setSnackbarOpen(true);
  };

  const cargarAgrupaciones = async () => {
    try {
      const agrupacionesRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones`);
      setAgrupaciones(Array.isArray(agrupacionesRes.data) ? agrupacionesRes.data : []);
    } catch (error) {
      console.error("Error al cargar agrupaciones:", error);
      mostrarSnackbar("Error al cargar agrupaciones", 'error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await obtenerToken();
        const articulos = await obtenerArticulos(token);
        setTodosArticulos(articulos);
        setLoading(false);

        await cargarAgrupaciones();
      } catch (error) {
        console.error("Error al cargar los datos:", error);
        setLoading(false);
        mostrarSnackbar("Error al cargar datos", 'error');
      }
    };

    fetchData();
  }, []);

  const isArticuloSeleccionado = (articulo) => {
    return agrupaciones.some(agr =>
      Array.isArray(agr.articulos) && agr.articulos.some(a => a.id === articulo.id)
    );
  };

  const handleSelectCategoria = (categoria, articulos) => {
    const nuevosArticulos = articulos.filter(a => !isArticuloSeleccionado(a));
    setCategoriasSeleccionadas((prevState) =>
      prevState.includes(categoria)
        ? prevState.filter((item) => item !== categoria)
        : [...prevState, categoria]
    );
    setArticulosSeleccionados((prevState) =>
      prevState.some(art => nuevosArticulos.includes(art))
        ? prevState.filter(art => !nuevosArticulos.includes(art))
        : [...prevState, ...nuevosArticulos]
    );
  };

  const handleSelectArticulo = (articulo) => {
    if (isArticuloSeleccionado(articulo)) return;
    setArticulosSeleccionados((prevState) =>
      prevState.includes(articulo)
        ? prevState.filter((item) => item !== articulo)
        : [...prevState, articulo]
    );
  };

  const crearAgrupacion = async () => {
    if (!rubro.trim() || articulosSeleccionados.length === 0) {
      mostrarSnackbar("Debes ingresar un nombre y seleccionar artículos", 'error');
      return;
    }

    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones`, {
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
      actualizarAgrupaciones();
      setModalOpen(false);
      mostrarSnackbar(`Agrupación "${rubro}" creada correctamente`);
    } catch (error) {
      console.error("Error al crear agrupación:", error);
      mostrarSnackbar("Error al crear agrupación", 'error');
    }
  };

  const filterArticulos = (articulos) => {
    return articulos.filter(articulo =>
      articulo.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const agruparPorSubrubro = (data) => {
    const agrupado = {};
    data.forEach(rubro => {
      rubro.subrubros.forEach(subrubro => {
        const subrubroNombre = subrubro.nombre;
        if (!agrupado[subrubroNombre]) {
          agrupado[subrubroNombre] = [];
        }
        agrupado[subrubroNombre].push({
          nombre: rubro.nombre,
          articulos: subrubro.articulos
        });
      });
    });

    return Object.entries(agrupado).map(([nombre, rubros]) => ({
      nombre,
      rubros
    }));
  };

  const handleSelectSubrubro = (subrubro) => {
    const todasCategorias = subrubro.rubros.map(r => r.nombre);
    const todosArticulos = subrubro.rubros.flatMap(r => r.articulos).filter(a => !isArticuloSeleccionado(a));

    const estaSeleccionado = todasCategorias.every(cat => categoriasSeleccionadas.includes(cat)) &&
      todosArticulos.every(art => articulosSeleccionados.includes(art));

    const nuevasCategorias = new Set(categoriasSeleccionadas);
    const nuevosArticulos = new Set(articulosSeleccionados);

    if (estaSeleccionado) {
      todasCategorias.forEach(cat => nuevasCategorias.delete(cat));
      todosArticulos.forEach(art => nuevosArticulos.delete(art));
    } else {
      todasCategorias.forEach(cat => nuevasCategorias.add(cat));
      todosArticulos.forEach(art => nuevosArticulos.add(art));
    }

    setCategoriasSeleccionadas(Array.from(nuevasCategorias));
    setArticulosSeleccionados(Array.from(nuevosArticulos));
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

        <Button onClick={() => setModalOpen(true)} variant="contained" style={{backgroundColor: '#285a73'}}>
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
              Selecciona Categorías y Artículos
            </Typography>

            {loading ? (
              <Typography>Cargando artículos...</Typography>
            ) : (
              <Box sx={{ maxHeight: '60vh', overflowY: 'auto', pr: 1 }}>
                {agruparPorSubrubro(todosArticulos).map((subrubro, index) => {
                  const subrubroArticulosDisponibles = subrubro.rubros.flatMap(rubro =>
                    rubro.articulos.filter(art => !isArticuloSeleccionado(art))
                  );

                  const { checked: subrubroChecked, indeterminate: subrubroIndeterminado } = evaluarCheckboxEstado(
                    subrubroArticulosDisponibles,
                    articulosSeleccionados,
                    isArticuloSeleccionado
                  );

                  return (
                    <Accordion key={index}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Checkbox
                          checked={subrubroChecked}
                          indeterminate={subrubroIndeterminado}
                          onChange={() => handleSelectSubrubro(subrubro)}
                          sx={{ mr: 1 }}
                        />
                        <Typography fontWeight="bold">{subrubro.nombre}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        {subrubro.rubros.map((rubro, idx) => {
                          const { checked: rubroChecked, indeterminate: rubroIndeterminado } = evaluarCheckboxEstado(
                            rubro.articulos,
                            articulosSeleccionados,
                            isArticuloSeleccionado
                          );

                          return (
                            <Accordion key={idx} sx={{ mb: 1 }}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Checkbox
                                  checked={rubroChecked}
                                  indeterminate={rubroIndeterminado}
                                  onChange={() => handleSelectCategoria(rubro.nombre, rubro.articulos)}
                                  sx={{ mr: 1 }}
                                />
                                <Typography>{rubro.nombre}</Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                {filterArticulos(rubro.articulos).map((articulo) => (
                                  <Box key={articulo.id} display="flex" alignItems="center" sx={{ pl: 2 }}>
                                    <Checkbox
                                      checked={articulosSeleccionados.includes(articulo)}
                                      onChange={() => handleSelectArticulo(articulo)}
                                      sx={{ mr: 1 }}
                                      disabled={isArticuloSeleccionado(articulo)}
                                    />
                                    <Typography>{articulo.nombre}</Typography>
                                  </Box>
                                ))}
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
            actualizarAgrupaciones();
            mostrarSnackbar("Agrupación actualizada");
          }}
        />
      </div>
    </>
  );
};

export default Agrupaciones;