// lib/config/wbApiConfig.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ с правильными эндпоинтами

/**
 * Конфигурация API Wildberries
 * Обновлено согласно актуальной документации WB API
 */

// Базовые URL для разных API
const BASE_URLS = {
  content: 'https://content-api.wildberries.ru',
  suppliers: 'https://suppliers-api.wildberries.ru',
  statistics: 'https://statistics-api.wildberries.ru',
  marketplace: 'https://marketplace-api.wildberries.ru',
  public: 'https://card.wb.ru'
} as const;

// Эндпоинты для Content API (управление карточками)
export const WB_API_ENDPOINTS = {
  // Content API v2 (основные эндпоинты)
  content: {
    // Создание карточек товаров
    uploadCard: `${BASE_URLS.content}/content/v2/cards/upload`,
    
    // Получение списка созданных карточек
    getCards: `${BASE_URLS.content}/content/v2/get/cards/list`,
    
    // Обновление карточки
    updateCard: `${BASE_URLS.content}/content/v2/cards/update`,
    
    // Получение всех категорий
    getAllCategories: `${BASE_URLS.content}/content/v2/object/all`,
    
    // Получение характеристик категории
    getCategoryCharacteristics: (categoryId: number) => 
      `${BASE_URLS.content}/content/v2/object/charcs/${categoryId}`,
    
    // Загрузка медиафайлов
    uploadMedia: `${BASE_URLS.content}/content/v2/media/save`,
    
    // Получение лимитов тарифов
    getTariffLimits: `${BASE_URLS.content}/content/v2/cards/limits`,
    
    // Получение ошибок загрузки
    getUploadErrors: `${BASE_URLS.content}/content/v2/cards/error/list`
  },

  // Suppliers API (информация о поставщике)
  suppliers: {
    // Настройки поставщика
    getSettings: `${BASE_URLS.suppliers}/api/v3/config/get/supplier/settings`,
    
    // Склады поставщика
    getWarehouses: `${BASE_URLS.suppliers}/api/v3/warehouses`,
    
    // Тарифы
    getTariffs: `${BASE_URLS.suppliers}/api/v3/tariffs/commission`
  },

  // Statistics API (статистика и аналитика)
  statistics: {
    // Статистика продаж
    getSales: `${BASE_URLS.statistics}/api/v1/supplier/sales`,
    
    // Остатки товаров
    getStocks: `${BASE_URLS.statistics}/api/v1/supplier/stocks`,
    
    // Заказы
    getOrders: `${BASE_URLS.statistics}/api/v1/supplier/orders`,
    
    // Отчеты
    getReports: `${BASE_URLS.statistics}/api/v1/supplier/reportDetailByPeriod`
  },

  // Marketplace API (работа с заказами)
  marketplace: {
    // Новые заказы
    getNewOrders: `${BASE_URLS.marketplace}/api/v3/orders/new`,
    
    // Сборочные задания
    getSupplies: `${BASE_URLS.marketplace}/api/v3/supplies`,
    
    // Стикеры для товаров
    getStickers: `${BASE_URLS.marketplace}/api/v3/orders/stickers`
  },

  // Public API (публичные данные без авторизации)
  public: {
    // Детальная информация о товаре (v1)
    cardDetail: `${BASE_URLS.public}/cards/detail`,
    
    // Детальная информация о товаре (v2)
    cardDetailV2: `${BASE_URLS.public}/cards/v2/detail`,
    
    // Поиск товаров (v4)
    searchV4: 'https://search.wb.ru/exactmatch/ru/common/v4/search',
    
    // Поиск товаров (v5)
    searchV5: 'https://search.wb.ru/exactmatch/ru/common/v5/search',
    
    // Enrichment API (дополнительная информация)
    enrichment: 'https://card.wb.ru/cards/v1/detail',
    
    // Корзина товаров
    basket: 'https://basket-{HOST}.wbbasket.ru/vol{VOL}/part{PART}/{NM_ID}/info/ru/card.json'
  }
} as const;

// Параметры по умолчанию для публичных API
export const WB_DEFAULT_PARAMS = {
  appType: '1',
  curr: 'rub',
  dest: '-1257786',
  regions: '80,64,83,4,38,30,33,70,82,69,68,86,75,40,1,66,48,110,31,22,71,114',
  spp: '30',
  version: '2'
} as const;

// HTTP заголовки для запросов
export const WB_HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-Requested-With': 'XMLHttpRequest'
} as const;

// User-Agent строки для ротации
export const WB_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
] as const;

// Коды ошибок WB API
export const WB_ERROR_CODES = {
  INVALID_TOKEN: 'INVALID_TOKEN',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_DATA: 'INVALID_DATA',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT: 'TIMEOUT'
} as const;

// Лимиты и ограничения
export const WB_LIMITS = {
  MAX_CHARACTERISTICS: 30,
  MAX_TITLE_LENGTH: 60,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_BRAND_LENGTH: 50,
  MAX_VENDOR_CODE_LENGTH: 75,
  MIN_PRICE: 1,
  MAX_IMAGES: 30,
  REQUEST_TIMEOUT: 30000, // 30 секунд
  RATE_LIMIT_DELAY: 1000  // 1 секунда между запросами
} as const;

