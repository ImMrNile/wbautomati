// src/app/api/products/route.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ с правильным форматом WB API

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Cabinet } from '@prisma/client';
import { hybridWBParser } from '../../../../lib/services/hybridWBParser';
import { uploadService } from '../../../../lib/services/uploadService';
import { geminiService } from '../../../../lib/services/geminiService';

const prisma = new PrismaClient();

// Типы данных
interface ProductAnalysisResult {
  visualAnalysis: {
    productType: string;
    primaryColor: string;
    material: string;
    style: string;
    keyFeatures: string[];
    targetAudience: string;
    confidence: number;
    detailedDescription?: string;
    categoryKeywords?: string[];
  };
  categoryAnalysis?: {
    primaryCategory: string;
    secondaryCategories: string[];
    categoryConfidence: number;
    reasonForCategory: string;
  };
  seoTitle: string;
  seoDescription: string;
  characteristics: { id: number; value: string; }[];
  suggestedKeywords: string[];
  competitiveAdvantages: string[];
  wbCategory: string;
  tnvedCode?: string;
  marketingInsights: {
    pricePosition: string;
    uniqueSellingPoints: string[];
    targetAgeGroup: string;
    seasonality: string;
  };
}

interface WBCardData {
  vendorCode: string;
  title: string;
  description: string;
  brand: string;
  imtId: number;
  characteristics: Array<{
    id: number;
    value: string;
  }>;
}

interface CategoryMatch {
  category: {
    objectID: number;
    objectName: string;
    parentID?: number;
    parentName?: string;
    isLeaf?: boolean;
  };
  score: number;
  reason: string;
  source: 'ai' | 'reference' | 'keywords' | 'fallback';
}

enum ProductStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  ERROR = 'ERROR'
}

// =======================================
// ОСНОВНОЙ POST ENDPOINT
// =======================================

export async function POST(request: NextRequest) {
  let productId: string | null = null;
  
  try {
    const formData = await request.formData();

    // 1. Извлекаем данные
    const originalName = formData.get('name') as string;
    const image = formData.get('image') as File;
    const dimensions = JSON.parse(formData.get('dimensions') as string);
    const price = parseFloat(formData.get('price') as string);
    const referenceUrl = formData.get('referenceUrl') as string | null;
    const cabinetId = formData.get('cabinetId') as string;
    const autoPublish = formData.get('autoPublish') === 'true';
    const packageContents = formData.get('packageContents') as string;

    // 2. Валидация входных данных
    if (!originalName || !image || !price || !cabinetId || !packageContents) {
      return NextResponse.json({ 
        error: 'Все поля, включая комплектацию, обязательны'
      }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ 
        error: 'Цена должна быть больше нуля'
      }, { status: 400 });
    }

    // 3. Проверка кабинета
    const cabinet = await prisma.cabinet.findUnique({ 
      where: { id: cabinetId } 
    });
    
    if (!cabinet || !cabinet.isActive) {
      return NextResponse.json({ 
        error: 'Выбранный кабинет не найден или неактивен'
      }, { status: 400 });
    }

    // 4. Загрузка изображения
    console.log('📤 Загружаем изображение...');
    let imageUrl: string;
    try {
      imageUrl = await uploadService.uploadFile(image);
    } catch (error: any) {
      return NextResponse.json({ 
        error: `Ошибка загрузки изображения: ${error.message}`
      }, { status: 400 });
    }

    // 5. Создание продукта в БД
    const product = await prisma.product.create({
      data: {
        originalName,
        originalImage: imageUrl,
        dimensions: JSON.stringify(dimensions),
        price,
        referenceUrl: referenceUrl || undefined,
        status: ProductStatus.PROCESSING
      }
    });
    productId = product.id;

    // 6. Парсинг товара-аналога (с улучшенной обработкой ошибок)
    let referenceData = null;
    if (referenceUrl && referenceUrl.trim()) {
      try {
        console.log('🔍 Парсим товар-аналог...');
        referenceData = await hybridWBParser.getProductData(referenceUrl);
        
        if (referenceData) {
          await prisma.product.update({
            where: { id: productId },
            data: { referenceData: JSON.stringify(referenceData) }
          });
          console.log('✅ Данные аналога сохранены');
        }
      } catch (error: any) {
        console.warn('⚠️ Ошибка парсинга аналога:', error.message);
        // Не блокируем процесс, если аналог не удалось спарсить
      }
    }

    // 7. Привязка к кабинету
    await prisma.productCabinet.create({
      data: { 
        productId: productId, 
        cabinetId: cabinetId, 
        isSelected: true 
      }
    });

    // 8. Запуск фоновой обработки
    processProductAutonomous(
      productId,
      originalName, 
      imageUrl, 
      dimensions, 
      price, 
      packageContents,
      referenceData, 
      cabinet, 
      autoPublish
    ).catch(error => {
      console.error(`❌ Ошибка фоновой обработки для продукта ${productId}:`, error);
      // Обновляем статус продукта на ERROR
      if (productId) {
        prisma.product.update({
          where: { id: productId },
          data: {
            status: ProductStatus.ERROR,
            errorMessage: error.message || 'Ошибка фоновой обработки'
          }
        }).catch(console.error);
      }
    });

    return NextResponse.json({
      id: productId,
      status: 'processing',
      message: 'Продукт создан и отправлен на автономную обработку',
    });

  } catch (error: any) {
    console.error('❌ Критическая ошибка в POST /api/products:', error);
    
    if (productId) {
      try {
        await prisma.product.update({
          where: { id: productId },
          data: {
            status: ProductStatus.ERROR,
            errorMessage: 'Критическая ошибка сервера в процессе создания.'
          }
        });
      } catch (updateError) {
        console.error('❌ Ошибка обновления статуса продукта:', updateError);
      }
    }
    
    return NextResponse.json({ 
      error: 'Внутренняя ошибка сервера', 
      details: error.message 
    }, { status: 500 });
  }
}

