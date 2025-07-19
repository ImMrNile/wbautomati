// lib/services/wbSimpleParser.ts - ПОЛНОСТЬЮ ОБНОВЛЕННАЯ ВЕРСИЯ с актуальными API

import { WB_API_ENDPOINTS, WB_DEFAULT_PARAMS, WB_HEADERS, WB_USER_AGENTS, validators } from '../config/wbApiConfig';

interface WBProductData {
  id: string;
  name: string;
  brand: string;
  price: number;
  rating: number;
  reviewsCount: number;
  description: string;
  characteristics: Array<{ name: string; value: string }>;
  images: string[];
  category: string;
  categoryId?: number;
  availability: boolean;
  vendorCode: string;
  supplierId?: string;
  tnved?: string;
}

interface ApiStrategy {
  name: string;
  execute: (nmId: string) => Promise<WBProductData | null>;
  priority: number;
}

export class WBSimpleParser {
  private strategies: ApiStrategy[] = [];
  private readonly requestHistory = new Map<string, number>();
  private readonly failureTracker = new Map<string, number>();

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Инициализация стратегий парсинга по приоритету
   */
  private initializeStrategies(): void {
    this.strategies = [
      {
        name: 'Card API v2',
        execute: (nmId) => this.getFromCardAPI(nmId, 'v2'),
        priority: 1
      },
      {
        name: 'Enrichment API',
        execute: (nmId) => this.getFromEnrichmentAPI(nmId),
        priority: 2
      },
      {
        name: 'Card API v1',
        execute: (nmId) => this.getFromCardAPI(nmId, 'v1'),
        priority: 3
      },
      {
        name: 'Search API v5',
        execute: (nmId) => this.getFromSearchAPI(nmId, 'v5'),
        priority: 4
      },
      {
        name: 'Basket API',
        execute: (nmId) => this.getFromBasketAPI(nmId),
        priority: 5
      },
      {
        name: 'Search API v4',
        execute: (nmId) => this.getFromSearchAPI(nmId, 'v4'),
        priority: 6
      }
    ];

    // Сортируем по приоритету
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Основной метод получения данных товара
   */
  async getProductData(url: string): Promise<WBProductData> {
    const nmId = this.extractProductId(url);
    if (!nmId) {
      throw new Error('Не удалось извлечь ID товара из URL');
    }

    if (!validators.isValidNmId(nmId)) {
      throw new Error('Некорректный формат ID товара');
    }

    console.log(`🔍 Начинаем парсинг товара ${nmId}`);

    // Фильтруем стратегии по статистике неудач
    const availableStrategies = this.strategies.filter(strategy => 
      (this.failureTracker.get(strategy.name) || 0) < 3
    );

    let lastError: Error | null = null;

    for (const strategy of availableStrategies) {
      try {
        console.log(`📡 Пробуем стратегию: ${strategy.name}`);
        
        // Применяем rate limiting
        await this.applyRateLimit(strategy.name);
        
        const result = await strategy.execute(nmId);
        
        if (this.isValidProductData(result)) {
          // Сбрасываем счетчик неудач при успехе
          this.failureTracker.delete(strategy.name);
          console.log(`✅ Успешно получены данные через ${strategy.name}`);
          return result;
        }
        
      } catch (error: any) {
        lastError = error;
        this.trackFailure(strategy.name);
        console.warn(`⚠️ ${strategy.name} failed:`, error.message);
        
        // Увеличиваем задержку при сетевых ошибках
        if (this.isNetworkError(error)) {
          await this.delay(2000);
        }
      }
    }

    // Если все стратегии не сработали, возвращаем fallback данные
    if (await this.checkProductExists(nmId)) {
      console.warn('⚠️ Все стратегии API не сработали, создаем fallback данные');
      return this.createFallbackProduct(nmId);
    }

    throw new Error(`Товар ${nmId} не найден ни одним из методов`);
  }

  /**
   * Метод 1: Card API (v1/v2)
   */
  private async getFromCardAPI(nmId: string, version: 'v1' | 'v2'): Promise<WBProductData | null> {
    const params = new URLSearchParams({
      ...WB_DEFAULT_PARAMS,
      nm: nmId
    });
    
    const url = version === 'v2' 
      ? `${WB_API_ENDPOINTS.public.cardDetailV2}?${params}`
      : `${WB_API_ENDPOINTS.public.cardDetail}?${params}`;

    const response = await this.makeSecureRequest(url);
    const data = await response.json();

    if (data?.data?.products && data.data.products.length > 0) {
      return this.parseCardResponse(data.data.products[0], nmId);
    }

    return null;
  }

  /**
   * Метод 2: Enrichment API (для batch запросов)
   */
  private async getFromEnrichmentAPI(nmId: string): Promise<WBProductData | null> {
    const params = new URLSearchParams({
      spp: '0',
      nm: nmId
    });

    const url = `${WB_API_ENDPOINTS.public.enrichment}?${params}`;
    const response = await this.makeSecureRequest(url);
    const data = await response.json();

    if (data?.data?.products && data.data.products.length > 0) {
      return this.parseEnrichmentResponse(data.data.products[0], nmId);
    }

    return null;
  }

  /**
   * Метод 3: Search API (v4/v5)
   */
  private async getFromSearchAPI(nmId: string, version: 'v4' | 'v5'): Promise<WBProductData | null> {
    const params = new URLSearchParams({
      ...WB_DEFAULT_PARAMS,
      query: nmId,
      resultset: 'catalog'
    });

    const url = version === 'v5'
      ? `${WB_API_ENDPOINTS.public.searchV5}?${params}`
      : `${WB_API_ENDPOINTS.public.searchV4}?${params}`;

    const response = await this.makeSecureRequest(url);
    const data = await response.json();

    if (data?.data?.products && data.data.products.length > 0) {
      const product = data.data.products.find((p: any) => 
        p.id?.toString() === nmId || p.root?.toString() === nmId
      );
      
      if (product) {
        return this.parseSearchResponse(product, nmId);
      }
    }

    return null;
  }

  /**
   * Метод 4: Basket API
   */
  private async getFromBasketAPI(nmId: string): Promise<WBProductData | null> {
    if (nmId.length < 6) return null;

    const vol = nmId.slice(0, -5);
    const part = nmId.slice(-5, -3);
    
    const baskets = ['basket-01', 'basket-02', 'basket-03'];
    
    for (const basket of baskets) {
      try {
        const url = `https://${basket}.wbbasket.ru/vol${vol}/part${part}/${nmId}/info/ru/card.json`;
        const response = await this.makeSecureRequest(url);
        
        if (response.status === 404) continue;
        
        const data = await response.json();
        
        if (data && (data.imt_name || data.nm_id)) {
          return this.parseBasketResponse(data, nmId);
        }
      } catch (error) {
        console.warn(`Basket ${basket} failed:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Безопасный HTTP запрос с антидетект мерами
   */
  private async makeSecureRequest(url: string, retries = 2): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const headers = this.getRandomHeaders();
        
        const response = await fetch(url, {
          headers,
          method: 'GET',
          signal: AbortSignal.timeout(15000) // 15 секунд таймаут
        });

        if (response.ok) {
          return response;
        }

        if (response.status === 404) {
          throw new Error('Товар не найден (404)');
        }

        if (response.status === 403) {
          throw new Error('Доступ заблокирован антиботом (403)');
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 3000;
          await this.delay(delay);
          continue;
        }

        if (response.status >= 500) {
          await this.delay(1000 * Math.pow(2, attempt));
          continue;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error('Запрос прерван по таймауту');
        }

        if (attempt === retries - 1) {
          throw error;
        }
        
        await this.delay(1000 * (attempt + 1));
      }
    }

    throw new Error('Превышено количество попыток запроса');
  }

  /**
   * Парсинг ответа Card API
   */
  private parseCardResponse(product: any, nmId: string): WBProductData {
    return {
      id: nmId,
      name: product.name || `Товар ${nmId}`,
      brand: product.brand || 'NoName',
      price: this.parsePrice(product.salePriceU || product.priceU),
      rating: product.rating || 0,
      reviewsCount: product.feedbacks || 0,
      description: this.buildDescription(product),
      characteristics: this.extractCharacteristics(product),
      images: this.generateImageUrls(nmId),
      category: product.subjectName || 'Товары для дома',
      categoryId: product.subjectId,
      availability: (product.totalQty || 0) > 0,
      vendorCode: product.vendorCode || nmId,
      supplierId: product.supplierId?.toString(),
      tnved: product.tnved || '8544429009'
    };
  }

  /**
   * Парсинг ответа Enrichment API
   */
  private parseEnrichmentResponse(product: any, nmId: string): WBProductData {
    return {
      id: nmId,
      name: product.name || `Товар ${nmId}`,
      brand: product.brand || 'NoName',
      price: this.parsePrice(product.priceU),
      rating: product.rating || 0,
      reviewsCount: product.feedbacks || 0,
      description: this.buildDescription(product),
      characteristics: this.extractCharacteristics(product),
      images: this.generateImageUrls(nmId),
      category: product.subjectName || 'Товары для дома',
      categoryId: product.subjectId,
      availability: true,
      vendorCode: nmId,
      supplierId: product.supplierId?.toString(),
      tnved: '8544429009'
    };
  }

  /**
   * Парсинг ответа Search API
   */
  private parseSearchResponse(product: any, nmId: string): WBProductData {
    return {
      id: nmId,
      name: product.name || `Товар ${nmId}`,
      brand: product.brand || 'NoName',
      price: this.parsePrice(product.priceU),
      rating: product.rating || 0,
      reviewsCount: product.feedbacks || 0,
      description: this.generateDefaultDescription(product.name || `Товар ${nmId}`),
      characteristics: [],
      images: this.generateImageUrls(nmId),
      category: product.subjectName || 'Товары для дома',
      categoryId: product.subjectId,
      availability: true,
      vendorCode: nmId,
      supplierId: product.supplierId?.toString(),
      tnved: '8544429009'
    };
  }

  /**
   * Парсинг ответа Basket API
   */
  private parseBasketResponse(data: any, nmId: string): WBProductData {
    return {
      id: nmId,
      name: data.imt_name || `Товар ${nmId}`,
      brand: data.selling?.brand_name || 'NoName',
      price: 0,
      rating: 0,
      reviewsCount: 0,
      description: data.description || this.generateDefaultDescription(data.imt_name || `Товар ${nmId}`),
      characteristics: this.parseBasketCharacteristics(data),
      images: this.generateImageUrls(nmId),
      category: data.subj_name || 'Товары для дома',
      categoryId: data.subj_root_id,
      availability: true,
      vendorCode: nmId,
      supplierId: data.supplier_id?.toString(),
      tnved: data.tnved || '8544429009'
    };
  }

  /**
   * Проверка валидности данных продукта
   */
  private isValidProductData(data: WBProductData | null): data is WBProductData {
    return !!(
      data && 
      data.id && 
      data.name && 
      data.name.length > 3 && 
      data.name !== `Товар ${data.id}`
    );
  }

  /**
   * Создание fallback продукта
   */
  private createFallbackProduct(nmId: string): WBProductData {
    return {
      id: nmId,
      name: `Товар ${nmId}`,
      brand: 'NoName',
      price: 0,
      rating: 0,
      reviewsCount: 0,
      description: 'Данные о товаре временно недоступны. Информация будет обновлена автоматически.',
      characteristics: [
        { name: 'Артикул', value: nmId },
        { name: 'Статус', value: 'Данные обновляются' }
      ],
      images: this.generateImageUrls(nmId),
      category: 'Товары для дома',
      categoryId: 14727,
      availability: true,
      vendorCode: nmId,
      supplierId: undefined,
      tnved: '8544429009'
    };
  }

  /**
   * Извлечение характеристик из ответа API
   */
  private extractCharacteristics(product: any): Array<{ name: string; value: string }> {
    const characteristics: Array<{ name: string; value: string }> = [];

    // Опции товара
    if (product.options && Array.isArray(product.options)) {
      product.options.forEach((option: any) => {
        if (option.name && option.value) {
          characteristics.push({
            name: option.name,
            value: String(option.value)
          });
        }
      });
    }

    // Цвета
    if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) {
      characteristics.push({
        name: 'Цвет',
        value: product.colors[0].name || 'Не указан'
      });
    }

    // Размеры
    if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
      const sizes = product.sizes
        .map((s: any) => s.name)
        .filter(Boolean)
        .join(', ');
      if (sizes) {
        characteristics.push({
          name: 'Размеры',
          value: sizes
        });
      }
    }

    // Базовые характеристики если ничего не найдено
    if (characteristics.length === 0) {
      if (product.brand && product.brand !== 'NoName') {
        characteristics.push({ name: 'Бренд', value: product.brand });
      }
      if (product.vendorCode) {
        characteristics.push({ name: 'Артикул', value: product.vendorCode });
      }
    }

    return characteristics;
  }

  /**
   * Парсинг характеристик из Basket API
   */
  private parseBasketCharacteristics(data: any): Array<{ name: string; value: string }> {
    const characteristics: Array<{ name: string; value: string }> = [];

    if (data.options && Array.isArray(data.options)) {
      data.options.forEach((option: any) => {
        if (option.name && option.value) {
          characteristics.push({
            name: option.name,
            value: String(option.value)
          });
        }
      });
    }

    if (data.selling?.brand_name) {
      characteristics.push({ 
        name: 'Бренд', 
        value: data.selling.brand_name 
      });
    }

    return characteristics;
  }

  /**
   * Построение описания товара
   */
  private buildDescription(product: any): string {
    const parts = [];

    if (product.brand && product.brand !== 'NoName') {
      parts.push(`✅ Бренд: ${product.brand}`);
    }

    if (product.rating > 0) {
      parts.push(`⭐ Рейтинг: ${product.rating}`);
    }

    if (product.feedbacks > 0) {
      parts.push(`💬 Отзывов: ${product.feedbacks}`);
    }

    parts.push('✅ Качественный товар');
    parts.push('✅ Быстрая доставка');
    parts.push('✅ Гарантия качества');

    if (product.description) {
      parts.push('');
      parts.push(product.description);
    }

    return parts.join('\n');
  }

  /**
   * Генерация базового описания
   */
  private generateDefaultDescription(name: string): string {
    return `${name}

✅ Высокое качество
✅ Быстрая доставка
✅ Выгодная цена
✅ Гарантия качества

Закажите прямо сейчас!`;
  }

  /**
   * Генерация URL изображений
   */
  private generateImageUrls(nmId: string): string[] {
    if (nmId.length < 6) return [];
    
    const vol = nmId.slice(0, -5);
    const part = nmId.slice(-5, -3);
    
    const images: string[] = [];
    const hosts = ['images.wbstatic.net', 'basket-01.wbbasket.ru'];
    
    for (let i = 1; i <= 5; i++) {
      const host = hosts[i % hosts.length];
      images.push(`https://${host}/vol${vol}/part${part}/${nmId}/images/c516x688/${i}.webp`);
    }
    
    return images;
  }

  /**
   * Парсинг цены из копеек
   */
  private parsePrice(priceU: number | undefined): number {
    if (!priceU || priceU <= 0) return 0;
    return Math.round(priceU / 100);
  }

  /**
   * Извлечение ID товара из URL
   */
  extractProductId(url: string): string | null {
    const patterns = [
      /\/catalog\/(\d+)\/detail\.aspx/,
      /\/catalog\/(\d+)/,
      /product\/(\d+)/,
      /detail\/(\d+)/,
      /nm(\d+)/,
      /(\d{8,})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Проверка существования товара
   */
  async checkProductExists(nmId: string): Promise<boolean> {
    try {
      // Метод 1: Проверка через изображение
      if (nmId.length >= 6) {
        const vol = nmId.slice(0, -5);
        const part = nmId.slice(-5, -3);
        const imageUrl = `https://images.wbstatic.net/vol${vol}/part${part}/${nmId}/images/c246x328/1.webp`;
        
        const response = await fetch(imageUrl, { 
          method: 'HEAD',
          headers: { 'User-Agent': this.getRandomUserAgent() },
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          return true;
        }
      }

      // Метод 2: Проверка через Card API
      const params = new URLSearchParams({
        ...WB_DEFAULT_PARAMS,
        nm: nmId
      });
      
      const url = `${WB_API_ENDPOINTS.public.cardDetail}?${params}`;
      const response = await this.makeSecureRequest(url);
      
      if (response.ok) {
        const data = await response.json();
        return !!(data?.data?.products && data.data.products.length > 0);
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Ошибка проверки существования товара:', error);
      return false;
    }
  }

  /**
   * Получение категорий WB
   */
  async getWBCategories(apiToken: string): Promise<any[]> {
    try {
      if (!apiToken || !validators.isValidApiToken(apiToken)) {
        console.warn('⚠️ Некорректный API токен, используем статичные категории');
        return this.getStaticCategories();
      }

      const response = await fetch(WB_API_ENDPOINTS.content.getAllCategories, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const categories = Array.isArray(data) ? data : (data.data || []);
      
      console.log(`✅ Загружено ${categories.length} категорий из WB API`);
      return categories;
      
    } catch (error: any) {
      console.error('❌ Ошибка получения категорий WB:', error.message);
      console.log('📂 Используем статичные категории как fallback');
      return this.getStaticCategories();
    }
  }

  /**
   * Получение характеристик категории
   */
  async getCategoryCharacteristics(categoryId: number, apiToken: string): Promise<any[]> {
    try {
      if (!validators.isValidApiToken(apiToken)) {
        throw new Error('Некорректный API токен');
      }

      const response = await fetch(WB_API_ENDPOINTS.content.getCategoryCharacteristics(categoryId), {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const characteristics = Array.isArray(data) ? data : (data.data || []);
      
      console.log(`✅ Получено ${characteristics.length} характеристик для категории ${categoryId}`);
      return characteristics;
      
    } catch (error: any) {
      console.error(`❌ Ошибка получения характеристик категории ${categoryId}:`, error.message);
      return [];
    }
  }

  /**
   * Создание карточки товара
   */
  async createProductCard(cardData: any, apiToken: string): Promise<any> {
    try {
      if (!validators.isValidApiToken(apiToken)) {
        throw new Error('Некорректный API токен');
      }

      console.log('🚀 Создаем карточку товара в WB...');

      const response = await fetch(WB_API_ENDPOINTS.content.uploadCard, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([cardData]),
        signal: AbortSignal.timeout(30000)
      });

      const responseText = await response.text();
      console.log('📥 Ответ от WB API:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`Некорректный JSON ответ: ${responseText}`);
      }

      if (Array.isArray(result) && result.length > 0) {
        const cardResult = result[0];
        
        if (cardResult.error) {
          return { 
            success: false, 
            error: cardResult.error,
            details: cardResult
          };
        }
        
        const nmId = cardResult.nmId || cardResult.nmID;
        if (nmId) {
          return { 
            success: true, 
            nmId: nmId,
            data: cardResult
          };
        }
      }

      return { 
        success: false, 
        error: 'Неожиданный формат ответа от WB API',
        rawResponse: result
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка создания карточки товара:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }

  /**
   * Статичные категории для fallback
   */
  private getStaticCategories(): any[] {
    return [
      { objectID: 1229, objectName: 'Электроника', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 5392, objectName: 'Кабели и адаптеры', parentID: 1229, parentName: 'Электроника', isLeaf: true },
      { objectID: 9836, objectName: 'Зарядные устройства', parentID: 1229, parentName: 'Электроника', isLeaf: true },
      { objectID: 340, objectName: 'Наушники', parentID: 1229, parentName: 'Электроника', isLeaf: true },
      { objectID: 4695, objectName: 'Внешние аккумуляторы', parentID: 1229, parentName: 'Электроника', isLeaf: true },
      { objectID: 8126, objectName: 'Женская одежда', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 8127, objectName: 'Мужская одежда', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 14727, objectName: 'Товары для дома', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 1347, objectName: 'Автотовары', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 1408, objectName: 'Спорт и отдых', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 6119, objectName: 'Детские товары', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 543, objectName: 'Красота и здоровье', parentID: 0, parentName: 'Корень', isLeaf: true }
    ];
  }

  /**
   * Rate limiting для запросов
   */
  private async applyRateLimit(strategyName: string): Promise<void> {
    const lastRequest = this.requestHistory.get(strategyName);
    const now = Date.now();
    
    if (lastRequest) {
      const timeDiff = now - lastRequest;
      const minInterval = this.getMinInterval(strategyName);
      
      if (timeDiff < minInterval) {
        const waitTime = minInterval - timeDiff;
        await this.delay(waitTime);
      }
    }
    
    this.requestHistory.set(strategyName, now);
  }

  /**
   * Получение минимального интервала между запросами для стратегии
   */
  private getMinInterval(strategyName: string): number {
    const intervals: Record<string, number> = {
      'Card API v1': 1000,
      'Card API v2': 1000,
      'Enrichment API': 2000,
      'Search API v4': 500,
      'Search API v5': 500,
      'Basket API': 800
    };
    
    return intervals[strategyName] || 1000;
  }

  /**
   * Отслеживание неудач стратегий
   */
  private trackFailure(strategyName: string): void {
    const currentFailures = this.failureTracker.get(strategyName) || 0;
    this.failureTracker.set(strategyName, currentFailures + 1);
  }

  /**
   * Проверка типа сетевой ошибки
   */
  private isNetworkError(error: any): boolean {
    const networkErrors = [
      'ENOTFOUND',
      'ECONNREFUSED', 
      'ECONNRESET',
      'ETIMEDOUT',
      'UND_ERR_CONNECT_TIMEOUT',
      'fetch failed',
      'network error'
    ];

    const errorString = error.toString().toLowerCase();
    return networkErrors.some(netError => 
      errorString.includes(netError.toLowerCase()) ||
      error.code === netError
    );
  }

  /**
   * Получение случайных заголовков
   */
  private getRandomHeaders(): Record<string, string> {
    return {
      ...WB_HEADERS,
      'User-Agent': this.getRandomUserAgent()
    };
  }

  /**
   * Получение случайного User-Agent
   */
  private getRandomUserAgent(): string {
    return WB_USER_AGENTS[Math.floor(Math.random() * WB_USER_AGENTS.length)];
  }

  /**
   * Задержка выполнения
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Получение статистики парсера
   */
  getParserStats(): {
    strategies: Array<{ name: string; failures: number; priority: number }>;
    totalRequests: number;
    successRate: number;
  } {
    const strategies = this.strategies.map(strategy => ({
      name: strategy.name,
      failures: this.failureTracker.get(strategy.name) || 0,
      priority: strategy.priority
    }));

    const totalRequests = this.requestHistory.size;
    const totalFailures = Array.from(this.failureTracker.values()).reduce((sum, count) => sum + count, 0);
    const successRate = totalRequests > 0 ? ((totalRequests - totalFailures) / totalRequests) * 100 : 0;

    return {
      strategies,
      totalRequests,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Сброс статистики неудач
   */
  resetFailureStats(): void {
    this.failureTracker.clear();
    console.log('🔄 Статистика неудач сброшена');
  }

  /**
   * Очистка ресурсов
   */
  async cleanup(): Promise<void> {
    this.requestHistory.clear();
    this.failureTracker.clear();
    console.log('🧹 Очистка ресурсов WB парсера завершена');
  }
}

// Экспорт экземпляра
export const wbSimpleParser = new WBSimpleParser();
export default WBSimpleParser;