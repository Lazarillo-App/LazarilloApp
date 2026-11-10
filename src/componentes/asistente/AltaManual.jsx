// src/componentes/asistente/AltaManual.jsx
// Alta sin POS (pedido de la usuaria, 09/11): todo simple, sin diseño de menú ni vistas extra.
// Anthony pregunta por el archivo de ARTÍCULOS y después por el de INSUMOS; cada uno se sube con el
// mismo importador de la tabla (mapea las columnas y muestra las primeras filas para confirmar; si no
// hay código, el artículo recibe uno automático). Ventas y compras NO van acá: se piden después,
// desde la tabla. Cada paso se puede saltear; al final se va a la tabla de Artículos.
import React, { useEffect, useState } from 'react';
import UploadInsumosModal from '../UploadInsumosModal';
import { Btn, Panel, AnthonyDice, Steps } from './AsistenteOnboarding';
import { guardarAlta } from './altaEstado';

const TEXTO = {
  articulos: {
    titulo: 'Tus artículos',
    pregunta: <>¿Tenés un <b>archivo con tus artículos</b> (Excel o CSV)? Lo subís, me fijo qué columna es cada cosa y te muestro las primeras filas para que confirmes. Si no trae código, se lo pongo yo.</>,
    subir: 'Subir mi archivo de artículos',
    saltear: 'No tengo archivo, sigo',
    listo: (n) => `Listo: cargué ${n} artículo${n === 1 ? '' : 's'}.`,
  },
  insumos: {
    titulo: 'Tus insumos',
    pregunta: <>Ahora, ¿tenés un <b>archivo con tus insumos</b> (lo que comprás para preparar)? Igual que antes: lo subís, reviso las columnas y confirmás.</>,
    subir: 'Subir mi archivo de insumos',
    saltear: 'No tengo archivo, termino',
    listo: (n) => `Listo: cargué ${n} insumo${n === 1 ? '' : 's'}.`,
  },
};

export default function AltaManual({ businessId, accent, pasoInicial = null, onTerminar, onVolverPos }) {
  const [paso, setPaso] = useState(pasoInicial === 'manual_insumos' ? 'insumos' : 'articulos');
  const [abierto, setAbierto] = useState(false);
  const [cargados, setCargados] = useState({ articulos: null, insumos: null });

  // El paso queda guardado para retomarlo si se sale (igual que el resto del alta).
  useEffect(() => { guardarAlta(businessId, 'en_curso', `manual_${paso}`); }, [businessId, paso]);

  const t = TEXTO[paso];
  const siguiente = () => (paso === 'articulos' ? setPaso('insumos') : onTerminar?.());
  const n = cargados[paso];

  return (
    <div className="rise">
      <Steps
        items={['Local', 'POS', 'Artículos', 'Insumos']}
        active={paso === 'articulos' ? 2 : 3}
        accent={accent}
        onStep={(i) => { if (i === 1) onVolverPos?.(); else if (i === 2) setPaso('articulos'); else if (i === 3) setPaso('insumos'); }}
      />
      <AnthonyDice pose={paso === 'articulos' ? 'presenta' : 'investiga'} size={80} accent={accent}>{t.pregunta}</AnthonyDice>
      <Panel titulo={t.titulo}>
        {n != null && (
          <div style={{ fontSize: 14, color: '#15803d', fontWeight: 600, marginBottom: 12 }}>✓ {t.listo(n)}</div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {n == null ? (
            <>
              <Btn accent={accent} onClick={() => setAbierto(true)}>{t.subir}</Btn>
              <Btn ghost small accent={accent} onClick={siguiente}>{t.saltear}</Btn>
            </>
          ) : (
            <>
              <Btn accent={accent} onClick={siguiente}>{paso === 'articulos' ? 'Seguir con los insumos →' : 'Terminar: ver mi tabla →'}</Btn>
              <Btn ghost small accent={accent} onClick={() => setAbierto(true)}>Subir otro archivo</Btn>
            </>
          )}
          {paso === 'insumos' && <Btn ghost small accent={accent} onClick={() => setPaso('articulos')}>← Volver</Btn>}
        </div>
        <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 12 }}>
          Las ventas y las compras las podés sumar después, desde la tabla: no hacen falta para arrancar.
        </div>
      </Panel>
      <UploadInsumosModal
        open={abierto}
        tipo={paso}
        businessId={businessId}
        onClose={() => setAbierto(false)}
        onSuccess={(r) => {
          const total = Number(r?.inserted ?? r?.summary?.inserted ?? 0) + Number(r?.updated ?? r?.summary?.updated ?? 0);
          setCargados((c) => ({ ...c, [paso]: (c[paso] || 0) + (Number.isFinite(total) ? total : 0) }));
        }}
      />
    </div>
  );
}
