// src/gestion/buscadorTipos.js
// Categorías del buscador del Panel: ícono y colores (cat-rubro, cat-concepto… de gestion).
// Las usan el buscador y el chip del filtro activo.

import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';

export const TIPOS = {
  rubro: { label: 'Rubro', plural: 'Rubros', Icon: LayersOutlinedIcon, color: '#6366f1', bg: 'rgba(99,102,241,.12)' },
  concepto: { label: 'Concepto', plural: 'Conceptos', Icon: SellOutlinedIcon, color: '#a855f7', bg: 'rgba(168,85,247,.12)' },
  proveedor: { label: 'Proveedor', plural: 'Proveedores', Icon: LocalShippingOutlinedIcon, color: '#0891b2', bg: 'rgba(8,145,178,.12)' },
  observacion: { label: 'Observación', plural: 'Observaciones', Icon: ChatBubbleOutlineIcon, color: '#db2777', bg: 'rgba(219,39,119,.12)' },
  importe: { label: 'Importe', plural: 'Importes', Icon: PaymentsOutlinedIcon, color: '#16a34a', bg: 'rgba(22,163,74,.12)' },
};

// Parámetro del filtro → categoría (para el chip "Proveedor: …").
export const TIPO_DE_PARAM = {
  rubroCodigo: 'rubro',
  conceptoCodigo: 'concepto',
  proveedorId: 'proveedor',
  observacionQuery: 'observacion',
  importeQuery: 'importe',
};
