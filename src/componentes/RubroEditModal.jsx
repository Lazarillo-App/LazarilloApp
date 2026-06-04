/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Stack, Checkbox,
  IconButton, InputAdornment, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PercentIcon from '@mui/icons-material/Percent';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import {
  getDiscountExceptions,
  addDiscountException,
  removeDiscountException,
} from '@/servicios/apiPriceLists';

export default function RubroEditModal({
  open,
  onClose,
  rubroKey,            // nombre del rubro/subrubro (key del priceConfig.byRubro)
  rubroDisplay,        // texto para mostrar (rubro - subrubro)
  articleIds = [],     // IDs de artículos del bloque
  initialObjetivo = null,
  globalCostoIdeal = 30,
  priceLists = [],     // listas de la org [{listNumber, alias, isPrincipal, discountPct, tipo}]
  orgId,
  onSave,              // ({ objetivo, articleIds }) => void
}) {
  const [objetivo, setObjetivo] = useState('');
  const [exclusionesRubro, setExclusionesRubro] = useState(new Set()); // listNumbers donde TODOS los artículos están excluidos
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Resetear al abrir
  useEffect(() => {
    if (!open) return;
    setObjetivo(initialObjetivo != null ? String(initialObjetivo) : '');
  }, [open, initialObjetivo]);

  // Cargar exclusiones del bloque
  useEffect(() => {
    if (!open || !orgId || !articleIds.length) return;
    setLoading(true);
    getDiscountExceptions(orgId)
      .then(exc => {
        const idsSet = new Set(articleIds.map(String));
        const excByList = {};
        (exc || []).forEach(e => {
          if (e.scope === 'articulo' && idsSet.has(String(e.scope_id))) {
            if (!excByList[e.list_number]) excByList[e.list_number] = new Set();
            excByList[e.list_number].add(String(e.scope_id));
          }
        });
        const excSet = new Set();
        Object.entries(excByList).forEach(([listNum, artSet]) => {
          if (artSet.size === articleIds.length) excSet.add(Number(listNum));
        });
        setExclusionesRubro(excSet);
      })
      .catch(() => setExclusionesRubro(new Set()))
      .finally(() => setLoading(false));
  }, [open, orgId, articleIds]);

  const toggleExclusionLista = useCallback(async (listNumber) => {
    if (!orgId || !articleIds.length) return;
    const isExcluido = exclusionesRubro.has(listNumber);
    try {
      for (const id of articleIds) {
        if (isExcluido) {
          await removeDiscountException(orgId, 'articulo', String(id), listNumber).catch(() => {});
        } else {
          await addDiscountException(orgId, 'articulo', String(id), listNumber).catch(() => {});
        }
      }
      setExclusionesRubro(prev => {
        const next = new Set(prev);
        isExcluido ? next.delete(listNumber) : next.add(listNumber);
        return next;
      });
    } catch (e) {
      console.error('[toggleExclusionLista rubro]', e);
    }
  }, [orgId, articleIds, exclusionesRubro]);

  const toggleExclusionTodas = useCallback(async () => {
    const noPrincipales = priceLists.filter(l => !l.isPrincipal && l.discountPct != null);
    const todasExcluidas = noPrincipales.every(l => exclusionesRubro.has(l.listNumber));
    for (const l of noPrincipales) {
      if (todasExcluidas) {
        if (exclusionesRubro.has(l.listNumber)) await toggleExclusionLista(l.listNumber);
      } else {
        if (!exclusionesRubro.has(l.listNumber)) await toggleExclusionLista(l.listNumber);
      }
    }
  }, [priceLists, exclusionesRubro, toggleExclusionLista]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const val = objetivo === '' ? null : Number(objetivo);
      await onSave?.({ objetivo: val, articleIds });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const listasConDescuento = priceLists.filter(l => !l.isPrincipal && l.discountPct != null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography fontWeight={700} sx={{ flex: 1, fontSize: '0.95rem' }}>
          {rubroDisplay}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Objetivo % */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
            Objetivo de costo
          </Typography>
          <TextField
            type="number"
            size="small"
            fullWidth
            value={objetivo}
            onChange={e => setObjetivo(e.target.value)}
            placeholder={String(globalCostoIdeal)}
            inputProps={{ min: 0, max: 100, step: 1 }}
            InputProps={{
              endAdornment: <InputAdornment position="end"><PercentIcon sx={{ fontSize: 16, opacity: 0.5 }} /></InputAdornment>,
            }}
            helperText={`${articleIds.length} artículo(s) en este bloque`}
          />
        </Box>

        {/* Exclusiones */}
        {listasConDescuento.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <LocalOfferIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
                  Excluir de Listas
                </Typography>
              </Stack>

              <Box
                onClick={toggleExclusionTodas}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.5, borderRadius: 1, cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Checkbox
                  size="small"
                  checked={listasConDescuento.every(l => exclusionesRubro.has(l.listNumber))}
                  indeterminate={
                    exclusionesRubro.size > 0 &&
                    !listasConDescuento.every(l => exclusionesRubro.has(l.listNumber))
                  }
                />
                <Typography variant="body2" fontWeight={700}>Todas las listas</Typography>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              {listasConDescuento.map(l => (
                <Box
                  key={l.listNumber}
                  onClick={() => toggleExclusionLista(l.listNumber)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.5, borderRadius: 1, cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Checkbox size="small" checked={exclusionesRubro.has(l.listNumber)} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{l.alias || `Lista ${l.listNumber}`}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {l.tipo === 'descuento' ? '−' : '+'}{l.discountPct}%
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} size="small" color="inherit">Cancelar</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={saving}
          sx={{ bgcolor: 'var(--color-primary)', '&:hover': { bgcolor: 'var(--color-primary)', filter: 'brightness(0.9)' } }}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}