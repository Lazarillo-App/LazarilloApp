// src/componentes/Agrupaciones.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Button, Snackbar, Alert } from "@mui/material";

import AgrupacionesList from "./AgrupacionesList";
import AgrupacionCreateModal from "./AgrupacionCreateModal";

import { ensureTodo, getExclusiones } from "../servicios/apiAgrupacionesTodo";
import { BusinessesAPI } from "../servicios/apiBusinesses";
import { obtenerAgrupaciones } from "../servicios/apiAgrupaciones";

// === Helpers de mapeo/árbol ===
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
    let srObj = catObj.subrubros.find((s) => s.nombre === sr);
    if (!srObj) {
      srObj = { nombre: sr, articulos: [] };
      catObj.subrubros.push(srObj);
    }
    srObj.articulos.push({
      id: a.id,
      nombre: a.nombre,
      categoria: cat,
      subrubro: sr,
      precio: a.precio,
    });
  }
  return Array.from(cats.values());
};

export default function Agrupaciones({ actualizarAgrupaciones }) {
  const [todosArticulos, setTodosArticulos] = useState([]); // árbol categoría/subrubro
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set()); // exclusiones de TODO

  // Modal crear agrupación
  const [modalOpen, setModalOpen] = useState(false);

  // Snackbar general
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
        const flat = (res?.items || []).map(mapRowToArticle).filter((a) => Number.isFinite(a.id));
        setTodosArticulos(buildTree(flat));
        setLoading(false);

        // Garantizar TODO  exclusiones
        try {
          const todo = await ensureTodo();
          if (todo?.id) {
            setTodoGroupId(todo.id);
            try {
              const ex = await getExclusiones(todo.id);
              const ids = (ex || [])
                .filter((e) => e.scope === "articulo")
                .map((e) => Number(e.ref_id))
                .filter(Boolean);
              setExcludedIds(new Set(ids));
            } catch {
              setExcludedIds(new Set());
            }
          }
        } catch {
          // si falla, seguimos sin TODO virtual pero sin romper UI
        }

        // Agrupaciones
        await cargarAgrupaciones();
      } catch (error) {
        console.error("Error al cargar los datos:", error);
        setLoading(false);
        showSnack("Error al cargar datos", "error");
      }
    })();
  }, []);

  // ids asignados a otras agrupaciones (excepto TODO)
  const assignedIds = useMemo(() => {
    const s = new Set();
    (Array.isArray(agrupaciones) ? agrupaciones : [])
      .filter(Boolean)
      .filter((g) => (g?.nombre || "").toUpperCase() !== "Sin Agrupación")
      .forEach((g) => {
        const arts = Array.isArray(g?.articulos) ? g.articulos : [];
        arts
          .filter(Boolean)
          .forEach((a) => {
            const id = Number(a?.id);
            if (Number.isFinite(id)) s.add(String(id));
          });
      });
    return s;
  }, [agrupaciones]);

  // Artículo bloqueado = ya pertenece a otra agrupación (excepto TODO)
  const isArticuloBloqueado = (articulo) => assignedIds.has(String(articulo.id));

  // Flatten de ids desde el árbol para contar TODO virtual
  const allIds = useMemo(() => {
    const out = [];
    for (const cat of todosArticulos || []) {
      for (const sr of cat?.subrubros || []) {
        for (const a of sr?.articulos || []) {
          const id = Number(a?.id);
          if (Number.isFinite(id)) out.push(id);
        }
      }
    }
    return out;
  }, [todosArticulos]);

  // ids asignados a otras agrupaciones (numérico)
  const idsEnOtras = useMemo(() => {
    const s = new Set();
    (agrupaciones || [])
      .filter(Boolean)
      .filter((g) => (g?.nombre || "").toUpperCase() !== "Sin Agrupación")
      .forEach((g) =>
        (g?.articulos || []).forEach((a) => {
          const id = Number(a?.id);
          if (Number.isFinite(id)) s.add(id);
        })
      );
    return s;
  }, [agrupaciones]);

  const todoVirtualArticulos = useMemo(() => {
    const out = [];
    for (const cat of todosArticulos || []) {
      for (const sr of cat?.subrubros || []) {
        for (const a of sr?.articulos || []) {
          const id = Number(a?.id);
          if (!Number.isFinite(id)) continue;
          if (idsEnOtras.has(id) || excludedIds.has(id)) continue;
          out.push({
            id,
            nombre: a?.nombre ?? `#${id}`,
            categoria: a?.categoria ?? cat?.nombre ?? "Sin categoría",
            subrubro: a?.subrubro ?? sr?.nombre ?? "Sin subrubro",
            precio: a?.precio ?? 0,
          });
        }
      }
    }
    return out;
  }, [todosArticulos, idsEnOtras, excludedIds]);

  // Conteo real de "sin agrupación" = todos - (asignados  excluidos)
  const todoCount = useMemo(() => {
    let count = 0;
    for (const id of allIds) {
      if (!idsEnOtras.has(id) && !excludedIds.has(id)) count; // 👈 importante!
    }
    return count;
  }, [allIds, idsEnOtras, excludedIds]);

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
          onActualizar={cargarAgrupaciones}     
          todoGroupId={todoGroupId}             
          todosArticulos={todosArticulos}       
          loading={loading}
          todoCountOverride={todoCount}        
          todoVirtualArticulos={todoVirtualArticulos}
        />
      </div>
    </>
  );
}
