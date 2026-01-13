/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Button, Snackbar, Alert } from "@mui/material";
import {
  findAutoGroupSuggestions,
  groupSuggestionsByTarget,
  applyAutoGrouping,
} from '@/servicios/autoGrouping';
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

  const [autoGroupModal, setAutoGroupModal] = useState({
    open: false,
    suggestions: [],
    loading: false,
  });

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
    const all = Array.isArray(todosArticulos) ? todosArticulos : [];

    // IDs de artículos que ya están en alguna agrupación REAL (no el TODO)
    const assignedIds = new Set();

    (agrupaciones || [])
      .filter((g) => !isRealTodoGroup(g, todoGroupId))  // 👈 excluimos el TODO
      .forEach((g) => {
        (g.articulos || []).forEach((a) => {
          const id = Number(a.id);
          if (Number.isFinite(id)) assignedIds.add(id);
        });
      });

    // sobrantes = todos - los que ya están en alguna agrupación
    return all.filter((a) => !assignedIds.has(Number(a.id)));
  }, [todosArticulos, agrupaciones, todoGroupId]);

  // Conteo real de "sin agrupación" = todos - (asignados  excluidos)
  const todoCount = useMemo(() => {
    let count = 0;
    for (const id of allIds) {
      if (!idsEnOtras.has(id) && !excludedIds.has(id)) count++; // ← FIX
    }
    return count;
  }, [allIds, idsEnOtras, excludedIds]);

  const checkForAutoGrouping = useCallback(async () => {
    try {
      // Artículos que NO están en ninguna agrupación (excepto excluidos)
      const newArticles = [];

      for (const sub of todosArticulos || []) {
        for (const cat of sub.categorias || []) {
          for (const art of cat.articulos || []) {
            const id = Number(art.id);
            if (!Number.isFinite(id)) continue;

            // Verificar si está en alguna agrupación
            const isAssigned = idsEnOtras.has(id);
            const isExcluded = excludedIds.has(id);

            if (!isAssigned && !isExcluded) {
              newArticles.push(art);
            }
          }
        }
      }

      if (newArticles.length === 0) {
        console.log('✅ No hay artículos nuevos sin agrupar');
        return;
      }

      console.log(`📦 ${newArticles.length} artículos sin agrupar detectados`);

      // Buscar sugerencias de auto-agrupación
      const suggestions = findAutoGroupSuggestions(
        newArticles,
        agrupaciones.filter((g) => !isRealTodoGroup(g, effectiveTodoGroupId)),
        todosArticulos
      );

      if (suggestions.length === 0) {
        console.log('ℹ️ No se encontraron coincidencias para auto-agrupar');
        return;
      }

      console.log(`💡 ${suggestions.length} sugerencias de auto-agrupación encontradas`);

      // Agrupar sugerencias por grupo destino
      const grouped = groupSuggestionsByTarget(suggestions);

      // Mostrar modal
      setAutoGroupModal({
        open: true,
        suggestions: grouped,
        loading: false,
      });
    } catch (error) {
      console.error('Error al verificar auto-agrupación:', error);
    }
  }, [todosArticulos, agrupaciones, idsEnOtras, excludedIds, effectiveTodoGroupId]);

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

        // Garantizar TODO + exclusiones
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

        // 🆕 VERIFICAR AUTO-AGRUPACIÓN después de cargar todo
        setTimeout(() => {
          checkForAutoGrouping();
        }, 500); // pequeño delay para asegurar que todo está cargado

      } catch (error) {
        console.error("Error al cargar los datos:", error);
        setLoading(false);
        showSnack("Error al cargar datos", "error");
      }
    })();
  }, []);

  // 5️⃣ HANDLER PARA APLICAR AUTO-AGRUPACIÓN (línea ~280):

  /**
   * Aplica las sugerencias de auto-agrupación seleccionadas
   */
  const handleApplyAutoGrouping = async (selectedSuggestions) => {
    setAutoGroupModal((prev) => ({ ...prev, loading: true }));

    try {
      const { success, failed } = await applyAutoGrouping(selectedSuggestions, httpBiz);

      // Mutaciones optimistas locales
      selectedSuggestions.forEach((sug) => {
        onMutateGroups?.({
          type: 'append',
          groupId: sug.suggestedGroupId,
          articulos: [{ id: sug.articleId }],
        });
      });

      // Refetch para consolidar
      await cargarAgrupaciones();

      // Emitir evento global
      emitGroupsChanged('auto-group', {
        count: success,
        failed,
      });

      // Actualizar padre
      actualizarAgrupaciones?.();

      // Cerrar modal y mostrar resultado
      setAutoGroupModal({ open: false, suggestions: [], loading: false });

      if (failed === 0) {
        showSnack(`✅ ${success} artículo${success !== 1 ? 's' : ''} agrupado${success !== 1 ? 's' : ''} automáticamente`, 'success');
      } else {
        showSnack(`✅ ${success} agrupados, ⚠️ ${failed} fallaron`, 'warning');
      }
    } catch (error) {
      console.error('Error al aplicar auto-agrupación:', error);
      showSnack('Error al agrupar artículos automáticamente', 'error');
      setAutoGroupModal((prev) => ({ ...prev, loading: false }));
    }
  };

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
