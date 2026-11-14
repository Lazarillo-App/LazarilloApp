// src/componentes/ui/temaDiego.js
// El tema que viene usando Diego en Cronogramas, Nómina y Conciliación (paleta de marca, Sora para
// títulos y Archivo para el texto), en un solo lugar para que las pantallas nuevas lo compartan
// (usuaria 13/11/2026: "imitar los estilos que él viene agregando").
export const T = {
  bg: '#F3F6FA', band: '#FFFFFF', card: '#EAF1F8', head: '#F7FAFD',
  accent: '#5BC2EA', accentTxt: '#1E87B5', ink: '#15213E',
  text: '#15213E', text2: '#46587A', text3: '#8696B2',
  border: '#E2E9F2', border2: '#C9D6E6',
  ok: '#1FA866', warn: '#C8912B', bad: '#D64545', violet: '#8B5CF6',
  sombra: '0 20px 60px #15213E33', sombraSuave: '0 2px 10px #15213E14', vacio: '#B9C7DA',
};
export const FT = "'Sora', sans-serif";
export const FB = "'Archivo', sans-serif";

// Carga las fuentes una sola vez (como hace el módulo de Conciliación).
export function cargarFuentes() {
  if (typeof document === 'undefined' || document.getElementById('lz-fuentes-diego')) return;
  const link = document.createElement('link');
  link.id = 'lz-fuentes-diego';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Archivo:wght@300;400;500;600;700&display=swap';
  document.head.appendChild(link);
}
