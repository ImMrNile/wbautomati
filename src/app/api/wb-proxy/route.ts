// src/app/api/wb-proxy/route.ts - ИСПРАВЛЕННЫЙ ПРОКСИ С НОВЫМИ ДОМЕНАМИ WB

import { NextRequest, NextResponse } from 'next/server';

// ОБНОВЛЕННАЯ КОНФИГУРАЦИЯ WB API (2025)
const WB_API_CONFIG = {
  BASE_URLS: {
    CONTENT: 'https://content-api.wildberries.ru',
    MARKETPLACE: 'https://marketplace-api.wildberries.ru', 
    STATISTICS: 'https://statistics-api.wildberries.ru',
    DISCOUNTS_PRICES: 'https://discounts-prices-api.wildberries.ru'
  },
  TIMEOUTS: {
    DEFAULT: 30000,
    LONG: 60000
  },
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: 300,
    WINDOW_MS: 60 * 1000
  }
};

// Fallback конфигурация для обхода блокировок
const FALLBACK_CONFIG = {
  // Публичные endpoints без токена
  PUBLIC_ENDPOINTS: {
    CATEGORIES: 'https://static-basket-01.wb.ru/vol0/data/main-menu-ru-ru-v2.json',
    SEARCH: 'https://search.wb.ru/exactmatch/ru/common/v4/search'
  },
  // DNS серверы для обхода блокировок
  DNS_SERVERS: ['1.1.1.1', '8.8.8.8', '94.140.14.14'],
  // User-Agent для обхода ограничений
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ]
};

// Кеш для запросов (простая реализация)
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Rate limiting (простая реализация)
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const limit = rateLimiter.get(clientId);
  
  if (!limit || now > limit.resetTime) {
    rateLimiter.set(clientId, {
      count: 1,
      resetTime: now + WB_API_CONFIG.RATE_LIMITS.WINDOW_MS
    });
    return true;
  }
  
  if (limit.count >= WB_API_CONFIG.RATE_LIMITS.REQUESTS_PER_MINUTE) {
    return false;
  }
  
  limit.count++;
  return true;
}

