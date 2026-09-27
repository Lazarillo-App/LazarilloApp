// src/componentes/SpotlightTour.jsx
// Overlay genérico de tour guiado: fondo oscuro con un "agujero" recortado
// alrededor de un elemento (targetRef) + burbuja de Anthony explicando ese
// paso. Reutilizable para cualquier secuencia de pasos, no solo el de
// "primer artículo manual".
//
// Ojo con el zoom global (html { zoom: 0.9 }, ver global.css): un valor leído
// vía getBoundingClientRect() ya viene en coordenadas "visuales" post-zoom, y
// si se lo asigna tal cual como posición CSS a un elemento que vive bajo el
// mismo <html> zoomeado, el navegador lo vuelve a escalar una segunda vez
// (mismo bug que rompía el dropdown de perfil y los tooltips). Se compensa
// dividiendo por el factor de zoom real (leído en vivo, no hardcodeado).
import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { ANT } from '@/componentes/asistente/anthonyAssets';

function getZoomFactor() {
  try {
    const z = parseFloat(getComputedStyle(document.documentElement).zoom);
    return Number.isFinite(z) && z > 0 ? z : 1;
  } catch {
    return 1;
  }
}

export default function SpotlightTour({
  targetRef,
  text,
  pose = 'senala',
  onSkip,
  onNext,
  nextLabel = 'Siguiente',
  skipLabel = 'Omitir',
  placement = 'bottom',
  padding = 8,
}) {
  const [rect, setRect] = useState(null);

  const recompute = useCallback(() => {
    const el = targetRef?.current;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const zoom = getZoomFactor();
    setRect({
      top: r.top / zoom,
      left: r.left / zoom,
      width: r.width / zoom,
      height: r.height / zoom,
    });
  }, [targetRef]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    const el = targetRef?.current;
    if (!el) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [targetRef, recompute]);

  if (!rect) return null;

  const holeTop = rect.top - padding;
  const holeLeft = rect.left - padding;
  const holeRight = rect.left + rect.width + padding;
  const holeBottom = rect.top + rect.height + padding;
  const holeHeight = holeBottom - holeTop;

  const DIM = 'rgba(15, 23, 42, 0.6)';
  const Z = 1400;

  const bubbleTop = placement === 'top'
    ? Math.max(12, holeTop - 150)
    : holeBottom + 14;

  return (
    <>
      {/* 4 paneles oscuros alrededor del "agujero" — el agujero en sí no tiene
          nada encima, así que el elemento real sigue siendo clickeable */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, holeTop), background: DIM, zIndex: Z, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()} />
      <div style={{ position: 'fixed', top: holeBottom, left: 0, right: 0, bottom: 0, background: DIM, zIndex: Z, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()} />
      <div style={{ position: 'fixed', top: holeTop, left: 0, width: Math.max(0, holeLeft), height: holeHeight, background: DIM, zIndex: Z, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()} />
      <div style={{ position: 'fixed', top: holeTop, left: holeRight, right: 0, height: holeHeight, background: DIM, zIndex: Z, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()} />

      {/* Anillo de resalte, decorativo, no bloquea clicks */}
      <div style={{
        position: 'fixed', top: holeTop, left: holeLeft,
        width: holeRight - holeLeft, height: holeHeight,
        borderRadius: 10, border: '3px solid #f5c518',
        boxShadow: '0 0 0 4px rgba(245,197,24,0.28)',
        zIndex: Z + 1, pointerEvents: 'none',
      }} />

      {/* Burbuja de Anthony */}
      <div style={{
        position: 'fixed', top: bubbleTop, left: Math.max(12, Math.min(holeLeft, window.innerWidth - 420)),
        zIndex: Z + 2, display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: 400,
      }}>
        <img src={ANT[pose] || ANT.senala} alt="Anthony" style={{ height: 64, width: 'auto', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 3px 6px rgba(20,30,50,.25))' }} />
        <div style={{
          position: 'relative', background: '#eaf4fb', border: '1px solid #cfe6f5',
          borderRadius: 14, borderBottomLeftRadius: 4, padding: '12px 15px',
          color: '#173a52', fontSize: 14, lineHeight: 1.5, boxShadow: '0 4px 18px rgba(20,60,90,.25)',
        }}>
          <span style={{ position: 'absolute', left: -7, bottom: 10, width: 12, height: 12, background: '#eaf4fb', borderLeft: '1px solid #cfe6f5', borderBottom: '1px solid #cfe6f5', transform: 'rotate(45deg)' }} />
          <div style={{ marginBottom: 10 }}>{text}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={onSkip}
              style={{ border: 'none', background: 'transparent', color: '#5a7a8e', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px' }}
            >
              {skipLabel}
            </button>
            {onNext && (
              <button
                onClick={onNext}
                style={{ border: 'none', background: '#2492C8', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 14px', borderRadius: 8 }}
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
