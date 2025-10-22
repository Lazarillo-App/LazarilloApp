import React, { useId } from 'react';

function ColorField({ id, label, value, onChange }) {
  const autoId = useId();
  const inputId = id || `color-${autoId}`;

  return (
    <div className="ge-field">
      <label htmlFor={inputId} className="ge-label">{label}</label>
      <div className="ge-color-wrap">
        <span className="ge-color-dot" style={{ backgroundColor: value }} />
        <input
          id={inputId}
          aria-label={`${label} picker`}
          type="color"
          className="ge-color-native"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={`${inputId}-hex`}
          name={`${inputId}-hex`}
          type="text"
          className="ge-input ge-input-hex"
          placeholder="#000000"
          value={value}
          onChange={(e) => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
            else onChange(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

export default ColorField;