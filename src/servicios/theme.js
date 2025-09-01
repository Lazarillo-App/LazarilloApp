export function applyBusinessTheme(biz) {
  const root = document.documentElement;
  const color = biz?.color_hex || '#0ea5e9';
  root.style.setProperty('--brand', color);

  // Fuente (Google Fonts simple)
  if (biz?.brand_font) {
    const id = 'brand-font-link';
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    const family = encodeURIComponent(biz.brand_font.replaceAll('"','').trim());
    link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;600&display=swap`;
    root.style.setProperty('--brand-font', biz.brand_font);
  }
}
