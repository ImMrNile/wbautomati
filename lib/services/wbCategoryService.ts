// lib/services/wbCategoryService.ts
import { hybridWBParser } from './hybridWBParser';

interface WBCategory {
  objectID: number;
  objectName: string;
  parentID: number;
  parentName: string;
  isLeaf: boolean;
  path?: string[];
  keywords?: string[];
}

interface CategorySearchResult {
  category: WBCategory;
  score: number;
  reason: string;
  path: string;
}

export class WBCategoryService {
  private categoriesCache: WBCategory[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 3600000; // 1 час

  /**
   * Получение дерева категорий с кэшированием
   */
  async getAllCategories(apiToken?: string): Promise<WBCategory[]> {
    const now = Date.now();
    
    if (this.categoriesCache.length > 0 && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.categoriesCache;
    }

    try {
      console.log('🔄 Загружаем категории WB...');
      
      // Попытка загрузить через API
      if (apiToken) {
        const response = await fetch('https://content-api.wildberries.ru/content/v2/object/all', {
          headers: {
            'Authorization': apiToken,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.categoriesCache = this.processCategories(data.data || []);
          this.lastCacheUpdate = now;
          console.log(`✅ Загружено ${this.categoriesCache.length} категорий`);
          return this.categoriesCache;
        }
      }

      // Fallback на статические категории
      return this.getEnhancedStaticCategories();
      
    } catch (error) {
      console.error('❌ Ошибка загрузки категорий:', error);
      return this.getEnhancedStaticCategories();
    }
  }

  /**
   * Обработка категорий и построение путей
   */
  private processCategories(rawCategories: any[]): WBCategory[] {
    const categoriesMap = new Map<number, WBCategory>();
    
    // Первый проход - создаем все категории
    rawCategories.forEach(cat => {
      categoriesMap.set(cat.objectID, {
        objectID: cat.objectID,
        objectName: cat.objectName,
        parentID: cat.parentID || 0,
        parentName: cat.parentName || '',
        isLeaf: cat.isLeaf || false,
        keywords: this.extractKeywords(cat.objectName)
      });
    });

    // Второй проход - строим пути
    categoriesMap.forEach(category => {
      category.path = this.buildCategoryPath(category, categoriesMap);
    });

    return Array.from(categoriesMap.values());
  }

  /**
   * Построение пути категории
   */
  private buildCategoryPath(category: WBCategory, categoriesMap: Map<number, WBCategory>): string[] {
    const path: string[] = [category.objectName];
    let current = category;
    
    while (current.parentID && current.parentID !== 0) {
      const parent = categoriesMap.get(current.parentID);
      if (parent) {
        path.unshift(parent.objectName);
        current = parent;
      } else {
        break;
      }
    }
    
    return path;
  }

  /**
   * Извлечение ключевых слов из названия категории
   */
  private extractKeywords(categoryName: string): string[] {
    const name = categoryName.toLowerCase();
    const keywords: string[] = [name];
    
    // Разбиваем на слова
    const words = name.split(/[\s,и-]+/).filter(w => w.length > 2);
    keywords.push(...words);
    
    // Добавляем синонимы
    const synonyms: Record<string, string[]> = {
      'кабели': ['кабель', 'провод', 'шнур'],
      'зарядные': ['зарядка', 'зарядное', 'charger'],
      'адаптеры': ['адаптер', 'переходник', 'adapter'],
      'наушники': ['наушник', 'гарнитура', 'headphones'],
      'чехлы': ['чехол', 'кейс', 'case'],
      'защитные': ['защита', 'защитный', 'протектор']
    };

    Object.entries(synonyms).forEach(([key, values]) => {
      if (name.includes(key)) {
        keywords.push(...values);
      }
    });

    return [...new Set(keywords)];
  }

  /**
   * Умный поиск категории по названию товара
   */
  async findBestCategory(
    productName: string,
    productType: string,
    aiSuggestedCategory?: string,
    referenceCategory?: string,
    apiToken?: string
  ): Promise<CategorySearchResult> {
    console.log('\n🎯 === ПОИСК ОПТИМАЛЬНОЙ КАТЕГОРИИ ===');
    console.log(`📦 Товар: "${productName}"`);
    console.log(`🏷️ Тип: "${productType}"`);
    if (aiSuggestedCategory) console.log(`🤖 ИИ предлагает: "${aiSuggestedCategory}"`);
    if (referenceCategory) console.log(`📋 Категория аналога: "${referenceCategory}"`);

    const categories = await this.getAllCategories(apiToken);
    const searchResults: CategorySearchResult[] = [];

    // 1. Поиск по точному совпадению с ИИ
    if (aiSuggestedCategory) {
      const aiResults = this.searchByExactMatch(aiSuggestedCategory, categories);
      searchResults.push(...aiResults);
    }

    // 2. Поиск по ключевым словам товара
    const keywordResults = this.searchByProductKeywords(productName, productType, categories);
    searchResults.push(...keywordResults);

    // 3. Поиск по категории аналога (с низким приоритетом)
    if (referenceCategory && !this.isGenericCategory(referenceCategory)) {
      const refResults = this.searchByExactMatch(referenceCategory, categories);
      refResults.forEach(r => r.score *= 0.6); // Понижаем приоритет
      searchResults.push(...refResults);
    }

    // Сортируем по релевантности
    searchResults.sort((a, b) => {
      // Приоритет листовым категориям
      if (a.category.isLeaf !== b.category.isLeaf) {
        return a.category.isLeaf ? -1 : 1;
      }
      return b.score - a.score;
    });

    // Выбираем лучший результат
    if (searchResults.length > 0) {
      const best = searchResults[0];
      console.log(`\n🏆 ВЫБРАНА КАТЕГОРИЯ:`);
      console.log(`📂 ${best.path}`);
      console.log(`🆔 ID: ${best.category.objectID}`);
      console.log(`📊 Релевантность: ${best.score}%`);
      console.log(`💡 Причина: ${best.reason}`);
      
      // Показываем альтернативы
      if (searchResults.length > 1) {
        console.log(`\n🔄 Альтернативные варианты:`);
        searchResults.slice(1, 4).forEach((r, i) => {
          console.log(`   ${i + 2}. ${r.path} (${r.score}%)`);
        });
      }
      
      return best;
    }

    // Fallback
    console.warn('⚠️ Не найдено подходящих категорий, используем fallback');
    return this.getFallbackCategory(productName, productType);
  }

  /**
   * Поиск по точному совпадению
   */
  private searchByExactMatch(searchTerm: string, categories: WBCategory[]): CategorySearchResult[] {
    const results: CategorySearchResult[] = [];
    const searchLower = searchTerm.toLowerCase().trim();

    categories.forEach(category => {
      const nameLower = category.objectName.toLowerCase();
      let score = 0;
      let reason = '';

      // Точное совпадение
      if (nameLower === searchLower) {
        score = 100;
        reason = 'Точное совпадение названия';
      }
      // Категория содержит поисковый термин
      else if (nameLower.includes(searchLower)) {
        score = 80;
        reason = 'Частичное совпадение названия';
      }
      // Поисковый термин содержит категорию
      else if (searchLower.includes(nameLower) && nameLower.length > 4) {
        score = 70;
        reason = 'Обратное частичное совпадение';
      }

      if (score > 0) {
        results.push({
          category,
          score,
          reason,
          path: category.path?.join(' > ') || category.objectName
        });
      }
    });

    return results;
  }

  /**
   * Поиск по ключевым словам товара
   */
  private searchByProductKeywords(productName: string, productType: string, categories: WBCategory[]): CategorySearchResult[] {
    const results: CategorySearchResult[] = [];
    
    // Извлекаем ключевые слова из названия
    const productKeywords = this.extractProductKeywords(productName, productType);
    
    categories.forEach(category => {
      if (!category.keywords) return;

      let matchCount = 0;
      const matchedKeywords: string[] = [];

      // Считаем совпадения ключевых слов
      productKeywords.forEach(productKeyword => {
        if (category.keywords!.some(catKeyword => 
          catKeyword.includes(productKeyword) || productKeyword.includes(catKeyword)
        )) {
          matchCount++;
          matchedKeywords.push(productKeyword);
        }
      });

      if (matchCount > 0) {
        const score = Math.min(95, 50 + (matchCount * 15));
        results.push({
          category,
          score,
          reason: `Совпадение по ключевым словам: ${matchedKeywords.join(', ')}`,
          path: category.path?.join(' > ') || category.objectName
        });
      }
    });

    return results;
  }

  /**
   * Извлечение ключевых слов из названия товара
   */
  private extractProductKeywords(productName: string, productType: string): string[] {
    const text = `${productName} ${productType}`.toLowerCase();
    const keywords: string[] = [];

    // Карта важных ключевых слов для разных категорий
    const keywordPatterns: Record<string, string[]> = {
      'кабель': ['кабель', 'cable', 'провод', 'шнур', 'wire'],
      'зарядка': ['зарядка', 'зарядное', 'charger', 'charging'],
      'usb': ['usb', 'юсб', 'usb-a', 'usb-c', 'type-c', 'lightning', 'micro'],
      'адаптер': ['адаптер', 'adapter', 'переходник', 'конвертер'],
      'наушники': ['наушники', 'headphones', 'гарнитура', 'earphones'],
      'чехол': ['чехол', 'case', 'кейс', 'cover'],
      'пленка': ['пленка', 'стекло', 'защита', 'протектор'],
      'держатель': ['держатель', 'holder', 'крепление', 'mount'],
      'power': ['power', 'bank', 'повербанк', 'батарея', 'аккумулятор']
    };

    // Ищем паттерны в тексте
    Object.entries(keywordPatterns).forEach(([key, patterns]) => {
      if (patterns.some(pattern => text.includes(pattern))) {
        keywords.push(key);
        // Добавляем найденные паттерны
        patterns.forEach(pattern => {
          if (text.includes(pattern)) {
            keywords.push(pattern);
          }
        });
      }
    });

    // Добавляем слова из названия
    const words = text.split(/[\s,-]+/).filter(w => w.length > 2);
    keywords.push(...words);

    return [...new Set(keywords)];
  }

  /**
   * Проверка на общую категорию
   */
  private isGenericCategory(categoryName: string): boolean {
    const genericCategories = [
      'товары для дома',
      'разное',
      'прочее',
      'другое',
      'общее'
    ];
    
    const nameLower = categoryName.toLowerCase();
    return genericCategories.some(generic => nameLower.includes(generic));
  }

  /**
   * Fallback категория
   */
  private getFallbackCategory(productName: string, productType: string): CategorySearchResult {
    const nameLower = `${productName} ${productType}`.toLowerCase();
    
    // Определяем базовую категорию по ключевым словам
    if (nameLower.match(/кабель|зарядк|usb|type-c|провод|адаптер/)) {
      return {
        category: {
          objectID: 9835,
          objectName: 'Кабели для телефонов',
          parentID: 4830,
          parentName: 'Аксессуары для телефонов',
          isLeaf: true,
          path: ['Электроника', 'Аксессуары для телефонов', 'Кабели для телефонов']
        },
        score: 50,
        reason: 'Категория по умолчанию для кабелей',
        path: 'Электроника > Аксессуары для телефонов > Кабели для телефонов'
      };
    }

    // Общий fallback
    return {
      category: {
        objectID: 4830,
        objectName: 'Аксессуары для телефонов',
        parentID: 429,
        parentName: 'Электроника',
        isLeaf: false,
        path: ['Электроника', 'Аксессуары для телефонов']
      },
      score: 25,
      reason: 'Общая категория по умолчанию',
      path: 'Электроника > Аксессуары для телефонов'
    };
  }

  /**
   * Расширенные статические категории для электроники
   */
  private getEnhancedStaticCategories(): WBCategory[] {
    return [
      // Электроника - основная категория
      {
        objectID: 429,
        objectName: 'Электроника',
        parentID: 0,
        parentName: '',
        isLeaf: false,
        path: ['Электроника'],
        keywords: ['электроника', 'гаджеты', 'техника']
      },
      
      // Аксессуары для телефонов
      {
        objectID: 4830,
        objectName: 'Аксессуары для телефонов',
        parentID: 429,
        parentName: 'Электроника',
        isLeaf: false,
        path: ['Электроника', 'Аксессуары для телефонов'],
        keywords: ['аксессуары', 'телефон', 'смартфон', 'мобильный']
      },
      
      // Кабели для телефонов (листовая категория)
      {
        objectID: 9835,
        objectName: 'Кабели для телефонов',
        parentID: 4830,
        parentName: 'Аксессуары для телефонов',
        isLeaf: true,
        path: ['Электроника', 'Аксессуары для телефонов', 'Кабели для телефонов'],
        keywords: ['кабель', 'провод', 'шнур', 'usb', 'type-c', 'lightning', 'micro', 'зарядка']
      },
      
      // Зарядные устройства
      {
        objectID: 9836,
        objectName: 'Зарядные устройства',
        parentID: 4830,
        parentName: 'Аксессуары для телефонов',
        isLeaf: true,
        path: ['Электроника', 'Аксессуары для телефонов', 'Зарядные устройства'],
        keywords: ['зарядка', 'зарядное', 'charger', 'адаптер', 'блок питания']
      },
      
      // Чехлы для телефонов
      {
        objectID: 165695,
        objectName: 'Чехлы',
        parentID: 4830,
        parentName: 'Аксессуары для телефонов',
        isLeaf: true,
        path: ['Электроника', 'Аксессуары для телефонов', 'Чехлы'],
        keywords: ['чехол', 'case', 'кейс', 'бампер', 'накладка']
      },
      
      // Защитные стекла и пленки
      {
        objectID: 62795,
        objectName: 'Защитные стекла и пленки',
        parentID: 4830,
        parentName: 'Аксессуары для телефонов',
        isLeaf: true,
        path: ['Электроника', 'Аксессуары для телефонов', 'Защитные стекла и пленки'],
        keywords: ['стекло', 'пленка', 'защита', 'протектор', 'экран']
      },
      
      // Наушники
      {
        objectID: 340,
        objectName: 'Наушники',
        parentID: 429,
        parentName: 'Электроника',
        isLeaf: true,
        path: ['Электроника', 'Наушники'],
        keywords: ['наушники', 'гарнитура', 'headphones', 'earphones', 'airpods']
      },
      
      // Power Bank
      {
        objectID: 4695,
        objectName: 'Внешние аккумуляторы',
        parentID: 4830,
        parentName: 'Аксессуары для телефонов',
        isLeaf: true,
        path: ['Электроника', 'Аксессуары для телефонов', 'Внешние аккумуляторы'],
        keywords: ['powerbank', 'повербанк', 'аккумулятор', 'батарея', 'внешний']
      },
      
      // Держатели для телефонов
      {
        objectID: 4831,
        objectName: 'Держатели',
        parentID: 4830,
        parentName: 'Аксессуары для телефонов',
        isLeaf: true,
        path: ['Электроника', 'Аксессуары для телефонов', 'Держатели'],
        keywords: ['держатель', 'holder', 'крепление', 'mount', 'подставка']
      },
      
      // Автотовары
      {
        objectID: 9524,
        objectName: 'Автотовары',
        parentID: 0,
        parentName: '',
        isLeaf: false,
        path: ['Автотовары'],
        keywords: ['авто', 'автомобиль', 'машина', 'car']
      },
      
      // Автоэлектроника
      {
        objectID: 4857,
        objectName: 'Автоэлектроника',
        parentID: 9524,
        parentName: 'Автотовары',
        isLeaf: true,
        path: ['Автотовары', 'Автоэлектроника'],
        keywords: ['автоэлектроника', 'прикуриватель', 'fm-трансмиттер', 'видеорегистратор']
      }
    ];
  }

  /**
   * Получение характеристик для категории
   */
  async getCategoryCharacteristics(categoryId: number, apiToken: string): Promise<any[]> {
    try {
      if (!apiToken) {
        return this.getDefaultCharacteristics(categoryId);
      }

      const response = await fetch(`https://content-api.wildberries.ru/content/v2/object/charcs/${categoryId}`, {
        headers: {
          'Authorization': apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data || this.getDefaultCharacteristics(categoryId);
      }

      return this.getDefaultCharacteristics(categoryId);
      
    } catch (error) {
      console.error('Ошибка получения характеристик:', error);
      return this.getDefaultCharacteristics(categoryId);
    }
  }

  /**
   * Базовые характеристики для категорий
   */
  private getDefaultCharacteristics(categoryId: number): any[] {
    const baseChars = [
      { charcID: 85936, charcName: 'Бренд', required: true },
      { charcID: 85941, charcName: 'Комплектация', required: true },
      { charcID: 125160, charcName: 'Страна производства', required: true },
      { charcID: 125163, charcName: 'Вес товара с упаковкой (г)', required: true }
    ];

    // Специфичные для кабелей
    if (categoryId === 9835) {
      return [
        ...baseChars,
        { charcID: 85896, charcName: 'Тип', required: true },
        { charcID: 125257, charcName: 'Длина, м', required: true },
        { charcID: 85809, charcName: 'Разъем', required: true },
        { charcID: 125159, charcName: 'Назначение кабеля/переходника', required: true }
      ];
    }

    // Для зарядных устройств
    if (categoryId === 9836) {
      return [
        ...baseChars,
        { charcID: 125256, charcName: 'Выходная мощность, Вт', required: true },
        { charcID: 125255, charcName: 'Количество портов', required: true }
      ];
    }

    return baseChars;
  }
}

export const wbCategoryService = new WBCategoryService();