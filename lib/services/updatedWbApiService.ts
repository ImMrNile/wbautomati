// lib/services/updatedWbApiService.ts - Обновленный сервис для работы с WB API

import { WB_API_CONFIG, DEFAULT_VALUES } from '../config/wbApiConfig';
import {
  WBCategory,
  CategoryHierarchy,
  CategoryCharacteristic,
  ProductCardData,
  WBApiResponse,
  WBCardCreateRequest,
  normalizeCategory,
  getCategoryId,
  WB_CATEGORY_DEFAULTS
} from '../types/wbTypes';

// Экспортируем все типы для совместимости
export type {
  WBCategory,
  CategoryHierarchy,
  CategoryCharacteristic,
  ProductCardData,
  WBApiResponse,
  WBCardCreateRequest
} from '../types/wbTypes';

/**
 * Получает абсолютный URL для API прокси.
 * На сервере использует переменную окружения, в браузере - относительный путь.
 */
const getApiProxyUrl = (): string => {
  if (typeof window !== 'undefined') {
    // В браузере можно использовать относительный путь
    return '/api/wb-proxy';
  }
  // На сервере строим абсолютный URL из переменных окружения
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl}/api/wb-proxy`;
};

export class UpdatedWbApiService {
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  /**
   * Получить все категории WB
   */
  async getAllCategories(cabinetId: string, useCache: boolean = true): Promise<WBCategory[]> {
    try {
      console.log('📂 Загружаем все категории WB...');

      const response = await fetch(`/api/wb-categories?cabinetId=${cabinetId}&flat=true&useCache=${useCache}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Ошибка загрузки категорий');
      }

      console.log(`✅ Загружено ${result.data.categories.length} категорий`);
      return result.data.categories.map(normalizeCategory);

    } catch (error: any) {
      console.error('❌ Ошибка получения категорий:', error);
      throw new Error(`Не удалось загрузить категории: ${error.message}`);
    }
  }

  /**
   * Получить иерархию категорий
   */
  async getCategoryHierarchy(cabinetId: string, useCache: boolean = true): Promise<CategoryHierarchy[]> {
    try {
      console.log('🌳 Загружаем иерархию категорий WB...');

      const response = await fetch(`/api/wb-categories?cabinetId=${cabinetId}&flat=false&useCache=${useCache}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Ошибка загрузки иерархии категорий');
      }

      console.log(`✅ Загружена иерархия из ${result.data.hierarchy?.length || 0} корневых категорий`);
      return result.data.hierarchy || [];

    } catch (error: any) {
      console.error('❌ Ошибка получения иерархии категорий:', error);
      throw new Error(`Не удалось загрузить иерархию категорий: ${error.message}`);
    }
  }

  /**
   * Поиск категорий по названию
   */
  async searchCategories(cabinetId: string, query: string, limit: number = 20): Promise<WBCategory[]> {
    try {
      console.log(`🔍 Поиск категорий по запросу: "${query}"`);

      const response = await fetch(
        `/api/wb-categories?cabinetId=${cabinetId}&search=${encodeURIComponent(query)}&limit=${limit}&flat=true`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Ошибка поиска категорий');
      }

      console.log(`✅ Найдено ${result.data.categories.length} категорий`);
      return result.data.categories.map(normalizeCategory);

    } catch (error: any) {
      console.error('❌ Ошибка поиска категорий:', error);
      throw new Error(`Не удалось найти категории: ${error.message}`);
    }
  }

  /**
   * Найти лучшую категорию для товара
   */
  async findBestCategory(productName: string, cabinetId: string, productDescription?: string): Promise<WBCategory | null> {
    try {
      console.log(`🎯 Поиск лучшей категории для товара: "${productName}"`);

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

      if (!result.success) {
        console.warn('⚠️ Не удалось получить ИИ предложения категорий');
        return null;
      }

      const suggestions = result.data.suggestions;
      if (suggestions && suggestions.length > 0) {
        const bestCategory = normalizeCategory(suggestions[0].category);
        console.log(`✅ Найдена лучшая категория: ${bestCategory.objectName} (ID: ${bestCategory.objectID})`);
        return bestCategory;
      }

      return null;

    } catch (error: any) {
      console.error('❌ Ошибка поиска лучшей категории:', error);
      return null;
    }
  }

  /**
   * Получить характеристики для категории
   */
  async getCategoryCharacteristics(cabinetId: string, categoryId: number): Promise<CategoryCharacteristic[]> {
    try {
      console.log(`📋 Загружаем характеристики для категории ${categoryId}...`);

      const response = await fetch(
        `/api/wb-categories/characteristics?cabinetId=${cabinetId}&categoryId=${categoryId}`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Ошибка загрузки характеристик');
      }

      console.log(`✅ Загружено ${result.data.characteristics.length} характеристик`);
      return result.data.characteristics;

    } catch (error: any) {
      console.error(`❌ Ошибка получения характеристик категории ${categoryId}:`, error);
      throw new Error(`Не удалось загрузить характеристики: ${error.message}`);
    }
  }

  /**
   * Валидировать характеристики товара
   */
  async validateCharacteristics(
    cabinetId: string,
    categoryId: number,
    characteristics: Record<string, any>
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    missingRequired: string[];
  }> {
    try {
      console.log(`✅ Валидируем характеристики для категории ${categoryId}...`);

      const response = await fetch('/api/wb-categories/characteristics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cabinetId,
          categoryId,
          characteristics
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Ошибка валидации характеристик');
      }

      return result.data;

    } catch (error: any) {
      console.error('❌ Ошибка валидации характеристик:', error);
      return {
        valid: false,
        errors: [`Ошибка валидации: ${error.message}`],
        warnings: [],
        missingRequired: []
      };
    }
  }

  /**
   * Подготовить данные карточки для WB
   */
  prepareCardDataForWB(productData: ProductCardData): WBCardCreateRequest {
    const {
      vendorCode,
      title,
      description,
      brand,
      categoryId,
      price,
      dimensions,
      characteristics,
      packageContents,
      barcode
    } = productData;

    // Базовая структура карточки товара для WB API
    const cardData: WBCardCreateRequest = {
      // Основная информация
      vendorCode: vendorCode.substring(0, 75), // Ограничение WB
      object: categoryId, // Используем object вместо subjectID
      brand: brand || DEFAULT_VALUES.BRAND,

      // Названия и описания
      title: title.substring(0, 60), // Ограничение WB
      description: description.substring(0, 5000), // Ограничение WB

      // Размеры и вес
      dimensions: {
        length: Math.round(dimensions.length * 10) / 10,
        width: Math.round(dimensions.width * 10) / 10,
        height: Math.round(dimensions.height * 10) / 10,
        weight: Math.round(dimensions.weight * 1000) / 1000
      },

      // Характеристики
      characteristics: this.formatCharacteristicsForWB(characteristics),

      // Дополнительные поля
      composition: packageContents || 'Товар - 1 шт., упаковка - 1 шт.',

      // Баркод (если есть)
      ...(barcode && { barcode })
    };

    console.log('📦 Данные карточки подготовлены для WB API');
    return cardData;
  }

  /**
   * Форматировать характеристики для WB API
   */
  private formatCharacteristicsForWB(characteristics: Record<string, any>): any[] {
    return Object.entries(characteristics).map(([id, value]) => {
      const formattedValue = Array.isArray(value) ? value : [String(value)];

      return {
        id: parseInt(id),
        value: formattedValue
      };
    }).filter(char => char.id && char.value.length > 0);
  }

  /**
   * Создать карточку товара в WB
   */
  async createProductCard(cardData: WBCardCreateRequest, apiToken: string): Promise<WBApiResponse> {
    try {
      console.log('🚀 Создаем карточку товара в WB...');

      // Используем прокси для создания карточки
      const response = await this.makeWbApiRequest({
        endpoint: '/content/v2/cards/upload',
        method: 'POST',
        data: [cardData], // WB API ожидает массив карточек
        apiToken
      });

      if (response.success) {
        console.log('✅ Карточка товара успешно создана');

        const taskId = response.data?.taskID || response.data?.data?.taskID;

        return {
          success: true,
          data: response.data,
          taskId: taskId
        };
      } else {
        console.error('❌ Ошибка при создании карточки (ответ от прокси):', response.error);
        throw new Error(response.error || 'Неизвестная ошибка создания карточки');
      }

    } catch (error: any) {
      console.error('❌ Ошибка создания карточки товара:', error);
      return {
        success: false,
        error: `Не удалось создать карточку товара: ${error.message}`
      };
    }
  }

  /**
   * Проверить статус создания карточки
   */
  async checkCardCreationStatus(taskId: string, apiToken: string): Promise<WBApiResponse> {
    try {
      console.log(`📊 Проверяем статус создания карточки (Task ID: ${taskId})...`);

      const response = await this.makeWbApiRequest({
        endpoint: `/content/v2/cards/upload/task/${taskId}/status`,
        method: 'GET',
        apiToken
      });

      if (response.success) {
        const status = response.data?.data?.status || response.data?.status;
        console.log(`📊 Статус создания карточки: ${status}`);

        return {
          success: true,
          data: {
            status,
            taskId,
            ...response.data
          }
        };
      } else {
        throw new Error(response.error || 'Ошибка проверки статуса');
      }

    } catch (error: any) {
      console.error('❌ Ошибка проверки статуса карточки:', error);
      return {
        success: false,
        error: `Не удалось проверить статус: ${error.message}`
      };
    }
  }

  /**
   * Получить информацию о карточке по артикулу
   */
  async getCardByVendorCode(vendorCode: string, apiToken: string): Promise<WBApiResponse> {
    try {
      console.log(`🔍 Поиск карточки по артикулу: ${vendorCode}`);

      const response = await this.makeWbApiRequest({
        endpoint: `/content/v2/get/cards/list?vendorCode=${encodeURIComponent(vendorCode)}`,
        method: 'GET',
        apiToken
      });

      if (response.success) {
        const cards = response.data?.data?.cards || response.data?.cards || [];

        if (cards.length > 0) {
          console.log(`✅ Найдена карточка для артикула ${vendorCode}`);
          return {
            success: true,
            data: cards[0]
          };
        } else {
          return {
            success: false,
            error: `Карточка с артикулом ${vendorCode} не найдена`
          };
        }
      } else {
        throw new Error(response.error || 'Ошибка поиска карточки');
      }

    } catch (error: any) {
      console.error(`❌ Ошибка поиска карточки по артикулу ${vendorCode}:`, error);
      return {
        success: false,
        error: `Не удалось найти карточку: ${error.message}`
      };
    }
  }

  /**
   * Обновить цену товара
   */
  async updateProductPrice(vendorCode: string, price: number, apiToken: string): Promise<WBApiResponse> {
    try {
      console.log(`💰 Обновляем цену для артикула ${vendorCode}: ${price} руб.`);

      const response = await this.makeWbApiRequest({
        endpoint: '/public/api/v1/prices',
        method: 'POST',
        data: [{
          vendorCode,
          price: Math.round(price * 100) // WB API ожидает цену в копейках
        }],
        apiToken,
        baseUrl: WB_API_CONFIG.BASE_URLS.DISCOUNTS_PRICES
      });

      if (response.success) {
        console.log(`✅ Цена обновлена для артикула ${vendorCode}`);
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.error || 'Ошибка обновления цены');
      }

    } catch (error: any) {
      console.error(`❌ Ошибка обновления цены для ${vendorCode}:`, error);
      return {
        success: false,
        error: `Не удалось обновить цену: ${error.message}`
      };
    }
  }

  /**
   * Универсальный метод для запросов к WB API с повторными попытками (ИСПРАВЛЕН)
   */
  private async makeWbApiRequest({
    endpoint,
    method = 'GET',
    data,
    apiToken,
    baseUrl,
    retry = 0
  }: {
    endpoint: string;
    method?: string;
    data?: any;
    apiToken: string;
    baseUrl?: string;
    retry?: number;
  }): Promise<WBApiResponse> {
    const proxyUrl = getApiProxyUrl(); // Получаем правильный абсолютный URL

    try {
      const response = await fetch(proxyUrl, { // Используем абсолютный URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          method,
          data,
          apiToken,
          baseUrl,
          useCache: method === 'GET'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proxy Error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();

      if (!result.success && retry < this.maxRetries) {
        console.warn(`⚠️ Повторная попытка ${retry + 1}/${this.maxRetries} для ${endpoint} после ошибки от прокси: ${result.error}`);
        await this.delay(this.retryDelay * (retry + 1));
        return this.makeWbApiRequest({ endpoint, method, data, apiToken, baseUrl, retry: retry + 1 });
      }

      return result;

    } catch (error: any) {
      console.error(`❌ Ошибка вызова прокси (${endpoint}): ${error.message}`);
      if (retry < this.maxRetries) {
        console.warn(`⚠️ Повторная попытка ${retry + 1}/${this.maxRetries} после ошибки сети.`);
        await this.delay(this.retryDelay * (retry + 1));
        return this.makeWbApiRequest({ endpoint, method, data, apiToken, baseUrl, retry: retry + 1 });
      }

      // Выбрасываем ошибку, чтобы она была обработана выше по стеку вызовов
      throw error;
    }
  }

  /**
   * Вспомогательный метод для задержки
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Тестирование соединения с WB API
   */
  async testConnection(apiToken: string): Promise<{
    success: boolean;
    tests: Array<{
      name: string;
      description: string;
      status: 'success' | 'error';
      message: string;
      responseTime: string;
      endpoint?: string;
      httpStatus?: number;
    }>;
    summary: {
      totalTests: number;
      successCount: number;
      failureCount: number;
      overallStatus: 'success' | 'partial' | 'failed';
      recommendation: string;
    };
  }> {
    const tests = [
      {
        name: 'Авторизация',
        description: 'Проверка валидности API токена',
        endpoint: '/content/v2/object/parent/all?locale=ru&limit=1'
      },
      {
        name: 'Получение категорий',
        description: 'Проверка доступа к справочнику категорий',
        endpoint: '/content/v2/object/all?locale=ru&limit=10'
      },
      {
        name: 'Характеристики',
        description: 'Проверка доступа к характеристикам (для категории "Товары для дома")',
        endpoint: `/content/v2/object/charcs/${WB_CATEGORY_DEFAULTS.FALLBACK_CATEGORY_ID}?locale=ru`
      }
    ];

    const results = [];
    let successCount = 0;

    for (const test of tests) {
      const startTime = Date.now();
      let response: WBApiResponse | null = null;
      let errorMessage = '';

      try {
        response = await this.makeWbApiRequest({
          endpoint: test.endpoint,
          method: 'GET',
          apiToken
        });

        if (!response.success) {
            errorMessage = response.error || 'Неизвестная ошибка от API';
        }
      } catch (error: any) {
        errorMessage = error.message;
      }

      const responseTime = `${Date.now() - startTime}ms`;

      if (response && response.success) {
        successCount++;
        results.push({
          ...test,
          status: 'success' as const,
          message: 'Успешно',
          responseTime,
          httpStatus: response.statusCode
        });
      } else {
        results.push({
          ...test,
          status: 'error' as const,
          message: errorMessage,
          responseTime,
          httpStatus: response?.statusCode
        });
      }
    }

    const totalTests = tests.length;
    const failureCount = totalTests - successCount;

    let overallStatus: 'success' | 'partial' | 'failed';
    let recommendation: string;

    if (successCount === totalTests) {
      overallStatus = 'success';
      recommendation = 'Все проверки пройдены успешно. API токен настроен правильно.';
    } else if (successCount > 0) {
      overallStatus = 'partial';
      recommendation = 'Частичная работоспособность. Проверьте права доступа API токена для всех необходимых секций.';
    } else {
      overallStatus = 'failed';
      recommendation = 'API токен не работает. Проверьте его валидность и права доступа в личном кабинете WB.';
    }

    return {
      success: overallStatus !== 'failed',
      tests: results,
      summary: {
        totalTests,
        successCount,
        failureCount,
        overallStatus,
        recommendation
      }
    };
  }
}

// Экспортируем экземпляр сервиса
export const updatedWbApiService = new UpdatedWbApiService();