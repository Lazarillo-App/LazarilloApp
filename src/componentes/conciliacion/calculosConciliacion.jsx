/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, react-refresh/only-export-components -- partes de ModuloConciliacion.jsx (separadas sin cambiar lógica, 15/11/2026) */
/* Cálculos de la conciliación (lo de adentro de los useMemo de ModuloConciliacion). Funciones puras: reciben todo por parámetro. */
import { esMP, fmtFecha, pagadorCoincide } from './motorConciliacion';

// ccPorDia (useMemo de ModuloConciliacion)
// 19/11 (Diego, Comercio): «en ese sector no me interesa su deuda (la consulto en su cuenta); necesito
// los registros de PAGO de ese día para usarlos en la conciliación». Antes se listaban los tickets
// vendidos a cuenta corriente ese día; ahora, cada COBRO del 72 hecho por Mercado Pago ese día (fecha
// de cobro), suelto, para tildarlo junto con la venta del día y el pago del banco (ej. montaldo 18/11:
// venta $21.440 + cobro de su cuenta $11.600 = transferencia $33.040). Efectivo/retiros no pasan
// por el banco: no se listan.
export function calcCcPorDia({ ccConc, data }) {
    const m = {};
    (data.pagos || []).forEach((p) => {
      if (!esMP(p) || !p.fecha) return;
      const conc = ccConc.has(p.id);
      (m[p.fecha] = m[p.fecha] || { items: [], total: 0 }).items.push({
        key: "c-" + p.id, tipo: "cobro", cliente: p.cliente, comp: p.comp, hora: p.hora, imp: p.imp,
        saldado: conc, estado: conc ? "conciliado" : "pendiente", formas: [], cobroIds: conc ? [] : [p.id],
        cobroFecha: p.fecha, cobrado: p.imp, ticketFecha: p.fechaFact,
      });
    });
    Object.values(m).forEach((d) => { d.items.sort((a, b) => (a.cliente || "").localeCompare(b.cliente || "") || b.imp - a.imp); d.total = d.items.reduce((a, r) => a + r.imp, 0); });
    return m;
  }

// difSigno (useMemo de ModuloConciliacion)
export function calcDifSigno({ result, tipDe }) {
    if (!result) return { deMas: 0, deMenos: 0, signo: {} };
    const { V, B } = result;
    const par = {};
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const link = (a, b) => { if (par[a] === undefined) par[a] = a; if (par[b] === undefined) par[b] = b; par[find(a)] = find(b); };
    V.filter((v) => v.status === "ok").forEach((v) => { if (par[v.id] === undefined) par[v.id] = v.id; (v.matchedWith || []).forEach((bid) => link(v.id, bid)); });
    const clu = {};
    V.filter((v) => v.status === "ok").forEach((v) => { const r = find(v.id); (clu[r] = clu[r] || { i: 0, b: 0, ids: [] }); clu[r].i += v.imp; clu[r].ids.push(v.id); });
    B.filter((b) => b.status === "ok" && par[b.id] !== undefined).forEach((b) => { const r = find(b.id); (clu[r] = clu[r] || { i: 0, b: 0, ids: [] }); clu[r].b += (b.imp - tipDe(b)); clu[r].ids.push(b.id); });
    let deMas = 0, deMenos = 0; const signo = {};
    Object.values(clu).forEach((c) => { const d = c.b - c.i; const s = d > 0 ? "mas" : d < 0 ? "menos" : "cero"; if (d > 0) deMas += d; else if (d < 0) deMenos += -d; c.ids.forEach((id) => (signo[id] = s)); });
    return { deMas, deMenos, signo };
  }