// =======================================
// ФОНОВАЯ ОБРАБОТКА
// =======================================

async function processProductAutonomous(
  productId: string, 
  name: string, 
  imageUrl: string, 
  dimensions: any, 
  price: number,
  packageContents: string,
  referenceData: any, 
  cabinet: Cabinet, 
  autoPublish: boolean = false
) {
  console.log(`🚀 Начинаем автономную обработку продукта ${productId}`);

  try {
    // Шаг 1: ИИ-анализ с запросом ТН ВЭД
    console.log('🤖 Запускаем ИИ-анализ...');
    let geminiAnalysis: ProductAnalysisResult;
    
    try {
      geminiAnalysis = await geminiService.analyzeProductForWB({
        productName: name, 
        images: [imageUrl],
        packageContents,
        referenceData,
        dimensions,
        price
      });
      console.log(`✅ ИИ-анализ завершен. Предложенный ТН ВЭД: ${geminiAnalysis.tnvedCode}`);
    } catch (aiError: any) {
      console.warn('⚠️ Ошибка ИИ-анализа, используем fallback:', aiError.message);
      geminiAnalysis = createFallbackAnalysis(name, price, referenceData);
    }

    // Шаг 2: Получение категорий WB
    console.log('📂 Получаем категории WB...');
    const wbCategories = await getWBCategoriesWithFallback(cabinet.apiToken);
    console.log(`✅ Загружено ${wbCategories.length} категорий`);

    // Шаг 3: Выбор оптимальной категории
    const categoryMatch = findBestCategoryForProduct(
      geminiAnalysis, 
      wbCategories, 
      referenceData
    );

    // Шаг 4: Определение финального ТН ВЭД
    const finalTnvedCode = determineFinalTnvedCode(
      referenceData?.tnved,
      geminiAnalysis.tnvedCode,
      name
    );
    console.log(`💡 Финальный ТН ВЭД: ${finalTnvedCode}`);
    
    // Шаг 5: Подготовка характеристик
    console.log('🔧 Готовим характеристики...');
    const characteristics = prepareProductCharacteristics(
      geminiAnalysis,
      categoryMatch.category,
      dimensions,
      packageContents,
      finalTnvedCode,
      referenceData
    );

    // Шаг 6: Формирование карточки WB
    const wbCardData = prepareWBCardData(
      geminiAnalysis,
      categoryMatch.category,
      characteristics,
      productId,
      referenceData,
      price
    );
    
    // Шаг 7: Обновление продукта в БД
    await prisma.product.update({
      where: { id: productId },
      data: {
        generatedName: wbCardData.title,
        seoDescription: wbCardData.description,
        suggestedCategory: categoryMatch.category.objectName,
        colorAnalysis: geminiAnalysis.visualAnalysis?.primaryColor || 'не определен',
        aiCharacteristics: JSON.stringify({ 
          geminiAnalysis, 
          wbData: wbCardData, 
          category: categoryMatch,
          finalTnvedCode 
        }),
        status: autoPublish ? ProductStatus.PUBLISHING : ProductStatus.READY
      }
    });

    // Шаг 8: Публикация (если требуется)
    if (autoPublish) {
      console.log('📤 Публикуем товар в WB...');
      try {
        const publishResult = await publishToWildberries(wbCardData, cabinet.apiToken);
        
        if (publishResult.success) {
          await prisma.product.update({
            where: { id: productId },
            data: { 
              status: ProductStatus.PUBLISHED, 
              wbNmId: publishResult.nmId, 
              publishedAt: new Date() 
            }
          });
          console.log(`🎉 Товар успешно опубликован! NM ID: ${publishResult.nmId}`);
        } else {
          throw new Error(`Ошибка публикации: ${publishResult.error}`);
        }
      } catch (publishError: any) {
        console.error('❌ Ошибка публикации:', publishError);
        await prisma.product.update({
          where: { id: productId },
          data: { 
            status: ProductStatus.ERROR,
            errorMessage: `Ошибка публикации: ${publishError.message}`
          }
        });
        return;
      }
    }
    
    console.log('🎉 Обработка продукта завершена успешно');

  } catch (error: any) {
    console.error('❌ Ошибка обработки продукта:', error);
    await prisma.product.update({
      where: { id: productId },
      data: { 
        status: ProductStatus.ERROR, 
        errorMessage: error.message || 'Неизвестная ошибка обработки' 
      }
    });
  }
}

