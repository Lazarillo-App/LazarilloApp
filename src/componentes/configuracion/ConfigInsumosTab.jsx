// src/componentes/configuracion/ConfigInsumosTab.jsx
import React from 'react';
import {
  Grid, Stack, Tabs, Tab, Box, Button, Typography, Alert,
  TextField, InputAdornment, Chip, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import TuneIcon from '@mui/icons-material/Tune';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import PercentIcon from '@mui/icons-material/Percent';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LotesPanel from './LotesPanel';
import LotesPanelInsumos from './LotesPanelInsumos';
import CategoryIcon from '@mui/icons-material/Category';
import DeleteRecetasModal from './DeleteRecetasModal';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

/* ─── Componentes de layout (espejo exacto de ConfigArticulosTab) ─── */
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

function CardHeader({ icon, title, subtitle, accent, action }) {
  const tc = 'var(--color-primary, #3b82f6)';
  return (
    <Box sx={{
      px: 2.5, py: 1.75, borderBottom: '1px solid #f0f0f0',
      bgcolor: accent ? `${tc}05` : 'transparent',
      display: 'flex', alignItems: 'center', gap: 1.25,
    }}>
      {icon && React.cloneElement(icon, { sx: { color: tc, fontSize: 17 } })}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

function CardBody({ children }) {
  return <Box sx={{ p: 2.5 }}>{children}</Box>;
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

function ColChips({ requeridas, opcionales }) {
  const tc = 'var(--color-primary, #3b82f6)';
  return (
    <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: `${tc}06`, border: `1px dashed ${tc}30` }}>
      <Stack spacing={1.25}>
        <Box>
          <Typography fontWeight={600} sx={{ fontSize: '0.78rem', mb: 0.5 }}>Columnas requeridas</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {requeridas.map(c => (
              <Chip key={c} label={c} size="small" color="error" variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }} />
            ))}
          </Stack>
        </Box>
        <Box>
          <Typography fontWeight={600} sx={{ fontSize: '0.78rem', mb: 0.5 }}>Columnas opcionales</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {opcionales.map(c => (
              <Chip key={c} label={c} size="small" variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem', color: 'text.secondary' }} />
            ))}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

/* ── Modos de costeo ── */
const MODOS_COSTEO = [
  { value: 'ultima_compra', label: 'Última compra', desc: 'Precio de la compra más reciente (recomendado)', badge: true },
  { value: 'promedio_30', label: 'Promedio 30 días', desc: 'Promedio de compras de los últimos 30 días' },
  { value: 'precio_db', label: 'Precio DB', desc: 'Precio de referencia del sistema como fallback' },
];

function ModosCosteo({ value, onChange }) {
  const tc = 'var(--color-primary, #3b82f6)';
  return (
    <Stack spacing={0.75}>
      {MODOS_COSTEO.map(m => (
        <Box key={m.value} onClick={() => onChange(m.value)} sx={{
          p: 1.25, borderRadius: 1.5, cursor: 'pointer',
          border: `1.5px solid ${value === m.value ? tc : '#e2e8f0'}`,
          bgcolor: value === m.value ? `${tc}08` : 'transparent',
          transition: 'all .15s',
          '&:hover': { borderColor: tc, bgcolor: `${tc}05` },
        }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${value === m.value ? tc : '#cbd5e1'}`,
              bgcolor: value === m.value ? tc : 'transparent',
              transition: 'all .15s',
            }} />
            <Box>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography fontWeight={value === m.value ? 700 : 500} sx={{ fontSize: '0.82rem' }}>
                  {m.label}
                </Typography>
                {m.badge && (
                  <Chip label="recomendado" size="small"
                    sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#dcfce7', color: '#166534' }} />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>{m.desc}</Typography>
            </Box>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

/* ── Insumo en alerta (colapsable) ── */
function InsumoAlerta({ ins, expanded, onToggle, onOpenReceta }) {
  return (
    <Box sx={{
      borderRadius: 2, border: '1px solid #fbbf24',
      bgcolor: expanded ? '#fffdf5' : '#fffbeb',
      overflow: 'hidden', transition: 'background .15s',
    }}>
      <Box onClick={onToggle} sx={{
        px: 1.75, py: 1.25,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', '&:hover': { bgcolor: '#fef9c3' },
      }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 16, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              <Typography fontWeight={600} sx={{ fontSize: '0.82rem' }} noWrap>{ins.nombre}</Typography>
              {ins.unidadMed && (
                <Typography variant="caption" color="text.secondary">({ins.unidadMed})</Typography>
              )}
              <Chip label={`${ins.enRecetas} receta${ins.enRecetas !== 1 ? 's' : ''}`} size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fef3c7', color: '#92400e' }} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
              {ins.fechaUltimaCompra ? `Última compra: ${ins.fechaUltimaCompra}` : 'Sin compras registradas'}
            </Typography>
          </Box>
        </Stack>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', flexShrink: 0, ml: 1 }}>
          {expanded ? '▲' : '▼'}
        </Typography>
      </Box>

      {expanded && ins.recetas?.length > 0 && (
        <Box sx={{ borderTop: '1px solid #fde68a', bgcolor: '#fffbeb', px: 1.75, py: 1 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary"
            sx={{ fontSize: '0.7rem', display: 'block', mb: 0.75 }}>
            Recetas que usan este insumo
          </Typography>
          <Stack spacing={0.5}>
            {ins.recetas.map(rec => (
              <Box key={rec.articleId} onClick={() => onOpenReceta(rec)} sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.25, py: 0.6, borderRadius: 1.25, cursor: 'pointer',
                bgcolor: '#fef3c7', border: '1px solid #fde68a',
                transition: 'all .1s',
                '&:hover': { bgcolor: '#fde68a', borderColor: '#f59e0b' },
              }}>
                <RestaurantMenuIcon sx={{ fontSize: 13, color: '#92400e', flexShrink: 0 }} />
                <Typography fontWeight={600} sx={{ fontSize: '0.78rem', color: '#92400e', flex: 1 }}>{rec.nombre}</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: '#b45309' }}>abrir →</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

/* ══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════ */
export default function ConfigInsumosTab({
  subTab = 0, setSubTab,
  config = {},
  setConfig,
  saving = {},
  saveConfig,
  saveConfigCosteo,
  businessId,
  allBusinesses,
  alertasInsumos,
  alertasLoading,
  alertasTotal,
  alertaExpanded,
  setAlertaExpanded,
  setAlertasLoading,
  setAlertasInsumos,
  setAlertasTotal,
  onNuevoInsumo,
  onUploadInsumos,
  onUploadInsumosRubros,
  onOpenReceta,
  abrirEquivalencias,
  RecetasAPI,
  themeColor,
}) {
  const tc = themeColor || 'var(--color-primary, #3b82f6)';
  const [confirmDlg, setConfirmDlg] = React.useState(null);
  const [savedCostoIdeal, setSavedCostoIdeal] = React.useState(config?.insumos_costo_ideal ?? '');
  React.useEffect(() => { setSavedCostoIdeal(config?.insumos_costo_ideal ?? ''); }, [config?.insumos_costo_ideal]);
  const [deleteRecetasOpen, setDeleteRecetasOpen] = React.useState(false);

  const handleConfirm = () => {
    if (!confirmDlg) return;
    if (confirmDlg.type === 'costo_ideal') {
      saveConfig('insumos_costo_ideal');
      setSavedCostoIdeal(config.insumos_costo_ideal);
    } else if (confirmDlg.type === 'costeo') {
      saveConfigCosteo();
    }
    setConfirmDlg(null);
  };

  const refreshAlertas = () => {
    setAlertasLoading(true);
    RecetasAPI.getAlertas(Number(businessId))
      .then(res => { setAlertasInsumos(res?.insumos || []); setAlertasTotal(res?.total || 0); })
      .catch(() => { })
      .finally(() => setAlertasLoading(false));
  };

  return (
    <Box>
      <Tabs value={subTab ?? 0} onChange={(_, v) => setSubTab(v)} sx={{
        mb: 3, borderBottom: '1px solid #eee',
        '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: '0.85rem', px: 2, color: 'text.secondary' },
        '& .Mui-selected': { color: tc },
        '& .MuiTabs-indicator': { bgcolor: tc, height: 2 },
      }}>
        <Tab label="General" />
        <Tab label="Gestión de insumos" />
        <Tab label="Compras y alertas" />
      </Tabs>

      {/* ══ SUB-TAB 0 — GENERAL ══ */}
      {subTab === 0 && (
        <Grid container spacing={2.5}>
          {/* % Costo ideal */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card accent>
              <CardHeader icon={<ShoppingCartIcon />} title="% costo ideal global"
                subtitle="Objetivo para recetas de insumos elaborados" accent />
              <CardBody>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                    Define el % de costo objetivo para insumos elaborados. Se puede sobreescribir por receta individual.
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <TextField size="small" type="number"
                      value={config.insumos_costo_ideal}
                      onChange={e => setConfig(c => ({ ...c, insumos_costo_ideal: e.target.value }))}
                      inputProps={{ min: 0, max: 100, step: 0.5 }}
                      InputProps={{ endAdornment: <InputAdornment position="end"><PercentIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
                      sx={{ width: 120 }}
                    />
                    <Button variant="contained" size="small" disabled={!!saving.insumos_costo_ideal}
                      startIcon={saving.insumos_costo_ideal ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                      onClick={() => setConfirmDlg({
                        type: 'costo_ideal',
                        title: 'Guardar costo ideal de insumos',
                        body: `Se establecerá ${config.insumos_costo_ideal}% como objetivo de costo para todos los insumos elaborados${savedCostoIdeal ? ` (actualmente: ${savedCostoIdeal}%)` : ''}.`,
                        detail: 'Este valor se aplica al abrir el modal de receta de cualquier insumo elaborado que no tenga un objetivo individual guardado.',
                      })}
                      sx={{ bgcolor: tc, boxShadow: 'none', '&:hover': { bgcolor: tc, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                      {saving.insumos_costo_ideal ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </Stack>
                  {Number(config.insumos_costo_ideal) > 0 && (
                    <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem', borderRadius: 1.5 }}>
                      Con {config.insumos_costo_ideal}% → precio = Costo ÷ {(Number(config.insumos_costo_ideal) / 100).toFixed(2)}
                    </Alert>
                  )}
                </Stack>
              </CardBody>
            </Card>
          </Grid>

          {/* Precio de costeo */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader icon={<TuneIcon />} title="Precio de costeo"
                subtitle="Qué precio usar para calcular el costo en recetas" />
              <CardBody>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                    Definí qué precio usar al calcular el costo de los insumos. Se puede sobreescribir individualmente desde el modal de receta.
                  </Typography>
                  <ModosCosteo
                    value={config.precio_costeo_insumos}
                    onChange={v => setConfig(c => ({ ...c, precio_costeo_insumos: v }))}
                  />
                  <Divider />
                  <Button variant="contained" size="small" disabled={!!saving.precio_costeo}
                    startIcon={saving.precio_costeo ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                    onClick={saveConfigCosteo}
                    sx={{ alignSelf: 'flex-start', bgcolor: tc, boxShadow: 'none', '&:hover': { bgcolor: tc, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                    {saving.precio_costeo ? 'Guardando…' : 'Guardar configuración'}
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ══ SUB-TAB 1 — GESTIÓN DE INSUMOS ══ */}
      {subTab === 1 && (
        <Grid container spacing={2.5}>
          {/* Acciones — espejo de artículos */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardHeader icon={<ShoppingCartIcon />} title="Acciones"
                subtitle="Alta e importación de insumos" />
              <CardBody>
                <ActionRow icon={<AddIcon />} title="Nuevo insumo"
                  desc="Alta manual cuando el insumo no llegó de Maxi todavía. Se genera un SKU provisorio que se reemplaza al sincronizar.">
                  <PrimaryBtn icon={<AddIcon />} label="Nuevo insumo" onClick={onNuevoInsumo} tc={tc} />
                </ActionRow>
                <ActionRow icon={<CloudUploadIcon />} title="Importar desde archivo"
                  desc="Subí un CSV o Excel con insumos. El sistema detecta las columnas y te pide mapear las que no reconoce.">
                  <PrimaryBtn icon={<CloudUploadIcon />} label="Importar" onClick={onUploadInsumos} tc={tc} />
                </ActionRow>
                <ActionRow icon={<CategoryIcon />} title="Importar rubros de insumos"
                  desc="Subí una tabla con códigos y nombres de rubros para categorizar tus insumos.">
                  <PrimaryBtn icon={<CategoryIcon />} label="Importar rubros"
                    onClick={onUploadInsumosRubros} tc={tc} />
                </ActionRow>
                <ActionRow icon={<DeleteForeverIcon />} title="Borrar recetas masivas"
                  desc="Borrá todas las recetas de insumos elaborados o las de una agrupación específica. Acción irreversible.">
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

          {/* ¿Cómo funciona? — espejo de artículos */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardHeader icon={<TuneIcon />} title="¿Cómo funciona el SKU?" />
              <CardBody>
                <HowItWorks tc={tc} steps={[
                  { n: '1', t: 'Alta manual', d: 'Se genera LAZ-{biz}-{timestamp} como código provisorio.' },
                  { n: '2', t: 'Sync de Maxi', d: 'Busca coincidencias por nombre y rubro al sincronizar.' },
                  { n: '3', t: 'Reconciliación', d: 'Si hay match, reemplaza el SKU por el código oficial.' },
                  { n: '4', t: 'Sin sync', d: 'Si no llega de Maxi, queda activo con el SKU de Lazarillo.' },
                ]} />
              </CardBody>
            </Card>
          </Grid>

          {/* Lotes de insumos — ancho completo, espejo de artículos */}
          <Grid size={{ xs: 12 }}>
            <LotesPanelInsumos businessId={businessId} onUpload={onUploadInsumos} />
          </Grid>
        </Grid>
      )}

      {/* ══ SUB-TAB 2 — COMPRAS Y ALERTAS ══ */}
      {subTab === 2 && (
        <Grid container spacing={2.5}>
          {/* Importar compras — espejo de "Importar ventas" */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardHeader icon={<CloudUploadIcon />} title="Importar compras"
                subtitle="Cuando Maxi no sincroniza o para datos históricos" />
              <CardBody>
                <Stack spacing={2.5}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                    Subí un informe de compras en CSV o Excel. El importador detecta las columnas y te guía para mapear las que no reconoce.
                  </Typography>
                  <ColChips
                    requeridas={['Fecha', 'Código', 'Cantidad', 'Importe']}
                    opcionales={['Nombre', 'Proveedor', 'Precio unit.', 'Medida']}
                  />
                  <PrimaryBtn icon={<CloudUploadIcon />} label="Importar compras"
                    onClick={() => abrirEquivalencias('compras')} tc={tc} />
                </Stack>
              </CardBody>
            </Card>
          </Grid>

          {/* ¿Cómo funciona? — espejo de ventas */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardHeader icon={<TuneIcon />} title="¿Cómo funciona?" />
              <CardBody>
                <HowItWorks tc={tc} steps={[
                  { n: '1', t: 'Subís el archivo', d: 'CSV o Excel exportado desde tu sistema de compras.' },
                  { n: '2', t: 'Detección automática', d: 'El sistema identifica las columnas y muestra una vista previa.' },
                  { n: '3', t: 'Mapeo manual', d: 'Si falta una columna requerida, la asignás manualmente.' },
                  { n: '4', t: 'Importación', d: 'Los datos quedan disponibles para el análisis de costos.' },
                ]} />
              </CardBody>
            </Card>
          </Grid>

          {/* Umbral de alerta — ancho completo */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader icon={<WarningAmberIcon />} title="Umbral de alerta de compras"
                subtitle="Semanas sin compra para marcar un insumo como vencido" />
              <CardBody>
                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }}>
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                      Si un insumo no fue comprado en N semanas y está en una receta activa, se marca como vencido y aparece en las alertas de abajo.
                    </Typography>
                    {Number(config.compras_alerta_semanas) > 0 && (
                      <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.78rem', borderRadius: 1.5 }}>
                        Insumos sin compra en más de <strong>{config.compras_alerta_semanas} semanas</strong> aparecen como vencidos.
                      </Alert>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    <TextField size="small" type="number" label="Semanas sin compra"
                      value={config.compras_alerta_semanas}
                      onChange={e => setConfig(c => ({ ...c, compras_alerta_semanas: e.target.value }))}
                      inputProps={{ min: 1, max: 52, step: 1 }}
                      sx={{ width: 170 }}
                    />
                    <Button variant="contained" size="small" disabled={!!saving.compras_alerta_semanas}
                      startIcon={saving.compras_alerta_semanas ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                      onClick={() => saveConfig('compras_alerta_semanas')}
                      sx={{ bgcolor: tc, boxShadow: 'none', '&:hover': { bgcolor: tc, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                      {saving.compras_alerta_semanas ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </Stack>
                </Stack>
              </CardBody>
            </Card>
          </Grid>

          {/* Alertas de insumos — ancho completo */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                icon={<WarningAmberIcon />}
                title="Insumos con compras vencidas"
                subtitle="Insumos en recetas activas sin compras recientes — click para expandir y ver las recetas"
                action={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {alertasTotal > 0 && (
                      <Chip label={alertasTotal} size="small"
                        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, height: 20, fontSize: '0.68rem' }} />
                    )}
                    <Button size="small" variant="text" onClick={refreshAlertas} disabled={alertasLoading}
                      startIcon={alertasLoading ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 14 }} />}
                      sx={{ fontSize: '0.75rem', color: 'text.secondary', minWidth: 0, px: 1 }}>
                      {alertasLoading ? '' : 'Actualizar'}
                    </Button>
                  </Stack>
                }
              />
              <CardBody>
                {alertasLoading ? (
                  <Stack alignItems="center" py={3}>
                    <CircularProgress size={22} />
                    <Typography variant="caption" color="text.secondary" mt={1}>Verificando insumos…</Typography>
                  </Stack>
                ) : alertasInsumos.length === 0 ? (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{
                    p: 2, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0',
                  }}>
                    <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ color: '#15803d', fontWeight: 600, fontSize: '0.82rem' }}>
                      Todos los insumos tienen compras recientes ✓
                    </Typography>
                  </Stack>
                ) : (
                  <Stack spacing={0.75}>
                    {alertasInsumos.map(ins => (
                      <InsumoAlerta
                        key={ins.insumoId}
                        ins={ins}
                        expanded={alertaExpanded === ins.insumoId}
                        onToggle={() => setAlertaExpanded(p => p === ins.insumoId ? null : ins.insumoId)}
                        onOpenReceta={onOpenReceta}
                      />
                    ))}
                  </Stack>
                )}
              </CardBody>
            </Card>
          </Grid>

          {/* Lotes de compras — ancho completo, espejo de lotes de ventas */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader icon={<ReceiptLongIcon />} title="Lotes de compras importados"
                subtitle="Historial de importaciones" />
              <CardBody>
                <LotesPanel businessId={businessId} lotesTipo="compras" allBusinesses={allBusinesses} />
              </CardBody>
            </Card>
          </Grid>
        </Grid>
      )}

      <DeleteRecetasModal
        open={deleteRecetasOpen}
        onClose={() => setDeleteRecetasOpen(false)}
        businessId={businessId}
        tipo="elaborado"
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
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem' }}>
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