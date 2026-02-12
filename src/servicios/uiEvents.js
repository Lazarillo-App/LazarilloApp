/* eslint-disable no-empty */
// src/servicios/uiEvents.js
// src/servicios/uiEvents.js
export const emitUiAction = (detail) => {
  try {
    const actionId = detail?.actionId || `a:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    window.dispatchEvent(new CustomEvent('ui:action', { detail: { ...detail, actionId } }));
  } catch { }
};

export const emitUiUndo = (detail) => {
  try {
    window.dispatchEvent(new CustomEvent('ui:undo', { detail }));
  } catch { }
};
