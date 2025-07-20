// lib/config/wbApiConfig.ts - ИСПРАВЛЕННАЯ КОНФИГУРАЦИЯ БЕЗ ДУБЛИРОВАНИЯ

export const WB_API_CONFIG = {
  // Актуальные базовые URL (обновлены в 2025)
  BASE_URLS: {
    CONTENT: 'https://content-api.wildberries.ru',
    CONTENT_SANDBOX: 'https://content-api-sandbox.wildberries.ru',
    MARKETPLACE: 'https://marketplace-api.wildberries.ru',
    DISCOUNTS_PRICES: 'https://discounts-prices-api.wildberries.ru',
    STATISTICS: 'https://statistics-api.wildberries.ru',
    RECOMMENDATIONS: 'https://recommendations-api.wildberries.ru'
  },
  
  // Исправленные эндпоинты (API v2)
  ENDPOINTS: {
    // Категории и справочники
    GET_CATEGORIES: '/content/v2/object/all',
    GET_PARENT_CATEGORIES: '/content/v2/object/parent/all',
    GET_CATEGORY_CHARACTERISTICS: '/content/v2/object/charcs',
    
    // Справочники
    GET_COLORS: '/content/v2/directory/colors',
    GET_COUNTRIES: '/content/v2/directory/countries',
    GET_SEASONS: '/content/v2/directory/seasons',
    GET_TNVED: '/content/v2/directory/tnved',
    GET_VAT: '/content/v2/directory/vat',
    GET_KINDS: '/content/v2/directory/kinds',
    
    // Создание и управление карточками (API v2)
    CREATE_CARDS: '/content/v2/cards/upload',
    UPDATE_CARDS: '/content/v2/cards/update', 
    ADD_TO_CARDS: '/content/v2/cards/upload/add',
    GET_CARDS_LIST: '/content/v2/get/cards/list',
    GET_CARD_BY_ID: '/content/v2/cards/filter',
    DELETE_CARDS: '/content/v2/cards/delete',
    
    // Ошибки и статусы
    GET_ERRORS: '/content/v2/cards/error/list',
    GET_TASK_STATUS: '/content/v2/cards/status',
    
    // Штрихкоды
    GENERATE_BARCODES: '/content/v2/barcodes',
    
    // Медиа файлы
    UPLOAD_MEDIA: '/content/v2/media/save',
    DELETE_MEDIA: '/content/v2/media/delete',
    
    // Цены и скидки
    GET_PRICES: '/public/api/v1/info',
    UPDATE_PRICES: '/public/api/v1/prices',
    GET_DISCOUNTS: '/public/api/v1/revokeDiscounts',
    UPDATE_DISCOUNTS: '/public/api/v1/updateDiscounts',
    
    // Склады и остатки  
    GET_WAREHOUSES: '/api/v3/warehouses',
    UPDATE_STOCKS: '/api/v3/stocks',
    
    // Заказы
    GET_ORDERS: '/api/v3/orders',
    UPDATE_ORDER_STATUS: '/api/v3/orders/status',
    
    // Отчеты и аналитика
    GET_SALES_REPORT: '/api/v1/supplier/reportDetailByPeriod',
    GET_ORDERS_REPORT: '/api/v1/supplier/orders',
    GET_STOCKS_REPORT: '/api/v1/supplier/stocks'
  },
  
  // Обновленные лимиты (актуальные для 2025)
  LIMITS: {
    CARDS_PER_REQUEST: 30,
    PRODUCTS_PER_REQUEST: 100,
    REQUESTS_PER_MINUTE: 10,
    MAX_REQUEST_SIZE_MB: 10,
    NOMENCLATURES_PER_ADD: 3000,
    IMAGES_PER_CARD: 30,
    MAX_TITLE_LENGTH: 60,
    MAX_DESCRIPTION_LENGTH: 1000,
    MAX_VENDOR_CODE_LENGTH: 75,
    MIN_PRICE: 1,
    MAX_PRICE: 999999999,
    MAX_BARCODES_PER_REQUEST: 5000
  },
  
  // Таймауты для разных операций
  TIMEOUTS: {
    DEFAULT: 30000,
    UPLOAD: 60000,
    BULK_OPERATION: 120000,
    MEDIA_UPLOAD: 180000,
    REPORT_GENERATION: 300000
  },
  
  // HTTP статус коды WB API
  STATUS_CODES: {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  },
  
  // Retry конфигурация
  RETRY_CONFIG: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    BACKOFF_MULTIPLIER: 2,
    MAX_DELAY: 30000,
    RETRYABLE_STATUS_CODES: [408, 429, 500, 502, 503, 504]
  }
};

