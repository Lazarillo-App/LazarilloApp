// src/componentes/configuracion/ImportarExportarDatos.jsx
// Importar / exportar ventas o compras (CSV/Excel). Antes era el botón "Ventas / Compras ▾" de
// la barra de Menú e Insumos; Diego (06/11/2026) lo pasó a ⚙ Configuración: los datos llegan
// solos del kit y el punto del header actualiza, así que esto queda para casos puntuales.
// tipo = 'ventas' (pestaña Artículos y ventas) | 'compras' (pestaña Insumos y compras).
// El período arranca en el mismo que se eligió en la barra (mismas claves de localStorage).

import React, { useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import UploadCSVModal from '@/componentes/UploadCSVModal';
import UploadComprasModal from '@/componentes/UploadComprasModal';
import { downloadVentasCSV, clearVentasCache } from '@/servicios/apiVentas';
import { purchasesDownloadCsv } from '@/servicios/apiPurchases';
import { showAlert } from '@/servicios/appAlert';
import { lastNDaysUntilYesterday } from '@/utils/fechas';
import instructionImage1 from '@/assets/brand/maxirest-menu.jpeg';
import instructionImage2 from '@/assets/brand/maxirest-config.jpeg';

const CLAVE = { ventas: 'lazarillo:rangoVentas', compras: 'lazarillo:rangoCompras' };
const DIAS_DEFAULT = { ventas: 7, compras: 30 };

function rangoInicial(tipo) {
  try {
    const r = JSON.parse(localStorage.getItem(CLAVE[tipo]) || 'null');
    if (r?.from && r?.to) return { from: String(r.from).slice(0, 10), to: String(r.to).slice(0, 10) };
  } catch { /* sin storage */ }
  const d = lastNDaysUntilYesterday(DIAS_DEFAULT[tipo]);
  return { from: String(d.from).slice(0, 10), to: String(d.to).slice(0, 10) };
}

export default function ImportarExportarDatos({ tipo = 'ventas', businessId, themeColor = '#2492C8' }) {
  const esVentas = tipo === 'ventas';
  const [rango, setRango] = useState(() => rangoInicial(tipo));
  const [abierto, setAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);

  const exportar = async () => {
    const { from, to } = rango;
    if (!businessId || !from || !to) { showAlert('Falta negocio activo o período.', 'warning'); return; }
    if (from > to) { showAlert('La fecha "desde" es posterior a "hasta".', 'warning'); return; }
    setExportando(true);
    try {
      if (esVentas) {
        const blob = await downloadVentasCSV(businessId, { from, to });
        if (!blob || blob.size === 0) { showAlert('El CSV vino vacío.', 'warning'); return; }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventas_${businessId}_${from}_a_${to}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        await purchasesDownloadCsv(businessId, { from, to });
      }
    } catch (e) {
      showAlert(`Error al descargar ${tipo}: ${e?.message || e}`, 'error');
    } finally {
      setExportando(false);
    }
  };

  const titulo = esVentas ? 'Ventas' : 'Compras';
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{titulo}: importar / exportar</Typography>
          <Typography variant="body2" color="text.secondary">
            Llegan solas del kit; esto queda para subir o bajar un archivo puntual.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            type="date" size="small" label="Desde" value={rango.from}
            onChange={(e) => setRango((r) => ({ ...r, from: e.target.value }))}
            InputLabelProps={{ shrink: true }} sx={{ width: 160 }}
          />
          <TextField
            type="date" size="small" label="Hasta" value={rango.to}
            onChange={(e) => setRango((r) => ({ ...r, to: e.target.value }))}
            InputLabelProps={{ shrink: true }} sx={{ width: 160 }}
          />
          <Button
            variant="outlined" size="small" startIcon={<CloudDownloadIcon />} onClick={exportar}
            disabled={!businessId || exportando}
            sx={{ height: 40, textTransform: 'none', fontWeight: 700, borderColor: themeColor, color: themeColor }}
          >
            {exportando ? 'Exportando…' : `Exportar ${tipo}`}
          </Button>
          <Button
            variant="contained" size="small" startIcon={<CloudUploadIcon />} onClick={() => setAbierto(true)}
            disabled={!businessId}
            sx={{ height: 40, textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}
          >
            {`Importar ${tipo}`}
          </Button>
        </Stack>
      </Stack>

      {esVentas ? (
        <UploadCSVModal
          open={abierto}
          onClose={() => setAbierto(false)}
          businessId={businessId}
          onSuccess={() => { clearVentasCache(); showAlert('Ventas importadas correctamente', 'success'); }}
          instructionImage1={instructionImage1}
          instructionImage2={instructionImage2}
        />
      ) : (
        <UploadComprasModal
          open={abierto}
          onClose={() => setAbierto(false)}
          businessId={businessId}
          onSuccess={() => { setAbierto(false); showAlert('Compras importadas correctamente', 'success'); }}
        />
      )}
    </Paper>
  );
}
