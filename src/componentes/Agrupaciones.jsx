/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Button, Snackbar, Alert } from "@mui/material";

import AgrupacionesList from "./AgrupacionesList";
import AgrupacionCreateModal from "./AgrupacionCreateModal";
import { applyCreateGroup, applyAppend, applyRemove, applyMove } from '@/utils/groupMutations';
import { emitGroupsChanged } from "@/utils/groupsBus";
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
    // En DB ya viene SWAP: categoria = subrubro Maxi, subrubro = rubro Maxi
    categoria: row?.categoria ?? raw?.categoria ?? raw?.rubro ?? "Sin categoría",
    subrubro: row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? "Sin subrubro",
    precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
  };
};

// normaliza nombres para comparar sin tildes / mayúsculas
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();


const isRealTodoGroup = (g, todoGroupId) => {
  if (!g) return false;
  if (!Number.isFinite(Number(todoGroupId))) return false;
  if (Number(g.id) !== Number(todoGroupId)) return false;
  const n = norm(g.nombre);
  // nombres “oficiales” del TODO virtual
  return n === 'todo' || n === 'sin agrupacion';
};

/** Árbol correcto esperado por el Modal:
 *  [
 *    { subrubro, categorias: [{categoria, articulos:[{id,nombre,precio,...}]}] }
 *  ]
 */
const buildTree = (flatList = []) => {
  const bySub = new Map(); // subrubro -> (categoria -> artículos[])
  for (const a of flatList) {
    if (!Number.isFinite(a?.id)) continue;
    const sub = a.subrubro || "Sin subrubro";    // padre
    const cat = a.categoria || "Sin categoría";  // hijo
    if (!bySub.has(sub)) bySub.set(sub, new Map());
    const byCat = bySub.get(sub);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push({
      id: a.id,
      nombre: a.nombre,
      precio: a.precio,
      categoria: cat,
      subrubro: sub,
    });
  }

  const tree = [];
  for (const [subrubro, byCat] of bySub.entries()) {
    const categorias = [];
    for (const [categoria, articulos] of byCat.entries()) {
      categorias.push({ categoria, articulos });
    }
    categorias.sort((a, b) =>
      String(a.categoria).localeCompare(String(b.categoria), "es", { sensitivity: "base", numeric: true })
    );
    tree.push({ subrubro, categorias });
  }
  tree.sort((a, b) =>
    String(a.subrubro).localeCompare(String(b.subrubro), "es", { sensitivity: "base", numeric: true })
  );
  return tree;
};

