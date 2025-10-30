// src/componentes/Buscador.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

const normalizarOpciones = (opciones = []) =>
  (Array.isArray(opciones) ? opciones : [])
    .map((o) =>
      typeof o === "string"
        ? { id: o, label: o, value: o }
        : { id: o.id ?? o.value ?? o.label, label: o.label ?? String(o.value ?? ""), value: o.value ?? o.label }
    )
    .filter((o) => o.label?.trim().length);

export default function Buscador({
  value = "",
  opciones = [],
  placeholder = "Buscar artículos…",
  autoFocus = false,
  maxSugerencias = 10,
  onPick,
}) {
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [q, setQ] = useState(value ?? "");

  useEffect(() => setQ(value ?? ""), [value]);

  // Cierra al hacer click fuera
  useEffect(() => {
    const onClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const opts = useMemo(() => normalizarOpciones(opciones), [opciones]);
  const sugerencias = useMemo(() => {
    const t = (q || "").trim().toLowerCase();
    if (!t) return opts.slice(0, maxSugerencias);
    const starts = [];
    const contains = [];
    for (const o of opts) {
      const hay = o.label.toLowerCase().includes(t);
      if (!hay) continue;
      (o.label.toLowerCase().startsWith(t) ? starts : contains).push(o);
      if (starts.length + contains.length >= 200) break; 
    }
    return [...starts, ...contains].slice(0, maxSugerencias);
  }, [opts, q, maxSugerencias]);

  const seleccionar = (opt) => {
    setQ(opt.label);
    onPick?.(opt)           
    setOpen(false);
    setCursor(-1);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, sugerencias.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      if (open && cursor >= 0 && cursor < sugerencias.length) {
        e.preventDefault();
        seleccionar(sugerencias[cursor]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setCursor(-1);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: "250px",
          height: "25px",
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid #c9d1d9",
          outline: "none",
        }}
      />

      {open && sugerencias.length > 0 && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {sugerencias.map((s, i) => (
            <div
              key={s.id ?? s.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => seleccionar(s)}
              onMouseEnter={() => setCursor(i)}
              role="option"
              aria-selected={i === cursor}
              style={{
                width: "60%",
                height: "30px",
                padding: "8px 10px",
                cursor: "pointer",
                background: i === cursor ? "#f3f4f6" : "transparent",
                textOverflow: "ellipsis",
              }}
              title={s.label}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
