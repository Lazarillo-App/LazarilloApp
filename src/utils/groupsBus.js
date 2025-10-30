/* eslint-disable no-empty */
// utils/groupsBus.js (opcional)
export const GROUPS_EVENT = "lzr:groups:changed";
const STORAGE_KEY = "groups:version";

export function emitGroupsChanged(reason = "unknown", extra = {}) {
  if (typeof window === "undefined") return;
  const detail = { at: Date.now(), reason, ...extra };
  try { window.localStorage.setItem(STORAGE_KEY, String(detail.at)); } catch {}
  try { window.dispatchEvent(new CustomEvent(GROUPS_EVENT, { detail })); } catch {}
}

export function onGroupsChanged(handler) {
  if (typeof window === "undefined") return () => {};
  let timer = null;
  const fire = (detail) => {
    // coalesce dentro de 60ms
    clearTimeout(timer);
    timer = setTimeout(() => handler?.(detail || { at: Date.now(), reason: "event" }), 60);
  };
  const fn = (e) => fire(e?.detail);
  const storageFn = (e) => {
    if (e.key === STORAGE_KEY) fire({ at: Date.now(), reason: "storage" });
  };
  window.addEventListener(GROUPS_EVENT, fn);
  window.addEventListener("storage", storageFn);
  return () => {
    window.removeEventListener(GROUPS_EVENT, fn);
    window.removeEventListener("storage", storageFn);
  };
}
