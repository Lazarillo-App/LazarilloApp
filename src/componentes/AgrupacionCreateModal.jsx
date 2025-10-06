/* eslint-disable no-empty */
// src/componentes/AgrupacionCreateModal.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Modal, Box, Typography, Checkbox, Accordion, AccordionSummary,
  AccordionDetails, Button, TextField, Snackbar, Alert
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { crearAgrupacion } from "../servicios/apiAgrupaciones";
import { httpBiz } from "../servicios/apiBusinesses";

// === Helpers ===
const evaluarCheckboxEstado = (articulos, articulosSeleccionados, isBlocked) => {
  const disponibles = (articulos || []).filter(art => !isBlocked(art));
  const total = disponibles.length;
  const seleccionados = disponibles.filter(art =>
    articulosSeleccionados.some(s => Number(s?.id) === Number(art?.id))
  ).length;
  return {
    checked: total > 0 && seleccionados === total,
    indeterminate: seleccionados > 0 && seleccionados < total
  };
};

const safeId = (x) => {
  const n = Number(x?.id);
  return Number.isFinite(n) ? n : null;
};

// subrubro → rubro(categoría) → artículos
const agruparPorSubrubro = (data = []) => {
  const agrupado = {};
  (data || []).forEach(rubro => {
    (rubro?.subrubros || []).forEach(subrubro => {
      const subrubroNombre = subrubro?.nombre ?? 'Sin subrubro';
      if (!agrupado[subrubroNombre]) agrupado[subrubroNombre] = [];
      agrupado[subrubroNombre].push({
        nombre: rubro?.nombre ?? 'Sin categoría',
        articulos: (subrubro?.articulos || []),
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
  // 👇 NUEVO: ids a preseleccionar + reglas
  preselect = null, // { articleIds:number[], fromGroupId:number|null, allowAssigned:boolean }
}) {
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [rubro, setRubro] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMensaje, setSnackbarMensaje] = useState("");
  const [snackbarTipo, setSnackbarTipo] = useState("success");
  const showSnack = (msg, type = "success") => {
    setSnackbarMensaje(msg);
    setSnackbarTipo(type);
    setSnackbarOpen(true);
  };

  const uiSubrubros = useMemo(() => agruparPorSubrubro(todosArticulos || []), [todosArticulos]);
  const preselectedIds = useMemo(
    () => new Set((preselect?.articleIds || []).map(n => Number(n)).filter(Number.isFinite)),
    [preselect]
  );

  // Wrapper de bloqueo con excepción: si viene como preseleccionado y allowAssigned=true, NO bloquear
  const isBlocked = useMemo(() => {
    return (art) => {
      const id = safeId(art);
      if (id == null) return true; // artículos sin id → bloqueados
      if (preselect?.allowAssigned && preselectedIds.has(id)) return false;
      try { return !!isArticuloBloqueado(art); } catch { return false; }
    };
  }, [isArticuloBloqueado, preselect, preselectedIds]);

  // Auto-preselección al abrir (y sugerir nombre)
  useEffect(() => {
    if (!open) return;
    // Si hay preselect, seleccionamos por id
    if (preselectedIds.size > 0) {
      const seleccion = [];
      let suggestedSubrubro = '';
      for (const sr of uiSubrubros) {
        for (const rc of (sr?.rubros || [])) {
          for (const a of (rc?.articulos || [])) {
            const id = safeId(a);
            if (id != null && preselectedIds.has(id)) {
              seleccion.push(a);
              if (!suggestedSubrubro) suggestedSubrubro = sr?.nombre || '';
            }
          }
        }
      }
      if (seleccion.length) setArticulosSeleccionados(seleccion);
      // si es creación y no hay nombre aún, sugerimos por subrubro (o groupName si vino)
      if (mode === 'create' && !rubro.trim()) {
        setRubro(groupName || suggestedSubrubro || rubro);
      }
    } else {
      // limpiar selección si no hay preselect
      setArticulosSeleccionados([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedIds, uiSubrubros, mode]);

  const handleSelectCategoria = (_categoriaNombre, articulos) => {
    const candidatos = (articulos || []).filter(a => !isBlocked(a));
    setArticulosSeleccionados((prev) => {
      const yaTieneAlguno = candidatos.some(a => prev.some(p => safeId(p) === safeId(a)));
      return yaTieneAlguno
        ? prev.filter(p => !candidatos.some(a => safeId(a) === safeId(p)))
        : [...prev, ...candidatos];
    });
  };

  const handleSelectArticulo = (articulo) => {
    if (isBlocked(articulo)) return;
    setArticulosSeleccionados((prev) => {
      const id = safeId(articulo);
      return prev.some(x => safeId(x) === id)
        ? prev.filter((x) => safeId(x) !== id)
        : [...prev, articulo];
    });
  };

  const guardar = async () => {
    if (mode === "create") {
      if (!rubro.trim() || articulosSeleccionados.length === 0) {
        showSnack("Debes ingresar un nombre y seleccionar artículos", "error");
        return;
      }
      try {
        const payload = {
          nombre: rubro.trim(),
          articulos: articulosSeleccionados.map((art) => ({
            id: safeId(art),
            nombre: art?.nombre || "",
            categoria: art?.categoria || "Sin categoría",
            subrubro: art?.subrubro || "Sin subrubro",
            precio: art?.precio ?? 0,
          })),
        };
        const nuevo = await crearAgrupacion(payload); // { id, nombre, ... }
        const newGroupId = Number(nuevo?.id);

        // Si venimos de otra agrupación, quitamos del origen para evitar duplicados
        const fromId = Number(preselect?.fromGroupId);
        if (Number.isFinite(fromId)) {
          const ids = payload.articulos.map(a => a.id).filter(Number.isFinite);
          for (const id of ids) {
            try { await httpBiz(`/agrupaciones/${fromId}/articulos/${id}`, { method: 'DELETE' }); } catch {}
          }
        }

        const nombreCreado = payload.nombre;
        setRubro("");
        setArticulosSeleccionados([]);
        onCreated?.(nombreCreado, newGroupId);
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
    const articulos = articulosSeleccionados
      .map(a => ({
        id: safeId(a),
        nombre: a?.nombre || "",
        categoria: a?.categoria || "Sin categoría",
        subrubro: a?.subrubro || "Sin subrubro",
        precio: a?.precio ?? 0,
      }))
      .filter(x => Number.isFinite(x.id));

    if (!Number.isFinite(Number(groupId)) || articulos.length === 0) {
      showSnack("Seleccioná al menos un artículo", "error");
      return;
    }

    try {
      await httpBiz(`/agrupaciones/${groupId}/articulos`, {
        method: "PUT",
        body: { articulos }, // acepta objetos con metadata
      });

      const n = articulos.length;
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
              sx={{ mb: 2 }}
            />
          )}

          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Seleccioná Categorías y Artículos
          </Typography>

          {loading ? (
            <Typography>Cargando artículos...</Typography>
          ) : (
            <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }}>
              {(uiSubrubros || []).map((subrubro, index) => {
                const rubrosSafe = (subrubro?.rubros || []).filter(Boolean);

                const subrubroArticulosDisponibles = rubrosSafe.flatMap(r =>
                  (r?.articulos || []).filter(Boolean).filter(a => !isBlocked(a))
                );

                const { checked, indeterminate } = evaluarCheckboxEstado(
                  subrubroArticulosDisponibles,
                  articulosSeleccionados,
                  isBlocked
                );

                return (
                  <Accordion key={subrubro?.nombre ?? `sr-${index}`}>
                    <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                      <Checkbox
                        checked={checked}
                        indeterminate={indeterminate}
                        onChange={() => {
                          const disponibles = rubrosSafe.flatMap(r =>
                            (r?.articulos || []).filter(Boolean).filter(a => !isBlocked(a))
                          );
                          setArticulosSeleccionados(prev => {
                            const tieneAlguno = disponibles.some(a =>
                              prev.some(p => safeId(p) === safeId(a))
                            );
                            return tieneAlguno
                              ? prev.filter(p => !disponibles.some(a => safeId(a) === safeId(p)))
                              : [...prev, ...disponibles];
                          });
                        }}
                        sx={{ mr: 1 }}
                      />
                      <Typography fontWeight="bold">{subrubro?.nombre ?? 'Sin subrubro'}</Typography>
                    </AccordionSummary>

                    <AccordionDetails>
                      {rubrosSafe.map((rubroCat, idx) => {
                        const artsSafe = (rubroCat?.articulos || []).filter(Boolean);

                        const { checked: rubroChecked, indeterminate: rubroIndeterminado } =
                          evaluarCheckboxEstado(artsSafe, articulosSeleccionados, isBlocked);

                        return (
                          <Accordion key={`${subrubro?.nombre ?? 'sr'}-${rubroCat?.nombre ?? idx}`} sx={{ mb: 1 }}>
                            <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                              <Checkbox
                                checked={rubroChecked}
                                indeterminate={rubroIndeterminado}
                                onChange={() => handleSelectCategoria(rubroCat?.nombre, artsSafe)}
                                sx={{ mr: 1 }}
                              />
                              <Typography>{rubroCat?.nombre ?? 'Sin categoría'}</Typography>
                            </AccordionSummary>

                            <AccordionDetails>
                              {artsSafe.map((articulo, i) => {
                                const idNum = safeId(articulo);
                                const bloqueado = isBlocked(articulo);
                                const seleccionado = articulosSeleccionados.some(a => safeId(a) === idNum);
                                return (
                                  <Box
                                    key={idNum ?? `art-${i}`}
                                    display="flex"
                                    alignItems="center"
                                    sx={{ pl: 2, opacity: bloqueado ? 0.5 : 1, pointerEvents: bloqueado ? 'none' : 'auto' }}
                                  >
                                    <Checkbox
                                      checked={!!seleccionado}
                                      onChange={() => handleSelectArticulo(articulo)}
                                      sx={{ mr: 1 }}
                                      disabled={bloqueado}
                                    />
                                    <Typography>
                                      {articulo?.nombre ?? '—'} {bloqueado && "(ya asignado)"}
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
              disabled={
                (mode === "create" && (!rubro.trim() || articulosSeleccionados.length === 0)) ||
                (mode !== "create" && articulosSeleccionados.length === 0)
              }
            >
              {saveButtonLabel ?? (mode === "create" ? "Guardar Agrupación" : "Agregar a la agrupación")}
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}
