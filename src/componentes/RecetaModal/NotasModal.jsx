// src/componentes/RecetaModal/NotasModal.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal, Box, Typography, TextField, Button, IconButton, Stack,
  Autocomplete, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NotesIcon from '@mui/icons-material/Notes';
import ImageIcon from '@mui/icons-material/Image';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddIcon from '@mui/icons-material/Add';
import { BASE } from '@/servicios/apiBase';
import { PRIMARY, ON_PRIMARY, fmtDate } from './helpers';
import { useFotoUploadQR } from './useFotoUploadQR';
import EditorFotoModal from './EditorFotoModal';

function authHeaders(businessId) {
  const token = localStorage.getItem('token') || '';
  return {
    Authorization: `Bearer ${token}`,
    'X-Business-Id': String(businessId || ''),
    'Content-Type': 'application/json',
  };
}

/* ════════════════════════════════════════
   BLOQUE: Método de cocción/servicio + Temperatura + Tiempo
════════════════════════════════════════ */
function BloqueMetodo({ businessId, metodo, setMetodo, temperatura, setTemperatura, tiempoMin, setTiempoMin }) {
  const [opciones, setOpciones] = useState([]);

  useEffect(() => {
    if (!businessId) return;
    fetch(`${BASE}/businesses/${businessId}/metodos-coccion`, { headers: authHeaders(businessId) })
      .then(r => r.json())
      .then(json => setOpciones(Array.isArray(json?.data) ? json.data.map(m => m.nombre) : []))
      .catch(() => {});
  }, [businessId]);

  const crearMetodoNuevo = (nombre) => {
    const limpio = nombre.trim();
    if (!limpio || opciones.includes(limpio)) return;
    setOpciones(prev => [...prev, limpio].sort());
    fetch(`${BASE}/businesses/${businessId}/metodos-coccion`, {
      method: 'POST', headers: authHeaders(businessId), body: JSON.stringify({ nombre: limpio }),
    }).catch(() => {});
  };

  return (
    <Stack direction="row" spacing={1.5}>
      <Autocomplete
        freeSolo
        size="small"
        fullWidth
        options={opciones}
        value={metodo || ''}
        onChange={(_, v) => { const val = v || ''; setMetodo(val); if (val) crearMetodoNuevo(val); }}
        onInputChange={(_, v, reason) => { if (reason === 'input') setMetodo(v); }}
        onBlur={() => { if (metodo) crearMetodoNuevo(metodo); }}
        renderInput={(params) => <TextField {...params} label="Método de cocción / servicio" />}
        sx={{ flex: 2 }}
      />
      <TextField
        size="small"
        label="Temperatura"
        type="number"
        value={temperatura}
        onChange={e => setTemperatura(e.target.value)}
        InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">°C</Typography> }}
        sx={{ width: 130 }}
      />
      <TextField
        size="small"
        label="Tiempo"
        type="number"
        value={tiempoMin}
        onChange={e => setTiempoMin(e.target.value)}
        InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">min</Typography> }}
        sx={{ width: 120 }}
      />
    </Stack>
  );
}

