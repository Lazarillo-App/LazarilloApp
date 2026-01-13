import React from "react";

export function Select({ children, value, onValueChange }) {
  return (
    <select value={value} onChange={e => onValueChange && onValueChange(e.target.value)} className="border rounded px-2 py-1">
      {children}
    </select>
  );
}
export function SelectContent({ children }) { return <>{children}</>; }
export function SelectItem({ value, children }) { return <option value={value}>{children}</option>; }
export function SelectTrigger({ children }) { return <div>{children}</div>; }
export function SelectValue({ children }) { return <span>{children}</span>; }
