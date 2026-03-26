// src/componentes/GestorElaboradosModal.jsx
/**
 * Modal para gestionar insumos elaborados de forma masiva
 * Permite marcar/desmarcar múltiples insumos y moverlos a grupos
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Checkbox,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import ScienceIcon from '@mui/icons-material/Science';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import { 
  listInsumosElaborados, 
  toggleInsumosElaboradosBulk,
  moverElaboradosAGrupo,
  getElaboradosStats 
} from '../servicios/apiInsumosElaborados';

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

function GestorElaboradosModal({ 
  open, 
  onClose, 
  businessId,
  groups = [],
  onRefresh,
  notify 
}) {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [elaborados, setElaborados] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [targetGroupId, setTargetGroupId] = useState('');
  const [processing, setProcessing] = useState(false);

  // Cargar datos al abrir
  useEffect(() => {
    if (open) {
      loadData();
    } else {
      // Reset al cerrar
      setTabValue(0);
      setSearchQuery('');
      setSelectedIds(new Set());
      setTargetGroupId('');
    }
  }, [open, businessId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [elaboradosRes, statsRes] = await Promise.all([
        listInsumosElaborados(businessId),
        getElaboradosStats(businessId)
      ]);
      
      setElaborados(elaboradosRes?.data || []);
      setStats(statsRes?.data || null);
    } catch (error) {
      console.error('Error cargando elaborados:', error);
      notify?.('Error al cargar insumos elaborados', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar insumos según búsqueda
  const filteredElaborados = useMemo(() => {
    if (!searchQuery) return elaborados;
    
    const query = normalize(searchQuery);
    return elaborados.filter(insumo => {
      const nombre = normalize(insumo.nombre || '');
      const codigo = normalize(insumo.codigo || '');
      return nombre.includes(query) || codigo.includes(query);
    });
  }, [elaborados, searchQuery]);

  // Filtrar por estado de receta
  const conReceta = useMemo(() => 
    filteredElaborados.filter(i => i.tiene_receta === true),
    [filteredElaborados]
  );
  
  const sinReceta = useMemo(() => 
    filteredElaborados.filter(i => i.tiene_receta !== true),
    [filteredElaborados]
  );

  const currentList = tabValue === 0 ? filteredElaborados : (tabValue === 1 ? conReceta : sinReceta);

  const handleToggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === currentList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map(i => i.id)));
    }
  };

  const handleDesmarcarSeleccionados = async () => {
    if (selectedIds.size === 0) {
      notify?.('Selecciona al menos un insumo', 'warning');
      return;
    }

    setProcessing(true);
    try {
      await toggleInsumosElaboradosBulk(Array.from(selectedIds), false, businessId);
      notify?.(`${selectedIds.size} insumo(s) desmarcado(s) como elaborados`, 'success');
      
      // Recargar
      await loadData();
      setSelectedIds(new Set());
      
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error desmarcando elaborados:', error);
      notify?.('Error al desmarcar insumos', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleMoverAGrupo = async () => {
    if (!targetGroupId) {
      notify?.('Selecciona un grupo de destino', 'warning');
      return;
    }

    setProcessing(true);
    try {
      const result = await moverElaboradosAGrupo(targetGroupId, businessId);
      
      notify?.(
        `${result?.moved || 0} insumo(s) elaborado(s) movido(s) al grupo`,
        'success'
      );
      
      setTargetGroupId('');
      
      if (onRefresh) {
        await onRefresh();
      }
      
      // Opcional: cerrar el modal después de mover
      // onClose();
    } catch (error) {
      console.error('Error moviendo elaborados:', error);
      notify?.('Error al mover insumos al grupo', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price) => {
    const num = Number(price || 0);
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <ScienceIcon />
            <span>Gestor de Insumos Elaborados</span>
          </Box>
          {stats && (
            <Chip 
              label={`${stats.total || 0} elaborados`}
              size="small"
              color="primary"
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Estadísticas */}
            {stats && (
              <Box mb={2}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Total:</strong> {stats.total || 0} insumos elaborados
                    {' • '}
                    <strong>Con receta:</strong> {stats.con_receta || 0}
                    {' • '}
                    <strong>Sin receta:</strong> {stats.sin_receta || 0}
                  </Typography>
                </Alert>
              </Box>
            )}

            {/* Buscador */}
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por nombre o código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            {/* Tabs */}
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
              <Tab label={`Todos (${filteredElaborados.length})`} />
              <Tab label={`Con receta (${conReceta.length})`} />
              <Tab label={`Sin receta (${sinReceta.length})`} />
            </Tabs>

            {/* Acciones en masa */}
            {currentList.length > 0 && (
              <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                <Button
                  size="small"
                  onClick={handleSelectAll}
                  startIcon={<Checkbox checked={selectedIds.size === currentList.length && currentList.length > 0} />}
                >
                  {selectedIds.size === currentList.length && currentList.length > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </Button>
                
                {selectedIds.size > 0 && (
                  <Chip 
                    label={`${selectedIds.size} seleccionado(s)`}
                    size="small"
                    color="primary"
                    onDelete={() => setSelectedIds(new Set())}
                  />
                )}
              </Box>
            )}

            {/* Lista de insumos */}
            <TabPanel value={tabValue} index={0}>
              <InsumosList 
                insumos={filteredElaborados}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                formatPrice={formatPrice}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <InsumosList 
                insumos={conReceta}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                formatPrice={formatPrice}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <InsumosList 
                insumos={sinReceta}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                formatPrice={formatPrice}
              />
            </TabPanel>

            {currentList.length === 0 && (
              <Typography color="text.secondary" textAlign="center" py={4}>
                No hay insumos elaborados en esta categoría
              </Typography>
            )}

            {/* Sección de mover a grupo */}
            {elaborados.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                
                <Typography variant="subtitle2" gutterBottom>
                  Organizar elaborados
                </Typography>
                
                <Box display="flex" gap={2} alignItems="center">
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Mover todos a grupo...</InputLabel>
                    <Select
                      value={targetGroupId}
                      onChange={(e) => setTargetGroupId(e.target.value)}
                      label="Mover todos a grupo..."
                    >
                      <MenuItem value="">
                        <em>Seleccionar grupo</em>
                      </MenuItem>
                      {groups
                        .filter(g => {
                          const nombre = (g.nombre || '').toLowerCase();
                          return nombre !== 'todo' && 
                                 nombre !== 'sin agrupación' &&
                                 nombre !== 'discontinuados';
                        })
                        .map(g => (
                          <MenuItem key={g.id} value={g.id}>
                            {g.nombre}
                          </MenuItem>
                        ))
                      }
                    </Select>
                  </FormControl>
                  
                  <Button
                    variant="outlined"
                    startIcon={<MoveToInboxIcon />}
                    onClick={handleMoverAGrupo}
                    disabled={!targetGroupId || processing}
                  >
                    Mover
                  </Button>
                </Box>

                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Esto moverá todos los insumos elaborados al grupo seleccionado
                </Typography>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {selectedIds.size > 0 && (
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDesmarcarSeleccionados}
            disabled={processing}
          >
            Desmarcar {selectedIds.size} seleccionado(s)
          </Button>
        )}
        <Box flex={1} />
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

// Componente auxiliar para la lista
function InsumosList({ insumos, selectedIds, onToggleSelect, formatPrice }) {
  return (
    <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
      {insumos.map((insumo) => (
        <ListItem 
          key={insumo.id}
          button
          onClick={() => onToggleSelect(insumo.id)}
          selected={selectedIds.has(insumo.id)}
        >
          <Checkbox
            edge="start"
            checked={selectedIds.has(insumo.id)}
            tabIndex={-1}
            disableRipple
          />
          <ListItemText
            primary={insumo.nombre}
            secondary={
              <Box component="span" display="flex" gap={1} alignItems="center">
                <span>{insumo.codigo || 'Sin código'}</span>
                {insumo.tiene_receta ? (
                  <Chip 
                    label="Con receta" 
                    size="small" 
                    color="success" 
                    sx={{ height: 20 }}
                  />
                ) : (
                  <Chip 
                    label="Sin receta" 
                    size="small" 
                    color="warning" 
                    sx={{ height: 20 }}
                  />
                )}
                <span>• {formatPrice(insumo.costo_receta || 0)}</span>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}

export default GestorElaboradosModal;