// view (useMemo de ModuloConciliacion)
export function calcView({ colFilterB, colFilterV, difFiltro, difSigno, filterB, filterV, margenTipo, margenVal, result, sortB, sortV, subFilterV }) {
    if (!result) return null;
    const { V, B } = result;
    let fV = V.filter((v) => (filterV === "ok" ? v.status === "ok" : filterV === "pend" ? v.status === "pend" : true));
    if (filterV !== "pend" && subFilterV !== "all") {
      fV = fV.filter((v) => {
        if (v.status !== "ok") return false;
        const n = (v.matchedWith || []).length;
        if (subFilterV === "cupon") return v.matchTipo === "cupon";
        if (subFilterV === "uno") return n === 1 && v.matchTipo !== "manual" && v.matchTipo !== "cliente" && v.matchTipo !== "combinado" && v.matchTipo !== "cupon";
        if (subFilterV === "iguales") return v.matchTipo === "iguales";
        if (subFilterV === "consecutivos") return v.matchTipo === "consecutivos" && !v.porHora;
        if (subFilterV === "porhora") return v.matchTipo === "consecutivos" && v.porHora;
        if (subFilterV === "cliente") return v.matchTipo === "cliente";
        if (subFilterV === "combinado") return v.matchTipo === "combinado";
        if (subFilterV === "manual") return v.matchTipo === "manual";
        if (subFilterV === "faltante") {
          // "con faltante": conciliado cuya diferencia supera el margen configurado
          const m = margenTipo === "pct" ? Math.round(v.imp * margenVal / 100) : margenVal;
          return v.manual && Math.abs(v.manualDif || 0) > m;
        }
        return true;
      });
    }
    // filtro por signo de diferencia (a favor / en contra), sobre conciliadas
    if (filterV !== "pend" && difFiltro) {
      fV = fV.filter((v) => v.status === "ok" && difSigno.signo[v.id] === difFiltro);
    }
    let fB;
    const viendoConc = filterV === "ok" || (filterV !== "pend" && subFilterV !== "all") || (filterV !== "pend" && !!difFiltro);
    if (viendoConc) {
      const ids = new Set(); fV.forEach((v) => (v.matchedWith || []).forEach((id) => ids.add(id)));
      fB = B.filter((b) => ids.has(b.id));
    } else if (filterV === "pend") {
      fB = B.filter((b) => b.status === "pend");
    } else {
      fB = B.filter((b) => (filterB === "all" ? true : b.status === filterB));
    }
    // valor mostrado de una celda (para filtrar por columna, coincide con lo visible)
    const cellVal = (row, campo) => {
      if (campo === "origenLbl") return row.origen === "cc" ? "CC" : "VD";
      if (campo === "fecha") return fmtFecha(row.fecha);
      if (campo === "fechaFact") return fmtFecha(row.fechaFact || row.fecha);
      if (campo === "cobro") return row.origen === "cc" ? "Cuenta corriente" : (row.cobro || "—");
      const v = row[campo];
      return v === undefined || v === null || v === "" ? "—" : String(v);
    };
    // aplicar filtros por columna (colFilter guarda los valores EXCLUIDOS)
    const applyColFilter = (arr, cf) => {
      const campos = Object.keys(cf).filter((k) => cf[k] && cf[k].size);
      if (!campos.length) return arr;
      return arr.filter((row) => campos.every((campo) => !cf[campo].has(cellVal(row, campo))));
    };
    fV = applyColFilter(fV, colFilterV);
    fB = applyColFilter(fB, colFilterB);

    // valor de orden: coincide con lo que se muestra (fecha de factura cae a fecha
    // de pago en las ventas), importe numérico, resto como texto con orden natural
    const sortVal = (row, campo) => {
      if (campo === "imp") return row.imp;
      if (campo === "fechaFact") return row.fechaFact || row.fecha || "";
      const v = row[campo];
      return v == null ? "" : v;
    };
    const sr = (arr, s) => arr.slice().sort((x, y) => {
      const vx = sortVal(x, s.campo), vy = sortVal(y, s.campo);
      if (typeof vx === "number" && typeof vy === "number") return (vx - vy) * s.dir;
      return String(vx).localeCompare(String(vy), "es", { numeric: true }) * s.dir;
    });
    return { fV: sr(fV, sortV), fB: sr(fB, sortB), V, B };
  }

