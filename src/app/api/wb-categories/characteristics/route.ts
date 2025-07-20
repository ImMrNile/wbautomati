// src/app/api/wb-categories/characteristics/route.ts - API для получения характеристик категорий

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryCharacteristic {
  id: number;
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  values?: string[];
  units?: string[];
  description?: string;
}

interface CharacteristicsResponse {
  success: boolean;
  data?: {
    categoryId: number;
    categoryName: string;
    characteristics: CategoryCharacteristic[];
    total: number;
    cached: boolean;
    lastUpdated: Date;
  };
  error?: string;
}

// Кеш для характеристик
const characteristicsCache = new Map<string, {
  data: CategoryCharacteristic[];
  timestamp: number;
  ttl: number;
}>();

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 часов для характеристик

/**
 * GET - Получение характеристик для конкретной категории
 * Query параметры:
 * - cabinetId: ID кабинета (обязательный)
 * - categoryId: ID категории (обязательный)
 * - useCache: использовать кеш (по умолчанию true)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinetId = searchParams.get('cabinetId');
    const categoryId = searchParams.get('categoryId');
    const useCache = searchParams.get('useCache') !== 'false';

    // Валидация параметров
    if (!cabinetId || !categoryId) {
      return NextResponse.json({
        success: false,
        error: 'Параметры cabinetId и categoryId обязательны'
      }, { status: 400 });
    }

    const categoryIdNum = parseInt(categoryId);
    if (isNaN(categoryIdNum)) {
      return NextResponse.json({
        success: false,
        error: 'categoryId должен быть числом'
      }, { status: 400 });
    }

    // Получаем кабинет
    const cabinet = await prisma.cabinet.findUnique({
      where: { id: cabinetId }
    });

    if (!cabinet || !cabinet.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Активный кабинет не найден'
      }, { status: 404 });
    }

    const apiToken = await decryptTokenIfNeeded(cabinet.apiToken);

    // Загружаем характеристики
    const characteristicsData = await loadCharacteristicsWithCache(
      apiToken, 
      categoryIdNum, 
      useCache
    );

    if (!characteristicsData.success) {
      return NextResponse.json(characteristicsData, { status: 500 });
    }

    // Получаем название категории
    const categoryName = await getCategoryName(apiToken, categoryIdNum);

    return NextResponse.json({
      success: true,
      data: {
        categoryId: categoryIdNum,
        categoryName,
        characteristics: characteristicsData.data!.characteristics,
        total: characteristicsData.data!.characteristics.length,
        cached: characteristicsData.data!.cached,
        lastUpdated: characteristicsData.data!.lastUpdated
      }
    });

  } catch (error: any) {
    console.error('❌ Ошибка в GET /wb-categories/characteristics:', error);
    return NextResponse.json({
      success: false,
      error: `Ошибка получения характеристик: ${error.message}`
    }, { status: 500 });
  }
}

/**
 * POST - Валидация характеристик для категории
 * Body: { cabinetId: string, categoryId: number, characteristics: Record<string, any> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cabinetId, categoryId, characteristics } = body;

    if (!cabinetId || !categoryId || !characteristics) {
      return NextResponse.json({
        success: false,
        error: 'Параметры cabinetId, categoryId и characteristics обязательны'
      }, { status: 400 });
    }

    // Получаем кабинет
    const cabinet = await prisma.cabinet.findUnique({
      where: { id: cabinetId }
    });

    if (!cabinet || !cabinet.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Активный кабинет не найден'
      }, { status: 404 });
    }

    const apiToken = await decryptTokenIfNeeded(cabinet.apiToken);

    // Загружаем требуемые характеристики для категории
    const categoryCharcs = await loadCharacteristicsWithCache(apiToken, categoryId, true);

    if (!categoryCharcs.success) {
      return NextResponse.json({
        success: false,
        error: 'Не удалось загрузить характеристики категории'
      }, { status: 500 });
    }

    // Валидируем переданные характеристики
    const validationResult = validateCharacteristics(
      categoryCharcs.data!.characteristics,
      characteristics
    );

    return NextResponse.json({
      success: true,
      data: validationResult
    });

  } catch (error: any) {
    console.error('❌ Ошибка в POST /wb-categories/characteristics:', error);
    return NextResponse.json({
      success: false,
      error: `Ошибка валидации характеристик: ${error.message}`
    }, { status: 500 });
  }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

/**
 * Загружает характеристики с использованием кеша
 */
async function loadCharacteristicsWithCache(
  apiToken: string, 
  categoryId: number, 
  useCache: boolean = true
): Promise<{ success: boolean; data?: { characteristics: CategoryCharacteristic[]; cached: boolean; lastUpdated: Date }; error?: string }> {
  const cacheKey = `${apiToken}-${categoryId}`;
  
  // Проверяем кеш
  if (useCache) {
    const cached = characteristicsCache.get(cacheKey);
    if (cached && Date.now() < cached.timestamp + cached.ttl) {
      console.log(`📋 Характеристики категории ${categoryId} получены из кеша`);
      return {
        success: true,
        data: {
          characteristics: cached.data,
          cached: true,
          lastUpdated: new Date(cached.timestamp)
        }
      };
    }
  }

  // Загружаем из API
  return await loadCharacteristicsFromWbApi(apiToken, categoryId);
}

/**
 * Загружает характеристики из WB API
 */
