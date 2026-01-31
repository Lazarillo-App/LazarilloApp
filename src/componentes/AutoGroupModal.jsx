// src/componentes/AutoGroupModal.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Check, X } from 'lucide-react';

/**
 * Modal para auto-agrupación inteligente de artículos
 *
 * @param {boolean} open - Si el modal está abierto
 * @param {Array} suggestions - Sugerencias agrupadas por grupo destino
 * @param {Function} onClose - Callback al cerrar
 * @param {Function} onApply - Callback al aplicar (recibe selectedSuggestions)
 * @param {Function} onCreateGroup - Callback para crear nueva agrupación (debe devolver el nuevo groupId)
 * @param {boolean} loading - Si está procesando
 */
export default function AutoGroupModal({
  open,
  suggestions = [],
  onClose,
  onApply,
  onCreateGroup,
  loading = false,
}) {
  // Estado de selección (articleId → { groupId, groupName })
  const [selections, setSelections] = useState({});

  // Estado para crear nueva agrupación
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [articlesForNewGroup, setArticlesForNewGroup] = useState(new Set());

  // Inicializar selecciones con sugerencias de alta confianza
  useEffect(() => {
    const initial = {};
    suggestions.forEach(group => {
      group.articles.forEach(art => {
        if (art.confidence === 'high') {
          initial[art.articleId] = {
            groupId: group.groupId,
            groupName: group.groupName,
          };
        }
      });
    });
    setSelections(initial);
  }, [suggestions]);

  // Calcular totales
  const totalArticles = useMemo(() => {
    return suggestions.reduce((sum, g) => sum + g.articles.length, 0);
  }, [suggestions]);

  const selectedCount = useMemo(() => {
    return Object.keys(selections).length + articlesForNewGroup.size;
  }, [selections, articlesForNewGroup]);

  // Toggle selección de artículo para grupo existente
  const toggleArticle = (articleId, groupId, groupName) => {
    setSelections(prev => {
      const newSelections = { ...prev };
      if (newSelections[articleId]?.groupId === groupId) {
        delete newSelections[articleId];
      } else {
        newSelections[articleId] = { groupId, groupName };
      }
      return newSelections;
    });

    // Quitar de nueva agrupación si estaba ahí
    setArticlesForNewGroup(prev => {
      const newSet = new Set(prev);
      newSet.delete(articleId);
      return newSet;
    });
  };

  // Toggle selección de artículo para nueva agrupación
  const toggleArticleForNew = articleId => {
    setArticlesForNewGroup(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });

    // Quitar de grupos existentes si estaba ahí
    setSelections(prev => {
      const newSelections = { ...prev };
      delete newSelections[articleId];
      return newSelections;
    });
  };

  // Seleccionar todos de un grupo
  const selectAllGroup = group => {
    setSelections(prev => {
      const newSelections = { ...prev };
      group.articles.forEach(art => {
        newSelections[art.articleId] = {
          groupId: group.groupId,
          groupName: group.groupName,
        };
      });
      return newSelections;
    });
  };

  // Deseleccionar todos de un grupo
  const deselectAllGroup = group => {
    setSelections(prev => {
      const newSelections = { ...prev };
      group.articles.forEach(art => {
        delete newSelections[art.articleId];
      });
      return newSelections;
    });
  };

  // Aplicar agrupación (crea nueva agrupación si corresponde y llama onApply)
  const handleApply = async () => {
    // Copia local de selecciones actual (para no depender de mutaciones)
    let finalSelections = { ...selections };

    // 1. Crear nueva agrupación si hay artículos seleccionados para ella
    if (articlesForNewGroup.size > 0) {
      if (!newGroupName.trim()) {
        alert('Por favor ingresa un nombre para la nueva agrupación');
        return;
      }

      try {
        // Llamar callback para crear grupo (espera que devuelva el id del nuevo grupo)
        const newGroupId = await onCreateGroup(newGroupName.trim());

        // Agregar artículos seleccionados a finalSelections (no mutamos state directamente)
        Array.from(articlesForNewGroup).forEach(articleId => {
          finalSelections[articleId] = {
            groupId: newGroupId,
            groupName: newGroupName.trim(),
          };
        });

        // Actualizar estado local para mantener UI consistente
        setSelections(prev => ({ ...prev, ...finalSelections }));
        // limpiar nueva agrupación
        setArticlesForNewGroup(new Set());
        setNewGroupName('');
        setShowCreateNew(false);
      } catch (error) {
        console.error('Error creando nueva agrupación:', error);
        return;
      }
    }

    // 2. Aplicar todas las selecciones (si hay)
    if (Object.keys(finalSelections).length > 0) {
      // Deshabilitar doble envío: onApply puede manejar loading; aquí solo llamamos
      await onApply(finalSelections);
    }
  };

  // Badge de confianza
  const ConfidenceBadge = ({ confidence, matchType }) => {
    if (confidence === 'high') {
      return (
        <Badge variant="success" className="text-xs">
          ✓ {matchType === 'subrubro' ? 'Subrubro exacto' : 'Rubro'}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        ~ {matchType === 'rubro' ? 'Rubro similar' : 'Coincidencia'}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            🎯 Agrupación Automática Inteligente
          </DialogTitle>
          <DialogDescription>
            Detectamos {totalArticles} artículo{totalArticles !== 1 ? 's' : ''} sin agrupar.
            Seleccioná dónde querés ubicarlos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Sugerencias por grupo existente */}
          {suggestions.map(group => {
            const groupSelectedCount = group.articles.filter(
              art => selections[art.articleId]?.groupId === group.groupId
            ).length;
            const allSelected = groupSelectedCount === group.articles.length;

            return (
              <div
                key={group.groupId}
                className="border rounded-lg p-4 space-y-3 bg-slate-50"
              >
                {/* Header del grupo */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{group.groupName}</h3>
                    <Badge variant="outline">
                      {groupSelectedCount}/{group.articles.length}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => selectAllGroup(group)}
                      disabled={loading || allSelected}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Todos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deselectAllGroup(group)}
                      disabled={loading || groupSelectedCount === 0}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Ninguno
                    </Button>
                  </div>
                </div>

                {/* Artículos del grupo */}
                <div className="space-y-2">
                  {group.articles.map(art => {
                    const isSelected = selections[art.articleId]?.groupId === group.groupId;

                    return (
                      <div
                        key={art.articleId}
                        className={`flex items-center gap-3 p-2 rounded border transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            toggleArticle(art.articleId, group.groupId, group.groupName)
                          }
                          disabled={loading}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{art.articleName}</div>
                          <div className="text-xs text-gray-500">
                            ID: {art.articleId}
                          </div>
                        </div>
                        <ConfidenceBadge
                          confidence={art.confidence}
                          matchType={art.matchType}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Sección: Crear nueva agrupación */}
          <div className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateNew(!showCreateNew)}
              className="w-full"
              disabled={loading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear nueva agrupación
            </Button>

            {showCreateNew && (
              <div className="mt-4 space-y-4 border rounded-lg p-4 bg-green-50">
                <div className="space-y-2">
                  <Label htmlFor="new-group-name">
                    Nombre de la nueva agrupación
                  </Label>
                  <Input
                    id="new-group-name"
                    placeholder="Ej: Promociones, Bebidas Premium, etc."
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* Lista de artículos sin coincidencia */}
                <div className="space-y-2">
                  <Label>Artículos para la nueva agrupación:</Label>

                  {suggestions.map(group =>
                    group.articles.map(art => {
                      const isInNewGroup = articlesForNewGroup.has(art.articleId);

                      return (
                        <div
                          key={art.articleId}
                          className={`flex items-center gap-3 p-2 rounded border transition-colors ${
                            isInNewGroup
                              ? 'bg-green-100 border-green-300'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <Checkbox
                            checked={isInNewGroup}
                            onCheckedChange={() => toggleArticleForNew(art.articleId)}
                            disabled={loading}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{art.articleName}</div>
                            <div className="text-xs text-gray-500">
                              ID: {art.articleId}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {articlesForNewGroup.size > 0 && (
                  <Badge variant="outline">
                    {articlesForNewGroup.size} artículo{articlesForNewGroup.size !== 1 ? 's' : ''} seleccionado{articlesForNewGroup.size !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            {selectedCount > 0 ? (
              <span className="font-medium text-green-600">
                ✓ {selectedCount} artículo{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span>Ningún artículo seleccionado</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              disabled={loading || selectedCount === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Agrupando...
                </>
              ) : (
                <>Aplicar ({selectedCount})</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
