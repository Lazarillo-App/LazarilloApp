/* eslint-disable no-unused-vars */
// src/componentes/AuthDiagram.jsx
import React, { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import logoDark from "@/assets/brand/logo-dark.png";

export default function AuthDiagram({ className = "", logoSrc = logoDark }) {
  const reduce = useReducedMotion();

  const steps = useMemo(
    () => [
      "Gestioná tus negocios",
      "Mantené al día tus ventas",
      "KPIs y pizarras operativas",
      "Recetas y costos",
      "Flujo claro de información",
      { type: "logo" }, // paso final con logo
    ],
    []
  );

  // ⏱️ tiempos más lentos
  const T_IN   = reduce ? 0.05 : 0.65;
  const T_HOLD = reduce ? 0.60 : 1.90;
  const T_OUT  = reduce ? 0.05 : 0.65;
  const T_GAP  = reduce ? 0.15 : 0.35;

  // para el paso de logo, que “pulse” una sola vez y luego pase al siguiente
  const T_LOGO = reduce ? 1.2 : 2.4;

  const motionFx = {
    initial: { opacity: 0, y: 6, scale: 0.995 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit:    { opacity: 0, y: -6, scale: 0.995 },
    transition: { duration: T_IN, ease: "easeOut" },
  };

  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    const current = steps[index];
    const isLogo = typeof current === "object" && current?.type === "logo";

    // ⏲️ si es logo, esperamos T_LOGO; si es texto, el combo normal
    const ms = isLogo
      ? (T_IN + T_LOGO + T_OUT + T_GAP) * 1000
      : (T_IN + T_HOLD + T_OUT + T_GAP) * 1000;

    const t = setTimeout(() => setIndex((i) => (i + 1) % steps.length), ms);
    return () => clearTimeout(t);
  }, [index, steps, T_IN, T_HOLD, T_OUT, T_GAP, T_LOGO]);

  const current = steps[index];
  const isLogo = typeof current === "object" && current?.type === "logo";

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: 560,
        minHeight: 180,
        display: "grid",
        placeItems: "center",       // 👈 centrado perfecto
        marginInline: "auto",
      }}
    >
      <AnimatePresence mode="wait">
        {!isLogo ? (
          <motion.div key={`txt-${index}`} {...motionFx} style={{ width: "100%", display: "grid", placeItems: "center" }}>
            <div
              style={{
                textAlign: "center",
                fontWeight: 800,
                fontSize: "clamp(18px, 3.2vw, 30px)",
                letterSpacing: ".2px",
                lineHeight: 1.15,
                color: "var(--color-fg, #0f172a)",
                paddingInline: 10,
              }}
            >
              {current}
            </div>
            <motion.div
              style={{
                height: 3,
                width: 0,
                margin: "12px auto 0",
                background:
                  "linear-gradient(90deg, color-mix(in srgb, var(--color-primary,#111) 65%, transparent), transparent)",
                borderRadius: 999,
              }}
              initial={{ width: 0, opacity: 0.6 }}
              animate={{ width: 90, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: T_IN, ease: "easeOut" }}
            />
          </motion.div>
        ) : (
          <motion.div key="logo" {...motionFx} style={{ width: "100%", display: "grid", placeItems: "center" }}>
            <motion.img
              src={logoSrc}
              alt="Lazarillo"
              style={{
                width: "min(240px, 60%)",
                height: "auto",
                display: "block",
                margin: "0 auto",                    // 👈 centradísimo
                filter:
                  "drop-shadow(0 1px 0 rgba(0,0,0,.06)) drop-shadow(0 4px 16px rgba(0,0,0,.06))",
              }}
              initial={{ opacity: 0, scale: 0.975 }}
              animate={{ opacity: 1, scale: [0.975, 1, 0.985, 1] }}
              exit={{ opacity: 0, scale: 0.985 }}
              // una sola “pulsa” (sin repeat), y el ciclo global reinicia al terminar
              transition={{ duration: T_LOGO, ease: "easeInOut", times: [0, 0.45, 0.75, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
