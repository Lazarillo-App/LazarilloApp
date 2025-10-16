import React, { useEffect, useState } from 'react';
import { BusinessesAPI } from "@/servicios/apiBusinesses";

export default function MaxiCredsCard() {
  const [bid, setBid] = useState(localStorage.getItem('activeBusinessId') || '');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [codCli, setCodCli] = useState('');
  const [status, setStatus] = useState({ hasCreds: false, email: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const active = localStorage.getItem('activeBusinessId') || '';
    setBid(active);
    if (!active) return;
    BusinessesAPI.maxiStatus(active).then(setStatus).catch(console.error);
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!bid) return alert('Seleccioná un local primero');
    setBusy(true);
    try {
      await BusinessesAPI.maxiSave(bid, { email, pass, cod_cli: codCli });
      const st = await BusinessesAPI.maxiStatus(bid);
      setStatus(st);
      setEmail(''); setPass(''); setCodCli('');
      alert('Credenciales guardadas');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error guardando credenciales');
    } finally {
      setBusy(false);
    }
  };

  if (!bid) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Conexión Maxi</h3>
        <p className="text-sm text-slate-600">Primero seleccioná o creá un local.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{display:'grid', gap:12}}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Conexión Maxi</h3>
        <span className={`text-xs px-2 py-1 rounded ${status.hasCreds ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {status.hasCreds ? `Configurado (${status.email})` : 'Pendiente'}
        </span>
      </div>

      <form onSubmit={save} className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="auth-label">Email Maxi</label>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@maxi..." />
        </div>
        <div>
          <label className="auth-label">Contraseña Maxi</label>
          <input type="password" className="input" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" />
        </div>
        <div>
          <label className="auth-label">Código Cliente (cod_cli)</label>
          <input className="input" value={codCli} onChange={e=>setCodCli(e.target.value)} placeholder="14536" />
        </div>
        <div className="md:col-span-3">
          <button disabled={busy} className="btn">{busy ? 'Guardando...' : 'Guardar credenciales'}</button>
        </div>
      </form>

      <p className="text-xs text-slate-500">
        Se guardan cifradas por local. Esto habilita ventas/stock usando el negocio activo.
      </p>
    </div>
  );
}
