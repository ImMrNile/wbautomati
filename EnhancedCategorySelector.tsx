// components/EnhancedCategorySelector.tsx - Улучшенный селектор категорий

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Sparkles, 
  ChevronRight, 
  Star, 
  Loader, 
  AlertCircle, 
  Lightbulb,
  RefreshCw,
  FolderOpen,
  Folder,
  ChevronDown,
  ChevronUp,
  Filter,
  Zap,
  CheckCircle
} from 'lucide-react';

// Интерфейсы (используем централизованные типы)
import type { 
  WBCategory,
  CategoryHierarchy,
  CategorySuggestion
} from '../../../lib/types/wbTypes';

interface EnhancedCategorySelectorProps {
  cabinetId: string;
  productName: string;
  productDescription?: string;
  onCategorySelect: (category: WBCategory) => void;
  selectedCategoryId?: string;
  className?: string;
  showHierarchy?: boolean;
  enableAiSuggestions?: boolean;
}

export default function EnhancedCategorySelector({
  cabinetId,
  productName,
  productDescription = '',
  onCategorySelect,
  selectedCategoryId,
  className = '',
  showHierarchy = true,
  enableAiSuggestions = true
}: EnhancedCategorySelectorProps) {
  // Состояния
  const [categories, setCategories] = useState<WBCategory[]>([]);
  const [hierarchy, setHierarchy] = useState<CategoryHierarchy[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'hierarchy' | 'suggestions'>('suggestions');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [showOnlyLeafs, setShowOnlyLeafs] = useState(false);

  // Загрузка категорий при монтировании
  useEffect(() => {
    if (cabinetId) {
      loadCategories();
    }
  }, [cabinetId]);

  // Генерация ИИ предложений при изменении продукта
  useEffect(() => {
    if (productName && enableAiSuggestions && cabinetId) {
      generateAiSuggestions();
    }
  }, [productName, productDescription, enableAiSuggestions, cabinetId]);

  // Мемоизированная фильтрация категорий
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const searchTerm = searchQuery.toLowerCase();
    let filtered = categories.filter(cat =>
      cat.objectName.toLowerCase().includes(searchTerm)
    );

    if (showOnlyLeafs) {
      const childIds = new Set(categories.filter(cat => cat.parentID).map(cat => cat.parentID));
      filtered = filtered.filter(cat => !childIds.has(cat.objectID));
    }

    return filtered.slice(0, 50);
  }, [searchQuery, categories, showOnlyLeafs]);

  // Загрузка категорий из API
  const loadCategories = async (forceUpdate = false) => {
    setLoading(true);       
    setError('');

    try {
      console.log(`📂 Загружаем категории WB для кабинета ${cabinetId}...`);

      const url = `/api/wb-categories?cabinetId=${cabinetId}&flat=false&useCache=${!forceUpdate}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setCategories(result.data.categories);
        setHierarchy(result.data.hierarchy || []);
        
        console.log(`✅ Загружено ${result.data.categories.length} категорий`);
        
        if (result.data.cached) {
          console.log('📋 Данные получены из кеша');
        }
      } else {
        throw new Error(result.error || 'Ошибка загрузки категорий');
      }
    } catch (error: any) {
      console.error('❌ Ошибка загрузки категорий:', error);
      setError(`Не удалось загрузить категории: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Генерация ИИ предложений
  const generateAiSuggestions = async () => {
    if (!productName.trim()) return;

    setLoadingAi(true);
    try {
      console.log(`🤖 Генерируем ИИ предложения для: "${productName}"`);

      const response = await fetch('/api/wb-categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cabinetId,
          productName,
          productDescription
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSuggestions(result.data.suggestions || []);
        console.log(`✅ Получено ${result.data.suggestions?.length || 0} ИИ предложений`);
      } else {
        console.warn('⚠️ Не удалось получить ИИ предложения:', result.error);
        setSuggestions([]);
      }
    } catch (error: any) {
      console.error('❌ Ошибка генерации ИИ предложений:', error);
      setSuggestions([]);
    } finally {
      setLoadingAi(false);
    }
  };

  // Обработчики
  const handleCategorySelect = (category: WBCategory) => {
    onCategorySelect(category);
  };

  const toggleNode = (nodeId: number) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<number>();
    const collectIds = (nodes: CategoryHierarchy[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(hierarchy);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Утилиты для отображения
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-blue-600 bg-blue-100';
    if (confidence >= 0.4) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.8) return 'Очень высокая';
    if (confidence >= 0.6) return 'Высокая';
    if (confidence >= 0.4) return 'Средняя';
    return 'Низкая';
  };

  // Компонент узла иерархии
  const HierarchyNode = ({ node, level = 0 }: { node: CategoryHierarchy; level?: number }) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedCategoryId === node.id.toString();

    return (
      <div>
        <div
          className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
            isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => handleCategorySelect({
            objectID: node.id,
            objectName: node.name,
            parentID: node.parentId,
            isVisible: true
          })}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
            </div>
          )}

          <div className="flex items-center gap-2 flex-1">
            {hasChildren ? (
              <Folder className="w-4 h-4 text-blue-500" />
            ) : (
              <FolderOpen className="w-4 h-4 text-gray-500" />
            )}
            <span className={`${isSelected ? 'font-semibold text-blue-700' : ''}`}>
              {node.name}
            </span>
            <span className="text-xs text-gray-500">#{node.id}</span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => (
              <HierarchyNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Основной рендер
  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center py-8`}>
        <Loader className="w-6 h-6 animate-spin mr-2" />
        <span>Загружаем категории WB...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div className="flex-1">
            <div className="font-medium text-red-800">Ошибка загрузки категорий</div>
            <div className="text-sm text-red-600 mt-1">{error}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => loadCategories(false)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Попробовать снова
          </button>
          <button
            onClick={() => loadCategories(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Принудительно обновить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Заголовок и переключатели режимов */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold">Выбор категории WB</h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {categories.length} категорий
          </span>
        </div>
        
        <div className="flex gap-1">
          {enableAiSuggestions && (
            <button
              onClick={() => setViewMode('suggestions')}
              className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
                viewMode === 'suggestions' 
                  ? 'bg-purple-100 text-purple-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Zap className="w-4 h-4" />
              ИИ
            </button>
          )}
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              viewMode === 'list' 
                ? 'bg-blue-100 text-blue-700 font-medium' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Поиск
          </button>
          {showHierarchy && (
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'hierarchy' 
                  ? 'bg-green-100 text-green-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Дерево
            </button>
          )}
        </div>
      </div>

      {/* ИИ предложения */}
      {viewMode === 'suggestions' && enableAiSuggestions && (
        <div>
          {loadingAi ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-5 h-5 animate-spin mr-2" />
              <span>Анализируем товар...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-gray-800">ИИ рекомендации</h4>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Для "{productName}"
                </span>
              </div>
              
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.category.objectID}
                    className={`p-3 bg-white rounded border cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedCategoryId === suggestion.category.objectID.toString() 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200'
                    }`}
                    onClick={() => handleCategorySelect(suggestion.category)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{suggestion.category.objectName}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(suggestion.confidence)}`}>
                            {getConfidenceText(suggestion.confidence)}
                          </span>
                          {index === 0 && suggestion.confidence >= 0.8 && (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <div className="text-sm text-gray-600">{suggestion.reason}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          ID: {suggestion.category.objectID} • Точность: {Math.round(suggestion.confidence * 100)}%
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 flex gap-2">
                <button
                  onClick={generateAiSuggestions}
                  className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  Пересоздать предложения
                </button>
              </div>
            </div>
          ) : productName ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <div className="text-gray-600 mb-2">Не удалось найти подходящие категории</div>
              <div className="text-sm text-gray-500">
                Попробуйте уточнить название товара или воспользоваться поиском
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <div className="text-gray-600 mb-2">Введите название товара</div>
              <div className="text-sm text-gray-500">
                ИИ проанализирует товар и предложит подходящие категории
              </div>
            </div>
          )}
        </div>
      )}

      {/* Поиск по категориям */}
      {viewMode === 'list' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-800">Поиск категорий</span>
          </div>
          
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Введите название категории..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <button
                onClick={() => setShowOnlyLeafs(!showOnlyLeafs)}
                className={`px-3 py-2 rounded transition-colors ${
                  showOnlyLeafs 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Показать только конечные категории"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {searchQuery && filteredCategories.length > 0 && (
              <div className="max-h-80 overflow-y-auto border rounded">
                {filteredCategories.map(category => (
                  <div
                    key={category.objectID}
                    className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedCategoryId === category.objectID.toString() 
                        ? 'bg-blue-50 border-blue-200' 
                        : ''
                    }`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{category.objectName}</div>
                        <div className="text-sm text-gray-500">ID: {category.objectID}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && filteredCategories.length === 0 && (
              <div className="text-center py-6 text-gray-500 border rounded">
                Категории не найдены по запросу "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Иерархическое дерево */}
      {viewMode === 'hierarchy' && showHierarchy && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-800">Дерево категорий</span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <ChevronDown className="w-4 h-4" />
                Развернуть все
              </button>
              <button
                onClick={collapseAll}
                className="text-sm text-gray-600 hover:text-gray-700 flex items-center gap-1"
              >
                <ChevronUp className="w-4 h-4" />
                Свернуть все
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded bg-white">
            {hierarchy.length > 0 ? (
              hierarchy.map(node => (
                <HierarchyNode key={node.id} node={node} />
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                Иерархия категорий недоступна
              </div>
            )}
          </div>
        </div>
      )}

      {/* Выбранная категория */}
      {selectedCategoryId && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-800">Выбранная категория</span>
          </div>
          <div className="text-green-700">
            {categories.find(c => c.objectID.toString() === selectedCategoryId)?.objectName || 'Неизвестная категория'}
          </div>
          <div className="text-sm text-green-600">ID: {selectedCategoryId}</div>
        </div>
      )}

      {/* Статистика */}
      <div className="text-xs text-gray-500 pt-2 border-t flex justify-between">
        <span>
          Всего категорий: {categories.length}
          {viewMode === 'suggestions' && suggestions.length > 0 && ` • ИИ предложений: ${suggestions.length}`}
          {viewMode === 'list' && searchQuery && ` • Найдено: ${filteredCategories.length}`}
        </span>
        <button
          onClick={() => loadCategories(true)}
          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
          title="Обновить категории"
        >
          <RefreshCw className="w-3 h-3" />
          Обновить
        </button>
      </div>
    </div>
  );
}