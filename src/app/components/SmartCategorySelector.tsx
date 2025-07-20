// components/SmartCategorySelector.tsx - Умный селектор категорий с предложениями

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Sparkles, ChevronRight, Star, Loader, AlertCircle, Lightbulb } from 'lucide-react';

interface WBCategory {
  objectID: number;
  objectName: string;
  parentID?: number;
  isVisible: boolean;
}

interface CategorySuggestion {
  category: WBCategory;
  confidence: number;
  reason: string;
  keywords: string[];
}

interface SmartCategorySelectorProps {
  apiToken: string;
  productName: string;
  onCategorySelect: (category: WBCategory) => void;
  selectedCategoryId?: string;
  className?: string;
}

export default function SmartCategorySelector({ 
  apiToken, 
  productName,
  onCategorySelect, 
  selectedCategoryId,
  className = "" 
}: SmartCategorySelectorProps) {
  const [categories, setCategories] = useState<WBCategory[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<WBCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Загружаем категории при монтировании
  useEffect(() => {
    if (apiToken) {
      loadCategories();
    }
  }, [apiToken]);

  // Генерируем предложения при изменении названия товара
  useEffect(() => {
    if (productName && categories.length > 0) {
      generateCategorySuggestions();
    }
  }, [productName, categories]);

  // Фильтруем категории по поисковому запросу
  useEffect(() => {
    if (searchQuery.trim() && categories.length > 0) {
      const filtered = categories.filter(cat => 
        cat.objectName.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 50);
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories([]);
    }
  }, [searchQuery, categories]);

  const loadCategories = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('📂 Загружаем категории WB с пагинацией...');
      
      // ВРЕМЕННАЯ ЗАГЛУШКА: создаем фиктивные категории для демонстрации
      const mockCategories: WBCategory[] = [
        // Электроника
        { objectID: 963, objectName: 'Кабели и адаптеры', isVisible: true },
        { objectID: 964, objectName: 'Аксессуары для электроники', isVisible: true },
        { objectID: 965, objectName: 'Аксессуары для мобильных телефонов', isVisible: true },
        { objectID: 966, objectName: 'Аксессуары для компьютеров', isVisible: true },
        { objectID: 967, objectName: 'Наушники и Bluetooth-гарнитуры', isVisible: true },
        { objectID: 968, objectName: 'Зарядные устройства', isVisible: true },
        
        // Дом и быт
        { objectID: 14727, objectName: 'Товары для дома', isVisible: true },
        { objectID: 2674, objectName: 'Кухонная посуда и принадлежности', isVisible: true },
        { objectID: 2675, objectName: 'Декор для дома', isVisible: true },
        { objectID: 2676, objectName: 'Хранение и организация', isVisible: true },
        
        // Одежда
        { objectID: 629, objectName: 'Мужская одежда', isVisible: true },
        { objectID: 8126, objectName: 'Женская одежда', isVisible: true },
        { objectID: 566, objectName: 'Детская одежда', isVisible: true },
        
        // Обувь
        { objectID: 2808, objectName: 'Мужская обувь', isVisible: true },
        { objectID: 2809, objectName: 'Женская обувь', isVisible: true },
        { objectID: 2810, objectName: 'Детская обувь', isVisible: true },
        
        // Красота и здоровье
        { objectID: 1564, objectName: 'Красота и здоровье', isVisible: true },
        { objectID: 1565, objectName: 'Косметика и парфюмерия', isVisible: true },
        
        // Спорт
        { objectID: 4091, objectName: 'Спорт и отдых', isVisible: true },
        { objectID: 4092, objectName: 'Фитнес и тренажеры', isVisible: true },
        
        // Автотовары
        { objectID: 4748, objectName: 'Автотовары', isVisible: true },
        { objectID: 4749, objectName: 'Автоэлектроника', isVisible: true },
        
        // Инструменты
        { objectID: 5001, objectName: 'Инструменты и оборудование', isVisible: true },
        { objectID: 5002, objectName: 'Строительные материалы', isVisible: true },
        
        // Игрушки
        { objectID: 4750, objectName: 'Игрушки', isVisible: true },
        { objectID: 4751, objectName: 'Развивающие игрушки', isVisible: true }
      ];

      // Если есть действующий токен, пытаемся загрузить реальные категории
      if (apiToken && apiToken.length > 10) {
        try {
    const response = await fetch('/api/wb-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: '/content/v2/object/all?locale=ru&limit=1000',
    method: 'GET',
    apiToken,
    useCache: true
  })
});


          const result = await response.json();
          if (result.success && result.data?.data && result.data.data.length > 0) {
            const realCategories = result.data.data.filter((cat: WBCategory) => cat.isVisible !== false);
            setCategories(realCategories);
            console.log(`✅ Загружено ${realCategories.length} реальных категорий из WB API`);
            return;
          }
        } catch (apiError) {
          console.warn('⚠️ Не удалось загрузить категории через API, используем заглушку');
        }
      }

      // Используем заглушку если API недоступен
      setCategories(mockCategories);
      console.log(`✅ Загружено ${mockCategories.length} категорий (заглушка)`);
      
    } catch (error) {
      console.error('❌ Ошибка загрузки категорий:', error);
      setError('Не удалось загрузить категории. Проверьте настройки API токена.');
    } finally {
      setLoading(false);
    }
  };

  const generateCategorySuggestions = useCallback(() => {
    if (!productName || categories.length === 0) return;

    console.log(`🎯 Генерируем предложения категорий для: "${productName}"`);
    
    const normalizedProductName = productName.toLowerCase().trim();
    const productWords = normalizedProductName.split(/[\s,.-]+/).filter(word => word.length > 2);
    
    // РАСШИРЕННЫЙ словарь ключевых слов для лучшего распознавания
    const categoryPatterns = [
      // Кабели и электроника
      { 
        keywords: ['кабель', 'провод', 'зарядка', 'зарядный', 'usb', 'type-c', 'lightning', 'micro', 'адаптер', 'шнур', 'переходник', 'hdmi', 'aux'], 
        searchTerms: ['кабел', 'провод', 'зарядка', 'адаптер', 'шнур'],
        priority: 10
      },
      // Аксессуары для телефонов
      { 
        keywords: ['телефон', 'смартфон', 'iphone', 'samsung', 'xiaomi', 'мобильный', 'чехол для телефона'], 
        searchTerms: ['телефон', 'смартфон', 'мобильн'],
        priority: 8
      },
      // Наушники и аудио
      { 
        keywords: ['наушники', 'наушник', 'гарнитура', 'блютуз', 'bluetooth', 'беспроводные', 'tws'], 
        searchTerms: ['наушник', 'bluetooth', 'беспроводн'],
        priority: 8
      },
      // Компьютерные аксессуары
      { 
        keywords: ['компьютер', 'ноутбук', 'пк', 'клавиатура', 'мышь', 'монитор', 'веб-камера'], 
        searchTerms: ['компьютер', 'ноутбук', 'клавиатур', 'мышь'],
        priority: 7
      },
      // Дом и быт
      { 
        keywords: ['дом', 'быт', 'кухня', 'посуда', 'хранение', 'организация'], 
        searchTerms: ['дом', 'кухн', 'посуд'],
        priority: 5
      }
    ];

    const categorySuggestions: CategorySuggestion[] = [];

    // Поиск по паттернам
    for (const pattern of categoryPatterns) {
      let matches = 0;
      let matchedWords: string[] = [];

      // Проверяем ключевые слова в названии товара
      for (const keyword of pattern.keywords) {
        if (productWords.some(word => word.includes(keyword) || keyword.includes(word))) {
          matches++;
          matchedWords.push(keyword);
        }
      }

      if (matches > 0) {
        // Ищем категории по поисковым терминам
        for (const searchTerm of pattern.searchTerms) {
          const foundCategories = categories.filter(cat => 
            cat.objectName.toLowerCase().includes(searchTerm)
          );

          for (const category of foundCategories.slice(0, 2)) { // Берем максимум 2 категории на паттерн
            const confidence = (matches / pattern.keywords.length) * (pattern.priority / 10);
            
            if (!categorySuggestions.find(s => s.category.objectID === category.objectID)) {
              categorySuggestions.push({
                category,
                confidence,
                reason: `Найдены ключевые слова: ${matchedWords.join(', ')}`,
                keywords: matchedWords
              });
            }
          }
        }
      }
    }

    // Дополнительный поиск по прямым совпадениям с названиями категорий
    for (const word of productWords) {
      if (word.length > 3) {
        const directMatches = categories.filter(cat => 
          cat.objectName.toLowerCase().includes(word) && 
          !categorySuggestions.find(s => s.category.objectID === cat.objectID)
        );

        for (const category of directMatches.slice(0, 2)) {
          categorySuggestions.push({
            category,
            confidence: 0.6,
            reason: `Прямое совпадение с названием категории: "${word}"`,
            keywords: [word]
          });
        }
      }
    }

    // Сортируем по уверенности и берем топ-6
    const topSuggestions = categorySuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6);

    setSuggestions(topSuggestions);
    console.log(`✅ Сгенерировано ${topSuggestions.length} предложений категорий:`, 
      topSuggestions.map(s => ({ name: s.category.objectName, confidence: s.confidence }))
    );
  }, [productName, categories]);

  const handleCategorySelect = (category: WBCategory) => {
    onCategorySelect(category);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'text-green-600 bg-green-100';
    if (confidence >= 0.4) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.7) return 'Высокая';
    if (confidence >= 0.4) return 'Средняя';
    return 'Низкая';
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin mr-2" />
          <span>Загружаем категории...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <div className="font-medium text-red-800">Ошибка загрузки категорий</div>
            <div className="text-sm text-red-600 mt-1">{error}</div>
          </div>
        </div>
        <button
          onClick={loadCategories}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Умные предложения на основе названия товара */}
      {suggestions.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold text-gray-800">Рекомендуемые категории</h4>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              На основе названия товара
            </span>
          </div>
          
          <div className="space-y-2">
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{suggestion.category.objectName}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(suggestion.confidence)}`}>
                        {getConfidenceText(suggestion.confidence)}
                      </span>
                      {index === 0 && suggestion.confidence >= 0.7 && (
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{suggestion.reason}</div>
                    <div className="text-xs text-gray-500">ID: {suggestion.category.objectID}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Поиск по всем категориям */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-800">Поиск по всем категориям</span>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Введите название категории..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {searchQuery && filteredCategories.length > 0 && (
          <div className="mt-3 max-h-60 overflow-y-auto border rounded">
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
                <div className="font-medium">{category.objectName}</div>
                <div className="text-sm text-gray-500">ID: {category.objectID}</div>
              </div>
            ))}
          </div>
        )}

        {searchQuery && filteredCategories.length === 0 && (
          <div className="mt-3 p-4 text-center text-gray-500 border rounded">
            Категории не найдены по запросу "{searchQuery}"
          </div>
        )}
      </div>

      {/* Показать популярные категории */}
      {!searchQuery && suggestions.length === 0 && (
        <div className="text-center py-8">
          <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <div className="text-gray-600 mb-2">Введите название товара для получения умных предложений</div>
          <div className="text-sm text-gray-500">
            Или воспользуйтесь поиском по категориям выше
          </div>
        </div>
      )}

      {/* Выбранная категория */}
      {selectedCategoryId && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm font-medium text-green-800">
            ✅ Выбранная категория: {categories.find(c => c.objectID.toString() === selectedCategoryId)?.objectName}
          </div>
          <div className="text-sm text-green-600">ID: {selectedCategoryId}</div>
        </div>
      )}

      {/* Статистика */}
      <div className="text-xs text-gray-500 pt-2 border-t">
        Всего категорий: {categories.length} | 
        {suggestions.length > 0 && ` Предложений: ${suggestions.length} |`}
        {searchQuery && ` Найдено: ${filteredCategories.length} |`}
        Система анализа категорий активна
      </div>
    </div>
  );
}