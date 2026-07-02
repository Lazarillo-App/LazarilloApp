// src/hooks/useDocumentTitle.js
//
// Maneja el título de la pestaña del browser:
// - En cada ruta: "Lazarillo | <vista>"
// - Cuando el usuario cambia de pestaña: rota un mensaje personalizado
//   ej. "¡Volvé Juan! 👋"
// - Cuando vuelve a la pestaña: restaura el título original

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// Mapeo de paths a títulos legibles
const ROUTE_TITLES = {
    '/': 'Lazarillo',
    '/menu': 'Menú',
    '/insumos': 'Insumos',
    '/perfil': 'Perfil',
    '/configuracion': 'Configuración',
    '/login': 'Iniciar sesión',
    '/register': 'Registro',
    '/activar': 'Activar cuenta',
    '/forgot-password': 'Recuperar contraseña',
    '/reset-password': 'Nueva contraseña',
    '/aceptar-invitacion': 'Activar cuenta',
    '/seleccionar-negocio': 'Seleccionar negocio',
    '/admin': 'Admin',
};

// Resuelve el título según la ruta. Maneja paths con sub-segmentos.
function resolveRouteTitle(pathname) {
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

    // Coincidencia por prefijo (ej /admin/users → "Admin")
    for (const [path, title] of Object.entries(ROUTE_TITLES)) {
        if (path !== '/' && pathname.startsWith(path)) return title;
    }
    return null;
}

// Mensajes para "volver" — rotan random
const COME_BACK_MESSAGES = [
    (name) => `¡Volvé ${name}! 👋`,
    (name) => `${name}, te espero 🌟`,
    (name) => `${name}... Volvé a la acción! 🚀`,
    (name) => `Seguí gestionando, ${name} 💪`,
];

export function useDocumentTitle() {
    const location = useLocation();
    const { user } = useAuth() || {};
    const originalTitleRef = useRef('Lazarillo');

    // Nombre a usar en el mensaje (prioriza display_name)
    const userName = (user?.display_name || user?.name || '').trim().split(' ')[0] || null;

    // Actualizar título cuando cambia la ruta
    useEffect(() => {
        const sectionTitle = resolveRouteTitle(location.pathname);
        const title = sectionTitle && sectionTitle !== 'Lazarillo'
            ? `Lazarillo | ${sectionTitle}`
            : 'Lazarillo';
        document.title = title;
        originalTitleRef.current = title;
    }, [location.pathname]);

    // Listener de visibilidad: cambia título cuando el user sale/vuelve
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.hidden) {
                // Usuario salió de la pestaña → mensaje personalizado
                if (userName) {
                    const msgFn = COME_BACK_MESSAGES[Math.floor(Math.random() * COME_BACK_MESSAGES.length)];
                    document.title = msgFn(userName);
                } else {
                    document.title = '¡Volvé pronto! 👋';
                }
            } else {
                // Volvió → restaurar el título de la ruta
                document.title = originalTitleRef.current;
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [userName]);
}