// src/app/api/products/route.ts - ЧИСТАЯ ВЕРСИЯ БЕЗ ДУБЛИРОВАНИЯ

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Cabinet } from '@prisma/client';
import { toPrismaJson } from '../../../../lib/utils/json';
import { wbSimpleParser } from '../../../../lib/services/wbSimpleParser';
import { uploadService } from '../../../../lib/services/uploadService';
import { geminiService } from '../../../../lib/services/geminiService';
import { WBCharacteristicsHelper, WB_CHARACTERISTICS_IDS } from '../../../../lib/utils/wbCharacteristics';
import { ErrorHandler, ProcessLogger, ValidationUtils, ErrorCode } from '../../../../lib/utils/errorHandler';
import { ProductStatus, ProductAnalysisResult, WBCategory, WBCardData, ProductCharacteristic } from '../../../../lib/types/gemini';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // 1. Извлекаем данные из формы
    const originalName = formData.get('name') as string;
    const image = formData.get('image') as File;
    const dimensions = JSON.parse(formData.get('dimensions') as string);
    const price = parseFloat(formData.get('price') as string);
    const referenceUrl = formData.get('referenceUrl') as string | null;
    const cabinetId = formData.get('cabinetId') as string;
    const autoPublish = formData.get('autoPublish') === 'true';

    // 2. Валидация входных данных
    if (!originalName || !image || !price || !cabinetId) {
      return NextResponse.json({ 
        error: 'Все поля обязательны для заполнения', 
        code: ErrorCode.INVALID_INPUT 
      }, { status: 400 });
    }

    // 3. Проверка кабинета
    const cabinet = await prisma.cabinet.findUnique({ where: { id: cabinetId } });
    if (!cabinet || !cabinet.isActive) {
      return NextResponse.json({ 
        error: 'Выбранный кабинет не найден или неактивен', 
        code: ErrorCode.WB_UNAUTHORIZED 
      }, { status: 400 });
    }

    // 4. Парсинг товара-аналога
    let referenceData = null;
    if (referenceUrl && referenceUrl.trim()) {
      try {
        console.log('🔍 Парсим товар-аналог:', referenceUrl);
        referenceData = await wbSimpleParser.getProductData(referenceUrl);
        console.log('✅ Аналог получен:', referenceData?.name || 'Без названия');
      } catch (error) {
        console.warn('⚠️ Не удалось спарсить аналог:', error);
        referenceData = null;
      }
    }

    // 5. Загрузка изображения
    const imageUrl = await uploadService.uploadFile(image);

    // 6. Создание продукта в БД
    const product = await prisma.product.create({
      data: {
        originalName,
        originalImage: imageUrl,
        dimensions: toPrismaJson(dimensions),
        price,
        referenceUrl: referenceUrl || undefined,
        referenceData: referenceData ? toPrismaJson(referenceData) : undefined,
        status: ProductStatus.PROCESSING
      }
    });

    // 7. Привязка к кабинету
    await prisma.productCabinet.create({
      data: { 
        productId: product.id, 
        cabinetId: cabinetId, 
        isSelected: true 
      }
    });

    // 8. Запуск обработки (без await для фонового выполнения)
    processProductSimple(
      product.id, 
      originalName, 
      imageUrl, 
      dimensions, 
      price, 
      referenceData, 
      cabinet, 
      autoPublish
    ).catch(error => {
      console.error('Ошибка фоновой обработки:', error);
    });

    return NextResponse.json({
      id: product.id,
      status: 'processing',
      message: 'Продукт создан и отправлен на обработку',
      hasReference: !!referenceData,
      referenceName: referenceData?.name || null,
      autoPublish
    });

  } catch (error: any) {
    console.error('Ошибка создания продукта:', error);
    return NextResponse.json({ 
      error: 'Внутренняя ошибка сервера', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const where = status && status !== 'all' ? { status: status as any } : {};

    const products = await prisma.product.findMany({
      where,
      include: { productCabinets: { include: { cabinet: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const total = await prisma.product.count({ where });

    return NextResponse.json({
      products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Ошибка получения продуктов:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// =========================================================================================
// УПРОЩЕННАЯ ФОНОВАЯ ОБРАБОТКА
// =========================================================================================
async function processProductSimple(
  productId: string, 
  name: string, 
  imageUrl: string, 
  dimensions: any, 
  price: number,
  referenceData: any, 
  cabinet: Cabinet, 
  autoPublish: boolean = false
) {
  console.log(`🚀 Начинаем обработку продукта ${productId}`);

  try {
    // Шаг 1: ИИ-анализ
    console.log('🤖 Запускаем ИИ-анализ...');
    const geminiAnalysis: ProductAnalysisResult = await geminiService.analyzeProductForWB({
      productName: name, 
      images: [imageUrl], 
      referenceData,
      dimensions: {
        length: dimensions.length?.toString(),
        width: dimensions.width?.toString(),
        height: dimensions.height?.toString(),
        weight: dimensions.weight?.toString(),
      },
      price
    });

    // Шаг 2: Получение категорий WB
    console.log('📂 Получаем категории WB...');
    const wbCategories = await wbSimpleParser.getWBCategories(cabinet.apiToken);
    
    // Шаг 3: Поиск лучшей категории
    console.log('🎯 Ищем подходящую категорию...');
    const bestCategory = findBestCategory(geminiAnalysis, wbCategories, referenceData);
    
    // Шаг 4: Получение характеристик категории
    console.log('🔧 Получаем характеристики категории...');
    const categoryCharacteristics = await wbSimpleParser.getCategoryCharacteristics(
      bestCategory.id, 
      cabinet.apiToken
    );

    // Шаг 5: Подготовка характеристик
    console.log('⚙️ Оптимизируем характеристики...');
    const optimizedCharacteristics = prepareCharacteristics(
      geminiAnalysis, 
      categoryCharacteristics, 
      dimensions, 
      referenceData
    );

    // Шаг 6: Подготовка данных для WB
    console.log('📋 Подготавливаем данные карточки...');
    const wbCardData = prepareCardData(
      geminiAnalysis, 
      bestCategory, 
      optimizedCharacteristics, 
      productId,
      referenceData
    );

    // Шаг 7: Обновление продукта в БД
    await prisma.product.update({
      where: { id: productId },
      data: {
        generatedName: wbCardData.title,
        seoDescription: wbCardData.description,
        suggestedCategory: bestCategory.name,
        colorAnalysis: geminiAnalysis.visualAnalysis?.primaryColor || 'не определен',
        aiCharacteristics: toPrismaJson({ 
          geminiAnalysis, 
          wbData: wbCardData, 
          category: bestCategory
        }),
        status: autoPublish ? ProductStatus.PUBLISHING : ProductStatus.READY
      }
    });

    // Шаг 8: Автопубликация
    if (autoPublish) {
      console.log('📤 Публикуем товар в WB...');
      
      const publishResult = await wbSimpleParser.createProductCard(wbCardData, cabinet.apiToken);

      if (publishResult.success) {
        await prisma.product.update({
          where: { id: productId },
          data: { 
            status: ProductStatus.PUBLISHED, 
            wbNmId: publishResult.nmId, 
            publishedAt: new Date(), 
            wbData: toPrismaJson(publishResult.data) 
          }
        });

        await prisma.productCabinet.updateMany({
          where: { productId, cabinetId: cabinet.id },
          data: { 
            isPublished: true, 
            wbCardId: publishResult.nmId?.toString() 
          }
        });

        console.log(`✅ Товар опубликован! NM ID: ${publishResult.nmId}`);
      } else {
        throw new Error(`Ошибка публикации: ${publishResult.error}`);
      }
    }

    console.log('🎉 Обработка продукта завершена успешно');

  } catch (error: any) {
    console.error('❌ Ошибка обработки продукта:', error);
    
    await prisma.product.update({
      where: { id: productId },
      data: { 
        status: ProductStatus.ERROR, 
        errorMessage: error.message || 'Неизвестная ошибка'
      }
    });
  } finally {
    // Очищаем ресурсы
    await wbSimpleParser.cleanup();
  }
}

// ==============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==============================================

/**
 * Поиск лучшей категории для товара
 */
function findBestCategory(
  geminiAnalysis: ProductAnalysisResult, 
  wbCategories: any[], 
  referenceData?: any
): WBCategory {
  console.log(`🔍 Анализируем ${wbCategories.length} категорий...`);
  
  const aiCategory = geminiAnalysis.wbCategory || '';
  const productType = geminiAnalysis.visualAnalysis?.productType || '';
  
  console.log(`🎯 ИИ предлагает: "${aiCategory}"`);
  console.log(`📦 Тип товара: "${productType}"`);
  
  if (referenceData?.category) {
    console.log(`📋 Категория аналога: "${referenceData.category}"`);
  }

  let bestMatch: any = null;
  let bestScore = -1;

  // Ключевые слова для поиска
  const searchTerms = [
    aiCategory.toLowerCase(),
    productType.toLowerCase(),
    referenceData?.category?.toLowerCase() || ''
  ].filter(term => term.length > 2);

  for (const category of wbCategories) {
    if (!category?.objectName && !category?.name) continue;
    
    const categoryName = (category.objectName || category.name || '').toLowerCase();
    let score = 0;

    // Поиск совпадений
    for (const term of searchTerms) {
      if (term && categoryName.includes(term)) {
        score += term.length > 10 ? 15 : 10;
      }
    }

    // Бонус за точное совпадение с аналогом
    if (referenceData?.categoryId && 
        (category.objectID === referenceData.categoryId || category.id === referenceData.categoryId)) {
      score += 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  if (bestMatch) {
    const categoryId = bestMatch.objectID || bestMatch.id || 14727;
    const categoryName = bestMatch.objectName || bestMatch.name || 'Товары для дома';
    
    console.log(`✅ Выбрана категория: "${categoryName}" (ID: ${categoryId}, очки: ${bestScore})`);
    
    return { 
      id: categoryId, 
      name: categoryName 
    };
  }

  // Fallback категории
  const fallback = selectFallbackCategory(aiCategory, productType);
  console.log(`⚠️ Используем fallback: ${fallback.name}`);
  
  return fallback;
}

/**
 * Выбор fallback категории
 */
function selectFallbackCategory(aiCategory: string, productType: string): WBCategory {
  const categoryMappings = {
    'одежда': { id: 306, name: 'Женская одежда' },
    'обувь': { id: 566, name: 'Обувь' },
    'украшения': { id: 1586, name: 'Ювелирные изделия' },
    'техника': { id: 1229, name: 'Электроника' },
    'спорт': { id: 1408, name: 'Спорт и отдых' },
    'красота': { id: 518, name: 'Красота и здоровье' },
    'дом': { id: 14727, name: 'Товары для дома' },
    'авто': { id: 1347, name: 'Автотовары' }
  };

  const combined = `${aiCategory} ${productType}`.toLowerCase();
  
  for (const [key, category] of Object.entries(categoryMappings)) {
    if (combined.includes(key)) {
      return category;
    }
  }

  return { id: 14727, name: 'Товары для дома' };
}

/**
 * Подготовка характеристик товара
 */
function prepareCharacteristics(
  geminiAnalysis: ProductAnalysisResult, 
  wbApiChars: any[], 
  dimensions: any,
  referenceData?: any
): ProductCharacteristic[] {
  console.log('🔧 Собираем характеристики...');
  
  const charMap = new Map<number, string>();

  // 1. Характеристики от ИИ
  if (geminiAnalysis.characteristics) {
    geminiAnalysis.characteristics.forEach(char => {
      if (char.id && char.value) {
        charMap.set(Number(char.id), String(char.value));
      }
    });
  }

  // 2. Размеры (обязательные)
  if (dimensions.length) charMap.set(16999, String(dimensions.length));
  if (dimensions.width) charMap.set(17001, String(dimensions.width));
  if (dimensions.height) charMap.set(17003, String(dimensions.height));
  if (dimensions.weight) charMap.set(17005, String(Math.round(dimensions.weight * 1000)));

  // 3. Основные характеристики из ИИ
  if (geminiAnalysis.visualAnalysis) {
    const visual = geminiAnalysis.visualAnalysis;
    
    if (visual.primaryColor && !charMap.has(14863)) {
      charMap.set(14863, visual.primaryColor);
    }
    if (visual.material && !charMap.has(7174)) {
      charMap.set(7174, visual.material);
    }
  }

  // 4. Характеристики из аналога
  if (referenceData?.characteristics) {
    referenceData.characteristics.forEach((char: any) => {
      const mappedId = mapCharacteristicName(char.name);
      if (mappedId && !charMap.has(mappedId)) {
        charMap.set(mappedId, String(char.value));
      }
    });
  }

  // 5. Обязательные значения по умолчанию
  const defaults = {
    8229: referenceData?.brand || 'NoName', // Бренд
    7919: 'Россия', // Страна производства
  };

  Object.entries(defaults).forEach(([id, value]) => {
    const numId = Number(id);
    if (!charMap.has(numId)) {
      charMap.set(numId, String(value));
    }
  });

  const result = Array.from(charMap, ([id, value]) => ({ id, value }));
  console.log(`✅ Подготовлено ${result.length} характеристик`);
  
  return result;
}

/**
 * Мапинг названий характеристик в WB ID
 */
function mapCharacteristicName(name: string): number | null {
  const nameLower = name.toLowerCase();
  
  const mapping: Record<string, number> = {
    'цвет': 14863,
    'основной цвет': 14863,
    'материал': 7174,
    'бренд': 8229,
    'страна производства': 7919,
    'пол': 7183,
    'состав': 14866,
    'сезон': 14865,
    'размер': 14864
  };

  for (const [key, id] of Object.entries(mapping)) {
    if (nameLower.includes(key)) {
      return id;
    }
  }

  return null;
}

/**
 * Подготовка данных карточки для WB
 */
function prepareCardData(
  geminiAnalysis: ProductAnalysisResult, 
  category: WBCategory,
  characteristics: ProductCharacteristic[], 
  productId: string,
  referenceData?: any
): WBCardData {
  // Генерируем уникальный артикул
  const vendorCode = `AI-${Date.now().toString().slice(-6)}-${productId.substring(0, 4).toUpperCase()}`;
  
  // Оптимизируем название
  let title = geminiAnalysis.seoTitle || geminiAnalysis.visualAnalysis?.productType || 'Товар';
  
  // Добавляем ключевые слова из аналога если заголовок короткий
  if (referenceData?.name && title.length < 40) {
    const refWords = referenceData.name
      .split(/[\s\-\/,().]+/)
      .filter((word: string) => word.length > 3 && !title.toLowerCase().includes(word.toLowerCase()))
      .slice(0, 2);
    
    if (refWords.length > 0) {
      title = `${title} ${refWords.join(' ')}`;
    }
  }

  title = title.substring(0, 60);

  // Оптимизируем описание
  let description = geminiAnalysis.seoDescription || 'Качественный товар по доступной цене';
  
  // Добавляем информацию из аналога
  if (referenceData?.description && description.length < 500) {
    const benefits = extractBenefits(referenceData.description);
    if (benefits.length > 0) {
      description += '\n\n' + benefits.slice(0, 3).join('\n');
    }
  }

  description = description.substring(0, 1000);

  // Определяем бренд
  let brand = characteristics.find(c => c.id === 8229)?.value || 'NoName';
  if (referenceData?.brand && referenceData.brand !== 'NoName') {
    brand = referenceData.brand;
  }

  return {
    vendorCode,
    title,
    description,
    brand,
    imtId: category.id,
    characteristics: characteristics.map(char => ({
      id: Number(char.id),
      value: String(char.value)
    }))
  };
}

/**
 * Извлечение преимуществ из описания
 */
function extractBenefits(description: string): string[] {
  return description
    .split(/[.!?]+/)
    .filter(sentence => 
      sentence.includes('✅') || 
      sentence.includes('+') || 
      /качеств|преимущ|особенн|удобн|практичн/i.test(sentence)
    )
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 10 && sentence.length < 100)
    .slice(0, 3);
}