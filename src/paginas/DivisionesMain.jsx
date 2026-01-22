/**
 * DivisionesMain - Página principal para gestión de divisiones
 */

import React, { useContext } from 'react';
import { Box, Container, Paper } from '@mui/material';
import { BusinessContext } from '../context/BusinessContext';
import DivisionsList from '../componentes/DivisionsList';

export default function DivisionesMain() {
  const { activeBusiness } = useContext(BusinessContext);
  
  if (!activeBusiness) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          No hay un negocio activo seleccionado
        </Paper>
      </Container>
    );
  }
  
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <DivisionsList businessId={activeBusiness.id} />
      </Container>
    </Box>
  );
}