// src/componentes/InsumoGroupModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    ToggleButtonGroup,
    ToggleButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    FormControlLabel,
    Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
    insumosList,
    insumoGroupCreate,
    insumoGroupAddMultipleItems,
    insumosRubrosList,
} from "../servicios/apiInsumos";

const num = (v) => (v == null || v === "" ? null : Number(v));

const formatMoney = (v, d = 2) => {
    const n = num(v);
    if (n == null || Number.isNaN(n)) return "-";
    return n.toLocaleString("es-AR", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
    });
};

export default function InsumoGroupModal({
    open,
    onClose,
    insumo = null,
    originRubroLabel = null,
    businessId,
    groups = [],
    onGroupsReload,
    editingGroupId = null,
}) {
    const [vista, setVista] = useState("no-elaborados");
    const [loading, setLoading] = useState(false);
    const [rubros, setRubros] = useState([]);
    const [rows, setRows] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [newGroupName, setNewGroupName] = useState("");
    const [saving, setSaving] = useState(false);

    /* ================== RESET AL ABRIR ================== */
    useEffect(() => {
        if (!open) return;

        const s = new Set();
        if (insumo && insumo.id) {
            s.add(Number(insumo.id));
        }
        setSelectedIds(s);

        const firstId = groups.length ? groups[0].id : "";
        setSelectedGroupId(firstId ? String(firstId) : "");
        setNewGroupName("");
    }, [open, insumo, groups]);

    /* ================== RUBROS ================== */
    useEffect(() => {
        if (!open || !businessId) {
            setRows([]);
            return;
        }

        let canceled = false;

        (async () => {
            setLoading(true);
            try {
                const pageSize = 5000;
                let page = 1;
                let all = [];
                let total = null;

                while (!canceled) {
                    const params = { page, limit: pageSize, search: "" };

                    if (vista === "elaborados") params.elaborados = "true";
                    else if (vista === "no-elaborados") params.elaborados = "false";

                    const r = await insumosList(businessId, params);

                    const chunk = Array.isArray(r?.data) ? r.data : [];
                    const pag = r?.pagination;
                    if (total == null && pag?.total != null) total = Number(pag.total);

                    all = all.concat(chunk);

                    // condición de salida:
                    if (!chunk.length) break;
                    if (total != null && all.length >= total) break;

                    page++;
                    // safety guard
                    if (page > 200) break;
                }

                if (!canceled) {
                    setRows(all);
                    console.log(`📦 [InsumoGroupModal] rows cargados total: ${all.length} (vista=${vista})`);
                }
            } catch (e) {
                if (!canceled) {
                    console.error("[InsumoGroupModal] Error insumos:", e);
                    setRows([]);
                }
            } finally {
                if (!canceled) setLoading(false);
            }
        })();

        return () => {
            canceled = true;
        };
    }, [open, businessId, vista]);

    const rubroNombreMap = useMemo(() => {
        const m = new Map();
        (rubros || []).forEach((r) => {
            if (r && r.codigo != null) {
                m.set(String(r.codigo), r.nombre || "");
            }
        });
        return m;
    }, [rubros]);

    const getRubroLabel = (row) => {
        const code =
            row.rubro_codigo ??
            row.rubroCodigo ??
            row.codigo_rubro ??
            row.rubro ??
            null;

        if (code != null) {
            const fromMap = rubroNombreMap.get(String(code));
            if (fromMap && fromMap.trim() !== "") return fromMap;
        }

        return (
            row.rubro_nombre ||
            row.rubroNombre ||
            row.nombre_rubro ||
            row.rubro_maxi ||
            (code != null ? String(code) : "Sin rubro")
        );
    };

    useEffect(() => {
        if (!open || !businessId) { setRubros([]); return; }
        let canceled = false;

        (async () => {
            try {
                const res = await insumosRubrosList(businessId);
                if (!canceled) setRubros(res.items || []);
            } catch (e) {
                if (!canceled) setRubros([]);
                console.error("[InsumoGroupModal] Error rubros:", e);
            }
        })();

        return () => { canceled = true; };
    }, [open, businessId]);

    /* ================== YA AGRUPADOS ================== */
    const yaAgrupados = useMemo(() => {
        const set = new Set();

        groups.forEach((g) => {
            // Permitir los del grupo actual si estamos editando
            if (editingGroupId && Number(g.id) === Number(editingGroupId)) return;

            (g.items || g.insumos || []).forEach((item) => {
                const id = Number(item.insumo_id ?? item.id);
                if (Number.isFinite(id)) set.add(id);
            });
        });

        return set;
    }, [groups, editingGroupId]);

    /* ================== AGRUPAR POR RUBRO (MOSTRAR TODO) ================== */
    const groupedRows = useMemo(() => {
        const map = new Map();

        // ✅ Incluir TODOS los rows (agrupados o no)
        for (const r of rows || []) {
            const label = getRubroLabel(r);
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(r);
        }

        return Array.from(map.entries()).map(([label, groupRows]) => ({
            label,
            rows: groupRows,
        }));
    }, [rows, rubroNombreMap]); // rubroNombreMap cambia cuando cambia rubros

    /* ================== PRESELECCIÓN DESDE UN RUBRO (SOLO DISPONIBLES) ================== */
    useEffect(() => {
        if (!open) return;
        if (!originRubroLabel) return;
        if (!rows || rows.length === 0) return;

        const labelNorm = originRubroLabel.trim().toLowerCase();

        setSelectedIds((prev) => {
            const next = new Set(prev);

            for (const r of rows) {
                const id = Number(r.id);
                if (!Number.isFinite(id)) continue;

                // Solo preseleccionar si NO está ya agrupado
                if (yaAgrupados.has(id)) continue;

                const rl = (getRubroLabel(r) || "").trim().toLowerCase();
                if (rl === labelNorm) {
                    next.add(id);
                }
            }

            console.log(
                `🎯 [Preselección] Rubro "${originRubroLabel}": ${next.size - prev.size
                } insumos agregados`
            );
            return next;
        });
    }, [open, originRubroLabel, rows, yaAgrupados, rubroNombreMap]);

    /* ================== HANDLERS CHECKBOX ================== */
    const toggleInsumo = (id) => {
        const numId = Number(id);
        if (!Number.isFinite(numId)) return;

        // ❌ no permitir seleccionar ya agrupados
        if (yaAgrupados.has(numId)) return;

        setSelectedIds((prev) => {
            const n = new Set(prev);
            if (n.has(numId)) n.delete(numId);
            else n.add(numId);
            return n;
        });
    };

    const toggleRubroGroup = (idsDisponibles, allSelectedNow) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);

            idsDisponibles.forEach((id) => {
                if (!Number.isFinite(id)) return;
                if (allSelectedNow) next.delete(id);
                else next.add(id);
            });

            return next;
        });
    };

    /* ================== CERRAR / GUARDAR ================== */
    const handleClose = () => {
        if (saving) return;
        onClose && onClose(false);
    };

    const handleSave = async () => {
        if (!businessId) {
            alert("Seleccioná un negocio antes de guardar agrupaciones.");
            return;
        }

        if (!selectedIds.size) {
            alert("Seleccioná al menos un insumo para agrupar.");
            return;
        }

        const trimmedName = newGroupName.trim();
        const hasNewGroup = trimmedName.length > 0;
        const hasExisting = selectedGroupId !== "" && selectedGroupId != null;

        if (!hasNewGroup && !hasExisting) {
            alert("Elegí una agrupación existente o ingresá un nombre nuevo.");
            return;
        }

        try {
            setSaving(true);

            let groupIdToUse = hasExisting ? Number(selectedGroupId) : null;

            // ✅ MOVER ESTO ARRIBA (antes del if)
            const idsArray = Array.from(selectedIds);

            // 1) Crear agrupación si escribió un nombre
            if (hasNewGroup) {
                console.log(`📦 [InsumoGroupModal] Creando grupo "${trimmedName}"`);
                const res = await insumoGroupCreate({
                    nombre: trimmedName,
                    descripcion: null,
                });

                const created = res?.data || res;
                const newId = Number(created?.id);
                if (!Number.isFinite(newId)) {
                    throw new Error("No se pudo obtener el ID de la nueva agrupación.");
                }
                groupIdToUse = newId;

                // ✅ EMITIR NOTIFICACIÓN (ahora idsArray está definido)
                try {
                    window.dispatchEvent(
                        new CustomEvent('ui:action', {
                            detail: {
                                businessId,
                                kind: 'group_create',
                                scope: 'insumo',
                                title: '🆕 Agrupación creada',
                                message: `"${trimmedName}" con ${idsArray.length} insumo(s).`,
                                createdAt: new Date().toISOString(),
                                payload: {
                                    groupId: newId,
                                    groupName: trimmedName,
                                    count: idsArray.length,
                                },
                            },
                        })
                    );
                } catch (e) {
                    console.warn('[InsumoGroupModal] Error emitiendo notificación:', e);
                }

                onGroupsReload && (await onGroupsReload());
            }

            if (!Number.isFinite(groupIdToUse)) {
                throw new Error("ID de agrupación inválido.");
            }

            // 2) Agregar en BULK
            console.log(`📦 [InsumoGroupModal] Agregando ${idsArray.length} insumos en BULK al grupo ${groupIdToUse}`);
            await insumoGroupAddMultipleItems(groupIdToUse, idsArray);

            alert(`✅ ${idsArray.length} insumos agrupados correctamente.`);
            onClose && onClose({ ok: true, groupId: groupIdToUse });
        } catch (e) {
            console.error("[InsumoGroupModal] Error guardando agrupación:", e);
            alert(e.message || "Error al agrupar insumos.");
        } finally {
            setSaving(false);
        }
    };

    /* ================== RENDER ================== */
    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
            <DialogTitle>Agrupar insumos</DialogTitle>

            <DialogContent dividers>
                {insumo && (
                    <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
                        Insumo origen: <strong>{insumo.nombre}</strong>
                    </Typography>
                )}

                {/* Toggle elaborados / no elaborados */}
                <div style={{ marginBottom: 12 }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                        Vista de insumos
                    </Typography>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={vista}
                        onChange={(_, v) => {
                            if (!v) return;
                            setVista(v);
                        }}
                    >
                        <ToggleButton value="no-elaborados">No elaborados</ToggleButton>
                        <ToggleButton value="elaborados">Elaborados</ToggleButton>
                    </ToggleButtonGroup>
                </div>

                {/* Crear nueva agrupación */}
                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <TextField
                        fullWidth
                        size="small"
                        label="Crear nueva agrupación"
                        placeholder="Nombre de la nueva agrupación"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                    />
                </div>

                {/* Lista de insumos agrupada por rubro */}
                {loading ? (
                    <Typography variant="body2">Cargando insumos...</Typography>
                ) : groupedRows.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "#777" }}>
                        No hay insumos en esta vista.
                    </Typography>
                ) : (
                    groupedRows.map((group) => {
                        const ids = (group.rows || [])
                            .map((r) => Number(r.id))
                            .filter(Number.isFinite);

                        const totalAll = ids.length;

                        // ✅ Disponibles = los que NO están ya agrupados
                        const idsDisponibles = ids.filter((id) => !yaAgrupados.has(id));
                        const totalDisponibles = idsDisponibles.length;

                        const selectedCount = idsDisponibles.filter((id) => selectedIds.has(id)).length;

                        const allSelected = totalDisponibles > 0 && selectedCount === totalDisponibles;
                        const partiallySelected = selectedCount > 0 && selectedCount < totalDisponibles;

                        return (
                            <Accordion
                                key={group.label}
                                defaultExpanded={group.label === originRubroLabel}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            width: "100%",
                                        }}
                                    >
                                        <Checkbox
                                            size="small"
                                            checked={allSelected}
                                            indeterminate={partiallySelected}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={() => toggleRubroGroup(idsDisponibles, allSelected)}
                                            disabled={totalDisponibles === 0}
                                        />

                                        <Typography variant="subtitle2" style={{ flex: 1 }}>
                                            {group.label || "Sin rubro"}{" "}
                                            <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>
                                                ({totalAll} total · {totalDisponibles} disponibles)
                                            </span>
                                        </Typography>
                                    </div>
                                </AccordionSummary>

                                <AccordionDetails>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-start",
                                            gap: 4,
                                        }}
                                    >
                                        {group.rows.map((r) => {
                                            const id = Number(r.id);
                                            const yaAgrupado = yaAgrupados.has(id);

                                            return (
                                                <FormControlLabel
                                                    key={r.id}
                                                    control={
                                                        <Checkbox
                                                            checked={selectedIds.has(id)}
                                                            onChange={() => toggleInsumo(r.id)}
                                                            size="small"
                                                            disabled={yaAgrupado}
                                                        />
                                                    }
                                                    label={
                                                        <span style={{ opacity: yaAgrupado ? 0.5 : 1 }}>
                                                            {r.nombre}{" "}
                                                            {yaAgrupado && (
                                                                <em style={{ fontSize: "0.75rem", color: "#999" }}>
                                                                    (ya agrupado)
                                                                </em>
                                                            )}
                                                            {!yaAgrupado && (
                                                                <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>
                                                                    {r.unidad_med ? `· ${r.unidad_med}` : ""}{" "}
                                                                    {r.precio_ref != null && `· $ ${formatMoney(r.precio_ref)}`}
                                                                </span>
                                                            )}
                                                        </span>
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                </AccordionDetails>
                            </Accordion>
                        );
                    })
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} disabled={saving}>
                    Cancelar
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
