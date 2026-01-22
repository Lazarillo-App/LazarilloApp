/* eslint-disable no-unused-vars */
// src/paginas/InsumosMain.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import InsumosSidebar from "../componentes/InsumosSidebar.jsx";
import InsumosTable from "../componentes/InsumosTable.jsx";
import InsumoGroupModal from "../componentes/InsumoGroupModal.jsx";
import Buscador from "../componentes/Buscador.jsx";
import { BusinessesAPI, http } from "../servicios/apiBusinesses";
import {
  insumosList,
  insumoCreate,
  insumoUpdate,
  insumoDelete,
  insumosBulkJSON,
  insumosBulkCSV,
  insumosSyncMaxi,
  insumosRubrosList,
  insumoGroupsList,
  insumoGroupUpdate,
  insumoGroupDelete,
} from "../servicios/apiInsumos";

import BulkJsonModal from "../componentes/BulkJsonModal.jsx";

import { applyMutation } from '../utils/groupMutations';
import {
  ensureTodoInsumos,
  getExclusionesInsumos,
  ensureDiscontinuadosInsumos,
} from '../servicios/apiInsumosTodo';

// ✅ IMPORTAR BUSINESS CONTEXT
import { useBusiness } from '../context/BusinessContext';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Stack,
  Snackbar,
  Alert,
} from "@mui/material";

import '../css/global.css';
import '../css/theme-layout.css';
import "../css/TablaArticulos.css";

const UNIDADES = ["kg", "g", "lt", "ml", "un"];

/* ================== HELPERS ================== */
const norm = (s) => String(s || '').trim().toLowerCase();

const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return (
    n === 'todo' ||
    n === 'sin agrupacion' ||
    n === 'sin agrupación' ||
    n === 'sin agrupar' ||
    n === 'sin grupo'
  );
};

const esDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

