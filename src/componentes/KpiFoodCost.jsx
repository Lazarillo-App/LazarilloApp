// src/componentes/KpiFoodCost.jsx
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { showConfirm } from "@/servicios/appConfirm";

/* ──────────────────────────────────────────────────────────────
   KPI de Food Cost — Lazarillo Gestión
   Indicador para la barra de filtros de Gestión de Artículos.

   food cost = compras de mercadería / ventas de mercadería

   La selección de cada KPI se guarda como REGLA, no como lista:
     grupos incluidos  → todo lo que caiga adentro entra, ahora y después
     excluidos         → lo que se quitó a mano y no vuelve
     sueltos           → ítems agregados uno por uno

     del KPI = (todo lo de los grupos − excluidos) + sueltos

   Ver kpi-foodcost.schema.json para el formato de datos y de config.
   ────────────────────────────────────────────────────────────── */

/* ========== lógica pura — reutilizable en el backend ========== */

export const NIVELES_VENTAS = ["agrupacion", "rubro", "subrubro"];
export const NIVELES_COMPRAS = ["agrupacion", "rubro"];

export function claveDe(item, nivel) {
  return item[nivel];
}

/** Resuelve la regla contra el universo de ítems. */
export function resolver(items, regla) {
  const g = regla?.grupos ?? [];
  const x = new Set(regla?.excluidos ?? []);
  const e = new Set(regla?.sueltos ?? []);
  return items.filter((it) => {
    const enGrupo = g.some((s) => claveDe(it, s.nivel) === s.clave);
    return enGrupo ? !x.has(it.id) : e.has(it.id);
  });
}

/** Ítems de un KPI. Los sub-KPI nunca salen del universo del general. */
export function itemsDe(items, kpis, idKpi, lado) {
  const kpi = kpis.find((k) => k.id === idKpi);
  if (!kpi) return [];
  const propios = resolver(items, kpi[lado]);
  if (kpi.general) return propios;
  const general = kpis.find((k) => k.general);
  if (!general) return propios;
  const universo = new Set(resolver(items, general[lado]).map((i) => i.id));
  return propios.filter((i) => universo.has(i.id));
}

export const sumar = (items) => items.reduce((t, i) => t + i.importe, 0);

export function foodCost(ventas, compras, kpis, idKpi) {
  const v = sumar(itemsDe(ventas, kpis, idKpi, "ventas"));
  const c = sumar(itemsDe(compras, kpis, idKpi, "compras"));
  return { ventas: v, compras: c, pct: v ? (c / v) * 100 : 0 };
}

/** Los sub-KPI tienen que sumar exactamente el general. */
export function validar(items, kpis, lado) {
  const general = kpis.find((k) => k.general);
  if (!general) return { total: 0, cubierto: 0, diferencia: 0, faltantes: [] };
  const universo = resolver(items, general[lado]);
  const cubiertos = new Set();
  kpis
    .filter((k) => !k.general)
    .forEach((k) =>
      itemsDe(items, kpis, k.id, lado).forEach((i) => cubiertos.add(i.id))
    );
  const faltantes = universo.filter((i) => !cubiertos.has(i.id));
  const total = sumar(universo);
  const cubierto = total - sumar(faltantes);
  return { total, cubierto, diferencia: total - cubierto, faltantes };
}

/* ========== helpers de UI ========== */

const fmt = (n) => "$ " + Math.round(n).toLocaleString("es-AR");
const d1 = (n) => n.toFixed(1).replace(".", ",");
const quitar = (arr, v) => arr.filter((x) => x !== v);

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m) => {
  const n = MESES_LARGOS[Number(String(m).slice(5, 7)) - 1];
  return n ? `${n} ${String(m).slice(0, 4)}` : String(m);
};

const fmtCorto = (n) =>
  Math.abs(n) >= 1e6 ? "$ " + (n / 1e6).toFixed(1).replace(".", ",") + " M"
                     : "$ " + Math.round(n).toLocaleString("es-AR");

function agrupar(items, nivel) {
  const mapa = new Map();
  items.forEach((it) => {
    const k = claveDe(it, nivel);
    if (!mapa.has(k)) mapa.set(k, { clave: k, importe: 0, items: [] });
    const g = mapa.get(k);
    g.importe += it.importe;
    g.items.push(it);
  });
  return [...mapa.values()].sort((a, b) => b.importe - a.importe);
}

/* ========== componente ========== */

/* Barras por mes. Mismo criterio que el gráfico del modal de compras: el eje
   arranca en cero —con la base cortada el alto deja de ser proporcional— y el
   valor va arriba de la barra, con la variación contra el mes anterior. */
function BarrasMes({ datos, serie, foco }) {
  const ref = useRef(null);
  const ptsRef = useRef([]);
  const [tip, setTip] = useState(null);

  const fmtV = useCallback(
    (v) => (serie === "foodcost" ? d1(v) + "%" : fmtCorto(v)),
    [serie]);

  const dibujar = useCallback(() => {
    const cv = ref.current;
    if (!cv || !datos.length) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 500, H = cv.clientHeight || 96;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);

    const vals = datos.map((d) => d[serie]);
    const mx = Math.max(...vals) * 1.18 || 1;
    const hayDosAnios = new Set(datos.map((d) => String(d.mes ?? "").slice(0, 4))).size > 1;
    const L = 50, R = 9, T = 30, B = hayDosAnios ? 30 : 18;
    const w = W - L - R, h = H - T - B;
    const py = (v) => T + h - (v / mx) * h;

    g.font = "9.5px -apple-system, Segoe UI, Helvetica, Arial";
    g.strokeStyle = "rgba(140,155,150,.22)";
    g.fillStyle = "#8B9A95"; g.textAlign = "right";
    [0, 1].forEach((t) => {
      const v = mx * t, y = Math.round(py(v)) + 0.5;
      g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke();
      g.fillText(serie === "foodcost" ? d1(v) : fmtCorto(v).replace("$ ", ""), L - 6, y + 3);
    });

    const paso = w / datos.length, bw = Math.min(54, paso * 0.58);

    // Corte de año: con 12 meses casi siempre hay dos años en pantalla y
    // "ene" después de "dic" no dice cuál. Una línea entre los dos meses y
    // el año debajo de cada tramo.
    const anioDe = (d) => String(d.mes ?? "").slice(0, 4);
    const cortes = [];
    for (let i = 1; i < datos.length; i++) {
      if (anioDe(datos[i]) !== anioDe(datos[i - 1])) cortes.push(i);
    }
    if (cortes.length) {
      g.font = "9.5px -apple-system, Segoe UI, Helvetica, Arial";
      g.textAlign = "center";
      cortes.forEach((i) => {
        const X = Math.round(L + paso * i) + 0.5;
        g.beginPath();
        g.setLineDash([2, 3]);
        g.moveTo(X, T - 4); g.lineTo(X, H - 13);
        g.strokeStyle = "#C4CCD2"; g.lineWidth = 1; g.stroke();
        g.setLineDash([]);
      });
      // el año centrado bajo su tramo, en el renglón de abajo de todo
      const limites = [0, ...cortes, datos.length];
      for (let k = 0; k < limites.length - 1; k++) {
        const ini = limites[k], fin = limites[k + 1];
        if (fin - ini < 2) continue;
        g.fillStyle = "#B4BDC4";
        g.fillText(anioDe(datos[ini]), L + paso * ((ini + fin) / 2), H - 3);
      }
    }

    // Semáforo en las tres series: verde lo bueno, naranja el medio, rojo lo
    // malo. Los cortes son RELATIVOS a la propia serie y no umbrales fijos,
    // porque el food cost normal de bebidas y el de comidas no se parecen en
    // nada: un número fijo pintaría un KPI entero de rojo y otro de verde.
    //
    // En ventas el sentido se da vuelta: vender más es bueno. En food cost y
    // en compras, gastar más es malo.
    const mn = Math.min(...vals), mxv = Math.max(...vals);
    const rango = mxv - mn;
    // Si los meses son casi iguales no hay nada que señalar: un solo color.
    const minimoUtil = serie === "foodcost" ? 1 : mxv * 0.04;
    const semaforo = rango >= minimoUtil;
    const alReves = serie === "ventas";
    const colorDe = (v) => {
      if (!semaforo) return color;
      const bajo = v <= mn + rango / 3;
      const alto = v > mn + (rango * 2) / 3;
      if (bajo) return alReves ? "#C0392B" : "#2E8B57";
      if (alto) return alReves ? "#2E8B57" : "#C0392B";
      return "#E0921C";
    };
    // Saltear etiquetas solo si DE VERDAD no entran. Antes se decidía con un
    // umbral fijo (paso < 54) calculado a ojo, y con 13 meses escondía la
    // mitad de los valores aunque sobrara lugar: la etiqueta mide ~26px y
    // había 51 de espacio.
    g.font = "bold 11px -apple-system, Segoe UI, Helvetica, Arial";
    const anchoMax = Math.max(...datos.map((d) =>
      Math.max(g.measureText(fmtV(d[serie])).width,
               g.measureText("+99,9%").width)));
    const apretado = anchoMax + 6 > paso;
    g.font = "9.5px -apple-system, Segoe UI, Helvetica, Arial";
    const color = serie === "foodcost" ? "#C77C0B" : serie === "compras" ? "#2E8B57" : "#3C9BD6";
    g.textAlign = "center";
    datos.forEach((d, i) => {
      const X = L + paso * i + paso / 2;
      const alt = Math.max(0, T + h - py(d[serie])), Y = T + h - alt;
      // el mes en foco va pleno, el resto apagado — con el semáforo encendido
      // el color ya no puede marcar cuál se está mirando
      const esFoco = i === (foco ?? datos.length - 1);
      g.fillStyle = colorDe(d[serie]) + (esFoco ? "" : "59");
      g.beginPath();
      if (g.roundRect) g.roundRect(X - bw / 2, Y, bw, alt, [3, 3, 0, 0]);
      else g.rect(X - bw / 2, Y, bw, alt);
      g.fill();
      g.fillStyle = "#8B9A95";
      g.fillText(d.etiqueta, X, H - (hayDosAnios ? 16 : 4));

      // Se alterna CONTANDO DESDE EL FINAL, así la última siempre entra y
      // nunca queda pegada a la anterior (con paridad fija, si la última caía
      // en índice par se dibujaban dos seguidas y se pisaban).
      if (!apretado || (datos.length - 1 - i) % 2 === 0) {
        g.fillStyle = i === datos.length - 1 ? "#8A5209" : "#6B7C76";
        g.font = "bold 11px -apple-system, Segoe UI, Helvetica, Arial";
        g.fillText(fmtV(d[serie]), X, Y - 15);
        const ant = datos[i - 1]?.[serie];
        if (i > 0 && ant) {
          // Food cost ya es un % — mostrar "cambio % del cambio %" (ej. de
          // 36,4% a 42,8% daba "+17,5%") confundía más de lo que aclaraba.
          // Acá se muestra la diferencia en puntos (+6,4 pts), que es lo que
          // se espera leer. Compras/ventas son montos, ahí el cambio relativo
          // sigue siendo la lectura correcta.
          const esPuntos = serie === "foodcost";
          const dv = esPuntos ? (d[serie] - ant) : ((d[serie] - ant) / ant) * 100;
          // en food cost y en compras subir es malo; en ventas es al revés
          const sube = dv > 0;
          g.fillStyle = serie === "ventas"
            ? (sube ? "#2E8B57" : "#C0392B")
            : (sube ? "#C0392B" : "#2E8B57");
          g.font = "bold 9.5px -apple-system, Segoe UI, Helvetica, Arial";
          g.fillText((dv >= 0 ? "+" : "−") + d1(Math.abs(dv)) + (esPuntos ? " pts" : "%"), X, Y - 3);
        }
        g.font = "9.5px -apple-system, Segoe UI, Helvetica, Arial";
      }
    });
    ptsRef.current = datos.map((d, i) => ({ x: L + paso * i + paso / 2, y: py(d[serie]), d }));
  }, [datos, serie, fmtV, foco]);

  useEffect(() => { dibujar(); }, [dibujar]);
  useEffect(() => {
    const r = () => dibujar();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [dibujar]);

  const buscar = (e) => {
    const cv = ref.current; if (!cv) return;
    const b = cv.getBoundingClientRect();
    const mx = e.clientX - b.left, my = e.clientY - b.top;
    let mejor = null, dist = 1e9;
    ptsRef.current.forEach((q) => {
      const d = Math.hypot(q.x - mx, q.y - my);
      if (d < dist) { dist = d; mejor = q; }
    });
    setTip(dist < 34 ? mejor : null);
  };

  return (
    <div className="kfc-cvw">
      <canvas ref={ref} className="kfc-cv" onMouseMove={buscar} onMouseLeave={() => setTip(null)} />
      {tip && (
        <div className="kfc-tip" style={{ left: tip.x, top: tip.y - 8 }}>
          <b>{tip.d.etiqueta}</b>
          <span className="t">food cost</span> <b>{d1(tip.d.foodcost)}%</b>
          <span className="t">compras</span> <b>{fmtCorto(tip.d.compras)}</b>
          <span className="t">ventas</span> <b>{fmtCorto(tip.d.ventas)}</b>
        </div>
      )}
    </div>
  );
}

