export default function PaginationBar({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:16 }}>
      <span>Página {page} / {pages}</span>
      <button disabled={!canPrev} onClick={() => onPage(page - 1)}>Anterior</button>
      <button disabled={!canNext} onClick={() => onPage(page + 1)}>Siguiente</button>
    </div>
  );
}