// Обязательные характеристики для разных категорий
export const REQUIRED_CHARACTERISTICS = {
  // Универсальные обязательные поля
  UNIVERSAL: {
    BRAND: 85,
    COUNTRY: 91,
    COMPOSITION: 372,
    TITLE: 10,
    DESCRIPTION: 419,
    COLOR: 14177449,
    VENDOR_CODE: 83,
    TNVED: 73,
  },
  
  // Специфичные для электроники
  ELECTRONICS: {
    WARRANTY: 312,
    POWER: 2758,
    VOLTAGE: 2781,
    CONNECTOR_TYPE: 4748,
    CABLE_LENGTH: 4749,
    MATERIAL_OUTER: 4750,
    COMPATIBILITY: 4751
  },
  
  // Специфичные для одежды
  CLOTHING: {
    SIZE: 48,
    SEASON: 50,
    GENDER: 51,
    AGE_GROUP: 1564,
    FABRIC_STRUCTURE: 4748,
    CARE_INSTRUCTIONS: 4749
  },
  
  // Специфичные для товаров для дома
  HOME_GOODS: {
    MATERIAL: 49,
    DIMENSIONS: 147,
    WEIGHT: 146,
    PACKAGE_TYPE: 4748,
    ROOM_TYPE: 4749
  },
  
  // Специфичные для красоты и здоровья
  BEAUTY_HEALTH: {
    SKIN_TYPE: 1564,
    HAIR_TYPE: 1565,
    AGE_GROUP: 1566,
    GENDER: 51,
    VOLUME: 1567,
    EXPIRATION_DATE: 1568,
    INGREDIENTS: 1569
  }
};

// ПОЛНЫЕ валидационные правила
export const VALIDATION_RULES = {
  TITLE_MAX_LENGTH: 60,
  DESCRIPTION_MAX_LENGTH: 1000,
  VENDOR_CODE_MAX_LENGTH: 75,
  BRAND_MAX_LENGTH: 50,
  MIN_PRICE: 1,
  MAX_PRICE: 999999999,
  // Добавляем недостающие поля
  MIN_DIMENSION: 0.1,
  MAX_DIMENSION: 1000,
  MIN_WEIGHT: 0.001,
  MAX_WEIGHT: 1000,
  BARCODE_LENGTH: 13,
  VENDOR_CODE_PATTERN: /^[A-Za-z0-9\-_]+$/,
  
  // Валидация изображений
  IMAGE_MIN_WIDTH: 450,
  IMAGE_MIN_HEIGHT: 450,
  IMAGE_MAX_SIZE_MB: 10,
  ALLOWED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  
  // Валидация характеристик
  MAX_CHARACTERISTICS: 30,
  MAX_CHARACTERISTIC_VALUE_LENGTH: 500
};

// Статусы товаров в системе WB
export const WB_CARD_STATUSES = {
  LOADING: 'loading',
  CREATING: 'creating',
  CREATED: 'created',
  MODERATING: 'moderating',
  DECLINED: 'declined',
  APPROVED: 'approved',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
  ERROR: 'error',
  BLOCKED: 'blocked'
};

// Коды ошибок WB API
export const WB_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR', 
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  DUPLICATE_VENDOR_CODE: 'DUPLICATE_VENDOR_CODE',
  INVALID_BARCODE: 'INVALID_BARCODE',
  INVALID_CHARACTERISTICS: 'INVALID_CHARACTERISTICS',
  INVALID_PRICE: 'INVALID_PRICE',
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS',
  MEDIA_UPLOAD_ERROR: 'MEDIA_UPLOAD_ERROR',
  INTERNAL_API_ERROR: 'INTERNAL_API_ERROR'
};

