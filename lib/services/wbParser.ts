// lib/services/wbParser.ts - ИСПРАВЛЕННАЯ ОБЕРТКА ДЛЯ СОВМЕСТИМОСТИ

import { wbSimpleParser } from './wbSimpleParser';

// Интерфейс для обратной совместимости
interface LegacyWBProductData {
  id: string;
  name: string;
  brand: string;
  price: number;
  rating?: number;
  reviewsCount?: number;
  description?: string;
  characteristics?: Record<string, string>;
  images?: string[];
  category?: string;
}

/**
 * Упрощенная обертка для совместимости с существующим кодом
 */
class WBParserCompatibilityWrapper {
  /**
   * Главный метод парсинга (совместимый со старым API)
   */
  async getProductData(productId: string): Promise<LegacyWBProductData> {
    try {
      console.log(`🔍 WB Parser: получаем данные ${productId}`);
      
      // Определяем, это ID или URL
      let url: string;
      if (productId.startsWith('http')) {
        url = productId;
      } else {
        url = `https://www.wildberries.ru/catalog/${productId}/detail.aspx`;
      }

      // Используем простой парсер
      const productData = await wbSimpleParser.getProductData(url);

      if (!productData) {
        throw new Error('Не удалось получить данные товара');
      }

      // Конвертируем в старый формат
      const legacyData: LegacyWBProductData = {
        id: productData.id,
        name: productData.name,
        brand: productData.brand,
        price: productData.price,
        rating: productData.rating,
        reviewsCount: productData.reviewsCount,
        description: productData.description,
        category: productData.category,
        images: productData.images
      };

      // Конвертируем характеристики в старый формат
      if (productData.characteristics?.length > 0) {
        legacyData.characteristics = {};
        productData.characteristics.forEach((char: any) => {
          if (legacyData.characteristics) {
            legacyData.characteristics[char.name] = char.value;
          }
        });
      }

      console.log(`✅ WB Parser: данные получены - ${legacyData.name}`);
      return legacyData;

    } catch (error) {
      console.error('❌ WB Parser error:', error);
      throw error;
    }
  }

  /**
   * Извлечение ID товара из URL
   */
  extractProductId(url: string): string | null {
    return wbSimpleParser.extractProductId(url);
  }

  /**
   * Получение категорий WB
   */
  async getWBCategories(apiToken: string): Promise<any[]> {
    return wbSimpleParser.getWBCategories(apiToken);
  }

  /**
   * Получение характеристик категории
   */
  async getCategoryCharacteristics(categoryId: number, apiToken: string): Promise<any[]> {
    return wbSimpleParser.getCategoryCharacteristics(categoryId, apiToken);
  }

  /**
   * Создание карточки товара
   */
  async createProductCard(cardData: any, apiToken: string): Promise<any> {
    return wbSimpleParser.createProductCard(cardData, apiToken);
  }

  /**
   * Проверка существования товара
   */
  async checkProductExists(nmId: string): Promise<boolean> {
    return wbSimpleParser.checkProductExists(nmId);
  }

  /**
   * Очистка ресурсов
   */
  async cleanup(): Promise<void> {
    return wbSimpleParser.cleanup();
  }
}

// Создаем экземпляр обертки для обратной совместимости
const wbParser = new WBParserCompatibilityWrapper();

// Экспорты для совместимости
export default wbParser;
export { wbParser };

// Также экспортируем простой парсер для прямого использования
export { wbSimpleParser };

// Типы для совместимости
export type { LegacyWBProductData };

// Утилиты для тестирования
export const TestUtils = {
  /**
   * Быстрая проверка работоспособности парсера
   */
  async quickTest(nmId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const startTime = Date.now();
      const data = await wbParser.getProductData(nmId);
      const endTime = Date.now();
      
      return {
        success: true,
        data: {
          ...data,
          parseTime: endTime - startTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  },

  /**
   * Проверка доступности товара
   */
  async checkAvailability(nmId: string): Promise<boolean> {
    try {
      return await wbSimpleParser.checkProductExists(nmId);
    } catch {
      return false;
    }
  },

  /**
   * Массовая проверка товаров
   */
  async batchCheck(nmIds: string[]): Promise<Array<{ nmId: string; available: boolean }>> {
    const results = [];
    
    for (const nmId of nmIds) {
      try {
        const available = await this.checkAvailability(nmId);
        results.push({ nmId, available });
      } catch {
        results.push({ nmId, available: false });
      }
      
      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }
};