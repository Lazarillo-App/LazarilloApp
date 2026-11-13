// LazarilloLanding.jsx — Adaptado para React Router
// Botón "Ingresar" navega a /login
// Botones de contacto abren un modal funcional

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import LOGO from '@/assets/brand/logo.png';
import DOG from '@/assets/brand/anthony.png';
import { LOGO_CB, LOGO_FC, LOGO_CO, LOGO_MG, LOGO_LL, COLOR_CB, COLOR_CO, COLOR_FC, COLOR_MG } from '@/componentes/landing-logos';

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
.clientes{padding:80px 0;background:#fff;}
.clientes h2,.integra h2{font-size:38px;color:var(--ink);font-weight:700;letter-spacing:-.5px;margin:10px 0 12px;}
.clientes .sub,.integra .sub{font-size:18px;max-width:640px;margin-bottom:40px;}
.ccard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px;display:flex;flex-direction:column;gap:14px;box-shadow:0 10px 30px rgba(21,33,62,.06);}
.ccard .who{display:flex;align-items:center;gap:12px;}
.ccard .logo{width:46px;height:46px;border-radius:12px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Sora',system-ui,sans-serif;font-weight:800;font-size:15px;flex:none;}
.ccard .nm{font-family:'Sora',system-ui,sans-serif;font-weight:700;font-size:17px;color:var(--ink);line-height:1.2;}
.ccard .rb{font-size:13.5px;color:#7a8396;}
.ccard .big.txt{font-size:34px;letter-spacing:-.5px;line-height:1.1;}
.ccard .ck{font-family:'Sora',system-ui,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;color:var(--skydeep);text-transform:uppercase;margin-top:6px;}
.ccard .big{font-family:'Sora',system-ui,sans-serif;font-weight:800;font-size:46px;line-height:1;color:var(--skydeep);letter-spacing:-1px;margin-top:-4px;}
.ccard .lbl{font-size:16px;color:var(--body);}
.ccard q{display:block;font-size:15px;font-style:italic;color:var(--ink);border-top:1px solid var(--line);padding-top:14px;quotes:"“" "”";}
.ccard .by{font-size:13px;color:#7a8396;margin-top:-6px;}
.cgrid{grid-template-columns:repeat(4,1fr);gap:18px;}
.cgrid .ccard{padding:22px;}
.cgrid .who{flex-direction:column;align-items:flex-start;gap:10px;}
.cgrid .logo{height:40px!important;}
.cgrid .big{font-size:36px;min-height:58px;display:flex;align-items:flex-end;}
.cgrid .big.txt{font-size:24px;line-height:1.15;}
.cgrid .lbl{font-size:15px;}
.integra{padding:80px 0;background:var(--paper);}
.igrid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.icard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 24px;display:flex;align-items:center;gap:16px;}
.icard .mk{width:52px;height:52px;border-radius:14px;background:var(--paper);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:'Sora',system-ui,sans-serif;font-weight:800;color:var(--ink);font-size:16px;flex:none;}
.icard .t{font-family:'Sora',system-ui,sans-serif;font-weight:700;color:var(--ink);font-size:17px;line-height:1.2;}
.icard .d{font-size:14px;color:#7a8396;}
.icard .st{display:inline-block;margin-top:8px;font-family:'Sora',system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;border-radius:50px;padding:4px 10px;white-space:nowrap;}
.st.on{background:rgba(52,211,153,.14);color:#12805a;}
.st.soon{background:rgba(91,194,234,.15);color:var(--skydeep);}
.integra .note{margin-top:22px;font-size:15px;color:var(--body);text-align:center;}
.integra .note a{color:var(--skydeep);font-weight:600;cursor:pointer;}
@media(max-width:1000px){.cgrid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:820px){.cgrid{grid-template-columns:1fr;}.cgrid .big{min-height:0;}.igrid{grid-template-columns:1fr;}.clientes h2,.integra h2{font-size:30px;}}
.relato{padding:90px 0;background:var(--paper);}
.relato h2{font-size:42px;color:var(--ink);font-weight:800;letter-spacing:-.8px;margin:10px 0 12px;line-height:1.1;}
.relato h2 span{color:var(--skydeep);}
.relato .sub{font-size:18px;margin-bottom:44px;}
.rgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;}
.rcard{background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s;}
.rcard:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(21,33,62,.12);}
.rvis{height:150px;background:var(--navy);position:relative;display:flex;align-items:center;justify-content:center;padding:18px 22px;color:#fff;font-family:'Sora',system-ui,sans-serif;}
.rtxt{padding:20px 22px 24px;}
.rtxt .k{font-family:'Sora',system-ui,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;color:var(--skydeep);text-transform:uppercase;}
.rtxt h3{font-family:'Sora',system-ui,sans-serif;font-size:19px;line-height:1.3;color:var(--ink);font-weight:700;margin-top:8px;}
.cal{display:flex;flex-direction:column;gap:4px;font-size:12px;}
.vcoc{flex:1;border-radius:10px;overflow:hidden;background:#fffdf7;display:flex;flex-direction:column;}
.vcoc-h{background:#1c1917;color:#fef9c3;display:flex;justify-content:space-between;align-items:center;padding:6px 10px;}
.vcoc-h b{display:block;font-size:12.5px;font-weight:800;}
.vcoc-h span{display:block;font-size:10px;opacity:.7;font-family:'Archivo',system-ui,sans-serif;}
.vcoc-h em{font-style:normal;background:#fef9c3;color:#1c1917;border-radius:50px;padding:1px 8px;font-size:10px;font-weight:700;}
.vcoc-b{padding:5px 10px;color:#1c1917;font-family:'Archivo',system-ui,sans-serif;}
.vcoc-t{font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#78350f;margin-bottom:1px;}
.vcoc-r{display:flex;justify-content:space-between;font-size:11.5px;padding:1.5px 0;border-bottom:1px solid #e7e5e4;}
.vcoc-r span{font-weight:600;}
.cal-h,.cal-r{display:grid;grid-template-columns:64px repeat(7,1fr);gap:4px;align-items:center;}
.cal-h span{text-align:center;color:rgba(255,255,255,.55);font-size:11px;}
.cal-t{color:rgba(255,255,255,.75);}
.cal-c{height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;}
.asesores{background:var(--navy);color:#fff;padding:90px 0;}
.asesores h2{font-size:38px;font-weight:800;letter-spacing:-.8px;line-height:1.15;margin:10px 0 14px;max-width:1000px;}
.asesores h2 span{color:var(--sky);}
.asesores .sub{font-size:18px;color:rgba(255,255,255,.72);max-width:760px;}
.pasos{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:40px 0 44px;}
.paso{display:flex;gap:14px;align-items:flex-start;border-top:2px solid rgba(91,194,234,.35);padding-top:16px;}
.paso-n{font-family:'Sora',system-ui,sans-serif;font-weight:800;font-size:28px;color:var(--sky);line-height:1;}
.paso b{font-family:'Sora',system-ui,sans-serif;font-size:17px;}
.paso p{font-size:15px;color:rgba(255,255,255,.65);margin-top:4px;}
.agrid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;}
.acard{background:var(--navy2);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;transition:border-color .2s,transform .2s;}
.acard:hover{border-color:rgba(91,194,234,.6);transform:translateY(-4px);}
.aini{width:64px;height:64px;border-radius:50%;background:var(--sky);color:var(--navy);display:flex;align-items:center;justify-content:center;font-family:'Sora',system-ui,sans-serif;font-weight:800;font-size:22px;margin-bottom:12px;}
.anm{font-family:'Sora',system-ui,sans-serif;font-weight:700;font-size:20px;}
.arol{font-size:15px;color:rgba(255,255,255,.8);}
.aexp{font-size:14px;color:rgba(255,255,255,.55);margin-bottom:16px;}
.aesp{margin-top:auto;font-family:'Sora',system-ui,sans-serif;font-size:12.5px;font-weight:700;color:var(--sky);border:1px solid rgba(91,194,234,.45);border-radius:50px;padding:6px 14px;}
.vlbl{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.55);font-weight:600;}
.vchip{display:inline-flex;align-items:center;gap:6px;border-radius:50px;padding:7px 13px;font-size:13.5px;font-weight:700;}
.vrow{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;font-size:13.5px;}
.vbar{height:9px;border-radius:5px;background:var(--sky);}
.marca{background:var(--navy);padding:46px 0 50px;overflow:hidden;}
.marca .t{text-align:center;font-family:'Sora',system-ui,sans-serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:var(--sky);font-weight:600;margin-bottom:26px;}
.marca .track{display:flex;gap:80px;width:max-content;animation:mqx 28s linear infinite;align-items:center;}
.marca:hover .track{animation-play-state:paused;}
.marca .lgm{display:flex;flex-direction:column;align-items:center;gap:10px;flex:none;transition:transform .2s;}
.marca .lgm:hover{transform:translateY(-4px) scale(1.04);}
.marca .lgm img{height:56px;width:auto;display:block;opacity:.7;transition:opacity .2s;}
.marca .lgm:hover img{opacity:1;}
.marca .lgm span{font-family:'Sora',system-ui,sans-serif;font-size:12.5px;font-weight:600;color:rgba(255,255,255,.6);letter-spacing:.5px;white-space:nowrap;}
@media(max-width:820px){.pasos,.agrid{grid-template-columns:1fr;}.asesores h2{font-size:30px;}.rgrid{grid-template-columns:1fr;}.relato h2{font-size:32px;}}
@media(max-width:820px){
  .hero .wrap{grid-template-columns:1fr;} .hero .dogwrap{display:none;}
  .hero h1{font-size:42px;} .grid{grid-template-columns:1fr;} .navactions .btn{padding:9px 14px;font-size:13px;}
  .diff .wrap{grid-template-columns:1fr;} .diff .circle{display:none;}
  .insight .wrap{flex-direction:column;align-items:flex-start;gap:10px;}
  .diff p{font-size:28px;} .cta h2{font-size:30px;} .hero h1{font-size:38px;}
}`;

const marqueeChips = [
  "Costos reales por plato", "Política de precios que se sostiene", "Ingeniería de menú",
  "Tableros para cada equipo", "Precios claros para el cliente", "Lanzamientos sin caos",
  "Decisiones con datos", "Un equipo interdependiente", "Trazabilidad", "Digitaliza tu gestión",
];



// Clientes: un número real por cliente (verificar y pedir permiso antes de publicar).
// En las tarjetas, el logo a color.
const logosColor = { 'Container Bar': COLOR_CB, 'Comercio': COLOR_CO, 'MigaGO': COLOR_MG, 'Container FC': COLOR_FC };
const clientes = [
  { ini: 'CB', nm: 'Container Bar', rb: 'Bar · Ramos Mejía', k: 'Precios', big: '+6,6 pts', lbl: 'Su último aumento quedó por encima de lo que subió su canasta de costos, no del IPC.', q: '', by: '' },
  { ini: 'CO', nm: 'Comercio', rb: 'Buffet · Núñez', k: 'Menú', big: '49 de 199', lbl: 'productos hacen el 80% de sus ventas. Sabe en cuáles enfocarse y cuáles revisar.', q: '', by: '' },
  { ini: 'MG', nm: 'MigaGO', rb: 'Gastronomía', k: 'Costos', big: 'El alquiler, medido', txt: true, lbl: 'Le subió mucho el alquiler y sabe cuánto impacta en su canasta de costos.', q: '', by: '' },
  { ini: 'FC', nm: 'Container FC', rb: 'Canchas de fútbol · San Justo', k: 'Recetas', big: 'Cada plato, costeado', txt: true, lbl: 'Decidió empezar a vender comida y sabe cuánto le cuesta cada plato antes de ponerle precio.', q: '', by: '' },
]
// Logos de clientes en un solo tono (gris), sacados del perfil de cada negocio.
const logosClientes = [
  { nm: 'Container Bar', src: LOGO_CB },
  { nm: 'Container FC', src: LOGO_FC },
  { nm: 'Comercio', src: LOGO_CO },
  { nm: 'MigaGO', src: LOGO_MG },
  { nm: 'Llévalo Listo', src: LOGO_LL },
];

// Integraciones: con qué se conecta. Estados a confirmar.
const integraciones = [
  { mk: 'MX', t: 'MaxiRest', d: 'POS · ventas, compras y stock', st: 'on' },
  { mk: 'WT', t: 'Waitry', d: 'POS y pedidos', st: 'soon' },
  { mk: 'FU', t: 'Fudo', d: 'POS', st: 'soon' },
  { mk: 'AR', t: 'ARCA', d: 'Comprobantes recibidos', st: 'soon' },
  { mk: 'MP', t: 'Mercado Pago', d: 'Cobros y acreditaciones', st: 'soon' },
  { mk: '$', t: 'Bancos', d: 'Extractos para conciliar', st: 'soon' },
];

// Asesores (Florencia se suma cuando confirme).
const asesores = [
  { ini: 'DA', nm: 'Diego Sebastián Albo', rol: 'Emprendedor desde la cuna', exp: 'Gastronómico hace una década', esp: 'Rentabilidad y manejo de equipos' },
  { ini: 'MG', nm: 'Martín Gil Herrera', rol: 'Empresario y chef ejecutivo', exp: 'Gastronómico hace más de tres décadas', esp: 'Finanzas y costos' },
  { ini: 'MV', nm: 'Mairene Villasmil', rol: 'Gastronómica operativa', exp: 'Programadora', esp: 'Implementaciones' },
];

const visionChips = ["Compras", "Recursos Humanos", "Stock", "Política de precios", "Resultados"];
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
            <div className="kick" style={{ color: "var(--sky)" }}>Gestión gastronómica · Para dueños de restaurantes</div>
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
          <p>Lo primero que falla en un equipo es la <b>comunicación</b>. Lazarillo
            convierte el corazón de tu restaurante —su menú y su ingeniería— en información clara para toda tu operación.</p>
        </div>
      </section>

      {/* RELATO: cómo es un restaurante con Lazarillo */}
      <section className="relato" id="que-hace">
        <div className="wrap">
          <div className="kick">Qué cambia</div>
          <h2>Un negocio con Lazarillo <span>sabe dónde está parado.</span></h2>
          <p className="sub">No es más información: son procesos y áreas vinculadas que se ejecutan todos los días.</p>
          <div className="rgrid">
            {/* 1+2 canasta y precios: van de la mano */}
            <div className="rcard">
              <div className="rvis" style={{ padding: '14px 18px' }}>
                <svg viewBox="0 0 260 110" width="100%" height="100%">
                  <polyline points="0,100 50,94 100,86 150,80 200,72 260,66" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" strokeDasharray="6 6" />
                  <polyline points="0,102 50,92 100,86 150,70 200,60 260,46" fill="none" stroke="#5BC2EA" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="254" cy="47" r="6" fill="#5BC2EA" />
                  <text x="0" y="12" fill="#5BC2EA" fontSize="13" fontWeight="700">Tu canasta</text>
                  <text x="214" y="88" fill="rgba(255,255,255,.55)" fontSize="12">IPC</text>
                </svg>
                <span className="vchip" style={{ position: 'absolute', top: 12, right: 14, background: '#5BC2EA', color: '#12111F', fontSize: 12.5 }}>Aumento sugerido +6,5% ✓</span>
              </div>
              <div className="rtxt"><div className="k">Costos y precios</div><h3>Conoce su propia canasta de costos y sus precios de venta la siguen —no el IPC.</h3></div>
            </div>
            {/* 3 operación: la receta tal como la ve la cocina (Vista Cocina) */}
            <div className="rcard">
              <div className="rvis" style={{ alignItems: 'stretch', padding: '12px 16px' }}>
                <div className="vcoc">
                  <div className="vcoc-h"><div><b>🍽 Milanesa napolitana</b><span>Rinde 1 porción</span></div><em>Vista Cocina</em></div>
                  <div className="vcoc-b">
                    <div className="vcoc-t">Ingredientes</div>
                    {[['Milanesa de ternera', '1 u'], ['Salsa de tomate', '60 g'], ['Muzzarella', '80 g']].map(([a, c]) => (
                      <div className="vcoc-r" key={a}><span>{a}</span><b>{c}</b></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rtxt"><div className="k">Operación</div><h3>Todo el equipo sabe elaborar y despachar cada producto —y colabora en eso.</h3></div>
            </div>
            {/* 4 fijos y variables */}
            <div className="rcard">
              <div className="rvis" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                <div className="vlbl">Ventas del mes</div>
                <div style={{ position: 'relative', display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ width: '38%', background: '#2492C8' }} /><div style={{ width: '34%', background: '#5BC2EA' }} /><div style={{ flex: 1, background: '#34d399' }} />
                  <div style={{ position: 'absolute', left: '72%', top: -4, bottom: -4, width: 2, background: '#fff' }} />
                </div>
                <div className="vrow" style={{ fontSize: 12 }}><span style={{ color: '#2492C8' }}>■ Fijos</span><span style={{ color: '#5BC2EA' }}>■ Variables</span><span style={{ color: '#34d399' }}>■ Ganancia</span></div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>│ punto de equilibrio</div>
              </div>
              <div className="rtxt"><div className="k">Rentabilidad</div><h3>Ganó rentabilidad al ver sus costos fijos y variables.</h3></div>
            </div>
            {/* 5 insumos a negociar */}
            <div className="rcard">
              <div className="rvis" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
                <div className="vlbl">Lo que más pesa en tu gasto</div>
                {[['Queso', 92], ['Carne', 74], ['Aceite', 48]].map(([a, w]) => (
                  <div className="vrow" key={a} style={{ gap: 12 }}><span style={{ width: 52 }}>{a}</span><div style={{ flex: 1, height: 9, borderRadius: 5, background: 'rgba(255,255,255,.1)' }}><div className="vbar" style={{ width: `${w}%` }} /></div></div>
                ))}
              </div>
              <div className="rtxt"><div className="k">Proveedores</div><h3>Sabe qué insumos tiene que salir a negociar con sus proveedores.</h3></div>
            </div>
            {/* 6 menú foco */}
            <div className="rcard">
              <div className="rvis" style={{ alignItems: 'flex-end', gap: 7 }}>
                {[100, 82, 66, 52, 30, 22, 16, 12, 9, 7].map((h, i) => (
                  <div key={i} className="vbar" style={{ width: 16, height: `${h}%`, background: i < 4 ? '#5BC2EA' : 'rgba(255,255,255,.2)' }} />
                ))}
                <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 13, fontWeight: 700, color: '#5BC2EA' }}>4 platos = 80%</div>
              </div>
              <div className="rtxt"><div className="k">Menú</div><h3>Sabe en qué productos del menú tiene que enfocarse.</h3></div>
            </div>
            {/* 7 personal: turnos a demanda y costo de abrir la jornada */}
            <div className="rcard">
              <div className="rvis" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '14px 18px' }}>
                <div className="cal">
                  <div className="cal-h"><span /> {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}</div>
                  {[['Mediodía', [2, 2, 2, 3, 3, 4, 4]], ['Noche', [2, 2, 3, 3, 5, 6, 4]]].map(([t, v]) => (
                    <div className="cal-r" key={t}><span className="cal-t">{t}</span>{v.map((n, i) => <span key={i} className="cal-c" style={{ background: `rgba(91,194,234,${0.12 + n * 0.12})` }}>{n}</span>)}</div>
                  ))}
                </div>
                <div className="vrow" style={{ borderTop: '1px solid rgba(255,255,255,.12)', paddingTop: 8 }}><span className="vlbl">Abrir el sábado te cuesta</span><b style={{ color: '#5BC2EA', fontSize: 18, whiteSpace: 'nowrap' }}>$ 1,2 M</b></div>
              </div>
              <div className="rtxt"><div className="k">Personal</div><h3>Arma sus turnos según la demanda y sabe cuánto le cuesta abrir cada jornada.</h3></div>
            </div>
          </div>
        </div>
      </section>

      {/* MARCAS: clientes en banda oscura que se mueve */}
      <section className="marca">
        <div className="t">Ya lo usan</div>
        <div className="track">
          {[...logosClientes, ...logosClientes, ...logosClientes].map((l, i) => (
            <div className="lgm" key={i}><img src={l.src} alt={l.nm} loading="lazy" /><span>{l.nm}</span></div>
          ))}
        </div>
      </section>

      {/* CLIENTES */}
      <section className="clientes" id="clientes">
        <div className="wrap">
          <div className="kick">Clientes</div>
          <h2>Negocios que ya ven lo que su POS no les muestra.</h2>
          <p className="sub">Lo mismo que leíste arriba, con sus números.</p>
          <div className="grid cgrid">
            {clientes.map((c) => (
              <div className="ccard" key={c.nm}>
                <div className="who">{logosColor[c.nm] ? <img className="logo" src={logosColor[c.nm]} alt={c.nm} style={{ objectFit: 'contain', background: 'transparent', width: 'auto', minWidth: 46, borderRadius: 8 }} /> : <div className="logo">{c.ini}</div>}<div><div className="nm">{c.nm}</div><div className="rb">{c.rb}</div></div></div>
                <div className="ck">{c.k}</div>
                <div className={c.txt ? 'big txt' : 'big'}>{c.big}</div>
                <div className="lbl">{c.lbl}</div>
                {c.q && <q>{c.q}</q>}
                {c.by && <div className="by">{c.by}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ASESORES: el valor humano */}
      <section className="asesores" id="asesores">
        <div className="wrap">
          <div className="kick" style={{ color: 'var(--sky)' }}>Asesores gastronómicos</div>
          <h2>Software hay mucho. Hecho por gastronómicos para gastronómicos, poco. <span>Lo que nos diferencia es quién te acompaña en el proceso.</span></h2>
          <p className="sub">Somos gastronómicos asesorando gastronómicos. Nos respalda un método, un software y años de oficio: te acompañamos en el proceso, encontramos juntos dónde está tu dolor y lo resolvemos. Después seguís solo, con tu Lazarillo.</p>
          <div className="pasos">
            {[['1', 'Diagnóstico', 'Identificamos dónde está tu dolor.'], ['2', 'Lo resolvemos juntos', 'Método, software y tu equipo, en la misma dirección.'], ['3', 'Seguís solo', 'Con tu Lazarillo y el proceso funcionando.']].map(([n, t, d]) => (
              <div className="paso" key={n}><span className="paso-n">{n}</span><div><b>{t}</b><p>{d}</p></div></div>
            ))}
          </div>
          <div className="agrid">
            {asesores.map((a) => (
              <div className="acard" key={a.nm}>
                <div className="aini">{a.ini}</div>
                <div className="anm">{a.nm}</div>
                <div className="arol">{a.rol}</div>
                <div className="aexp">{a.exp}</div>
                <div className="aesp">{a.esp}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRACIONES */}
      <section className="integra" id="integraciones">
        <div className="wrap">
          <div className="kick">Integraciones</div>
          <h2>Se apoya en el sistema que ya tenés.</h2>
          <p className="sub">No cambiás tu POS ni cargás dos veces: Lazarillo lee lo que ya registrás y lo convierte en decisiones.</p>
          <div className="igrid">
            {integraciones.map((i) => (
              <div className="icard" key={i.t}>
                <div className="mk">{i.mk}</div>
                <div><div className="t">{i.t}</div><div className="d">{i.d}</div><span className={`st ${i.st}`}>{i.st === 'on' ? 'Conectado' : 'Próximamente'}</span></div>
              </div>
            ))}
          </div>
          <p className="note">¿Usás otro sistema? <a onClick={openModal}>Contanos cuál</a> y lo sumamos.</p>
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

      {/* CTA */}
      <section className="cta" id="contacto">
        <div className="wrap">
          <h2>Empezá a ver lo que tu negocio te esconde.</h2>
          <p style={{ color: "rgba(255,255,255,.7)", fontSize: "18px" }}>Escribinos y te mostramos Lazarillo funcionando sobre tu carta.</p>
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
          <div className="c"><span>web</span> www.lazarillo.com.ar · <span>ig</span> <a href="https://www.instagram.com/lazarillo.erp/" target="_blank" rel="noopener" style={{ color: 'var(--sky)', fontWeight: 600, textDecoration: 'none' }}>@lazarillo.erp</a><br />© Lazarillo · Conectamos con lo que no ves</div>
        </div>
      </footer>

      {/* WA FLOAT */}
      <a className="wa-float" href={WA} target="_blank" rel="noopener" aria-label="WhatsApp">
        <svg viewBox="0 0 32 32" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 .4C7.4.4.4 7.4.4 16c0 2.8.7 5.5 2.1 7.9L.3 31.7l8-2.1c2.3 1.3 4.9 1.9 7.6 1.9h.1c8.6 0 15.6-7 15.6-15.6 0-4.2-1.6-8.1-4.6-11C24.1 2 20.2.4 16 .4zm0 28.5h-.1c-2.4 0-4.7-.6-6.7-1.9l-.5-.3-5 1.3 1.3-4.9-.3-.5C3.3 21 2.7 18.5 2.7 16 2.7 8.7 8.7 2.8 16 2.8c3.5 0 6.8 1.4 9.3 3.9 2.5 2.5 3.9 5.8 3.9 9.3 0 7.3-6 13.2-13.2 13.2zm7.2-9.9c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.7.2-.2.2-.4.4-.6.1-.3.1-.5 0-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1 .5-.4.4-1.3 1.3-1.3 3.2s1.4 3.7 1.5 3.9c.2.3 2.7 4.2 6.6 5.9.9.4 1.6.6 2.2.8.9.3 1.8.2 2.4.2.7-.1 2.3-.9 2.6-1.9.3-.9.3-1.7.2-1.9-.1-.1-.3-.2-.7-.4z" />
        </svg>
      </a>
    </>
  );
}