// src/componentes/UploadArticulosModal.jsx
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, LinearProgress, Alert, Box, Typography,
  IconButton, Stack, Table, TableHead, TableBody,
  TableRow, TableCell, Select, MenuItem, FormControl,
  Chip, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import CloudUploadIcon    from '@mui/icons-material/CloudUpload';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import ErrorIcon          from '@mui/icons-material/Error';
import CloseIcon          from '@mui/icons-material/Close';
import PointOfSaleIcon    from '@mui/icons-material/PointOfSale';
import CategoryIcon       from '@mui/icons-material/Category';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import { BASE } from '../servicios/apiBase';

// ─── Roles para artículos ─────────────────────────────────────────────────────
const ROLES_ART = [
  { value: 'ignorar',  label: '— Ignorar —',   color: '#94a3b8', bg: '#f1f5f9' },
  { value: 'codigo',   label: '✓ Código',       color: '#166534', bg: '#dcfce7' },
  { value: 'nombre',   label: '✓ Nombre',       color: '#1e40af', bg: '#dbeafe' },
  { value: 'precio',   label: '✓ Precio',       color: '#7c3aed', bg: '#ede9fe' },
  { value: 'rubro',    label: '○ Rubro/Cat.',   color: '#92400e', bg: '#fef3c7' },
  { value: 'subrubro', label: '○ Subrubro',     color: '#065f46', bg: '#d1fae5' },
];

// Roles para rubros (mucho más simple)
const ROLES_RUB = [
  { value: 'ignorar', label: '— Ignorar —',      color: '#94a3b8', bg: '#f1f5f9' },
  { value: 'codigo',  label: '✓ Código de rubro', color: '#166534', bg: '#dcfce7' },
  { value: 'nombre',  label: '✓ Nombre de rubro', color: '#1e40af', bg: '#dbeafe' },
];

function getRoles(tipo) {
  return tipo === 'rubros' ? ROLES_RUB : ROLES_ART;
}

function roleInfo(tipo, rol) {
  return getRoles(tipo).find(r => r.value === rol) || getRoles(tipo)[0];
}

// Detectar rol inicial por nombre de columna
function detectarRol(col, tipo) {
  const c = col.toLowerCase().replace(/[\s_]/g, '');
  if (['codigo', 'code', 'codarticulo', 'codrua', 'codru'].includes(c)) return 'codigo';
  if (['nombre', 'name', 'descripcion', 'descripción'].includes(c))      return 'nombre';
  if (tipo === 'articulos') {
    if (['precio1', 'precio', 'price', 'precioventa'].includes(c))        return 'precio';
    if (['rubro', 'categoria', 'categoría'].includes(c))                  return 'rubro';
    if (['subrubro', 'subcategoria'].includes(c))                         return 'subrubro';
  }
  return 'ignorar';
}

function fmtVal(v) {
  if (v == null || v === '') return <span style={{ color: '#cbd5e1' }}>—</span>;
  const s = String(v);
  return s.length > 20 ? s.slice(0, 20) + '…' : s;
}

function useTheme() {
  return React.useMemo(() => {
    if (typeof window === 'undefined') return { primary: '#1976d2', secondary: '#10b981', onPrimary: '#fff' };
    const s = getComputedStyle(document.documentElement);
    return {
      primary:   s.getPropertyValue('--color-primary')?.trim()   || '#1976d2',
      secondary: s.getPropertyValue('--color-secondary')?.trim() || '#10b981',
      onPrimary: s.getPropertyValue('--on-primary')?.trim()      || '#ffffff',
    };
  }, []);
}