export default function Agrupaciones({ actualizarAgrupaciones }) {
  const [todosArticulos, setTodosArticulos] = useState([]); // árbol subrubro → categorías
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

  // ✅ Solo consideramos "virtual" al grupo TODO si sigue teniendo el nombre default
  const effectiveTodoGroupId = useMemo(() => {
    if (!todoGroupId) return null;

    const g = (agrupaciones || []).find(
      x => Number(x.id) === Number(todoGroupId)
    );
    if (!g) return todoGroupId; // todavía no cargó la lista

    const n = norm(g.nombre);
    const esNombreTodo =
      n === 'todo' ||
      n === 'sin agrupacion' ||
      n === 'sin agrupación' ||
      n === 'sin agrupar' ||
      n === 'sin grupo';

    // ⬅️ Si ya NO se llama "Sin agrupación"/"TODO", desactivamos modo virtual
    return esNombreTodo ? todoGroupId : null;
  }, [agrupaciones, todoGroupId]);


  const cargarAgrupaciones = async () => {
    try {
      const data = await obtenerAgrupaciones();
      setAgrupaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar agrupaciones:", error);
      showSnack("Error al cargar agrupaciones", "error");
    }
  };


  // --- baseById (opcional) para enriquecer mutaciones con datos del árbol actual ---
  const baseById = useMemo(() => {
    const m = new Map();
    for (const sub of todosArticulos || []) {
      for (const c of sub.categorias || []) {
        for (const a of c.articulos || []) {
          const id = Number(a?.id);
          if (Number.isFinite(id)) m.set(id, a);
        }
      }
    }
    return m;
  }, [todosArticulos]);

  // --- mutador local optimista para la vista Agrupaciones ---
  const onMutateGroups = useCallback((action) => {
    setAgrupaciones((prev) => {
      switch (action?.type) {
        case 'create':
          return applyCreateGroup(prev, {
            id: Number(action.id),
            nombre: action.nombre,
            articulos: Array.isArray(action.articulos) ? action.articulos : [],
          });
        case 'append':
          return applyAppend(prev, {
            groupId: Number(action.groupId),
            articulos: Array.isArray(action.articulos) ? action.articulos : [],
            baseById, // para completar nombre/categoria/subrubro si falta
          });
        case 'remove':
          return applyRemove(prev, {
            groupId: Number(action.groupId),
            ids: (action.ids || []).map(Number).filter(Boolean),
          });
        case 'move':
          return applyMove(prev, {
            fromId: Number(action.fromId),
            toId: Number(action.toId),
            ids: (action.ids || []).map(Number).filter(Boolean),
            baseById,
          });
        default:
          return prev;
      }
    });
  }, [baseById]);

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

        // Artículos desde nuestra BD -> a árbol subrubro→categorías→artículos
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
      .filter((g) => g?.id !== effectiveTodoGroupId)
      .forEach((g) => {
        const arts = Array.isArray(g?.articulos) ? g.articulos : [];
        arts.forEach((a) => {
          const id = Number(a?.id);
          if (Number.isFinite(id)) s.add(String(id));
        });
      });
    return s;
  }, [agrupaciones, effectiveTodoGroupId]);


  // Artículo bloqueado = ya pertenece a otra agrupación (excepto TODO)
  const isArticuloBloqueado = (articulo) => assignedIds.has(String(articulo.id));

  // Flatten de ids desde el árbol (subrubro→categorías→artículos)
  const allIds = useMemo(() => {
    const out = [];
    for (const sub of todosArticulos || []) {
      for (const cat of sub?.categorias || []) {
        for (const a of cat?.articulos || []) {
          const id = Number(a?.id);
          if (Number.isFinite(id)) out.push(id);
        }
      }
    }
    return out;
  }, [todosArticulos]);

  const idsEnOtras = useMemo(() => {
    const s = new Set();
    (agrupaciones || [])
      .filter(Boolean)
      .filter((g) => g?.id !== effectiveTodoGroupId)
      .forEach((g) =>
        (g?.articulos || []).forEach((a) => {
          const id = Number(a?.id);
          if (Number.isFinite(id)) s.add(id);
        })
      );
    return s;
  }, [agrupaciones, effectiveTodoGroupId]);

  // Artículos visibles para el TODO virtual (desde el nuevo árbol)
  const todoVirtualArticulos = useMemo(() => {
    const out = [];
    for (const sub of todosArticulos || []) {
      for (const cat of sub?.categorias || []) {
        for (const a of cat?.articulos || []) {
          const id = Number(a?.id);
          if (!Number.isFinite(id)) continue;
          if (idsEnOtras.has(id) || excludedIds.has(id)) continue;
          out.push({
            id,
            nombre: a?.nombre ?? `#${id}`,
            categoria: a?.categoria ?? cat?.categoria ?? "Sin categoría",
            subrubro: a?.subrubro ?? sub?.subrubro ?? "Sin subrubro",
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
      if (!idsEnOtras.has(id) && !excludedIds.has(id)) count++; // ← FIX
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

        <AgrupacionCreateModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={async (nombreCreado, newGroupId, articulos) => {
            // mutación optimista local
            onMutateGroups({
              type: 'create',
              id: newGroupId,
              nombre: nombreCreado,
              articulos: articulos || [],
            });
            // emite evento global (Home escucha y refetch)
            emitGroupsChanged("create", {
              groupId: Number(newGroupId),
              count: (articulos || []).length
            });
            // refetch para consolidar
            await cargarAgrupaciones();
            actualizarAgrupaciones?.();
            showSnack(`Agrupación "${nombreCreado}" creada correctamente`);
          }}
          todosArticulos={todosArticulos}
          loading={loading}
          isArticuloBloqueado={isArticuloBloqueado}
        />

        <AgrupacionesList
          onMutateGroups={onMutateGroups}
          agrupaciones={agrupaciones}
          onActualizar={cargarAgrupaciones}
          todoGroupId={effectiveTodoGroupId}
          todosArticulos={todosArticulos}
          loading={loading}
          todoCountOverride={effectiveTodoGroupId ? todoCount : 0}
          todoVirtualArticulos={effectiveTodoGroupId ? todoVirtualArticulos : []}
        />
      </div>
    </>
  );
}
