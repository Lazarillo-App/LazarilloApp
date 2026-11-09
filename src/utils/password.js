// src/utils/password.js
// Regla única para toda contraseña que se elige o se cambia (2026-11-09): al menos 10 caracteres,
// 1 mayúscula y 1 número. Es la misma que valida el Backend (utils/passwordPolicy.js).

export const PASSWORD_MIN = 10;
export const PASSWORD_REGLA = 'Mínimo 10 caracteres, con una mayúscula y un número.';

/** Lo que falta para que la contraseña sirva (lista vacía = cumple). */
export function faltantesPassword(password) {
  const p = String(password ?? '');
  const faltan = [];
  if (p.length < PASSWORD_MIN) faltan.push(`${PASSWORD_MIN} caracteres`);
  if (!/\p{Lu}/u.test(p)) faltan.push('una mayúscula');
  if (!/\d/.test(p)) faltan.push('un número');
  return faltan;
}

export const passwordValida = (password) => faltantesPassword(password).length === 0;

/** Texto para mostrar debajo del campo: "Le falta: una mayúscula y un número." */
export function mensajePassword(password) {
  const f = faltantesPassword(password);
  if (!f.length) return '';
  const lista = f.length === 1 ? f[0] : `${f.slice(0, -1).join(', ')} y ${f[f.length - 1]}`;
  return `Le falta: ${lista}.`;
}