// Валидаторы
export const validators = {
  /**
   * Проверка корректности NM ID
   */
  isValidNmId: (nmId: string): boolean => {
    return /^\d{6,10}$/.test(nmId);
  },

  /**
   * Проверка корректности API токена
   */
  isValidApiToken: (token: string): boolean => {
    return typeof token === 'string' && token.length > 10;
  },

  /**
   * Проверка корректности артикула
   */
  isValidVendorCode: (vendorCode: string): boolean => {
    return typeof vendorCode === 'string' && 
           vendorCode.length >= 1 && 
           vendorCode.length <= WB_LIMITS.MAX_VENDOR_CODE_LENGTH;
  },

  /**
   * Проверка корректности заголовка
   */
  isValidTitle: (title: string): boolean => {
    return typeof title === 'string' && 
           title.length >= 1 && 
           title.length <= WB_LIMITS.MAX_TITLE_LENGTH;
  },

  /**
   * Проверка корректности описания
   */
  isValidDescription: (description: string): boolean => {
    return typeof description === 'string' && 
           description.length >= 1 && 
           description.length <= WB_LIMITS.MAX_DESCRIPTION_LENGTH;
  },

  /**
   * Проверка корректности бренда
   */
  isValidBrand: (brand: string): boolean => {
    return typeof brand === 'string' && 
           brand.length >= 1 && 
           brand.length <= WB_LIMITS.MAX_BRAND_LENGTH;
  },

  /**
   * Проверка корректности ID категории
   */
  isValidCategoryId: (categoryId: number): boolean => {
    return Number.isInteger(categoryId) && categoryId > 0;
  }
} as const;

// Типы для TypeScript
export interface WBApiResponse<T = any> {
  data?: T;
  error?: boolean;
  errorText?: string;
  additionalErrors?: Record<string, any>;
}

export interface WBCardUploadRequest {
  vendorCode: string;
  title: string;
  description: string;
  brand: string;
  imtId: number;
  characteristics: Array<{
    id: number;
    value: string | number;
  }>;
}

export interface WBCardUploadResponse {
  nmId?: number;
  nmID?: number;
  vendorCode?: string;
  error?: string;
  errorText?: string;
}

export interface WBCategory {
  objectID: number;
  objectName: string;
  parentID?: number;
  parentName?: string;
  isLeaf?: boolean;
}

export interface WBCharacteristic {
  charcID: number;
  charcName: string;
  required: boolean;
  unitName?: string;
  maxCount?: number;
  dictionary?: Array<{
    value: string;
    key: string;
  }>;
}

// Утилиты для работы с API
export const WBApiUtils = {
  /**
   * Формирование URL для basket API
   */
  buildBasketUrl: (nmId: string, host: string = '01'): string => {
    if (nmId.length < 6) return '';
    
    const vol = nmId.slice(0, -5);
    const part = nmId.slice(-5, -3);
    
    return `https://basket-${host}.wbbasket.ru/vol${vol}/part${part}/${nmId}/info/ru/card.json`;
  },

  /**
   * Формирование URL для изображений
   */
  buildImageUrl: (nmId: string, size: string = 'c516x688', imageNumber: number = 1): string => {
    if (nmId.length < 6) return '';
    
    const vol = nmId.slice(0, -5);
    const part = nmId.slice(-5, -3);
    
    return `https://images.wbstatic.net/vol${vol}/part${part}/${nmId}/images/${size}/${imageNumber}.webp`;
  },

  /**
   * Извлечение NM ID из URL
   */
  extractNmIdFromUrl: (url: string): string | null => {
    const patterns = [
      /\/catalog\/(\d+)\/detail\.aspx/,
      /\/catalog\/(\d+)/,
      /product\/(\d+)/,
      /detail\/(\d+)/,
      /nm(\d+)/,
      /(\d{6,10})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  },

  /**
   * Валидация данных карточки перед отправкой
   */
  validateCardData: (cardData: WBCardUploadRequest): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!validators.isValidVendorCode(cardData.vendorCode)) {
      errors.push('Некорректный артикул');
    }

    if (!validators.isValidTitle(cardData.title)) {
      errors.push('Некорректный заголовок');
    }

    if (!validators.isValidDescription(cardData.description)) {
      errors.push('Некорректное описание');
    }

    if (!validators.isValidBrand(cardData.brand)) {
      errors.push('Некорректный бренд');
    }

    if (!validators.isValidCategoryId(cardData.imtId)) {
      errors.push('Некорректный ID категории');
    }

    if (!Array.isArray(cardData.characteristics) || cardData.characteristics.length === 0) {
      errors.push('Необходимо указать характеристики');
    }

    if (cardData.characteristics.length > WB_LIMITS.MAX_CHARACTERISTICS) {
      errors.push(`Слишком много характеристик (максимум ${WB_LIMITS.MAX_CHARACTERISTICS})`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Очистка данных карточки от недопустимых символов
   */
  sanitizeCardData: (cardData: WBCardUploadRequest): WBCardUploadRequest => {
    return {
      ...cardData,
      vendorCode: cardData.vendorCode.trim().substring(0, WB_LIMITS.MAX_VENDOR_CODE_LENGTH),
      title: cardData.title.trim().substring(0, WB_LIMITS.MAX_TITLE_LENGTH),
      description: cardData.description.trim().substring(0, WB_LIMITS.MAX_DESCRIPTION_LENGTH),
      brand: cardData.brand.trim().substring(0, WB_LIMITS.MAX_BRAND_LENGTH),
      characteristics: cardData.characteristics
        .filter(char => char.value && String(char.value).trim() !== '')
        .map(char => ({
          id: char.id,
          value: String(char.value).trim()
        }))
        .slice(0, WB_LIMITS.MAX_CHARACTERISTICS)
    };
  }
} as const;

export default {
  WB_API_ENDPOINTS,
  WB_DEFAULT_PARAMS,
  WB_HEADERS,
  WB_USER_AGENTS,
  WB_ERROR_CODES,
  WB_LIMITS,
  validators,
  WBApiUtils
};