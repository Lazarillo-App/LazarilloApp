// src/componentes/gestion/FichaProveedor.jsx
// Ficha del proveedor (la misma de la carga de facturas) con acceso a su cuenta corriente (Diego 06/11/2026).
// Se abre desde el proveedor de una compra en Recetas.
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { gestionFetch } from "@/servicios/apiGestion";

// La cuenta corriente se carga al abrirla.
const CtaCteModal = React.lazy(() => import("@/componentes/gestion/pagos/cta-cte-proveedor").then((m) => ({ default: m.CtaCteModal })));

const C = { neg: "#111", gris: "#8a8a8a", rojo: "#c62828", cel: "#0d6fa8", borde: "#e8e8e6" };
const card = { background: "#fff", borderRadius: 14, border: `1px solid ${C.borde}` };
const btn = (dark) => ({ padding: "9px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: dark ? "none" : `1px solid ${C.borde}`, background: dark ? "#111" : "#fff", color: dark ? "#fff" : "#333" });
const inp = { padding: "8px 10px", borderRadius: 9, border: "1px solid #ccc", fontSize: 13.5, width: "100%", height: 38, boxSizing: "border-box", background: "#fff" };
const lab = { fontSize: 11.5, fontWeight: 700, color: C.gris, textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 4 };
const flechaSelect = (e) => {
  const s = e.target;
  if (s.tagName !== "SELECT" || (e.key !== "ArrowDown" && e.key !== "ArrowUp") || e.altKey) return false;
  e.preventDefault();
  const n = Math.min(Math.max(s.selectedIndex + (e.key === "ArrowDown" ? 1 : -1), 0), s.options.length - 1);
  if (n !== s.selectedIndex) {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, s.options[n].value);
    s.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
};
const enterAvanza = (e) => {
  if (flechaSelect(e)) return;
  if (e.key !== "Enter") return;
  const t = e.target;
  if (t.tagName !== "INPUT" && t.tagName !== "SELECT") return;
  e.preventDefault();
  // Los campos fuera del tabulador (la fecha del gasto vario) tampoco reciben el Enter.
  const campos = Array.from(e.currentTarget.querySelectorAll("input, select")).filter((el) => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1);
  const i = campos.indexOf(t);
  if (i >= 0 && i + 1 < campos.length) campos[i + 1].focus();
};
const CAMPOS_FICHA = [
  ["nombre", "Nombre *", 2], ["razon", "Razón social", 2], ["cuit", "CUIT", 1], ["telefono", "Teléfono", 1],
  ["celular", "Celular", 1], ["email", "Email", 1], ["direccion", "Dirección", 2], ["localidad", "Localidad", 1],
  ["contacto", "Contacto", 1], ["cbu", "CBU / CVU", 1], ["aliasCbu", "Alias", 1],
];
export default function FichaProveedor({ id, onCerrar, onGuardado }) {
  const [f, setF] = useState(null);
  const [ctaCte, setCtaCte] = useState(false); // la ficha lleva a la cuenta corriente (Diego 06/11/2026)
  const [orig, setOrig] = useState(null);
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    let vivo = true;
    gestionFetch(`/api/facturas/proveedores/${id}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
      .then(({ ok, d }) => {
        if (!vivo) return;
        if (!ok || !d) { setErr((d && d.error) || "No se pudo abrir la ficha."); return; }
        const v = Object.fromEntries(CAMPOS_FICHA.map(([k]) => [k, d[k] || ""]));
        setF({ ...v, deMaxirest: !!d.deMaxirest, codigo: d.codigo }); setOrig(v);
      })
      .catch(() => vivo && setErr("Error de red: no se pudo abrir la ficha."));
    return () => { vivo = false; };
  }, [id]);
  const cambio = f && orig && CAMPOS_FICHA.some(([k]) => (f[k] || "") !== (orig[k] || ""));
  // Mientras se mira la cuenta corriente la ficha queda guardada atrás (lo tipeado no se pierde).
  if (ctaCte && f && f.codigo) return <div className="gestion-tw" style={{ display: "contents" }}><React.Suspense fallback={null}><CtaCteModal origen={{ codPro: f.codigo }} onCerrar={() => setCtaCte(false)} /></React.Suspense></div>;
  const guardar = () => {
    if (!f.nombre.trim()) { setErr("Poné el nombre del proveedor."); return; }
    setGuardando(true); setErr("");
    const body = Object.fromEntries(CAMPOS_FICHA.map(([k]) => [k, String(f[k] || "").trim() || null]));
    gestionFetch(`/api/facturas/proveedores/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
      .then(({ ok, d }) => {
        setGuardando(false);
        if (!ok) { setErr((d && d.error) || "No se pudo guardar la ficha."); return; }
        toast.success("Ficha del proveedor guardada");
        onGuardado({ id, nombre: body.nombre, razon: body.razon });
      })
      .catch(() => { setGuardando(false); setErr("Error de red: no se guardó."); });
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(40,40,40,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1400 }}
      onClick={(e) => { e.stopPropagation(); onCerrar(); }}>
      <div style={{ ...card, width: "min(620px, 94vw)", maxHeight: "88vh", overflow: "auto", padding: "18px 22px" }} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { onCerrar(); return; } enterAvanza(e); }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Ficha del proveedor {f && f.codigo ? <span style={{ fontSize: 12, color: C.gris, fontWeight: 500 }}>· cód. {f.codigo}</span> : null}</h3>
          <button type="button" onClick={onCerrar} style={{ border: "none", background: "none", fontSize: 20, color: "#999", cursor: "pointer" }}>×</button>
        </div>
        {!f && !err && <div style={{ fontSize: 13, color: C.gris, padding: "18px 0" }}>Cargando…</div>}
        {f && (<>
          {f.deMaxirest && <div style={{ fontSize: 12, color: "#2a6b86", background: "#f3fafd", border: "1px solid #bfe0f0", borderRadius: 9, padding: "7px 10px", margin: "10px 0 0" }}>
            Viene de MaxiRest: lo que cambies acá queda en Lazarillo y la importación no lo vuelve a pisar.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px", marginTop: 12 }}>
            {CAMPOS_FICHA.map(([k, t, span], ix) => (
              <div key={k} style={{ gridColumn: span === 2 ? "1 / -1" : undefined }}><span style={lab}>{t}</span>
                <input style={inp} autoFocus={ix === 0} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
            ))}
          </div>
        </>)}
        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.rojo, fontWeight: 600 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          {f && f.codigo && <button type="button" style={{ ...btn(false), marginRight: "auto", color: C.cel, borderColor: "#bfe0f0" }} onClick={() => setCtaCte(true)}>Ver cuenta corriente</button>}
          <button type="button" style={btn(false)} onClick={onCerrar}>{cambio ? "Cancelar" : "Cerrar"}</button>
          {f && <button type="button" style={{ ...btn(true), opacity: cambio && !guardando ? 1 : 0.4, cursor: cambio && !guardando ? "pointer" : "default" }} disabled={!cambio || guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>}
        </div>
      </div>
    </div>
  );
}