/* ════════════════════════════════════════
   BLOQUE: Paso a paso reordenable
════════════════════════════════════════ */
function BloquePasos({ pasos, setPasos, label }) {
  const [nuevo, setNuevo] = useState('');
  const dragIdx = useRef(null);

  const agregar = () => {
    const limpio = nuevo.trim();
    if (!limpio) return;
    setPasos(prev => [...prev, limpio]);
    setNuevo('');
  };
  const quitar = (i) => setPasos(prev => prev.filter((_, idx) => idx !== i));
  const mover = (from, to) => {
    if (to < 0 || to >= pasos.length) return;
    setPasos(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {pasos.map((p, i) => (
          <Stack
            key={i}
            direction="row"
            alignItems="center"
            spacing={1}
            draggable
            onDragStart={() => { dragIdx.current = i; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragIdx.current != null) mover(dragIdx.current, i); dragIdx.current = null; }}
            sx={{
              border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
              px: 1, py: 0.75, bgcolor: 'background.paper', cursor: 'grab',
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            <Box sx={{
              width: 22, height: 22, borderRadius: '50%', bgcolor: 'action.selected',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
            }}>
              {i + 1}
            </Box>
            <Typography variant="body2" sx={{ flex: 1, fontSize: '0.85rem' }}>{p}</Typography>
            <IconButton size="small" onClick={() => quitar(i)}>
              <CloseIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Box
        sx={{
          mt: 0.75, border: '1px dashed', borderColor: 'divider', borderRadius: 1.5,
          display: 'flex', alignItems: 'center', gap: 1, px: 1,
        }}
      >
        <TextField
          variant="standard"
          placeholder="Agregar paso…"
          fullWidth
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem', py: 0.75 } }}
        />
        <IconButton size="small" onClick={agregar} disabled={!nuevo.trim()} sx={{ color: PRIMARY }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

/* ════════════════════════════════════════
   BLOQUE: Observaciones — hilo de comentarios (autor + fecha)
════════════════════════════════════════ */
function BloqueObservaciones({ observacionesUrl, businessId, recetaExiste }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    if (!observacionesUrl || !recetaExiste) return;
    setCargando(true);
    fetch(observacionesUrl, { headers: authHeaders(businessId) })
      .then(r => r.json())
      .then(json => setLista(Array.isArray(json?.observaciones) ? json.observaciones : []))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [observacionesUrl, businessId, recetaExiste]);

  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async () => {
    const limpio = texto.trim();
    if (!limpio || !observacionesUrl) return;
    setEnviando(true);
    setError('');
    try {
      const res = await fetch(observacionesUrl, {
        method: 'POST', headers: authHeaders(businessId), body: JSON.stringify({ texto: limpio }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.observacion) setLista(prev => [...prev, json.observacion]);
      setTexto('');
    } catch {
      setError('No se pudo agregar la observación');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.04em' }}>
        OBSERVACIONES
      </Typography>
      <Box sx={{
        mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
        maxHeight: 220, overflowY: 'auto',
      }}>
        {cargando ? (
          <Stack alignItems="center" py={2}><CircularProgress size={18} /></Stack>
        ) : !recetaExiste ? (
          <Typography variant="body2" color="text.disabled" sx={{ p: 1.5, fontSize: '0.8rem' }}>
            Guardá la receta primero para poder agregar observaciones.
          </Typography>
        ) : lista.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ p: 1.5, fontSize: '0.8rem' }}>
            Todavía no hay observaciones.
          </Typography>
        ) : (
          lista.map((o, i) => (
            <Box key={o.id} sx={{ px: 1.5, py: 1, borderBottom: i < lista.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{o.texto}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <strong>{o.autor_alias_snapshot || 'Alguien'}</strong> · {fmtDate(o.created_at) || ''}
              </Typography>
            </Box>
          ))
        )}
      </Box>
      {recetaExiste && (
        <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
          <TextField
            size="small" fullWidth placeholder="Escribí una observación…"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agregar(); } }}
            disabled={enviando}
          />
          <Button
            variant="contained" size="small" onClick={agregar}
            disabled={enviando || !texto.trim()}
            sx={{ bgcolor: PRIMARY, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}
          >
            {enviando ? <CircularProgress size={16} color="inherit" /> : 'Agregar'}
          </Button>
        </Stack>
      )}
      {error && <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>{error}</Typography>}
    </Box>
  );
}

/* ════════════════════════════════════════
   MODAL DE NOTAS + FOTO
════════════════════════════════════════ */
export default function NotasModal({
  notas,
  foto,
  fotos,
  notasUpdatedAt,
  onSave,
  onClose,
  articuloId,
  businessId,
  esElaborado,
  metodoCoccion: metodoInicial = '',
  temperatura: temperaturaInicial = '',
  tiempoMin: tiempoInicial = '',
  pasos: pasosIniciales = [],
  observacionesUrl = null,
  recetaExiste = false,
}) {
  // El textarea único de "notas" queda reemplazado por los 3 bloques de abajo —
  // `notas`/`notasUpdatedAt` se siguen guardando tal cual venían (compat), pero
  // ya no se editan desde acá.
  const [localFotos, setLocalFotos] = useState(() => {
    if (Array.isArray(fotos) && fotos.length) return fotos.filter(Boolean).slice(0, 6);
    return foto ? [foto] : [];
  });
  const [metodo, setMetodo] = useState(metodoInicial || '');
  const [temperatura, setTemperatura] = useState(temperaturaInicial || '');
  const [tiempoMin, setTiempoMin] = useState(tiempoInicial || '');
  const [pasos, setPasos] = useState(Array.isArray(pasosIniciales) ? pasosIniciales : []);

  const initialFotosRef = useRef(
    Array.isArray(fotos) && fotos.length ? fotos.filter(Boolean).slice(0, 6) : (foto ? [foto] : [])
  );
  const initialPrepRef = useRef({ metodo: metodoInicial || '', temperatura: temperaturaInicial || '', tiempoMin: tiempoInicial || '', pasos: pasosIniciales || [] });

  const construirPrep = () => ({ metodoCoccion: metodo, temperatura, tiempoMin, pasos });

  // Cierre "accidental" (X, click afuera): guarda solo si cambió algo
  const handleCloseGuardando = () => {
    const cambioPrep = JSON.stringify({ metodo, temperatura, tiempoMin, pasos })
      !== JSON.stringify(initialPrepRef.current);
    const cambioFotos = JSON.stringify(localFotos) !== JSON.stringify(initialFotosRef.current);
    if (cambioPrep || cambioFotos) {
      const now = new Date().toISOString();
      onSave(notas, localFotos, now, construirPrep());
    }
    onClose();
  };

  const [fotoActiva, setFotoActiva] = useState(0); // índice de la foto que se está viendo
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  // Fecha de modificación: se actualiza al guardar
  const [localUpdatedAt, setLocalUpdatedAt] = useState(notasUpdatedAt || null);
  const [fotoParaEditar, setFotoParaEditar] = useState(null); // foto cruda esperando recorte

  const {
    uploadToken, tokenLoading, showQR, hayFotosQR, uploadError, setHayFotosQR, setUploadError, toggleQR,
  } = useFotoUploadQR({
    articuloId, businessId,
    onFotosRecibidas: (fotosNuevas) => {
      const nueva = fotosNuevas[0];
      if (!localFotos.includes(nueva)) {
        setFotoParaEditar(nueva); // abrir editor con la foto del celular
        setHayFotosQR(true);
        setUploadError('📱 Foto recibida del celular — ajustala y guardá');
      }
    },
  });

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFotoParaEditar(ev.target.result); // abrir editor en vez de guardar directo
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const fotoLabel = esElaborado ? 'Foto de la receta' : 'Foto del emplatado';
  const pasosLabel = esElaborado ? 'PASO A PASO DE ELABORACIÓN' : 'PASO A PASO DEL SERVICIO';

  return (
    <>
      <Modal open onClose={handleCloseGuardando}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '95vw', sm: 640 },
          bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
          outline: 'none', overflow: 'hidden',
          maxHeight: '95vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <Box sx={{
            px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <NotesIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700}>Notas e imagen de la receta</Typography>
            </Stack>
            <IconButton size="small" onClick={handleCloseGuardando} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
          </Box>

          <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5, overflowY: 'auto' }}>
            <BloqueMetodo
              businessId={businessId}
              metodo={metodo} setMetodo={setMetodo}
              temperatura={temperatura} setTemperatura={setTemperatura}
              tiempoMin={tiempoMin} setTiempoMin={setTiempoMin}
            />

            <BloquePasos pasos={pasos} setPasos={setPasos} label={pasosLabel} />

            <BloqueObservaciones
              observacionesUrl={observacionesUrl}
              businessId={businessId}
              recetaExiste={recetaExiste}
            />

            {/* Foto */}
            {localFotos.length > 0 ? (
              <Box>
                <Box sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                  <img
                    src={localFotos[fotoActiva]}
                    alt={`Foto receta ${fotoActiva + 1}`}
                    style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setLocalFotos(prev => {
                        const next = prev.filter((_, i) => i !== fotoActiva);
                        setFotoActiva(a => Math.max(0, Math.min(a, next.length - 1)));
                        return next;
                      });
                    }}
                    sx={{
                      position: 'absolute', top: 6, right: 6,
                      bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  {localFotos.length > 1 && (
                    <Box sx={{
                      position: 'absolute', bottom: 6, right: 6,
                      bgcolor: 'rgba(0,0,0,0.6)', color: '#fff',
                      px: 1, py: 0.25, borderRadius: 1, fontSize: '0.7rem',
                    }}>
                      {fotoActiva + 1}/{localFotos.length}
                    </Box>
                  )}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                  {localFotos.map((url, i) => (
                    <Box
                      key={i}
                      onClick={() => setFotoActiva(i)}
                      sx={{
                        width: 54, height: 42, borderRadius: 1, overflow: 'hidden', cursor: 'pointer',
                        border: i === fotoActiva ? '2px solid' : '1px solid',
                        borderColor: i === fotoActiva ? PRIMARY : 'divider',
                      }}
                    >
                      <img src={url} alt={`mini ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  ))}
                  {localFotos.length < 6 && (
                    <Box
                      onClick={() => fileInputRef.current?.click()}
                      sx={{
                        width: 54, height: 42, borderRadius: 1, cursor: 'pointer',
                        border: '2px dashed', borderColor: 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'text.disabled',
                      }}
                    >
                      +
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{
                border: '2px dashed', borderColor: 'divider', borderRadius: 1.5,
                py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
                bgcolor: 'action.hover',
              }}>
                <ImageIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">Adjuntá una foto — {fotoLabel.toLowerCase()}</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" startIcon={<ImageIcon />}
                    onClick={() => fileInputRef.current?.click()} sx={{ borderColor: PRIMARY, color: PRIMARY }}>
                    Desde archivo
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<PhotoCameraIcon />}
                    onClick={() => cameraInputRef.current?.click()} sx={{ borderColor: PRIMARY, color: PRIMARY }}>
                    Cámara
                  </Button>
                  <Button size="small" variant="outlined" onClick={toggleQR} disabled={tokenLoading}
                    sx={{ borderColor: '#78350f', color: '#78350f' }}>
                    {tokenLoading ? '…' : showQR ? 'Ocultar QR' : '📱 QR'}
                  </Button>
                </Stack>

                {uploadError && (
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: hayFotosQR ? '#16a34a' : 'warning.main', fontWeight: hayFotosQR ? 600 : 400 }}>
                    {uploadError}
                  </Typography>
                )}

                {showQR && uploadToken && (
                  <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e7e5e4', textAlign: 'center' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(uploadToken.uploadUrl)}`}
                      alt="QR para subir foto"
                      style={{ width: 130, height: 130, display: 'block', margin: '0 auto' }}
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.5, display: 'block' }}>
                      Escaneá para subir desde el celular
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', display: 'block' }}>
                      Vence: {new Date(uploadToken.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
          {/* inputs ocultos */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
          <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
              {localUpdatedAt ? `Última modificación: ${fmtDate(localUpdatedAt)}` : 'Sin modificaciones previas'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
              <Button size="small" variant="contained"
                onClick={() => {
                  const now = new Date().toISOString();
                  setLocalUpdatedAt(now);
                  onSave(notas, localFotos, now, construirPrep());
                  onClose();
                }}
                sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}>
                Guardar notas
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
      {fotoParaEditar && (
        <EditorFotoModal
          imagenSrc={fotoParaEditar}
          onConfirmar={(recortada) => {
            setLocalFotos(prev => {
              const next = [...prev, recortada].slice(0, 6); // suma al array, tope 6
              setFotoActiva(next.length - 1); // mostrar la recién agregada
              return next;
            });
            setFotoParaEditar(null);
          }}
          onCancelar={() => setFotoParaEditar(null)}
        />
      )}
    </>
  );
}
