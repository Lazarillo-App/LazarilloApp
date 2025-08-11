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
  const [seleccionIds, setSeleccionIds] = useState([]); // IDs, no objetos
  const [searchQuery, setSearchQuery] = useState('');
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [nombresEditados, setNombresEditados] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const token = await obtenerToken();
      const articulos = await obtenerArticulos(token);
      setTodosArticulos(Array.isArray(articulos) ? articulos : []);
    };
    fetchData();
  }, []);

  const handleAgregarArticulos = (agrupacion) => {
    setAgrupacionSeleccionada({
      ...agrupacion,
      articulos: Array.isArray(agrupacion.articulos) ? agrupacion.articulos : []
    });
    setSeleccionIds([]);
    setModalOpen(true);
  };

  const handleSelectArticulo = (articuloId) => {
    setSeleccionIds(prev =>
      prev.includes(articuloId)
        ? prev.filter(id => id !== articuloId)
        : [...prev, articuloId]
    );
  };

  const filterArticulos = (articulos) => {
    const list = Array.isArray(articulos) ? articulos : [];
    return list.filter(a =>
      (a.nombre || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const agregarArticulosAGrupacion = async () => {
    if (!agrupacionSeleccionada || seleccionIds.length === 0) return;

    try {
      // armamos payload completo (id, nombre, categoria, subrubro, precio)
      const mapa = new Map(todosArticulos.map(a => [a.id, a]));
      const payload = seleccionIds
        .map(id => mapa.get(id))
        .filter(Boolean)
        .map(a => ({
          id: a.id,
          nombre: a.nombre || '',
          categoria: a.categoria || 'Sin categoría',
          subrubro: a.subrubro || 'Sin subrubro',
          precio: a.precio ?? 0
        }));

      // usar la ruta específica de agregar artículos, no la que reemplaza todo
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/agrupaciones/${agrupacionSeleccionada.id}/articulos`,
        { articulos: payload }
      );

      setModalOpen(false);
      setSeleccionIds([]);
      onActualizar(); // refresca lista en el padre
    } catch (error) {
      console.error("Error agregando artículos:", error);
    }
  };

  const handleEliminarAgrupacion = async (id) => {
    try {
      await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones/${id}`);
      onActualizar();
    } catch (error) {
      console.error("Error al eliminar agrupación:", error);
    }
  };

  const manejarGuardar = async (id) => {
    const nuevoNombre = (nombresEditados[id] ?? '').trim();
    if (!nuevoNombre) return;

    try {
      await axios.put(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones/${id}`, {
        nombre: nuevoNombre
      });
      setEditandoId(null);
      setNombresEditados(prev => ({ ...prev, [id]: '' }));
      onActualizar();
    } catch (error) {
      console.error("Error al actualizar nombre:", error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Agrupaciones Creadas</h2>

      {(Array.isArray(agrupaciones) ? agrupaciones : []).map((agrupacion) => (
        <Accordion key={agrupacion.id}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" width="100%" justifyContent="space-between">
              {editandoId === agrupacion.id ? (
                <>
                  <TextField
                    value={nombresEditados[agrupacion.id] ?? agrupacion.nombre ?? ''}
                    onChange={(e) =>
                      setNombresEditados(prev => ({ ...prev, [agrupacion.id]: e.target.value }))
                    }
                    size="small"
                    autoFocus
                    sx={{ mr: 2, flexGrow: 1 }}
                  />
                  <IconButton onClick={() => manejarGuardar(agrupacion.id)} color="success" size="small">
                    <span role="img" aria-label="Guardar">💾</span>
                  </IconButton>
                </>
              ) : (
                <>
                  <Typography variant="h6">{agrupacion.nombre}</Typography>
                  <Box>
                    <IconButton onClick={() => setEditandoId(agrupacion.id)} color="primary" size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton onClick={() => handleEliminarAgrupacion(agrupacion.id)} color="error" size="small">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </>
              )}
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box display="flex" justifyContent="space-between" sx={{ mb: 2 }}>
              <Button variant="contained" size="small" onClick={() => handleAgregarArticulos(agrupacion)}>
                Agregar Artículos
              </Button>
            </Box>

            {(Array.isArray(agrupacion.articulos) && agrupacion.articulos.length > 0) ? (
              agrupacion.articulos.map((art) => (
                <Box key={art.id} display="flex" alignItems="center" sx={{ mb: 1 }}>
                  <Typography>{art.nombre || 'Sin nombre'}</Typography>
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
              // ocultar los que ya están en la agrupación
              const yaEsta = (agrupacionSeleccionada?.articulos || []).some(a => a.id === articulo.id);
              if (yaEsta) return null;

              return (
                <Box key={articulo.id} display="flex" alignItems="center" sx={{ pl: 2, mb: 1 }}>
                  <Checkbox
                    checked={seleccionIds.includes(articulo.id)}
                    onChange={() => handleSelectArticulo(articulo.id)}
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
              disabled={seleccionIds.length === 0}
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