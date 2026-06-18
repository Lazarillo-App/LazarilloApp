/* eslint-disable no-unused-vars */
// src/componentes/configuracion/ConfigArticulosTab.jsx
import React from 'react';
import {
  Grid, Stack, Tabs, Tab, Box, Button, Typography, Alert,
  TextField, InputAdornment, Chip, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import TuneIcon from '@mui/icons-material/Tune';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import PercentIcon from '@mui/icons-material/Percent';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LotesPanel from './LotesPanel';
import LotesPanelArticulos from './LotesPanelArticulos';
import DeleteRecetasModal from './DeleteRecetasModal';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

function Card({ children, accent }) {
  const tc = 'var(--color-primary, #3b82f6)';
  return (
    <Box sx={{
      borderRadius: 2.5, overflow: 'hidden', height: '100%',
      border: `1px solid ${accent ? `${tc}30` : '#e8eaf0'}`,
      bgcolor: 'background.paper',
    }}>
      {children}
    </Box>
  );
}

function CardHeader({ icon, title, subtitle, accent }) {
  const tc = 'var(--color-primary, #3b82f6)';
  return (
    <Box sx={{
      px: 2.5, py: 1.75, borderBottom: '1px solid #f0f0f0',
      bgcolor: accent ? `${tc}05` : 'transparent',
      display: 'flex', alignItems: 'center', gap: 1.25,
    }}>
      {icon && React.cloneElement(icon, { sx: { color: tc, fontSize: 17 } })}
      <Box>
        <Typography fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>{subtitle}</Typography>}
      </Box>
    </Box>
  );
}

function CardBody({ children }) {
  return <Box sx={{ p: 2.5 }}>{children}</Box>;
}

function ChipsRedondeo({ value, savedValue, onChange }) {
  const tc = 'var(--color-primary, #3b82f6)';
  const OPTS = [2, 5, 10, 20, 50, 100, 500, 1000];
  // Normalizar a número para comparación estricta (el valor de DB puede llegar como string)
  const valueNum = value != null ? Number(value) : null;
  const savedValueNum = savedValue != null ? Number(savedValue) : null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {OPTS.map(op => {
        const isSaved = savedValueNum === op;
        const isSelected = valueNum === op;
        return (
          <Box key={op} sx={{ position: 'relative' }}>
            <Chip label={`$${op}`} size="small"
              onClick={() => onChange(op === value ? null : op)}
              sx={{
                cursor: 'pointer', height: 26, fontSize: '0.78rem',
                fontWeight: isSelected ? 700 : 400,
                bgcolor: isSelected ? tc : 'transparent',
                color: isSelected ? '#fff' : 'text.secondary',
                border: `1.5px solid ${isSelected ? tc : isSaved ? `${tc}70` : '#dde1ea'}`,
                '&:hover': { bgcolor: isSelected ? tc : `${tc}12` },
              }} />
            {/* Punto indicador del valor guardado */}
            {isSaved && !isSelected && (
              <Box sx={{
                position: 'absolute', top: -3, right: -3,
                width: 8, height: 8, borderRadius: '50%',
                bgcolor: tc, border: '1.5px solid #fff',
              }} />
            )}
          </Box>
        );
      })}
      {/* Sin redondeo */}
      <Box sx={{ position: 'relative' }}>
        <Chip label="Sin redondeo" size="small"
          onClick={() => onChange(null)}
          sx={{
            cursor: 'pointer', height: 26, fontSize: '0.78rem',
            fontWeight: valueNum == null ? 700 : 400,
            bgcolor: valueNum == null ? '#64748b' : 'transparent',
            color: valueNum == null ? '#fff' : 'text.secondary',
            border: `1.5px solid ${valueNum == null ? '#64748b' : savedValueNum == null ? '#64748b70' : '#dde1ea'}`,
            '&:hover': { bgcolor: valueNum == null ? '#64748b' : '#f1f5f9' },
          }} />
        {savedValueNum == null && valueNum != null && (
          <Box sx={{
            position: 'absolute', top: -3, right: -3,
            width: 8, height: 8, borderRadius: '50%',
            bgcolor: '#64748b', border: '1.5px solid #fff',
          }} />
        )}
      </Box>
    </Box>
  );
}

function PrimaryBtn({ icon, label, onClick, tc }) {
  const color = tc || 'var(--color-primary, #3b82f6)';
  return (
    <Button variant="contained" size="small" startIcon={icon} onClick={onClick}
      sx={{
        bgcolor: color, color: '#fff', fontWeight: 600, fontSize: '0.82rem',
        px: 2, py: 0.9, borderRadius: 1.5, boxShadow: 'none',
        '&:hover': { bgcolor: color, filter: 'brightness(0.9)', boxShadow: 'none' },
      }}>
      {label}
    </Button>
  );
}