// =======================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =======================================

/**
 * Создание fallback анализа при ошибке ИИ
 */
function createFallbackAnalysis(name: string, price: number, referenceData?: any): ProductAnalysisResult {
  const category = determineBasicCategory(name, referenceData);
  
  return {
    seoTitle: name.substring(0, 60),
    seoDescription: `${name} - качественный товар по выгодной цене. Быстрая доставка по России.`,
    wbCategory: category,
    tnvedCode: determineBasicTnved(name),
    visualAnalysis: {
      productType: name,
      primaryColor: 'не определен',
      material: 'не указан',
      style: 'классический',
      keyFeatures: ['качественный', 'долговечный'],
      targetAudience: 'универсальный',
      confidence: 0.5,
      detailedDescription: 'Анализ изображения недоступен',
      categoryKeywords: extractBasicKeywords(name)
    },
    categoryAnalysis: {
      primaryCategory: category,
      secondaryCategories: [],
      categoryConfidence: 50,
      reasonForCategory: 'Определено базовым алгоритмом'
    },
    characteristics: [],
    suggestedKeywords: name.split(' ').filter(word => word.length > 2),
    competitiveAdvantages: ['качественный', 'надежный'],
    marketingInsights: {
      pricePosition: price > 1000 ? 'premium' : 'budget',
      uniqueSellingPoints: ['хорошее качество', 'доступная цена'],
      targetAgeGroup: '18-65',
      seasonality: 'круглогодично'
    }
  };
}

/**
 * Определение базовой категории по названию
 */
function determineBasicCategory(productName: string, referenceData?: any): string {
  const name = productName.toLowerCase();
  
  // Приоритет: электроника
  if (name.includes('кабель') || name.includes('зарядк') || name.includes('usb') || 
      name.includes('type-c') || name.includes('провод') || name.includes('адаптер')) {
    return 'Электроника';
  }
  
  // Автотовары
  if (name.includes('авто') || name.includes('машин') || name.includes('автомобил')) {
    return 'Автотовары';
  }
  
  // Одежда
  if (name.includes('футболк') || name.includes('рубашк') || name.includes('платье')) {
    return 'Одежда и обувь';
  }
  
  // Используем категорию аналога как последний вариант
  if (referenceData?.category && 
      !referenceData.category.toLowerCase().includes('дом')) {
    return referenceData.category;
  }
  
  return 'Электроника'; // Дефолт для неопределенных товаров
}

/**
 * Определение базового ТН ВЭД
 */
