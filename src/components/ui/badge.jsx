import React from "react";

export function Badge({ children, variant = "outline", className = "" }) {
  const base = "inline-block px-2 py-0.5 text-xs rounded";
  return <span className={`${base} ${className}`}>{children}</span>;
}
