// src/componentes/Agrupaciones.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Button, Modal, Typography, TextField, Checkbox,
  Accordion, AccordionSummary, AccordionDetails, Box,
  Snackbar, Alert
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import AgrupacionesList from "./AgrupacionesList";
import { ensureTodo } from "../servicios/apiAgrupacionesTodo";
import { BusinessesAPI } from "../servicios/apiBusinesses";
import { obtenerAgrupaciones, crearAgrupacion } from "../servicios/apiAgrupaciones";

const evaluarCheckboxEstado = (articulos, articulosSeleccionados, isArticuloBloqueado) => {
  const disponibles = articulos.filter(art => !isArticuloBloqueado(art));
  const total = disponibles.length;
  const seleccionados = disponibles.filter(art =>
    articulosSeleccionados.some(s => Number(s.id) === Number(art.id))
  ).length;
  return {
    checked: total > 0 && seleccionados === total,
    indeterminate: seleccionados > 0 && seleccionados < total
  };
};

// ✅ Mapea una fila de BD (plana) a artículo
const mapRowToArticle = (row) => {
  const raw = row?.raw || {};
  const id  = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
  return {
    id,
    nombre   : row?.nombre    ?? raw?.nombre    ?? raw?.descripcion ?? `#${id}`,
    categoria: row?.categoria ?? raw?.categoria ?? raw?.rubro       ?? 'Sin categoría',
    subrubro : row?.subrubro  ?? raw?.subrubro  ?? raw?.subRubro    ?? 'Sin subrubro',
    precio   : Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
  };
};

// Construye el árbol categoría → subrubro → artículos
const buildTree = (flatList = []) => {
  const cats = new Map();
  for (const a of flatList) {
    if (!Number.isFinite(a.id)) continue;
    const cat = a.categoria || 'Sin categoría';
    const sr  = a.subrubro  || 'Sin subrubro';
    if (!cats.has(cat)) cats.set(cat, { id: cat, nombre: cat, subrubros: [] });
    const catObj = cats.get(cat);
    let srObj = catObj.subrubros.find(s => s.nombre === sr);
    if (!srObj) { srObj = { nombre: sr, articulos: [] }; catObj.subrubros.push(srObj); }
    srObj.articulos.push({
      id: a.id,
      nombre: a.nombre,
      categoria: cat,
      subrubro: sr,
      precio: a.precio
    });
  }
  return Array.from(cats.values());
};

const Agrupaciones = ({ actualizarAgrupaciones }) => {
  const [rubro, setRubro] = useState("");
  const [todosArticulos, setTodosArticulos] = useState([]); // árbol categoría/subrubro
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
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
      const data = await obtenerAgrupaciones(); // ← ahora scopiado por negocio
      setAgrupaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar agrupaciones:", error);
      mostrarSnackbar("Error al cargar agrupaciones", 'error');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // 1) Artículos desde **nuestra BD**
        const bizId = localStorage.getItem('activeBusinessId');
        if (!bizId) {
          setTodosArticulos([]);
          setLoading(false);
          mostrarSnackbar("Seleccioná un local activo primero", 'warning');
          return;
        }

        const res = await BusinessesAPI.articlesFromDB(bizId);
        const flat = (res?.items || []).map(mapRowToArticle).filter(a => Number.isFinite(a.id));
        setTodosArticulos(buildTree(flat));
        setLoading(false);

        // 2) Garantizar TODO (idempotente)
        try { await ensureTodo(); } catch {}

        // 3) Agrupaciones
        await cargarAgrupaciones();
      } catch (error) {
        console.error("Error al cargar los datos:", error);
        setLoading(false);
        mostrarSnackbar("Error al cargar datos", 'error');
      }
    })();
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
    setArticulosSeleccionados((prev) => {
      const tieneAlguno = candidatos.some(a => prev.some(p => Number(p.id) === Number(a.id)));
      return tieneAlguno
        ? prev.filter(p => !candidatos.some(a => Number(a.id) === Number(p.id)))
        : [...prev, ...candidatos];
    });
  };

  const handleSelectArticulo = (articulo) => {
    if (isArticuloBloqueado(articulo)) return; // ya tomado por otra agrupación
    setArticulosSeleccionados((prev) =>
      prev.some(x => Number(x.id) === Number(articulo.id))
        ? prev.filter((x) => Number(x.id) !== Number(articulo.id))
        : [...prev, articulo]
    );
  };

  const crearAgrupacionHandler = async () => {
    if (!rubro.trim() || articulosSeleccionados.length === 0) {
      mostrarSnackbar("Debes ingresar un nombre y seleccionar artículos", 'error');
      return;
    }
    try {
      await crearAgrupacion({
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

  // Agrupar por subrubro (solo UI)
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
                      <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                        <Checkbox
                          checked={checked}
                          indeterminate={indeterminate}
                          onChange={() => {
                            const disponibles = subrubro.rubros.flatMap(r =>
                              r.articulos.filter(a => !isArticuloBloqueado(a))
                            );
                            setArticulosSeleccionados(prev => {
                              const tieneAlguno = disponibles.some(a => prev.some(p => Number(p.id) === Number(a.id)));
                              return tieneAlguno
                                ? prev.filter(p => !disponibles.some(a => Number(a.id) === Number(p.id)))
                                : [...prev, ...disponibles];
                            });
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
                              <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
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
                                  const seleccionado = articulosSeleccionados.some(a => Number(a.id) === Number(articulo.id));
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
                onClick={crearAgrupacionHandler}
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
          todoGroupId={(agrupaciones.find(g => (g?.nombre || '').toUpperCase() === 'TODO') || {}).id}
        />
      </div>
    </>
  );
};

export default Agrupaciones;


