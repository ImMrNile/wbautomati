
// src/app/api/cabinets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Новые базовые URL API Wildberries 2025
const WB_API_ENDPOINTS = {
  content: 'https://content-api.wildberries.ru',
  marketplace: 'https://marketplace-api.wildberries.ru',
  statistics: 'https://statistics-api.wildberries.ru',
  prices: 'https://discounts-prices-api.wildberries.ru'
};

// GET - получить все кабинеты
export async function GET() {
  try {
    const cabinets = await prisma.cabinet.findMany({
      include: {
        productCabinets: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const cabinetsWithStats = cabinets.map(cabinet => ({
      ...cabinet,
      apiToken: maskToken(cabinet.apiToken),
      stats: {
        totalProducts: cabinet.productCabinets.length,
        publishedProducts: cabinet.productCabinets.filter(pc => 
          pc.product.status === 'PUBLISHED'
        ).length,
        processingProducts: cabinet.productCabinets.filter(pc => 
          pc.product.status === 'PROCESSING' || pc.product.status === 'PUBLISHING'
        ).length
      }
    }));

    return NextResponse.json({
      cabinets: cabinetsWithStats,
      total: cabinets.length
    });

  } catch (error) {
    console.error('Ошибка при получении кабинетов:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении кабинетов' },
      { status: 500 }
    );
  }
}

// POST - добавить новый кабинет
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, apiToken, description, skipValidation } = body;

    if (!name || !apiToken) {
      return NextResponse.json(
        { error: 'Название кабинета и API токен обязательны' },
        { status: 400 }
      );
    }

    // Проверяем уникальность названия
    const existingCabinet = await prisma.cabinet.findFirst({
      where: { name }
    });

    if (existingCabinet) {
      return NextResponse.json(
        { error: 'Кабинет с таким названием уже существует' },
        { status: 400 }
      );
    }

    // Проверяем валидность токена (если не пропускаем валидацию)
    if (!skipValidation) {
      const validation = await validateWBToken(apiToken);
      if (!validation.valid) {
        return NextResponse.json(
          { 
            error: validation.error,
            suggestion: validation.networkError ? 
              'Не удается подключиться к API Wildberries. Проверьте интернет-соединение или добавьте кабинет без проверки токена.' : 
              'Проверьте правильность API токена и его права доступа.',
            canSkipValidation: validation.networkError,
            tokenAnalysis: validation.tokenAnalysis
          },
          { status: 400 }
        );
      }
    }

    // Создаем новый кабинет
    const newCabinet = await prisma.cabinet.create({
      data: {
        name,
        apiToken,
        description: description || null,
        isActive: true
      }
    });

    return NextResponse.json({
      cabinet: {
        ...newCabinet,
        apiToken: maskToken(newCabinet.apiToken)
      },
      message: skipValidation 
        ? 'Кабинет добавлен без проверки токена' 
        : 'Кабинет успешно добавлен и токен проверен'
    });

  } catch (error) {
    console.error('Ошибка при добавлении кабинета:', error);
    return NextResponse.json(
      { error: 'Ошибка при добавлении кабинета' },
      { status: 500 }
    );
  }
}

// PUT и DELETE методы остаются такими же...
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, apiToken, description, isActive, skipValidation } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID кабинета обязателен' },
        { status: 400 }
      );
    }

    const cabinet = await prisma.cabinet.findUnique({
      where: { id }
    });

    if (!cabinet) {
      return NextResponse.json(
        { error: 'Кабинет не найден' },
        { status: 404 }
      );
    }

    // Если обновляется токен, проверяем его валидность
    if (apiToken && apiToken !== cabinet.apiToken && !skipValidation) {
      const validation = await validateWBToken(apiToken);
      if (!validation.valid) {
        return NextResponse.json(
          { 
            error: validation.error,
            suggestion: validation.networkError ? 
              'Не удается подключиться к API Wildberries. Обновите кабинет без проверки токена.' : 
              'Проверьте правильность нового API токена.',
            canSkipValidation: validation.networkError
          },
          { status: 400 }
        );
      }
    }

    // Проверяем уникальность названия (если изменяется)
    if (name && name !== cabinet.name) {
      const existingCabinet = await prisma.cabinet.findFirst({
        where: { 
          name,
          id: { not: id }
        }
      });

      if (existingCabinet) {
        return NextResponse.json(
          { error: 'Кабинет с таким названием уже существует' },
          { status: 400 }
        );
      }
    }

    // Обновляем кабинет
    const updatedCabinet = await prisma.cabinet.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(apiToken && { apiToken }),
        ...(description !== undefined && { description }),
        ...(typeof isActive !== 'undefined' && { isActive })
      }
    });

    return NextResponse.json({
      cabinet: {
        ...updatedCabinet,
        apiToken: maskToken(updatedCabinet.apiToken)
      },
      message: 'Кабинет успешно обновлен'
    });

  } catch (error) {
    console.error('Ошибка при обновлении кабинета:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении кабинета' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID кабинета обязателен' },
        { status: 400 }
      );
    }

    const cabinet = await prisma.cabinet.findUnique({
      where: { id },
      include: {
        productCabinets: true
      }
    });

    if (!cabinet) {
      return NextResponse.json(
        { error: 'Кабинет не найден' },
        { status: 404 }
      );
    }

    if (cabinet.productCabinets.length > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить кабинет, к которому привязаны товары' },
        { status: 400 }
      );
    }

    await prisma.cabinet.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Кабинет успешно удален'
    });

  } catch (error) {
    console.error('Ошибка при удалении кабинета:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении кабинета' },
      { status: 500 }
    );
  }
}