// sugerencias (useMemo de ModuloConciliacion)
export function calcSugerencias({ ccConc, conocePagador, data, dayCenter, dayWindow, margenTipo, margenVal, result, sugDescartadas, sugerir, tipDe }) {
    if (!sugerir || !result || !dayCenter) return [];
    const win = dayWindow();
    // las cobranzas de cuenta corriente del día (todavía no conciliadas) también son
    // candidatas: van con id "cc-<id>" y al aplicar se concilian igual que a mano.
    const ccP = (data.pagos || []).filter((p) => esMP(p) && !ccConc.has(p.id) && win.includes(p.fecha))
      .map((p) => ({ id: "cc-" + p.id, origen: "cc", imp: p.imp, cliente: p.cliente, comp: p.comp, fecha: p.fecha, ccCobranza: p.id }));
    const ingP = [...result.V.filter((v) => v.status === "pend" && win.includes(v.fecha)), ...ccP];
    const banP = result.B.filter((b) => b.status === "pend" && win.includes(b.fecha)).map((b) => ({ ...b, imp: b.imp - tipDe(b) })).filter((b) => b.imp > 0);
    const margenDe = (base) => margenTipo === "pct" ? Math.round(base * margenVal / 100) : margenVal;
    // busca un subconjunto de 2..maxN ingresos (ordenados asc) que sume ~target dentro
    // del margen; prefiere menos elementos. Con poda por suma parcial (cand ordenado).
    const comboIng = (cand, target, margen, maxN) => {
      const n = cand.length;
      for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { const s = cand[a].imp + cand[c].imp; if (s - target > margen) break; if (Math.abs(s - target) <= margen) return [cand[a], cand[c]]; }
      for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { const s2 = cand[a].imp + cand[c].imp; if (s2 - target > margen) break; for (let e = c + 1; e < n; e++) { const s = s2 + cand[e].imp; if (s - target > margen) break; if (Math.abs(s - target) <= margen) return [cand[a], cand[c], cand[e]]; } }
      if (maxN >= 4) for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { const s2 = cand[a].imp + cand[c].imp; if (s2 - target > margen) break; for (let e = c + 1; e < n; e++) { const s3 = s2 + cand[e].imp; if (s3 - target > margen) break; for (let g = e + 1; g < n; g++) { const s = s3 + cand[g].imp; if (s - target > margen) break; if (Math.abs(s - target) <= margen) return [cand[a], cand[c], cand[e], cand[g]]; } } }
      return null;
    };
    const out = [];
    const usadosBan = new Set(), usadosIng = new Set();

    // helper: agrupa banco por importe (para detectar N iguales rápido)
    const banPorImp = {};
    banP.forEach((b) => { (banPorImp[b.imp] = banPorImp[b.imp] || []).push(b); });

    // 0) varios ingresos → 1 banco EXACTO (prioridad): que un match flojo del paso 1
    // no consuma ingresos que forman una combinación exacta (2, 3 o 4).
    banP.slice().sort((a, b) => b.imp - a.imp).forEach((b) => {
      if (usadosBan.has(b.id)) return;
      const cand = ingP.filter((v) => !usadosIng.has(v.id)).sort((x, y) => x.imp - y.imp);
      const grupo = comboIng(cand, b.imp, 0, 4);
      if (grupo && grupo.length >= 2) {
        const ids = grupo.map((g) => g.id);
        const key = "s:" + ids.join(",") + ":" + b.id;
        if (!sugDescartadas.has(key)) {
          const tot = grupo.reduce((a, g) => a + g.imp, 0);
          out.push({ key, ingIds: ids, banIds: [b.id], ingTotal: tot, banTotal: b.imp, dif: 0, tipo: grupo.length + " ingresos" });
          ids.forEach((id) => usadosIng.add(id)); usadosBan.add(b.id);
        }
      }
    });

    // 1) 1 ingreso ↔ combinación de banco
    ingP.slice().sort((a, b) => b.imp - a.imp).forEach((v) => {
      if (usadosIng.has(v.id)) return;
      const margen = margenDe(v.imp);
      let match = null;

      // 1-a-1 exacto/cercano — preferir un banco cuyo PAGADOR coincida con el cliente
      const cands1 = banP.filter((b) => !usadosBan.has(b.id) && Math.abs(b.imp - v.imp) <= margen);
      const uno = cands1.find((b) => pagadorCoincide(v.cliente, b.cliente)) || cands1[0];
      if (uno) match = { banIds: [uno.id], banTotal: uno.imp, tipo: uno.imp === v.imp ? "1 a 1 exacto" : "1 a 1" };

      // N iguales (o MÚLTIPLOS del base) cuyo total ≈ ingreso
      if (!match) {
        const disp = banP.filter((b) => !usadosBan.has(b.id));
        const cnt = {};
        disp.forEach((b) => { cnt[b.imp] = (cnt[b.imp] || 0) + 1; });
        const bases = [...new Set(disp.map((b) => b.imp))].filter((x) => cnt[x] >= 3).sort((a, b) => a - b);
        for (const base of bases) {
          const muls = disp.filter((b) => b.imp % base === 0);
          if (muls.length < 2) continue;
          const U = Math.round(v.imp / base);
          if (U < 2 || Math.abs(U * base - v.imp) > margen) continue;
          let reach = { 0: [] };
          for (const it of muls) {
            const u = it.imp / base;
            for (const su of Object.keys(reach)) {
              const ns = Number(su) + u;
              if (ns <= U && !reach[ns]) reach[ns] = reach[su].concat(it);
            }
            if (reach[U]) break;
          }
          if (reach[U] && reach[U].length >= 2) {
            const tomar = reach[U];
            match = { banIds: tomar.map((b) => b.id), banTotal: tomar.reduce((a, b) => a + b.imp, 0), tipo: "×" + tomar.length + " iguales" };
            break;
          }
        }
      }

      // combinación de 2-3 distintos
      if (!match) {
        const cand = banP.filter((b) => !usadosBan.has(b.id)).sort((a, b) => a.ord - b.ord);
        for (let a = 0; a < cand.length && !match; a++)
          for (let b = a + 1; b < cand.length && !match; b++) {
            if (Math.abs(cand[a].imp + cand[b].imp - v.imp) <= margen)
              match = { banIds: [cand[a].id, cand[b].id], banTotal: cand[a].imp + cand[b].imp, tipo: "2 movimientos" };
            else for (let c = b + 1; c < cand.length && !match; c++)
              if (Math.abs(cand[a].imp + cand[b].imp + cand[c].imp - v.imp) <= margen)
                match = { banIds: [cand[a].id, cand[b].id, cand[c].id], banTotal: cand[a].imp + cand[b].imp + cand[c].imp, tipo: "3 movimientos" };
          }
      }

      if (match) {
        const key = "s:" + v.id + ":" + match.banIds.join(",");
        if (!sugDescartadas.has(key)) {
          out.push({ key, ingIds: [v.id], banIds: match.banIds, ingTotal: v.imp, banTotal: match.banTotal, dif: v.imp - match.banTotal, tipo: match.tipo });
          usadosIng.add(v.id); match.banIds.forEach((id) => usadosBan.add(id));
        }
      }
    });

    // 2) varios ingresos ↔ 1 movimiento de banco (2, 3 o 4 ingresos)
    banP.slice().sort((a, b) => b.imp - a.imp).forEach((b) => {
      if (usadosBan.has(b.id)) return;
      const margen = margenDe(b.imp);
      const cand = ingP.filter((v) => !usadosIng.has(v.id)).sort((x, y) => x.imp - y.imp);
      const grupo = comboIng(cand, b.imp, margen, 4);
      if (grupo && grupo.length >= 2) {
        const ids = grupo.map((g) => g.id);
        const key = "s:" + ids.join(",") + ":" + b.id;
        if (!sugDescartadas.has(key)) {
          const tot = grupo.reduce((a, g) => a + g.imp, 0);
          out.push({ key, ingIds: ids, banIds: [b.id], ingTotal: tot, banTotal: b.imp, dif: tot - b.imp, tipo: grupo.length + " ingresos" });
          ids.forEach((id) => usadosIng.add(id)); usadosBan.add(b.id);
        }
      }
    });

    // distancia en días de cada par (entre la fecha del ingreso y la del banco),
    // para poder agruparlas por "mismo día", "con 1 día", etc.
    const fechaOf = {};
    result.V.forEach((v) => (fechaOf[v.id] = v.fecha));
    result.B.forEach((b) => (fechaOf[b.id] = b.fecha));
    ccP.forEach((v) => (fechaOf[v.id] = v.fecha));
    const cliOf = {};
    result.V.forEach((v) => (cliOf[v.id] = v.cliente));
    result.B.forEach((b) => (cliOf[b.id] = b.cliente));
    ccP.forEach((v) => (cliOf[v.id] = v.cliente));
    const dd = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
    out.forEach((s) => {
      let m = 0;
      s.ingIds.forEach((iv) => s.banIds.forEach((ib) => { m = Math.max(m, dd(fechaOf[iv], fechaOf[ib])); }));
      s.distDias = Math.round(m);
    });
    // PROBABILIDAD: reglas limpias (1 a 1, N iguales) valen más que las combinaciones;
    // importe exacto vale más que con diferencia; mismo día vale más que ±N; y si el
    // PAGADOR del banco coincide con el cliente del ingreso, sube fuerte (señal fuerte).
    out.forEach((s) => {
      s.mismoPagador = s.ingIds.some((iv) => s.banIds.some((ib) => pagadorCoincide(cliOf[iv], cliOf[ib])
        || conocePagador(cliOf[iv], cliOf[ib]))); // por nombre o por la memoria de la cuenta
      const relDif = s.ingTotal ? Math.abs(s.dif) / s.ingTotal : 0;
      const margenRel = margenTipo === "pct" ? margenVal / 100 : (s.ingTotal ? margenVal / s.ingTotal : 0.02);
      const cercania = margenRel > 0 ? Math.max(0, Math.min(1, 1 - relDif / margenRel)) : (relDif === 0 ? 1 : 0);
      const limpio = /1 a 1|iguales/.test(s.tipo); // patrones que ya conocemos
      const factorDia = s.distDias === 0 ? 1 : s.distDias === 1 ? 0.9 : 0.78;
      let p = (limpio ? 0.92 : 0.72) * (0.55 + 0.45 * cercania) * factorDia;
      if (s.mismoPagador) p = Math.min(0.99, p + 0.12); // mismo pagador: señal fuerte
      if (s.dif === 0 && limpio && s.distDias === 0) p = Math.max(p, 0.98); // regla limpia + exacto + mismo día ≈ seguro
      else if (s.dif === 0 && s.distDias === 0) p = Math.max(p, 0.9); // combinación exacta del mismo día: muy probable
      s.limpio = limpio;
      s.conCC = s.ingIds.some((id) => id.startsWith("cc-")); // incluye cobranza de cuenta corriente
      s.prob = Math.round(Math.max(0.3, Math.min(0.99, p)) * 100);
    });
    // una sugerencia debe involucrar el día en foco (dayCenter) en al menos un lado.
    // Así, con "mismo día" solo salen pares del día; con ±N, el día en foco cruzando
    // con vecinos. Los pares íntegramente de otro día se ven al navegar a ese día.
    const tocaFoco = (s) => s.ingIds.some((id) => fechaOf[id] === dayCenter) || s.banIds.some((id) => fechaOf[id] === dayCenter);
    const outFoco = out.filter(tocaFoco);
    outFoco.sort((a, b) => a.distDias - b.distDias || b.prob - a.prob || Math.abs(a.dif) - Math.abs(b.dif));

    return outFoco;
  }

