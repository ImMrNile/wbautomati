// lib/utils/sqlite-json.ts
// Утилиты для работы с JSON полями в SQLite через Prisma

/**
 * Преобразование объекта в JSON строку для сохранения в SQLite
 */
export function toSQLiteJSON(obj: any): string {
  if (obj === null || obj === undefined) {
    return '';
  }
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('Ошибка сериализации в JSON:', error);
    return '{}';
  }
}

/**
 * Парсинг JSON строки из SQLite обратно в объект
 */
export function fromSQLiteJSON<T = any>(jsonString: string | null, fallback: T = {} as T): T {
  if (!jsonString || jsonString.trim() === '') {
    return fallback;
  }
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Ошибка парсинга JSON:', error);
    return fallback;
  }
}

/**
 * Типизированные интерфейсы для JSON полей
 */
export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
}

export interface ProductReferenceData {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  categoryId?: number;
  characteristics: Array<{ name: string; value: string }>;
  description: string;
  images: string[];
  rating?: number;
  reviewsCount?: number;
  availability?: boolean;
  vendorCode?: string;
  supplierId?: string;
}

export interface ProductAICharacteristics {
  geminiAnalysis: {
    wbCategory?: string;
    seoTitle?: string;
    seoDescription?: string;
    visualAnalysis?: {
      productType?: string;
      primaryColor?: string;
      material?: string;
    };
    characteristics?: Array<{ id: number; value: string }>;
  };
  wbData: {
    vendorCode: string;
    title: string;
    description: string;
    brand: string;
    imtId: number;
    characteristics: Array<{ id: number; value: string }>;
  };
  category: {
    id: number;
    name: string;
  };
}

export interface ProductWBData {
  nmId?: string;
  vendorCode?: string;
  status?: string;
  createdAt?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * Расширенные методы для работы с продуктами
 */
export class ProductJSONHelper {
  /**
   * Получение размеров продукта
   */
  static getDimensions(product: any): ProductDimensions {
    return fromSQLiteJSON<ProductDimensions>(product.dimensions, {});
  }

  /**
   * Установка размеров продукта
   */
  static setDimensions(dimensions: ProductDimensions): string {
    return toSQLiteJSON(dimensions);
  }

  /**
   * Получение данных аналога
   */
  static getReferenceData(product: any): ProductReferenceData | null {
    const data = fromSQLiteJSON<ProductReferenceData | null>(product.referenceData, null);
    return data;
  }

  /**
   * Установка данных аналога
   */
  static setReferenceData(referenceData: ProductReferenceData): string {
    return toSQLiteJSON(referenceData);
  }

  /**
   * Получение AI характеристик
   */
  static getAICharacteristics(product: any): ProductAICharacteristics | null {
    return fromSQLiteJSON<ProductAICharacteristics | null>(product.aiCharacteristics, null);
  }

  /**
   * Установка AI характеристик
   */
  static setAICharacteristics(characteristics: ProductAICharacteristics): string {
    return toSQLiteJSON(characteristics);
  }

  /**
   * Получение данных WB
   */
  static getWBData(product: any): ProductWBData {
    return fromSQLiteJSON<ProductWBData>(product.wbData, {});
  }

  /**
   * Установка данных WB
   */
  static setWBData(wbData: ProductWBData): string {
    return toSQLiteJSON(wbData);
  }

  /**
   * Безопасное получение всех JSON полей продукта
   */
  static getFullProductData(product: any) {
    return {
      ...product,
      dimensions: this.getDimensions(product),
      referenceData: this.getReferenceData(product),
      aiCharacteristics: this.getAICharacteristics(product),
      wbData: this.getWBData(product)
    };
  }

  /**
   * Валидация JSON данных перед сохранением
   */
  static validateProductData(data: {
    dimensions?: any;
    referenceData?: any;
    aiCharacteristics?: any;
    wbData?: any;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Проверка размеров
    if (data.dimensions) {
      const dims = data.dimensions as ProductDimensions;
      if (dims.length !== undefined && (typeof dims.length !== 'number' || dims.length <= 0)) {
        errors.push('Длина должна быть положительным числом');
      }
      if (dims.width !== undefined && (typeof dims.width !== 'number' || dims.width <= 0)) {
        errors.push('Ширина должна быть положительным числом');
      }
      if (dims.height !== undefined && (typeof dims.height !== 'number' || dims.height <= 0)) {
        errors.push('Высота должна быть положительным числом');
      }
      if (dims.weight !== undefined && (typeof dims.weight !== 'number' || dims.weight <= 0)) {
        errors.push('Вес должен быть положительным числом');
      }
    }

    // Проверка данных аналога
    if (data.referenceData) {
      const ref = data.referenceData as ProductReferenceData;
      if (!ref.id || !ref.name) {
        errors.push('Данные аналога должны содержать ID и название');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Типы для работы с Prisma и SQLite
 */
export type SQLiteJSONField = string | null;

/**
 * Хелпер для создания типизированных запросов к базе
 */
export class PrismaJSONHelper {
  /**
   * Подготовка данных для создания продукта
   */
  static prepareProductCreateData(data: {
    originalName: string;
    originalImage: string;
    dimensions: ProductDimensions;
    price: number;
    referenceUrl?: string;
    status: string;
    referenceData?: ProductReferenceData;
  }) {
    return {
      originalName: data.originalName,
      originalImage: data.originalImage,
      dimensions: ProductJSONHelper.setDimensions(data.dimensions),
      price: data.price,
      referenceUrl: data.referenceUrl,
      status: data.status,
      referenceData: data.referenceData ? ProductJSONHelper.setReferenceData(data.referenceData) : null
    };
  }

  /**
   * Подготовка данных для обновления продукта
   */
  static prepareProductUpdateData(data: {
    generatedName?: string;
    seoDescription?: string;
    suggestedCategory?: string;
    colorAnalysis?: string;
    aiCharacteristics?: ProductAICharacteristics;
    status?: string;
    wbData?: ProductWBData;
    wbNmId?: string;
    publishedAt?: Date;
    errorMessage?: string;
  }) {
    const updateData: any = {};
    
    if (data.generatedName !== undefined) updateData.generatedName = data.generatedName;
    if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription;
    if (data.suggestedCategory !== undefined) updateData.suggestedCategory = data.suggestedCategory;
    if (data.colorAnalysis !== undefined) updateData.colorAnalysis = data.colorAnalysis;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.wbNmId !== undefined) updateData.wbNmId = data.wbNmId;
    if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
    
    if (data.aiCharacteristics !== undefined) {
      updateData.aiCharacteristics = ProductJSONHelper.setAICharacteristics(data.aiCharacteristics);
    }
    
    if (data.wbData !== undefined) {
      updateData.wbData = ProductJSONHelper.setWBData(data.wbData);
    }
    
    return updateData;
  }
}