function Fila({ ctx, lado, item, prof }) {
  const { datos, kpis, kpi, general, duenio, toggleItem } = ctx;
  const propios = itemsDe(datos[lado], kpis, kpi.id, lado);
  const on = propios.some((i) => i.id === item.id);
  const du = duenio(lado, item);
  const fuera = !kpi.general && !resolver(datos[lado], general?.[lado] ?? {}).some((i) => i.id === item.id);
  const off = (du || fuera) && !on;
  const exc = (kpi[lado]?.excluidos ?? []).includes(item.id);
  return (
    <div
      className={`kfc-it kfc-hoja${on ? " on" : ""}${off ? " off" : ""}`}
      style={{ paddingLeft: 11 + prof * 17 + 18 }}
      onClick={off ? undefined : () => toggleItem(lado, item)}
    >
      <span className="kfc-bx">✓</span>
      <span className="kfc-n">
        {item.nombre}
        {du && !on && <span className="kfc-tag">en {du}</span>}
        {exc && <span className="kfc-tag">quitado a mano</span>}
      </span>
      <span className={`kfc-v${item.importe === 0 ? " cero" : ""}`}>
        {item.importe === 0 ? "sin mov." : fmt(item.importe)}
      </span>
    </div>
  );
}

function Grupo({ ctx, lado, niv, grupo, prof }) {
  const { datos, kpis, kpi, general, desplegado, setDesplegado, disponible, duenio,
          toggleGrupo, sumarAlGeneral } = ctx;
  const propios = new Set(itemsDe(datos[lado], kpis, kpi.id, lado).map((i) => i.id));
  const sel = grupo.items.filter((i) => propios.has(i.id)).length;
  const disp = grupo.items.filter((i) => propios.has(i.id) || disponible(lado, i)).length;
  const estado = sel === 0 ? "" : sel >= disp ? "on" : "half";
  // Un grupo del que no se puede tomar nada se veía igual que uno libre: se
  // clickeaba y no pasaba nada. Ahora se apaga y dice por qué.
  const off = disp === 0;
  const motivo = (() => {
    if (!off) return null;
    const du = duenio(lado, grupo.items[0]);
    if (du) return `en ${du}`;
    const universo = new Set(resolver(datos[lado], general?.[lado] ?? {}).map((i) => i.id));
    if (!grupo.items.some((i) => universo.has(i.id))) return "fuera del general";
    return "no disponible";
  })();
  const llave = `${lado}|${niv}|${grupo.clave}`;
  const open = !!desplegado[llave];
  const auto = (kpi[lado]?.grupos ?? []).some((s) => s.nivel === niv && s.clave === grupo.clave);
  const hijoNiv = niv === "agrupacion" ? "rubro" : null;
  return (
    <>
      <div
        className={`kfc-it kfc-gru ${estado}${off ? " off" : ""}`}
        style={{ paddingLeft: 11 + prof * 17 }}
        onClick={off ? undefined : () => toggleGrupo(lado, niv, grupo.clave)}
      >
        <span
          className={`kfc-chev${open ? " ab" : ""}`}
          onClick={(e) => { e.stopPropagation(); setDesplegado((d) => ({ ...d, [llave]: !d[llave] })); }}
        >
          ›
        </span>
        {/* Sin casilla donde no se puede tildar: la casilla invitaba a
            clickearla y no pasaba nada. */}
        <span className={off ? "kfc-bxoff" : "kfc-bx"}>{off ? "" : estado === "half" ? "–" : "✓"}</span>
        <span className="kfc-n">
          {grupo.clave}
          {/* En las filas bloqueadas el contador de ítems no aporta y le
              saca lugar al botón, que es lo único accionable ahí. */}
          {!off && (
            <span className="kfc-cnt">
              {sel > 0 && sel < grupo.items.length ? `${sel} de ${grupo.items.length}` : `${grupo.items.length} ítems`}
            </span>
          )}
          {/* Con el botón puesto, la etiqueta "fuera del general" repetía lo
              mismo y partía la fila en tres renglones. En otro KPI no hay
              botón, porque habría que sacárselo al otro: ahí va la etiqueta. */}
          {motivo && motivo !== "fuera del general" && <span className="kfc-tag">{motivo}</span>}
        </span>
        <span className={`kfc-v${grupo.importe === 0 ? " cero" : ""}`}>
          {grupo.importe === 0 ? "sin movimiento" : fmt(grupo.importe)}
        </span>
        {/* Último de la fila y de ancho fijo: así todos los botones caen en
            la misma columna, sin importar cuánto mida el importe. */}
        {off && motivo === "fuera del general" && (
          <span
            className="kfc-sumar"
            onClick={(e) => { e.stopPropagation(); sumarAlGeneral(lado, niv, grupo.clave); }}
          >+ al general</span>
        )}
      </div>
      {open && (
        <div className="kfc-hijos">
          {hijoNiv
            ? agrupar(grupo.items, hijoNiv).map((g) => (
                <Grupo ctx={ctx} key={g.clave} lado={lado} niv={hijoNiv} grupo={g} prof={prof + 1} />
              ))
            : [...grupo.items]
                .sort((a, b) => b.importe - a.importe)
                .map((i) => <Fila ctx={ctx} key={i.id} lado={lado} item={i} prof={prof + 1} />)}
        </div>
      )}
    </>
  );
}

// Tildar todo de una. Sin esto, armar el general con quince rubros son
// quince clics; y para empezar de cero hay que destildar uno por uno.
function TodosFila({ ctx, lado }) {
  const { datos, kpis, kpi, nivel, disponible, editarRegla } = ctx;
  const niv = nivel[lado];
  const propios = new Set(itemsDe(datos[lado], kpis, kpi.id, lado).map((i) => i.id));
  // solo cuenta lo que este KPI puede tomar: dentro del general y no
  // reclamado por otro sub-KPI
  const elegibles = datos[lado].filter((i) => propios.has(i.id) || disponible(lado, i));
  const sel = elegibles.filter((i) => propios.has(i.id)).length;
  const estado = sel === 0 ? "" : sel >= elegibles.length ? "on" : "half";

  const marcarTodo = () => {
    const claves = [...new Set(elegibles.map((i) => claveDe(i, niv)))];
    editarRegla(lado, (r) => {
      if (estado === "on") {
        // Destildar TODO deja la regla vacía, no solo sin los grupos de este
        // nivel: "todas las agrupaciones" y "todos los rubros" son el mismo
        // universo mirado con otra lupa. Antes, si la selección venía de otro
        // nivel, el botón no hacía nada.
        return { grupos: [], excluidos: [], sueltos: [] };
      }
      const ids = new Set(elegibles.map((i) => i.id));
      // Tildar el grupo entero barría también lo que otro sub-KPI ya tenía:
      // el ítem quedaba contado dos veces y la suma pasaba el general. Lo
      // ajeno se deja explícitamente afuera de la regla.
      const ajenos = datos[lado]
        .filter((i) => claves.includes(claveDe(i, niv)) && !ids.has(i.id))
        .map((i) => i.id);
      return {
        grupos: [
          ...r.grupos.filter((g) => g.nivel !== niv),
          ...claves.map((clave) => ({ nivel: niv, clave })),
        ],
        excluidos: [...new Set([...r.excluidos.filter((id) => !ids.has(id)), ...ajenos])],
        sueltos: r.sueltos.filter((id) => !ids.has(id)),
      };
    });
  };

  // Vaciar la regla entera de este lado. El tilde de arriba solo limpia el
  // nivel en el que estás parado: con grupos tildados en varios niveles más
  // ítems sueltos, dejar todo en cero eran muchos clics.
  const regla = kpi[lado] ?? {};
  const hayAlgo = (regla.grupos?.length ?? 0) + (regla.sueltos?.length ?? 0) + (regla.excluidos?.length ?? 0) > 0;
  const quitarTodo = (e) => {
    e.stopPropagation();
    editarRegla(lado, () => ({ grupos: [], excluidos: [], sueltos: [] }));
  };

  if (!elegibles.length) return null;
  const rotulo = { agrupacion: "Todas las agrupaciones", rubro: "Todos los rubros", subrubro: "Todos los subrubros" }[niv];
  return (
    <div className={`kfc-it kfc-todos ${estado}`} onClick={marcarTodo}>
      <span className="kfc-chev" style={{ visibility: "hidden" }}>›</span>
      <span className="kfc-bx">{estado === "half" ? "–" : "✓"}</span>
      {/* dos renglones fijos: antes pasaba de uno a dos según hubiera o no
          algo tildado, y las dos columnas quedaban desalineadas entre sí */}
      <span className="kfc-n kfc-n2">
        <span>{rotulo}</span>
        <span className="kfc-cnt2">
          {sel === 0 ? `${elegibles.length} ítems` : `${sel} de ${elegibles.length} tildados`}
        </span>
      </span>
      {hayAlgo && (
        <span className="kfc-quitar" onClick={quitarTodo}>Quitar todo</span>
      )}
    </div>
  );
}

