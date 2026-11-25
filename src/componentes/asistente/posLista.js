// POS gastronómicos más usados en Argentina. Lo usan el alta (paso POS) y
// Configuración › Conexiones.
export const POS_BASE = ["Nucleo", "Fudo", "Maxirest", "Wona Sports", "Bistrosoft", "Popapp", "HivePOS", "iRestora PLUS", "Toteat", "Lightspeed Restaurant", "Square", "Loyverse", "Waitry"];
export const POS_OTRO = "Otro (no está en la lista)";
export const POS_NINGUNO = "Ninguno / lo llevo en papel o planilla";

// POS que hoy tienen actualizador descargable (el kit). Se suman a medida que se integren.
export const POS_CON_ACTUALIZADOR = ["Maxirest"];
export const tieneActualizador = (pos) =>
  POS_CON_ACTUALIZADOR.some((p) => p.toLowerCase() === String(pos || "").trim().toLowerCase());

// POS que se conectan solos por su API, sin instalar nada: el cliente pega sus claves (17/11/2026).
export const POS_CON_API = ["Fudo", "Wona Sports"];
// Wona Sports (25/11/2026): canchas y buffet; se conecta con el usuario y la clave de Wona. También
// si lo escribieron a mano con «Otro» («Wona», «wona sport»…).
export const esWona = (pos) => /^wona/i.test(String(pos || "").trim());
export const conectaPorApi = (pos) =>
  esWona(pos) || POS_CON_API.some((p) => p.toLowerCase() === String(pos || "").trim().toLowerCase());
