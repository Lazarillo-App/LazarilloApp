// src/componentes/SyncDialog.jsx
import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Stack
} from "@mui/material";

export default function SyncDialog({ open, title, message, onClose, actions }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>{title || "Sincronización"}</DialogTitle>
      <DialogContent dividers>
        {typeof message === "string" ? (
          <Typography sx={{ whiteSpace: "pre-wrap" }}>{message}</Typography>
        ) : (
          message /* permite pasar JSX */
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {actions}
        <Button variant="contained" onClick={onClose} autoFocus>
          Aceptar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