function determineBasicTnved(productName: string): string {
  const name = productName.toLowerCase();
  
  if (name.includes('кабель') || name.includes('провод') || name.includes('usb')) {
    return '8544429009'; // Кабели
  }
  
  if (name.includes('зарядк') || name.includes('адаптер')) {
    return '8504409900'; // Зарядные устройства
  }
  
  if (name.includes('наушник')) {
    return '8518300000'; // Наушники
  }
  
  return '8544429009'; // Дефолт
}

/**
 * Извлечение базовых ключевых слов
 */
function extractBasicKeywords(productName: string): string[] {
  const name = productName.toLowerCase();
  const keywords: string[] = [];
  
  if (name.includes('кабель')) keywords.push('кабель');
  if (name.includes('зарядк')) keywords.push('зарядка');
  if (name.includes('usb')) keywords.push('usb');
  if (name.includes('type-c')) keywords.push('type-c');
  
  return keywords;
}

/**
 * Определение финального ТН ВЭД по приоритету
 */
function determineFinalTnvedCode(
  referenceTnved?: string,
  aiTnved?: string, 
  productName?: string
): string {
  // Приоритет 1: ТН ВЭД из аналога
  if (referenceTnved && referenceTnved.length === 10) {
    return referenceTnved;
  }
  
  // Приоритет 2: ТН ВЭД от ИИ
  if (aiTnved && aiTnved.length === 10) {
    return aiTnved;
  }
  
  // Приоритет 3: Определение по названию
  if (productName) {
    return determineBasicTnved(productName);
  }
  
  // Дефолт
  return '8544429009';
}

/**
 * Подготовка характеристик товара
 */
function prepareProductCharacteristics(
  geminiAnalysis: ProductAnalysisResult,
  category: any,
  dimensions: any,
  packageContents: string,
  tnvedCode: string,
  referenceData?: any
): Array<{ id: number; value: string }> {
  const characteristics = [
    { id: 8229, value: referenceData?.brand || 'NoName' }, // Бренд
    { id: 7919, value: 'Россия' }, // Страна производства
    { id: 214, value: tnvedCode }, // ТН ВЭД
    { id: 17031, value: packageContents }, // Комплектация
  ];

  // Размерные характеристики
  if (dimensions.length) {
    characteristics.push({ id: 16999, value: String(dimensions.length) });
  }
  if (dimensions.width) {
    characteristics.push({ id: 17001, value: String(dimensions.width) });
  }
  if (dimensions.height) {
    characteristics.push({ id: 17003, value: String(dimensions.height) });
  }
  if (dimensions.weight) {
    characteristics.push({ id: 17005, value: String(Math.round(dimensions.weight * 1000)) });
  }

  // Цвет
  if (geminiAnalysis.visualAnalysis?.primaryColor && 
      geminiAnalysis.visualAnalysis.primaryColor !== 'не определен') {
    characteristics.push({ 
      id: 14863, 
      value: geminiAnalysis.visualAnalysis.primaryColor 
    });
  }

  return characteristics;
}

/**
 * Поиск лучшей категории для товара
 */
function findBestCategoryForProduct(
  geminiAnalysis: ProductAnalysisResult,
  wbCategories: any[],
  referenceData?: any
): CategoryMatch {
  console.log('🎯 === АНАЛИЗ КАТЕГОРИИ ===');
  console.log(`🤖 ИИ предлагает: "${geminiAnalysis.wbCategory}"`);
  console.log(`📦 Тип товара: "${geminiAnalysis.visualAnalysis?.productType}"`);
  
  if (referenceData?.category) {
    console.log(`📋 Категория аналога: "${referenceData.category}"`);
  }

  const matches: CategoryMatch[] = [];

  // 1. Точное совпадение с ИИ категорией
  const aiMatch = findByAICategory(geminiAnalysis.wbCategory, wbCategories);
  if (aiMatch) {
    matches.push(aiMatch);
    console.log(`✅ Найдено точное совпадение с ИИ: ${aiMatch.category.objectName}`);
  }

  // 2. Поиск по ключевым словам
  const keywordMatches = findByKeywords(
    geminiAnalysis.visualAnalysis?.productType || '',
    geminiAnalysis.visualAnalysis?.categoryKeywords || [],
    wbCategories
  );
  matches.push(...keywordMatches);

  // 3. Категория аналога (если релевантна)
  if (referenceData?.category) {
    const referenceMatch = findByReferenceName(
      referenceData.category, 
      wbCategories, 
      geminiAnalysis
    );
    if (referenceMatch) {
      matches.push(referenceMatch);
    }
  }

  // Сортируем по приоритету источника и скору
  matches.sort((a, b) => {
    const sourcePriority = { 'ai': 4, 'keywords': 3, 'reference': 2, 'fallback': 1 };
    const aPriority = sourcePriority[a.source];
    const bPriority = sourcePriority[b.source];
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    return b.score - a.score;
  });

  // Выбираем лучший результат
  if (matches.length > 0) {
    const bestMatch = matches[0];
    console.log(`🏆 ВЫБРАНА КАТЕГОРИЯ: "${bestMatch.category.objectName}"`);
    console.log(`📊 Источник: ${bestMatch.source}, Оценка: ${bestMatch.score}`);
    return bestMatch;
  }

  // Fallback категория
  console.warn('⚠️ Не найдено подходящих категорий, используем fallback');
  return getFallbackCategory(geminiAnalysis);
}

