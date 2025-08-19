// src/componentes/BulkJsonModal.jsx
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from "@mui/material";
import React, { useState, useEffect } from "react";

export default function BulkJsonModal({ open, onClose, onConfirm, example }) {
  const [text, setText] = useState("");

  useEffect(() => { if (!open) setText(""); }, [open]);

  const handleConfirm = () => {
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error("El JSON debe ser un array de objetos");
      onConfirm(arr);
    } catch (e) {
      alert(`JSON inválido: ${e.message}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Carga masiva (JSON)</DialogTitle>
      <DialogContent>
        <p style={{ margin: '8px 0 12px', color: '#666' }}>
          Pegá un array de insumos. Ejemplo:
        </p>
        <pre style={{ background:'#f6f8fa', padding:12, borderRadius:6, overflow:'auto' }}>
{example}
        </pre>
        <TextField
          multiline
          minRows={10}
          fullWidth
          placeholder="Pegá aquí tu JSON..."
          value={text}
          onChange={(e)=>setText(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleConfirm}>Subir</Button>
      </DialogActions>
    </Dialog>
  );
}
