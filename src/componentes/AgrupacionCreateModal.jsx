import React, { useMemo, useState, useEffect } from "react";
import {
  Modal, Box, Typography, Checkbox, Accordion, AccordionSummary,
  AccordionDetails, Button, TextField, Snackbar, Alert
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { crearAgrupacion } from "../servicios/apiAgrupaciones";
import { httpBiz } from "../servicios/apiBusinesses";

// === Helpers ===
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

// subrubro → rubro(categoría) → artículos
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

export default function AgrupacionCreateModal({
  open,
  onClose,
  todosArticulos = [],
  loading = false,
  isArticuloBloqueado = () => false,
  mode = "create",
  groupId,
  groupName,
  onCreated,
  onAppended,
  saveButtonLabel,
  initialSelectedIds
}) {
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  useEffect(() => {
    if (Array.isArray(initialSelectedIds) && initialSelectedIds.length) {
      // tomamos del árbol los artículos cuyo id está en initialSelectedIds
      const byId = new Map();
      (props.todosArticulos || []).forEach(cat =>
        cat.subrubros.forEach(sr =>
          sr.articulos.forEach(a => byId.set(Number(a.id), a))
        )
      );
      setArticulosSeleccionados(
        initialSelectedIds.map(Number).map(id => byId.get(id)).filter(Boolean)
      );
    }
  }, [initialSelectedIds, props.todosArticulos]);

  const [rubro, setRubro] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMensaje, setSnackbarMensaje] = useState("");
  const [snackbarTipo, setSnackbarTipo] = useState("success");
  const showSnack = (msg, type = "success") => {
    setSnackbarMensaje(msg);
    setSnackbarTipo(type);
    setSnackbarOpen(true);
  };

  const handleSelectCategoria = (_categoriaNombre, articulos) => {
    const candidatos = articulos.filter(a => !isArticuloBloqueado(a));
    setArticulosSeleccionados((prev) => {
      const yaTieneAlguno = candidatos.some(a => prev.some(p => Number(p.id) === Number(a.id)));
      return yaTieneAlguno
        ? prev.filter(p => !candidatos.some(a => Number(a.id) === Number(p.id)))
        : [...prev, ...candidatos];
    });
  };

  const handleSelectArticulo = (articulo) => {
    if (isArticuloBloqueado(articulo)) return;
    setArticulosSeleccionados((prev) =>
      prev.some(x => Number(x.id) === Number(articulo.id))
        ? prev.filter((x) => Number(x.id) !== Number(articulo.id))
        : [...prev, articulo]
    );
  };

  const guardar = async () => {
    if (mode === "create") {
      if (!rubro.trim() || articulosSeleccionados.length === 0) {
        showSnack("Debes ingresar un nombre y seleccionar artículos", "error");
        return;
      }
      try {
        await crearAgrupacion({
          nombre: rubro,
          articulos: articulosSeleccionados.map((art) => ({
            id: art.id,
            nombre: art.nombre || "",
            categoria: art.categoria || "Sin categoría",
            subrubro: art.subrubro || "Sin subrubro",
            precio: art.precio ?? 0,
          })),
        });
        const nombreCreado = rubro;
        setRubro("");
        setArticulosSeleccionados([]);
        onCreated?.(nombreCreado);
        showSnack(`Agrupación "${nombreCreado}" creada correctamente`);
        setTimeout(() => {
          setSnackbarOpen(false);
          onClose?.();
        }, 600);
      } catch (err) {
        console.error("Error al crear agrupación:", err);
        showSnack("Error al crear agrupación", "error");
      }
      return;
    }

    // mode === "append"
    if (!Number.isFinite(Number(groupId)) || articulosSeleccionados.length === 0) {
      showSnack("Seleccioná al menos un artículo", "error");
      return;
    }
    try {
      await httpBiz(`/agrupaciones/${groupId}/articulos`, {
        method: "PUT",
        body: {
          ids: articulosSeleccionados.map(a => Number(a.id)),
        },
      });
      const n = articulosSeleccionados.length;
      setArticulosSeleccionados([]);
      onAppended?.(groupId, n);
      showSnack(`Se agregaron ${n} artículo${n === 1 ? "" : "s"} a "${groupName}"`);
      setTimeout(() => {
        setSnackbarOpen(false);
        onClose?.();
      }, 600);
    } catch (err) {
      console.error("Error al agregar artículos:", err);
      showSnack("Error al agregar artículos", "error");
    }
  };

  const uiSubrubros = useMemo(() => agruparPorSubrubro(todosArticulos), [todosArticulos]);
  const isCreate = mode === "create";

  return (
    <>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2500}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarTipo} sx={{ width: "100%" }}>
          {snackbarMensaje}
        </Alert>
      </Snackbar>

      <Modal open={open} onClose={onClose}>
        <Box
          sx={{
            overflowY: "auto",
            maxHeight: "80vh",
            width: "90%",
            maxWidth: 700,
            margin: "50px auto",
            padding: 3,
            backgroundColor: "white",
            borderRadius: 2,
            boxShadow: 24,
          }}
        >
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {isCreate ? "Crear Agrupación" : `Agregar a "${groupName}"`}
          </Typography>

          {isCreate && (
            <TextField
              label="Nombre del Rubro"
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              fullWidth
              className="mb-4"
              sx={{ mb: 2 }}
            />
          )}

          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Selecciona Categorías y Artículos (solo los que aún están libres)
          </Typography>

          {loading ? (
            <Typography>Cargando artículos...</Typography>
          ) : (
            <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }}>
              {uiSubrubros.map((subrubro, index) => {
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
                                  <Box
                                    key={articulo.id}
                                    display="flex"
                                    alignItems="center"
                                    sx={{ pl: 2, opacity: bloqueado ? 0.5 : 1, pointerEvents: bloqueado ? 'none' : 'auto' }}
                                  >
                                    <Checkbox
                                      checked={seleccionado}
                                      onChange={() => handleSelectArticulo(articulo)}
                                      sx={{ mr: 1 }}
                                     disabled={bloqueado}
                                    />
                                    <Typography>
                                      {articulo.nombre} {bloqueado && "(ya asignado)"}
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
            <Button onClick={onClose} variant="text" sx={{ mr: 1 }}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              variant="contained"
              color="success"
              disabled={(!isCreate && articulosSeleccionados.length === 0) || (isCreate && (!rubro.trim() || articulosSeleccionados.length === 0))}
            >
              {saveButtonLabel ?? (isCreate ? "Guardar Agrupación" : "Agregar a la agrupación")}
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

