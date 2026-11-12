// src/componentes/RecetaModal/PanelGemelos.jsx
// Panel «Vincular receta con otro artículo» del modal de receta (gemelos = vinculación
// por receta). Movido tal cual desde index.jsx (12/11/2026) para achicar ese archivo;
// el estado y las acciones siguen viviendo en index.jsx y llegan por props.
import {
  Box, Typography, TextField, IconButton, CircularProgress, Chip, Tooltip, InputAdornment,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import { parseDecimal } from '@/utils/decimales';

export default function PanelGemelos({
  actualizarObjetivoGemelo, agregarGemelo, articulo, autoSave, buscarGemelos, esElaborado, gemelosGroup, gemelosLoading, gemelosOpen, gemelosPanelRef, gemelosResults, gemelosSearch, gemelosSearchRef, gemelosSearching, isStaff, promoMode, pushElaborado, quitarGemelo, setGemelosOpen, setGemelosResults, setGemelosSearch,
}) {
  return (
    <>
    {!esElaborado && !promoMode && (
      <Box ref={gemelosPanelRef} sx={{ flex: 1, minWidth: 260, display: isStaff ? 'none' : undefined }}>
        {/* Header colapsable */}
        <Box onClick={() => {
          setGemelosOpen(v => !v);
          if (!gemelosOpen) {
            setTimeout(() => gemelosSearchRef.current?.focus(), 50);
          }
        }}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            cursor: 'pointer', height: 40, boxSizing: 'border-box', px: 1, borderRadius: 1,
            bgcolor: gemelosGroup ? 'rgba(124,58,237,0.06)' : 'transparent',
            border: '1px solid', borderColor: gemelosGroup ? 'rgba(124,58,237,0.2)' : 'divider',
            '&:hover': { bgcolor: 'rgba(124,58,237,0.06)' }, transition: 'all .15s',
          }}>
          <Box sx={{ fontSize: 13, color: '#7c3aed' }}>🔗</Box>
          <Typography variant="caption" fontWeight={700} sx={{ color: '#7c3aed', fontSize: '0.75rem', flex: 1 }}>
            {gemelosGroup
              ? (() => {
                const otros = (gemelosGroup.members || []).filter(m => Number(m.article_id) !== Number(articulo?.id)).length;
                return `Gemelos (${otros} artículo${otros !== 1 ? 's' : ''} comparten esta receta)`;
              })()
              : 'Vincular receta con otro artículo'}
          </Typography>
          {gemelosLoading && <CircularProgress size={11} />}
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{gemelosOpen ? '▲' : '▼'}</Typography>
        </Box>
        {gemelosOpen && (
          <Box sx={{ mt: 0.75, border: '1px solid', borderColor: 'rgba(124,58,237,0.15)', borderRadius: 1, bgcolor: 'rgba(124,58,237,0.02)', overflow: 'visible' }}>

            {/* Header columnas */}
            <Box sx={{
              display: 'grid', gridTemplateColumns: '1fr 90px 28px',
              gap: 1, px: 1.25, pt: 0.75, pb: 0.25,
              borderBottom: '1px solid rgba(124,58,237,0.08)',
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Artículo
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                Objetivo %
              </Typography>
              <Box />
            </Box>

            {/* Buscador como primera línea */}
            <Box sx={{ px: 0.75, pt: 0.5 }}>
              <Box sx={{ position: 'relative' }}>
                <TextField
                  inputRef={gemelosSearchRef}
                  size="small"
                  fullWidth
                  placeholder="Buscar artículo para vincular…"
                  value={gemelosSearch}
                  onChange={e => {
                    setGemelosSearch(e.target.value);
                    if (e.target.value.length >= 1) buscarGemelos(e.target.value);
                    else setGemelosResults([]);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">
                      {gemelosSearching ? <CircularProgress size={12} /> : <SearchIcon sx={{ fontSize: 14, color: '#7c3aed' }} />}
                    </InputAdornment>,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1,
                      fontSize: '0.78rem',
                      bgcolor: '#fff',
                      minHeight: 32,
                      '& fieldset': { borderColor: 'rgba(124,58,237,0.2)' },
                    },
                  }}
                />
                {gemelosResults.length > 0 && (
                  <Box sx={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                    bgcolor: 'background.paper', border: '1px solid', borderColor: 'rgba(124,58,237,0.2)',
                    borderRadius: 1.5, boxShadow: 6, mt: 0.5, maxHeight: 200, overflowY: 'auto',
                  }}>
                    {gemelosResults.map(art => {
                      const yaGemelo = gemelosGroup?.members?.some(m => Number(m.article_id) === Number(art.id));
                      const tieneReceta = !!art.tiene_receta;
                      if (Number(art.id) === Number(articulo?.id)) return null;
                      return (
                        <Box key={art.id}
                          onClick={async () => {
                            if (yaGemelo || tieneReceta) return;
                            await agregarGemelo(art.id);
                            // Mantener el término escrito y refrescar resultados
                            // (el recién agregado pasa a verse como "✓" gracias a yaGemelo)
                            if (gemelosSearch.trim()) {
                              buscarGemelos(gemelosSearch);
                            }
                            gemelosSearchRef.current?.focus();
                          }}
                          sx={{
                            px: 1.5, py: 0.6, cursor: (yaGemelo || tieneReceta) ? 'default' : 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderBottom: '1px solid', borderColor: 'divider',
                            opacity: tieneReceta ? 0.5 : 1,
                            '&:hover': { bgcolor: (yaGemelo || tieneReceta) ? 'transparent' : 'rgba(124,58,237,0.06)' },
                          }}>
                          <Box sx={{ overflow: 'hidden' }}>
                            <Typography variant="body2" noWrap fontWeight={600} sx={{ fontSize: '0.78rem' }}>
                              {art.nombre || art.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                              #{art.id} {tieneReceta && '· Ya tiene receta propia'}
                            </Typography>
                          </Box>
                          <Chip
                            label={yaGemelo ? '✓' : tieneReceta ? 'Con receta' : '+ Vincular'}
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.62rem', ml: 1, flexShrink: 0,
                              bgcolor: tieneReceta ? '#fee2e2' : yaGemelo ? 'rgba(124,58,237,0.05)' : 'rgba(124,58,237,0.1)',
                              color: tieneReceta ? '#ef4444' : '#7c3aed',
                              border: `1px solid ${tieneReceta ? '#fecaca' : 'rgba(124,58,237,0.2)'}`,
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Gemelos actuales — DEBAJO del buscador */}
            <Box sx={{ px: 0.75, pt: 0.5, pb: 0.75 }}>
              {gemelosGroup?.members
                ?.filter(m => Number(m.article_id) !== Number(articulo?.id))
                .map(m => {
                  const objVal = m.pct_objetivo;
                  return (
                    <Box
                      key={m.article_id}
                      onClick={async () => {
                        await autoSave(); // guardar la receta padre antes de bajar en cascada
                        pushElaborado({
                          id: m.article_id,
                          nombre: m.nombre || `#${m.article_id}`,
                          precio: 0,
                          esArticulo: true,
                          pctObjetivo: m.pct_objetivo,
                        });
                      }}
                      sx={{
                        display: 'grid', gridTemplateColumns: '1fr 90px 28px',
                        alignItems: 'center', gap: 1,
                        py: 0.5, px: 0.5, borderRadius: 1, mb: 0.35,
                        bgcolor: '#fff',
                        border: '1px solid #eaecf0',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        '&:hover': {
                          bgcolor: 'rgba(124,58,237,0.04)',
                          borderColor: 'rgba(124,58,237,0.3)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                        <Typography variant="caption" sx={{
                          fontSize: '0.63rem', color: 'text.disabled', flexShrink: 0,
                          bgcolor: '#f1f5f9', px: 0.5, py: '1px', borderRadius: 0.5,
                        }}>
                          #{m.article_id}
                        </Typography>
                        <Typography
                          variant="caption" noWrap
                          sx={{
                            fontSize: '0.78rem', fontWeight: 500,
                            color: 'text.primary', flex: 1, minWidth: 0,
                          }}
                        >
                          {m.nombre || `Artículo #${m.article_id}`}
                        </Typography>
                        {m.auto && (
                          <Tooltip title="Vinculada sola: tenía exactamente la misma receta. Desvincularla le deja su receta." disableInteractive>
                            <Typography component="span" sx={{
                              flexShrink: 0, fontSize: '0.62rem', fontWeight: 700, lineHeight: '16px',
                              px: 0.6, borderRadius: 0.75, color: '#7c3aed',
                              bgcolor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
                            }}>
                              🔗 auto
                            </Typography>
                          </Tooltip>
                        )}
                      </Box>

                      <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}
                      >
                        <TextField
                          size="small"
                          type="text"
                          inputMode="decimal"
                          defaultValue={objVal != null ? String(objVal).replace('.', ',') : ''}
                          placeholder="—"
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const nuevo = raw === '' ? null : parseDecimal(raw);
                            const anterior = objVal;
                            // Solo persistir si cambió realmente
                            if (nuevo === anterior) return;
                            if (nuevo != null && (!Number.isFinite(nuevo) || nuevo < 0 || nuevo > 150)) return;
                            actualizarObjetivoGemelo(m.article_id, nuevo);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.target.blur();
                            }
                            if (e.key === 'Escape') {
                              e.target.value = objVal != null ? objVal : '';
                              e.target.blur();
                            }
                          }}
                          inputProps={{
                            min: 0,
                            max: 150,
                            style: {
                              textAlign: 'center',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              padding: '2px 4px',
                              width: 44,
                            },
                          }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end" sx={{ ml: 0, '& .MuiTypography-root': { fontSize: '0.72rem' } }}>
                                %
                              </InputAdornment>
                            ),
                            sx: {
                              fontSize: '0.78rem',
                              bgcolor: '#fff',
                              '& fieldset': { borderColor: 'transparent' },
                              '&:hover fieldset': { borderColor: 'rgba(124,58,237,0.3) !important' },
                              '&.Mui-focused fieldset': { borderColor: 'rgba(124,58,237,0.5) !important' },
                            },
                          }}
                        />
                      </Box>

                      <Tooltip title="Desvincular">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            quitarGemelo(m.article_id);
                          }}
                          sx={{ p: '2px', color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  );
                })}
            </Box>

          </Box>
        )}
      </Box>
    )}
    </>
  );
}
