// src/paginas/UploadFoto.jsx
// Página pública — se abre en el celular al escanear el QR
// No requiere autenticación. Recibe ?token=xxx por query param.

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BASE } from '@/servicios/apiBase';

const PRIMARY = '#3b82f6';

export default function UploadFoto() {
  const [searchParams] = useSearchParams();
  const token     = searchParams.get('token');
  const insumo    = searchParams.get('insumo') || 'ingrediente';

  const [estado, setEstado]       = useState('idle'); // idle | uploading | ok | error | expired
  const [mensaje, setMensaje]     = useState('');
  const [preview, setPreview]     = useState(null);
  const [fotosSubidas, setFotosSubidas] = useState(0);
  const fileInputRef = useRef(null);

  // Validar token al montar
  useEffect(() => {
    if (!token) { setEstado('expired'); return; }
    // Hacemos un GET al endpoint de polling solo para verificar que el token existe
    fetch(`${BASE}/recetas/0/fotos-pendientes?token=${token}&supplyId=0`)
      .then(r => { if (r.status === 400 || r.status === 401) setEstado('expired'); })
      .catch(() => { /* red — dejamos que intenten subir igual */ });
  }, [token]);

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    setEstado('uploading');
    setMensaje('');

    let subidas = 0;
    let errores = 0;

    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);

        const res = await fetch(`${BASE}/recetas/upload-publico?token=${token}`, {
          method: 'POST',
          body: fd,
        });

        if (res.status === 401) { setEstado('expired'); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (data.ok) {
          subidas++;
          // Mostrar preview de la última foto subida
          const reader = new FileReader();
          reader.onload = (ev) => setPreview(ev.target.result);
          reader.readAsDataURL(file);
        } else {
          errores++;
        }
      } catch {
        errores++;
      }
    }

    setFotosSubidas(prev => prev + subidas);

    if (subidas > 0 && errores === 0) {
      setEstado('ok');
      setMensaje(subidas === 1 ? '¡Foto enviada!' : `¡${subidas} fotos enviadas!`);
    } else if (subidas > 0 && errores > 0) {
      setEstado('ok');
      setMensaje(`${subidas} foto(s) enviada(s), ${errores} fallaron.`);
    } else {
      setEstado('error');
      setMensaje('No se pudo enviar la foto. Intentá de nuevo.');
    }
  };

  // ── Layouts por estado ──

  if (estado === 'expired') {
    return (
      <Pantalla>
        <Icono>⏱️</Icono>
        <h2 style={styles.titulo}>Link vencido</h2>
        <p style={styles.subtitulo}>
          Este QR ya no es válido. Generá uno nuevo desde la receta.
        </p>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>🍽️ Lazarillo</span>
        <span style={styles.badge}>Subida de foto</span>
      </div>

      <div style={styles.card}>
        <p style={styles.insumoLabel}>Ingrediente</p>
        <h2 style={styles.insumoNombre}>{decodeURIComponent(insumo)}</h2>

        {/* Preview */}
        {preview && (
          <div style={styles.previewBox}>
            <img src={preview} alt="Preview" style={styles.previewImg} />
          </div>
        )}

        {/* Contador */}
        {fotosSubidas > 0 && (
          <div style={styles.contador}>
            ✅ {fotosSubidas} foto{fotosSubidas !== 1 ? 's' : ''} enviada{fotosSubidas !== 1 ? 's' : ''}
          </div>
        )}

        {/* Mensaje de estado */}
        {mensaje && (
          <div style={{
            ...styles.mensajeBox,
            background: estado === 'error' ? '#fef2f2' : '#f0fdf4',
            color: estado === 'error' ? '#dc2626' : '#16a34a',
            border: `1px solid ${estado === 'error' ? '#fecaca' : '#bbf7d0'}`,
          }}>
            {mensaje}
          </div>
        )}

        {/* Botones */}
        <div style={styles.botonesBox}>
          {estado === 'uploading' ? (
            <div style={styles.uploading}>
              <Spinner />
              <span>Subiendo…</span>
            </div>
          ) : (
            <>
              {/* Cámara — abre directo la cámara en mobile */}
              <button
                style={{ ...styles.btn, background: PRIMARY }}
                onClick={() => fileInputRef.current?.click()}
              >
                📷 {fotosSubidas > 0 ? 'Sacar otra foto' : 'Sacar foto'}
              </button>

              {/* Galería */}
              <button
                style={{ ...styles.btn, background: '#64748b' }}
                onClick={() => fileInputRef.current?.click()}
              >
                🖼️ Elegir de galería
              </button>
            </>
          )}
        </div>

        <p style={styles.hint}>
          La foto se agrega automáticamente a la receta en la computadora.
        </p>
      </div>

      {/* Input oculto — capture="environment" abre cámara trasera en mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </Pantalla>
  );
}

/* ── Sub-componentes simples ── */

function Pantalla({ children }) {
  return (
    <div style={styles.pantalla}>
      {children}
    </div>
  );
}

function Icono({ children }) {
  return <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 12 }}>{children}</div>;
}

function Spinner() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: '3px solid #e2e8f0',
      borderTopColor: PRIMARY,
      animation: 'spin 0.7s linear infinite',
      display: 'inline-block',
    }} />
  );
}

/* ── Estilos inline (sin dependencias de MUI — la página tiene que funcionar sin tema) ── */
const styles = {
  pantalla: {
    minHeight: '100dvh',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px 40px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    fontWeight: 800,
    fontSize: '1.1rem',
    color: '#1e293b',
  },
  badge: {
    fontSize: '0.72rem',
    fontWeight: 600,
    background: `${PRIMARY}18`,
    color: PRIMARY,
    borderRadius: 20,
    padding: '3px 10px',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '28px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  insumoLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    margin: 0,
  },
  insumoNombre: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#1e293b',
    margin: 0,
    lineHeight: 1.2,
  },
  previewBox: {
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
  },
  previewImg: {
    width: '100%',
    maxHeight: 260,
    objectFit: 'cover',
    display: 'block',
  },
  contador: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#16a34a',
    textAlign: 'center',
  },
  mensajeBox: {
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.88rem',
    fontWeight: 500,
    textAlign: 'center',
  },
  botonesBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  btn: {
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    padding: '14px 20px',
    cursor: 'pointer',
    width: '100%',
    letterSpacing: 0.3,
  },
  uploading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '14px 0',
    color: '#64748b',
    fontSize: '0.95rem',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
  },
  titulo: {
    fontSize: '1.3rem',
    fontWeight: 800,
    color: '#1e293b',
    textAlign: 'center',
    margin: '0 0 8px',
  },
  subtitulo: {
    fontSize: '0.9rem',
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 1.5,
  },
};

// CSS para la animación del spinner (se inyecta una vez)
if (typeof document !== 'undefined' && !document.getElementById('upload-foto-spin')) {
  const style = document.createElement('style');
  style.id = 'upload-foto-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}