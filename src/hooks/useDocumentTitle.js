// src/hooks/useDocumentTitle.js
//
// Título de la pestaña del navegador: «<pantalla> · <módulo>» (ej. «Nómina · RRHH»,
// «Insumos · Recetas»). La pantalla va PRIMERO porque la pestaña corta el final: con varias
// pestañas abiertas se ve de un vistazo dónde está cada una (Diego 12/11/2026).
// Antes, al salir de la pestaña el título rotaba mensajes («¡Volvé Diego! 👋») y todas las
// pestañas de fondo quedaban iguales: se sacó.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// [prefijo de ruta, pantalla, módulo]. Gana el prefijo más largo que coincida.
const RUTAS = [
    ['/inicio', 'Inicio', null],
    ['/menu', 'Artículos', 'Recetas'],
    ['/insumos', 'Insumos', 'Recetas'],
    ['/agrupacioneslist', 'Agrupaciones', 'Recetas'],
    ['/tableros', 'Tableros', 'Operación'],
    ['/plaza', 'Tableros', 'Operación'],
    ['/rrhh/cronogramas', 'Cronogramas', 'RRHH'],
    ['/rrhh/nomina', 'Nómina', 'RRHH'],
    ['/rrhh', 'RRHH', null],
    ['/gestion/conceptos', 'Conceptos de caja', 'Resultados'],
    ['/gestion/medios-pago', 'Medios de pago', 'Resultados'],
    ['/gestion', 'Resultados', null],
    ['/m', 'Resultados', null],
    ['/configuracion', 'Configuración', null],
    ['/perfil', 'Perfil', null],
    ['/alta', 'Asistente de alta', null],
    ['/admin', 'Admin', null],
    ['/login', 'Iniciar sesión', null],
    ['/register', 'Registro', null],
    ['/activar', 'Activar cuenta', null],
    ['/forgot-password', 'Recuperar contraseña', null],
    ['/reset-password', 'Nueva contraseña', null],
    ['/aceptar-invitacion', 'Activar cuenta', null],
    ['/seleccionar-negocio', 'Seleccionar negocio', null],
].sort((a, b) => b[0].length - a[0].length);

function tituloDe(pathname, search) {
    const r = RUTAS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
    if (!r) return 'Lazarillo';
    let [, pantalla, modulo] = r;
    // Menú › vista Diseño (la carta) vive en /menu?vista=diseno.
    if (r[0] === '/menu' && new URLSearchParams(search).get('vista') === 'diseno') pantalla = 'Menú';
    return modulo ? `${pantalla} · ${modulo}` : `${pantalla} · Lazarillo`;
}

export function useDocumentTitle() {
    const location = useLocation();
    useEffect(() => {
        document.title = tituloDe(location.pathname, location.search);
    }, [location.pathname, location.search]);
}
