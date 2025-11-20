// src/componentes/AgrupacionesInsumos.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Button, Modal, Typography, TextField, Checkbox,
  Box, Snackbar, Alert
} from "@mui/material";
import {
  obtenerAgrupacionesInsumos,
  crearAgrupacionInsumos,
  eliminarAgrupacionInsumos
} from "../servicios/apiAgrupacionesInsumos";
import { insumosList } from "../servicios/apiInsumos";

export default function AgrupacionesInsumos() {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [search, setSearch] = useState("");
  const [insumos, setInsumos] = useState([]);
  const [seleccion, setSeleccion] = useState(new Set());
  const [grupos, setGrupos] = useState([]);
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });

  const loadInsumos = async () => {
    try {
      // traemos hasta 1000 insumos activos del negocio actual
      const data = await insumosList({ page: 1, limit: 1000, activo: 'true' });
      setInsumos(data.data || []);
    } catch (e) {
      console.error('Error cargando insumos para agrupaciones:', e);
      setInsumos([]);
    }
  };

  const loadGrupos = async () => {
    const g = await obtenerAgrupacionesInsumos();
    setGrupos(Array.isArray(g) ? g : []);
  };

  useEffect(() => { loadInsumos(); loadGrupos(); }, []);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return insumos;
    return insumos.filter(i =>
      (i.nombre || '').toLowerCase().includes(q) ||
      (i.codigo_mostrar || i.codigo_maxi || '').toLowerCase().includes(q)
    );
  }, [search, insumos]);

  const toggle = (id) => {
    const s = new Set(seleccion);
    s.has(id) ? s.delete(id) : s.add(id);
    setSeleccion(s);
  };

  const crear = async () => {
    if (!nombre.trim() || seleccion.size === 0) {
      setSnack({ open: true, msg: 'Ingresá un nombre y seleccioná al menos un insumo', type: 'error' });
      return;
    }
    const payload = {
      nombre: nombre.trim(),
      insumos: Array.from(seleccion).map(id => ({ id })) // podés añadir nombre/unidad/precio si querés duplicar
    };
    await crearAgrupacionInsumos(payload);
    setSnack({ open: true, msg: 'Agrupación creada', type: 'success' });
    setNombre("");
    setSeleccion(new Set());
    setOpen(false);
    loadGrupos();
  };

  const borrar = async (id) => {
    if (!confirm('¿Eliminar esta agrupación de insumos?')) return;
    await eliminarAgrupacionInsumos(id);
    setSnack({ open: true, msg: 'Agrupación eliminada', type: 'success' });
    loadGrupos();
  };

  return (
    <div style={{ marginTop: 32 }}>
      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>

      <h2 className="text-xl font-bold">Agrupaciones de Insumos</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 16px' }}>
        <TextField
          label="Nombre de agrupación"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          size="small"
        />
        <Button variant="contained" onClick={() => setOpen(true)} disabled={!nombre.trim()}>
          Seleccionar insumos
        </Button>
      </div>

      {/* Lista de agrupaciones existentes */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr style={{ background: '#2e4756', color: '#fff' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Nombre</th>
            <th style={{ textAlign: 'left', padding: 8 }}># Insumos</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(g => (
            <tr key={g.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{g.nombre}</td>
              <td style={{ padding: 8 }}>
                {typeof g.items === 'number'
                  ? g.items
                  : (Array.isArray(g.insumos) ? g.insumos.length : 0)}
              </td>
              <Button size="small" color="error" variant="outlined" onClick={() => borrar(g.id)}>Eliminar</Button>
            </tr>
          ))}
        {!grupos.length && (
          <tr><td colSpan={3} style={{ padding: 12, color: '#777' }}>No hay agrupaciones de insumos aún.</td></tr>
        )}
      </tbody>
    </table>

      {/* Modal de selección */ }
  <Modal open={open} onClose={() => setOpen(false)}>
    <Box sx={{
      overflowY: 'auto', maxHeight: '80vh', width: '90%', maxWidth: 800,
      margin: '50px auto', p: 3, bgcolor: 'white', borderRadius: 2, boxShadow: 24
    }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Seleccionar insumos
      </Typography>
      <TextField
        fullWidth placeholder="Buscar por nombre o código..."
        value={search} onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />
      <div style={{ maxHeight: '55vh', overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              <th style={{ textAlign: 'left', padding: 8 }}></th>
              <th style={{ textAlign: 'left', padding: 8 }}>Código</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Nombre</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Unidad</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Precio ref</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(i => (
              <tr key={i.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8 }}>
                  <Checkbox
                    checked={seleccion.has(i.id)}
                    onChange={() => toggle(i.id)}
                  />
                </td>
                <td style={{ padding: 8 }}>{i.codigo_mostrar || i.codigo_maxi || `INS-${i.id}`}</td>
                <td style={{ padding: 8 }}>{i.nombre}</td>
                <td style={{ padding: 8 }}>{i.unidad_med || '-'}</td>
                <td style={{ padding: 8 }}>{Number(i.precio_ref ?? 0).toFixed(2)}</td>
              </tr>
            ))}
            {!filtrados.length && (
              <tr><td colSpan={5} style={{ padding: 12, color: '#777' }}>Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Box display="flex" justifyContent="flex-end" mt={2} gap={1}>
        <Button onClick={() => setOpen(false)}>Cancelar</Button>
        <Button variant="contained" onClick={crear} disabled={seleccion.size === 0}>Guardar</Button>
      </Box>
    </Box>
  </Modal>
    </div >
  );
}
