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
import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
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
  onNever,           // "No mostrar más" (recorridos de primera vez)
  paso = null,       // { actual, total } para mostrar "2 de 5"
  nextLabel = 'Siguiente',
  skipLabel = 'Omitir',
  placement = 'bottom',
  padding = 8,
}) {
  const [rect, setRect] = useState(null);
  // Alto real de la burbuja: si no entra debajo del elemento, va arriba (10/11: se cortaba abajo).
  const burbujaRef = useRef(null);
  const [altoBurbuja, setAltoBurbuja] = useState(0);
  useLayoutEffect(() => {
    const h = burbujaRef.current?.getBoundingClientRect().height || 0;
    const z = getZoomFactor();
    if (h && Math.abs(h / z - altoBurbuja) > 1) setAltoBurbuja(h / z);
  }, [text, rect, altoBurbuja]); // se vuelve a medir al cambiar de paso

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

  // El elemento puede aparecer un poco después (modales que cargan datos): se lo vuelve a buscar
  // durante unos segundos. Si no aparece, la burbuja se muestra centrada (sin recorte) para que el
  // recorrido nunca quede trabado (10/11: en la receta no aparecía).
  const [sinObjetivo, setSinObjetivo] = useState(false);
  useEffect(() => {
    if (rect) { setSinObjetivo(false); return undefined; }
    let intentos = 0;
    const t = setInterval(() => {
      intentos += 1;
      if (targetRef?.current) { recompute(); clearInterval(t); return; }
      if (intentos >= 15) { setSinObjetivo(true); clearInterval(t); }
    }, 200);
    return () => clearInterval(t);
  }, [rect, targetRef, recompute]);

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

  if (!rect && !sinObjetivo) return null;
  if (!rect) {
    // Sin elemento que resaltar: fondo oscuro y la burbuja al centro.
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 1400 }} onClick={(e) => e.stopPropagation()} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1402, display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: 'min(400px, calc(100vw - 32px))' }}>
          <img src={ANT[pose] || ANT.senala} alt="Anthony" style={{ height: 64, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <Burbuja text={text} paso={paso} onNever={onNever} onSkip={onSkip} skipLabel={skipLabel} onNext={onNext} nextLabel={nextLabel} />
        </div>
      </>
    );
  }

  const holeTop = rect.top - padding;
  const holeLeft = rect.left - padding;
  const holeRight = rect.left + rect.width + padding;
  const holeBottom = rect.top + rect.height + padding;
  const holeHeight = holeBottom - holeTop;

  const DIM = 'rgba(15, 23, 42, 0.6)';
  const Z = 1400;

  const zoom = getZoomFactor();
  const altoVista = window.innerHeight / zoom;
  const anchoVista = window.innerWidth / zoom;
  const alto = altoBurbuja || 150;
  const entraAbajo = holeBottom + 14 + alto <= altoVista - 12;
  const entraArriba = holeTop - 14 - alto >= 12;
  const arriba = placement === 'top' ? entraArriba || !entraAbajo : !entraAbajo && entraArriba;
  const bubbleTop = Math.max(12, Math.min(arriba ? holeTop - 14 - alto : holeBottom + 14, altoVista - alto - 12));

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
      <div ref={burbujaRef} style={{
        position: 'fixed', top: bubbleTop, left: Math.max(12, Math.min(holeLeft, anchoVista - 420)),
        zIndex: Z + 2, display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: 400,
      }}>
        <img src={ANT[pose] || ANT.senala} alt="Anthony" style={{ height: 64, width: 'auto', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 3px 6px rgba(20,30,50,.25))' }} />
        <Burbuja text={text} paso={paso} onNever={onNever} onSkip={onSkip} skipLabel={skipLabel} onNext={onNext} nextLabel={nextLabel} />
      </div>
    </>
  );
}

// La burbuja de Anthony (texto + "n de N" + No mostrar más / Omitir / Siguiente).
function Burbuja({ text, paso, onNever, onSkip, skipLabel, onNext, nextLabel }) {
  return (
  <div style={{
    position: 'relative', background: '#eaf4fb', border: '1px solid #cfe6f5',
    borderRadius: 14, borderBottomLeftRadius: 4, padding: '12px 15px',
    color: '#173a52', fontSize: 14, lineHeight: 1.5, boxShadow: '0 4px 18px rgba(20,60,90,.25)',
  }}>
    <span style={{ position: 'absolute', left: -7, bottom: 10, width: 12, height: 12, background: '#eaf4fb', borderLeft: '1px solid #cfe6f5', borderBottom: '1px solid #cfe6f5', transform: 'rotate(45deg)' }} />
    <div style={{ marginBottom: 10 }}>{text}</div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
      {paso && <span style={{ marginRight: 'auto', fontSize: 11.5, color: '#5a7a8e' }}>{paso.actual} de {paso.total}</span>}
      {onNever && (
        <button
          onClick={onNever}
          style={{ border: 'none', background: 'transparent', color: '#5a7a8e', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px', textDecoration: 'underline' }}
        >
          No mostrar más
        </button>
      )}
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
  );
}
