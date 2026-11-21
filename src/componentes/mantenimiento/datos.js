// src/componentes/mantenimiento/datos.js — tipos de equipo, estados y registros rápidos.
import { T } from '@/componentes/ui/temaDiego';

export const RUBRO = {
  heladera: { label: 'Heladera / cámara', emoji: '🧊' }, freidora: { label: 'Freidora', emoji: '🍟' },
  horno: { label: 'Horno / cocina', emoji: '🔥' }, maquina: { label: 'Máquina', emoji: '⚙️' }, otro: { label: 'Otro', emoji: '🔧' },
};
export const ESTADO_EQUIPO = {
  activo: { label: 'Funciona', color: T.ok, fondo: '#E4F6EC' },
  en_reparacion: { label: 'En reparación', color: T.bad, fondo: '#FBE9E9' },
  baja: { label: 'De baja', color: T.text3, fondo: T.card },
};
// Lo que se registra en el día a día según el tipo de equipo (como las hojas freidoras / heladeras).
export const TIPOS_POR_RUBRO = {
  freidora: [['aceite_filtrado', 'Filtré'], ['aceite_cambio', 'Cambié aceite'], ['aceite_carga', 'Cargué aceite'], ['limpieza', 'Limpié']],
  heladera: [['temperatura', 'Temperatura'], ['limpieza', 'Limpié'], ['otro', 'Otro']],
  horno: [['limpieza', 'Limpié'], ['otro', 'Otro']],
  maquina: [['limpieza', 'Limpié'], ['otro', 'Otro']],
  otro: [['limpieza', 'Limpié'], ['otro', 'Otro']],
};
