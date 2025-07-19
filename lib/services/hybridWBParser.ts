// lib/services/hybridWBParser.ts - ОБНОВЛЕННАЯ ВЕРСИЯ с исправленной логикой

import { wbSimpleParser } from '../services/wbSimpleParser';
import { pythonWBParser } from '../services/pythonWBParser';

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

interface ParserStatus {
  typescript: {
    available: boolean;
    lastChecked: Date;
    successRate: number;
    error?: string;
  };
  python: {
    available: boolean;
    lastChecked: Date;
    initialized: boolean;
    error?: string;
  };
}

export class HybridWBParser {
  private status: ParserStatus;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.status = {
      typescript: {
        available: true,
        lastChecked: new Date(),
        successRate: 100
      },
      python: {
        available: false,
        lastChecked: new Date(),
        initialized: false
      }
    };

    // Запускаем инициализацию в фоне
    this.initializationPromise = this.initializeParsers();
  }

  /**
   * Инициализация парсеров
   */
  private async initializeParsers(): Promise<void> {
    console.log('🔧 Инициализация гибридного парсера...');

    // Проверка TypeScript парсера
    try {
      await this.testTypeScriptParser();
      this.status.typescript.available = true;
      this.status.typescript.error = undefined;
      console.log('✅ TypeScript парсер готов');
    } catch (error: any) {
      this.status.typescript.available = false;
      this.status.typescript.error = error.message;
      console.warn('⚠️ TypeScript парсер недоступен:', error.message);
    }

    // Инициализация Python парсера
    try {
      const pythonAvailable = await pythonWBParser.checkPythonAvailability();
      if (pythonAvailable) {
        const initialized = await pythonWBParser.initialize();
        this.status.python.initialized = initialized;
        this.status.python.available = initialized;
        
        if (initialized) {
          console.log('✅ Python парсер готов');
        } else {
          throw new Error('Не удалось инициализировать Python парсер');
        }
      } else {
        throw new Error('Python не найден в системе');
      }
    } catch (error: any) {
      this.status.python.available = false;
      this.status.python.initialized = false;
      this.status.python.error = error.message;
      console.warn('⚠️ Python парсер недоступен:', error.message);
    }

    this.status.typescript.lastChecked = new Date();
    this.status.python.lastChecked = new Date();

    console.log('🎯 Инициализация завершена:', {
      typescript: this.status.typescript.available,
      python: this.status.python.available
    });
  }

  /**
   * Ожидание завершения инициализации
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      this.initializationPromise = null;
    }
  }

  /**
   * Основной метод получения данных товара
   */
  async getProductData(url: string): Promise<WBProductData> {
    console.log('🔍 Начинаем гибридный парсинг товара:', url);

    // Ждем завершения инициализации
    await this.ensureInitialized();

    const nmId = this.extractProductId(url);
    if (!nmId) {
      throw new Error('Не удалось извлечь ID товара из URL');
    }

    const errors: string[] = [];

    // Стратегия 1: TypeScript парсер (приоритетный)
    if (this.status.typescript.available) {
      try {
        console.log('📡 Попытка 1: TypeScript парсер...');
        const result = await wbSimpleParser.getProductData(url);
        
        if (this.isValidProductData(result)) {
          this.updateTypeScriptStats(true);
          console.log('✅ TypeScript парсер успешно получил данные');
          return result;
        }
      } catch (error: any) {
        errors.push(`TypeScript: ${error.message}`);
        this.updateTypeScriptStats(false);
        console.warn('⚠️ TypeScript парсер не сработал:', error.message);
        
        // Если это критическая ошибка, помечаем парсер как недоступный
        if (this.isCriticalError(error)) {
          this.status.typescript.available = false;
          this.status.typescript.error = error.message;
        }
      }
    }

    // Стратегия 2: Python парсер
    if (this.status.python.available && this.status.python.initialized) {
      try {
        console.log('🐍 Попытка 2: Python парсер...');
        const result = await pythonWBParser.getProductData(url);
        
        if (this.isValidProductData(result)) {
          console.log('✅ Python парсер успешно получил данные');
          return result;
        }
      } catch (error: any) {
        errors.push(`Python: ${error.message}`);
        console.warn('⚠️ Python парсер не сработал:', error.message);
        
        // При критической ошибке помечаем как недоступный
        if (this.isCriticalError(error)) {
          this.status.python.available = false;
          this.status.python.error = error.message;
        }
      }
    }

    // Стратегия 3: Быстрая проверка существования + fallback данные
    console.log('🔍 Попытка 3: Проверка существования товара...');
    try {
      const exists = await this.checkProductExistence(nmId);
      
      if (exists) {
        console.log('✅ Товар существует, создаем базовые данные');
        return this.createFallbackProduct(nmId, url);
      }
    } catch (error: any) {
      errors.push(`Existence check: ${error.message}`);
      console.warn('⚠️ Проверка существования не удалась:', error.message);
    }

    // Если все методы не сработали
    const errorMessage = `Не удалось получить данные товара ${nmId}. Ошибки: ${errors.join('; ')}`;
    throw new Error(errorMessage);
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
      data.name !== 'Товар без названия' &&
      data.name !== `Товар ${data.id}`
    );
  }

  /**
   * Проверка критичности ошибки
   */
  private isCriticalError(error: any): boolean {
    const criticalErrors = [
      'module not found',
      'python not found',
      'api endpoint not available',
      'authorization failed',
      'network unreachable'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return criticalErrors.some(critical => errorMessage.includes(critical));
  }

  /**
   * Обновление статистики TypeScript парсера
   */
  private updateTypeScriptStats(success: boolean): void {
    const currentRate = this.status.typescript.successRate;
    // Простое скользящее среднее с весом 0.1 для новых значений
    this.status.typescript.successRate = currentRate * 0.9 + (success ? 100 : 0) * 0.1;
    
    // Если успешность падает ниже 20%, помечаем как проблемный
    if (this.status.typescript.successRate < 20) {
      console.warn('⚠️ Низкая успешность TypeScript парсера');
    }
  }

  /**
   * Проверка существования товара через несколько методов
   */
  private async checkProductExistence(nmId: string): Promise<boolean> {
    const checks = [
      () => this.checkViaImage(nmId),
      () => this.checkViaTypeScript(nmId),
      () => this.checkViaPython(nmId)
    ];

    for (const check of checks) {
      try {
        const exists = await check();
        if (exists) return true;
      } catch (error) {
        continue; // Продолжаем с следующим методом
      }
    }

    return false;
  }

  /**
   * Проверка через изображение товара
   */
  private async checkViaImage(nmId: string): Promise<boolean> {
    if (nmId.length < 6) return false;

    const vol = nmId.slice(0, -5);
    const part = nmId.slice(-5, -3);
    const imageUrl = `https://images.wbstatic.net/vol${vol}/part${part}/${nmId}/images/c246x328/1.webp`;
    
    try {
      const response = await fetch(imageUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Проверка через TypeScript парсер
   */
  private async checkViaTypeScript(nmId: string): Promise<boolean> {
    if (!this.status.typescript.available) return false;
    
    try {
      return await wbSimpleParser.checkProductExists(nmId);
    } catch {
      return false;
    }
  }

  /**
   * Проверка через Python парсер
   */
  private async checkViaPython(nmId: string): Promise<boolean> {
    if (!this.status.python.available || !this.status.python.initialized) return false;
    
    try {
      return await pythonWBParser.checkProductExists(nmId);
    } catch {
      return false;
    }
  }

  /**
   * Создание fallback продукта
   */
  private createFallbackProduct(nmId: string, originalUrl: string): WBProductData {
    // Определяем категорию по URL или паттернам в ID
    let category = 'Товары для дома';
    let categoryId = 14727;

    // Анализ URL для определения категории
    const urlLower = originalUrl.toLowerCase();
    if (urlLower.includes('electronics') || urlLower.includes('gadget')) {
      category = 'Электроника';
      categoryId = 1229;
    }

    return {
      id: nmId,
      name: `Товар ${nmId}`,
      brand: 'NoName',
      price: 0,
      rating: 0,
      reviewsCount: 0,
      description: 'Информация о товаре временно недоступна. Данные будут обновлены автоматически.',
      characteristics: [
        { name: 'Артикул', value: nmId },
        { name: 'Статус', value: 'Данные обновляются' },
        { name: 'Источник', value: 'Fallback данные' }
      ],
      images: this.generateImageUrls(nmId),
      category,
      categoryId,
      availability: true,
      vendorCode: nmId,
      supplierId: undefined,
      tnved: '8544429009'
    };
  }

  /**
   * Генерация URL изображений
   */
  private generateImageUrls(nmId: string): string[] {
    if (nmId.length < 6) return [];
    
    const vol = nmId.slice(0, -5);
    const part = nmId.slice(-5, -3);
    
    const images: string[] = [];
    const hosts = ['images.wbstatic.net', 'basket-01.wbbasket.ru', 'basket-02.wbbasket.ru'];
    
    for (let i = 1; i <= 5; i++) {
      const host = hosts[i % hosts.length];
      images.push(`https://${host}/vol${vol}/part${part}/${nmId}/images/c516x688/${i}.webp`);
    }
    
    return images;
  }

  /**
   * Тестирование TypeScript парсера
   */
  private async testTypeScriptParser(): Promise<void> {
    const testNmId = '221501024'; // Тестовый товар
    const exists = await wbSimpleParser.checkProductExists(testNmId);
    
    if (!exists) {
      throw new Error('Тестовая проверка не прошла');
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
    await this.ensureInitialized();
    
    if (this.status.typescript.available) {
      try {
        return await wbSimpleParser.getWBCategories(apiToken);
      } catch (error) {
        console.warn('⚠️ Ошибка получения категорий через TypeScript парсер:', error);
      }
    }
    
    // Возвращаем статичные категории как fallback
    return this.getStaticCategories();
  }

  /**
   * Получение характеристик категории
   */
  async getCategoryCharacteristics(categoryId: number, apiToken: string): Promise<any[]> {
    await this.ensureInitialized();
    
    if (this.status.typescript.available) {
      try {
        return await wbSimpleParser.getCategoryCharacteristics(categoryId, apiToken);
      } catch (error) {
        console.warn('⚠️ Ошибка получения характеристик через TypeScript парсер:', error);
      }
    }
    
    return [];
  }

  /**
   * Создание карточки товара
   */
  async createProductCard(cardData: any, apiToken: string): Promise<any> {
    await this.ensureInitialized();
    
    if (this.status.typescript.available) {
      return await wbSimpleParser.createProductCard(cardData, apiToken);
    }
    
    throw new Error('TypeScript парсер недоступен для создания карточки');
  }

  /**
   * Получение статуса парсеров
   */
  getParserStatus(): {
    typescript: boolean;
    python: boolean;
    details: ParserStatus;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    if (!this.status.typescript.available) {
      recommendations.push('Проверьте сетевое подключение для TypeScript парсера');
    }
    
    if (this.status.typescript.successRate < 50) {
      recommendations.push('Низкая успешность TypeScript парсера - возможны проблемы с API');
    }
    
    if (!this.status.python.available) {
      recommendations.push('Установите Python 3.7+ и зависимости для полной функциональности');
    }
    
    if (!this.status.python.initialized && this.status.python.available) {
      recommendations.push('Переинициализируйте Python парсер');
    }

    return {
      typescript: this.status.typescript.available,
      python: this.status.python.available,
      details: this.status,
      recommendations
    };
  }

  /**
   * Получение детальной статистики
   */
  async getDetailedStats(): Promise<{
    typescript: any;
    python: { available: boolean; initialized: boolean; error?: string };
    hybrid: {
      totalRequests: number;
      successfulRequests: number;
      failureRate: number;
      lastUpdate: Date;
    };
  }> {
    await this.ensureInitialized();
    
    const tsStats = this.status.typescript.available ? wbSimpleParser.getParserStats() : null;
    
    return {
      typescript: tsStats,
      python: {
        available: this.status.python.available,
        initialized: this.status.python.initialized,
        error: this.status.python.error
      },
      hybrid: {
        totalRequests: 0, // TODO: Добавить счетчики
        successfulRequests: 0,
        failureRate: 0,
        lastUpdate: new Date()
      }
    };
  }

  /**
   * Тестирование всех парсеров
   */
async testParsers(): Promise<{
  typescript: { success: boolean; error?: string; responseTime?: number };
  python: { success: boolean; error?: string; responseTime?: number };
  overall: { success: boolean; workingParsers: number };
}> {
    await this.ensureInitialized();
    
    const results = {
      typescript: { success: false },
      python: { success: false },
      overall: { success: false, workingParsers: 0 }
    };

    // Тест TypeScript парсера
    if (this.status.typescript.available) {
      try {
        const startTime = Date.now();
        const testUrl = 'https://www.wildberries.ru/catalog/221501024/detail.aspx';
        const result = await wbSimpleParser.getProductData(testUrl);
        
results.typescript = {
  success: this.isValidProductData(result),
  responseTime: Date.now() - startTime
} as { success: boolean; error?: string; responseTime?: number };
        
        if (results.typescript.success) {
          results.overall.workingParsers++;
        }
      } catch (error: any) {
results.typescript = {
  success: false,
  error: error.message
} as { success: boolean; error?: string; responseTime?: number };
      }
    }

    // Тест Python парсера
    if (this.status.python.available && this.status.python.initialized) {
      try {
        const startTime = Date.now();
        const result = await pythonWBParser.test();
        
       results.python = {
  success: result as unknown as boolean,
  responseTime: Date.now() - startTime
} as { success: boolean; error?: string; responseTime?: number };
        
        if (results.python.success) {
          results.overall.workingParsers++;
        }
      } catch (error: any) {
     results.python = {
  success: false,
  error: error.message
} as { success: boolean; error?: string; responseTime?: number };
      }
    }

    results.overall.success = results.overall.workingParsers > 0;
    
    return results;
  }

  /**
   * Переинициализация Python парсера
   */
  async reinitializePython(): Promise<boolean> {
    console.log('🔄 Переинициализация Python парсера...');
    
    try {
      this.status.python.initialized = await pythonWBParser.initialize();
      this.status.python.available = this.status.python.initialized;
      this.status.python.error = undefined;
      this.status.python.lastChecked = new Date();
      
      if (this.status.python.initialized) {
        console.log('✅ Python парсер переинициализирован успешно');
      } else {
        console.warn('⚠️ Не удалось переинициализировать Python парсер');
      }
      
      return this.status.python.initialized;
    } catch (error: any) {
      this.status.python.available = false;
      this.status.python.initialized = false;
      this.status.python.error = error.message;
      console.error('❌ Ошибка переинициализации Python парсера:', error);
      return false;
    }
  }

  /**
   * Принудительное обновление статуса TypeScript парсера
   */
  async refreshTypeScriptStatus(): Promise<boolean> {
    console.log('🔄 Обновление статуса TypeScript парсера...');
    
    try {
      await this.testTypeScriptParser();
      this.status.typescript.available = true;
      this.status.typescript.error = undefined;
      this.status.typescript.lastChecked = new Date();
      console.log('✅ TypeScript парсер восстановлен');
      return true;
    } catch (error: any) {
      this.status.typescript.available = false;
      this.status.typescript.error = error.message;
      this.status.typescript.lastChecked = new Date();
      console.warn('⚠️ TypeScript парсер все еще недоступен:', error.message);
      return false;
    }
  }

  /**
   * Автоматическое восстановление парсеров
   */
async autoRecover(): Promise<{
  typescript: { recovered: boolean; error?: string };
  python: { recovered: boolean; error?: string };
}> {
    console.log('🔧 Запуск автоматического восстановления парсеров...');
    
    const results = {
      typescript: { recovered: false },
      python: { recovered: false }
    };

    // Попытка восстановления TypeScript парсера
    if (!this.status.typescript.available) {
      try {
        results.typescript.recovered = await this.refreshTypeScriptStatus();
       } catch (error: any) {
  (results.typescript as any).error = error.message;
      }
    } else {
      results.typescript.recovered = true;
    }

    // Попытка восстановления Python парсера
    if (!this.status.python.available) {
      try {
        results.python.recovered = await this.reinitializePython();
} catch (error: any) {
  (results.python as any).error = error.message;
}
    } else {
      results.python.recovered = true;
    }

    const recoveredCount = Object.values(results).filter(r => r.recovered).length;
    console.log(`🎯 Восстановление завершено: ${recoveredCount}/2 парсеров работают`);

    return results;
  }

  /**
   * Получение статических категорий
   */
  private getStaticCategories(): any[] {
    return [
      { objectID: 1229, objectName: 'Электроника', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 5392, objectName: 'Кабели и адаптеры', parentID: 1229, parentName: 'Электроника', isLeaf: true },
      { objectID: 9836, objectName: 'Зарядные устройства', parentID: 1229, parentName: 'Электроника', isLeaf: true },
      { objectID: 340, objectName: 'Наушники', parentID: 1229, parentName: 'Электроника', isLeaf: true },
      { objectID: 14727, objectName: 'Товары для дома', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 8126, objectName: 'Женская одежда', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 1347, objectName: 'Автотовары', parentID: 0, parentName: 'Корень', isLeaf: true },
      { objectID: 1408, objectName: 'Спорт и отдых', parentID: 0, parentName: 'Корень', isLeaf: true }
    ];
  }

  /**
   * Принудительная остановка всех парсеров
   */
  async forceStop(): Promise<void> {
    console.log('🛑 Принудительная остановка всех парсеров...');
    
    this.status.typescript.available = false;
    this.status.python.available = false;
    this.status.python.initialized = false;
    
    await this.cleanup();
    console.log('🛑 Все парсеры остановлены');
  }

  /**
   * Получение рекомендаций по оптимизации
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.status.typescript.successRate < 80) {
      recommendations.push('Рассмотрите использование прокси для TypeScript парсера');
      recommendations.push('Увеличьте интервалы между запросами');
    }
    
    if (!this.status.python.available) {
      recommendations.push('Установите Python парсер для повышения надежности');
      recommendations.push('Убедитесь, что Python 3.7+ установлен в системе');
    }
    
    if (this.status.typescript.available && this.status.python.available) {
      recommendations.push('Система работает оптимально');
      recommendations.push('Регулярно проверяйте статистику парсеров');
    }
    
    recommendations.push('Настройте мониторинг для отслеживания работоспособности');
    
    return recommendations;
  }

  /**
   * Очистка ресурсов
   */
  async cleanup(): Promise<void> {
    try {
      if (this.status.typescript.available) {
        await wbSimpleParser.cleanup();
      }
      
      if (this.status.python.available) {
        await pythonWBParser.cleanup();
      }
      
      // Сброс статуса
      this.status.typescript.lastChecked = new Date();
      this.status.python.lastChecked = new Date();
      
      console.log('🧹 Очистка гибридного парсера завершена');
    } catch (error) {
      console.warn('⚠️ Ошибка при очистке ресурсов:', error);
    }
  }
}

// Экспорт экземпляра
export const hybridWBParser = new HybridWBParser();
export default HybridWBParser;