/**
 * Поиск по ИИ категории
 */
function findByAICategory(aiCategory: string, categories: any[]): CategoryMatch | null {
  if (!aiCategory || aiCategory.length < 3) return null;

  const aiLower = aiCategory.toLowerCase().trim();
  
  for (const category of categories) {
    const categoryName = (category.objectName || '').toLowerCase();
    
    if (categoryName === aiLower || categoryName.includes(aiLower) || aiLower.includes(categoryName)) {
      return {
        category,
        score: categoryName === aiLower ? 100 : 90,
        reason: 'Совпадение с ИИ категорией',
        source: 'ai'
      };
    }
  }

  return null;
}

/**
 * Поиск по ключевым словам
 */
function findByKeywords(
  productType: string, 
  categoryKeywords: string[], 
  categories: any[]
): CategoryMatch[] {
  const matches: CategoryMatch[] = [];
  
  const electronicsKeywords = [
    'кабель', 'cable', 'провод', 'шнур', 'usb', 'type-c', 'lightning',
    'зарядное', 'зарядка', 'charger', 'адаптер', 'adapter',
    'наушники', 'headphones', 'bluetooth', 'колонка', 'speaker'
  ];

  const searchText = `${productType} ${categoryKeywords.join(' ')}`.toLowerCase();

  const electronicsMatches = electronicsKeywords.filter(keyword => 
    searchText.includes(keyword)
  );

  if (electronicsMatches.length > 0) {
    const electronicsCategory = categories.find(cat => 
      cat.objectName.toLowerCase().includes('электроника') ||
      cat.objectID === 1229
    );

    if (electronicsCategory) {
      matches.push({
        category: electronicsCategory,
        score: 85 + (electronicsMatches.length * 5),
        reason: `Ключевые слова электроники: ${electronicsMatches.join(', ')}`,
        source: 'keywords'
      });
    }
  }

  return matches;
}

/**
 * Поиск по названию категории аналога
 */
function findByReferenceName(
  referenceCategoryName: string, 
  categories: any[], 
  geminiAnalysis: ProductAnalysisResult
): CategoryMatch | null {
  if (!referenceCategoryName) return null;

  const refLower = referenceCategoryName.toLowerCase();
  const productType = geminiAnalysis.visualAnalysis?.productType?.toLowerCase() || '';

  // НЕ используем "Товары для дома" для электронных товаров
  if ((refLower.includes('дом') || refLower.includes('товары для дома')) && 
      (productType.includes('кабел') || productType.includes('зарядк') || productType.includes('usb'))) {
    console.log('⚠️ Категория аналога "Товары для дома" проигнорирована для электронного товара');
    return null;
  }

  for (const category of categories) {
    const categoryName = (category.objectName || '').toLowerCase();
    
    if (categoryName.includes(refLower) || refLower.includes(categoryName)) {
      return {
        category,
        score: 60,
        reason: 'Совпадение с категорией аналога',
        source: 'reference'
      };
    }
  }

  return null;
}

/**
 * Fallback категория
 */
