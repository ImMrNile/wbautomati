// lib/services/wbParser.ts

export class WBParser {
  
  // Новые базовые URL для API 2025
  private readonly API_ENDPOINTS = {
    content: 'https://content-api.wildberries.ru',
    marketplace: 'https://marketplace-api.wildberries.ru', 
    statistics: 'https://statistics-api.wildberries.ru',
    prices: 'https://discounts-prices-api.wildberries.ru'
  };

  // Публичные API для получения данных товаров (не требуют токена)
  private readonly PUBLIC_ENDPOINTS = {
    card: 'https://card.wb.ru/cards/detail',
    search: 'https://search.wb.ru/exactmatch/ru/common/v4/search',
    feedbacks: 'https://feedbacks1.wb.ru/feedbacks/v1'
  };

  private readonly USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  ];

  // Извлечение ID товара из URL Wildberries
  extractProductId(url: string): string | null {
    try {
      const patterns = [
        /\/catalog\/(\d+)\/detail\.aspx/,  // Старый формат
        /\/product\/(\d+)/,                // Новый формат  
        /wildberries\.ru\/.*\/(\d+)/       // Общий паттерн
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      return null;
    } catch (error) {
      console.error('Ошибка извлечения ID товара:', error);
      return null;
    }
  }

  // Получение данных товара с WB (публичный API)
  async getProductData(productId: string): Promise<any> {
    try {
      // Получаем базовую информацию через публичный API
      const cardResponse = await this.makeRequest(
        `${this.PUBLIC_ENDPOINTS.card}?appType=1&curr=rub&dest=-1257786&spp=0&nm=${productId}`
      );
      
      if (!cardResponse.ok) {
        throw new Error('Товар не найден в WB');
      }

      const cardData = await cardResponse.json();
      
      if (!cardData.data?.products?.[0]) {
        throw new Error('Данные товара не найдены');
      }

      const product = cardData.data.products[0];

      // Получаем отзывы для дополнительной информации
      const reviewsData = await this.getProductReviews(productId);

      // Получаем характеристики товара
      const characteristics = await this.extractCharacteristics(product);

      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: this.extractCategory(product),
        price: product.priceU / 100, // Цена в копейках
        rating: product.rating,
        reviewsCount: product.feedbacks || 0,
        description: this.cleanDescription(product.description),
        images: this.extractImages(product),
        characteristics: characteristics,
        colors: this.extractColors(product),
        materials: this.extractMaterials(characteristics),
        keywords: this.generateKeywords(product.name, characteristics),
        url: `https://www.wildberries.ru/catalog/${productId}/detail.aspx`,
        seller: product.supplier,
        inStock: product.totalQuantity > 0,
        ...reviewsData
      };

    } catch (error) {
      console.error('Ошибка получения данных товара WB:', error);
      throw error;
    }
  }

  // Получение категорий через новый API
  async getWBCategories(apiToken: string): Promise<any[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.API_ENDPOINTS.content}/content/v2/object/all`,
        apiToken
      );

      if (!response.ok) {
        throw new Error(`WB API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ошибка получения категорий WB:', error);
      return [];
    }
  }

  // Получение характеристик категории через новый API
  async getCategoryCharacteristics(categoryId: number, apiToken: string): Promise<any[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.API_ENDPOINTS.content}/content/v2/object/characteristics/${categoryId}`,
        apiToken
      );

      if (!response.ok) {
        console.warn(`Не удалось получить характеристики для категории ${categoryId}`);
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Ошибка получения характеристик:', error);
      return [];
    }
  }

  // Создание карточки товара через новый API
  async createProductCard(cardData: any, apiToken: string): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.API_ENDPOINTS.content}/content/v2/cards/upload`,
        apiToken,
        'POST',
        [cardData]
      );

      const data = await response.json();

      if (response.ok && data.length > 0 && !data[0].error) {
        return {
          success: true,
          nmId: data[0].nmId,
          data: data[0]
        };
      } else {
        return {
          success: false,
          error: data[0]?.error || data.message || 'Неизвестная ошибка WB API'
        };
      }

    } catch (error) {
      console.error('Ошибка создания карточки в WB:', error);
      return {
        success: false,
        error: 'Ошибка подключения к API Wildberries'
      };
    }
  }

  // Универсальный метод для авторизованных запросов
  private async makeAuthenticatedRequest(
    url: string,
    token: string,
    method: string = 'GET',
    body?: any,
    retries: number = 3
  ): Promise<Response> {
    const headers: HeadersInit = {
      'Authorization': token,
      'Content-Type': 'application/json',
      'User-Agent': this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)],
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive'
    };

    const options: RequestInit = {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) })
    };

    const delay = 300 + Math.random() * 700;
    await this.sleep(delay);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Обработка rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('X-Ratelimit-Retry') || '60');
          console.log(`Rate limit hit, waiting ${retryAfter}s...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        return response;

      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt === retries) {
          throw error;
        }
        
        // Экспоненциальная задержка
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error('Max retries exceeded');
  }

  // Универсальный метод для публичных запросов
  private async makeRequest(url: string, options?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      'User-Agent': this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)],
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      ...(options?.headers as Record<string, string> ?? {})
    };

    const delay = 300 + Math.random() * 700;
    await this.sleep(delay);

    return fetch(url, { ...options, headers });
  }

  // Получение отзывов товара
  private async getProductReviews(productId: string) {
    try {
      const reviewsResponse = await this.makeRequest(
        `${this.PUBLIC_ENDPOINTS.feedbacks}/${productId}`
      );
      
      if (!reviewsResponse.ok) {
        return { reviews: [], positiveReviewsPercent: 0 };
      }

      const reviewsData = await reviewsResponse.json();
      
      if (!reviewsData.feedbacks) {
        return { reviews: [], positiveReviewsPercent: 0 };
      }

      const reviews = reviewsData.feedbacks.slice(0, 10).map((review: any) => ({
        rating: review.productValuation,
        text: review.text,
        date: review.createdDate,
        photos: review.photoLinks || []
      }));

      const positiveReviews = reviewsData.feedbacks.filter((r: any) => r.productValuation >= 4).length;
      const positiveReviewsPercent = Math.round((positiveReviews / reviewsData.feedbacks.length) * 100);

      return {
        reviews,
        positiveReviewsPercent,
        avgRating: this.calculateAvgRating(reviewsData.feedbacks)
      };

    } catch (error) {
      console.error('Ошибка получения отзывов:', error);
      return { reviews: [], positiveReviewsPercent: 0 };
    }
  }

  // Извлечение характеристик товара
  private extractCharacteristics(product: any): Array<{name: string, value: string}> {
    const characteristics = [];

    try {
      if (product.options) {
        for (const option of product.options) {
          if (option.name && option.value) {
            characteristics.push({
              name: option.name,
              value: Array.isArray(option.value) ? option.value.join(', ') : option.value.toString()
            });
          }
        }
      }

      if (product.groupedOptions) {
        for (const group of product.groupedOptions) {
          if (group.options) {
            for (const option of group.options) {
              if (option.name && option.value) {
                characteristics.push({
                  name: option.name,
                  value: Array.isArray(option.value) ? option.value.join(', ') : option.value.toString()
                });
              }
            }
          }
        }
      }

      return characteristics;

    } catch (error) {
      console.error('Ошибка извлечения характеристик:', error);
      return [];
    }
  }

  // Извлечение категории
  private extractCategory(product: any): string {
    try {
      if (product.subjectName) return product.subjectName;
      if (product.categoryName) return product.categoryName;
      if (product.subject) return product.subject;
      return 'Не определена';
    } catch (error) {
      return 'Не определена';
    }
  }

  // Очистка описания
  private cleanDescription(description: string): string {
    if (!description) return '';
    
    return description
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000);
  }

  // Извлечение изображений
  private extractImages(product: any): string[] {
    const images = [];
    
    try {
      if (product.pics) {
        const basePath = `https://basket-${product.pics.toString().padStart(2, '0').slice(-2)}.wbbasket.ru`;
        
        for (let i = 1; i <= Math.min(product.pics, 10); i++) {
          images.push(`${basePath}/vol${Math.floor(product.id / 100000)}/part${Math.floor(product.id / 1000)}/${product.id}/images/big/${i}.jpg`);
        }
      }
    } catch (error) {
      console.error('Ошибка извлечения изображений:', error);
    }

    return images;
  }

  // Извлечение цветов
  private extractColors(product: any): string[] {
    const colors = new Set<string>();

    try {
      if (product.options) {
        for (const option of product.options) {
          if (option.name && option.name.toLowerCase().includes('цвет')) {
            if (Array.isArray(option.value)) {
              option.value.forEach((color: string) => colors.add(color));
            } else {
              colors.add(option.value.toString());
            }
          }
        }
      }

      const colorKeywords = ['черный', 'белый', 'красный', 'синий', 'зеленый', 'желтый', 'серый', 'розовый', 'фиолетовый', 'оранжевый'];
      const name = product.name.toLowerCase();
      
      for (const color of colorKeywords) {
        if (name.includes(color)) {
          colors.add(color);
        }
      }

    } catch (error) {
      console.error('Ошибка извлечения цветов:', error);
    }

    return Array.from(colors);
  }

  // Извлечение материалов
  private extractMaterials(characteristics: Array<{name: string, value: string}>): string[] {
    const materials = new Set<string>();

    try {
      for (const char of characteristics) {
        const name = char.name.toLowerCase();
        if (name.includes('материал') || name.includes('состав') || name.includes('ткань')) {
          const values = char.value.split(/[,;\/]/).map(v => v.trim());
          values.forEach(value => {
            if (value && value !== 'не указан' && value !== '-') {
              materials.add(value);
            }
          });
        }
      }
    } catch (error) {
      console.error('Ошибка извлечения материалов:', error);
    }

    return Array.from(materials);
  }

  // Генерация ключевых слов
  private generateKeywords(name: string, characteristics: Array<{name: string, value: string}>): string[] {
    const keywords = new Set<string>();

    try {
      const nameWords = name.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);

      nameWords.forEach(word => keywords.add(word));

      for (const char of characteristics) {
        const words = char.value.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2);

        words.forEach(word => keywords.add(word));
      }

      return Array.from(keywords).slice(0, 20);

    } catch (error) {
      console.error('Ошибка генерации ключевых слов:', error);
      return [];
    }
  }

  // Подсчет среднего рейтинга
  private calculateAvgRating(reviews: any[]): number {
    if (!reviews || reviews.length === 0) return 0;

    const totalRating = reviews.reduce((sum, review) => sum + (review.productValuation || 0), 0);
    return Math.round((totalRating / reviews.length) * 10) / 10;
  }

  // Анализ конкурентов через публичный поиск
  async analyzeCompetitors(categoryName: string, limit: number = 10): Promise<any[]> {
    try {
      const searchResponse = await this.makeRequest(
        `${this.PUBLIC_ENDPOINTS.search}?appType=1&curr=rub&dest=-1257786&query=${encodeURIComponent(categoryName)}&resultset=catalog&sort=popular&spp=0`
      );
      
      if (!searchResponse.ok) {
        throw new Error('Ошибка поиска конкурентов');
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.data?.products) {
        return [];
      }

      const competitors = searchData.data.products.slice(0, limit).map((product: any) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.priceU / 100,
        rating: product.rating,
        reviewsCount: product.feedbacks || 0,
        seller: product.supplier,
        url: `https://www.wildberries.ru/catalog/${product.id}/detail.aspx`
      }));

      return competitors;

    } catch (error) {
      console.error('Ошибка анализа конкурентов:', error);
      return [];
    }
  }

  // Получение трендовых товаров
  async getTrendingProducts(category: string = ''): Promise<any[]> {
    try {
      const query = category ? `&subject=${encodeURIComponent(category)}` : '';
      const response = await this.makeRequest(
        `${this.PUBLIC_ENDPOINTS.search}?appType=1&curr=rub&dest=-1257786&resultset=catalog&sort=popular&spp=0${query}`
      );
      
      if (!response.ok) {
        throw new Error('Ошибка получения трендовых товаров');
      }

      const data = await response.json();
      
      if (!data.data?.products) {
        return [];
      }

      return data.data.products.slice(0, 20).map((product: any) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.priceU / 100,
        rating: product.rating,
        reviewsCount: product.feedbacks || 0,
        category: product.subjectName || 'Не определена',
        url: `https://www.wildberries.ru/catalog/${product.id}/detail.aspx`
      }));

    } catch (error) {
      console.error('Ошибка получения трендовых товаров:', error);
      return [];
    }
  }

  // Анализ SEO ключевых слов
  async analyzeSEOKeywords(productName: string): Promise<string[]> {
    try {
      const searchResponse = await this.makeRequest(
        `${this.PUBLIC_ENDPOINTS.search}?appType=1&curr=rub&dest=-1257786&query=${encodeURIComponent(productName)}&resultset=catalog&sort=popular&spp=0`
      );
      
      if (!searchResponse.ok) {
        return [];
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.data?.products) {
        return [];
      }

      const keywords = new Set<string>();

      for (const product of searchData.data.products.slice(0, 10)) {
        const words = product.name.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((word: string) => word.length > 2);

        words.forEach((word: string) => keywords.add(word));
      }

      return Array.from(keywords).slice(0, 50);

    } catch (error) {
      console.error('Ошибка анализа SEO ключевых слов:', error);
      return [];
    }
  }

  // Получение похожих товаров (алиас для анализа конкурентов)
  async getSimilarProducts(query: string, limit: number = 10): Promise<any[]> {
    return await this.analyzeCompetitors(query, limit);
  }

  // Вспомогательная функция для задержки
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Экспортируем экземпляр парсера
export const wbParser = new WBParser();