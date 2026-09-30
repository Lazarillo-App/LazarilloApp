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
// - TransitionProps.onEntered: el maxHeight en vh es un tope FIJO — si el
//   selector está bajo en la página (poco espacio real debajo), el popup
//   igual se puede pasar del borde inferior de la pantalla, dejando las
//   últimas opciones inalcanzables (ya no hay reacomodo que lo evite). Acá
//   se mide cuánto espacio queda de verdad hasta el borde de la ventana y,
//   si el popup no entra, se lo recorta a eso — así siempre queda dentro de
//   la pantalla sin moverse de su lugar.
export function downwardMenuProps(maxHeightVh = 50) {
  return {
    marginThreshold: null,
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
    transformOrigin: { vertical: 'top', horizontal: 'left' },
    slotProps: { paper: { style: { maxHeight: `${maxHeightVh}vh` } } },
    TransitionProps: {
      // onEntering (no onEntered) parecía el lugar natural, pero dispara ANTES
      // de que Popover termine de calcular la posición final del popup (se
      // vio con getBoundingClientRect: top pasaba de un valor inicial a otro
      // muy distinto después) — clampear ahí usaba un "top" todavía
      // provisorio. onEntered corre después de que la transición (y con ella
      // el posicionamiento) ya terminó.
      onEntered: (paperEl) => {
        try {
          const rect = paperEl.getBoundingClientRect();
          const available = window.innerHeight - rect.top - 8;
          if (available > 0 && rect.height > available) {
            paperEl.style.maxHeight = `${available}px`;
          }
        } catch { /* no-op */ }
      },
    },
  };
}
