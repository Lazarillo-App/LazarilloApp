// src/componentes/KpiFoodCost.jsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

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

export default function KpiFoodCost({
  ventas = [],
  compras = [],
  kpis = [],
  onChange,
  periodoLabel = "",
}) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState("resumen"); // resumen | config
  const [actual, setActual] = useState(kpis[0]?.id);
  const [nivel, setNivel] = useState({ ventas: "agrupacion", compras: "rubro" });
  const [busca, setBusca] = useState({ ventas: "", compras: "" });
  const [desplegado, setDesplegado] = useState({});
  const [desplFalta, setDesplFalta] = useState({});
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

  // Si cambia el negocio activo y llegan otros kpis (otro id[0]), seguir el actual.
  useEffect(() => {
    if (!kpis.some((k) => k.id === actual)) setActual(kpis[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpis]);

  const datos = { ventas, compras };
  const kpi = kpis.find((k) => k.id === actual) ?? kpis[0];
  const general = kpis.find((k) => k.general);

  const calc = useMemo(
    () => (kpi ? foodCost(ventas, compras, kpis, kpi.id) : null),
    [ventas, compras, kpis, kpi]
  );
  const valV = useMemo(() => validar(ventas, kpis, "ventas"), [ventas, kpis]);
  const valC = useMemo(() => validar(compras, kpis, "compras"), [compras, kpis]);
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
      return {
        grupos: [...r.grupos, { nivel: niv, clave }],
        excluidos: r.excluidos.filter((id) => !ids.has(id)),
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
    [kpi, kpis, general, ventas, compras]
  );

  const duenio = (lado, item) => {
    if (kpi.general) return null;
    const otro = kpis.find(
      (k) => !k.general && k.id !== kpi.id && itemsDe(datos[lado], kpis, k.id, lado).some((i) => i.id === item.id)
    );
    return otro?.nombre ?? null;
  };

  // Todos los hooks ya se llamaron arriba, sin importar si hay kpi o no — acá
  // recién es seguro salir temprano (antes del primer render con kpis vacío,
  // mientras BusinessesAPI.getFoodCostKpis todavía no resolvió, esto rompía
  // las reglas de hooks: "disponible" quedaba sin declararse en ese render y
  // React tiraba "Rendered more hooks than during the previous render").
  if (!kpi) return null;

  /* ---- render ---- */

  const Fila = ({ lado, item, prof }) => {
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
        <span className="kfc-v">{fmt(item.importe)}</span>
      </div>
    );
  };

  const Grupo = ({ lado, niv, grupo, prof }) => {
    const propios = new Set(itemsDe(datos[lado], kpis, kpi.id, lado).map((i) => i.id));
    const sel = grupo.items.filter((i) => propios.has(i.id)).length;
    const disp = grupo.items.filter((i) => propios.has(i.id) || disponible(lado, i)).length;
    const estado = sel === 0 ? "" : sel >= disp ? "on" : "half";
    const llave = `${lado}|${niv}|${grupo.clave}`;
    const open = !!desplegado[llave];
    const auto = (kpi[lado]?.grupos ?? []).some((s) => s.nivel === niv && s.clave === grupo.clave);
    const hijoNiv = niv === "agrupacion" ? "rubro" : null;
    return (
      <>
        <div
          className={`kfc-it kfc-gru ${estado}`}
          style={{ paddingLeft: 11 + prof * 17 }}
          onClick={() => toggleGrupo(lado, niv, grupo.clave)}
        >
          <span
            className={`kfc-chev${open ? " ab" : ""}`}
            onClick={(e) => { e.stopPropagation(); setDesplegado((d) => ({ ...d, [llave]: !d[llave] })); }}
          >
            ›
          </span>
          <span className="kfc-bx">{estado === "half" ? "–" : "✓"}</span>
          <span className="kfc-n">
            {grupo.clave}
            <span className="kfc-cnt">
              {sel > 0 && sel < grupo.items.length ? `${sel} de ${grupo.items.length}` : `${grupo.items.length} ítems`}
            </span>
            {auto && <span className="kfc-auto" title="Los nuevos entran solos">auto</span>}
          </span>
          <span className="kfc-v">{fmt(grupo.importe)}</span>
        </div>
        {open && (
          <div className="kfc-hijos">
            {hijoNiv
              ? agrupar(grupo.items, hijoNiv).map((g) => (
                  <Grupo key={g.clave} lado={lado} niv={hijoNiv} grupo={g} prof={prof + 1} />
                ))
              : [...grupo.items]
                  .sort((a, b) => b.importe - a.importe)
                  .map((i) => <Fila key={i.id} lado={lado} item={i} prof={prof + 1} />)}
          </div>
        )}
      </>
    );
  };

  const Columna = ({ lado, titulo, ayuda, niveles, placeholder }) => {
    const q = busca[lado].trim().toLowerCase();
    const propios = itemsDe(datos[lado], kpis, kpi.id, lado);
    const chips = agrupar(datos[lado], lado === "ventas" ? "agrupacion" : "rubro")
      .map((g) => ({ ...g, sel: g.items.filter((i) => propios.some((p) => p.id === i.id)).length }))
      .filter((g) => g.sel > 0);
    return (
      <div className="kfc-col">
        <div className="kfc-ch">
          {titulo} <span>{ayuda}</span>
          <b>{fmt(sumar(propios))}</b>
        </div>
        <div className="kfc-lvl">
          {niveles.map((n) => (
            <span
              key={n}
              className={`kfc-lv${nivel[lado] === n ? " on" : ""}`}
              onClick={() => { setNivel((v) => ({ ...v, [lado]: n })); setBusca((b) => ({ ...b, [lado]: "" })); }}
            >
              {{ agrupacion: "Agrupación", rubro: "Rubro", subrubro: "Subrubro" }[n]}
            </span>
          ))}
        </div>
        <div className="kfc-sel">
          {chips.length ? (
            chips.map((g) => (
              <span key={g.clave} className="kfc-sc">
                {g.clave}
                {g.sel < g.items.length && <i>{g.sel}/{g.items.length}</i>}
                <u onClick={(e) => { e.stopPropagation(); toggleGrupo(lado, lado === "ventas" ? "agrupacion" : "rubro", g.clave); }}>✕</u>
              </span>
            ))
          ) : (
            <span className="kfc-vacio">Nada seleccionado</span>
          )}
        </div>
        <input
          className="kfc-srch"
          placeholder={placeholder}
          value={busca[lado]}
          onChange={(e) => setBusca((b) => ({ ...b, [lado]: e.target.value }))}
        />
        <div className="kfc-list">
          {q
            ? datos[lado]
                .filter((i) => i.nombre.toLowerCase().includes(q))
                .sort((a, b) => b.importe - a.importe)
                .map((i) => <Fila key={i.id} lado={lado} item={i} prof={0} />)
            : agrupar(datos[lado], nivel[lado]).map((g) => (
                <Grupo key={g.clave} lado={lado} niv={nivel[lado]} grupo={g} prof={0} />
              ))}
        </div>
      </div>
    );
  };

  const ColumnaFaltante = ({ lado, titulo, val }) => {
    if (!val.faltantes.length)
      return (
        <div className="kfc-fcol">
          <div className="kfc-fl2">{titulo}</div>
          <div className="kfc-fok">✓ Todo asignado</div>
        </div>
      );
    const porRubro = agrupar(val.faltantes, "rubro");
    return (
      <div className="kfc-fcol">
        <div className="kfc-fl2">
          {titulo} <b>{fmt(val.diferencia)}</b> <span>en {porRubro.length} rubro{porRubro.length > 1 ? "s" : ""}</span>
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
  };

  const Bloque = ({ label, val }) => (
    <span className="kfc-vbox">
      <span className="kfc-vlab">{label}</span>
      <span className={`kfc-vnum ${val.diferencia === 0 ? "ok" : "bad"}`}>{fmt(val.cubierto)}</span>
      <span className="kfc-de">de {fmt(val.total)}</span>
      {val.diferencia === 0 ? <span className="ok">✓</span> : <span className="bad">faltan {fmt(val.diferencia)}</span>}
    </span>
  );

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
          <b>{kpi.nombre.toUpperCase()}</b>
        </span>
        <span className={`kfc-pill${alto ? "" : " ok"}`}>
          {d1(calc.pct)}%
          {typeof kpi.anterior === "number" && (
            <span className="kfc-var">
              {calc.pct - kpi.anterior >= 0 ? " ↗ +" : " ↘ "}
              {d1(calc.pct - kpi.anterior)}
            </span>
          )}
        </span>
        <span className={`kfc-arrow${abierto ? " ab" : ""}`}>⌄</span>
      </div>

      {abierto && (
        <div className="kfc-panel">
          <div className="kfc-tabs">
            {kpis.map((k) => (
              <span
                key={k.id}
                className={`kfc-tbk${k.id === kpi.id ? " on" : ""}`}
                onClick={() => { setActual(k.id); setAviso(""); }}
              >
                {k.nombre}
              </span>
            ))}
            <span className="kfc-tbk add" onClick={() => onChange?.([...kpis, nuevoKpi(kpis)])}>+ Nuevo</span>
            <span className="kfc-cfg" onClick={() => setModo((m) => (m === "config" ? "resumen" : "config"))}>
              <span className={cuadra ? "ok" : "bad"}>{cuadra ? "✓ cuadra" : "⚠ no cuadra"}</span>
              ⚙ Configurar
            </span>
          </div>

          {modo === "resumen" ? (
            <>
              <div className="kfc-calc">
                <div className="kfc-b">
                  <div className="kfc-bl">COMPRAS</div>
                  <div className="kfc-bv">{fmt(calc.compras)}</div>
                  <div className="kfc-bs">{periodoLabel}</div>
                </div>
                <div className="kfc-eq">÷</div>
                <div className="kfc-b">
                  <div className="kfc-bl">VENTAS</div>
                  <div className="kfc-bv">{fmt(calc.ventas)}</div>
                  <div className="kfc-bs">{periodoLabel}</div>
                </div>
                <div className="kfc-eq">=</div>
                <div className="kfc-b">
                  <div className="kfc-bl">FOOD COST</div>
                  <div className={`kfc-bv ${alto ? "na" : "ok"}`}>{d1(calc.pct)}%</div>
                  {typeof kpi.anterior === "number" && (
                    <div className="kfc-bs">mes anterior {d1(kpi.anterior)}%</div>
                  )}
                </div>
              </div>
              {!!kpi.historico?.length && (
                <div className="kfc-hist">
                  <span className="kfc-hl">ÚLTIMOS {kpi.historico.length} MESES</span>
                  <span className="kfc-sp">
                    {kpi.historico.map((x, i) => (
                      <span key={i} className={`kfc-c${i === kpi.historico.length - 1 ? " on" : ""}`}>
                        <i style={{ height: `${(x / Math.max(...kpi.historico)) * 84 + 14}%` }} />
                        <u>{d1(x)}</u>
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className={`kfc-valid ${cuadra ? "vok" : "vbad"}`}
                onClick={() => document.getElementById("kfc-faltan")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
              >
                <Bloque label="VENTAS CUBIERTAS" val={valV} />
                <Bloque label="COMPRAS CUBIERTAS" val={valC} />
                <span className={`kfc-vmsg ${cuadra ? "ok" : "bad"}`}>
                  {cuadra ? "Los sub-KPI suman exactamente el general" : "Los sub-KPI no suman el general  ver qué falta ↓"}
                </span>
              </div>

              <div className="kfc-cname">
                <div className="kfc-cl">NOMBRE DEL KPI</div>
                <input
                  className="kfc-cin"
                  value={kpi.nombre}
                  onChange={(e) => aplicar(kpis.map((k) => (k.id === kpi.id ? { ...k, nombre: e.target.value } : k)))}
                />
                <div className={`kfc-alc${aviso ? " warn" : ""}`}>
                  {aviso ||
                    (kpi.general
                      ? "Este es el KPI general. Lo que elijas acá es el universo: los demás solo pueden tomar de adentro, y lo que saques se les quita."
                      : "Solo podés elegir lo que esté dentro del general y no haya tomado otro KPI.")}
                </div>
              </div>

              <div className="kfc-two">
                <Columna lado="ventas" titulo="VENTAS" ayuda="qué se vendió" niveles={NIVELES_VENTAS} placeholder="Buscar artículo…" />
                <Columna lado="compras" titulo="COMPRAS" ayuda="qué se compró" niveles={NIVELES_COMPRAS} placeholder="Buscar insumo…" />
              </div>

              {!cuadra && (
                <div id="kfc-faltan">
                  <div className="kfc-fh">SIN ASIGNAR A NINGÚN KPI</div>
                  <div className="kfc-ftwo">
                    <ColumnaFaltante lado="ventas" titulo="VENTAS · artículos" val={valV} />
                    <ColumnaFaltante lado="compras" titulo="COMPRAS · insumos" val={valC} />
                  </div>
                </div>
              )}

              <div className="kfc-cfoot">
                {!kpi.general && (
                  <span
                    className="kfc-del"
                    onClick={() => {
                      const resto = kpis.filter((k) => k.id !== kpi.id);
                      setActual(resto[0]?.id);
                      aplicar(resto);
                    }}
                  >
                    Eliminar este KPI
                  </span>
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
.kfc-pill{font-size:15px;font-weight:700;color:#C77C0B;letter-spacing:-.3px;}
.kfc-pill.ok{color:#2E8B57;}
.kfc-var{font-size:10.5px;font-weight:600;color:#9A7538;}
.kfc-arrow{color:#8B9A95;font-size:13px;transition:transform .3s;}
.kfc-arrow.ab{transform:rotate(180deg);}

.kfc-panel{position:absolute;right:0;top:calc(100% + 7px);z-index:40;width:742px;max-width:94vw;
  border:1px solid #DCE6E2;border-radius:10px;background:#F6F9F8;box-shadow:0 12px 36px rgba(20,34,30,.19);
  max-height:min(calc(100dvh - 185px),540px);overflow-y:auto;overscroll-behavior:contain;cursor:default;}
.kfc-tabs{display:flex;gap:6px;padding:11px 14px;border-bottom:1px solid #EEF1F3;flex-wrap:wrap;
  align-items:center;position:sticky;top:0;background:#F6F9F8;z-index:3;}
.kfc-tbk{border:1px solid #E1E6EA;border-radius:16px;padding:5px 13px;font-size:12px;color:#7D8A88;cursor:pointer;white-space:nowrap;}
.kfc-tbk.on{border-color:#2E5248;background:rgba(46,82,72,.1);color:#2E5248;font-weight:700;}
.kfc-tbk.add{border-style:dashed;color:#3C9BD6;}
.kfc-cfg{margin-left:auto;font-size:11.5px;color:#3C9BD6;font-weight:600;cursor:pointer;white-space:nowrap;}
.kfc-cfg .ok{color:#2E8B57;font-weight:700;margin-right:9px;}
.kfc-cfg .bad{color:#C0392B;font-weight:700;margin-right:9px;}

.kfc-calc{display:flex;align-items:stretch;flex-wrap:wrap;}
.kfc-b{padding:13px 18px;border-left:1px solid #EEF1F3;flex:1 1 180px;min-width:0;}
.kfc-calc .kfc-b:first-child{border-left:none;}
.kfc-bl{font-size:9px;font-weight:800;letter-spacing:.6px;color:#8B9A95;}
.kfc-bv{font-size:20px;font-weight:700;margin-top:4px;line-height:1;letter-spacing:-.4px;color:#1F2933;}
.kfc-bv.na{color:#C77C0B;} .kfc-bv.ok{color:#2E8B57;}
.kfc-bs{font-size:10.5px;color:#8B9A95;margin-top:4px;}
.kfc-eq{display:flex;align-items:center;padding:0 3px;color:#B8C6C1;font-size:15px;}
.kfc-hist{padding:11px 16px;border-top:1px solid #EEF1F3;display:flex;align-items:flex-end;gap:14px;}
.kfc-hl{font-size:9px;font-weight:800;letter-spacing:.6px;color:#8B9A95;}
.kfc-sp{display:flex;gap:7px;align-items:flex-end;height:40px;margin-left:auto;}
.kfc-c{width:30px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;}
.kfc-c i{width:100%;background:#C3D6CE;border-radius:3px 3px 0 0;display:block;}
.kfc-c u{font-size:9px;color:#8B9A95;text-decoration:none;margin-top:3px;}
.kfc-c.on i{background:#E0921C;} .kfc-c.on u{color:#B85B06;font-weight:700;}

.kfc-valid{display:flex;align-items:center;gap:14px;padding:10px 16px;border-bottom:1px solid #EEF1F3;font-size:11.5px;flex-wrap:wrap;}
.kfc-valid.vbad{background:#FDF4F2;cursor:pointer;}
.kfc-valid.vok{background:rgba(46,139,87,.06);}
.kfc-vbox{display:flex;align-items:center;gap:8px;}
.kfc-vlab{font-size:9px;font-weight:800;letter-spacing:.6px;color:#8B9A95;}
.kfc-vnum{font-weight:700;} .kfc-vnum.ok,.kfc-valid .ok{color:#2E8B57;} .kfc-vnum.bad,.kfc-valid .bad{color:#C0392B;}
.kfc-de{color:#A3ADB6;}
.kfc-vmsg{margin-left:auto;font-size:11px;}

.kfc-cname{padding:11px 16px 0;}
.kfc-cl{font-size:9px;font-weight:800;letter-spacing:.6px;color:#8B9A95;margin-bottom:5px;}
.kfc-cin{border:1px solid #E1E6EA;border-radius:7px;padding:8px 11px;font-size:13px;width:100%;font-family:inherit;outline:none;}
.kfc-cin:focus{border-color:#3C9BD6;}
.kfc-alc{font-size:11px;color:#8B9A95;margin-top:6px;line-height:1.5;}
.kfc-alc.warn{color:#B07B23;}

.kfc-two{display:flex;padding-top:12px;flex-wrap:wrap;}
.kfc-col{flex:1 1 300px;padding:0 16px 12px;min-width:0;}
@media (min-width:640px){.kfc-col+.kfc-col{border-left:1px solid #EEF1F3;}}
.kfc-ch{font-size:10px;font-weight:800;letter-spacing:.6px;color:#5A7268;margin-bottom:9px;display:flex;align-items:center;gap:7px;}
.kfc-ch span{font-weight:400;color:#8B9A95;letter-spacing:0;font-size:10.5px;}
.kfc-ch b{margin-left:auto;font-size:12px;color:#2E5248;}
.kfc-lvl{display:flex;gap:5px;margin-bottom:9px;flex-wrap:wrap;}
.kfc-lv{border:1px solid #E1E6EA;border-radius:14px;padding:3px 10px;font-size:10.5px;color:#7D8A88;cursor:pointer;}
.kfc-lv.on{border-color:#3C9BD6;background:rgba(60,155,214,.12);color:#2A7DB5;font-weight:700;}
.kfc-sel{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px;min-height:24px;}
.kfc-sc{background:rgba(46,82,72,.1);color:#2E5248;border-radius:5px;padding:4px 9px;font-size:11.5px;font-weight:600;}
.kfc-sc i{font-style:normal;font-size:10px;color:#6E8B80;margin-left:3px;}
.kfc-sc u{text-decoration:none;color:#8B9A95;cursor:pointer;margin-left:4px;}
.kfc-vacio{font-size:11.5px;color:#A3ADB6;}
.kfc-srch{border:1px solid #E1E6EA;border-radius:6px;padding:7px 10px;font-size:11.5px;margin-bottom:8px;width:100%;font-family:inherit;outline:none;}
.kfc-srch:focus{border-color:#3C9BD6;}
.kfc-list{border:1px solid #EEF1F3;border-radius:7px;max-height:196px;overflow-y:auto;background:#fff;}
.kfc-it{display:flex;align-items:center;gap:9px;padding:7px 11px;font-size:12px;border-bottom:1px solid #EEF1F3;cursor:pointer;}
.kfc-it:last-child{border-bottom:none;}
.kfc-it.off{opacity:.42;cursor:not-allowed;}
.kfc-gru{font-weight:600;}
.kfc-gru.half .kfc-bx{background:#9FD3B4;border-color:#9FD3B4;color:#17502F;font-weight:800;}
.kfc-gru.on .kfc-bx,.kfc-hoja.on .kfc-bx{background:#2E8B57;border-color:#2E8B57;color:#fff;}
.kfc-hoja{font-weight:400;font-size:11.5px;}
.kfc-bx{width:14px;height:14px;border-radius:3px;border:1.5px solid #C9D2D8;flex:0 0 14px;
  display:flex;align-items:center;justify-content:center;font-size:9px;color:transparent;}
.kfc-n{flex:1;} .kfc-v{font-size:10.5px;color:#8B9A95;}
.kfc-cnt{font-size:10px;color:#A3ADB6;font-weight:400;margin-left:7px;}
.kfc-chev{display:flex;align-items:center;justify-content:center;color:#A3ADB6;flex:0 0 13px;cursor:pointer;
  font-size:14px;line-height:1;transition:transform .18s;}
.kfc-chev.ab{transform:rotate(90deg);}
.kfc-hijos{background:rgba(46,82,72,.04);}
.kfc-hijos .kfc-hijos{background:rgba(46,82,72,.03);}
.kfc-tag{font-size:9.5px;font-weight:700;color:#B07B23;background:#FDF6EC;border-radius:4px;padding:2px 6px;margin-left:6px;}
.kfc-auto{font-size:8.5px;font-weight:800;letter-spacing:.4px;color:#2A7DB5;background:#EAF4FB;border-radius:4px;padding:1px 5px;margin-left:7px;}

#kfc-faltan{padding:0 0 4px;font-size:11.5px;}
.kfc-fh{font-size:9px;font-weight:800;letter-spacing:.6px;color:#B07B23;padding:11px 16px 7px;border-top:1px solid #EEF1F3;}
.kfc-ftwo{display:flex;flex-wrap:wrap;}
.kfc-fcol{flex:1 1 300px;padding:0 16px 12px;min-width:0;}
@media (min-width:640px){.kfc-fcol+.kfc-fcol{border-left:1px solid #EEF1F3;}}
.kfc-fok{font-size:11.5px;color:#2E8B57;padding:4px 0;}
.kfc-fl2{font-size:9.5px;font-weight:800;letter-spacing:.5px;color:#8B9A95;margin:0 0 6px;}
.kfc-fl2 b{color:#C0392B;} .kfc-fl2 span{font-weight:400;letter-spacing:0;color:#A3ADB6;}
.kfc-fg{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid #F0DCC4;background:#FDF9F2;
  border-radius:6px;margin-bottom:4px;cursor:pointer;}
.kfc-fi{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 32px;font-size:11px;color:#5A6A72;}
.kfc-fn{flex:1;font-weight:600;color:#8A5209;}
.kfc-fi .kfc-fn{font-weight:400;color:#5A6A72;}
.kfc-fv{font-weight:700;color:#B85B06;}
.kfc-fi .kfc-fv{font-weight:600;color:#8B9A95;}

.kfc-cfoot{display:flex;gap:11px;align-items:center;padding:10px 16px;border-top:1px solid #EEF1F3;
  position:sticky;bottom:0;background:#F6F9F8;}
.kfc-del{font-size:11.5px;color:#C0392B;cursor:pointer;}
.kfc-bc{margin-left:auto;font-size:12px;color:#7D8A88;cursor:pointer;}
.kfc-bgd{background:#2E5248;color:#fff;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;}
`;