// ─── Paso 1: elegir tipo + drop zone ─────────────────────────────────────────
function StepSeleccionar({ tipo, onTipo, onFile, themeColors }) {
  const [dragging, setDragging] = useState(false);
  const pick = (f) => { if (f) onFile(f); };

  return (
    <Box sx={{ py: 1 }}>
      {/* Selector de tipo */}
      <Typography variant="caption" fontWeight={700} color="text.secondary"
        sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        ¿Qué vas a importar?
      </Typography>
      <ToggleButtonGroup
        value={tipo} exclusive onChange={(_, v) => v && onTipo(v)}
        sx={{ mb: 2.5, width: '100%' }}
      >
        <ToggleButton value="articulos" sx={{ flex: 1, gap: 1, py: 1.25,
          '&.Mui-selected': { bgcolor: `${themeColors.primary}15`, color: themeColors.primary,
            borderColor: themeColors.primary, fontWeight: 700 } }}>
          <PointOfSaleIcon fontSize="small" />
          <Box textAlign="left">
            <Typography variant="body2" fontWeight={600}>Artículos</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Listado completo del catálogo
            </Typography>
          </Box>
        </ToggleButton>
        <ToggleButton value="rubros" sx={{ flex: 1, gap: 1, py: 1.25,
          '&.Mui-selected': { bgcolor: `${themeColors.primary}15`, color: themeColors.primary,
            borderColor: themeColors.primary, fontWeight: 700 } }}>
          <CategoryIcon fontSize="small" />
          <Box textAlign="left">
            <Typography variant="body2" fontWeight={600}>Rubros / Categorías</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Tabla de rubros con códigos y nombres
            </Typography>
          </Box>
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Descripción contextual */}
      <Alert severity="info" sx={{ mb: 2, fontSize: '0.78rem', py: 0.75 }}>
        {tipo === 'articulos'
          ? <>Subí el listado de artículos. Vas a poder asignar qué columna es el Código, el Nombre y el Precio.</>
          : <>Subí la tabla de rubros (CODIGO + NOMBRE). Se van a cruzar automáticamente con los artículos ya cargados para reemplazar los códigos numéricos por nombres reales.</>
        }
      </Alert>

      {/* Drop zone */}
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer?.files?.[0]); }}
        onClick={() => document.getElementById('art-file-input').click()}
        sx={{
          border: `2px dashed ${dragging ? themeColors.secondary : themeColors.primary}`,
          borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
          bgcolor: dragging ? `${themeColors.secondary}10` : `${themeColors.primary}08`,
          transition: 'all 0.2s',
          '&:hover': { bgcolor: `${themeColors.primary}14` },
        }}
      >
        {tipo === 'articulos'
          ? <PointOfSaleIcon sx={{ fontSize: 44, color: themeColors.primary, mb: 1 }} />
          : <CategoryIcon    sx={{ fontSize: 44, color: themeColors.primary, mb: 1 }} />
        }
        <Typography variant="h6" sx={{ color: themeColors.primary }} fontWeight="medium" gutterBottom>
          Seleccioná o arrastrá tu archivo
        </Typography>
        <Typography variant="caption" color="text.secondary">CSV · XLS · XLSX</Typography>
        <input id="art-file-input" type="file" accept=".csv,.xls,.xlsx"
          style={{ display: 'none' }}
          onChange={(e) => pick(e.target.files?.[0])} />
      </Box>
    </Box>
  );
}

