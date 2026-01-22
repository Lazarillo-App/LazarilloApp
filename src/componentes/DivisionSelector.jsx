import React from 'react';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  CircularProgress,
  Box,
  Chip,
} from '@mui/material';
import { 
  Store as StoreIcon, 
  ViewModule as ViewModuleIcon 
} from '@mui/icons-material';
import { useBusiness } from '../context/BusinessContext';

function DivisionSelector() {
  // 🆕 Ahora usamos useBusiness() en lugar de useDivision()
  const { 
    activeDivisionId, 
    setDivision,
    divisions,
    divisionsLoading,
    activeId: activeBizId,
  } = useBusiness();
  
  const handleChange = (event) => {
    const value = event.target.value;
    
    // Si selecciona "Principal", pasar null
    // Si selecciona una división, pasar el ID como número
    const newDivisionId = value === '' ? null : Number(value);
    
    console.log('[DivisionSelector] 🔄 Cambiando división:', {
      anterior: activeDivisionId,
      nueva: newDivisionId,
    });
    
    setDivision(newDivisionId);
  };
  
  // Si no hay negocio activo, no mostrar el selector
  if (!activeBizId) {
    return null;
  }

  // Si no hay divisiones, no mostrar el selector
  if (!divisions || divisions.length === 0) {
    return null;
  }
  
  return (
    <FormControl 
      size="small" 
      sx={{ 
        minWidth: 200,
        '& .MuiOutlinedInput-root': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          },
        }
      }}
    >
      <InputLabel id="division-selector-label">División</InputLabel>
      <Select
        labelId="division-selector-label"
        id="division-selector"
        value={activeDivisionId || ''}
        onChange={handleChange}
        label="División"
        disabled={divisionsLoading}
        renderValue={(selected) => {
          const isMain = selected === '';
          const divName = isMain 
            ? 'Principal' 
            : divisions.find(d => d.id === selected)?.name || 'Principal';
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isMain ? (
                <StoreIcon fontSize="small" />
              ) : (
                <ViewModuleIcon fontSize="small" />
              )}
              <span>{divName}</span>
            </Box>
          );
        }}
        endAdornment={
          divisionsLoading && (
            <CircularProgress 
              size={20} 
              sx={{ position: 'absolute', right: 32 }} 
            />
          )
        }
      >
        {/* Opción principal (todas las agrupaciones no asignadas) */}
        <MenuItem value="">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <StoreIcon fontSize="small" />
            <span>Principal</span>
            <Chip 
              label="Todos" 
              size="small" 
              color="primary" 
              variant="outlined"
              sx={{ ml: 'auto' }}
            />
          </Box>
        </MenuItem>
        
        {/* Divisiones/Subnegocios */}
        {divisions.map(div => (
          <MenuItem key={div.id} value={div.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <ViewModuleIcon fontSize="small" />
              <span>{div.name}</span>
              {div.assigned_groups_count > 0 && (
                <Chip 
                  label={`${div.assigned_groups_count} grupos`} 
                  size="small" 
                  sx={{ ml: 'auto' }}
                />
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default DivisionSelector;