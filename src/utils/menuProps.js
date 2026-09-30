// src/utils/menuProps.js
//
// MenuProps compartido para los <Select> de la app: el popup SIEMPRE tiene
// que abrir hacia abajo, pegado al selector — nunca reposicionarse lejos
// (arriba del todo, corrido a un costado) cuando el contenido es largo.
//
// - marginThreshold:null desactiva el reacomodo automático de MUI por
//   límites del viewport (que es justamente lo que lo despegaba del
//   selector cuando no entraba entero en pantalla).
// - anchorOrigin/transformOrigin en 'left' (no 'center', el default) evita
//   que un popup más ancho que el selector se corra hacia la izquierda.
// - maxHeight en vh: como ya no se reposiciona por altura, el propio popup
//   tiene que scrollear internamente si el contenido no entra.
export function downwardMenuProps(maxHeightVh = 50) {
  return {
    marginThreshold: null,
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
    transformOrigin: { vertical: 'top', horizontal: 'left' },
    slotProps: { paper: { style: { maxHeight: `${maxHeightVh}vh` } } },
  };
}