function Columna({ ctx, lado, titulo, niveles, placeholder }) {
  const { datos, kpis, kpi, nivel, setNivel, busca, setBusca, toggleGrupo,
          chipsAbiertos, setChipsAbiertos, toggleItem, editarRegla,
          chipsSueltos, setChipsSueltos, verRes, setVerResultado, buscaRes, setBuscaRes,
          verBloq, setVerBloq, disponible, duenio } = ctx;
  const todosLosChips = !!chipsAbiertos[lado];
  const verBloqueados = !!verBloq[lado];

  // Separa lo que este KPI puede tomar de lo que no, y resume los motivos.
  const grupos = (() => {
    const todos = agrupar(datos[lado], nivel[lado]);
    const propiosSet = new Set(itemsDe(datos[lado], kpis, kpi.id, lado).map((i) => i.id));
    const libres = [], bloqueados = [];
    let fuera = 0, ajenos = 0;
    for (const g of todos) {
      const disp = g.items.filter((i) => propiosSet.has(i.id) || disponible(lado, i)).length;
      if (disp > 0) { libres.push(g); continue; }
      bloqueados.push(g);
      if (duenio(lado, g.items[0])) ajenos++; else fuera++;
    }
    const partes = [];
    if (fuera) partes.push(`${fuera} fuera del general`);
    if (ajenos) partes.push(`${ajenos} en otro KPI`);
    return { libres, bloqueados, motivos: partes.join(" · ") };
  })();
  const verResultado = !!verRes[lado];
  const qRes = (buscaRes[lado] ?? "").trim().toLowerCase();
  // Cuántos chips entran depende del largo de los nombres, no de cuántos son:
  // tres rubros de nombre largo ya se cortan. Por eso se mide el desborde en
  // vez de contar.
  const selRef = useRef(null);
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const el = selRef.current;
    if (!el) return;
    const medir = () => setDesborda(el.scrollHeight > el.clientHeight + 1);
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  });
  const q = busca[lado].trim().toLowerCase();
  const propios = itemsDe(datos[lado], kpis, kpi.id, lado);
  // La lista definitiva, ordenada por facturación y filtrable.
  const propiosFiltrados = [...propios]
    .filter((i) => !qRes || i.nombre.toLowerCase().includes(qRes))
    .sort((a, b) => b.importe - a.importe);
  // Los chips salen de la REGLA, no de agrupar por un nivel fijo. Antes, al
  // tildar un rubro, el chip mostraba la agrupación que lo contiene con un
  // "3/54" al lado: no se veía qué se había elegido ni en qué nivel. Ahora se
  // muestran tal cual se eligieron y separados por tipo.
  const ROTULO = {
    agrupacion: "Agrupación", rubro: "Rubro", subrubro: "Subrubro",
    sueltos: lado === "ventas" ? "Artículos" : "Insumos",
  };
  // Cuántos grupos de cada nivel están enteros adentro. Se mide sobre los
  // ítems, no sobre la regla: tildar todas las agrupaciones deja también
  // todos los rubros adentro, aunque la regla no nombre ni un rubro.
  const idsPropios = new Set(itemsDe(datos[lado], kpis, kpi.id, lado).map((i) => i.id));
  const cuentaPorNivel = Object.fromEntries(niveles.map((n) => {
    const grupos = agrupar(datos[lado], n);
    const enteros = grupos.filter((g) => g.items.every((i) => idsPropios.has(i.id))).length;
    return [n, { tildados: enteros, todos: enteros > 0 && enteros === grupos.length }];
  }));
  const porNivel = (niveles.includes("subrubro") ? ["agrupacion", "rubro", "subrubro"] : ["agrupacion", "rubro"])
    .map((niv) => ({
      niv,
      claves: (kpi[lado]?.grupos ?? []).filter((g) => g.nivel === niv).map((g) => g.clave),
    }))
    .filter((x) => x.claves.length);
  const sueltos = (kpi[lado]?.sueltos ?? []).length;
  const verSueltos = !!chipsSueltos[lado];
  // Los quitados a mano se listan con nombre, no totalizados: "−3" no dice
  // qué se sacó, y es lo único que hay que revisar antes de guardar.
  const itemPorId = new Map(datos[lado].map((i) => [String(i.id), i]));
  const sueltosLista = (kpi[lado]?.sueltos ?? [])
    .map((id) => itemPorId.get(String(id)))
    .filter(Boolean);
  const excluidosItems = (kpi[lado]?.excluidos ?? [])
    .map((id) => itemPorId.get(String(id)))
    .filter(Boolean);

  // Si se sacó un grupo entero, se muestra el grupo y no sus veinte ítems.
  // Se prueba del nivel más fino al más grueso y gana el más grueso que esté
  // completo: sacar un rubro entero dice "RUBRO X", no veinte renglones.
  const quitadosLista = (() => {
    const pendientes = new Map(excluidosItems.map((i) => [String(i.id), i]));
    const salida = [];
    for (const n of [...niveles].reverse()) {
      for (const g of agrupar(datos[lado], n)) {
        if (g.items.length < 2) continue;
        if (g.items.every((i) => pendientes.has(String(i.id)))) {
          salida.push({ id: `g:${n}:${g.clave}`, nombre: g.clave, items: g.items });
          g.items.forEach((i) => pendientes.delete(String(i.id)));
        }
      }
    }
    return [...salida, ...[...pendientes.values()].map((i) => ({ id: i.id, nombre: i.nombre, items: [i] }))];
  })();

  // Lista para el tooltip. El chip totaliza ("2 sueltos") porque los nombres
  // no entran, pero sin poder ver cuáles son el dato no sirve de nada.
  const nombresDe = (ids, tope = 14) => {
    const porId = new Map(datos[lado].map((i) => [String(i.id), i.nombre]));
    const nn = ids.map((id) => porId.get(String(id)) ?? id);
    return nn.slice(0, tope).join("\n") + (nn.length > tope ? `\n… y ${nn.length - tope} más` : "");
  };
  const detalleGrupo = (niv, clave) => {
    const items = datos[lado].filter((i) => claveDe(i, niv) === clave);
    const nn = items.map((i) => i.nombre);
    return `${clave} · ${items.length} ítems\n` + nn.slice(0, 14).join("\n") +
      (nn.length > 14 ? `\n… y ${nn.length - 14} más` : "");
  };
  const chips = porNivel.flatMap((x) => x.claves);
  return (
    <div className="kfc-col">
      <div className="kfc-ch">{titulo}</div>
      <div className="kfc-lvl">
        {niveles.map((n) => (
          <span
            key={n}
            className={`kfc-lv${nivel[lado] === n ? " on" : ""}`}
            onClick={() => { setNivel((v) => ({ ...v, [lado]: n })); setBusca((b) => ({ ...b, [lado]: "" })); }}
          >
            {{ agrupacion: "Agrupación", rubro: "Rubro", subrubro: "Subrubro" }[n]}
            {/* El contador vive en el botón del nivel, que es donde el nivel
                ya tiene nombre. Abajo los chips no repiten el rótulo. */}
            {cuentaPorNivel[n].tildados > 0 && (
              <i className={cuentaPorNivel[n].todos ? "full" : ""}>
                {cuentaPorNivel[n].todos ? "✓" : cuentaPorNivel[n].tildados}
              </i>
            )}
          </span>
        ))}
        {/* Los sueltos como un botón más: antes eran un chip en la fila de
            abajo y, al ser uno solo, no había forma de ver cuáles eran. */}
        {sueltosLista.length > 0 && (
          <span
            className={`kfc-lv${verSueltos ? " on" : ""}`}
            onClick={() => setChipsSueltos((c) => ({ ...c, [lado]: !c[lado] }))}
          >
            {ROTULO.sueltos}
            <i>{sueltosLista.length}</i>
          </span>
        )}
      </div>
      {/* Con quince rubros tildados los chips ocupaban cinco renglones y
          empujaban la lista fuera de la pantalla. Se muestra la primera línea
          y el resto se despliega. */}
      <div className="kfc-selwrap">
      <div ref={selRef} className={`kfc-sel${todosLosChips ? " abierto ab-" + lado : ""}`}>
        {chips.length || sueltos ? (
          <>
            {/* Una columna por tipo: lo que se tilda cae en su columna y crece
                hacia abajo. En una sola línea, con agrupaciones y rubros
                mezclados, no se distinguía qué era qué. */}
            {porNivel
              .filter((x) => todosLosChips || (!verSueltos && x.niv === nivel[lado]))
              .map((x) => (
              <div key={x.niv} className="kfc-scol">
                {todosLosChips && <span className="kfc-scl">{ROTULO[x.niv]}</span>}
                {x.claves.map((clave) => (
                  <span key={x.niv + clave} className="kfc-sc">
                    {clave}
                    <u onClick={(e) => { e.stopPropagation(); toggleGrupo(lado, x.niv, clave); }}>✕</u>
                  </span>
                ))}
              </div>
            ))}
            {/* Con el botón de sueltos activo se listan uno por uno, que es
                lo que antes no se podía ver. */}
            {verSueltos && sueltosLista.length > 0 && (
              <div className="kfc-scol">
                {todosLosChips && <span className="kfc-scl">{ROTULO.sueltos}</span>}
                {sueltosLista.map((it) => (
                  <span key={it.id} className="kfc-sc kfc-slt">
                    {it.nombre}
                    <u onClick={(e) => { e.stopPropagation(); toggleItem(lado, it); }}>✕</u>
                  </span>
                ))}
              </div>
            )}
            {quitadosLista.length > 0 && (
              <div className="kfc-scol">
                <span className="kfc-scl">Excluidos</span>
                {quitadosLista.map((q) => (
                  <span key={q.id} className="kfc-sc quit">
                    {q.nombre}
                    {q.items.length > 1 && <i>{q.items.length}</i>}
                    <u onClick={(e) => {
                      e.stopPropagation();
                      // devolver el grupo entero de una
                      editarRegla(lado, (r) => ({
                        ...r,
                        excluidos: r.excluidos.filter((id) => !q.items.some((i) => String(i.id) === String(id))),
                      }));
                    }}>✕</u>
                  </span>
                ))}
              </div>
            )}
            {(desborda || todosLosChips) && (
              <span className="kfc-mas"
                onClick={() => setChipsAbiertos((c) => (c[lado] ? {} : { [lado]: true }))}>
                {todosLosChips ? "ver menos ▴" : "ver ▾"}
              </span>
            )}
          </>
        ) : (
          <span className="kfc-vacio">Nada seleccionado</span>
        )}
      </div>
      </div>
      <input
        className="kfc-srch"
        placeholder={placeholder}
        value={busca[lado]}
        onChange={(e) => setBusca((b) => ({ ...b, [lado]: e.target.value }))}
      />
      {!q && <TodosFila ctx={ctx} lado={lado} />}
      <div className={`kfc-list${q ? "" : " contodos"}`}>
        {q
          ? datos[lado]
              .filter((i) => i.nombre.toLowerCase().includes(q))
              .sort((a, b) => b.importe - a.importe)
              .map((i) => <Fila ctx={ctx} key={i.id} lado={lado} item={i} prof={0} />)
          : (
            <>
              {grupos.libres.map((g) => (
                <Grupo ctx={ctx} key={g.clave} lado={lado} niv={nivel[lado]} grupo={g} prof={0} />
              ))}
              {/* Los que no se pueden tocar van al final y plegados: mezclados
                  entre los demás eran veinte filas apagadas haciendo ruido. */}
              {grupos.bloqueados.length > 0 && (
                <>
                  <div className="kfc-bloq" onClick={() => setVerBloq((v) => ({ ...v, [lado]: !v[lado] }))}>
                    <span className={`kfc-chev${verBloqueados ? " ab" : ""}`}>›</span>
                    {grupos.bloqueados.length} no {grupos.bloqueados.length === 1 ? "disponible" : "disponibles"}
                    <span className="kfc-bloqd">{grupos.motivos}</span>
                  </div>
                  {verBloqueados && grupos.bloqueados.map((g) => (
                    <Grupo ctx={ctx} key={g.clave} lado={lado} niv={nivel[lado]} grupo={g} prof={0} />
                  ))}
                </>
              )}
            </>
          )}
      </div>
      {/* El total va debajo de la lista, y de él cuelga la lista definitiva:
          qué artículos o insumos quedaron adentro. Los grupos son la forma de
          seleccionar en lote; esto es el resultado. */}
      <div className="kfc-total">
        <span>
          {titulo === "VENTAS" ? "Total vendido" : "Total comprado"}
          {propios.length > 0 && (
            <u onClick={() => setVerResultado((v) => ({ ...v, [lado]: !v[lado] }))}>
              {verResultado ? "ocultar" : `ver los ${propios.length} ${lado === "ventas" ? "artículos" : "insumos"}`}
              {verResultado ? " ▴" : " ▾"}
            </u>
          )}
        </span>
        <b>{fmt(sumar(propios))}</b>
      </div>

      {verResultado && (
        <div className="kfc-res">
          <div className="kfc-resh">
            <b>{propiosFiltrados.length}</b>
            <span>de {datos[lado].length}</span>
            <input
              className="kfc-srch kfc-resq"
              placeholder="Buscar en los seleccionados…"
              value={buscaRes[lado] ?? ""}
              onChange={(e) => setBuscaRes((b) => ({ ...b, [lado]: e.target.value }))}
            />
          </div>
          <div className="kfc-reslist">
            {propiosFiltrados.slice(0, 300).map((it) => (
              <div key={it.id} className="kfc-resr">
                <span className="kfc-resn">{it.nombre}</span>
                <span className="kfc-resg">{claveDe(it, nivel[lado])}</span>
                <span className="kfc-resv">{it.importe === 0 ? "sin mov." : fmt(it.importe)}</span>
                <u onClick={() => toggleItem(lado, it)}>✕</u>
              </div>
            ))}
            {propiosFiltrados.length === 0 && <div className="kfc-resvacio">Nada coincide con la búsqueda</div>}
          </div>
          <div className="kfc-resp">
            Ordenados por facturación · la ✕ saca ese {lado === "ventas" ? "artículo" : "insumo"} del KPI
            {propiosFiltrados.length > 300 && ` · se muestran los primeros 300 de ${propiosFiltrados.length}`}
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnaFaltante({ ctx, lado, titulo, val }) {
  const { datos, desplFalta, setDesplFalta, asignarFaltantes } = ctx;
  // Sin faltantes se mantiene la columna para que el otro lado conserve su
  // mitad, pero sin el título "Sin asignar": solo el estado.
  if (!val.faltantes.length)
    return (
      <div className="kfc-fcol">
        <div className="kfc-fok">✓ Todo asignado</div>
      </div>
    );
  const porRubro = agrupar(val.faltantes, "rubro");
  return (
    <div className="kfc-fcol">
      {/* El botón va en la línea del título: en el renglón de abajo quedaba
          fuera de la vista y había que scrollear para usarlo.
          Y el título trae su propia lista a la vista: el bloque está al pie
          de un panel largo y casi siempre entra cortado. */}
      <div
        className="kfc-fh kfc-fhb kfc-fhclic"
        onClick={(e) => {
          // Descontando la barra de pestañas, que es fija: con scrollIntoView
          // a secas el título quedaba justo debajo y no se veía.
          const col = e.currentTarget.parentElement;
          const panel = col.closest(".kfc-panel");
          if (!panel) return;
          const tabs = panel.querySelector(".kfc-tabs");
          const off = (tabs?.getBoundingClientRect().height ?? 0) + 8;
          panel.scrollTo({
            top: panel.scrollTop + col.getBoundingClientRect().top - panel.getBoundingClientRect().top - off,
            behavior: "smooth",
          });
        }}
      >
        {titulo}
        <span className="kfc-asig" onClick={(e) => { e.stopPropagation(); asignarFaltantes(lado, val.faltantes); }}>
          Asignar todos
        </span>
      </div>
      <div className="kfc-fl2">
        <b>{fmt(val.diferencia)}</b> <span>en {porRubro.length} rubro{porRubro.length > 1 ? "s" : ""}</span>
      </div>
      {porRubro.map((g) => {
        const total = datos[lado].filter((i) => i.rubro === g.clave).length;
        const llave = `${lado}|${g.clave}`;
        const open = !!desplFalta[llave];
        return (
          <React.Fragment key={g.clave}>
            <div className="kfc-fg" onClick={() => setDesplFalta((d) => ({ ...d, [llave]: !d[llave] }))}>
              <span className={`kfc-chev${open ? " ab" : ""}`}>›</span>
              <span className="kfc-fn">
                {g.clave}
                <span className="kfc-cnt">{g.items.length < total ? `${g.items.length} de ${total}` : "completo"}</span>
              </span>
              <span className="kfc-fv">{fmt(g.importe)}</span>
            </div>
            {open &&
              [...g.items].sort((a, b) => b.importe - a.importe).map((i) => (
                <div key={i.id} className="kfc-fi">
                  <span className="kfc-fn">{i.nombre}</span>
                  <span className="kfc-fv">{fmt(i.importe)}</span>
                </div>
              ))}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Bloque({ label, val, der }) {
  // Cada lado con su propio faltan debajo: ventas a la izquierda y compras a
  // la derecha, igual que las dos columnas de abajo.
  return (
    <span className={`kfc-vbox${der ? " der" : ""}`}>
      <span className="kfc-vfila">
        <span className="kfc-vlab">{label}</span>
        <span className={`kfc-vnum ${val.diferencia === 0 ? "ok" : "bad"}`}>{fmt(val.cubierto)}</span>
        <span className="kfc-de">de {fmt(val.total)}</span>
        {val.diferencia === 0 && <span className="ok">✓</span>}
      </span>
      {val.diferencia !== 0 && (
        <span className="kfc-vfila bad">faltan {fmt(val.diferencia)}</span>
      )}
    </span>
  );
}

export default function KpiFoodCost({
  ventas = [],
  compras = [],
  kpis = [],
  onChange,
  periodoLabel = "",
  // Los mismos items, pero partidos por mes:
  //   [{ mes: "2026-05", ventas: [...], compras: [...] }, ...]
  // Opcional. Si no llega, la vista de gráfico no aparece.
  // Conviene que traiga 13 meses: 12 para el promedio anual más el actual.
  //
  // Va así y no como un array de porcentajes ya calculados porque la
  // selección de cada KPI es una REGLA: con los items del mes, el gráfico de
  // un KPI recién creado se dibuja al instante. Con porcentajes precalculados
  // habría que volver al backend cada vez que alguien arma o toca un KPI.
  porMes = null,
  // Maestro completo de artículos e insumos, sin filtrar por período:
  //   { ventas: [{id, nombre, agrupacion, rubro, subrubro}], compras: [...] }
  //
  // La configuración de un KPI es una REGLA PERMANENTE, pero las listas salían
  // de los items del período: un rubro sin movimiento ese mes no aparecía y no
  // se podía tildar. Configurado en un mes flojo, el KPI quedaba incompleto
  // para siempre. Con el maestro la lista es siempre la misma; lo que cambia
  // con el período son los importes.
  //
  // Opcional: sin esto se usa lo del período, como antes.
  maestro = null,
  // La ventana ANTERIOR del mismo largo que el período filtrado:
  //   { ventas: [...], compras: [...] }
  // 30 días contra los 30 previos, 90 contra los 90 previos. Sin esto el chip
  // no muestra variación, que es lo correcto: comparar un período de 90 días
  // contra "el mes anterior" da un número que no significa nada. En histórico
  // no hay con qué comparar, así que no se manda y no se muestra.
  periodoAnterior = null,
}) {
  const [abierto, setAbierto] = useState(false);
  // Sin nada configurado el resumen muestra 0% y no dice qué hacer: se abre
  // directo en Configurar, con la explicación.
  const [modo, setModo] = useState(() => {
    const g = (kpis ?? []).find((k) => k.general);
    const vacio = (r) => ((r?.grupos?.length ?? 0) + (r?.sueltos?.length ?? 0)) === 0;
    return g && vacio(g.ventas) && vacio(g.compras) ? "config" : "resumen";
  }); // resumen | config
  const [vista, setVista] = useState("datos");     // datos | grafico
  const [serie, setSerie] = useState("foodcost");  // foodcost | compras | ventas
  const [actual, setActual] = useState(kpis[0]?.id);
  const [nivel, setNivel] = useState({ ventas: "agrupacion", compras: "rubro" });
  const [busca, setBusca] = useState({ ventas: "", compras: "" });
  const [desplegado, setDesplegado] = useState({});
  const [desplFalta, setDesplFalta] = useState({});
  const [chipsAbiertos, setChipsAbiertos] = useState({});
  const [chipsSueltos, setChipsSueltos] = useState({});
  const [verRes, setVerResultado] = useState({});
  const [verBloq, setVerBloq] = useState({});
  const [lejos, setLejos] = useState(false);
  const panelRef = useRef(null);
  const [buscaRes, setBuscaRes] = useState({});
  const [mesIdx, setMesIdx] = useState(null);   // null = el último
  const [aviso, setAviso] = useState("");

  const raiz = useRef(null);
  const dentro = useRef(false);

  useEffect(() => {
    // el cierre no puede resolverse con contains sobre el target:
    // al re-renderizar la lista el nodo clickeado deja de existir en el DOM
    const down = (e) => (dentro.current = !!raiz.current?.contains(e.target));
    const up = () => { if (!dentro.current) setAbierto(false); };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("click", up);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("click", up);
    };
  }, []);

  // Lugar del panel. Con la pantalla angosta la barra de filtros se parte y
  // el chip cae al renglón de abajo, pegado a la izquierda: anclado a su
  // borde derecho el panel (860px) se salía de la pantalla por la izquierda
  // y por abajo. Se mide al abrir (y al cambiar el tamaño de la ventana) y se
  // corre lo justo para que entre entero.
  const [posPanel, setPosPanel] = useState(null);
  useLayoutEffect(() => {
    if (!abierto) return undefined;
    const medir = () => {
      const caja = raiz.current?.getBoundingClientRect();
      if (!caja) return;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const ancho = Math.min(860, vw * 0.94);
      const izq = Math.max(8, Math.min(caja.right - ancho, vw - ancho - 8));
      const libre = window.innerHeight - (caja.bottom + 7) - 12;
      setPosPanel({ left: Math.round(izq - caja.left), alto: Math.max(320, Math.round(libre)) });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [abierto, modo]);

  // Si cambia el negocio activo y llegan otros kpis (otro id[0]), seguir el actual.
  useEffect(() => {
    if (!kpis.some((k) => k.id === actual)) setActual(kpis[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpis]);

  // Lista completa con los importes del período pegados encima. Lo que no
  // tuvo movimiento queda en 0 y se puede tildar igual.
  const unir = (delPeriodo, todos) => {
    if (!todos?.length) return delPeriodo;
    const porId = new Map(delPeriodo.map((i) => [String(i.id), i]));
    return todos.map((m) => ({ ...m, importe: porId.get(String(m.id))?.importe ?? 0 }));
  };
  const datos = useMemo(() => ({
    ventas: unir(ventas, maestro?.ventas),
    compras: unir(compras, maestro?.compras),
  }), [ventas, compras, maestro]);
  const kpi = kpis.find((k) => k.id === actual) ?? kpis[0];
  const general = kpis.find((k) => k.general);

  const calc = useMemo(
    () => (kpi ? foodCost(datos.ventas, datos.compras, kpis, kpi.id) : null),
    [datos, kpis, kpi]
  );
  // La validación compara la suma de los sub-KPI contra el general. Con el
  // general solo no hay nada que comparar: antes decía "no cuadra" porque
  // nadie cubría nada, que es una alarma por un problema que no existe.
  const haySubs = useMemo(() => kpis.some((k) => !k.general), [kpis]);
  // Evolución del KPI activo, mes a mes. Se resuelve la MISMA regla contra
  // los items de cada mes, así que sirve igual para un KPI recién creado.
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  // El gráfico muestra 8 meses por vez: con menos barras entran fuentes más
  // grandes. La ventana TERMINA en el mes elegido, así que al caminar hacia
  // atrás con las flechas el gráfico se corre con vos.
  const MESES_EN_GRAFICO = 8;

  const evolucion = useMemo(() => {
    if (!porMes?.length || !kpi) return [];
    return [...porMes]
      .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
      .map((m) => {
        const v = sumar(itemsDe(m.ventas ?? [], kpis, kpi.id, "ventas"));
        const c = sumar(itemsDe(m.compras ?? [], kpis, kpi.id, "compras"));
        return {
          mes: m.mes,
          etiqueta: MESES[Number(String(m.mes).slice(5, 7)) - 1] ?? m.mes,
          ventas: v, compras: c,
          foodcost: v > 0 ? (c / v) * 100 : 0,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porMes, kpis, kpi, actual]);

  const hayGrafico = evolucion.length > 1;

  // Variación del período contra su ventana anterior, solo si llegó.
  const calcAnterior = useMemo(() => {
    if (!periodoAnterior || !kpi) return null;
    const a = unir(periodoAnterior.ventas ?? [], maestro?.ventas);
    const b = unir(periodoAnterior.compras ?? [], maestro?.compras);
    return foodCost(a, b, kpis, kpi.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoAnterior, maestro, kpis, kpi]);

  // Mes que se está mirando. Por defecto el último; las flechas lo mueven.
  const idxMes = evolucion.length
    ? Math.min(Math.max(mesIdx ?? evolucion.length - 1, 0), evolucion.length - 1)
    : -1;

  // El mes elegido es lo que se compara mes a mes. El período filtrado vive
  // en el chip; acá abajo siempre se habla de un mes.
  const mesActual = idxMes >= 0 ? evolucion[idxMes] : null;

  // Los 8 meses que se dibujan: los que terminan en el que se está mirando.
  const ventana = useMemo(
    () => (idxMes < 0 ? [] : evolucion.slice(Math.max(0, idxMes - (MESES_EN_GRAFICO - 1)), idxMes + 1)),
    [evolucion, idxMes]);
  const pctVista = mesActual ? mesActual.foodcost : (calc?.pct ?? 0);

  // Promedio anual: los 12 meses ANTERIORES al que se mira, sin incluirlo.
  // Comparar un mes contra un promedio que se incluye a sí mismo achica la
  // diferencia y la vuelve inútil. Con menos de 12 se aclara cuántos son,
  // para no llamar "anual" a tres meses.
  const promedioAnual = useMemo(() => {
    if (idxMes < 1) return null;
    const previos = evolucion.slice(Math.max(0, idxMes - 12), idxMes);
    if (!previos.length) return null;
    return {
      pct: previos.reduce((a, m) => a + m.foodcost, 0) / previos.length,
      meses: previos.length,
    };
  }, [evolucion, idxMes]);

  const valV = useMemo(() => validar(datos.ventas, kpis, "ventas"), [datos, kpis]);
  const valC = useMemo(() => validar(datos.compras, kpis, "compras"), [datos, kpis]);
  const cuadra = valV.diferencia === 0 && valC.diferencia === 0;

  /* ---- mutaciones ---- */

  const aplicar = (nuevos) => onChange?.(nuevos);

  const editarRegla = (lado, fn) => {
    const nuevos = kpis.map((k) =>
      k.id === kpi.id ? { ...k, [lado]: fn({ grupos: [], excluidos: [], sueltos: [], ...k[lado] }) } : k
    );
    if (kpi.general) {
      const universo = new Set(
        resolver(datos[lado], nuevos.find((k) => k.general)[lado]).map((i) => i.id)
      );
      const tocados = nuevos
        .filter((k) => !k.general)
        .filter((k) => resolver(datos[lado], k[lado]).some((i) => !universo.has(i.id)))
        .map((k) => k.nombre);
      setAviso(tocados.length ? `Lo que sacaste también sale de ${tocados.join(", ")}.` : "");
    }
    aplicar(nuevos);
  };

  const toggleItem = (lado, item) => {
    editarRegla(lado, (r) => {
      const enGrupo = r.grupos.some((s) => claveDe(item, s.nivel) === s.clave);
      const esta = itemsDe(datos[lado], kpis, kpi.id, lado).some((i) => i.id === item.id);
      if (esta) {
        return enGrupo
          ? { ...r, excluidos: [...r.excluidos, item.id] }
          : { ...r, sueltos: quitar(r.sueltos, item.id) };
      }
      return enGrupo
        ? { ...r, excluidos: quitar(r.excluidos, item.id) }
        : { ...r, sueltos: [...r.sueltos, item.id] };
    });
  };

  // Sumar al general un grupo que hoy está afuera, y de paso a este KPI.
  // Cambia el universo contra el que se mide todo, por eso es una acción
  // con nombre propio y no el mismo tilde que el resto.
  const sumarAlGeneral = (lado, niv, clave) => {
    const ids = new Set(datos[lado].filter((i) => claveDe(i, niv) === clave).map((i) => String(i.id)));
    const sumar = (r) => ({
      grupos: [...(r?.grupos ?? []).filter((g) => !(g.nivel === niv && g.clave === clave)), { nivel: niv, clave }],
      excluidos: (r?.excluidos ?? []).filter((id) => !ids.has(String(id))),
      sueltos: (r?.sueltos ?? []).filter((id) => !ids.has(String(id))),
    });
    onChange?.(kpis.map((k) =>
      (k.general || k.id === kpi.id) ? { ...k, [lado]: sumar(k[lado]) } : k));
  };

  // Mandar de una todo lo que no tomó ningún KPI a este sub-KPI. Van como
  // sueltos y no como grupos: son justo los que sobraron, no el rubro entero.
  const asignarFaltantes = (lado, items) => {
    const ids = items.map((i) => i.id);
    editarRegla(lado, (r) => ({
      ...r,
      excluidos: r.excluidos.filter((id) => !ids.includes(id)),
      sueltos: [...new Set([...r.sueltos, ...ids])],
    }));
  };

  const toggleGrupo = (lado, niv, clave) => {
    const propios = new Set(itemsDe(datos[lado], kpis, kpi.id, lado).map((i) => i.id));
    const hojas = datos[lado].filter((i) => claveDe(i, niv) === clave);
    const elegibles = hojas.filter((i) => propios.has(i.id) || disponible(lado, i));
    const todos = elegibles.length > 0 && elegibles.every((i) => propios.has(i.id));
    editarRegla(lado, (r) => {
      if (todos) {
        const grupos = r.grupos.filter((s) => !(s.nivel === niv && s.clave === clave));
        const quedan = elegibles.filter((i) => grupos.some((s) => claveDe(i, s.nivel) === s.clave));
        return {
          grupos,
          sueltos: r.sueltos.filter((id) => !elegibles.some((i) => i.id === id)),
          excluidos: [...r.excluidos, ...quedan.map((i) => i.id)],
        };
      }
      const ids = new Set(elegibles.map((i) => i.id));
      // mismo motivo que en "tildar todas": lo que ya es de otro KPI no entra
      const ajenos = hojas.filter((i) => !ids.has(i.id)).map((i) => i.id);
      return {
        grupos: [...r.grupos, { nivel: niv, clave }],
        excluidos: [...new Set([...r.excluidos.filter((id) => !ids.has(id)), ...ajenos])],
        sueltos: r.sueltos.filter((id) => !ids.has(id)),
      };
    });
  };

  const disponible = useCallback(
    (lado, item) => {
      if (!kpi.general) {
        const universo = new Set(resolver(datos[lado], general?.[lado] ?? {}).map((i) => i.id));
        if (!universo.has(item.id)) return false;
      }
      return !duenio(lado, item);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kpi, kpis, general, datos]
  );

  const duenio = (lado, item) => {
    if (kpi.general) return null;
    const otro = kpis.find(
      (k) => !k.general && k.id !== kpi.id && itemsDe(datos[lado], kpis, k.id, lado).some((i) => i.id === item.id)
    );
    return otro?.nombre ?? null;
  };

  // Todo lo que los subcomponentes necesitan, en un solo objeto. Se arma acá
  // (ANTES del return temprano de más abajo) para que este useMemo se llame
  // siempre, haya o no kpi — si quedara después del `if (!kpi) return null`,
  // el primer render con kpis vacío (mientras BusinessesAPI.getFoodCostKpis
  // todavía no resolvió) llamaría un hook menos que los renders siguientes, y
  // React tira "Rendered more hooks than during the previous render".
  // IMPORTANTE: estos componentes viven FUERA de KpiFoodCost a propósito.
  // Definidos adentro, cada render creaba un tipo de componente nuevo y React
  // desmontaba y volvía a montar el árbol entero: el scroll de la lista se iba
  // al tope al tildar o desplegar, y el buscador perdía el foco después de la
  // primera letra.
  const ctx = useMemo(() => ({
    datos, kpis, kpi, general, nivel, setNivel, busca, setBusca,
    desplegado, setDesplegado, desplFalta, setDesplFalta, chipsAbiertos, setChipsAbiertos,
    chipsSueltos, setChipsSueltos, verRes, setVerResultado, buscaRes, setBuscaRes,
    verBloq, setVerBloq,
    toggleItem, toggleGrupo, disponible, duenio, editarRegla, sumarAlGeneral, asignarFaltantes,
  }), [datos, kpis, kpi, general, nivel, busca, desplegado, desplFalta, chipsAbiertos, chipsSueltos, verRes, buscaRes, verBloq, disponible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Todos los hooks ya se llamaron arriba, sin importar si hay kpi o no — acá
  // recién es seguro salir temprano (antes del primer render con kpis vacío,
  // mientras BusinessesAPI.getFoodCostKpis todavía no resolvió, esto rompía
  // las reglas de hooks: "disponible"/"ctx" quedaban sin declararse en ese
  // render y React tiraba "Rendered more hooks than during the previous render").
  if (!kpi) return null;

  /* ---- render ---- */

  // Un KPI al que todavía no le eligieron nada: no hay números que mostrar.
  const vacioDe = (r) => ((r?.grupos?.length ?? 0) + (r?.sueltos?.length ?? 0)) === 0;
  const sinElegir = modo === "config" && vacioDe(kpi?.ventas) && vacioDe(kpi?.compras);

  const alto = calc.pct > 20;

  return (
    <div className="kfc" ref={raiz}>
      <style>{CSS}</style>

      <div className={`kfc-chip${abierto ? " on" : ""}`} onClick={() => setAbierto((a) => !a)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A7268" strokeWidth="2" strokeLinecap="round">
          <path d="M3 17l5-6 4 3 5-7 4 4" />
        </svg>
        <span className="kfc-ti">
          FOOD COST
          <b>
            {kpi.nombre.toUpperCase()}
            {periodoLabel && <em>· {periodoLabel}</em>}
          </b>
        </span>
        {/* Si los sub-KPI no cubren el general hay plata sin contar en ningún
            lado. Se avisa sin abrir el panel. */}
        {haySubs && !cuadra && (
          <span className="kfc-rev" title="Tenés compras o ventas sin asignar a ningún KPI">⚠ revisar</span>
        )}
        <span className={`kfc-pill${alto ? "" : " ok"}`}>
          {d1(calc.pct)}%
          {/* Sin ventana anterior comparable no se muestra nada: antes salía
              la diferencia contra el mes anterior aunque el período fuera de
              90 días o histórico, y ese número no significaba nada. */}
          {calcAnterior && (
            <span className="kfc-var">
              {calc.pct - calcAnterior.pct >= 0 ? " ↗ +" : " ↘ −"}
              {d1(Math.abs(calc.pct - calcAnterior.pct))}
            </span>
          )}
        </span>
        <span className={`kfc-arrow${abierto ? " ab" : ""}`}>⌄</span>
      </div>

      {abierto && (
        <div
          className={`kfc-panel${modo === "config" ? " kfc-modocfg" : ""}`}
          ref={panelRef}
          style={posPanel ? {
            left: posPanel.left, right: "auto",
            maxHeight: Math.min(700, posPanel.alto),
            ...(modo === "config" ? { height: Math.min(670, posPanel.alto) } : null),
          } : undefined}
          onScroll={(e) => {
            const v = e.currentTarget.scrollTop > 220;
            setLejos((a) => (a === v ? a : v));
          }}
        >
          <div className="kfc-tabs">
            {/* El general manda y los sub cuelgan de él: van un escalón más
                chicos y detrás de una línea, para que no se lean como pares. */}
            {kpis.map((k, idx) => {
              // El nombre se edita en la propia pestaña: un campo aparte solo
              // para eso ocupaba un renglón entero del panel.
              const editable = k.id === kpi.id && modo === "config" && !k.general;
              // El general manda y los sub cuelgan: un escalón más chicos y
              // detrás de una línea, para que no se lean como pares.
              const sub = !k.general;
              // La línea va siempre después del general, haya sub-KPI o no:
              // el "+ Nuevo" ya vive de ese lado y lo que se cree entra ahí.
              const tab = editable ? (
                <input
                  key={k.id}
                  className="kfc-tbk on sub kfc-tbin"
                  value={k.nombre}
                  /* el ancho sigue al texto: con el atributo size el navegador
                     agregaba aire y la pestaña quedaba más grande que las otras */
                  style={{ width: `calc(${Math.max(6, k.nombre.length)}ch + 34px)` }}
                  onChange={(e) => onChange?.(kpis.map((x) => (x.id === k.id ? { ...x, nombre: e.target.value } : x)))}
                />
              ) : (
                <span
                  key={k.id}
                  className={`kfc-tbk${k.id === kpi.id ? " on" : ""}${sub ? " sub" : ""}`}
                  onClick={() => { setActual(k.id); setAviso(""); }}
                >
                  {k.nombre}
                </span>
              );
              return k.general ? (
                <React.Fragment key={`g${k.id}`}>
                  {tab}
                  <span className="kfc-tsep" />
                </React.Fragment>
              ) : tab;
            })}
            {/* Crear uno y quedarse parado en el anterior obliga a ir a
                buscarlo: se salta al nuevo y directo a configurarlo. */}
            <span className="kfc-tbk add" onClick={() => {
              const nuevo = nuevoKpi(kpis);
              onChange?.([...kpis, nuevo]);
              setActual(nuevo.id);
              setModo("config");
              setAviso("");
            }}>+ Nuevo</span>
            {/* Los controles de la derecha viven juntos: así Configurar queda
                siempre pegado al borde, esté o no el switch de vista. */}
            <span className="kfc-tright">
              {hayGrafico && modo === "resumen" && (
                <span className="kfc-sw">
                  {[["datos", "▦"], ["grafico", "∿"]].map(([v, ic]) => (
                    <span key={v} className={vista === v ? "on" : ""} onClick={() => setVista(v)}>{ic}</span>
                  ))}
                </span>
              )}
              <span className="kfc-cfg" onClick={() => setModo((m) => (m === "config" ? "resumen" : "config"))}>
                {haySubs && (
                  <span className={cuadra ? "ok" : "bad"}>{cuadra ? "✓ cuadra" : "⚠ no cuadra"}</span>
                )}
                ⚙ Configurar
              </span>
            </span>
          </div>

          {modo === "resumen" ? (
            <>
              {!(hayGrafico && vista === "grafico") && (
              <div className="kfc-calc">
                <div className="kfc-origen">
                  <div className="kfc-fila">
                    <span className="kfc-rot">Ventas</span>
                    <span className="kfc-cifra kfc-vta kfc-largo">{fmt(mesActual ? mesActual.ventas : calc.ventas)}</span>
                    <span className="kfc-cifra kfc-vta kfc-corto">{fmtCorto(mesActual ? mesActual.ventas : calc.ventas)}</span>
                  </div>
                  <div className="kfc-fila">
                    <span className="kfc-rot">Compras</span>
                    <span className="kfc-cifra kfc-largo">{fmt(mesActual ? mesActual.compras : calc.compras)}</span>
                    <span className="kfc-cifra kfc-corto">{fmtCorto(mesActual ? mesActual.compras : calc.compras)}</span>
                  </div>
                </div>

                <div className="kfc-result">
                  {mesActual ? (
                    <div className="kfc-nav">
                      <span className={`kfc-fl${idxMes <= 0 ? " off" : ""}`}
                        onClick={() => idxMes > 0 && setMesIdx(idxMes - 1)}>‹</span>
                      <span className="kfc-mes">{nombreMes(mesActual.mes)}</span>
                      <span className={`kfc-fl${idxMes >= evolucion.length - 1 ? " off" : ""}`}
                        onClick={() => idxMes < evolucion.length - 1 && setMesIdx(idxMes + 1)}>›</span>
                      {idxMes !== evolucion.length - 1 && (
                        <span className="kfc-fl kfc-vol" title="Ir al último mes"
                          onClick={() => setMesIdx(null)}>⟲</span>
                      )}
                    </div>
                  ) : <div className="kfc-nav"><span className="kfc-mes">{periodoLabel}</span></div>}

                  <div className="kfc-fcrow">
                    <span className={`kfc-fcbig ${pctVista > 20 ? "na" : "ok"}`}>{d1(pctVista)}%</span>
                    <span className="kfc-deltas">
                      {/* Nombra el mes real contra el que compara, así el valor
                          de referencia entre paréntesis sobra. */}
                      {mesActual && idxMes > 0 && (() => {
                        const prev = evolucion[idxMes - 1];
                        const dv = mesActual.foodcost - prev.foodcost;
                        return (
                          <span className="kfc-delta">
                            <b className={dv > 0 ? "sube" : "baja"}>
                              {dv >= 0 ? "+" : "−"}{d1(Math.abs(dv))} pts
                            </b>
                            <span> vs {MESES_LARGOS[Number(prev.mes.slice(5, 7)) - 1]}</span>
                          </span>
                        );
                      })()}
                      {mesActual && promedioAnual && (
                        <span className="kfc-delta">
                          <b className={mesActual.foodcost - promedioAnual.pct > 0 ? "sube" : "baja"}>
                            {mesActual.foodcost - promedioAnual.pct >= 0 ? "+" : "−"}
                            {d1(Math.abs(mesActual.foodcost - promedioAnual.pct))} pts
                          </b>
                          <span> vs {promedioAnual.meses >= 12
                            ? "el promedio del año"
                            : `el promedio de ${promedioAnual.meses} meses`}</span>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              )}
              {hayGrafico && vista === "grafico" && (
                <div className="kfc-graf">
                  {mesActual && (
                    <div className="kfc-gnav">
                      <span className={`kfc-fl${idxMes <= 0 ? " off" : ""}`}
                        onClick={() => idxMes > 0 && setMesIdx(idxMes - 1)}>‹</span>
                      <span className="kfc-mes">{nombreMes(mesActual.mes)}</span>
                      <span className={`kfc-fl${idxMes >= evolucion.length - 1 ? " off" : ""}`}
                        onClick={() => idxMes < evolucion.length - 1 && setMesIdx(idxMes + 1)}>›</span>
                      {idxMes !== evolucion.length - 1 && (
                        <span className="kfc-fl kfc-vol" title="Ir al último mes"
                          onClick={() => setMesIdx(null)}>⟲</span>
                      )}
                    </div>
                  )}
                  <div className="kfc-gcuerpo">
                    <div className="kfc-gtabs">
                      {[["foodcost", "Food cost"], ["compras", "Compras"], ["ventas", "Ventas"]].map(([k, lab]) => (
                        <span key={k} className={serie === k ? "on" : ""} onClick={() => setSerie(k)}>{lab}</span>
                      ))}
                    </div>
                    <div className="kfc-gcanvas">
                      <BarrasMes datos={ventana} serie={serie} foco={ventana.length - 1} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Esto compara la suma de los sub-KPI contra el general. Parado
                  en el general no aplica: ahí se define el universo, no se lo
                  reparte. El chip de arriba igual avisa si algo no cuadra. */}
              {/* Mientras no hay nada elegido, explicar en vez de mostrar
                  cuadros en cero: "ventas cubiertas $ 0" no dice qué hacer. */}
              {sinElegir && (
                <div className="kfc-intro">
                  {kpi.general
                    ? "Para medir tu food cost general elegí a la izquierda los artículos que suman ventas y a la derecha los insumos que son mercadería."
                    : (
                      <>
                        Este nuevo KPI mide un costo de mercadería especial, o sea solo una parte
                        del negocio: bebidas, comidas, cafetería.
                        <span className="kfc-introl">Elegí qué ventas y qué compras le corresponden.</span>
                        <span className="kfc-introp">(Solo podés tomar de lo que ya está en el general)</span>
                      </>
                    )}
                </div>
              )}

              {!sinElegir && haySubs && !kpi.general && (
              <div
                className={`kfc-valid ${cuadra ? "vok" : "vbad"}`}
                onClick={() => document.getElementById("kfc-faltan")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
              >
                <Bloque label="VENTAS CUBIERTAS" val={valV} />
                <span
                  className={`kfc-vmsg ${cuadra ? "ok" : "bad"}`}
                  onClick={() => document.getElementById("kfc-faltan")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                >
                  {cuadra
                    ? "La suma de los sub-KPI da exactamente el general"
                    : "La suma de los sub-KPI no da el general  ver qué falta ↓"}
                </span>
                <Bloque label="COMPRAS CUBIERTAS" val={valC} der />
              </div>
              )}

              <div className="kfc-cname" style={{ display: "none" }}>
                <div className="kfc-cl">NOMBRE DEL KPI</div>
                <input
                  className="kfc-cin"
                  value={kpi.nombre}
                  onChange={(e) => aplicar(kpis.map((k) => (k.id === kpi.id ? { ...k, nombre: e.target.value } : k)))}
                />
                {/* Solo los avisos reales. La explicación fija de qué es el
                    general se leía una vez y después era ruido. */}
                {aviso && <div className="kfc-alc warn">{aviso}</div>}
              </div>

              <div className="kfc-two">
                <Columna ctx={ctx} lado="ventas" titulo="VENTAS" niveles={NIVELES_VENTAS} placeholder="Buscar artículo…" />
                <Columna ctx={ctx} lado="compras" titulo="COMPRAS" niveles={NIVELES_COMPRAS} placeholder="Buscar insumo…" />
              </div>

              {!sinElegir && haySubs && !kpi.general && !cuadra && (
                <div id="kfc-faltan">
                  {/* Un título por lado: el bloque de ventas y el de compras
                      se leen por separado, igual que las columnas de arriba. */}
                  <div className="kfc-ftwo">
                    <ColumnaFaltante ctx={ctx} lado="ventas"
                      titulo="Sin asignar · artículos de venta" val={valV} />
                    <ColumnaFaltante ctx={ctx} lado="compras"
                      titulo="Sin asignar · insumos de compra" val={valC} />
                  </div>
                </div>
              )}

              <div className="kfc-cfoot">
                {!kpi.general && (
                  <span
                    className="kfc-del"
                    onClick={async () => {
                      // Borra sin avisar y sin vuelta atrás — un clic de más acá
                      // (fácil de confundir con otro botón del pie) se llevaba
                      // el KPI entero sin que nadie se diera cuenta.
                      const ok = await showConfirm(
                        `¿Eliminar el KPI "${kpi.nombre}"? Esta acción no se puede deshacer.`,
                        { danger: true }
                      );
                      if (!ok) return;
                      const resto = kpis.filter((k) => k.id !== kpi.id);
                      setActual(resto[0]?.id);
                      aplicar(resto);
                    }}
                  >🗑
                    Eliminar este KPI
                  </span>
                )}
                {/* Abajo de todo, la configuración queda lejos: este botón
                    devuelve el foco arriba sin tener que scrollear a mano. */}
                {lejos && (
                  <span
                    className="kfc-bup"
                    onClick={() => panelRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                  >↑ Volver arriba</span>
                )}
                <span className="kfc-bc" onClick={() => setModo("resumen")}>Cancelar</span>
                <span className="kfc-bgd" onClick={() => setModo("resumen")}>Listo</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function nuevoKpi(kpis) {
  const vacio = { grupos: [], excluidos: [], sueltos: [] };
  return {
    id: `kpi_${Date.now()}`,
    nombre: "Nuevo",
    general: false,
    ventas: vacio,
    compras: { ...vacio },
    historico: [],
  };
}

/** KPI general "semilla" — se usa cuando el negocio todavía no configuró
 * ninguno (food_cost_kpis vacío en el backend). Arranca sin nada tildado. */
export function kpiGeneralSemilla() {
  const vacio = { grupos: [], excluidos: [], sueltos: [] };
  return {
    id: "general",
    nombre: "General",
    general: true,
    ventas: vacio,
    compras: { ...vacio },
    historico: [],
  };
}

/* ========== estilos ========== */

const CSS = `
.kfc{position:relative;font-variant-numeric:tabular-nums;}
.kfc *{box-sizing:border-box;}
.kfc-chip{display:flex;align-items:center;gap:9px;border:1px solid #DCE6E2;border-radius:7px;
  background:#F6F9F8;padding:6px 11px;cursor:pointer;user-select:none;white-space:nowrap;}
.kfc-chip.on{border-color:#C9A96B;background:#FDF6EC;}
.kfc-ti{font-size:9px;font-weight:800;letter-spacing:.6px;color:#5A7268;line-height:1.3;}
.kfc-ti b{display:block;color:#2E5248;font-size:9.5px;}
.kfc-ti em{font-style:normal;font-weight:400;color:#7D8A88;margin-left:3px;text-transform:none;letter-spacing:0;}
.kfc-rev{font-size:10px;font-weight:800;color:#C0392B;background:#FDF4F2;
  border:1px solid #F0D3CA;border-radius:11px;padding:2px 8px;white-space:nowrap;}
.kfc-pill{font-size:15px;font-weight:700;color:#C77C0B;letter-spacing:-.3px;}
.kfc-pill.ok{color:#2E8B57;}
.kfc-var{font-size:10.5px;font-weight:600;color:#9A7538;}
.kfc-arrow{color:#8B9A95;font-size:13px;transition:transform .3s;}
.kfc-arrow.ab{transform:rotate(180deg);}

.kfc-panel{position:absolute;right:0;top:calc(100% + 7px);z-index:40;width:860px;max-width:94vw;
  border:1px solid #DCE6E2;border-radius:10px;background:#F6F9F8;box-shadow:0 12px 36px rgba(20,34,30,.19);
  /* Por defecto (resumen/gráfico, contenido corto) el panel se ajusta al
     contenido, con este tope como techo. El panel es absolute bajo el botón
     que lo abre, no fixed al viewport: el tope sigue atado a 100dvh para no
     empujarlo más abajo de lo que la página deja ver. */
  max-height:min(calc(100dvh - 90px),700px);overflow-y:auto;overscroll-behavior:contain;cursor:default;}
/* Modo Configurar: contenido largo (listas de rubros/subrubros) — ahí SÍ
   conviene alto FIJO en vez de max-height, así el panel no se encoge ni se
   estira con cada tilde y el pie con Guardar queda en el mismo lugar; lo
   que no entra scrollea adentro (tabs arriba y pie abajo quedan sticky
   dentro de ese scroll, siempre visibles). */
.kfc-panel.kfc-modocfg{height:min(calc(100dvh - 110px),670px);}
.kfc-tabs{display:flex;gap:6px;padding:9px 14px;border-bottom:1px solid #EEF1F3;flex-wrap:wrap;
  align-items:center;position:sticky;top:0;background:#F6F9F8;z-index:3;}
.kfc-tbk{border:1px solid #E1E6EA;border-radius:16px;padding:5px 13px;font-size:12px;color:#7D8A88;cursor:pointer;white-space:nowrap;}
.kfc-tbk.on{border-color:#2E5248;background:rgba(46,82,72,.1);color:#2E5248;font-weight:700;}
.kfc-tbk.sub{font-size:11px;padding:4px 11px;}
.kfc-tsep{width:1px;align-self:stretch;background:#DCE6E2;margin:3px 4px;}
.kfc-tbk.add{border-style:dashed;color:#3C9BD6;}
/* El input tiene que medir EXACTO lo mismo que las pestañas span: sin esto
   quedaba 2px más alto y rompía la línea. */
.kfc-tbin{font-family:inherit;font-size:12px;font-weight:700;outline:none;
  box-sizing:border-box;line-height:16px;height:26px;text-align:center;
  padding:4px 13px;border-radius:16px;margin:0;vertical-align:top;}
.kfc-tbin:focus{border-color:#3C9BD6;background:#fff;color:#1F2933;}

.kfc-cfg{font-size:11.5px;color:#3C9BD6;font-weight:600;cursor:pointer;white-space:nowrap;}
.kfc-cfg .ok{color:#2E8B57;font-weight:700;margin-right:9px;}
.kfc-cfg .bad{color:#C0392B;font-weight:700;margin-right:9px;}

/* ───────── Franja de resultado ─────────
   Izquierda: de dónde sale. Derecha: el mes, el resultado y cómo se mueve.
   El rótulo ancla a la izquierda y las cifras comparten columna alineadas
   por la derecha: las unidades caen una debajo de otra y los dos importes
   se comparan de un vistazo. */
/* El sobrante va a la IZQUIERDA: los dos bloques se apoyan contra el borde
   derecho, que es donde está el chip que abre el panel. */
.kfc-calc{display:flex;align-items:stretch;gap:20px;padding:11px 16px;flex-wrap:wrap;
  justify-content:flex-end;}

.kfc-origen{display:flex;flex-direction:column;justify-content:center;gap:4px;flex:0 1 auto;}
.kfc-fila{display:flex;align-items:baseline;gap:16px;}
.kfc-rot{font-size:11px;color:#8B9A95;flex:1 1 auto;}
.kfc-cifra{font-size:16px;font-weight:500;color:#1F2933;letter-spacing:-.2px;
  font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;min-width:128px;}
/* Lo único que separa ventas de compras es el peso. */
.kfc-cifra.kfc-vta{font-weight:800;}

.kfc-result{display:flex;flex-direction:column;justify-content:center;gap:5px;
  padding-left:20px;border-left:1px solid #E8EDEB;flex:0 1 auto;min-width:0;}
.kfc-nav{display:flex;align-items:center;gap:6px;}
.kfc-fl{width:19px;height:19px;border:1px solid #DCE6E2;border-radius:5px;background:#fff;
  display:flex;align-items:center;justify-content:center;cursor:pointer;color:#2E5248;
  font-size:12px;line-height:1;user-select:none;flex:0 0 auto;}
.kfc-fl:hover{background:#EEF4F2;}
.kfc-fl.off{opacity:.3;cursor:default;}
.kfc-fl.off:hover{background:#fff;}
.kfc-vol{color:#3C9BD6;border-color:#BFDCEF;}
.kfc-mes{font-size:13px;font-weight:600;color:#1F2933;white-space:nowrap;}

.kfc-fcrow{display:flex;align-items:center;gap:16px;min-width:0;}
.kfc-fcbig{font-size:32px;font-weight:700;letter-spacing:-1.3px;line-height:1;
  font-variant-numeric:tabular-nums;flex:0 0 auto;}
.kfc-fcbig.na{color:#C77C0B;} .kfc-fcbig.ok{color:#2E8B57;}
.kfc-deltas{display:flex;flex-direction:column;gap:2px;min-width:0;}
.kfc-delta{font-size:11.5px;color:#8B9A95;white-space:nowrap;line-height:1.35;}
.kfc-delta b{font-weight:700;font-variant-numeric:tabular-nums;}
.kfc-delta .sube{color:#C0392B;} .kfc-delta .baja{color:#2E8B57;}

.kfc-corto{display:none;}

@media (max-width:760px){
  .kfc-calc{gap:13px;padding:10px 12px;}
  .kfc-largo{display:none;} .kfc-corto{display:inline;}
  .kfc-cifra{min-width:78px;font-size:15px;}
  .kfc-fila{gap:11px;}
  .kfc-result{padding-left:13px;gap:4px;}
  .kfc-fcrow{gap:11px;}
  .kfc-fcbig{font-size:27px;letter-spacing:-1px;}
  .kfc-delta{font-size:10.5px;}
}
/* Abajo de 470px los dos bloques ya no entran lado a lado. Se apilan de
   forma deliberada: si se deja que el flex los parta solo, el borde que
   separa las columnas queda flotando en el medio del panel. */
@media (max-width:470px){
  .kfc-origen{width:100%;}
  .kfc-fila{justify-content:space-between;}
  .kfc-result{width:100%;padding-left:0;padding-top:9px;
    border-left:none;border-top:1px solid #E8EDEB;}
}

.kfc-tright{display:flex;align-items:center;gap:11px;margin-left:auto;}
.kfc-sw{display:flex;border:1px solid #DCE6E2;border-radius:7px;overflow:hidden;background:#fff;}
.kfc-sw span{padding:4px 9px;font-size:12px;color:#7D8A88;cursor:pointer;line-height:1.2;}
.kfc-sw span.on{background:#2E5248;color:#fff;}

.kfc-graf{padding:9px 14px 8px;}
.kfc-gnav{display:flex;align-items:center;gap:7px;justify-content:flex-end;margin-bottom:4px;}
.kfc-gcuerpo{display:flex;align-items:stretch;gap:12px;}
/* Los selectores de serie en columna, a la izquierda de la primera barra:
   eligen QUÉ se mide, así que no compiten con el eje. */
.kfc-gtabs{display:flex;flex-direction:column;gap:5px;justify-content:center;flex:0 0 auto;}
.kfc-gtabs span{border:1px solid #E1E6EA;border-radius:6px;padding:4px 11px;font-size:10.5px;
  color:#7D8A88;cursor:pointer;background:#fff;white-space:nowrap;text-align:center;}
.kfc-gtabs span.on{border-color:#2E5248;background:rgba(46,82,72,.1);color:#2E5248;font-weight:700;}
.kfc-gcanvas{flex:1;min-width:0;}
.kfc-cvw{position:relative;}
.kfc-cv{width:100%;height:116px;display:block;cursor:crosshair;}
.kfc-tip{position:absolute;transform:translate(-50%,-100%);background:#1F2933;color:#fff;
  border-radius:7px;padding:6px 11px;font-size:10.5px;line-height:1.55;white-space:nowrap;
  pointer-events:none;z-index:9;box-shadow:0 6px 18px rgba(16,30,26,.3);}
.kfc-tip b{color:#7FD3A0;margin-right:9px;}
.kfc-tip b:first-child{color:#fff;display:block;margin:0 0 2px;}
.kfc-tip .t{color:#9AA8A3;margin-right:4px;}

.kfc-valid{display:flex;align-items:flex-start;gap:16px;padding:10px 16px;border-bottom:1px solid #EEF1F3;font-size:11.5px;flex-wrap:wrap;}
.kfc-valid.vbad{background:#FDF4F2;cursor:pointer;}
.kfc-valid.vok{background:rgba(46,139,87,.06);}

.kfc-vbox{display:flex;flex-direction:column;gap:2px;flex:1 1 240px;min-width:0;order:1;}
.kfc-vbox.der{align-items:flex-end;text-align:right;order:2;}
.kfc-vfila{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.kfc-vbox.der .kfc-vfila{justify-content:flex-end;}
.kfc-vlab{font-size:9px;font-weight:800;letter-spacing:.6px;color:#8B9A95;}
.kfc-vnum{font-weight:700;} .kfc-vnum.ok,.kfc-valid .ok{color:#2E8B57;} .kfc-vnum.bad,.kfc-valid .bad{color:#C0392B;}
.kfc-de{color:#A3ADB6;}
/* Abajo y centrado. Entre los dos bloques no entra: los tres juntos piden
   1400px y el panel tiene 710, así que la fila se partía y el mensaje
   terminaba arriba. */
.kfc-vmsg{order:3;flex:1 1 100%;text-align:center;font-size:10.5px;
  line-height:1.35;cursor:pointer;margin-top:2px;}

.kfc-intro{padding:11px 16px;font-size:11.5px;color:#5A6A72;line-height:1.6;
  background:#F2F8FC;border-bottom:1px solid #DCE9F2;}
.kfc-introl{display:block;}
.kfc-introp{display:block;margin-top:3px;color:#8B9A95;}
.kfc-cname{padding:9px 16px 0;display:flex;align-items:center;gap:11px;flex-wrap:wrap;}
.kfc-cl{font-size:9px;font-weight:800;letter-spacing:.6px;color:#8B9A95;flex:0 0 auto;}
.kfc-cin{border:1px solid #E1E6EA;border-radius:7px;padding:6px 10px;font-size:13px;width:190px;font-family:inherit;outline:none;}
.kfc-cin:focus{border-color:#3C9BD6;}
.kfc-alc{font-size:10.5px;color:#8B9A95;line-height:1.4;flex:1;min-width:170px;}
.kfc-alc.warn{color:#B07B23;}

.kfc-two{display:flex;padding-top:9px;flex-wrap:wrap;}
.kfc-col{flex:1 1 300px;padding:0 16px 8px;min-width:0;display:flex;flex-direction:column;}
@media (min-width:640px){.kfc-col+.kfc-col{border-left:1px solid #EEF1F3;}}
.kfc-ch{font-size:10px;font-weight:800;letter-spacing:.6px;color:#5A7268;margin-bottom:6px;display:flex;align-items:center;gap:7px;}
.kfc-total{display:flex;align-items:baseline;justify-content:space-between;gap:10px;
  margin-top:7px;padding-top:7px;border-top:1px solid #E8EDEB;}
.kfc-total span{font-size:10.5px;color:#8B9A95;}
.kfc-total b{font-size:15px;font-weight:700;color:#1F2933;letter-spacing:-.2px;
  font-variant-numeric:tabular-nums;}
.kfc-total u{text-decoration:none;color:#3C9BD6;font-weight:700;cursor:pointer;margin-left:8px;}

/* La lista de lo que quedó adentro. */
.kfc-res{border:1px solid #DCE6E2;border-radius:8px;background:#fff;margin-top:8px;overflow:hidden;}
.kfc-resh{display:flex;align-items:center;gap:7px;padding:7px 10px;border-bottom:1px solid #EEF1F3;}
.kfc-resh b{font-size:12px;}
.kfc-resh span{font-size:10.5px;color:#8B9A95;white-space:nowrap;}
.kfc-resq{margin-left:auto!important;margin-bottom:0!important;width:138px;flex:0 1 138px;min-width:0;}
.kfc-reslist{max-height:208px;overflow-y:auto;}
.kfc-resr{display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid #F4F7F6;font-size:11.5px;}
.kfc-resr:last-child{border-bottom:none;}
.kfc-resn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.kfc-resg{font-size:9px;color:#A3ADB6;background:#F2F5F7;border-radius:4px;padding:1px 5px;
  white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;}
.kfc-resv{font-size:11px;color:#5A6A72;font-variant-numeric:tabular-nums;white-space:nowrap;}
.kfc-resr u{text-decoration:none;color:#C4CCD2;cursor:pointer;}
.kfc-resr:hover u{color:#C0392B;}
.kfc-resvacio{padding:12px;font-size:11px;color:#A3ADB6;text-align:center;}
.kfc-resp{padding:6px 10px;font-size:9.5px;color:#A3ADB6;background:#FAFCFB;}
.kfc-ch span{font-weight:400;color:#8B9A95;letter-spacing:0;font-size:10.5px;}
.kfc-ch b{margin-left:auto;font-size:12px;color:#2E5248;}
.kfc-lvl{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;}
.kfc-lv{border:1px solid #E1E6EA;border-radius:14px;padding:3px 8px;font-size:10px;color:#7D8A88;cursor:pointer;white-space:nowrap;}
.kfc-lv.on{border-color:#3C9BD6;background:rgba(60,155,214,.12);color:#2A7DB5;font-weight:700;}
.kfc-lv i{font-style:normal;font-weight:800;margin-left:4px;font-size:8.5px;
  background:#E6EBEF;color:#5A6A72;border-radius:8px;padding:1px 4px;}
.kfc-lv.on i{background:#2A7DB5;color:#fff;}
.kfc-lv i.full{background:#2E8B57;color:#fff;}
/* Colapsada muestra exactamente el rótulo + el primer chip de cada columna
   (10 + 3 + 19 = 32px). Más alto cortaba el segundo chip por la mitad. */
/* Colapsada: las columnas NO se parten. Antes, con poco ancho, la de
   "Quitados" se iba a un segundo renglón y el recorte la tapaba entera: no
   se veía siquiera que existía. Ahora se achican y se corta el texto. */
.kfc-sel{display:flex;gap:11px;flex-wrap:nowrap;margin-bottom:6px;min-height:24px;
  max-height:33px;overflow:hidden;align-items:flex-start;}
/* Desplegada se sale de su media columna y toma el ancho del panel: dentro
   de 270px dos columnas de chips no entran y terminaban apiladas, que es lo
   que se quería evitar. Cada columna mide lo que su chip más largo, así que
   los cortos no quedan estirados con medio recuadro vacío. */
.kfc-sel.abierto{max-height:none;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;}
/* Solo cuando las dos columnas están lado a lado tiene sentido salirse de la
   propia mitad; apiladas, la columna YA es todo el ancho. */
@media (min-width:640px){
  .kfc-sel.abierto{position:absolute;top:-7px;z-index:6;
    background:#fff;border:1px solid #DCE6E2;border-radius:8px;padding:9px 11px;
    box-shadow:0 8px 24px rgba(20,34,30,.13);}
  .kfc-sel.ab-ventas{left:-9px;right:calc(-100% - 42px);}
  .kfc-sel.ab-compras{right:-9px;left:calc(-100% - 42px);}
}
.kfc-sel.abierto .kfc-scol{flex:0 0 auto;}
.kfc-sel.abierto .kfc-sc{white-space:nowrap;overflow:visible;text-overflow:clip;max-width:none;}
.kfc-sel.abierto ~ .kfc-mas, .kfc-selwrap:has(.abierto) .kfc-mas{z-index:7;}
.kfc-scol{display:flex;flex-direction:column;gap:3px;align-items:flex-start;min-width:0;flex:0 1 auto;}
.kfc-mas{font-size:10.5px;color:#3C9BD6;cursor:pointer;font-weight:700;padding:4px 6px;
  white-space:nowrap;position:absolute;right:0;top:0;background:#F6F9F8;}
.kfc-selwrap{position:relative;padding-right:66px;min-height:28px;}
.kfc-sc{background:rgba(46,82,72,.1);color:#2E5248;border-radius:5px;padding:3px 8px;font-size:11px;
  font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.kfc-sc.quit{background:#FDF4F2;color:#B0451F;}
.kfc-sc.kfc-slt{background:#EEF4F8;color:#2A7DB5;align-self:flex-start;}
/* Desplegada las columnas llevan rótulo arriba: el chip suelto se baja ese
   renglón para quedar a la par de los demás chips. */
.kfc-sel.abierto .kfc-sc.kfc-slt{margin-top:13px;}
.kfc-sc.quit i{font-style:normal;font-weight:800;font-size:9px;margin-left:5px;
  background:#F2D9D0;border-radius:7px;padding:1px 5px;}
.kfc-scl{font-size:8.5px;font-weight:800;letter-spacing:.5px;color:#A3ADB6;text-transform:uppercase;
  line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.kfc-sc i{font-style:normal;font-size:10px;color:#6E8B80;margin-left:3px;}
.kfc-sc u{text-decoration:none;color:#8B9A95;cursor:pointer;margin-left:4px;}
.kfc-vacio{font-size:11.5px;color:#A3ADB6;}
.kfc-srch{border:1px solid #E1E6EA;border-radius:6px;padding:6px 10px;font-size:11.5px;margin-bottom:6px;width:100%;font-family:inherit;outline:none;}
.kfc-srch:focus{border-color:#3C9BD6;}
.kfc-list{border:1px solid #EEF1F3;border-radius:7px;/* 10 filas como piso: en una pantalla baja se recorta el marco, no la lista */
  height:clamp(300px,calc(100dvh - 385px),336px);overflow-y:auto;background:#fff;
  /* sin esto, Chrome reajusta el scroll solo al re-renderizar y la lista
     salta cada vez que se tilda o se despliega un grupo */
  overflow-anchor:none;}
.kfc-it{display:flex;align-items:center;gap:9px;padding:7px 11px;font-size:12px;border-bottom:1px solid #EEF1F3;cursor:pointer;}
.kfc-it:last-child{border-bottom:none;}
/* Se apaga el contenido, no la fila entera: con opacity sobre el <div> el
   botón "+ al general" también quedaba pálido y parecía inactivo. */
.kfc-it.off{cursor:default;}
.kfc-it.off .kfc-n,.kfc-it.off .kfc-v,.kfc-it.off .kfc-chev{color:#B4BDC4;}
.kfc-it.off .kfc-tag{opacity:.6;}
.kfc-bxoff{width:15px;height:15px;flex:0 0 15px;}
/* Todos los botones en la misma columna: con el importe de ancho variable
   quedaban escalonados y costaba apuntarles. */
.kfc-sumar{font-size:9.5px;font-weight:700;color:#2A7DB5;background:#EEF4F8;
  border:1px solid #BFDCEF;border-radius:11px;padding:2px 8px;margin-left:auto;
  cursor:pointer;white-space:nowrap;opacity:1;pointer-events:auto;flex:0 0 auto;
  width:86px;text-align:center;box-sizing:border-box;}

.kfc-sumar:hover{background:#DCEAF4;}
.kfc-it.off .kfc-sumar{opacity:1;}
/* Fija al pie: está al final de veinte filas y, al cambiar de nivel, la
   lista vuelve arriba — abierta o cerrada, quedaba fuera de la vista y
   parecía que se había plegado sola. */
.kfc-bloq{display:flex;align-items:center;gap:7px;padding:7px 11px;font-size:10.5px;
  color:#8B9A95;cursor:pointer;background:#FAFCFB;border-top:1px solid #EEF1F3;
  position:sticky;bottom:0;z-index:2;}
.kfc-bloq:hover{background:#F2F6F5;}
.kfc-bloqd{margin-left:auto;font-size:9.5px;color:#B4BDC4;}
.kfc-gru{font-weight:600;}
.kfc-todos{font-weight:700;background:var(--chip,#F6F9F8);border:1px solid #EEF1F3;
  border-bottom:none;border-radius:7px 7px 0 0;height:42px;align-items:center;}
.kfc-n2{display:flex;flex-direction:column;gap:1px;line-height:1.25;min-width:0;}
.kfc-cnt2{font-size:10px;color:#A3ADB6;font-weight:400;}
.kfc-list.contodos{border-radius:0 0 7px 7px;border-top:none;}
.kfc-todos.half .kfc-bx{background:#9FD3B4;border-color:#9FD3B4;color:#17502F;font-weight:800;}
.kfc-todos.on .kfc-bx{background:#2E8B57;border-color:#2E8B57;color:#fff;}
.kfc-quitar{font-size:10px;font-weight:700;color:#A3ADB6;cursor:pointer;white-space:nowrap;
  border:1px solid #E1E6EA;border-radius:5px;padding:2px 8px;background:#fff;}
.kfc-quitar:hover{color:#C0392B;border-color:#E8C3BA;background:#FDF4F2;}
.kfc-gru.half .kfc-bx{background:#9FD3B4;border-color:#9FD3B4;color:#17502F;font-weight:800;}
.kfc-gru.on .kfc-bx,.kfc-hoja.on .kfc-bx{background:#2E8B57;border-color:#2E8B57;color:#fff;}
.kfc-hoja{font-weight:400;font-size:11.5px;}
.kfc-bx{width:14px;height:14px;border-radius:3px;border:1.5px solid #C9D2D8;flex:0 0 14px;
  display:flex;align-items:center;justify-content:center;font-size:9px;color:transparent;}
.kfc-n{flex:1;min-width:0;}
/* El importe no se encoge: si lo hace, el botón que va después cae en una x
   distinta en cada fila. */
.kfc-v{font-size:10.5px;color:#8B9A95;white-space:nowrap;flex:0 0 auto;}
.kfc-v.cero{color:#C4CCD2;font-style:italic;}
.kfc-cnt{font-size:10px;color:#A3ADB6;font-weight:400;margin-left:7px;}
.kfc-chev{display:flex;align-items:center;justify-content:center;color:#A3ADB6;flex:0 0 13px;cursor:pointer;
  font-size:14px;line-height:1;transition:transform .18s;}
.kfc-chev.ab{transform:rotate(90deg);}
.kfc-hijos{background:rgba(46,82,72,.04);}
.kfc-hijos .kfc-hijos{background:rgba(46,82,72,.03);}
.kfc-tag{font-size:9.5px;font-weight:700;color:#B07B23;background:#FDF6EC;border-radius:4px;padding:2px 6px;margin-left:6px;}

#kfc-faltan{padding:11px 0 4px;font-size:11.5px;border-top:1px solid #EEF1F3;}
.kfc-fhb{display:flex;align-items:center;gap:9px;padding-bottom:4px;}
.kfc-fhclic{cursor:pointer;}
.kfc-fhclic:hover{color:#8A5F10;}
.kfc-asig{margin-left:auto;font-size:10px;font-weight:700;color:#2A7DB5;
  text-transform:none;letter-spacing:0;
  background:#EEF4F8;border:1px solid #BFDCEF;border-radius:11px;padding:2px 9px;
  cursor:pointer;white-space:nowrap;}
.kfc-asig:hover{background:#DCEAF4;}
.kfc-fh{font-size:9px;font-weight:800;letter-spacing:.6px;color:#B07B23;padding:0 0 5px;text-transform:uppercase;}
.kfc-ftwo{display:flex;flex-wrap:wrap;}
.kfc-fcol{flex:1 1 300px;padding:0 16px 12px;min-width:0;}
@media (min-width:640px){.kfc-fcol+.kfc-fcol{border-left:1px solid #EEF1F3;}}
.kfc-fok{font-size:11.5px;color:#2E8B57;padding:4px 0;}
/*c*/.kfc-fl2{display:flex;align-items:baseline;gap:7px;}
.kfc-fl2{font-size:9.5px;font-weight:800;letter-spacing:.5px;color:#8B9A95;margin:0 0 6px;}
.kfc-fl2 b{color:#C0392B;} .kfc-fl2 span{font-weight:400;letter-spacing:0;color:#A3ADB6;}
.kfc-fg{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid #F0DCC4;background:#FDF9F2;
  border-radius:6px;margin-bottom:4px;cursor:pointer;}
.kfc-fi{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 32px;font-size:11px;color:#5A6A72;}
.kfc-fn{flex:1;font-weight:600;color:#8A5209;}
.kfc-fi .kfc-fn{font-weight:400;color:#5A6A72;}
.kfc-fv{font-weight:700;color:#B85B06;}
.kfc-fi .kfc-fv{font-weight:600;color:#8B9A95;}

.kfc-cfoot{display:flex;gap:11px;align-items:center;padding:8px 16px;border-top:1px solid #EEF1F3;
  position:sticky;bottom:0;background:#F6F9F8;}
.kfc-del{font-size:11.5px;font-weight:600;color:#C0392B;cursor:pointer;white-space:nowrap;
  border:1px solid #F0C9C0;background:#FDF4F2;border-radius:16px;padding:5px 13px;
  display:inline-flex;align-items:center;gap:6px;}
.kfc-del:hover{background:#FAE1DA;}
/* A la derecha, lejos de "Eliminar este KPI": no conviene poner un botón
   de navegación al lado de uno destructivo. */
.kfc-bup{margin-left:auto;font-size:11.5px;font-weight:600;color:#3C9BD6;cursor:pointer;
  border:1px solid #BFDCEF;background:#EEF4F8;border-radius:16px;padding:5px 13px;white-space:nowrap;}
.kfc-bup:hover{background:#DCEAF4;}
.kfc-bup + .kfc-bc{margin-left:0;}
.kfc-bc{margin-left:auto;font-size:12px;color:#7D8A88;cursor:pointer;}
.kfc-bgd{background:#2E5248;color:#fff;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;}
`;