function ActionRow({ icon, title, desc, children }) {
  const tc = 'var(--color-primary, #3b82f6)';
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 2, py: 1.75, '& + &': { borderTop: '1px solid #f3f4f6' },
    }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
          bgcolor: `${tc}10`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {React.cloneElement(icon, { sx: { fontSize: 17, color: tc } })}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={600} sx={{ fontSize: '0.82rem' }}>{title}</Typography>
          {desc && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{desc}</Typography>}
        </Box>
      </Stack>
      <Box sx={{ flexShrink: 0 }}>{children}</Box>
    </Box>
  );
}

function HowItWorks({ steps, tc }) {
  return (
    <Stack spacing={1.5}>
      {steps.map(({ n, t, d }) => (
        <Stack key={n} direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.1,
            bgcolor: `${tc}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: tc }}>{n}</Typography>
          </Box>
          <Box>
            <Typography fontWeight={600} sx={{ fontSize: '0.78rem' }}>{t}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{d}</Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

export default function ConfigArticulosTab({
  subTab = 0, setSubTab,
  config = {},
  setConfig,
  saving = {},
  saveConfig,
  saveRedondeo,
  allBusinesses,
  businessId,
  onNuevoArticulo,
  onUploadArticulos,
  abrirEquivalencias,
  themeColor,
  mostrarModalRedondeo = true,
  onToggleMostrarModal,
}) {
  const tc = themeColor || 'var(--color-primary, #3b82f6)';
  const [confirmDlg, setConfirmDlg] = React.useState(null);
  // Valor guardado en DB — para el indicador visual del chip activo
  const [savedRedondeo, setSavedRedondeo] = React.useState(config?.redondeo_precios ?? null);
  const [savedCostoIdeal, setSavedCostoIdeal] = React.useState(config?.articulos_costo_ideal ?? '');
  const [deleteRecetasOpen, setDeleteRecetasOpen] = React.useState(false);

  React.useEffect(() => {
    setSavedRedondeo(config?.redondeo_precios ?? null);
  }, [config?.redondeo_precios]);
  React.useEffect(() => { setSavedCostoIdeal(config?.articulos_costo_ideal ?? ''); }, [config?.articulos_costo_ideal]);

  const handleConfirm = () => {
    if (!confirmDlg) return;
    if (confirmDlg.type === 'costo_ideal') {
      saveConfig('articulos_costo_ideal');
      setSavedCostoIdeal(config.articulos_costo_ideal);
    } else if (confirmDlg.type === 'redondeo') {
      saveRedondeo();
      setSavedRedondeo(config.redondeo_precios);
    }
    setConfirmDlg(null);
  }; return (
    <Box>
      <Tabs value={subTab ?? 0} onChange={(_, v) => setSubTab(v)} sx={{
        mb: 3, borderBottom: '1px solid #eee',
        '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: '0.85rem', px: 2, color: 'text.secondary' },
        '& .Mui-selected': { color: tc },
        '& .MuiTabs-indicator': { bgcolor: tc, height: 2 },
      }}>
        <Tab label="General" />
        <Tab label="Gestión de artículos" />
        <Tab label="Gestión de ventas" />
      </Tabs>

      {/* ── General ── */}
      {subTab === 0 && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card accent>
              <CardHeader icon={<RestaurantMenuIcon />} title="% costo ideal global" subtitle="Objetivo para recetas de artículos" accent />
              <CardBody>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                    Define el % de costo objetivo global. Se puede sobreescribir por agrupación, rubro o artículo individual.
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <TextField size="small" type="number"
                      value={config.articulos_costo_ideal}
                      onChange={e => setConfig(c => ({ ...c, articulos_costo_ideal: e.target.value }))}
                      inputProps={{ min: 0, max: 100, step: 0.5 }}
                      InputProps={{ endAdornment: <InputAdornment position="end"><PercentIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
                      sx={{ width: 120 }}
                    />
                    <Button variant="contained" size="small" disabled={!!saving.articulos_costo_ideal}
                      startIcon={saving.articulos_costo_ideal ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                      onClick={() => setConfirmDlg({
                        type: 'costo_ideal',
                        title: 'Guardar costo ideal global',
                        body: `Se establecerá ${config.articulos_costo_ideal}% como objetivo de costo para TODOS los artículos del negocio${savedCostoIdeal ? ` (actualmente: ${savedCostoIdeal}%)` : ''}.`,
                        detail: 'Esto reemplaza cualquier objetivo configurado por agrupación o rubro. Para objetivos específicos por bloque, usá la tabla de artículos.',
                        severity: 'warning',
                      })}
                      sx={{ bgcolor: tc, boxShadow: 'none', '&:hover': { bgcolor: tc, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                      {saving.articulos_costo_ideal ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </Stack>
                  {Number(config.articulos_costo_ideal) > 0 && (
                    <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem', borderRadius: 1.5 }}>
                      Con {config.articulos_costo_ideal}% → precio = Costo ÷ {(Number(config.articulos_costo_ideal) / 100).toFixed(2)}
                    </Alert>
                  )}
                </Stack>
              </CardBody>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader icon={<TuneIcon />} title="Redondeo de precios" subtitle="Al aplicar aumentos masivos" />
              <CardBody>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                    Elegí el múltiplo al que se redondean los precios al aplicar un porcentaje de aumento.
                  </Typography>
                  <ChipsRedondeo
                    value={config.redondeo_precios}
                    savedValue={savedRedondeo}
                    onChange={v => setConfig(c => ({ ...c, redondeo_precios: v }))}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <input
                      type="checkbox"
                      id="mostrar-modal-redondeo"
                      checked={!mostrarModalRedondeo}
                      onChange={(e) => onToggleMostrarModal?.(!e.target.checked)}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: tc }}
                    />
                    <label htmlFor="mostrar-modal-redondeo" style={{ fontSize: '0.8rem', cursor: 'pointer', color: '#555' }}>
                      No mostrar aviso al aplicar aumentos
                    </label>
                  </Box>
                  {config.redondeo_precios && (
                    <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem', borderRadius: 1.5 }}>
                      Los precios se redondean al múltiplo de <strong>${config.redondeo_precios}</strong> más cercano.
                    </Alert>
                  )}
                  <Divider />
                  <Button variant="contained" size="small" disabled={!!saving.redondeo}
                    startIcon={saving.redondeo ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                    onClick={() => setConfirmDlg({
                      type: 'redondeo',
                      title: 'Guardar redondeo',
                      body: config.redondeo_precios
                        ? `Se activará el redondeo a $${config.redondeo_precios}${savedRedondeo ? ` (actualmente: $${savedRedondeo})` : ''}.`
                        : `Se desactivará el redondeo de precios${savedRedondeo ? ` (actualmente: $${savedRedondeo})` : ''}.`,
                      detail: 'Esto afecta los aumentos masivos aplicados desde la tabla de artículos.',
                    })}
                    sx={{ alignSelf: 'flex-start', bgcolor: tc, boxShadow: 'none', '&:hover': { bgcolor: tc, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                    {saving.redondeo ? 'Guardando…' : 'Guardar redondeo'}
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader icon={<WarningAmberIcon />} title="Alerta de actualización de ventas" subtitle="Notificación cuando no hay datos recientes" />
              <CardBody>
                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }}>
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                      Si no hay ventas registradas hace más de N días, aparece una alerta en "Gestionar ventas" y en el ícono de configuración.
                    </Typography>
                    {Number(config.ventas_alerta_dias) > 0 && (
                      <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.78rem', borderRadius: 1.5 }}>
                        Alerta activa: sin ventas en los últimos <strong>{config.ventas_alerta_dias} días</strong>.
                      </Alert>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    <TextField size="small" type="number" label="Días sin datos"
                      value={config.ventas_alerta_dias}
                      onChange={e => setConfig(c => ({ ...c, ventas_alerta_dias: e.target.value }))}
                      inputProps={{ min: 1, max: 365, step: 1 }}
                      sx={{ width: 150 }}
                    />
                    <Button variant="contained" size="small" disabled={!!saving.ventas_alerta_dias}
                      startIcon={saving.ventas_alerta_dias ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                      onClick={() => saveConfig('ventas_alerta_dias')}
                      sx={{ bgcolor: tc, boxShadow: 'none', '&:hover': { bgcolor: tc, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                      {saving.ventas_alerta_dias ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </Stack>
                </Stack>
              </CardBody>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Gestión de artículos ── */}
      {subTab === 1 && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardHeader icon={<RestaurantMenuIcon />} title="Acciones" subtitle="Alta e importación de artículos" />
              <CardBody>
                <ActionRow icon={<AddIcon />} title="Nuevo artículo"
                  desc="Alta manual cuando el artículo no llegó de Maxi todavía. Se genera un SKU provisorio que se reemplaza al sincronizar.">
                  <PrimaryBtn icon={<AddIcon />} label="Nuevo artículo" onClick={onNuevoArticulo} tc={tc} />
                </ActionRow>
                <ActionRow icon={<DeleteForeverIcon />} title="Borrar recetas masivas"
                  desc="Borrá todas las recetas de artículos o las de una agrupación específica. Acción irreversible.">
                  <Button
                    variant="outlined" size="small" color="error"
                    startIcon={<DeleteForeverIcon />}
                    onClick={() => setDeleteRecetasOpen(true)}
                    sx={{ fontWeight: 600, fontSize: '0.82rem', px: 2, py: 0.9, borderRadius: 1.5 }}
                  >
                    Borrar recetas
                  </Button>
                </ActionRow>
              </CardBody>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardHeader icon={<TuneIcon />} title="¿Cómo funciona el SKU?" />
              <CardBody>
                <HowItWorks tc={tc} steps={[
                  { n: '1', t: 'Alta manual', d: 'Se genera LAZ-{biz}-{timestamp} como código provisorio.' },
                  { n: '2', t: 'Sync de Maxi', d: 'Busca coincidencias por nombre y precio al sincronizar.' },
                  { n: '3', t: 'Reconciliación', d: 'Si hay match, reemplaza el SKU por el código oficial.' },
                  { n: '4', t: 'Sin sync', d: 'Si no llega de Maxi, queda activo con el SKU de Lazarillo.' },
                ]} />
              </CardBody>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <LotesPanelArticulos businessId={businessId} />
          </Grid>
        </Grid>
      )}

      {/* ── Gestión de ventas ── */}
      {subTab === 2 && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardHeader icon={<CloudUploadIcon />} title="Importar ventas" subtitle="Cuando Maxi no sincroniza o para datos históricos" />
              <CardBody>
                <Stack spacing={2.5}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                    Subí un informe de ventas en CSV o Excel. El importador detecta las columnas y te guía para mapear las que no reconoce.
                  </Typography>

                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: `${tc}06`, border: `1px dashed ${tc}30` }}>
                    <Stack spacing={1.25}>
                      <Box>
                        <Typography fontWeight={600} sx={{ fontSize: '0.78rem', mb: 0.5 }}>Columnas requeridas</Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.5}>
                          {['Fecha', 'Código artículo', 'Unidades', 'Importe'].map(c => (
                            <Chip key={c} label={c} size="small" color="error" variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }} />
                          ))}
                        </Stack>
                      </Box>
                      <Box>
                        <Typography fontWeight={600} sx={{ fontSize: '0.78rem', mb: 0.5 }}>Columnas opcionales</Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.5}>
                          {['Nombre artículo', 'Costo', 'Neto'].map(c => (
                            <Chip key={c} label={c} size="small" variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem', color: 'text.secondary' }} />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>

                  <PrimaryBtn icon={<CloudUploadIcon />} label="Importar ventas" onClick={() => abrirEquivalencias('ventas')} tc={tc} />
                </Stack>
              </CardBody>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardHeader icon={<TuneIcon />} title="¿Cómo funciona?" />
              <CardBody>
                <HowItWorks tc={tc} steps={[
                  { n: '1', t: 'Subís el archivo', d: 'CSV o Excel exportado desde tu sistema de ventas.' },
                  { n: '2', t: 'Detección automática', d: 'El sistema identifica las columnas y muestra una vista previa.' },
                  { n: '3', t: 'Mapeo manual', d: 'Si falta una columna requerida, la asignás manualmente.' },
                  { n: '4', t: 'Importación', d: 'Los datos quedan disponibles en la tabla de artículos.' },
                ]} />
              </CardBody>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader icon={<ReceiptLongIcon />} title="Lotes de ventas importados" subtitle="Historial de importaciones" />
              <CardBody>
                <LotesPanel businessId={businessId} lotesTipo="ventas" allBusinesses={allBusinesses} />
              </CardBody>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Modal de borrado masivo de recetas */}
      <DeleteRecetasModal
        open={deleteRecetasOpen}
        onClose={() => setDeleteRecetasOpen(false)}
        businessId={businessId}
        tipo="articulo"
        themeColor={tc}
      />

      {/* Dialog de confirmación */}
      <Dialog open={!!confirmDlg} onClose={() => setConfirmDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', pb: 1 }}>
          {confirmDlg?.title}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">{confirmDlg?.body}</Typography>
            {confirmDlg?.detail && (
              <Alert severity={confirmDlg.severity || 'info'} sx={{ py: 0.5, fontSize: '0.78rem' }}>
                {confirmDlg.detail}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button size="small" color="inherit" onClick={() => setConfirmDlg(null)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={handleConfirm}
            sx={{ bgcolor: tc, boxShadow: 'none', '&:hover': { bgcolor: tc, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}