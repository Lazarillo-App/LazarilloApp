// src/componentes/shared/VirtualList.jsx
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';

/**
 * VirtualList - Componente de lista virtualizada para renderizar eficientemente listas grandes.
 * rowHeight puede ser un número (todas las filas igual) o una función (row, index) => altura,
 * lo que permite filas de distinta altura (ej: encabezados más finos que las filas de datos).
 */
const VirtualList = forwardRef(function VirtualList(
  {
    rows = [],
    rowHeight = 44,
    height = 400,
    overscan = 6,
    onVisibleItemsIds,
    onScrollTop,
    renderRow,
    getRowId,
  },
  ref
) {
  const scrollRef = useRef(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [scrollTop, setScrollTop] = useState(0);

  const isFixed = typeof rowHeight !== 'function';

  // Alturas por fila y offsets acumulados (solo se recalculan si cambia rows o rowHeight)
  const { heights, offsets, totalHeight } = useMemo(() => {
    if (isFixed) {
      // Modo altura fija: no necesitamos arrays, calculamos al vuelo
      return { heights: null, offsets: null, totalHeight: rows.length * rowHeight };
    }
    const hs = new Array(rows.length);
    const offs = new Array(rows.length);
    let acc = 0;
    for (let i = 0; i < rows.length; i++) {
      const h = Number(rowHeight(rows[i], i)) || 0;
      hs[i] = h;
      offs[i] = acc;
      acc += h;
    }
    return { heights: hs, offsets: offs, totalHeight: acc };
  }, [rows, rowHeight, isFixed]);

  // Altura de una fila concreta (modo fijo o variable)
  const heightAt = (i) => (isFixed ? rowHeight : (heights?.[i] ?? 0));
  const offsetAt = (i) => {
    if (isFixed) return i * rowHeight;
    return offsets?.[i] ?? 0;
  };

  // Calcular rango de índices visibles
  const { startIdx, endIdx } = useMemo(() => {
    if (isFixed) {
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
      const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
      const end = Math.min(rows.length - 1, start + visibleCount);
      return { startIdx: start, endIdx: end };
    }
    // Modo variable: buscar por offsets acumulados
    if (!offsets || rows.length === 0) return { startIdx: 0, endIdx: -1 };
    // Primer índice cuyo fin supera scrollTop
    let start = 0;
    // búsqueda lineal desde 0 (rápida en la práctica con overscan); podría ser binaria
    while (start < rows.length - 1 && offsets[start] + heights[start] <= scrollTop) start++;
    start = Math.max(0, start - overscan);
    // Último índice cuyo inicio está antes de scrollTop + height
    const limit = scrollTop + height;
    let end = start;
    while (end < rows.length - 1 && offsets[end] < limit) end++;
    end = Math.min(rows.length - 1, end + overscan);
    return { startIdx: start, endIdx: end };
  }, [scrollTop, rowHeight, height, overscan, rows.length, isFixed, offsets, heights]);

  const offsetY = offsetAt(startIdx);
  const visibleRows = rows.slice(startIdx, endIdx + 1);

  // Callback opcional: notificar IDs visibles cuando cambian
  const prevIdsStrRef = useRef('');
  useEffect(() => {
    if (!onVisibleItemsIds) return;
    const ids = [];
    const arr = rowsRef.current;
    for (let i = startIdx; i <= endIdx; i++) {
      const r = arr[i];
      const id = getRowId?.(r);
      if (Number.isFinite(id)) ids.push(id);
    }
    const str = ids.join(',');
    if (str !== prevIdsStrRef.current) {
      prevIdsStrRef.current = str;
      onVisibleItemsIds(ids);
    }
  }, [startIdx, endIdx, getRowId, onVisibleItemsIds]);

  // Métodos imperativos para scroll programático
  useImperativeHandle(ref, () => {
    const doScrollToIndex = (idx) => {
      if (!Number.isFinite(idx)) return;
      const rowTop = offsetAt(idx);
      const top = Math.max(0, rowTop - Math.floor(height / 3));
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top, behavior: 'smooth' });
      }
      setScrollTop(top);
    };
    const doScrollToId = (id) => {
      if (!getRowId) return;
      const arr = rowsRef.current;
      let idx = -1;
      for (let i = 0; i < arr.length; i++) {
        if (Number(getRowId(arr[i])) === Number(id)) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) doScrollToIndex(idx);
    };
    return {
      scrollToIndex: doScrollToIndex,
      scrollToId: doScrollToId,
    };
  }, [getRowId, rowHeight, height, isFixed, offsets, heights]);

  return (
    <div
      ref={scrollRef}
      style={{
        height,
        overflow: 'auto',
        position: 'relative',
        willChange: 'transform',
      }}
      onScroll={(e) => { const st = e.currentTarget.scrollTop; setScrollTop(st); onScrollTop?.(st); }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleRows.map((row, i) => {
            const index = startIdx + i;
            const id = getRowId?.(row);
            const rowH = heightAt(index);
            const baseKey =
              row && row.key != null
                ? row.key
                : Number.isFinite(id)
                  ? `row-${id}-${index}`
                  : `row-${index}`;
            const reactKey = baseKey;
            return (
              <div
                key={reactKey}
                data-item-id={Number.isFinite(id) ? id : undefined}
                style={{ height: rowH, display: 'block' }}
              >
                {renderRow({
                  row,
                  index,
                  style: {
                    height: rowH,
                    display: 'block',
                  },
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default VirtualList;