async function loadCharacteristicsFromWbApi(
  apiToken: string, 
  categoryId: number
): Promise<{ success: boolean; data?: { characteristics: CategoryCharacteristic[]; cached: boolean; lastUpdated: Date }; error?: string }> {
  try {
    console.log(`🔍 Загружаем характеристики для категории ${categoryId}...`);

    // Используем прокси для обращения к WB API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/wb-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: `/content/v2/object/charcs/${categoryId}?locale=ru`,
        method: 'GET',
        apiToken,
        useCache: false
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Ошибка загрузки характеристик');
    }

    const rawCharacteristics = result.data?.data || [];
    
    // Обрабатываем и нормализуем характеристики
    const characteristics = normalizeCharacteristics(rawCharacteristics);

    // Кешируем результат
    const cacheKey = `${apiToken}-${categoryId}`;
    characteristicsCache.set(cacheKey, {
      data: characteristics,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });

    console.log(`✅ Загружено ${characteristics.length} характеристик для категории ${categoryId}`);

    return {
      success: true,
      data: {
        characteristics,
        cached: false,
        lastUpdated: new Date()
      }
    };

  } catch (error: any) {
    console.error(`❌ Ошибка загрузки характеристик категории ${categoryId}:`, error);
    return {
      success: false,
      error: `Не удалось загрузить характеристики: ${error.message}`
    };
  }
}

/**
 * Нормализует характеристики из WB API
 */
function normalizeCharacteristics(rawCharacteristics: any[]): CategoryCharacteristic[] {
  return rawCharacteristics.map((char: any) => {
    // Определяем тип характеристики
    let type: CategoryCharacteristic['type'] = 'string';
    
    if (char.unitName || char.units) {
      type = 'number';
    } else if (char.dictionary && char.dictionary.length > 0) {
      type = char.maxCount > 1 ? 'multiselect' : 'select';
    } else if (char.name && char.name.toLowerCase().includes('да/нет')) {
      type = 'boolean';
    }

    return {
      id: char.id || char.charcID,
      name: char.name || char.charcName || 'Без названия',
      required: char.required || false,
      type,
      values: char.dictionary?.map((item: any) => item.value || item.name) || [],
      units: char.units || (char.unitName ? [char.unitName] : []),
      description: char.description
    };
  }).filter(char => char.id && char.name); // Фильтруем невалидные характеристики
}

/**
 * Получает название категории
 */
async function getCategoryName(apiToken: string, categoryId: number): Promise<string> {
  try {
    // Сначала пробуем получить из кеша категорий
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/wb-categories?cabinetId=temp&flat=true`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      const category = result.data?.categories?.find((cat: any) => cat.objectID === categoryId);
      if (category) {
        return category.objectName;
      }
    }
  } catch (error) {
    console.warn('Не удалось получить название категории из кеша');
  }

  return `Категория #${categoryId}`;
}

/**
 * Валидирует характеристики товара
 */
function validateCharacteristics(
  requiredCharacteristics: CategoryCharacteristic[],
  providedCharacteristics: Record<string, any>
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  extraCharacteristics: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequired: string[] = [];
  const extraCharacteristics: string[] = [];

  // Создаем карту требуемых характеристик
  const requiredMap = new Map<number, CategoryCharacteristic>();
  requiredCharacteristics.forEach(char => {
    requiredMap.set(char.id, char);
  });

  // Проверяем обязательные характеристики
  requiredCharacteristics.forEach(char => {
    if (char.required) {
      const value = providedCharacteristics[char.id];
      if (value === undefined || value === null || value === '') {
        missingRequired.push(char.name);
        errors.push(`Обязательная характеристика "${char.name}" не указана`);
      }
    }
  });

  // Проверяем предоставленные характеристики
  Object.entries(providedCharacteristics).forEach(([charId, value]) => {
    const charIdNum = parseInt(charId);
    const requiredChar = requiredMap.get(charIdNum);

    if (!requiredChar) {
      extraCharacteristics.push(charId);
      warnings.push(`Характеристика с ID ${charId} не требуется для данной категории`);
      return;
    }

    // Валидируем значение характеристики
    const validationError = validateCharacteristicValue(requiredChar, value);
    if (validationError) {
      errors.push(`Характеристика "${requiredChar.name}": ${validationError}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequired,
    extraCharacteristics
  };
}

/**
 * Валидирует значение отдельной характеристики
 */
function validateCharacteristicValue(
  characteristic: CategoryCharacteristic,
  value: any
): string | null {
  if (value === undefined || value === null) {
    return characteristic.required ? 'Значение обязательно' : null;
  }

  switch (characteristic.type) {
    case 'string':
      if (typeof value !== 'string') {
        return 'Ожидается строковое значение';
      }
      if (value.trim().length === 0 && characteristic.required) {
        return 'Значение не может быть пустым';
      }
      if (value.length > 500) {
        return 'Значение слишком длинное (максимум 500 символов)';
      }
      break;

    case 'number':
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return 'Ожидается числовое значение';
      }
      if (numValue < 0) {
        return 'Значение не может быть отрицательным';
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
        return 'Ожидается булево значение (true/false)';
      }
      break;

    case 'select':
      if (characteristic.values && characteristic.values.length > 0) {
        if (!characteristic.values.includes(String(value))) {
          return `Значение должно быть одним из: ${characteristic.values.join(', ')}`;
        }
      }
      break;

    case 'multiselect':
      if (!Array.isArray(value)) {
        return 'Ожидается массив значений';
      }
      if (characteristic.values && characteristic.values.length > 0) {
        const invalidValues = value.filter(v => !characteristic.values!.includes(String(v)));
        if (invalidValues.length > 0) {
          return `Недопустимые значения: ${invalidValues.join(', ')}. Разрешены: ${characteristic.values.join(', ')}`;
        }
      }
      break;
  }

  return null;
}

/**
 * Расшифровывает токен если он зашифрован
 */
async function decryptTokenIfNeeded(encryptedToken: string): Promise<string> {
  // Здесь должна быть логика расшифровки токена
  // Для примера возвращаем как есть
  return encryptedToken;
}