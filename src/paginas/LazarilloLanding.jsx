// LazarilloLanding.jsx — Adaptado para React Router
// Botón "Ingresar" navega a /login
// Botones de contacto abren un modal funcional

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import LOGO from '@/assets/brand/logo.png';
import DOG from '@/assets/brand/anthony.png';

const css = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Archivo:wght@300;400;500;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
:root{--navy:#12111F;--navy2:#1B1A2E;--ink:#15213E;--sky:#5BC2EA;--skydeep:#2492C8;--paper:#F2F4F7;--body:#3C4150;--line:rgba(21,33,62,.12);}
html{scroll-behavior:smooth;}
body{font-family:'Archivo',system-ui,-apple-system,sans-serif;color:var(--body);background:#fff;-webkit-font-smoothing:antialiased;line-height:1.5;}
.wrap{max-width:1120px;margin:0 auto;padding:0 28px;}
h1,h2,h3,.kick,.btn{font-family:'Sora',system-ui,sans-serif;}
.kick{font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:600;color:var(--skydeep);}
.btn{display:inline-block;font-weight:600;font-size:16px;text-decoration:none;border-radius:50px;padding:14px 28px;transition:transform .15s ease, box-shadow .15s ease;cursor:pointer;border:none;font-family:'Sora',system-ui,sans-serif;}
.btn-sky{background:var(--sky);color:var(--ink);box-shadow:0 8px 24px rgba(91,194,234,.35);}
.btn-sky:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(91,194,234,.5);}
.btn-ghost{border:1.5px solid rgba(255,255,255,.4);color:#fff;background:transparent;}
.btn-ghost:hover{background:rgba(255,255,255,.08);}
nav{position:sticky;top:0;z-index:50;background:rgba(18,17,31,.92);backdrop-filter:blur(8px);}
nav .wrap{display:flex;align-items:center;justify-content:space-between;height:74px;}
nav img{height:40px;}
nav .btn-sky{padding:11px 22px;font-size:15px;}
.hero{background:var(--navy);color:#fff;padding:74px 0 90px;position:relative;overflow:hidden;}
.hero .wrap{display:grid;grid-template-columns:1.35fr .65fr;gap:30px;align-items:center;}
.hero h1{font-size:60px;line-height:1.07;letter-spacing:-1px;font-weight:700;margin:18px 0;}
.hero h1 span{color:var(--sky);}
.hero p{font-size:20px;color:rgba(255,255,255,.74);max-width:560px;font-weight:350;}
.hero .actions{margin-top:34px;display:flex;gap:14px;flex-wrap:wrap;}
.hero .dogwrap{display:flex;justify-content:center;}
.hero .dogwrap img{width:300px;filter:drop-shadow(0 20px 40px rgba(0,0,0,.4));}
.insight{background:var(--sky);color:var(--ink);}
.insight .wrap{padding:40px 28px;display:flex;gap:24px;align-items:center;}
.insight .q{font-family:'Sora',system-ui,sans-serif;font-weight:800;font-size:80px;line-height:.6;}
.insight p{font-size:22px;font-weight:450;}
.insight p b{font-weight:800;}
.pillars{padding:80px 0;background:var(--paper);}
.pillars h2{font-size:38px;color:var(--ink);font-weight:700;letter-spacing:-.5px;margin:10px 0 40px;}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px;}
.card .n{font-family:'Sora',system-ui,sans-serif;font-weight:700;font-size:32px;color:var(--sky);}
.card h3{font-size:20px;color:var(--ink);margin:10px 0 8px;font-weight:650;line-height:1.2;}
.card p{font-size:15.5px;color:var(--body);}
.card .soon{color:var(--skydeep);font-weight:700;}
.diff{background:var(--navy);color:#fff;padding:72px 0;}
.diff .wrap{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;}
.diff p{font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:38px;line-height:1.25;}
.diff p b{color:var(--sky);}
.diff .circle{width:230px;height:230px;border-radius:50%;background:#fff;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;}
.diff .circle img{width:215px;margin-bottom:-6px;}
.vision{padding:72px 0;background:var(--paper);text-align:center;}
.vision h2{font-size:34px;color:var(--ink);font-weight:700;margin:10px 0 14px;}
.vision p{font-size:18px;max-width:620px;margin:0 auto;}
.chips{margin-top:26px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
.chip{font-size:15px;font-weight:600;color:var(--ink);border:1px solid var(--line);border-radius:50px;padding:10px 22px;background:#fff;}
.founder{background:var(--navy2);color:#fff;padding:64px 0;}
.founder .wrap{max-width:820px;text-align:center;}
.founder p{font-family:'Sora',system-ui,sans-serif;font-weight:500;font-size:28px;line-height:1.35;}
.founder p b{color:var(--sky);}
.cta{background:var(--navy);color:#fff;padding:80px 0;text-align:center;border-top:1px solid rgba(255,255,255,.08);}
.cta h2{font-size:42px;font-weight:700;letter-spacing:-.5px;margin-bottom:10px;}
.cta .tag{font-family:'Sora',system-ui,sans-serif;letter-spacing:3px;text-transform:uppercase;font-size:14px;color:var(--sky);font-weight:600;margin-top:18px;}
.cta .actions{margin-top:28px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
footer{background:#0C0B16;color:rgba(255,255,255,.6);padding:34px 0;}
footer .wrap{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;}
footer img{height:34px;}
footer .c span{color:var(--sky);font-weight:600;}
footer .c{font-size:14px;line-height:1.8;text-align:right;}
.navactions{display:flex;gap:10px;align-items:center;}
.marquee{background:var(--navy);overflow:hidden;padding:15px 0;border-top:1px solid rgba(255,255,255,.07);}
.marquee .track{display:flex;gap:14px;width:max-content;animation:mqx 36s linear infinite;}
.marquee:hover .track{animation-play-state:paused;}
@keyframes mqx{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.mchip{flex:none;font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:14.5px;color:#fff;border:1px solid rgba(91,194,234,.5);border-radius:50px;padding:9px 20px;white-space:nowrap;}
.wa-float{position:fixed;right:24px;bottom:24px;width:62px;height:62px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(37,211,102,.45);z-index:999;transition:transform .15s ease;text-decoration:none;}
.wa-float:hover{transform:scale(1.08);}
.wa-float svg{width:34px;height:34px;}
/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;}
.modal-box{background:#fff;border-radius:20px;padding:40px;max-width:480px;width:100%;position:relative;}
.modal-box h3{font-family:'Sora',system-ui,sans-serif;font-size:24px;font-weight:700;color:var(--ink);margin-bottom:8px;}
.modal-box p{font-size:15px;color:var(--body);margin-bottom:24px;}
.modal-close{position:absolute;top:16px;right:20px;background:none;border:none;font-size:22px;cursor:pointer;color:var(--body);line-height:1;}
.modal-field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
.modal-field label{font-size:13px;font-weight:600;color:var(--ink);}
.modal-field input,.modal-field textarea{padding:12px 16px;border:1.5px solid var(--line);border-radius:10px;font-size:15px;font-family:'Archivo',system-ui,sans-serif;outline:none;transition:border-color .15s;}
.modal-field input:focus,.modal-field textarea:focus{border-color:var(--sky);}
.modal-field textarea{resize:vertical;min-height:90px;}
.modal-ok{background:var(--sky);color:var(--ink);border:none;border-radius:50px;padding:14px 32px;font-size:16px;font-weight:700;font-family:'Sora',system-ui,sans-serif;cursor:pointer;width:100%;margin-top:4px;transition:box-shadow .15s,transform .15s;}
.modal-ok:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(91,194,234,.5);}
.modal-ok:disabled{opacity:.6;cursor:not-allowed;transform:none;}
.modal-success{text-align:center;padding:20px 0;}
.modal-success .modal-check{font-size:48px;margin-bottom:12px;}
.modal-success h4{font-family:'Sora',system-ui,sans-serif;font-size:20px;font-weight:700;color:var(--ink);margin-bottom:8px;}
.modal-success p{font-size:15px;color:var(--body);}
@media(max-width:820px){
  .hero .wrap{grid-template-columns:1fr;} .hero .dogwrap{display:none;}
  .hero h1{font-size:42px;} .grid{grid-template-columns:1fr;} .navactions .btn{padding:9px 14px;font-size:13px;}
  .diff .wrap{grid-template-columns:1fr;} .diff .circle{display:none;}
  .insight .wrap{flex-direction:column;align-items:flex-start;gap:10px;}
  .diff p{font-size:28px;} .cta h2{font-size:30px;} .hero h1{font-size:38px;}
}`;

const marqueeChips = [
  "Costos reales por plato","Política de precios que se sostiene","Ingeniería de menú",
  "Tableros para cada equipo","Precios claros para el cliente","Lanzamientos sin caos",
  "Decisiones con datos","Un equipo interdependiente","Trazabilidad","Digitaliza tu gestión",
];

const pillars = [
  { n:"01", t:"Ordená tu menú como funciona tu negocio", d:"Reagrupalo por rubros y subnegocios para gestionar cada parte por separado, no todo en una misma bolsa." },
  { n:"02", t:"Definí tu política de precios", d:"La regla que sostiene tu rentabilidad en el tiempo, no una mejora de una sola vez." },
  { n:"03", t:"Recetas y costos reales", d:"Conocé cuánto te cuesta y cuánto te deja cada plato. Sin estimar a ojo: la base de toda buena decisión." },
  { n:"04", t:"Tableros que comunican solos", d:"Información clara para producción, despacho y atención —y tableros de precios listos para tus clientes." },
  { n:"05", t:"Visibilidad de tu ganancia", d:"Descubrí tus platos estrella y los que conviene rotar o sacar.", soon:" Con Anthony, nuestra IA — muy pronto." },
  { n:"06", t:"Tu negocio entero en un tablero", d:"Resultados económicos, proveedores, gastos y los KPIs clave del rubro, en un solo lugar." },
];

const visionChips = ["Compras","Recursos Humanos","Stock","Política de precios","Resultados"];
const WA = "https://wa.me/5491163989934";

// Modal de contacto
function ContactModal({ onClose }) {
  const [form, setForm] = useState({ nombre: '', restaurante: '', mensaje: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    // Simula envío — reemplazar con lógica real (email, API, etc.)
    await new Promise(r => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
  };

  const valid = form.nombre.trim().length >= 2 && form.restaurante.trim().length >= 2;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        {sent ? (
          <div className="modal-success">
            <div className="modal-check">✅</div>
            <h4>¡Listo! Te contactamos pronto.</h4>
            <p>Nos pondremos en contacto en menos de 24 h para mostrarte Lazarillo funcionando en tu restaurante.</p>
          </div>
        ) : (
          <>
            <h3>Pedí tu demo</h3>
            <p>Contanos de tu negocio y te mostramos Lazarillo funcionando sobre tu carta.</p>
            <form onSubmit={handleSubmit}>
              <div className="modal-field">
                <label htmlFor="nombre">Tu nombre</label>
                <input id="nombre" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Ana López" required />
              </div>
              <div className="modal-field">
                <label htmlFor="restaurante">Nombre del restaurante</label>
                <input id="restaurante" name="restaurante" value={form.restaurante} onChange={handleChange} placeholder="Ej: La Parrilla del Centro" required />
              </div>
              <div className="modal-field">
                <label htmlFor="mensaje">¿Qué querés mejorar? (opcional)</label>
                <textarea id="mensaje" name="mensaje" value={form.mensaje} onChange={handleChange} placeholder="Ej: quiero controlar mejor mis costos y precios." />
              </div>
              <button className="modal-ok" type="submit" disabled={!valid || sending}>
                {sending ? 'Enviando…' : 'Quiero mi demo gratuita'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function LazarilloLanding() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const openModal = (e) => { e.preventDefault(); setShowModal(true); };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {showModal && <ContactModal onClose={() => setShowModal(false)} />}

      {/* NAV */}
      <nav>
        <div className="wrap">
          <img src={LOGO} alt="Lazarillo" />
          <div className="navactions">
            <button className="btn btn-ghost" onClick={() => navigate('/login')}>Ingresar</button>
            <button className="btn btn-sky" onClick={openModal}>Pedí una demo</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap">
          <div>
            <div className="kick" style={{ color:"var(--sky)" }}>Gestión gastronómica · Para dueños de restaurantes</div>
            <h1>Tu POS te dice cuánto vendiste. <span>Lazarillo hace que te rinda.</span></h1>
            <p>Se apoya en el sistema que ya tenés y convierte los números de tu negocio en decisiones claras que todo tu equipo ve, entiende y ejecuta —todos los días.</p>
            <div className="actions">
              <button className="btn btn-sky" onClick={openModal}>Quiero verlo en mi restaurante</button>
              <a className="btn btn-ghost" href="#que-hace">Cómo funciona</a>
            </div>
          </div>
          <div className="dogwrap"><img src={DOG} alt="Anthony" /></div>
        </div>
      </header>

      {/* MARQUEE */}
      <div className="marquee">
        <div className="track">
          {[...marqueeChips, ...marqueeChips].map((c, i) => (
            <span className="mchip" key={i}>{c}</span>
          ))}
        </div>
      </div>

      {/* INSIGHT */}
      <section className="insight">
        <div className="wrap">
          <span className="q">"</span>
          <p>Lo primero que falla en un equipo es la <b>comunicación</b>. Lazarillo viene a resolver eso: convierte el corazón de tu restaurante —su menú y su ingeniería— en información clara para toda tu operación.</p>
        </div>
      </section>

      {/* PILLARS */}
      <section className="pillars" id="que-hace">
        <div className="wrap">
          <div className="kick">Qué hace por vos</div>
          <h2>Todo tu negocio, claro y comunicado.</h2>
          <div className="grid">
            {pillars.map((p) => (
              <div className="card" key={p.n}>
                <div className="n">{p.n}</div>
                <h3>{p.t}</h3>
                <p>{p.d}{p.soon && <span className="soon">{p.soon}</span>}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFF */}
      <section className="diff">
        <div className="wrap">
          <p>No es otro sistema que junta datos. Es el <b>traductor</b> entre tu negocio y la gente que lo hace funcionar.</p>
          <div className="circle"><img src={DOG} alt="Anthony" /></div>
        </div>
      </section>

      {/* VISION */}
      <section className="vision">
        <div className="wrap">
          <div className="kick">Visión</div>
          <h2>Empezás por el menú. Después, todo el negocio.</h2>
          <p>Desde el corazón del restaurante, Lazarillo se extiende a cada área que hoy no ves.</p>
          <div className="chips">
            {visionChips.map((c) => <span className="chip" key={c}>{c}</span>)}
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section className="founder">
        <div className="wrap">
          <p>Lazarillo nace de <b>más de una década</b> gestionando un restaurante propio. No es teoría: es el sistema que me hubiera gustado tener.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="contacto">
        <div className="wrap">
          <h2>Empezá a ver lo que tu negocio te esconde.</h2>
          <p style={{ color:"rgba(255,255,255,.7)", fontSize:"18px" }}>Escribinos y te mostramos Lazarillo funcionando sobre tu carta.</p>
          <div className="actions">
            <button className="btn btn-sky" onClick={openModal}>Pedí tu demo gratuita</button>
            <a className="btn btn-ghost" href={WA} target="_blank" rel="noopener">WhatsApp directo</a>
          </div>
          <div className="tag">Conectamos con lo que no ves</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <img src={LOGO} alt="Lazarillo" />
          <div className="c"><span>web</span> www.lazarillo.com.ar · <span>ig</span> <a href="https://www.instagram.com/lazarillo.erp/" target="_blank" rel="noopener" style={{ color:'var(--sky)', fontWeight:600, textDecoration:'none' }}>@lazarillo.erp</a><br />© Lazarillo · Conectamos con lo que no ves</div>
        </div>
      </footer>

      {/* WA FLOAT */}
      <a className="wa-float" href={WA} target="_blank" rel="noopener" aria-label="WhatsApp">
        <svg viewBox="0 0 32 32" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 .4C7.4.4.4 7.4.4 16c0 2.8.7 5.5 2.1 7.9L.3 31.7l8-2.1c2.3 1.3 4.9 1.9 7.6 1.9h.1c8.6 0 15.6-7 15.6-15.6 0-4.2-1.6-8.1-4.6-11C24.1 2 20.2.4 16 .4zm0 28.5h-.1c-2.4 0-4.7-.6-6.7-1.9l-.5-.3-5 1.3 1.3-4.9-.3-.5C3.3 21 2.7 18.5 2.7 16 2.7 8.7 8.7 2.8 16 2.8c3.5 0 6.8 1.4 9.3 3.9 2.5 2.5 3.9 5.8 3.9 9.3 0 7.3-6 13.2-13.2 13.2zm7.2-9.9c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.7.2-.2.2-.4.4-.6.1-.3.1-.5 0-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1 .5-.4.4-1.3 1.3-1.3 3.2s1.4 3.7 1.5 3.9c.2.3 2.7 4.2 6.6 5.9.9.4 1.6.6 2.2.8.9.3 1.8.2 2.4.2.7-.1 2.3-.9 2.6-1.9.3-.9.3-1.7.2-1.9-.1-.1-.3-.2-.7-.4z"/>
        </svg>
      </a>
    </>
  );
}