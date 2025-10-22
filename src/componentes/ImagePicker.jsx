// src/componentes/ImagePicker.jsx
import React, { useRef, useState } from 'react';

export default function ImagePicker({
  label = 'Logo',
  value,
  onChange,           // recibe la URL final
  onUpload,           // async (File) => url (lo llama cuando eligen archivo)
  help = 'Pegá una URL o subí un archivo',
  accept = 'image/*',
  rounded = '12px',
  size = 96,
}) {
  const fileRef = useRef(null);
  const [err, setErr] = useState('');

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr('');
    try {
      // validaciones básicas
      if (!f.type.startsWith('image/')) throw new Error('Formato no válido');
      if (f.size > 4 * 1024 * 1024) throw new Error('Máx 4MB');

      const url = await onUpload?.(f);
      if (url) onChange?.(url);
    } catch (e2) {
      setErr(e2?.message || 'No se pudo subir la imagen.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="ip-wrap">
      <label className="ip-label">{label}</label>

      <div className="ip-row">
        <div
          className="ip-preview"
          style={{
            width: size, height: size, borderRadius: rounded,
            background: '#f3f4f6', border: '1px solid #e5e7eb',
            overflow: 'hidden', display: 'grid', placeItems: 'center',
          }}
          onClick={pickFile}
          title="Subir archivo"
        >
          {value ? (
            <img src={value} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 12, color: '#64748b' }}>Sin imagen</span>
          )}
        </div>

        <div className="ip-fields">
          <input
            className="ip-input"
            placeholder="https://…/logo.png"
            value={value || ''}
            onChange={(e)=>onChange?.(e.target.value)}
          />
          <div className="ip-actions">
            <button type="button" className="ip-btn" onClick={pickFile}>Subir archivo</button>
            <span className="ip-help">{help}</span>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept={accept} hidden onChange={handleFile} />
      {err && <div className="ip-err">{err}</div>}

      <style>{`
        .ip-wrap{display:grid;gap:6px}
        .ip-label{font-weight:600;font-size:.9rem}
        .ip-row{display:flex;gap:12px;align-items:center}
        .ip-fields{flex:1;display:grid;gap:6px}
        .ip-input{width:100%;padding:10px;border-radius:10px;border:1px solid #dfe3e6;background:#fff}
        .ip-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .ip-btn{border:0;border-radius:10px;padding:8px 12px;background:#111;color:#fff;cursor:pointer}
        .ip-help{font-size:12px;color:#6b7280}
        .ip-err{color:#b42318;background:#ffebe9;border:1px solid #ffb3b3;padding:6px;border-radius:8px}
      `}</style>
    </div>
  );
}
