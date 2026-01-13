import React from "react";

export function Dialog({ open = true, children, onOpenChange }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center">{children}</div>;
}

export function DialogContent({ children, className = "" }) {
  return (
    <div className={`bg-white rounded shadow-lg p-4 w-full max-w-4xl ${className}`}>
      {children}
    </div>
  );
}

export function DialogHeader({ children }) {
  return <div className="mb-3">{children}</div>;
}
export function DialogTitle({ children }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}
export function DialogDescription({ children }) {
  return <p className="text-sm text-gray-600">{children}</p>;
}

