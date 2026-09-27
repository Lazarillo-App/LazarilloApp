// src/hooks/useArticuloTour.js
// Tour guiado de 4 pasos para cuando un negocio nuevo, sin Maxi y sin
// artículos todavía, crea su primer artículo manual. Se dispara solo:
//   - el negocio no tiene credenciales Maxi (props.maxi.email)
//   - el árbol de artículos ya resolvió y está vacío
//   - todavía no marcó el flag props.onboarding.articulo_visto
// Pasos: 1) botón "+ Agregar", 2) campos del formulario, 3) padrino,
// 4) botón Guardar (termina solo al guardar de verdad).
import { useState, useEffect, useCallback } from 'react';
import { useArticlesTree } from '@/hooks/useArticlesTree';
import { BusinessesAPI } from '@/servicios/apiBusinesses';

export function useArticuloTour({ bizId, business }) {
  const bizIdNum = Number(bizId) || null;
  const { data: tree, isSuccess } = useArticlesTree(bizIdNum);

  const hasMaxi = !!(business?.props?.maxi?.email);
  const alreadySeen = !!(business?.props?.onboarding?.articulo_visto);
  const hasArticles = Array.isArray(tree) && tree.some(
    (sub) => (sub.categorias || []).some((cat) => (cat.articulos || []).length > 0)
  );

  const eligible = isSuccess && !hasMaxi && !hasArticles && !alreadySeen;

  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (eligible && !dismissed) {
      setStep((s) => (s === 0 ? 1 : s));
    } else {
      setStep(0);
    }
  }, [eligible, dismissed]);

  const finish = useCallback(() => {
    setDismissed(true);
    setStep(0);
    if (bizIdNum) {
      BusinessesAPI.setOnboardingFlag(bizIdNum, 'articulo_visto', true).catch(() => {});
    }
  }, [bizIdNum]);

  const next = useCallback(() => {
    setStep((s) => (s > 0 && s < 4 ? s + 1 : s));
  }, []);

  // Si cierran el modal sin guardar (Cancelar / click afuera) con el tour a
  // mitad de camino, vuelve al paso 1 en vez de perderse — no cuenta como
  // "omitido" ni marca el flag.
  const restart = useCallback(() => setStep(1), []);

  return { step, active: step > 0, next, skip: finish, finish, restart };
}