function getFallbackCategory(geminiAnalysis: ProductAnalysisResult): CategoryMatch {
  const productType = geminiAnalysis.visualAnalysis?.productType?.toLowerCase() || '';
  const aiCategory = geminiAnalysis.wbCategory?.toLowerCase() || '';
  
  // Для электроники
  if (productType.includes('кабел') || productType.includes('зарядк') || 
      productType.includes('usb') || aiCategory.includes('электрон')) {
    return {
      category: { 
        objectID: 1229, 
        objectName: 'Электроника', 
        parentID: 0, 
        parentName: '', 
        isLeaf: true 
      },
      score: 45,
      reason: 'Дефолтная категория для электроники',
      source: 'fallback'
    };
  }

  // Общая дефолтная категория
  return {
    category: { 
      objectID: 14727, 
      objectName: 'Товары для дома', 
      parentID: 0, 
      parentName: '', 
      isLeaf: true 
    },
    score: 25,
    reason: 'Общая дефолтная категория',
    source: 'fallback'
  };
}

/**
 * Получение категорий WB с fallback
 */
async function getWBCategoriesWithFallback(apiToken?: string): Promise<any[]> {
  try {
    if (apiToken) {
      return await hybridWBParser.getWBCategories(apiToken);
    }
    throw new Error('API токен не предоставлен');
  } catch (error) {
    console.warn('⚠️ Ошибка загрузки категорий, используем статические');
    return getStaticCategories();
  }
}

/**
 * Статические категории
 */
function getStaticCategories(): any[] {
  return [
    { objectID: 1229, objectName: 'Электроника', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 5392, objectName: 'Кабели и адаптеры', parentID: 1229, parentName: 'Электроника', isLeaf: true },
    { objectID: 9836, objectName: 'Зарядные устройства', parentID: 1229, parentName: 'Электроника', isLeaf: true },
    { objectID: 340, objectName: 'Наушники', parentID: 1229, parentName: 'Электроника', isLeaf: true },
    { objectID: 306, objectName: 'Женская одежда', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 566, objectName: 'Мужская одежда', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 14727, objectName: 'Товары для дома', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 1347, objectName: 'Автотовары', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 1408, objectName: 'Спорт и отдых', parentID: 0, parentName: 'Корень', isLeaf: true }
  ];
}

/**
 * Подготовка данных карточки товара с правильным форматом для WB API
 */
function prepareWBCardData(
  geminiAnalysis: ProductAnalysisResult,
  category: { objectID: number; objectName: string },
  characteristics: Array<{ id: number; value: string }>,
  productId: string,
  referenceData?: any,
  price?: number
): WBCardData {
  
  const timestamp = Date.now().toString().slice(-6);
  const productHash = productId.substring(0, 4).toUpperCase();
  const vendorCode = `AI-${timestamp}-${productHash}`;

  let title = geminiAnalysis.seoTitle || geminiAnalysis.visualAnalysis?.productType || 'Товар';
  title = title.substring(0, 60).trim();

  let description = geminiAnalysis.seoDescription || 'Качественный товар по доступной цене';
  description = description.substring(0, 1000).trim();

  let brand = characteristics.find(c => c.id === 8229)?.value || 'NoName';
  if (referenceData?.brand && referenceData.brand.length < 50) {
    brand = referenceData.brand;
  }
  
  // Используем правильный ID предмета для WB API
  const finalImtId = category.objectID;

  const cardData: WBCardData = {
    vendorCode,
    title,
    description,
    brand,
    imtId: finalImtId,
    characteristics: characteristics
      .filter(char => char.value && char.value.trim() !== '') // Убираем пустые характеристики
      .map(char => ({
        id: char.id,
        value: String(char.value).trim()
      }))
  };

  console.log('✅ Карточка подготовлена:');
  console.log(`   📝 Заголовок: ${title}`);
  console.log(`   📂 Категория: ${category.objectName} (ID: ${finalImtId})`);
  console.log(`   🏷️ Артикул: ${vendorCode}`);
  console.log(`   📋 Характеристик: ${cardData.characteristics.length}`);
  
  return cardData;
}

/**
 * Публикация товара в Wildberries с правильным форматом API
 */