// barTotals (useMemo de ModuloConciliacion)
export function calcBarTotals({ dayCenter, dayView, faltantes, filterV, result }) {
    if (!result) return { ing: 0, ban: 0, ctxIng: "", ctxBan: "" };
    const pendV = result.V.filter((v) => v.status === "pend");
    const pendB = result.B.filter((b) => b.status === "pend");
    const perIng = pendV.reduce((a, v) => a + v.imp, 0) + faltantes.reduce((a, f) => a + f.monto, 0);
    const perBan = pendB.reduce((a, b) => a + b.imp, 0);
    const enDia = dayView && filterV === "pend" && dayCenter;
    if (enDia) {
      const ing = pendV.filter((v) => v.fecha === dayCenter).reduce((a, v) => a + v.imp, 0)
        + faltantes.filter((f) => f.fecha === dayCenter).reduce((a, f) => a + f.monto, 0);
      const ban = pendB.filter((b) => b.fecha === dayCenter).reduce((a, b) => a + b.imp, 0);
      return { ing, ban, ctxIng: "pendientes del día", ctxBan: "pendientes del día", refIng: perIng, refBan: perBan,
        cntIng: pendV.filter((v) => v.fecha === dayCenter).length, cntBan: pendB.filter((b) => b.fecha === dayCenter).length,
        cntIngRef: pendV.length, cntBanRef: pendB.length };
    }
    return { ing: perIng, ban: perBan, ctxIng: "pendientes del período", ctxBan: "pendientes del período",
      cntIng: pendV.length, cntBan: pendB.length };
  }

