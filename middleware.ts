// middleware.ts - MIDDLEWARE ДЛЯ ОБРАБОТКИ CORS И БЕЗОПАСНОСТИ

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Конфигурация CORS
const CORS_CONFIG = {
  allowedOrigins: [
    'http://localhost:3000',
    'https://localhost:3000',
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
  ].filter(Boolean) as string[],
  
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  
  allowedHeaders: [
    'Accept',
    'Accept-Version',
    'Content-Length',
    'Content-MD5',
    'Content-Type',
    'Date',
    'X-Api-Version',
    'Authorization'
  ],
  
  exposedHeaders: ['X-Request-Id', 'X-Response-Time'],
  
  credentials: true,
  maxAge: 86400 // 24 часа
};

// Rate limiting конфигурация
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 минут
  maxRequests: 100, // максимум запросов за окно
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (request: NextRequest) => {
    return request.ip ?? request.headers.get('x-forwarded-for') ?? 'anonymous';
  }
};

// Простое in-memory хранилище для rate limiting
const rateLimit = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(request: NextRequest): { allowed: boolean; remaining: number; resetTime: number } {
  const key = RATE_LIMIT_CONFIG.keyGenerator(request);
  const now = Date.now();
  
  // Очищаем устаревшие записи
  for (const [k, v] of rateLimit.entries()) {
    if (now > v.resetTime) {
      rateLimit.delete(k);
    }
  }
  
  const current = rateLimit.get(key);
  
  if (!current || now > current.resetTime) {
    // Новое окно или первый запрос
    const resetTime = now + RATE_LIMIT_CONFIG.windowMs;
    rateLimit.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequests - 1,
      resetTime
    };
  }
  
  if (current.count >= RATE_LIMIT_CONFIG.maxRequests) {
    // Превышен лимит
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime
    };
  }
  
  // Увеличиваем счетчик
  current.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.maxRequests - current.count,
    resetTime: current.resetTime
  };
}

function createCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': CORS_CONFIG.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': CORS_CONFIG.allowedHeaders.join(', '),
    'Access-Control-Expose-Headers': CORS_CONFIG.exposedHeaders.join(', '),
    'Access-Control-Max-Age': CORS_CONFIG.maxAge.toString()
  };
  
  if (CORS_CONFIG.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  // Проверяем разрешенные origins
  if (origin && (CORS_CONFIG.allowedOrigins.includes(origin) || CORS_CONFIG.allowedOrigins.includes('*'))) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (CORS_CONFIG.allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  
  return headers;
}

export function middleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Получаем origin из заголовка
  const origin = request.headers.get('origin');
  
  // Создаем базовые заголовки
  const corsHeaders = createCorsHeaders(origin);
  
  // Добавляем служебные заголовки
  corsHeaders['X-Request-Id'] = requestId;
  corsHeaders['X-Powered-By'] = 'WB-Automation-Tool';
  
  // Обработка preflight запросов (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  
  // Проверка rate limiting для API маршрутов
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rateLimitResult = checkRateLimit(request);
    
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Слишком много запросов. Попробуйте снова через ${resetTimeSeconds} секунд.`,
          retryAfter: resetTimeSeconds
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': resetTimeSeconds.toString(),
            'X-RateLimit-Limit': RATE_LIMIT_CONFIG.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
          }
        }
      );
    }
    
    // Добавляем заголовки rate limiting к успешным запросам
    corsHeaders['X-RateLimit-Limit'] = RATE_LIMIT_CONFIG.maxRequests.toString();
    corsHeaders['X-RateLimit-Remaining'] = rateLimitResult.remaining.toString();
    corsHeaders['X-RateLimit-Reset'] = Math.ceil(rateLimitResult.resetTime / 1000).toString();
  }
  
  // Дополнительные заголовки безопасности
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
  
  // Продолжаем обработку запроса
  const response = NextResponse.next();
  
  // Добавляем все заголовки к ответу
  Object.entries({ ...corsHeaders, ...securityHeaders }).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Добавляем время ответа
  const responseTime = Date.now() - startTime;
  response.headers.set('X-Response-Time', `${responseTime}ms`);
  
  return response;
}

// Конфигурация matcher - указываем, к каким путям применять middleware
export const config = {
  matcher: [
    /*
     * Применяем middleware ко всем запросам кроме:
     * - api (внутренние API routes)
     * - _next/static (статические файлы)
     * - _next/image (оптимизация изображений)
     * - favicon.ico (иконка)
     * - Файлы в public директории
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)',
  ],
}

// Дополнительные утилиты для работы с middleware

export class MiddlewareUtils {
  /**
   * Проверка валидности JWT токена (базовая проверка формата)
   */
  static isValidJWT(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Проверяем, что каждая часть это валидный base64
      parts.forEach(part => {
        const decoded = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        JSON.parse(decoded);
      });
      
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Извлечение IP адреса из запроса
   */
  static getClientIP(request: NextRequest): string {
    return (
      request.ip ||
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown'
    );
  }
  
  /**
   * Проверка, является ли запрос от бота
   */
  static isBot(request: NextRequest): boolean {
    const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
    const botPatterns = [
      'googlebot',
      'bingbot',
      'slurp',
      'duckduckbot',
      'baiduspider',
      'yandexbot',
      'facebookexternalhit',
      'twitterbot',
      'whatsapp',
      'telegram'
    ];
    
    return botPatterns.some(pattern => userAgent.includes(pattern));
  }
  
  /**
   * Логирование запросов (для отладки)
   */
  static logRequest(request: NextRequest, responseTime?: number): void {
    if (process.env.NODE_ENV === 'development') {
      const method = request.method;
      const url = request.url;
      const ip = this.getClientIP(request);
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      const time = responseTime ? ` (${responseTime}ms)` : '';
      
      console.log(`[${new Date().toISOString()}] ${method} ${url} - IP: ${ip}${time}`);
      
      if (this.isBot(request)) {
        console.log(`  🤖 Bot detected: ${userAgent}`);
      }
    }
  }
  
  /**
   * Создание заголовков для кеширования
   */
  static createCacheHeaders(maxAge: number = 3600, staleWhileRevalidate: number = 86400): Record<string, string> {
    return {
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      'Vary': 'Accept-Encoding'
    };
  }
  
  /**
   * Создание заголовков для отключения кеширования
   */
  static createNoCacheHeaders(): Record<string, string> {
    return {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    };
  }
}

// Экспорт конфигурации для использования в других местах
export { CORS_CONFIG, RATE_LIMIT_CONFIG };