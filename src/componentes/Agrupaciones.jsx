import React, { useEffect, useMemo, useState } from "react";
import { Button, Snackbar, Alert } from "@mui/material";

import AgrupacionesList from "./AgrupacionesList";
import AgrupacionCreateModal from "./AgrupacionCreateModal";

import { ensureTodo } from "../servicios/apiAgrupacionesTodo";
import { BusinessesAPI } from "../servicios/apiBusinesses";
import { obtenerAgrupaciones } from "../servicios/apiAgrupaciones";

// === Helpers de mapeo/árbol (idénticos a tu versión) ===
const mapRowToArticle = (row) => {
  const raw = row?.raw || {};
  const id = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
  return {
    id,
    nombre: row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`,
    categoria: row?.categoria ?? raw?.categoria ?? raw?.rubro ?? "Sin categoría",
    subrubro: row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? "Sin subrubro",
    precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
  };
};

const buildTree = (flatList = []) => {
  const cats = new Map();
  for (const a of flatList) {
    if (!Number.isFinite(a.id)) continue;
    const cat = a.categoria || "Sin categoría";
    const sr = a.subrubro || "Sin subrubro";
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

export default function Agrupaciones({ actualizarAgrupaciones }) {
  const [todosArticulos, setTodosArticulos] = useState([]);   // árbol categoría/subrubro
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);

  // Snackbar general (de lista/acciones externas)
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMensaje, setSnackbarMensaje] = useState("");
  const [snackbarTipo, setSnackbarTipo] = useState("success");
  const showSnack = (msg, type = "success") => {
    setSnackbarMensaje(msg);
    setSnackbarTipo(type);
    setSnackbarOpen(true);
  };

  const cargarAgrupaciones = async () => {
    try {
      const data = await obtenerAgrupaciones();
      setAgrupaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar agrupaciones:", error);
      showSnack("Error al cargar agrupaciones", "error");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const bizId = localStorage.getItem("activeBusinessId");
        if (!bizId) {
          setTodosArticulos([]);
          setLoading(false);
          showSnack("Seleccioná un local activo primero", "warning");
          return;
        }

        // Artículos desde nuestra BD
        const res = await BusinessesAPI.articlesFromDB(bizId);
        const flat = (res?.items || []).map(mapRowToArticle).filter(a => Number.isFinite(a.id));
        setTodosArticulos(buildTree(flat));
        setLoading(false);

        // Garantizar TODO (idempotente)
        try { await ensureTodo(); } catch { }

        // Agrupaciones
        await cargarAgrupaciones();
      } catch (error) {
        console.error("Error al cargar los datos:", error);
        setLoading(false);
        showSnack("Error al cargar datos", "error");
      }
    })();
  }, []);

  const assignedIds = useMemo(() => {
    const s = new Set();
    (Array.isArray(agrupaciones) ? agrupaciones : [])
      .filter(Boolean)
      .filter(g => (g?.nombre || '').toUpperCase() !== 'TODO')
      .forEach(g => {
        const arts = Array.isArray(g?.articulos) ? g.articulos : [];
        arts.filter(Boolean).forEach(a => {
          const id = Number(a?.id);
          if (Number.isFinite(id)) s.add(String(id));
        });
      });
    return s;
  }, [agrupaciones]);

  // Artículo bloqueado = ya pertenece a otra agrupación (excepto TODO)
  const isArticuloBloqueado = (articulo) => assignedIds.has(String(articulo.id));

  return (
    <>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarTipo} sx={{ width: "100%" }}>
          {snackbarMensaje}
        </Alert>
      </Snackbar>

      <div className="p-4">
        <h2 className="text-xl font-bold">Agrupaciones</h2>

        <Button
          onClick={() => setModalOpen(true)}
          variant="contained"
          style={{ backgroundColor: "#285a73", marginTop: 8, marginBottom: 16 }}
        >
          Nueva agrupación
        </Button>

        {/* MODAL REUTILIZABLE con toda la lógica de creación */}
        <AgrupacionCreateModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={async (nombreCreado) => {
            await cargarAgrupaciones();
            actualizarAgrupaciones?.();
            showSnack(`Agrupación "${nombreCreado}" creada correctamente`);
          }}
          todosArticulos={todosArticulos}
          loading={loading}
          isArticuloBloqueado={isArticuloBloqueado}
        />
        <AgrupacionesList
          agrupaciones={agrupaciones}
          onActualizar={async () => {
            await cargarAgrupaciones();
            actualizarAgrupaciones?.();
            showSnack("Agrupación actualizada");
          }}
          todoGroupId={(agrupaciones.find(g => (g?.nombre || "").toUpperCase() === "TODO") || {}).id}
          todosArticulos={todosArticulos}
          loading={loading}
        />
      </div>
    </>
  );
}
