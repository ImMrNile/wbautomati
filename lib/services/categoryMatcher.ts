// lib/utils/categoryMatcher.ts - Улучшенная логика выбора категории

interface CategoryMatch {
  category: {
    objectID: number;
    objectName: string;
    parentID?: number;
    parentName?: string;
    isLeaf?: boolean;
  };
  score: number;
  reason: string;
  source: 'ai' | 'reference' | 'keywords' | 'fallback';
}

export class CategoryMatcher {
  /**
   * Умный выбор категории с приоритетом ИИ
   */
  static findBestCategory(
    aiCategory: string,
    productName: string,
    productType: string,
    wbCategories: any[],
    referenceData?: any
  ): CategoryMatch {
    console.log('🎯 === АНАЛИЗ КАТЕГОРИИ ===');
    console.log(`🤖 ИИ предлагает: "${aiCategory}"`);
    console.log(`📦 Тип товара: "${productType}"`);
    console.log(`📝 Название: "${productName}"`);
    
    if (referenceData?.category) {
      console.log(`📋 Категория аналога: "${referenceData.category}"`);
    }

    const matches: CategoryMatch[] = [];

    // 1. ПРИОРИТЕТ 1: Точное совпадение с ИИ категорией
    const aiMatch = this.findByAICategory(aiCategory, wbCategories);
    if (aiMatch) {
      matches.push(aiMatch);
      console.log(`✅ Найдено точное совпадение с ИИ: ${aiMatch.category.objectName} (${aiMatch.score} баллов)`);
    }

    // 2. ПРИОРИТЕТ 2: Поиск по ключевым словам из названия товара
    const keywordMatches = this.findByKeywords(productName, productType, wbCategories);
    matches.push(...keywordMatches);

    // 3. ПРИОРИТЕТ 3: Категория аналога (только если нет лучших вариантов)
    if (referenceData?.category) {
      const referenceMatch = this.findByReferenceName(referenceData.category, wbCategories);
      if (referenceMatch) {
        matches.push(referenceMatch);
        console.log(`📋 Найдено совпадение с аналогом: ${referenceMatch.category.objectName} (${referenceMatch.score} баллов)`);
      }
    }

    // Сортируем по приоритету: сначала по источнику, потом по скору
    matches.sort((a, b) => {
      const sourcePriority = { 'ai': 4, 'keywords': 3, 'reference': 2, 'fallback': 1 };
      const aPriority = sourcePriority[a.source];
      const bPriority = sourcePriority[b.source];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Сначала по приоритету источника
      }
      return b.score - a.score; // Потом по скору
    });

    // Выбираем лучший результат
    if (matches.length > 0) {
      const bestMatch = matches[0];
      console.log(`🏆 ВЫБРАНА КАТЕГОРИЯ: "${bestMatch.category.objectName}"`);
      console.log(`📊 Источник: ${bestMatch.source}, Оценка: ${bestMatch.score}, Причина: ${bestMatch.reason}`);
      
      // Показываем альтернативы
      if (matches.length > 1) {
        console.log(`🔄 Альтернативы:`);
        matches.slice(1, 3).forEach((match, i) => {
          console.log(`   ${i + 2}. ${match.category.objectName} (${match.source}, ${match.score} баллов)`);
        });
      }
      
      return bestMatch;
    }