// Дефолтные значения для заполнения
export const DEFAULT_VALUES = {
  BRAND: 'NoName',
  COUNTRY: 'Россия',
  COLOR: 'не указан',
  MATERIAL: 'смешанные материалы',
  COMPOSITION: 'не указан',
  WARRANTY: 'гарантия производителя',
  SEASON: 'всесезонный',
  GENDER: 'унисекс',
  AGE_GROUP: 'взрослый',
  CARE_INSTRUCTIONS: 'согласно рекомендациям производителя',
  
  // Дефолтная категория
  CATEGORY_ID: 14727,
  CATEGORY_NAME: 'Товары для дома',
  
  // Дефолтные размеры упаковки
  DIMENSIONS: {
    LENGTH: 10,
    WIDTH: 10, 
    HEIGHT: 5,
    WEIGHT: 0.1
  },
  
  // Дефолтные технические характеристики
  TECH_SIZE: '0',
  WB_SIZE: '0'
};

// Маппинг популярных категорий
export const POPULAR_CATEGORIES = {
  ELECTRONICS: {
    CABLES: 963,
    ACCESSORIES: 964,
    PHONE_ACCESSORIES: 965,
    COMPUTER_ACCESSORIES: 966
  },
  
  HOME: {
    HOUSEHOLD: 14727,
    KITCHEN: 2674,
    FURNITURE: 2733,
    DECOR: 2675
  },
  
  CLOTHING: {
    MENS: 629,
    WOMENS: 8126,
    KIDS: 566,
    SHOES: 2808
  },
  
  BEAUTY: {
    SKINCARE: 1234,
    MAKEUP: 1235,
    HAIRCARE: 1236,
    PERFUME: 1237
  }
};

// Настройки кеширования
export const CACHE_CONFIG = {
  CATEGORIES: {
    TTL: 24 * 60 * 60 * 1000,
    KEY_PREFIX: 'wb_categories'
  },
  
  CHARACTERISTICS: {
    TTL: 12 * 60 * 60 * 1000,
    KEY_PREFIX: 'wb_characteristics'
  },
  
  DIRECTORIES: {
    TTL: 24 * 60 * 60 * 1000,
    KEY_PREFIX: 'wb_directories'
  },
  
  API_RESPONSES: {
    TTL: 5 * 60 * 1000,
    KEY_PREFIX: 'wb_api_response'
  }
};

// Утилиты для работы с API
export class WBApiUtils {
  static isValidToken(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      const payload = JSON.parse(atob(parts[1]));
      return !!(payload.s && payload.sid && payload.exp);
    } catch {
      return false;
    }
  }
  
  static parseToken(token: string): any {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        sellerId: payload.sid,
        permissions: payload.s,
        expiresAt: new Date(payload.exp * 1000),
        isExpired: Date.now() > payload.exp * 1000
      };
    } catch {
      return null;
    }
  }
  
  static generateVendorCode(prefix: string = 'AI'): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
  
  static validateDimensions(dimensions: { length: number; width: number; height: number; weight: number }): string[] {
    const errors = [];
    
    if (dimensions.length < VALIDATION_RULES.MIN_DIMENSION || dimensions.length > VALIDATION_RULES.MAX_DIMENSION) {
      errors.push(`Длина должна быть от ${VALIDATION_RULES.MIN_DIMENSION} до ${VALIDATION_RULES.MAX_DIMENSION} см`);
    }
    
    if (dimensions.width < VALIDATION_RULES.MIN_DIMENSION || dimensions.width > VALIDATION_RULES.MAX_DIMENSION) {
      errors.push(`Ширина должна быть от ${VALIDATION_RULES.MIN_DIMENSION} до ${VALIDATION_RULES.MAX_DIMENSION} см`);
    }
    
    if (dimensions.height < VALIDATION_RULES.MIN_DIMENSION || dimensions.height > VALIDATION_RULES.MAX_DIMENSION) {
      errors.push(`Высота должна быть от ${VALIDATION_RULES.MIN_DIMENSION} до ${VALIDATION_RULES.MAX_DIMENSION} см`);
    }
    
    if (dimensions.weight < VALIDATION_RULES.MIN_WEIGHT || dimensions.weight > VALIDATION_RULES.MAX_WEIGHT) {
      errors.push(`Вес должен быть от ${VALIDATION_RULES.MIN_WEIGHT} до ${VALIDATION_RULES.MAX_WEIGHT} кг`);
    }
    
    return errors;
  }
  
  static formatApiError(error: any): string {
    if (typeof error === 'string') return error;
    
    if (error.errorText) return error.errorText;
    if (error.message) return error.message;
    if (error.error) return error.error;
    
    if (Array.isArray(error)) {
      return error.map(e => this.formatApiError(e)).join('; ');
    }
    
    return 'Неизвестная ошибка API';
  }
  
  static createCacheKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
  }
}