/* ================== COMPONENTE PRINCIPAL ================== */
export default function InsumosMain() {
  /* ================== 1️⃣ BUSINESS CONTEXT ================== */
  const {
    effectiveBusinessId,
    activeBusiness,
    activeSubnegocio,
    activeBusinessId,
    activeSubnegocioId,
  } = useBusiness() || {};

  // businessId es el ID efectivo (subnegocio si existe, sino negocio principal)
  const businessId = effectiveBusinessId || null;

  // Nombre para mostrar en el título
  const businessName = useMemo(() => {
    if (activeSubnegocio?.nombre) {
      return `${activeBusiness?.nombre || 'Negocio'} › ${activeSubnegocio.nombre}`;
    }
    return activeBusiness?.nombre || null;
  }, [activeBusiness, activeSubnegocio]);

  /* ================== 2️⃣ ESTADO BÁSICO ================== */
  const [rubroSeleccionado, setRubroSeleccionado] = useState(null);
  const [vista, setVista] = useState("no-elaborados");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [allInsumos, setAllInsumos] = useState([]);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [rubrosMap, setRubrosMap] = useState(new Map());

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    unidadMed: "",
    precioRef: "",
  });

  const [openBulk, setOpenBulk] = useState(false);
  const [insumosSearchOptions, setInsumosSearchOptions] = useState([]);
  const [jumpToInsumoId, setJumpToInsumoId] = useState(null);
  const [selectedInsumoId, setSelectedInsumoId] = useState(null);

  const lastManualPickRef = useRef(0);
  const isJumpingRef = useRef(false);
  const jumpCleanupTRef = useRef(null);

  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });

  /* ================== 3️⃣ AGRUPACIONES ================== */
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalInitialGroupId, setGroupModalInitialGroupId] = useState(null);
  const [groupModalInsumo, setGroupModalInsumo] = useState(null);
  const [groupModalRubroLabel, setGroupModalRubroLabel] = useState(null);
  const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now());

  const [viewPrefs, setViewPrefs] = useState({});

  /* ================== 3️⃣.5️⃣ idToIndex STATE ================== */
  const idToIndexRef = useRef(new Map());
  const [idToIndexVersion, setIdToIndexVersion] = useState(0);

  /* ================== 4️⃣ CALLBACKS BÁSICOS ================== */
  const notify = useCallback((msg, type = 'success') => {
    setSnack({ open: true, msg, type });
  }, []);

  const forceRefresh = useCallback(() => {
    setRefreshTimestamp(Date.now());
  }, []);

  const onMutateGroups = useCallback((action) => {
    setGroups(prev => applyMutation(prev, action));
  }, []);

  const markManualPick = useCallback(() => {
    lastManualPickRef.current = Date.now();
  }, []);

  // 🆕 CALLBACK ESTABLE para recibir idToIndex desde InsumosTable
  const handleIdToIndexChange = useCallback((newMap) => {
    idToIndexRef.current = newMap;
    setIdToIndexVersion(v => v + 1);
  }, []);

  /* ================== 5️⃣ CARGAR PREFERENCIAS ================== */
  useEffect(() => {
    if (!businessId) return;

    const loadPrefs = async () => {
      try {
        const [viewRes, favRes] = await Promise.all([
          BusinessesAPI.getViewPrefs(businessId),
          BusinessesAPI.getFavoriteGroup(businessId, 'insumo'),
        ]);

        if (viewRes?.ok) setViewPrefs(viewRes.byGroup || {});

        if (favRes?.ok) {
          const favIdFromDb = Number(favRes.favoriteGroupId);
          if (Number.isFinite(favIdFromDb) && favIdFromDb > 0) {
            console.log('🌟 [InsumosMain] Favorita cargada desde backend:', favIdFromDb);
            setFavoriteGroupId(favIdFromDb);
          }
        }
      } catch (e) {
        console.error('Error loading insumos prefs', e);
      }
    };

    loadPrefs();
  }, [businessId]);

  /* ================== 6️⃣ CARGAR RUBROS ================== */
  const loadRubros = useCallback(async () => {
    if (!businessId) {
      setRubrosMap(new Map());
      return;
    }

    try {
      const res = await insumosRubrosList(businessId);
      const items = res?.items || res?.data || [];

      const map = new Map();
      items.forEach(rubro => {
        const codigo = String(rubro.codigo);
        map.set(codigo, {
          codigo: rubro.codigo,
          nombre: rubro.nombre || `Rubro ${codigo}`,
          es_elaborador: rubro.es_elaborador === true,
        });
      });

      setRubrosMap(map);
    } catch (e) {
      console.error('[loadRubros] Error:', e);
      setRubrosMap(new Map());
    }
  }, [businessId]);

  /* ================== 7️⃣ CARGAR INSUMOS ================== */
  const loadAllInsumos = useCallback(async () => {
    if (!businessId) {
      setAllInsumos([]);
      return;
    }

    try {
      const r = await insumosList({
        page: 1,
        limit: 999999,
        search: "",
      });

      const data = Array.isArray(r.data) ? r.data : [];
      setAllInsumos(data);
    } catch (e) {
      console.error("[loadAllInsumos]", e);
      setAllInsumos([]);
    }
  }, [businessId]);

  /* ================== 8️⃣ CARGAR GRUPOS ================== */
  const loadGroups = useCallback(async () => {
    if (!businessId) {
      setGroups([]);
      setFavoriteGroupId(null);
      setGroupsError("");
      return;
    }

    setGroupsLoading(true);
    setGroupsError("");
    try {
      const res = await insumoGroupsList();
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];

      setGroups(list);
    } catch (e) {
      console.error("[InsumosMain] Error al cargar grupos:", e);
      setGroups([]);
      setFavoriteGroupId(null);
      setGroupsError(e.message || "Error al cargar agrupaciones");
    } finally {
      setGroupsLoading(false);
    }
  }, [businessId]);

  /* ================== 9️⃣ CARGAR CATÁLOGO COMPLETO ================== */
  const loadCatalogoCompleto = useCallback(async () => {
    if (!businessId) {
      setExcludedIds(new Set());
      setTodoGroupId(null);
      return;
    }

    try {
      const todoGroup = await ensureTodoInsumos();
      setTodoGroupId(todoGroup?.id || null);

      if (todoGroup?.id) {
        const exclusiones = await getExclusionesInsumos(todoGroup.id);
        const ids = exclusiones
          .filter(e => e.scope === 'insumo')
          .map(e => Number(e.ref_id))
          .filter(Boolean);
        setExcludedIds(new Set(ids));
      }

      await ensureDiscontinuadosInsumos();
      await loadGroups();

    } catch (e) {
      console.error('[loadCatalogoCompleto] Error:', e);
      setExcludedIds(new Set());
      setTodoGroupId(null);
    }
  }, [businessId, loadGroups]);

  /* ================== 🔟 ESCUCHAR EVENTOS DE CAMBIO DE NEGOCIO ================== */
  useEffect(() => {
    const handleBusinessSwitch = () => {
      console.log('🔔 [InsumosMain] business:switched o subnegocio:switched');
      forceRefresh();
    };

    window.addEventListener('business:switched', handleBusinessSwitch);
    window.addEventListener('subnegocio:switched', handleBusinessSwitch);

    return () => {
      window.removeEventListener('business:switched', handleBusinessSwitch);
      window.removeEventListener('subnegocio:switched', handleBusinessSwitch);
    };
  }, [forceRefresh]);

  /* ================== 1️⃣1️⃣ RECARGA AL CAMBIAR NEGOCIO/SUBNEGOCIO ================== */
  useEffect(() => {
    if (!businessId) {
      console.log('⚠️ [InsumosMain] Sin businessId, limpiando');
      setAllInsumos([]);
      setRows([]);
      setGroups([]);
      setRubrosMap(new Map());
      setSelectedGroupId(null);
      setRubroSeleccionado(null);
      setTodoGroupId(null);
      setExcludedIds(new Set());
      return;
    }

    console.log('🔄 [InsumosMain] effectiveBusinessId cambió a:', businessId);

    let isCancelled = false;

    const recargarTodo = async () => {
      if (isCancelled) return;

      // Limpiar estado previo
      setAllInsumos([]);
      setRows([]);
      setGroups([]);
      setRubrosMap(new Map());
      setSelectedGroupId(null);
      setRubroSeleccionado(null);
      setTodoGroupId(null);
      setExcludedIds(new Set());
      setPage(1);

      await new Promise(resolve => setTimeout(resolve, 100));
      if (isCancelled) return;

      try {
        // Cargar rubros
        console.log('📚 [recargarTodo] Cargando rubros...');
        const resRubros = await insumosRubrosList(businessId);
        if (isCancelled) return;

        const items = resRubros?.items || resRubros?.data || [];
        const map = new Map();
        items.forEach(rubro => {
          const codigo = String(rubro.codigo);
          map.set(codigo, {
            codigo: rubro.codigo,
            nombre: rubro.nombre || `Rubro ${codigo}`,
            es_elaborador: rubro.es_elaborador === true,
          });
        });
        setRubrosMap(map);

        // Cargar insumos
        console.log('📦 [recargarTodo] Cargando insumos...');
        const resInsumos = await insumosList({
          page: 1,
          limit: 999999,
          search: "",
        });
        if (isCancelled) return;

        const data = Array.isArray(resInsumos.data) ? resInsumos.data : [];
        setAllInsumos(data);

        // Cargar catálogo (TODO, Discontinuados, grupos)
        console.log('🔧 [recargarTodo] Cargando catálogo...');
        const todoGroup = await ensureTodoInsumos();
        if (isCancelled) return;

        setTodoGroupId(todoGroup?.id || null);

        if (todoGroup?.id) {
          const exclusiones = await getExclusionesInsumos(todoGroup.id);
          if (isCancelled) return;

          const ids = exclusiones
            .filter(e => e.scope === 'insumo')
            .map(e => Number(e.ref_id))
            .filter(Boolean);
          setExcludedIds(new Set(ids));
        }

        try {
          await ensureDiscontinuadosInsumos();
        } catch (e) {
          console.error('⚠️ [recargarTodo] Error en Discontinuados:', e);
        }

        if (isCancelled) return;

        // Cargar grupos
        console.log('📋 [recargarTodo] Cargando grupos...');
        const res = await insumoGroupsList();
        if (isCancelled) return;

        const list = Array.isArray(res?.data) ? res.data :
          Array.isArray(res) ? res : [];

        setGroups(list);

        console.log('✅ [recargarTodo] Completado - Groups:', list.length, '- Insumos:', data.length);
      } catch (e) {
        console.error('❌ [recargarTodo] Error:', e);
      }
    };

    recargarTodo();

    return () => {
      isCancelled = true;
    };
  }, [businessId]);

  /* ================== 1️⃣2️⃣ ESCUCHAR business:synced ================== */
  useEffect(() => {
    const onBizSynced = () => {
      console.log('🔔 [InsumosMain] Evento business:synced recibido');
      forceRefresh();
    };

    window.addEventListener('business:synced', onBizSynced);

    return () => {
      window.removeEventListener('business:synced', onBizSynced);
    };
  }, [forceRefresh]);

  /* ================== 1️⃣3️⃣ CÁLCULOS DERIVADOS ================== */
  const discontinuadosGroupId = useMemo(() => {
    const g = (groups || []).find(esDiscontinuadosGroup);
    return g ? Number(g.id) : null;
  }, [groups]);

  const idsSinAgrup = useMemo(() => {
    if (!allInsumos.length || !groups.length) {
      return new Set();
    }

    const todos = new Set(allInsumos.map(i => Number(i.id)));
    const usados = new Set();

    (groups || []).forEach(g => {
      const gId = Number(g.id);

      if (todoGroupId && gId === todoGroupId) return;
      if (discontinuadosGroupId && gId === discontinuadosGroupId) return;

      (g.items || g.insumos || []).forEach(it => {
        const id = Number(it.insumo_id ?? it.id);
        if (Number.isFinite(id)) usados.add(id);
      });
    });

    const resultado = new Set();
    todos.forEach(id => {
      if (!usados.has(id) && !excludedIds.has(id)) {
        resultado.add(id);
      }
    });

    return resultado;
  }, [allInsumos, groups, todoGroupId, discontinuadosGroupId, excludedIds]);

  const rubrosTree = useMemo(() => {
    if (!allInsumos.length) {
      return [];
    }

    if (rubrosMap.size === 0) {
      return [];
    }

    const map = new Map();

    allInsumos.forEach(insumo => {
      const rubroCodigo = String(insumo.rubro_codigo || insumo.rubro || '');
      const rubroInfo = rubrosMap.get(rubroCodigo) || {
        codigo: rubroCodigo,
        nombre: rubroCodigo || 'Sin rubro',
        es_elaborador: false,
      };

      const rubroNombre = rubroInfo.nombre;

      if (!map.has(rubroNombre)) {
        map.set(rubroNombre, {
          nombre: rubroNombre,
          codigo: rubroInfo.codigo,
          es_elaborador: rubroInfo.es_elaborador,
          insumos: [],
        });
      }

      map.get(rubroNombre).insumos.push(insumo);
    });

    return Array.from(map.values());
  }, [allInsumos, rubrosMap]);

  const insumosGroupIndex = useMemo(() => {
    const byInsumoId = new Map();

    (groups || []).forEach(g => {
      if (esTodoGroup(g) || esDiscontinuadosGroup(g)) return;

      const items = g.items || g.insumos || [];
      items.forEach(item => {
        const id = Number(item.insumo_id ?? item.id);
        if (!Number.isFinite(id)) return;

        if (!byInsumoId.has(id)) {
          byInsumoId.set(id, new Set());
        }
        byInsumoId.get(id).add(Number(g.id));
      });
    });

    return { byInsumoId };
  }, [groups]);

  const visibleIds = useMemo(() => {
    if (!selectedGroupId) {
      return null;
    }

    const gId = Number(selectedGroupId);
    const grupoSeleccionado = groups.find(g => Number(g.id) === gId);

    if (!grupoSeleccionado) {
      return null;
    }

    if (esDiscontinuadosGroup(grupoSeleccionado)) {
      const discIds = new Set();
      (grupoSeleccionado.items || grupoSeleccionado.insumos || []).forEach(item => {
        const id = Number(item.insumo_id ?? item.id);
        if (Number.isFinite(id)) discIds.add(id);
      });
      return discIds;
    }

    if (todoGroupId && gId === todoGroupId) {
      return idsSinAgrup;
    }

    const s = new Set();
    const items = grupoSeleccionado.items || grupoSeleccionado.insumos || [];

    items.forEach(item => {
      const id = Number(item.insumo_id ?? item.id);
      if (Number.isFinite(id)) s.add(id);
    });

    return s;
  }, [selectedGroupId, groups, todoGroupId, idsSinAgrup]);

  /* ================== 1️⃣4️⃣ SELECCIÓN INTELIGENTE: TODO vs FAVORITA ================== */
  useEffect(() => {
    if (isJumpingRef.current) {
      return;
    }

    const todoId = todoGroupId;
    const todoEmpty = idsSinAgrup.size === 0;

    const recentlyPicked = Date.now() - lastManualPickRef.current < 800;
    if (recentlyPicked) {
      return;
    }

    const groupsReady = Array.isArray(groups) && groups.length > 0;
    if (!groupsReady) {
      return;
    }

    const isTodoSelected =
      selectedGroupId && Number(selectedGroupId) === Number(todoId);

    if (todoEmpty) {
      const fav = (groups || []).find(
        (g) => Number(g?.id) === Number(favoriteGroupId)
      );

      if (fav) {
        if (!selectedGroupId || Number(selectedGroupId) !== Number(fav.id)) {
          setSelectedGroupId(fav.id);
          setRubroSeleccionado(null);
        }
      } else {
        const firstWithItems = groups.find(g => {
          const gId = Number(g.id);
          if (gId === todoId) return false;
          const items = g.items || g.insumos || [];
          return items.length > 0;
        });

        if (firstWithItems && (!selectedGroupId || Number(selectedGroupId) === Number(todoId))) {
          setSelectedGroupId(firstWithItems.id);
          setRubroSeleccionado(null);
        }
      }
    } else {
      if (
        !isTodoSelected &&
        Number.isFinite(Number(todoId)) &&
        todoId
      ) {
        setSelectedGroupId(Number(todoId));
        setRubroSeleccionado(null);
      }
    }
  }, [
    todoGroupId,
    idsSinAgrup,
    favoriteGroupId,
    groups,
    selectedGroupId,
  ]);

  /* ================== 1️⃣5️⃣ BUSCADOR ================== */
  const loadInsumosSearchOptions = useCallback(async () => {
    if (!businessId) {
      setInsumosSearchOptions([]);
      return;
    }
    try {
      const data = allInsumos;

      const opts = data
        .map((ins) => {
          const id = Number(ins.id);
          if (!Number.isFinite(id)) return null;

          const nombre = (ins.nombre || "").trim() || `#INS-${id}`;
          const codigo =
            ins.codigo_mostrar ||
            (ins.codigo_maxi && ins.codigo_maxi.trim() !== ""
              ? ins.codigo_maxi
              : `INS-${id}`);

          return {
            id,
            label: `[INS] ${codigo} · ${nombre}`,
            value: nombre,
          };
        })
        .filter(Boolean);

      setInsumosSearchOptions(opts);
    } catch (e) {
      console.error("[InsumosMain] Error al cargar opciones de buscador:", e);
      setInsumosSearchOptions([]);
    }
  }, [businessId, allInsumos]);

  useEffect(() => {
    loadInsumosSearchOptions();
  }, [loadInsumosSearchOptions]);

  /* ================== 1️⃣6️⃣ NAVEGACIÓN Y SCROLL ================== */
  const getRubroLabel = useCallback((row) => {
    const code = row.rubro_codigo ?? row.rubroCodigo ?? row.codigo_rubro ?? row.rubro ?? null;

    if (code != null) {
      const rubroInfo = rubrosMap.get(String(code));
      if (rubroInfo?.nombre) {
        return rubroInfo.nombre;
      }
    }

    return row.rubro_nombre || row.rubroNombre || (code != null ? `Rubro ${code}` : "Sin rubro");
  }, [rubrosMap]);

  // REF PARA VirtualList
  const listRef = useRef(null);
  const lastJumpedIdRef = useRef(null);

  // refs para poder cancelar timers
  const scrollT1Ref = useRef(null);
  const scrollT2Ref = useRef(null);
  const domIntervalRef = useRef(null);

  useEffect(() => {
    const id = Number(jumpToInsumoId);

    if (!Number.isFinite(id) || id <= 0) return;

    // Limpiar timers/interval previos
    if (scrollT1Ref.current) { clearTimeout(scrollT1Ref.current); scrollT1Ref.current = null; }
    if (scrollT2Ref.current) { clearTimeout(scrollT2Ref.current); scrollT2Ref.current = null; }
    if (domIntervalRef.current) { clearInterval(domIntervalRef.current); domIntervalRef.current = null; }

    const idx = idToIndexRef.current.get(id);

    if (idx != null) {
      if (lastJumpedIdRef.current === id) return;
      lastJumpedIdRef.current = id;

      scrollT1Ref.current = setTimeout(() => {
        listRef.current?.scrollToIndex(idx);

        scrollT2Ref.current = setTimeout(() => {
          const el = document.querySelector(`[data-insumo-id="${id}"]`);
          if (el) {
            el.classList.add("highlight-jump");
            setTimeout(() => el.classList.remove("highlight-jump"), 1400);
          }

          setJumpToInsumoId(null);
          isJumpingRef.current = false;
        }, 40);
      }, 0);

      return;
    }

    // Fallback DOM con reintentos
    const tryScroll = () => {
      const el = document.querySelector(`[data-insumo-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.add("highlight-jump");
        setTimeout(() => el.classList.remove("highlight-jump"), 1400);

        lastJumpedIdRef.current = id;

        setJumpToInsumoId(null);
        isJumpingRef.current = false;
        return true;
      }
      return false;
    };

    let tries = 0;
    domIntervalRef.current = setInterval(() => {
      if (tryScroll() || tries++ > 12) {
        clearInterval(domIntervalRef.current);
        domIntervalRef.current = null;

        if (tries > 12) {
          isJumpingRef.current = false;
        }
      }
    }, 60);

    return () => {
      if (scrollT1Ref.current) { clearTimeout(scrollT1Ref.current); scrollT1Ref.current = null; }
      if (scrollT2Ref.current) { clearTimeout(scrollT2Ref.current); scrollT2Ref.current = null; }
      if (domIntervalRef.current) { clearInterval(domIntervalRef.current); domIntervalRef.current = null; }
    };
  }, [jumpToInsumoId, idToIndexVersion]);

  useEffect(() => {
    if (!jumpToInsumoId) {
      lastJumpedIdRef.current = null;
    }
  }, [jumpToInsumoId]);

  const focusInsumo = useCallback(
    (rawId, preferGroupId = null) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) return;

      if (jumpCleanupTRef.current) {
        clearTimeout(jumpCleanupTRef.current);
        jumpCleanupTRef.current = null;
      }

      const alreadyVisible = !visibleIds || visibleIds.has(id);
      const groupsSet = insumosGroupIndex.byInsumoId.get(id) || new Set();
      const allGroups = groups || [];

      let targetGroupId = null;

      if (preferGroupId != null) {
        const prefNum = Number(preferGroupId);
        if (Number.isFinite(prefNum)) {
          const exists = allGroups.some(g => Number(g.id) === prefNum);
          if (exists) targetGroupId = prefNum;
        }
      }

      if (!targetGroupId) {
        if (alreadyVisible) {
          targetGroupId = selectedGroupId ?? null;
        } else if (groupsSet.size > 0) {
          for (const gid of groupsSet) {
            const n = Number(gid);
            if (Number.isFinite(n) && n > 0) {
              targetGroupId = n;
              break;
            }
          }
        } else if (Number.isFinite(Number(todoGroupId))) {
          const t = Number(todoGroupId);
          if (t > 0) targetGroupId = t;
        }
      }

      isJumpingRef.current = true;

      const shouldChangeGroup =
        targetGroupId &&
        (!selectedGroupId || Number(selectedGroupId) !== Number(targetGroupId));

      if (shouldChangeGroup) {
        markManualPick();
        setSelectedGroupId(targetGroupId);
        setRubroSeleccionado(null);
        setPage(1);
      }

      setSelectedInsumoId(id);
      setJumpToInsumoId(id);

      jumpCleanupTRef.current = setTimeout(() => {
        setJumpToInsumoId(null);
        isJumpingRef.current = false;
        jumpCleanupTRef.current = null;
      }, 350);
    },
    [
      visibleIds,
      insumosGroupIndex,
      todoGroupId,
      selectedGroupId,
      groups,
      markManualPick,
    ]
  );

  /* ================== 1️⃣7️⃣ HANDLERS AGRUPACIONES ================== */
  const handleSelectGroupId = useCallback((rawId) => {
    const n = Number(rawId);
    const id = Number.isFinite(n) && n > 0 ? n : null;

    markManualPick();

    setSelectedGroupId(id);
    setPage(1);
    setRubroSeleccionado(null);
  }, [markManualPick]);

  const handleToggleFavorite = useCallback(async (groupId) => {
    try {
      const newFav = favoriteGroupId === groupId ? null : groupId;

      await BusinessesAPI.saveFavoriteGroup(businessId, newFav, 'insumo');
      setFavoriteGroupId(newFav);

      notify(newFav ? 'Agrupación marcada como favorita' : 'Favorita removida', 'success');
    } catch (e) {
      console.error('Error saving favorite group', e);
      notify('Error al guardar favorita', 'error');
    }
  }, [businessId, favoriteGroupId, notify]);

  const handleOpenGroupModal = useCallback((insumo = null, initialGroupId = null) => {
    setGroupModalInsumo(insumo || null);
    const n = Number(initialGroupId);
    setGroupModalInitialGroupId(Number.isFinite(n) ? n : null);
    setGroupModalOpen(true);
  }, []);

  const handleCloseGroupModal = useCallback((didSave = false) => {
    setGroupModalOpen(false);
    setGroupModalInsumo(null);
    setGroupModalInitialGroupId(null);

    if (didSave) {
      loadGroups();
      fetchData();
      loadCatalogoCompleto();
    }
  }, [loadGroups, loadCatalogoCompleto]);

  const handleOpenGroupModalForInsumo = useCallback((insumo) => {
    setGroupModalInsumo(insumo || null);
    setGroupModalRubroLabel(null);
    setGroupModalOpen(true);
  }, []);

  const handleOpenGroupModalForRubro = useCallback((rubroLabel) => {
    setGroupModalInsumo(null);
    setGroupModalRubroLabel(rubroLabel || null);
    setGroupModalOpen(true);
  }, []);

  const handleSetFavoriteGroup = useCallback(async (groupId) => {
    if (!businessId) {
      notify("Seleccioná un negocio antes de marcar favoritas", "warning");
      return;
    }
    const id = Number(groupId);
    if (!Number.isFinite(id)) return;

    try {
      if (favoriteGroupId && Number(favoriteGroupId) === id) {
        await insumoGroupUpdate(id, { es_favorita: false });
        setFavoriteGroupId(null);
      } else {
        if (favoriteGroupId) {
          await insumoGroupUpdate(favoriteGroupId, { es_favorita: false });
        }
        await insumoGroupUpdate(id, { es_favorita: true });
        setFavoriteGroupId(id);
      }

      await loadGroups();
      notify("Favorita actualizada", "success");
    } catch (e) {
      console.error("[InsumosMain] Error setFavoriteGroup:", e);
      notify(e.message || "Error al actualizar favorita", "error");
    }
  }, [businessId, favoriteGroupId, loadGroups, notify]);

  const handleEditGroup = useCallback(async (group) => {
    if (!businessId) {
      notify("Seleccioná un negocio antes de editar agrupaciones", "warning");
      return;
    }
    const actual = String(group?.nombre || "");
    const nuevo = window.prompt("Nuevo nombre de la agrupación:", actual);
    if (nuevo == null) return;
    const trimmed = nuevo.trim();
    if (!trimmed) return;

    try {
      await insumoGroupUpdate(group.id, { nombre: trimmed });
      await loadGroups();
      notify("Agrupación renombrada", "success");
    } catch (e) {
      console.error("[InsumosMain] Error editGroup:", e);
      notify(e.message || "Error al renombrar agrupación", "error");
    }
  }, [businessId, loadGroups, notify]);

  const handleDeleteGroup = useCallback(async (group) => {
    if (!businessId) {
      notify("Seleccioná un negocio antes de eliminar agrupaciones", "warning");
      return;
    }

    if (
      !window.confirm(
        `¿Eliminar la agrupación "${group.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      await insumoGroupDelete(group.id);

      if (selectedGroupId && Number(selectedGroupId) === Number(group.id)) {
        setSelectedGroupId(null);
      }

      if (favoriteGroupId && Number(favoriteGroupId) === Number(group.id)) {
        setFavoriteGroupId(null);
      }

      await loadGroups();
      notify("Agrupación eliminada", "success");
    } catch (e) {
      console.error("[InsumosMain] Error deleteGroup:", e);
      notify(e.message || "Error al eliminar agrupación", "error");
    }
  }, [businessId, favoriteGroupId, loadGroups, notify, selectedGroupId]);

  const handleRenameGroup = useCallback(
    async (group) => {
      if (!group) return;

      const isTodo = esTodoGroup(group);
      const isDisc = esDiscontinuadosGroup(group);

      if (isDisc) return;

      const promptMsg = isTodo
        ? 'Nombre para la nueva agrupación (los insumos de "Sin Agrupación" se moverán aquí):'
        : 'Nuevo nombre para la agrupación:';

      const nuevo = window.prompt(promptMsg, isTodo ? '' : group.nombre);
      if (nuevo == null) return;
      const nombre = nuevo.trim();
      if (!nombre) return;
      if (!isTodo && nombre === group.nombre) return;

      try {
        if (isTodo) {
          const ids = Array.from(idsSinAgrup)
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0);

          if (!ids.length) {
            window.alert('No hay insumos en "Sin agrupación" para capturar.');
            return;
          }

          const res = await http('/insumos/groups/create-or-move', {
            method: 'POST',
            body: {
              nombre,
              ids,
            },
            withBusinessId: true,
          });

          const createdId = Number(
            res?.id || res?.groupId || res?.agrupacionId || res?.group?.id
          );

          await loadGroups();

          if (Number.isFinite(createdId) && createdId > 0) {
            setSelectedGroupId(createdId);
          }

          notify(`Agrupación "${nombre}" creada con ${ids.length} insumos.`, 'success');

        } else {
          await insumoGroupUpdate(group.id, { nombre });
          await loadGroups();

          notify('Nombre de agrupación actualizado.', 'success');
        }
      } catch (e) {
        console.error('RENAME_GROUP_ERROR', e);
        notify('No se pudo renombrar la agrupación.', 'error');
      }
    },
    [idsSinAgrup, loadGroups, notify]
  );

  /* ================== 1️⃣8️⃣ FETCH DATA ================== */
  const fetchData = useCallback(async () => {
    if (!businessId) {
      setRows([]);
      setPagination({ total: 0, pages: 1 });
      return;
    }

    setLoading(true);
    try {
      let data = [...allInsumos];

      const discontinuadosIds = new Set();
      if (discontinuadosGroupId) {
        const discGroup = groups.find(g => Number(g.id) === discontinuadosGroupId);
        if (discGroup) {
          (discGroup.items || discGroup.insumos || []).forEach(item => {
            const id = Number(item.insumo_id ?? item.id);
            if (Number.isFinite(id)) discontinuadosIds.add(id);
          });
        }
      }

      const isDiscontinuadosView = selectedGroupId &&
        Number(selectedGroupId) === discontinuadosGroupId;

      if (selectedGroupId) {
        const gId = Number(selectedGroupId);

        if (isDiscontinuadosView) {
          data = data.filter(i => discontinuadosIds.has(Number(i.id)));
        } else if (todoGroupId && gId === todoGroupId) {
          data = data.filter(i => {
            const id = Number(i.id);
            return idsSinAgrup.has(id) && !discontinuadosIds.has(id);
          });
        } else {
          const g = groups.find(gr => Number(gr.id) === gId);
          if (g) {
            const ids = new Set(
              (g.items || g.insumos || [])
                .map(it => Number(it.insumo_id ?? it.id))
                .filter(Number.isFinite)
            );

            data = data.filter(i => {
              const id = Number(i.id);
              return ids.has(id) && !discontinuadosIds.has(id);
            });
          }
        }
      }

      if (vista === "elaborados") {
        data = data.filter(i => {
          const rubroCodigo = String(i.rubro_codigo || i.rubro || '');
          const rubroInfo = rubrosMap.get(rubroCodigo);
          return rubroInfo?.es_elaborador === true;
        });
      } else if (vista === "no-elaborados") {
        data = data.filter(i => {
          const rubroCodigo = String(i.rubro_codigo || i.rubro || '');
          const rubroInfo = rubrosMap.get(rubroCodigo);
          return rubroInfo?.es_elaborador !== true;
        });
      }

      if (rubroSeleccionado) {
        const rubroNombre = rubroSeleccionado.nombre || rubroSeleccionado;
        data = data.filter(i => {
          const rubroCodigo = String(i.rubro_codigo || i.rubro || '');
          const rubroInfo = rubrosMap.get(rubroCodigo);
          return rubroInfo?.nombre === rubroNombre;
        });
      }

      setRows(data);
      setPagination({ total: data.length, pages: 1 });
    } catch (error) {
      console.error('[fetchData] Error:', error);
      setRows([]);
      setPagination({ total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [
    businessId,
    allInsumos,
    rubrosMap,
    selectedGroupId,
    groups,
    todoGroupId,
    discontinuadosGroupId,
    idsSinAgrup,
    rubroSeleccionado,
    vista,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTimestamp]);

  useEffect(() => {
    if (rubroSeleccionado) {
      setRubroSeleccionado(null);
    }
  }, [vista]);

  /* ================== 1️⃣9️⃣ CRUD INSUMOS ================== */
  const openCreate = useCallback(() => {
    setEditing(null);
    setForm({ nombre: "", unidadMed: "", precioRef: "" });
    setOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    setEditing(row);
    setForm({
      nombre: row.nombre || "",
      unidadMed: row.unidad_med || "",
      precioRef: row.precio_ref ?? "",
    });
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  const onChange = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  const save = useCallback(async () => {
    if (!businessId) {
      notify("Seleccioná un negocio antes de crear/editar insumos", "warning");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      unidadMed: form.unidadMed || null,
      precioRef: form.precioRef === "" ? null : Number(form.precioRef),
      origen: editing ? undefined : "manual",
      activo: editing ? undefined : true,
    };

    if (!payload.nombre) {
      notify("El nombre es obligatorio", "warning");
      return;
    }

    try {
      if (editing) {
        await insumoUpdate(editing.id, payload);
        notify("Insumo actualizado", "success");
      } else {
        await insumoCreate(payload);
        notify("Insumo creado", "success");
      }

      closeModal();
      await loadAllInsumos();
      fetchData();
    } catch (e) {
      notify(e.message || "Error al guardar insumo", "error");
    }
  }, [businessId, editing, form, notify, closeModal, loadAllInsumos, fetchData]);

  const eliminar = useCallback(async (row) => {
    if (!businessId) {
      notify("Seleccioná un negocio antes de eliminar insumos", "warning");
      return;
    }
    if (!window.confirm(`Desactivar "${row.nombre}"?`)) return;

    try {
      await insumoDelete(row.id);
      notify("Insumo desactivado", "success");
      await loadAllInsumos();
      fetchData();
    } catch (e) {
      notify(e.message || "Error al eliminar insumo", "error");
    }
  }, [businessId, notify, loadAllInsumos, fetchData]);

  /* ================== 2️⃣0️⃣ BULK / SYNC ================== */
  const onBulkJSON = useCallback(() => setOpenBulk(true), []);

  const handleBulkConfirm = useCallback(async (array) => {
    if (!businessId) {
      notify("Seleccioná un negocio antes de usar carga masiva", "warning");
      return;
    }
    try {
      await insumosBulkJSON(array);
      setOpenBulk(false);
      notify("Carga masiva completada", "success");
      await loadAllInsumos();
      fetchData();
    } catch (e) {
      notify(e.message || "Error en carga masiva", "error");
    }
  }, [businessId, notify, loadAllInsumos, fetchData]);

  const onBulkCSV = useCallback(async (e) => {
    if (!businessId) {
      notify("Seleccioná un negocio antes de usar carga masiva CSV", "warning");
      e.target.value = "";
      return;
    }
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      await insumosBulkCSV(f);
      notify("Carga CSV completada", "success");
      e.target.value = "";
      await loadAllInsumos();
      fetchData();
    } catch (e) {
      notify(e.message || "Error en carga CSV", "error");
      e.target.value = "";
    }
  }, [businessId, notify, loadAllInsumos, fetchData]);

  const handleSyncMaxi = useCallback(async () => {
    if (!businessId) {
      notify("Seleccioná un negocio antes de sincronizar desde Maxi", "warning");
      return;
    }
    if (
      !window.confirm(
        "¿Sincronizar insumos desde Maxi para el negocio activo?"
      )
    )
      return;

    try {
      await insumosSyncMaxi();
      notify("Sincronización completada", "success");
      await loadAllInsumos();
      await fetchData();
    } catch (e) {
      notify(e.message || "Error al sincronizar desde Maxi", "error");
    }
  }, [businessId, notify, loadAllInsumos, fetchData]);

  /* ================== 2️⃣1️⃣ RENDER ================== */
  const titulo = businessName
    ? `Insumos — ${businessName}`
    : "Insumos";

  return (
    <div>
      <div className="tabla-header">
        <div className="tabla-header-left">
          <h2>{titulo}</h2>
        </div>

        <div className="tabla-header-right">
          <div
            className="filtros-fechas"
            style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}
          >
            <div style={{ minWidth: 360, maxWidth: 360 }}>
              <Buscador
                placeholder="Buscar insumo…"
                opciones={insumosSearchOptions}
                clearOnPick={false}
                autoFocusAfterPick
                onPick={(opt) => {
                  if (!opt?.id) return;
                  const id = Number(opt.id);
                  if (!Number.isFinite(id)) return;
                  focusInsumo(id);
                }}
              />
            </div>
          </div>

          {groupsError && (
            <p style={{ color: "salmon", fontSize: "0.8rem", marginTop: 4 }}>
              {groupsError}
            </p>
          )}
        </div>
      </div>

      <div className="articulos-layoutInsumos">
        <main className="tabla-articulos-wrapper">
          <div className="tabla-articulos-container">
            <aside className="sidebar-categorias" style={{ minWidth: "20%", maxWidth: "20%" }}>
              <InsumosSidebar
                rubros={rubrosTree}
                rubroSeleccionado={rubroSeleccionado}
                setRubroSeleccionado={setRubroSeleccionado}
                businessId={businessId}
                vista={vista}
                onVistaChange={setVista}
                groups={groups}
                groupsLoading={groupsLoading}
                selectedGroupId={selectedGroupId}
                onSelectGroupId={handleSelectGroupId}
                favoriteGroupId={favoriteGroupId}
                onSetFavorite={handleToggleFavorite}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleDeleteGroup}
                onRenameGroup={handleRenameGroup}
                todoGroupId={todoGroupId}
                idsSinAgrupCount={idsSinAgrup.size}
                onMutateGroups={onMutateGroups}
                onRefetch={loadGroups}
                notify={notify}
                visibleIds={visibleIds}
                rubrosMap={rubrosMap}
              />
            </aside>
            <section
              id="insumos-scroll"
              className="tabla-articulos-wrapper-inner"
              style={{ minWidth: "80%", maxWidth: "80%" }}
            >
              <InsumosTable
                listRef={listRef}
                onIdToIndexChange={handleIdToIndexChange}
                rows={rows}
                loading={loading}
                page={page}
                pagination={pagination}
                onPageChange={setPage}
                onEdit={openEdit}
                onDelete={eliminar}
                noBusiness={!businessId}
                vista={vista}
                businessId={businessId}
                groups={groups}
                selectedGroupId={selectedGroupId}
                discontinuadosGroupId={discontinuadosGroupId}
                onOpenGroupModalForInsumo={handleOpenGroupModalForInsumo}
                onCreateGroupFromRubro={handleOpenGroupModalForRubro}
                onRefetch={fetchData}
                onMutateGroups={onMutateGroups}
                notify={notify}
                todoGroupId={todoGroupId}
                idsSinAgrup={Array.from(idsSinAgrup)}
                onReloadCatalogo={loadCatalogoCompleto}
                rubrosMap={rubrosMap}
                jumpToInsumoId={jumpToInsumoId}
                selectedInsumoId={selectedInsumoId}
                forceRefresh={forceRefresh}
              />
            </section>
          </div>

          <Dialog open={open} onClose={closeModal} fullWidth maxWidth="sm">
            <DialogTitle>
              {editing ? "Editar insumo" : "Nuevo insumo"}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {editing && (
                  <TextField
                    label="Código"
                    value={
                      editing.codigo_mostrar ||
                      (editing.codigo_maxi && editing.codigo_maxi.trim() !== ""
                        ? editing.codigo_maxi
                        : `INS-${editing.id}`)
                    }
                    InputProps={{ readOnly: true }}
                  />
                )}
                <TextField
                  label="Nombre *"
                  value={form.nombre}
                  onChange={(e) => onChange("nombre", e.target.value)}
                />
                <TextField
                  select
                  label="Unidad de medida"
                  value={form.unidadMed}
                  onChange={(e) => onChange("unidadMed", e.target.value)}
                >
                  <MenuItem value="">(sin unidad)</MenuItem>
                  {UNIDADES.map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Precio ref"
                  type="number"
                  value={form.precioRef}
                  onChange={(e) => onChange("precioRef", e.target.value)}
                  inputProps={{ step: "0.01" }}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeModal}>Cancelar</Button>
              <Button variant="contained" onClick={save}>
                Guardar
              </Button>
            </DialogActions>
          </Dialog>

          <BulkJsonModal
            open={openBulk}
            onClose={() => setOpenBulk(false)}
            onConfirm={handleBulkConfirm}
            example={`[
  { "nombre": "Harina 000", "unidadMed": "kg", "precioRef": 1200 },
  { "nombre": "Leche entera", "unidadMed": "lt", "precioRef": 950 }
]`}
          />

          <InsumoGroupModal
            open={groupModalOpen}
            originRubroLabel={groupModalRubroLabel}
            onClose={handleCloseGroupModal}
            insumo={groupModalInsumo}
            businessId={businessId}
            groups={groups}
            initialGroupId={groupModalInitialGroupId}
            onGroupsReload={loadGroups}
          />
        </main>
      </div>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.type}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}