    // Fallback категория
    console.warn('⚠️ Не найдено подходящих категорий, используем fallback');
    return this.getFallbackCategory(aiCategory, productName);
  }

  /**
   * Поиск по ИИ категории
   */
  private static findByAICategory(aiCategory: string, categories: any[]): CategoryMatch | null {
    if (!aiCategory || aiCategory.length < 3) return null;

    const aiLower = aiCategory.toLowerCase().trim();
    
    // Точное совпадение
    for (const category of categories) {
      const categoryName = (category.objectName || '').toLowerCase();
      
      if (categoryName === aiLower) {
        return {
          category,
          score: 100,
          reason: 'Точное совпадение с ИИ категорией',
          source: 'ai'
        };
      }
    }

    // Частичное совпадение
    for (const category of categories) {
      const categoryName = (category.objectName || '').toLowerCase();
      
      if (categoryName.includes(aiLower) || aiLower.includes(categoryName)) {
        return {
          category,
          score: 90,
          reason: 'Частичное совпадение с ИИ категорией',
          source: 'ai'
        };
      }
    }

    return null;
  }

  /**
   * Поиск по ключевым словам
   */
  private static findByKeywords(productName: string, productType: string, categories: any[]): CategoryMatch[] {
    const matches: CategoryMatch[] = [];
    
    // Карта ключевых слов для электроники (расширенная)
    const electronicsKeywords = [
      'кабель', 'cable', 'провод', 'шнур', 'usb', 'type-c', 'lightning', 'micro',
      'зарядное', 'зарядка', 'charger', 'адаптер', 'adapter', 'переходник',
      'наушники', 'headphones', 'bluetooth', 'колонка', 'speaker',
      'телефон', 'phone', 'смартфон', 'планшет', 'tablet',
      'электрический', 'электронный', 'electric', 'electronic',
      'гаджет', 'девайс', 'device', 'техника', 'technology'
    ];

    const homeKeywords = [
      'дом', 'домашний', 'кухня', 'кухонный', 'посуда', 'тарелка', 'чашка',
      'мебель', 'стол', 'стул', 'текстиль', 'ковер', 'декор'
    ];

    const autoKeywords = [
      'авто', 'автомобильный', 'машина', 'автомобиль', 'для авто', 'в машину'
    ];

    const searchText = `${productName} ${productType}`.toLowerCase();

    // Проверяем электронику
    const electronicsMatches = electronicsKeywords.filter(keyword => 
      searchText.includes(keyword)
    );

    if (electronicsMatches.length > 0) {
      const electronicsCategory = categories.find(cat => 
        cat.objectName.toLowerCase().includes('электроника') ||
        cat.objectID === 1229 ||
        cat.objectName.toLowerCase().includes('кабел')
      );

      if (electronicsCategory) {
        matches.push({
          category: electronicsCategory,
          score: 85 + (electronicsMatches.length * 5), // Бонус за количество совпадений
          reason: `Ключевые слова электроники: ${electronicsMatches.join(', ')}`,
          source: 'keywords'
        });
      }
    }

    // Проверяем автотовары
    const autoMatches = autoKeywords.filter(keyword => 
      searchText.includes(keyword)
    );

    if (autoMatches.length > 0) {
      const autoCategory = categories.find(cat => 
        cat.objectName.toLowerCase().includes('авто') ||
        cat.objectID === 1347
      );

      if (autoCategory) {
        matches.push({
          category: autoCategory,
          score: 80 + (autoMatches.length * 5),
          reason: `Ключевые слова автотоваров: ${autoMatches.join(', ')}`,
          source: 'keywords'
        });
      }
    }

    // Проверяем товары для дома (только если нет других совпадений)
    const homeMatches = homeKeywords.filter(keyword => 
      searchText.includes(keyword)
    );

    if (homeMatches.length > 0 && matches.length === 0) {
      const homeCategory = categories.find(cat => 
        cat.objectName.toLowerCase().includes('дом') ||
        cat.objectID === 14727
      );

      if (homeCategory) {
        matches.push({
          category: homeCategory,
          score: 70 + (homeMatches.length * 3),
          reason: `Ключевые слова товаров для дома: ${homeMatches.join(', ')}`,
          source: 'keywords'
        });
      }
    }

    return matches;
  }

  /**
   * Поиск по названию категории аналога
   */
  private static findByReferenceName(referenceCategoryName: string, categories: any[]): CategoryMatch | null {
    if (!referenceCategoryName) return null;

    const refLower = referenceCategoryName.toLowerCase();

    // НЕ используем категорию аналога, если это "Товары для дома", а товар явно электронный
    if (refLower.includes('дом') || refLower.includes('товары для дома')) {
      console.log('⚠️ Категория аналога "Товары для дома" проигнорирована для электронного товара');
      return null;
    }

    for (const category of categories) {
      const categoryName = (category.objectName || '').toLowerCase();
      
      if (categoryName.includes(refLower) || refLower.includes(categoryName)) {
        return {
          category,
          score: 60, // Низкий приоритет для категории аналога
          reason: 'Совпадение с категорией аналога',
          source: 'reference'
        };
      }
    }

    return null;
  }

  /**
   * Fallback категория
   */
  private static getFallbackCategory(aiCategory: string, productName: string): CategoryMatch {
    const searchText = `${aiCategory} ${productName}`.toLowerCase();

    // Статические категории с приоритетом
    const fallbackCategories = [
      {
        keywords: ['электроника', 'кабель', 'зарядк', 'usb', 'type-c'],
        category: { objectID: 1229, objectName: 'Электроника', parentID: 0, parentName: '', isLeaf: true }
      },
      {
        keywords: ['авто', 'автомобил', 'машин'],
        category: { objectID: 1347, objectName: 'Автотовары', parentID: 0, parentName: '', isLeaf: true }
      },
      {
        keywords: ['одежд', 'футболк', 'рубашк'],
        category: { objectID: 306, objectName: 'Женская одежда', parentID: 0, parentName: '', isLeaf: true }
      }
    ];

    // Ищем подходящую fallback категорию
    for (const fallback of fallbackCategories) {
      const hasMatch = fallback.keywords.some(keyword => searchText.includes(keyword));
      if (hasMatch) {
        return {
          category: fallback.category,
          score: 50,
          reason: `Fallback по ключевым словам`,
          source: 'fallback'
        };
      }
    }

    // Дефолтная категория - НЕ "Товары для дома" для электроники
    if (searchText.includes('электрон') || searchText.includes('кабел') || searchText.includes('зарядк')) {
      return {
        category: { objectID: 1229, objectName: 'Электроника', parentID: 0, parentName: '', isLeaf: true },
        score: 45,
        reason: 'Дефолтная категория для электроники',
        source: 'fallback'
      };
    }

    // Общая дефолтная категория
    return {
      category: { objectID: 14727, objectName: 'Товары для дома', parentID: 0, parentName: '', isLeaf: true },
      score: 25,
      reason: 'Общая дефолтная категория',
      source: 'fallback'
    };
  }
}

// Обновленная функция для использования в основном роуте
export function findBestCategoryForProduct(
  geminiAnalysis: any,
  wbCategories: any[],
  referenceData?: any
): CategoryMatch {
  return CategoryMatcher.findBestCategory(
    geminiAnalysis.wbCategory || '',
    geminiAnalysis.visualAnalysis?.productType || '',
    geminiAnalysis.visualAnalysis?.productType || '',
    wbCategories,
    referenceData
  );
}