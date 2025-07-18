// lib/services/wbSimpleParser.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ

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
}

export class WBSimpleParser {
  private readonly BASE_URL = 'https://card.wb.ru';
  private readonly DETAIL_URL = 'https://basket-01.wbbasket.ru';
  private readonly SEARCH_URL = 'https://search.wb.ru';
  
  private readonly DEFAULT_PARAMS = {
    curr: 'rub',
    dest: '-1257786',
    spp: '30'
  };

  /**
   * Главный метод получения данных товара
   */
  async getProductData(url: string): Promise<WBProductData> {
    const nmId = this.extractProductId(url);
    if (!nmId) {
      throw new Error('Не удалось извлечь ID товара из URL');
    }

    console.log(`🔍 Получаем данные товара ${nmId}...`);

    const methods = [
      () => this.getFromCardAPI(nmId),
      () => this.getFromDetailAPI(nmId),
      () => this.getFromSearchAPI(nmId)
    ];

    for (const [index, method] of methods.entries()) {
      try {
        const result = await method();
        if (result && result.name) {
          console.log(`✅ Данные получены методом ${index + 1}: ${result.name}`);
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ Метод ${index + 1} не сработал:`, error);
      }
    }

    throw new Error('Не удалось получить данные товара');
  }

  /**
   * Метод 1: Card API
   */
  private async getFromCardAPI(nmId: string): Promise<WBProductData | null> {
    try {
      const url = `${this.BASE_URL}/cards/detail?${new URLSearchParams({
        ...this.DEFAULT_PARAMS,
        nm: nmId
      })}`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.wildberries.ru/'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return this.parseCardResponse(data, nmId);

    } catch (error) {
      console.warn('Card API failed:', error);
      return null;
    }
  }

  /**
   * Метод 2: Detail API
   */
  private async getFromDetailAPI(nmId: string): Promise<WBProductData | null> {
    try {
      const vol = nmId.slice(0, -5);
      const part = nmId.slice(-5, -3);
      
      const url = `${this.DETAIL_URL}/vol${vol}/part${part}/${nmId}/info/ru/card.json`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return this.parseDetailResponse(data, nmId);

    } catch (error) {
      console.warn('Detail API failed:', error);
      return null;
    }
  }

  /**
   * Метод 3: Search API
   */
  private async getFromSearchAPI(nmId: string): Promise<WBProductData | null> {
    try {
      const url = `${this.SEARCH_URL}/exactmatch/ru/common/v4/search?${new URLSearchParams({
        appType: '1',
        ...this.DEFAULT_PARAMS,
        query: nmId,
        resultset: 'catalog'
      })}`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return this.parseSearchResponse(data, nmId);

    } catch (error) {
      console.warn('Search API failed:', error);
      return null;
    }
  }

  /**
   * Парсинг ответа Card API
   */
  private parseCardResponse(data: any, nmId: string): WBProductData | null {
    try {
      const products = data.data?.products || [];
      const product = products[0];

      if (!product) return null;

      return {
        id: nmId,
        name: product.name || '',
        brand: product.brand || 'Не указан',
        price: product.salePriceU ? Math.round(product.salePriceU / 100) : 0,
        rating: product.rating || 0,
        reviewsCount: product.feedbacks || 0,
        description: this.buildDescription(product),
        characteristics: this.extractCharacteristics(product),
        images: this.generateImageUrls(nmId),
        category: product.subjectName || 'Товары для дома',
        categoryId: product.subjectId,
        availability: product.totalQty > 0,
        vendorCode: product.vendorCode || nmId,
        supplierId: product.supplierId?.toString()
      };

    } catch (error) {
      console.error('Error parsing card response:', error);
      return null;
    }
  }

  /**
   * Парсинг ответа Detail API
   */
  private parseDetailResponse(data: any, nmId: string): WBProductData | null {
    try {
      if (!data || !data.imt_name) return null;

      return {
        id: nmId,
        name: data.imt_name || '',
        brand: data.selling?.brand_name || 'Не указан',
        price: 0,
        rating: 0,
        reviewsCount: 0,
        description: data.description || this.generateDefaultDescription(data.imt_name),
        characteristics: this.parseDetailCharacteristics(data),
        images: this.generateImageUrls(nmId),
        category: data.subj_name || 'Товары для дома',
        categoryId: data.subj_root_id,
        availability: true,
        vendorCode: nmId,
        supplierId: data.supplier_id?.toString()
      };

    } catch (error) {
      console.error('Error parsing detail response:', error);
      return null;
    }
  }

  /**
   * Парсинг ответа Search API
   */
  private parseSearchResponse(data: any, nmId: string): WBProductData | null {
    try {
      const products = data.data?.products || [];
      const product = products.find((p: any) => 
        p.id?.toString() === nmId || p.nm?.toString() === nmId
      );

      if (!product) return null;

      return {
        id: nmId,
        name: product.name || '',
        brand: product.brand || 'Не указан',
        price: product.priceU ? Math.round(product.priceU / 100) : 0,
        rating: product.rating || 0,
        reviewsCount: product.feedbacks || 0,
        description: this.generateDefaultDescription(product.name),
        characteristics: [],
        images: this.generateImageUrls(nmId),
        category: product.subjectName || 'Товары для дома',
        categoryId: product.subjectId,
        availability: true,
        vendorCode: nmId,
        supplierId: product.supplierId?.toString()
      };

    } catch (error) {
      console.error('Error parsing search response:', error);
      return null;
    }
  }

  /**
   * Извлечение характеристик из ответа API
   */
  private extractCharacteristics(product: any): Array<{ name: string; value: string }> {
    const characteristics: Array<{ name: string; value: string }> = [];

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

    if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) {
      characteristics.push({
        name: 'Цвет',
        value: product.colors[0].name || 'Не указан'
      });
    }

    if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
      const sizes = product.sizes.map((s: any) => s.name).join(', ');
      characteristics.push({
        name: 'Размеры',
        value: sizes
      });
    }

    if (characteristics.length === 0) {
      if (product.brand) {
        characteristics.push({ name: 'Бренд', value: product.brand });
      }
      if (product.vendorCode) {
        characteristics.push({ name: 'Артикул', value: product.vendorCode });
      }
    }

    return characteristics;
  }

  /**
   * Извлечение характеристик из Detail API
   */
  private parseDetailCharacteristics(data: any): Array<{ name: string; value: string }> {
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
      characteristics.push({ name: 'Бренд', value: data.selling.brand_name });
    }

    return characteristics;
  }

  /**
   * Построение описания товара
   */
  private buildDescription(product: any): string {
    const parts = [];

    if (product.brand && product.brand !== 'Не указан') {
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
   * Генерация URL изображений
   */
  private generateImageUrls(nmId: string): string[] {
    const vol = nmId.slice(0, -5);
    const part = nmId.slice(-5, -3);
    
    const images: string[] = [];
    
    for (let i = 1; i <= 5; i++) {
      images.push(`https://images.wbstatic.net/c516x688/pic${vol}${part}${nmId}-${i}.webp`);
    }
    
    return images;
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
      const imageUrl = `https://images.wbstatic.net/c516x688/pic${nmId.slice(0, -5)}${nmId.slice(-5, -3)}${nmId}-1.webp`;
      const response = await fetch(imageUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Получение списка категорий WB
   */
  async getWBCategories(apiToken: string): Promise<any[]> {
    try {
      const response = await fetch('https://suppliers-api.wildberries.ru/content/v2/object/all', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || []);
    } catch (error) {
      console.error('Ошибка получения категорий WB:', error);
      
      return [
        { objectID: 14727, objectName: 'Товары для дома' },
        { objectID: 306, objectName: 'Женская одежда' },
        { objectID: 566, objectName: 'Мужская одежда' },
        { objectID: 629, objectName: 'Детские товары' },
        { objectID: 518, objectName: 'Красота и здоровье' }
      ];
    }
  }

  /**
   * Получение характеристик категории
   */
  async getCategoryCharacteristics(categoryId: number, apiToken: string): Promise<any[]> {
    try {
      const response = await fetch(`https://suppliers-api.wildberries.ru/content/v2/object/charcs/${categoryId}`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || []);
    } catch (error) {
      console.error('Ошибка получения характеристик категории:', error);
      return [];
    }
  }

  /**
   * Создание карточки товара
   */
  async createProductCard(cardData: any, apiToken: string): Promise<any> {
    try {
      console.log('🚀 Создаем карточку товара в WB...');

      const response = await fetch('https://suppliers-api.wildberries.ru/content/v2/cards/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([cardData])
      });

      const responseText = await response.text();
      console.log('📥 Ответ сервера:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`Некорректный JSON ответ: ${responseText}`);
      }

      if (result && Array.isArray(result) && result.length > 0) {
        const cardResult = result[0];
        
        if (cardResult.error) {
          return { success: false, error: cardResult.error };
        }
        
        if (cardResult.nmId || cardResult.nmID) {
          return { 
            success: true, 
            nmId: cardResult.nmId || cardResult.nmID,
            data: cardResult
          };
        }
      }

      return { 
        success: false, 
        error: 'Неожиданный формат ответа от API WB',
        rawResponse: result
      };
      
    } catch (error) {
      console.error('❌ Ошибка создания карточки товара:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }

  /**
   * Очистка ресурсов
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Очистка ресурсов завершена');
  }
}

// Создаем и экспортируем экземпляр
export const wbSimpleParser = new WBSimpleParser();
export default wbSimpleParser;