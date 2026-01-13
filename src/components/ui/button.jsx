/* eslint-disable no-unused-vars */
import React from "react";

export function Button({ children, onClick, variant = "default", size, disabled, className = "" }) {
  const base = "inline-flex items-center justify-center px-3 py-1 rounded";
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-95";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${disabledClass} ${className}`}
    >
      {children}
    </button>
  );
}
