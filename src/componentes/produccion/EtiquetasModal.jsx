// src/componentes/produccion/EtiquetasModal.jsx
// Etiquetas de una producción (como «aux_etiqueta» de la planilla): nombre, elaboración,
// vencimiento (elaboración + días de vida útil del elaborado), lote, quién lo hizo y cómo se
// conserva. Se imprimen desde el navegador: varias por hoja, del tamaño de una etiqueta común.
import React, { useEffect, useState } from 'react';
import { T, FB } from '@/componentes/ui/temaDiego';
import { Modal, Boton, Campo, Entrada, Texto } from './ui';
import { isoHoy, sumarDias, fmtCant } from './util';

const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function aIso(fecha) {
  if (!fecha) return isoHoy();
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EtiquetasModal({ abierto, onCerrar, tarea, etiqueta, cel }) {
  const [copias, setCopias] = useState('1');
  const [elab, setElab] = useState(isoHoy());
  const [venc, setVenc] = useState('');
  const [contenido, setContenido] = useState('');
  useEffect(() => {
    if (!abierto || !tarea) return;
    const e = aIso(tarea.terminada_at || tarea.iniciada_at || tarea.fecha);
    setElab(e);
    setVenc(etiqueta?.dias_vida != null ? sumarDias(e, etiqueta.dias_vida) : '');
    setCopias('1'); setContenido('');
  }, [abierto, tarea, etiqueta]);
  if (!abierto || !tarea) return null;

  const conserva = [etiqueta?.heladera && `Heladera: ${etiqueta.heladera}`, etiqueta?.freezer && `Freezer: ${etiqueta.freezer}`].filter(Boolean).join(' · ');
  const datos = { nombre: tarea.titulo, elab, venc, lote: etiqueta?.lote, quien: tarea.responsable || '', conserva, contenido: contenido.trim() };

  const imprimir = () => {
    const n = Math.max(1, Math.min(200, Number(copias) || 1));
    const una = `<div class="et">
      <div class="nom">${esc(datos.nombre)}</div>
      ${datos.contenido ? `<div class="cont">${esc(datos.contenido)}</div>` : ''}
      <div class="fila"><span>Elab.</span><b>${ddmm(datos.elab)}</b></div>
      <div class="fila venc"><span>Vence</span><b>${datos.venc ? ddmm(datos.venc) : '—'}</b></div>
      <div class="pie"><span>${esc(datos.lote || '')}</span><span>${esc(datos.quien)}</span></div>
      ${datos.conserva ? `<div class="cons">${esc(datos.conserva)}</div>` : ''}
    </div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${esc(datos.nombre)}</title><style>
      @page { margin: 6mm; } body { margin: 0; font-family: Arial, sans-serif; color: #000; }
      .hoja { display: flex; flex-wrap: wrap; gap: 3mm; }
      .et { width: 60mm; height: 40mm; box-sizing: border-box; border: 1px solid #000; border-radius: 2mm; padding: 2.5mm 3mm;
            display: flex; flex-direction: column; gap: 1mm; page-break-inside: avoid; overflow: hidden; }
      .nom { font-weight: 800; font-size: 11pt; line-height: 1.1; max-height: 2.3em; overflow: hidden; }
      .cont { font-size: 8.5pt; }
      .fila { display: flex; justify-content: space-between; font-size: 9pt; }
      .venc b { font-size: 12pt; }
      .pie { margin-top: auto; display: flex; justify-content: space-between; font-size: 7.5pt; }
      .cons { font-size: 7pt; line-height: 1.1; }
    </style></head><body><div class="hoja">${Array.from({ length: n }, () => una).join('')}</div>
    <script>window.onload = function () { window.print(); };</script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Etiquetas" cel={cel} ancho={520}
      pie={<><Boton onClick={onCerrar}>Cerrar</Boton><Boton primario onClick={imprimir}>🖨 Imprimir {Number(copias) > 1 ? `${copias} etiquetas` : 'etiqueta'}</Boton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
          <Campo label="Elaboración"><Entrada type="date" value={elab} onChange={(e) => {
            setElab(e.target.value);
            if (etiqueta?.dias_vida != null && e.target.value) setVenc(sumarDias(e.target.value, etiqueta.dias_vida));
          }} /></Campo>
          <Campo label="Vencimiento" ayuda={etiqueta?.dias_vida != null ? `${etiqueta.dias_vida} días de vida útil` : 'Cargá la vida útil en Estimados'}>
            <Entrada type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
          </Campo>
          <Campo label="Cuántas"><Entrada inputMode="numeric" value={copias} onChange={(e) => setCopias(e.target.value.replace(/[^\d]/g, ''))} /></Campo>
        </div>
        <Campo label="Contenido de cada una (opcional)" ayuda={tarea.rinde_real != null ? `Rindió ${fmtCant(tarea.rinde_real, tarea.unidad)} en total` : null}>
          <Entrada value={contenido} maxLength={40} onChange={(e) => setContenido(e.target.value)} placeholder="Ej.: 1 kg / 10 porciones" />
        </Campo>
        <div>
          <Texto sutil style={{ marginBottom: 6 }}>Así sale:</Texto>
          <div style={{ width: 240, minHeight: 160, border: `1.5px solid ${T.ink}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'Arial, sans-serif',
            display: 'flex', flexDirection: 'column', gap: 4, background: '#fff', boxSizing: 'border-box' }}>
            <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>{datos.nombre}</div>
            {datos.contenido && <div style={{ fontSize: 12 }}>{datos.contenido}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span>Elab.</span><b>{ddmm(datos.elab)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span>Vence</span><b style={{ fontSize: 16 }}>{datos.venc ? ddmm(datos.venc) : '—'}</b></div>
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontFamily: FB }}><span>{datos.lote}</span><span>{datos.quien}</span></div>
            {datos.conserva && <div style={{ fontSize: 9.5, color: '#333' }}>{datos.conserva}</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
