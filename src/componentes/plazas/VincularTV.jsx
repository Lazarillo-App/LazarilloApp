// src/componentes/plazas/VincularTV.jsx — «Vincular TV» desde el tablero de una plaza (Diego 14/11/2026).
// La TV de la cocina abre lazarillo.com.ar/pantalla y muestra un código de 6 dígitos; acá se escribe ese
// código y la TV pasa a mostrar esta plaza sola, todos los días, solo para ver. También lista las TVs que
// ya muestran la plaza y deja desvincularlas (la TV vuelve a mostrar un código).
import React from 'react';
import { Box, Stack, Typography, Button, InputBase, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Tooltip } from '@mui/material';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { PlazasAPI } from '@/servicios/apiPlazas';

const campo = { height: 40, border: '1px solid', borderColor: 'divider', borderRadius: '6px', px: 1.25, fontSize: '0.9rem', width: '100%',
  '&.Mui-focused': { borderColor: '#5BC2EA', boxShadow: '0 0 0 2px rgba(91,194,234,.25)' } };
const lbl = { fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '.04em', textAlign: 'center', mb: 0.5 };

function haceCuanto(fecha) {
  if (!fecha) return 'todavía no se conectó';
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 3) return 'conectada ahora';
  if (min < 60) return `vista hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `vista hace ${h} h`;
  return `vista hace ${Math.round(h / 24)} días`;
}

export default function VincularTV({ abierto, plaza, onCerrar, onAviso }) {
  const [lista, setLista] = React.useState([]);
  const [codigo, setCodigo] = React.useState('');
  const [nombre, setNombre] = React.useState('');
  const [error, setError] = React.useState('');
  const [guardando, setGuardando] = React.useState(false);

  const cargar = React.useCallback(() => {
    if (!plaza?.id) return;
    PlazasAPI.pantallas(plaza.id).then(setLista).catch(() => setLista([]));
  }, [plaza?.id]);
  React.useEffect(() => { if (abierto) { setCodigo(''); setNombre(''); setError(''); cargar(); } }, [abierto, cargar]);

  const vincular = async () => {
    setGuardando(true); setError('');
    try {
      const p = await PlazasAPI.vincularPantalla(plaza.id, codigo, nombre.trim());
      setLista((l) => [...l, p]);
      setCodigo(''); setNombre('');
      onAviso?.(`Listo: la TV ya muestra ${plaza.nombre}`);
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };
  const desvincular = async (p) => {
    setLista((l) => l.filter((x) => x.id !== p.id));
    try { await PlazasAPI.desvincularPantalla(plaza.id, p.id); onAviso?.(`${p.nombre || 'TV'} desvinculada`); } catch (e) { setError(e.message); cargar(); }
  };

  const listo = codigo.length === 6 && !guardando;
  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>
        Vincular TV<Typography component="span" color="text.secondary" sx={{ fontSize: '0.85rem' }}> · {plaza?.nombre}</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 1.5, lineHeight: 1.45 }}>
          En la TV de la cocina abrí <b>lazarillo.com.ar/pantalla</b>. Va a mostrar un código: escribilo acá. Desde ahí la TV abre esta plaza sola cada vez que se prende.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Box>
            <Typography sx={lbl}>Código de la TV</Typography>
            <InputBase autoFocus value={codigo} onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && listo) vincular(); }} placeholder="000000"
              inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', letterSpacing: '.25em', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }} sx={campo} />
          </Box>
          <Box>
            <Typography sx={lbl}>Nombre (opcional)</Typography>
            <InputBase value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="TV cocina"
              onKeyDown={(e) => { if (e.key === 'Enter' && listo) vincular(); }}
              inputProps={{ style: { textAlign: 'center' }, maxLength: 40 }} sx={campo} />
          </Box>
        </Box>
        {error && <Typography sx={{ color: 'error.main', fontSize: '0.78rem', mt: 0.75, textAlign: 'center' }}>{error}</Typography>}
        {!!lista.length && (
          <>
            <Typography sx={{ ...lbl, textAlign: 'left', mt: 2 }}>TVS QUE MUESTRAN ESTA PLAZA</Typography>
            {lista.map((p) => (
              <Stack key={p.id} direction="row" alignItems="center" spacing={1} sx={{ minHeight: 40, borderBottom: '1px solid #f0f2f5' }}>
                <TvOutlinedIcon sx={{ fontSize: 20, color: '#2492C8' }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{p.nombre || 'TV'}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>{haceCuanto(p.ultima_vez)}</Typography>
                <Tooltip title="Desvincular: la TV vuelve a mostrar un código">
                  <IconButton size="small" onClick={() => desvincular(p)} aria-label={`Desvincular ${p.nombre || 'TV'}`}><LinkOffIcon sx={{ fontSize: 18 }} /></IconButton>
                </Tooltip>
              </Stack>
            ))}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onCerrar}>Cerrar</Button>
        <Button variant="contained" disableElevation disabled={!listo} onClick={vincular}>{guardando ? 'Vinculando…' : 'Vincular'}</Button>
      </DialogActions>
    </Dialog>
  );
}
