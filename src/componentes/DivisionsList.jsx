/* eslint-disable no-unused-vars */
/**
 * DivisionsList - Componente principal para gestionar divisiones
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { useDivisions } from '../hooks/useDivisions';
import DivisionCreateModal from './DivisionCreateModal';
import DivisionEditModal from './DivisionEditModal';
import DivisionDeleteDialog from './DivisionDeleteDialog';

/**
 * Componente principal de divisiones
 */
export default function DivisionsList({ businessId }) {
  const {
    divisions,
    loading,
    error,
    total,
    hasMain,
    loadDivisions,
    deleteDivision,
  } = useDivisions(businessId, { includeStats: true });
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState(null);
  
  // Handlers
  const handleCreate = () => {
    setCreateModalOpen(true);
  };
  
  const handleEdit = (division) => {
    setSelectedDivision(division);
    setEditModalOpen(true);
  };
  
  const handleDelete = (division) => {
    setSelectedDivision(division);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!selectedDivision) return;
    
    try {
      await deleteDivision(selectedDivision.id);
      setDeleteDialogOpen(false);
      setSelectedDivision(null);
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  };
  
  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    loadDivisions();
  };
  
  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedDivision(null);
    loadDivisions();
  };
  
  // Render
  if (loading && divisions.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h5" gutterBottom>
            Divisiones del Negocio
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona las secciones o áreas de tu negocio
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Nueva División
        </Button>
      </Box>
      
      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Info */}
      {!hasMain && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Este negocio no tiene división principal. Se creará automáticamente.
        </Alert>
      )}
      
      {/* Lista de divisiones */}
      <Stack spacing={2}>
        {divisions.map((division) => (
          <DivisionCard
            key={division.id}
            division={division}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
        
        {divisions.length === 0 && !loading && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary">
                No hay divisiones creadas aún
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleCreate}
                sx={{ mt: 2 }}
              >
                Crear Primera División
              </Button>
            </CardContent>
          </Card>
        )}
      </Stack>
      
      {/* Total */}
      {total > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Total: {total} {total === 1 ? 'división' : 'divisiones'}
        </Typography>
      )}
      
      {/* Modals */}
      <DivisionCreateModal
        open={createModalOpen}
        businessId={businessId}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
      
      <DivisionEditModal
        open={editModalOpen}
        division={selectedDivision}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedDivision(null);
        }}
        onSuccess={handleEditSuccess}
      />
      
      <DivisionDeleteDialog
        open={deleteDialogOpen}
        division={selectedDivision}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedDivision(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </Box>
  );
}

/**
 * Tarjeta individual de división
 */
function DivisionCard({ division, onEdit, onDelete }) {
  const {
    id,
    name,
    code,
    description,
    is_main,
    is_active,
    config,
    article_count = 0,
  } = division;
  
  const iconFromConfig = config?.icon || '📁';
  const colorFromConfig = config?.color || '#2196f3';
  
  return (
    <Card
      sx={{
        borderLeft: `4px solid ${colorFromConfig}`,
        opacity: is_active ? 1 : 0.6,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Drag handle (para futuro reordenamiento) */}
          <IconButton size="small" sx={{ cursor: 'grab' }}>
            <DragIcon />
          </IconButton>
          
          {/* Icono */}
          <Box
            sx={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1,
              bgcolor: colorFromConfig + '20',
              fontSize: '1.5rem',
            }}
          >
            {iconFromConfig}
          </Box>
          
          {/* Info */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h6">
                {name}
              </Typography>
              <Chip label={code} size="small" />
              {is_main && (
                <Tooltip title="División principal">
                  <StarIcon fontSize="small" color="primary" />
                </Tooltip>
              )}
              {!is_active && (
                <Chip label="Inactiva" size="small" color="default" />
              )}
            </Box>
            
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {description}
              </Typography>
            )}
            
            <Typography variant="caption" color="text.secondary">
              {article_count} {article_count === 1 ? 'artículo' : 'artículos'}
            </Typography>
          </Box>
          
          {/* Acciones */}
          <Stack direction="row" spacing={1}>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => onEdit(division)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            {!is_main && (
              <Tooltip title="Eliminar">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onDelete(division)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}