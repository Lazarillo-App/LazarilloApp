// src/componentes/AgrupacionesList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Accordion, AccordionSummary, AccordionDetails, Typography,
  IconButton, Button, Modal, Checkbox, TextField, Box, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import axios from 'axios';
import { BASE } from '../servicios/apiBase';

// 👇 Helper: detecta el grupo TODO por id o por nombre
const esTodoGroup = (g, todoGroupId) => {
  const nombre = String(g?.nombre || '').trim().toUpperCase();
  return g?.id === todoGroupId || nombre === 'TODO' || nombre === 'SIN AGRUPACIÓN';
};

const AgrupacionesList = ({ agrupaciones, onActualizar, todoGroupId }) => {
  const [todosArticulos, setTodosArticulos] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [seleccionIds, setSeleccionIds] = useState([]); // IDs, no objetos
  const [searchQuery, setSearchQuery] = useState('');
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [nombresEditados, setNombresEditados] = useState({});

  // Cargar catálogo de Maxi (para agregar artículos y para calcular “libres”)
  useEffect(() => {
    const fetchData = async () => {
      const token = await obtenerToken();
      const articulos = await obtenerArticulos(token);
      setTodosArticulos(Array.isArray(articulos) ? articulos : []);
    };
    fetchData();
  }, []);

  // Aplanado maestro de artículos Maxi
  const maxiAll = useMemo(() => {
    const out = [];
    (todosArticulos || []).forEach(cat => {
      (cat.subrubros || []).forEach(sr => {
        (sr.articulos || []).forEach(a => {
          out.push({
            id: Number(a.id),
            nombre: a.nombre || '',
            categoria: cat.nombre,
            subrubro: sr.nombre,
            precio: a.precio ?? 0,
          });
        });
      });
    });
    return out;
  }, [todosArticulos]);

  // IDs ya asignados a alguna agrupación distinta de TODO
  const assignedIds = useMemo(() => {
    const s = new Set();
    (agrupaciones || [])
      .filter(g => !esTodoGroup(g, todoGroupId)) // 👈 ignoramos TODO por id/nombre
      .forEach(g => (g.articulos || []).forEach(a => s.add(Number(a.id))));
    return s;
  }, [agrupaciones, todoGroupId]);

  // Artículos “libres” que deben mostrarse dentro del acordeón Sin Agrupación (ex-TODO)
  const libresEnTODO = useMemo(
    () => maxiAll.filter(a => !assignedIds.has(a.id)),
    [maxiAll, assignedIds]
  );

  // --- UI/acciones ---

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
    const list = Array.isArray(articulos) ? articulos : articulos;
    return list.filter(a =>
      (a.nombre || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const agregarArticulosAGrupacion = async () => {
    if (!agrupacionSeleccionada || seleccionIds.length === 0) return;

    try {
      const mapa = new Map();
      (todosArticulos || []).forEach(cat => {
        (cat.subrubros || []).forEach(sr => {
          (sr.articulos || []).forEach(a =>
            mapa.set(Number(a.id), { ...a, categoria: cat.nombre, subrubro: sr.nombre })
          );
        });
      });

      const payload = seleccionIds
        .map(id => mapa.get(Number(id)))
        .filter(Boolean)
        .map(a => ({
          id: a.id,
          nombre: a.nombre || '',
          categoria: a.categoria || 'Sin categoría',
          subrubro: a.subrubro || 'Sin subrubro',
          precio: a.precio ?? 0
        }));

      await axios.put(`${BASE}/agrupaciones/${agrupacionSeleccionada.id}/articulos`,
        { articulos: payload }
      );

      setModalOpen(false);
      setSeleccionIds([]);
      onActualizar?.();
    } catch (error) {
      console.error("Error agregando artículos:", error);
    }
  };

  const handleEliminarAgrupacion = async (id) => {
    try {
      await axios.delete(`${BASE}/agrupaciones/${id}`);
      onActualizar?.();
    } catch (error) {
      console.error("Error al eliminar agrupación:", error);
    }
  };

  const manejarGuardar = async (id) => {
    const nuevoNombre = (nombresEditados[id] ?? '').trim();
    if (!nuevoNombre) return;

    try {
      await axios.put(`${BASE}/agrupaciones/${id}`, {
        nombre: nuevoNombre
      });
      setEditandoId(null);
      setNombresEditados(prev => ({ ...prev, [id]: '' }));
      onActualizar?.();
    } catch (error) {
      console.error("Error al actualizar nombre:", error);
    }
  };

  // Quitar un artículo de un grupo normal (vuelve a quedar “libre” → visible en Sin Agrupación)
  const quitarDeAgrupacion = async (grupoId, articuloId) => {
    try {
      await axios.delete(`${BASE}/agrupaciones/${grupoId}/articulos/${articuloId}`);
      onActualizar?.();
    } catch (e) {
      console.error("No se pudo quitar el artículo", e);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Agrupaciones Creadas</h2>

      {(Array.isArray(agrupaciones) ? agrupaciones : []).map((agrupacion) => {
        const isTodo = esTodoGroup(agrupacion, todoGroupId);
        const displayName = isTodo ? 'Sin Agrupación' : (agrupacion.nombre || '');

        return (
          <Accordion key={agrupacion.id}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" width="100%" justifyContent="space-between">
                {editandoId === agrupacion.id && !isTodo ? (
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
                    <Typography variant="h6">
                      {displayName} {isTodo && '🔒'}
                    </Typography>
                    <Box>
                      {!isTodo && (
                        <>
                          <IconButton onClick={() => setEditandoId(agrupacion.id)} color="primary" size="small">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton onClick={() => handleEliminarAgrupacion(agrupacion.id)} color="error" size="small">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </>
                )}
              </Box>
            </AccordionSummary>

            <AccordionDetails>
              <Box display="flex" justifyContent="space-between" sx={{ mb: 2 }}>
                {!isTodo ? (
                  <Button variant="contained" size="small" onClick={() => handleAgregarArticulos(agrupacion)}>
                    Agregar Artículos
                  </Button>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Sin Agrupación contiene los artículos que aún no pertenecen a ninguna agrupación.
                  </Typography>
                )}
              </Box>

              {/* Lista de artículos para grupos normales */}
              {!isTodo && (Array.isArray(agrupacion.articulos) && agrupacion.articulos.length > 0) ? (
                agrupacion.articulos.map((art) => (
                  <Box key={art.id} display="flex" alignItems="center" sx={{ mb: 1, gap: 1 }}>
                    <Typography sx={{ flexGrow: 1 }}>{art.nombre || 'Sin nombre'}</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={()=>quitarDeAgrupacion(agrupacion.id, art.id)}
                    >
                      Quitar de {displayName}
                    </Button>
                  </Box>
                ))
              ) : !isTodo ? (
                <Typography variant="body2" color="textSecondary">
                  No hay artículos en esta agrupación
                </Typography>
              ) : (
                // Vista de Sin Agrupación (ex TODO): mostramos los “libres”
                <>
                  <Typography sx={{ fontWeight: 600, mb: 1 }}>
                    {libresEnTODO.length} artículo(s) en Sin Agrupación
                  </Typography>
                  {libresEnTODO.slice(0, 100).map(a => (
                    <Box key={a.id} sx={{ display:'flex', gap:1, mb:.5 }}>
                      <Typography sx={{ flex: 1 }}>#{a.id} — {a.nombre}</Typography>
                      <Typography variant="caption">{a.categoria} / {a.subrubro}</Typography>
                    </Box>
                  ))}
                  {libresEnTODO.length > 100 && (
                    <Typography variant="caption" color="text.secondary">
                      (+{libresEnTODO.length - 100} más…)
                    </Typography>
                  )}
                </>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}

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
            {filterArticulos(
              (todosArticulos || []).flatMap(cat =>
                (cat.subrubros || []).flatMap(sr => (sr.articulos || []))
              )
            ).map((articulo) => {
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