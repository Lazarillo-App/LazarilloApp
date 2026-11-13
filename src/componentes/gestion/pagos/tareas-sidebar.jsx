/* eslint-disable */
// Tareas tipo to-do en la mitad de abajo del cajón de Notas (Diego 12/11/2026).
// De cada usuario en cada negocio, como las notas. Cada tarea muestra cuándo se creó y, al tildarla,
// cuándo se dio de baja. El botón de Notas del Panel lleva el número de pendientes (useTareasPendientes).
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Checkbox, Drawer, IconButton, InputBase, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { gestionFetch } from '@/servicios/apiGestion';
import { useBusiness } from '@/context/BusinessContext';
import { ScopeGestion } from '@/gestion/compat';
import { NotasSidebar } from '@/componentes/gestion/pagos/notas-sidebar';

const CELESTE = '#5BC2EA';

async function pedir(ruta, opciones) {
  const r = await gestionFetch(ruta, opciones);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

const clave = (businessId) => ['gestion', 'tareas', businessId ?? null];

function useTareas(habilitado = true) {
  const { activeBusinessId } = useBusiness() || {};
  return useQuery({
    queryKey: clave(activeBusinessId),
    queryFn: () => pedir('/api/tareas'),
    enabled: !!activeBusinessId && habilitado,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// Para los globitos (botón de Notas del Panel y avatar del perfil): leen la misma caché que la
// lista, así hay un solo pedido y los números siempre coinciden.
export function useTareasPendientes(habilitado = true) {
  const q = useTareas(habilitado);
  return q.data?.pendientes?.length ?? 0;
}

const fecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};

export function TareasSidebar() {
  const { activeBusinessId } = useBusiness() || {};
  const qc = useQueryClient();
  const key = clave(activeBusinessId);
  const { data, isLoading, isError } = useTareas();
  const [nueva, setNueva] = useState('');
  const [verHechas, setVerHechas] = useState(false);
  const [error, setError] = useState(false);

  const pendientes = data?.pendientes ?? [];
  const hechas = data?.hechas ?? [];

  // Optimista: se ve al instante; si el servidor falla, vuelve a lo anterior y avisa.
  async function aplicar(cambio, llamada) {
    const antes = qc.getQueryData(key);
    qc.setQueryData(key, (d) => cambio(d ?? { pendientes: [], hechas: [] }));
    setError(false);
    try {
      const res = await llamada();
      return res;
    } catch {
      qc.setQueryData(key, antes);
      setError(true);
      return null;
    }
  }

  async function agregar() {
    const texto = nueva.trim();
    if (!texto) return;
    setNueva('');
    const tmp = { id: `tmp-${Date.now()}`, texto, creadaEn: new Date().toISOString(), hechaEn: null };
    const creada = await aplicar(
      (d) => ({ ...d, pendientes: [...d.pendientes, tmp] }),
      () => pedir('/api/tareas', { method: 'POST', body: JSON.stringify({ texto }) }),
    );
    if (creada) qc.setQueryData(key, (d) => ({ ...d, pendientes: d.pendientes.map((t) => (t.id === tmp.id ? creada : t)) }));
  }

  function tildar(t) {
    if (String(t.id).startsWith('tmp-')) return;
    const hecha = !t.hechaEn;
    const ahora = new Date().toISOString();
    aplicar(
      (d) => (hecha
        ? { pendientes: d.pendientes.filter((x) => x.id !== t.id), hechas: [{ ...t, hechaEn: ahora }, ...d.hechas] }
        : { hechas: d.hechas.filter((x) => x.id !== t.id),
            pendientes: [...d.pendientes, { ...t, hechaEn: null }].sort((a, b) => a.creadaEn.localeCompare(b.creadaEn)) }),
      () => pedir(`/api/tareas/${t.id}`, { method: 'PATCH', body: JSON.stringify({ hecha }) }),
    );
  }

  function borrar(t) {
    if (String(t.id).startsWith('tmp-')) return;
    aplicar(
      (d) => ({ pendientes: d.pendientes.filter((x) => x.id !== t.id), hechas: d.hechas.filter((x) => x.id !== t.id) }),
      () => pedir(`/api/tareas/${t.id}`, { method: 'DELETE' }),
    );
  }

  const fila = (t) => {
    const hecha = !!t.hechaEn;
    return (
      <Box key={t.id} sx={{
        display: 'flex', alignItems: 'flex-start', gap: 0.5, px: 0.5, py: 0.25, borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' }, '&:hover .tarea-borrar': { opacity: 1 },
      }}>
        <Checkbox size="small" checked={hecha} onChange={() => tildar(t)}
          sx={{ p: 0.5, mt: '1px', color: 'grey.400', '&.Mui-checked': { color: CELESTE } }}
          inputProps={{ 'aria-label': hecha ? 'Volver a pendiente' : 'Marcar como hecha' }} />
        <Box sx={{ flex: 1, minWidth: 0, pt: '5px' }}>
          <Box sx={{ fontSize: 13, lineHeight: 1.35, wordBreak: 'break-word',
            color: hecha ? 'text.secondary' : 'text.primary', textDecoration: hecha ? 'line-through' : 'none' }}>
            {t.texto}
          </Box>
          <Box sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
            Creada {fecha(t.creadaEn)}{hecha ? ` · Hecha ${fecha(t.hechaEn)}` : ''}
          </Box>
        </Box>
        <Tooltip title="Borrar">
          <IconButton className="tarea-borrar" size="small" onClick={() => borrar(t)} aria-label="Borrar tarea"
            sx={{ opacity: 0, mt: '2px', width: 26, height: 26, color: 'text.secondary', '@media (hover: none)': { opacity: 0.6 } }}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, px: 1, pb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, pt: 1.25, pb: 1 }}>
        <Box sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>Tareas</Box>
        <Box sx={{ fontSize: 11, color: error || isError ? 'error.main' : 'text.secondary' }}>
          {error ? 'No se pudo guardar' : isError ? 'No se pudieron cargar' : isLoading ? 'Cargando…'
            : pendientes.length ? `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}` : ''}
        </Box>
      </Box>

      {/* Alta: Enter agrega. */}
      <Box component="form" onSubmit={(e) => { e.preventDefault(); agregar(); }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 36, px: 1.25, mb: 1, border: '1px solid', borderColor: 'divider',
          borderRadius: 1.5, '&:focus-within': { borderColor: CELESTE } }}>
        <Box component="span" sx={{ color: CELESTE, fontSize: 18, lineHeight: 1, fontWeight: 500 }}>+</Box>
        <InputBase value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva tarea… (Enter para agregar)"
          inputProps={{ maxLength: 500, 'aria-label': 'Nueva tarea' }} sx={{ flex: 1, fontSize: 13 }} />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {!isLoading && !pendientes.length && (
          <Box sx={{ fontSize: 12, color: 'text.secondary', px: 1, py: 1 }}>
            {hechas.length ? 'No tenés tareas pendientes.' : 'Anotá lo que tengas que hacer y tildalo cuando lo termines.'}
          </Box>
        )}
        {pendientes.map(fila)}

        {hechas.length > 0 && (
          <>
            <Box component="button" type="button" onClick={() => setVerHechas((v) => !v)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, mb: 0.5, px: 1, py: 0.5, border: 0, bgcolor: 'transparent',
                cursor: 'pointer', fontSize: 12, color: 'text.secondary', fontFamily: 'inherit', '&:hover': { color: 'text.primary' } }}>
              <ExpandMoreIcon sx={{ fontSize: 16, transition: 'transform .15s', transform: verHechas ? 'none' : 'rotate(-90deg)' }} />
              Hechas ({hechas.length})
              <Box component="span" sx={{ ml: 0.5, color: 'text.disabled' }}>· quedan 60 días y desaparecen</Box>
            </Box>
            {verHechas && hechas.map(fila)}
          </>
        )}
      </Box>
    </Box>
  );
}

// «Mis pendientes» desde el menú del perfil (Diego 12/11/2026): lo mismo que el cajón de Notas del Panel
// (notas arriba, tareas abajo, media pantalla cada uno), desde cualquier pantalla.
export function MisPendientesDrawer({ open, onClose }) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} sx={{ zIndex: 1300 }}
      slotProps={{ paper: { sx: { width: 'min(480px, 100vw)', display: 'flex', flexDirection: 'column' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: '1px solid #e8e8e6' }}>
        <Box sx={{ fontWeight: 700, fontSize: 15 }}>Mis pendientes</Box>
        <IconButton size="small" onClick={onClose} aria-label="Cerrar" sx={{ ml: 'auto' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      {open && (
        <>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', pt: 1 }}>
            <ScopeGestion><Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}><NotasSidebar /></Box></ScopeGestion>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid #e8e8e6' }}>
            <TareasSidebar />
          </Box>
        </>
      )}
    </Drawer>
  );
}
