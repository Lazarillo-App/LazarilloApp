/* eslint-disable no-empty */
const CSS_VARS = [
  "--color-primary","--color-secondary","--color-bg","--color-surface",
  "--color-border","--color-fg","--on-primary","--on-secondary"
];

export function setCssVarsFromPalette(pal = {}) {
  const root = document.documentElement;
  Object.entries(pal || {}).forEach(([k,v]) => {
    const cssVar = `--${k.replace(/_/g,"-")}`;
    if (CSS_VARS.includes(cssVar) && typeof v === "string") {
      root.style.setProperty(cssVar, v);
    }
  });
  // Derivá on-primary si faltó
  if (!pal.on_primary) {
    const primary = getVar("--color-primary") || "#111111";
    root.style.setProperty("--on-primary", contrastFor(primary));
  }
}

export function bootApplySavedPalette() {
  try {
    const user = JSON.parse(localStorage.getItem("user")||"null");
    const raw = (user?.id && localStorage.getItem(`bizTheme:${user.id}`))
              || localStorage.getItem("bizTheme");
    if (!raw) return;
    setCssVarsFromPalette(JSON.parse(raw));
  } catch {}
}

function getVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function contrastFor(hex){
  const m = String(hex||"").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i); if(!m) return "#fff";
  let s=m[1]; if(s.length===3) s=s.split("").map(c=>c+c).join("");
  const n=parseInt(s,16), r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const lin = v=>{const x=v/255; return x<=0.03928? x/12.92: Math.pow((x+0.055)/1.055,2.4);};
  const L=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  return L>0.179?"#000000":"#ffffff";
}
