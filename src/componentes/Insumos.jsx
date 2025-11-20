// src/componentes/Insumos.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    insumosList, insumoCreate, insumoUpdate, insumoDelete,
    insumosBulkJSON, insumosBulkCSV
} from "../servicios/apiInsumos";
import BulkJsonModal from "./BulkJsonModal";
import "../css/TablaArticulos.css";

import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, MenuItem, Stack
} from "@mui/material";

const num = (v) => (v == null || v === "" ? "" : Number(v));
const UNIDADES = ["kg", "g", "lt", "ml", "un"];

export default function Insumos() {
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [loading, setLoading] = useState(false);
    const [openBulk, setOpenBulk] = useState(false);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ nombre: "", unidadMed: "", precioRef: "" });

    const fetchData = async () => {
        setLoading(true);
        try {
            const r = await insumosList({ page, limit, search: q });
            console.log('[Insumos.jsx] respuesta listar:', r); 
            setRows(r.data || []);
            setPagination(r.pagination || { total: 0, pages: 1 });
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchData();  }, [page, q]);

    const filtered = useMemo(() => rows, [rows]);

    const openCreate = () => {
        setEditing(null);
        setForm({ nombre: "", unidadMed: "", precioRef: "" });
        setOpen(true);
    };
    const openEdit = (row) => {
        setEditing(row);
        setForm({
            nombre: row.nombre || "",
            unidadMed: row.unidad_med || "",
            precioRef: row.precio_ref ?? ""
        });
        setOpen(true);
    };
    const closeModal = () => setOpen(false);
    const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const save = async () => {
        const payload = {
            // código: ahora SIEMPRE lo pone la DB (alias INS-{id} si no hay codigo_maxi)
            nombre: form.nombre.trim(),
            unidadMed: form.unidadMed || null,
            precioRef: form.precioRef === "" ? null : Number(form.precioRef),
            origen: editing ? undefined : "manual",
            activo: editing ? undefined : true,
        };
        if (!payload.nombre) return alert("El nombre es obligatorio");

        if (editing) await insumoUpdate(editing.id, payload);
        else await insumoCreate(payload);

        closeModal();
        fetchData();
    };

    const eliminar = async (row) => {
        if (!confirm(`Desactivar "${row.nombre}"?`)) return;
        await insumoDelete(row.id);
        fetchData();
    };

    const onBulkJSON = () => setOpenBulk(true);

    const handleBulkConfirm = async (array) => {
        await insumosBulkJSON(array);
        setOpenBulk(false);
        fetchData();
    };

    const onBulkCSV = async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        await insumosBulkCSV(f);
        e.target.value = "";
        fetchData();
    };

    // Mostrar siempre el alias devuelto por el backend
    const displayCode = (r) => r.codigo_mostrar || (r.codigo_maxi && r.codigo_maxi.trim() !== "" ? r.codigo_maxi : `INS-${r.id}`);

    return (
        <div className="tabla-articulos-container">
            <div className="tabla-content">
                <h2>Gestión de Insumos</h2>

                <div className="filtros-fechas" style={{ gap: 12 }}>
                    <input
                        type="text"
                        placeholder="Buscar insumos..."
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1); }}
                        style={{ width: 240 }}
                    />
                    <Button variant="contained" onClick={openCreate}>+ Nuevo</Button>
                    <Button variant="outlined" onClick={onBulkJSON}>Carga masiva (JSON)</Button>
                    <label className="btn-file">
                        <span style={{ padding: "6px 12px", border: "1px solid #1976d2", borderRadius: 6, color: "#1976d2", cursor: "pointer" }}>
                            Carga masiva (CSV)
                        </span>
                        <input type="file" accept=".csv" onChange={onBulkCSV} style={{ display: "none" }} />
                    </label>
                </div>

                {loading ? <p>Cargando...</p> : (
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Nombre</th>
                                <th>Unidad</th>
                                <th>Precio ref</th>
                                <th style={{ width: 220 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => (
                                <tr key={r.id}>
                                    <td>{displayCode(r)}</td>
                                    <td>{r.nombre}</td>
                                    <td>{r.unidad_med || "-"}</td>
                                    <td>{num(r.precio_ref)}</td>
                                    <td>
                                        <Button size="small" variant="outlined" onClick={() => openEdit(r)} sx={{ mr: 1 }}>Editar</Button>
                                        <Button size="small" variant="outlined" color="error" onClick={() => eliminar(r)}>Eliminar</Button>
                                    </td>
                                </tr>
                            ))}
                            {!filtered.length && (
                                <tr><td colSpan={5} style={{ padding: 16, color: "white" }}>
                                    No hay insumos (probá crear uno o carga masiva).
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                )}

                <div className="paginado" style={{ marginTop: 12 }}>
                    Página {page} / {pagination.pages} — Total: {pagination.total}&nbsp;
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
                    <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
                </div>
            </div>

            {/* Modal crear/editar (sin campo código) */}
            <Dialog open={open} onClose={closeModal} fullWidth maxWidth="sm">
                <DialogTitle>{editing ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {editing && (
                            <TextField
                                label="Código"
                                value={displayCode(editing)}
                                InputProps={{ readOnly: true }}
                            />
                        )}
                        <TextField
                            label="Nombre *"
                            value={form.nombre}
                            onChange={(e) => onChange("nombre", e.target.value)}
                        />
                        <TextField
                            select
                            label="Unidad de medida"
                            value={form.unidadMed}
                            onChange={(e) => onChange("unidadMed", e.target.value)}
                        >
                            <MenuItem value="">(sin unidad)</MenuItem>
                            {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                        <TextField
                            label="Precio ref"
                            type="number"
                            value={form.precioRef}
                            onChange={(e) => onChange("precioRef", e.target.value)}
                            inputProps={{ step: "0.01" }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeModal}>Cancelar</Button>
                    <Button variant="contained" onClick={save}>Guardar</Button>
                </DialogActions>
            </Dialog>
            <BulkJsonModal
                open={openBulk}
                onClose={() => setOpenBulk(false)}
                onConfirm={handleBulkConfirm}
                example={`[
                    { "nombre": "Harina 000", "unidadMed": "kg", "precioRef": 1200 },
                    { "nombre": "Leche entera", "unidadMed": "lt", "precioRef": 950 }
                ]`}
            />
        </div>
    );
}