// Обновленная функция валидации токена с новыми доменами
async function validateWBToken(token: string): Promise<{ 
  valid: boolean; 
  error?: string; 
  networkError?: boolean;
  tokenAnalysis?: any;
}> {
  console.log('Проверяем токен WB с новыми доменами 2025...');
  
  // Сначала анализируем сам токен
  const tokenAnalysis = analyzeJWTToken(token);
  if (!tokenAnalysis.valid) {
    return {
      valid: false,
      error: tokenAnalysis.error,
      tokenAnalysis
    };
  }

  // Если токен истек
  if (tokenAnalysis.isExpired) {
    return {
      valid: false,
      error: 'Токен истек. Создайте новый токен в личном кабинете Wildberries.',
      tokenAnalysis
    };
  }

  // Список новых ping endpoints для проверки
  const pingEndpoints = [
    { name: 'Content API', url: `${WB_API_ENDPOINTS.content}/ping` },
    { name: 'Marketplace API', url: `${WB_API_ENDPOINTS.marketplace}/ping` },
    { name: 'Statistics API', url: `${WB_API_ENDPOINTS.statistics}/ping` }
  ];

  let successCount = 0;
  let lastError = '';

  for (const endpoint of pingEndpoints) {
    try {
      console.log(`Проверяем ${endpoint.name}: ${endpoint.url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд

      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: {
          'Authorization': token, // JWT без Bearer префикса
          'Content-Type': 'application/json',
          'User-Agent': 'WB-Automation/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`${endpoint.name} ответ: ${response.status}`);

      if (response.ok) {
        successCount++;
        console.log(`${endpoint.name} - успешно!`);
        
        // Если хотя бы один endpoint работает, токен валидный
        if (successCount === 1) {
          return { 
            valid: true, 
            tokenAnalysis 
          };
        }
      } else if (response.status === 401) {
        lastError = 'Недействительный токен авторизации';
      } else if (response.status === 403) {
        lastError = 'Недостаточно прав доступа к этому API';
      } else {
        lastError = `Ошибка API: ${response.status}`;
      }

    } catch (error: any) {
      console.error(`Ошибка при обращении к ${endpoint.name}:`, error.message);
      
      if (error.name === 'AbortError') {
        lastError = 'Превышен таймаут подключения';
      } else if (error.message.includes('ENOTFOUND')) {
        lastError = 'Не удается найти сервер API';
      } else {
        lastError = 'Ошибка сетевого соединения';
      }
    }

    // Пауза между запросами для соблюдения rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Если ни один endpoint не сработал
  if (successCount === 0) {
    const isNetworkError = lastError.includes('таймаут') || 
                          lastError.includes('соединения') || 
                          lastError.includes('сервер');
    
    return { 
      valid: false, 
      error: lastError || 'Не удается подключиться к API Wildberries',
      networkError: isNetworkError,
      tokenAnalysis
    };
  }

  return { 
    valid: true, 
    tokenAnalysis 
  };
}

// Анализ JWT токена
function analyzeJWTToken(token: string) {
  try {
    // Проверяем формат JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Неверный формат JWT токена (должно быть 3 части, разделенные точками)' };
    }

    // Декодируем payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp && payload.exp < now;
    
    return {
      valid: true,
      isExpired,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toLocaleString('ru-RU') : 'Не указано',
      sellerId: payload.sid || 'Не указано',
      permissions: payload.s || 'Не указано',
      isTestToken: payload.t || false,
      tokenId: payload.id || 'Не указано'
    };
  } catch (error) {
    return { 
      valid: false, 
      error: 'Не удалось разобрать JWT токен. Проверьте правильность токена.' 
    };
  }
}

// Функция для маскировки токена
function maskToken(token: string): string {
  if (!token || token.length <= 8) return '*'.repeat(token?.length || 0);
  return token.substring(0, 4) + '*'.repeat(token.length - 8) + token.substring(token.length - 4);
}