async function publishToWildberries(cardData: WBCardData, apiToken: string): Promise<{
  success: boolean;
  nmId?: number;
  data?: any;
  error?: string;
}> {
  try {
    console.log('🌐 Отправляем запрос в WB API...');
    console.log('📦 Данные карточки:', JSON.stringify(cardData, null, 2));
    
    // Правильный endpoint для Content API v2
    const response = await fetch('https://content-api.wildberries.ru/content/v2/cards/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify([cardData]), // Обязательно массив
      signal: AbortSignal.timeout(30000)
    });

    console.log(`📡 Ответ WB API: ${response.status} ${response.statusText}`);

    let responseData;
    const responseText = await response.text();
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Ошибка парсинга ответа WB API:', responseText);
      throw new Error(`Некорректный JSON ответ от WB API: ${responseText}`);
    }

    console.log('📥 Данные ответа WB API:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      const errorMessage = responseData?.errorText || responseData?.message || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    // Проверяем формат ответа
    if (Array.isArray(responseData) && responseData.length > 0) {
      const result = responseData[0];
      
      if (result.error || result.errorText) {
        return {
          success: false,
          error: result.errorText || result.error || 'Неизвестная ошибка WB API'
        };
      }
      
      const nmId = result.nmId || result.nmID;
      if (nmId) {
        console.log(`🎉 Товар успешно создан с NM ID: ${nmId}`);
        return {
          success: true,
          nmId: nmId,
          data: result
        };
      }
    }

    // Если структура ответа неожиданная
    return {
      success: false,
      error: 'Неожиданный формат ответа от WB API',
      data: responseData
    };

  } catch (error: any) {
    console.error('❌ Ошибка подключения к WB API:', error);
    
    // Детальная обработка ошибок
    let errorMessage = 'Ошибка подключения к WB API';
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Таймаут запроса к WB API';
    } else if (error.message.includes('format is incorrect')) {
      errorMessage = 'Некорректный формат данных для WB API';
    } else if (error.message.includes('Authorization')) {
      errorMessage = 'Ошибка авторизации WB API - проверьте токен';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

// =======================================
// GET ENDPOINT
// =======================================

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'categories') {
      const categories = await getWBCategoriesWithFallback();
      return NextResponse.json({
        success: true,
        categories: categories.slice(0, 50),
        total: categories.length
      });
    }

    if (action === 'parser-status') {
      const status = hybridWBParser.getParserStatus();
      return NextResponse.json({
        success: true,
        parserStatus: status,
        recommendations: status.recommendations
      });
    }

    if (action === 'test-category-search') {
      const productName = url.searchParams.get('productName') || 'Кабель Type-C';
      const aiCategory = url.searchParams.get('aiCategory') || 'Электроника';
      
      const mockAnalysis: ProductAnalysisResult = {
        wbCategory: aiCategory,
        tnvedCode: '8544429009',
        visualAnalysis: {
          productType: productName,
          primaryColor: 'черный',
          material: 'пластик',
          style: 'современный',
          keyFeatures: ['быстрая зарядка'],
          targetAudience: 'взрослые',
          confidence: 0.9,
          categoryKeywords: ['кабель', 'usb', 'type-c']
        },
        seoTitle: productName,
        seoDescription: `${productName} высокого качества`,
        characteristics: [],
        suggestedKeywords: [],
        competitiveAdvantages: [],
        marketingInsights: {
          pricePosition: 'средний',
          uniqueSellingPoints: [],
          targetAgeGroup: '18-65',
          seasonality: 'круглогодично'
        }
      };
      
      const categories = await getWBCategoriesWithFallback();
      const categoryMatch = findBestCategoryForProduct(mockAnalysis, categories);
      
      return NextResponse.json({
        success: true,
        result: categoryMatch,
        testData: {
          productName,
          aiCategory,
          finalCategory: categoryMatch.category.objectName,
          source: categoryMatch.source,
          score: categoryMatch.score
        }
      });
    }

    if (action === 'test-card-format') {
      // Тестирование формата карточки
      const testCard: WBCardData = {
        vendorCode: 'TEST-123456',
        title: 'Тестовый товар для проверки формата',
        description: 'Описание тестового товара для проверки корректности формата WB API',
        brand: 'TestBrand',
        imtId: 1229,
        characteristics: [
          { id: 8229, value: 'TestBrand' },
          { id: 7919, value: 'Россия' },
          { id: 214, value: '8544429009' }
        ]
      };

      return NextResponse.json({
        success: true,
        testCard,
        message: 'Формат карточки для тестирования WB API'
      });
    }

    return NextResponse.json({
      error: 'Неизвестное действие. Доступные: categories, parser-status, test-category-search, test-card-format'
    }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Ошибка сервера',
      details: error.message
    }, { status: 500 });
  }
}