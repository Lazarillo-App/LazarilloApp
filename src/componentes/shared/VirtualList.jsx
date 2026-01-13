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
 * VirtualList - Componente de lista virtualizada para renderizar eficientemente listas grandes
 */
const VirtualList = forwardRef(function VirtualList(
  {
    rows = [],
    rowHeight = 44,
    height = 400,
    overscan = 6,
    onVisibleItemsIds,
    renderRow,
    getRowId,

    // ✅ NUEVO: cualquier “gatillo” externo para forzar refresh (ventas, filtros, etc.)
    extraData = 0,
  },
  ref
) {
  const scrollRef = useRef(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = rows.length * rowHeight;

  // Calcular rango de índices visibles
  const { startIdx, endIdx } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
    const end = Math.min(rows.length - 1, start + visibleCount);
    return { startIdx: start, endIdx: end };
  }, [scrollTop, rowHeight, height, overscan, rows.length]);

  const offsetY = startIdx * rowHeight;
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
    // ✅ extraData NO hace falta acá: visibles no dependen de ventas.
  }, [startIdx, endIdx, getRowId, onVisibleItemsIds]);

  // Métodos imperativos para scroll programático
  useImperativeHandle(ref, () => {
    const doScrollToIndex = (idx) => {
      if (!Number.isFinite(idx)) return;
      const top = Math.max(0, idx * rowHeight - Math.floor(height / 3));
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
  }, [getRowId, rowHeight, height]);

  return (
    <div
      ref={scrollRef}
      style={{
        height,
        overflow: 'auto',
        position: 'relative',
        willChange: 'transform',
      }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleRows.map((row, i) => {
            const index = startIdx + i;
            const id = getRowId?.(row);

            // Key base: prioriza row.key si existe, sino usa ID o índice
            const baseKey =
              row && row.key != null
                ? row.key
                : Number.isFinite(id)
                  ? `row-${id}-${index}`
                  : `row-${index}`;

            // ✅ CLAVE: incluir extraData para forzar que React reconstruya la fila
            // (ideal para cosas memoizadas/adentro como VentasCell)
            const reactKey = `${baseKey}|v${extraData}`;

            return (
              <div
                key={reactKey}
                data-item-id={Number.isFinite(id) ? id : undefined}
                style={{ height: rowHeight, display: 'block' }}
              >
                {renderRow({
                  row,
                  index,
                  style: {
                    height: rowHeight,
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
