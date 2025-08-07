import React, { useState, useEffect } from 'react';
import {
  Accordion, AccordionSummary, AccordionDetails, Typography,
  IconButton, Button, Modal, Checkbox, TextField, Box, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import axios from 'axios';

const AgrupacionesList = ({ agrupaciones, onActualizar }) => {
  const [todosArticulos, setTodosArticulos] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [nombresEditados, setNombresEditados] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const token = await obtenerToken();
      const articulos = await obtenerArticulos(token);
      setTodosArticulos(articulos);
    };
    fetchData();
  }, []);

  const handleAgregarArticulos = (agrupacion) => {
    setAgrupacionSeleccionada(agrupacion);
    setModalOpen(true);
  };

  const handleSelectArticulo = (articulo) => {
    setArticulosSeleccionados((prev) =>
      prev.includes(articulo)
        ? prev.filter((item) => item !== articulo)
        : [...prev, articulo]
    );
  };

  const filterArticulos = (articulos) => {
    return articulos.filter((articulo) =>
      articulo.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const agregarArticulosAGrupacion = async () => {
    if (!agrupacionSeleccionada) return;

    try {
      await axios.put(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones/${agrupacionSeleccionada.id}`, {
        articulos: articulosSeleccionados.map((a) => ({
          id: a.id,
          precio: a.precio || 0
        }))
      });

      setModalOpen(false);
      setArticulosSeleccionados([]);
      onActualizar(); // refrescar agrupaciones en el padre
    } catch (error) {
      console.error("Error agregando artículos:", error);
    }
  };

  const handleEliminarAgrupacion = async (id) => {
    try {
      await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones/${id}`);
      onActualizar(); // refrescar agrupaciones en el padre
    } catch (error) {
      console.error("Error al eliminar agrupación:", error);
    }
  };

  const manejarGuardar = async (id) => {
    const nuevoNombre = nombresEditados[id]?.trim();
    if (!nuevoNombre) return;

    try {
      await axios.put(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones/${id}`, {
        nombre: nuevoNombre
      });
      setEditandoId(null);
      setNombresEditados((prev) => ({ ...prev, [id]: '' }));
      onActualizar(); // refrescar agrupaciones
    } catch (error) {
      console.error("Error al actualizar nombre:", error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Agrupaciones Creadas</h1>
      {agrupaciones.map((agrupacion) => (
        <Accordion key={agrupacion.id}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            {editandoId === agrupacion.id ? (
              <TextField
                value={nombresEditados[agrupacion.id] || agrupacion.nombre}
                onChange={(e) =>
                  setNombresEditados((prev) => ({
                    ...prev,
                    [agrupacion.id]: e.target.value,
                  }))
                }
                onBlur={() => manejarGuardar(agrupacion.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') manejarGuardar(agrupacion.id);
                }}
                autoFocus
                size="small"
                sx={{ mr: 2 }}
              />
            ) : (
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                {agrupacion.nombre}
              </Typography>
            )}
            <Box display="flex" alignItems="center">
              <IconButton
                onClick={() => setEditandoId(agrupacion.id)}
                color="primary"
                size="small"
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={() => handleEliminarAgrupacion(agrupacion.id)}
                color="error"
                size="small"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box display="flex" justifyContent="space-between" sx={{ mb: 2 }}>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleAgregarArticulos(agrupacion)}
              >
                Agregar Artículos
              </Button>
            </Box>
            {agrupacion.articulos.length > 0 ? (
              agrupacion.articulos.map((art) => (
                <Box key={art.id} display="flex" alignItems="center" sx={{ mb: 1 }}>
                  <Typography>{art.nombre}</Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="textSecondary">
                No hay artículos en esta agrupación
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Modal para agregar artículos */}
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
          <Typography variant="h6" gutterBottom>
            Agregar artículos a: {agrupacionSeleccionada?.nombre}
          </Typography>

          <TextField
            label="Buscar artículos"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />

          <Box sx={{ maxHeight: '60vh', overflowY: 'auto', pr: 1, mb: 2 }}>
            {filterArticulos(todosArticulos).map((articulo) => {
              if (agrupacionSeleccionada?.articulos.some((a) => a.id === articulo.id)) {
                return null;
              }

              return (
                <Box key={articulo.id} display="flex" alignItems="center" sx={{ pl: 2, mb: 1 }}>
                  <Checkbox
                    checked={articulosSeleccionados.includes(articulo)}
                    onChange={() => handleSelectArticulo(articulo)}
                    sx={{ mr: 1 }}
                  />
                  <Typography>{articulo.nombre}</Typography>
                </Box>
              );
            })}
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              color="success"
              onClick={agregarArticulosAGrupacion}
              disabled={articulosSeleccionados.length === 0}
            >
              Agregar artículos
            </Button>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

export default AgrupacionesList;