// resComp (useMemo de ModuloConciliacion)
export function calcResComp({ busqComp, ccConc, data, efecById, efecReclas, result }) {
    const q = busqComp.trim().toLowerCase();
    if (q.length < 2 || !result) return [];
    const soloNum = /^[\d.,$\s]+$/.test(q); const qn = q.replace(/[^\d]/g, "");
    const hit = (comp, cli, imp) => (comp && String(comp).toLowerCase().includes(q)) || (cli && String(cli).toLowerCase().includes(q)) || (soloNum && qn.length >= 3 && String(imp).includes(qn));
    const out = [];
    result.V.forEach((v) => { if (hit(v.comp, v.cliente, v.imp)) out.push({ tipo: "ing", row: v, fecha: v.fecha, hora: v.hora, nombre: v.cliente, comp: v.comp, imp: v.imp, estado: v.status === "ok" ? "ok" : "pend", forma: v.origen === "cc" ? "Cta. cte." : v.origen === "efec" ? "Efectivo" : "MercadoPago" }); });
    Object.values(efecById).forEach((f) => { if (!efecReclas.has(f.id) && hit(f.comp, f.cli, f.total)) out.push({ tipo: "efec", row: f, fecha: f.fecha, hora: f.hora, nombre: f.cli, comp: f.comp, imp: f.total, estado: "efec", forma: "Efectivo" }); });
    (data.pagos || []).forEach((x) => { if (esMP(x) && !ccConc.has(x.id) && hit(x.comp, x.cliente, x.imp)) out.push({ tipo: "cc", row: x, fecha: x.fecha, hora: x.hora, nombre: x.cliente, comp: x.comp, imp: x.imp, estado: "cc", forma: "Cta. cte." }); });
    return out.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.hora || "").localeCompare(b.hora || "")).slice(0, 40);
  }