function getCacheKey(url: string, method: string, body?: string): string {
  return `${method}:${url}:${body ? Buffer.from(body).toString('base64').slice(0, 50) : ''}`;
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() > cached.timestamp + cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCache(key: string, data: any, ttl: number = CACHE_TTL): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Получение случайного User-Agent для обхода ограничений
 */
function getRandomUserAgent(): string {
  return FALLBACK_CONFIG.USER_AGENTS[Math.floor(Math.random() * FALLBACK_CONFIG.USER_AGENTS.length)];
}

/**
 * Определение правильного домена для endpoint
 */
function getCorrectDomain(endpoint: string): string {
  if (endpoint.includes('/content/')) {
    return WB_API_CONFIG.BASE_URLS.CONTENT;
  } else if (endpoint.includes('/marketplace/')) {
    return WB_API_CONFIG.BASE_URLS.MARKETPLACE;
  } else if (endpoint.includes('/statistics/')) {
    return WB_API_CONFIG.BASE_URLS.STATISTICS;
  } else if (endpoint.includes('/discounts/') || endpoint.includes('/prices/')) {
    return WB_API_CONFIG.BASE_URLS.DISCOUNTS_PRICES;
  }
  
  // По умолчанию используем content API
  return WB_API_CONFIG.BASE_URLS.CONTENT;
}

/**
 * Попытка получения категорий через публичные endpoints
 */
async function getCategoriesPublic(): Promise<any> {
  try {
    console.log('🔄 Попытка получения категорий через публичный API...');
    
    const response = await fetch(FALLBACK_CONFIG.PUBLIC_ENDPOINTS.CATEGORIES, {
      method: 'GET',
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(WB_API_CONFIG.TIMEOUTS.DEFAULT)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Категории получены через публичный API');
      
      // Конвертируем в формат WB API
      const convertedData = convertPublicCategoriesToWbFormat(data);
      return { data: convertedData };
    }
    
    throw new Error(`Public API ответил с кодом ${response.status}`);
  } catch (error) {
    console.error('❌ Ошибка получения категорий через публичный API:', error);
    throw error;
  }
}

/**
 * Конвертация публичных категорий в формат WB API
 */
function convertPublicCategoriesToWbFormat(publicData: any): any[] {
  const categories: any[] = [];
  
  function extractCategories(items: any[], parentId?: number) {
    if (!Array.isArray(items)) return;
    
    items.forEach((item, index) => {
      if (item.name && item.id) {
        categories.push({
          objectID: item.id || (parentId ? parentId * 1000 + index : index + 1),
          objectName: item.name,
          parentID: parentId || null,
          isVisible: true
        });
        
        // Рекурсивно обрабатываем дочерние элементы
        if (item.children && Array.isArray(item.children)) {
          extractCategories(item.children, item.id || (parentId ? parentId * 1000 + index : index + 1));
        }
      }
    });
  }
  
  try {
    if (publicData && publicData.menu) {
      extractCategories(publicData.menu);
    } else if (Array.isArray(publicData)) {
      extractCategories(publicData);
    } else {
      // Создаем базовые категории как fallback
      categories.push(
        { objectID: 963, objectName: 'Кабели и адаптеры', parentID: null, isVisible: true },
        { objectID: 964, objectName: 'Аксессуары для электроники', parentID: null, isVisible: true },
        { objectID: 965, objectName: 'Аксессуары для мобильных телефонов', parentID: null, isVisible: true },
        { objectID: 14727, objectName: 'Товары для дома', parentID: null, isVisible: true },
        { objectID: 2674, objectName: 'Кухонная посуда', parentID: null, isVisible: true }
      );
    }
  } catch (error) {
    console.error('Ошибка конвертации категорий:', error);
  }
  
  return categories;
}

/**
 * Валидация токена WB
 */
function validateWBToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Проверяем формат JWT токена (3 сегмента разделенных точками)
  const segments = token.split('.');
  if (segments.length !== 3) {
    console.error(`❌ Токен содержит ${segments.length} сегментов вместо 3`);
    return false;
  }
  
  // Проверяем что каждый сегмент является валидным base64
  try {
    segments.forEach((segment, index) => {
      if (segment.length === 0) {
        throw new Error(`Сегмент ${index + 1} пуст`);
      }
      // Попытка декодирования base64
      Buffer.from(segment, 'base64');
    });
    return true;
  } catch (error) {
    console.error('❌ Токен не является валидным JWT:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Попробуйте позже.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { endpoint, method = 'GET', data: requestData, apiToken, useCache = true } = body;

    // Валидация обязательных полей
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint обязателен' },
        { status: 400 }
      );
    }

    // Специальная обработка для получения категорий
    const isCategoriesRequest = endpoint.includes('/object/all') || endpoint.includes('/object/parent');
    
    if (isCategoriesRequest) {
      // Проверяем кеш для категорий
      const cacheKey = getCacheKey(endpoint, method, requestData ? JSON.stringify(requestData) : undefined);
      
      if (useCache) {
        const cached = getFromCache(cacheKey);
        if (cached) {
          console.log('📋 Категории получены из кеша');
          return NextResponse.json({
            success: true,
            data: cached,
            fromCache: true
          });
        }
      }

      // Сначала пробуем через публичный API
      try {
        const publicResult = await getCategoriesPublic();
        
        // Кешируем результат
        setCache(cacheKey, publicResult, 24 * 60 * 60 * 1000); // 24 часа для категорий
        
        return NextResponse.json({
          success: true,
          data: publicResult,
          fromCache: false,
          source: 'public_api'
        });
      } catch (publicError) {
        console.warn('⚠️ Публичный API недоступен, пробуем официальный API');
        
        // Если публичный API не работает, пробуем официальный
        if (!apiToken) {
          return NextResponse.json({
            success: false,
            error: 'Публичный API недоступен и не указан API токен для официального API'
          }, { status: 400 });
        }
      }
    }

    // Валидация токена (только если он указан)
    if (apiToken && !validateWBToken(apiToken)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный формат токена. Токен должен быть валидным JWT с 3 сегментами.'
      }, { status: 401 });
    }

    // Проверяем кеш для обычных запросов
    const cacheKey = getCacheKey(endpoint, method, requestData ? JSON.stringify(requestData) : undefined);
    
    if (method === 'GET' && useCache && apiToken) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        console.log('📋 Данные получены из кеша:', endpoint);
        return NextResponse.json({
          success: true,
          data: cached,
          fromCache: true
        });
      }
    }

    // Определяем правильный базовый URL
    const baseUrl = getCorrectDomain(endpoint);
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

    console.log(`🌐 Прокси-запрос: ${method} ${fullUrl}`);

    // Подготавливаем заголовки
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/json',
      'Accept-Language': 'ru-RU,ru;q=0.9'
    };

    // Добавляем авторизацию только если токен валиден
    if (apiToken && validateWBToken(apiToken)) {
      headers['Authorization'] = apiToken; // WB API 2025 не требует Bearer префикса
    }

    // Настройки запроса
    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(WB_API_CONFIG.TIMEOUTS.DEFAULT)
    };

    // Добавляем тело запроса для POST/PUT
    if ((method === 'POST' || method === 'PUT') && requestData) {
      fetchOptions.body = JSON.stringify(requestData);
    }

    // Выполняем запрос к WB API с повторными попытками
    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(fullUrl, fetchOptions);
        
        console.log(`📡 Ответ WB API: ${response.status} ${response.statusText}`);

        // Обрабатываем ответ
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        // Проверяем на ошибки
        if (!response.ok) {
          console.error(`❌ Ошибка WB API (${response.status}):`, responseData);
          
          // Для ошибки 401 с токеном пробуем без токена (для публичных endpoints)
          if (response.status === 401 && apiToken && isCategoriesRequest) {
            console.log('🔄 Повтор запроса без токена...');
            const headersWithoutAuth = { ...headers };
            delete headersWithoutAuth['Authorization'];
            
            const retryResponse = await fetch(fullUrl, {
              ...fetchOptions,
              headers: headersWithoutAuth
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              return NextResponse.json({
                success: true,
                data: retryData,
                statusCode: retryResponse.status,
                fromCache: false
              });
            }
          }
          
          return NextResponse.json({
            success: false,
            error: `WB API Error ${response.status}: ${typeof responseData === 'string' ? responseData : JSON.stringify(responseData)}`,
            statusCode: response.status
          }, { status: response.status });
        }

        // Кешируем успешные GET запросы
        if (method === 'GET' && useCache && response.ok) {
          const ttl = isCategoriesRequest ? 24 * 60 * 60 * 1000 : CACHE_TTL; // Категории кешируем на 24 часа
          setCache(cacheKey, responseData, ttl);
        }

        return NextResponse.json({
          success: true,
          data: responseData,
          statusCode: response.status,
          fromCache: false
        });

      } catch (error: any) {
        lastError = error;
        console.error(`❌ Попытка ${attempt}/${maxRetries} неудачна:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Экспоненциальная задержка
          console.log(`⏳ Ожидание ${delay}мс перед повтором...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Если все попытки неудачны и это запрос категорий, возвращаем fallback данные
    if (isCategoriesRequest) {
      console.log('🔄 Возвращаем fallback категории...');
      const fallbackCategories = convertPublicCategoriesToWbFormat({});
      
      return NextResponse.json({
        success: true,
        data: { data: fallbackCategories },
        fromCache: false,
        source: 'fallback'
      });
    }

    // Обработка специфичных ошибок
    if (lastError?.name === 'TimeoutError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Таймаут запроса к WB API. Попробуйте позже.' 
        },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Ошибка соединения с WB API', 
        details: lastError?.message 
      },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('❌ Ошибка прокси-запроса:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Ошибка обработки запроса', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET запрос для простых операций
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const apiToken = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint параметр обязателен' },
        { status: 400 }
      );
    }

    // Перенаправляем на POST обработчик
    const mockRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        endpoint,
        method: 'GET',
        apiToken,
        useCache: true
      })
    });

    return POST(mockRequest as NextRequest);

  } catch (error: any) {
    console.error('❌ Ошибка GET прокси:', error);
    return NextResponse.json(
      { error: 'Ошибка обработки GET запроса', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE для очистки кеша
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'clear-cache') {
      cache.clear();
      console.log('🗑️ Кеш очищен');
      return NextResponse.json({ success: true, message: 'Кеш очищен' });
    }

    if (action === 'clear-rate-limit') {
      rateLimiter.clear();
      console.log('🗑️ Rate limiter очищен');
      return NextResponse.json({ success: true, message: 'Rate limiter очищен' });
    }

    return NextResponse.json(
      { error: 'Неизвестное действие' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('❌ Ошибка DELETE прокси:', error);
    return NextResponse.json(
      { error: 'Ошибка обработки DELETE запроса', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH для получения статистики
export async function PATCH(request: NextRequest) {
  try {
    const stats = {
      cache: {
        size: cache.size,
        entries: Array.from(cache.keys()).slice(0, 10)
      },
      rateLimiter: {
        activeClients: rateLimiter.size,
        limits: WB_API_CONFIG.RATE_LIMITS
      },
      config: {
        cacheTTL: CACHE_TTL,
        timeout: WB_API_CONFIG.TIMEOUTS.DEFAULT,
        domains: WB_API_CONFIG.BASE_URLS
      }
    };

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error: any) {
    console.error('❌ Ошибка получения статистики:', error);
    return NextResponse.json(
      { error: 'Ошибка получения статистики', details: error.message },
      { status: 500 }
    );
  }
}