import React from "react";

export function Checkbox({ checked = false, onCheckedChange, disabled }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onCheckedChange && onCheckedChange(e.target.checked)}
      disabled={disabled}
      className="w-4 h-4"
    />
  );
}