// ─── Paso 2: mapeo de columnas ────────────────────────────────────────────────
function StepColumnas({ tipo, file, columnas, muestra, mapeo, onChange, themeColors, destino, onDestino }) {
  const roles   = Object.values(mapeo);
  const tieneC  = roles.includes('codigo');
  const tieneN  = roles.includes('nombre');
  const tieneP  = roles.includes('precio');

  const chips = tipo === 'articulos'
    ? [
        { ok: tieneC, label: tieneC ? '✓ Código'  : '⚠ Sin Código',  bg: tieneC ? '#dcfce7' : '#fee2e2', color: tieneC ? '#166534' : '#b91c1c' },
        { ok: tieneN, label: tieneN ? '✓ Nombre'  : '⚠ Sin Nombre',  bg: tieneN ? '#dbeafe' : '#fee2e2', color: tieneN ? '#1e40af' : '#b91c1c' },
        { ok: tieneP, label: tieneP ? '✓ Precio'  : '○ Sin Precio',  bg: tieneP ? '#ede9fe' : '#f1f5f9', color: tieneP ? '#7c3aed' : '#94a3b8' },
      ]
    : [
        { ok: tieneC, label: tieneC ? '✓ Código de rubro' : '⚠ Sin Código', bg: tieneC ? '#dcfce7' : '#fee2e2', color: tieneC ? '#166534' : '#b91c1c' },
        { ok: tieneN, label: tieneN ? '✓ Nombre de rubro' : '⚠ Sin Nombre', bg: tieneN ? '#dbeafe' : '#fee2e2', color: tieneN ? '#1e40af' : '#b91c1c' },
      ];

  return (
    <Box>
      {/* Header archivo */}
      <Box sx={{ mb: 1.5, p: 1.25, bgcolor: `${themeColors.primary}08`, borderRadius: 1.5,
        border: `1px solid ${themeColors.primary}20`, display: 'flex', alignItems: 'center', gap: 1 }}>
        {tipo === 'articulos'
          ? <PointOfSaleIcon sx={{ fontSize: 16, color: themeColors.primary }} />
          : <CategoryIcon    sx={{ fontSize: 16, color: themeColors.primary }} />
        }
        <Typography variant="body2" fontWeight={600} sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </Typography>
        <Chip size="small" label={tipo === 'articulos' ? 'Artículos' : 'Rubros'}
          sx={{ fontSize: '0.65rem', height: 18, bgcolor: `${themeColors.primary}15`, color: themeColors.primary }} />
      </Box>

      {/* Selector de destino — solo para rubros */}
      {tipo === 'rubros' && (
        <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary"
            sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ¿Dónde guardar estos datos en los artículos?
          </Typography>
          <Stack direction="row" spacing={1}>
            {[
              { value: 'categoria', label: '📂 Rubro',     desc: 'Campo principal de agrupación' },
              { value: 'subrubro',  label: '📁 Subrubro', desc: 'Nivel secundario de agrupación' },
            ].map(opt => (
              <Box key={opt.value} onClick={() => onDestino(opt.value)}
                sx={{
                  flex: 1, p: 1.25, borderRadius: 1.5, cursor: 'pointer',
                  border: `2px solid ${destino === opt.value ? themeColors.primary : '#e2e8f0'}`,
                  bgcolor: destino === opt.value ? `${themeColors.primary}10` : '#fff',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: themeColors.primary },
                }}>
                <Typography variant="body2" fontWeight={700}
                  sx={{ color: destino === opt.value ? themeColors.primary : '#374151', fontSize: '0.78rem' }}>
                  {opt.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {opt.desc}
                </Typography>
              </Box>
            ))}
          </Stack>
          {destino === 'subrubro' && (
            <Alert severity="info" sx={{ mt: 1, py: 0.5, fontSize: '0.72rem' }}>
              Los códigos numéricos en la columna <strong>subrubro</strong> de los artículos se reemplazarán por estos nombres.
            </Alert>
          )}
        </Box>
      )}

      {/* Estado del mapeo */}
      <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
        {chips.map((c, i) => (
          <Chip key={i} size="small" label={c.label}
            sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: '0.7rem' }} />
        ))}
      </Stack>

      <Typography variant="caption" fontWeight={700} color="text.secondary"
        sx={{ display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Asigná el rol de cada columna
      </Typography>

      {/* Tabla con selectores */}
      <Box sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 1.5, mb: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              {columnas.map(col => {
                const rol  = mapeo[col] || 'ignorar';
                const info = roleInfo(tipo, rol);
                return (
                  <TableCell key={col} sx={{ py: 0.75, px: 1, verticalAlign: 'top',
                    borderRight: '1px solid #f1f5f9', minWidth: 130 }}>
                    <Typography variant="caption" sx={{
                      display: 'block', fontFamily: 'monospace', color: '#64748b',
                      fontSize: '0.63rem', mb: 0.5, whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </Typography>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={rol}
                        onChange={(e) => onChange(col, e.target.value)}
                        sx={{
                          fontSize: '0.68rem', fontWeight: 600, bgcolor: info.bg,
                          color: info.color, height: 26,
                          '.MuiOutlinedInput-notchedOutline': { borderColor: `${info.color}40` },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: info.color },
                          '.MuiSelect-select': { py: '3px', pr: '22px !important' },
                          '.MuiSvgIcon-root': { fontSize: 15, color: info.color },
                        }}
                      >
                        {getRoles(tipo).map(r => (
                          <MenuItem key={r.value} value={r.value}
                            sx={{ fontSize: '0.7rem', fontWeight: r.value === 'ignorar' ? 400 : 600, color: r.color }}>
                            {r.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {muestra.map((row, i) => (
              <TableRow key={i} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                {columnas.map(col => {
                  const rol  = mapeo[col] || 'ignorar';
                  const info = roleInfo(tipo, rol);
                  const ign  = rol === 'ignorar';
                  return (
                    <TableCell key={col} sx={{
                      fontSize: '0.7rem', py: 0.5, px: 1,
                      borderRight: '1px solid #f8fafc',
                      color: ign ? '#cbd5e1' : '#1e293b',
                      bgcolor: ign ? 'transparent' : `${info.bg}55`,
                      maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {fmtVal(row[col])}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Typography variant="caption" color="text.secondary">
        Vista previa de las primeras {muestra.length} filas. Columnas en gris se ignorarán.
      </Typography>

      {(!tieneC || !tieneN) && (
        <Alert severity="warning" sx={{ mt: 1.5, py: 0.5, fontSize: '0.75rem' }}>
          Asigná al menos <strong>Código</strong> y <strong>Nombre</strong> para poder importar.
        </Alert>
      )}
    </Box>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function UploadArticulosModal({ open, onClose, businessId, onSuccess }) {
  const themeColors = useTheme();

  const [tipo,      setTipo]      = useState('articulos'); // 'articulos' | 'rubros'
  const [step,      setStep]      = useState('select');    // 'select'|'columns'|'uploading'|'done'|'error'
  const [file,      setFile]      = useState(null);
  const [columnas,  setColumnas]  = useState([]);
  const [muestra,   setMuestra]   = useState([]);
  const [mapeo,     setMapeo]     = useState({});
  const [destino,   setDestino]   = useState('categoria'); // 'categoria' | 'subrubro'
  const [analyzing, setAnalyzing] = useState(false);
  const [progress,  setProgress]  = useState(null);
  const [error,     setError]     = useState(null);

  const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

  const reset = () => {
    setStep('select'); setFile(null); setColumnas([]); setMuestra([]);
    setMapeo({}); setDestino('categoria'); setAnalyzing(false); setProgress(null); setError(null);
  };

  const handleClose = () => {
    if (step === 'uploading') return;
    if (step === 'done' && onSuccess) onSuccess();
    reset();
    onClose();
  };

  const handleFile = useCallback(async (f) => {
    setFile(f);
    setError(null);
    setAnalyzing(true);

    try {
      const fd = new FormData();
      fd.append('file', f);
      // Usamos el mismo endpoint de preview — funciona para ambos tipos
      const res  = await fetch(`${BASE}/businesses/${businessId}/articles/preview-columns`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudieron leer las columnas');

      const cols = data.columnas || [];

      // Mapeo inicial: detectar roles automáticamente según tipo
      const mapeoInicial = {};
      const usados = {};
      for (const col of cols) {
        let rol = detectarRol(col, tipo);
        // No duplicar roles
        if (rol !== 'ignorar' && usados[rol]) rol = 'ignorar';
        if (rol !== 'ignorar') usados[rol] = true;
        mapeoInicial[col] = rol;
      }

      setColumnas(cols);
      setMuestra(data.muestra || []);
      setMapeo(mapeoInicial);
      setStep('columns');
    } catch (e) {
      setError(e.message);
      setStep('error');
    } finally {
      setAnalyzing(false);
    }
  }, [businessId, tipo]);

  const handleChangeRol = (col, rol) => {
    setMapeo(prev => {
      const next = { ...prev };
      // Liberar si el rol ya estaba en otra columna
      if (rol !== 'ignorar') {
        for (const [k, v] of Object.entries(next)) {
          if (v === rol && k !== col) next[k] = 'ignorar';
        }
      }
      next[col] = rol;
      return next;
    });
  };

  const handleImport = async () => {
    setStep('uploading');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapeo', JSON.stringify(mapeo));
      if (tipo === 'rubros') fd.append('destino', destino);

      // Endpoint diferente según tipo
      const endpoint = tipo === 'rubros'
        ? `${BASE}/businesses/${businessId}/articles/import-rubros-csv`
        : `${BASE}/businesses/${businessId}/articles/import-csv`;

      const res  = await fetch(endpoint, { method: 'POST', headers: authH(), body: fd });
      const data = await res.json();

      if (data.ok || res.ok) {
        const s = data.summary || data;
        setProgress({
          inserted: Number(s.inserted ?? 0),
          updated:  Number(s.updated  ?? 0),
          total:    Number(s.total_rows ?? s.total ?? 0),
          failed:   Number(s.failed   ?? 0),
          articulosActualizados: Number(data.articulosActualizados ?? 0),
        });
        setStep('done');
        window.dispatchEvent(new CustomEvent('articulos:batch:changed', { detail: { businessId } }));
      } else {
        throw new Error(data.message || data.error || 'Error al importar');
      }
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const roles      = Object.values(mapeo);
  const puedeImp   = roles.includes('codigo') && roles.includes('nombre');

  const titles = {
    select:    'Importar desde archivo',
    columns:   tipo === 'rubros' ? 'Importar rubros' : 'Importar artículos',
    uploading: 'Importando...',
    done:      '✓ Importación completada',
    error:     'Error al importar',
  };

  return (
    <Dialog open={open} onClose={handleClose}
      maxWidth={step === 'columns' ? 'lg' : 'sm'} fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}>

      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            {tipo === 'rubros'
              ? <CategoryIcon    sx={{ color: themeColors.primary }} />
              : <PointOfSaleIcon sx={{ color: themeColors.primary }} />
            }
            <Typography variant="h6" fontWeight={700}>{titles[step]}</Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={step === 'uploading'} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 2 }}>

        {step === 'select' && !analyzing && (
          <StepSeleccionar
            tipo={tipo} onTipo={(t) => { setTipo(t); }}
            onFile={handleFile} themeColors={themeColors}
          />
        )}

        {analyzing && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
            <Typography variant="body2" color="text.secondary">Analizando columnas…</Typography>
          </Box>
        )}

        {step === 'columns' && (
          <StepColumnas
            tipo={tipo} file={file} columnas={columnas} muestra={muestra}
            mapeo={mapeo} onChange={handleChangeRol} themeColors={themeColors}
            destino={destino} onDestino={setDestino}
          />
        )}

        {step === 'uploading' && (
          <Box sx={{ py: 4 }}>
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              {tipo === 'rubros' ? 'Importando rubros…' : 'Procesando artículos…'}
            </Typography>
            <LinearProgress sx={{ height: 8, borderRadius: 1,
              '& .MuiLinearProgress-bar': { bgcolor: themeColors.primary } }} />
          </Box>
        )}

        {step === 'done' && progress && (
          <Box sx={{ py: 1 }}>
            <Alert severity="success" icon={<CheckCircleIcon />}
              sx={{ bgcolor: `${themeColors.secondary}15`, '& .MuiAlert-icon': { color: themeColors.secondary } }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {tipo === 'rubros' ? 'Rubros importados' : 'Importación completada'}
              </Typography>
              <Typography variant="body2">
                <strong style={{ color: '#166534' }}>+{progress.inserted}</strong> nuevos ·{' '}
                <strong>{progress.updated}</strong> actualizados
                {progress.failed > 0 && <span style={{ color: '#d32f2f' }}> · ⚠️ {progress.failed} fallidos</span>}
              </Typography>
              {tipo === 'rubros' && progress.articulosActualizados > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  🔗 {progress.articulosActualizados} artículos actualizados con nombres de categoría
                </Typography>
              )}
              {progress.total > 0 && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Total: {progress.total} filas procesadas
                </Typography>
              )}
            </Alert>
          </Box>
        )}

        {step === 'error' && (
          <Box sx={{ py: 1 }}>
            <Alert severity="error" icon={<ErrorIcon />}>
              <Typography variant="body2" fontWeight={600}>Error</Typography>
              <Typography variant="body2">{error}</Typography>
            </Alert>
            <Button sx={{ mt: 2 }} size="small" startIcon={<ArrowBackIcon />} onClick={reset}>
              Volver a intentar
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        {step === 'done' ? (
          <Button onClick={handleClose} variant="contained" fullWidth
            sx={{ bgcolor: themeColors.secondary, color: themeColors.onPrimary,
              '&:hover': { filter: 'brightness(0.9)' } }}>
            ✓ Cerrar
          </Button>
        ) : step === 'columns' ? (
          <>
            <Button onClick={reset} variant="text" color="inherit" startIcon={<ArrowBackIcon />}
              sx={{ color: 'text.secondary' }}>
              Cambiar archivo
            </Button>
            <Button onClick={handleImport} variant="contained"
              startIcon={<CloudUploadIcon />} size="large"
              disabled={!puedeImp}
              sx={{ bgcolor: themeColors.primary, color: themeColors.onPrimary,
                '&:hover': { filter: 'brightness(0.9)' } }}>
              {tipo === 'rubros' ? 'Importar rubros' : 'Importar artículos'}
            </Button>
          </>
        ) : step !== 'uploading' && step !== 'error' ? (
          <Button onClick={handleClose} variant="outlined"
            sx={{ borderColor: 'text.secondary', color: 'text.secondary' }}>
            Cancelar
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}