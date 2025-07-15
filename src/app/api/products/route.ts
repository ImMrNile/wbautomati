import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { toPrismaJson, toPrismaNullableJson } from '../../../../lib/utils/json';
import { wbParser } from '../../../../lib/services/wbParser';
import { uploadService } from '../../../../lib/services/uploadService';
import { geminiService } from '../../../../lib/services/geminiService';
import { WBCharacteristicsHelper, WB_CHARACTERISTICS_IDS } from '../../../../lib/utils/wbCharacteristics';
import { ErrorHandler, ProcessLogger, ValidationUtils, ErrorCode } from '../../../../lib/utils/errorHandler';
import { ProductStatus } from '../../../../lib/types/gemini';

const prisma = new PrismaClient();

// Создание нового продукта и его ИИ-анализ
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const originalName = formData.get('name') as string;
    const image = formData.get('image') as File;
    const dimensions = JSON.parse(formData.get('dimensions') as string);
    const price = parseFloat(formData.get('price') as string);
    const referenceUrl = formData.get('referenceUrl') as string | null;
    const cabinetId = formData.get('cabinetId') as string;
    const autoPublish = formData.get('autoPublish') === 'true';
    
    // Валидация входных данных
    const validationResult = ValidationUtils.validateProductInput({
      name: originalName,
      image,
      price,
      cabinetId,
      dimensions
    });
    
    if (!validationResult.valid) {
      return NextResponse.json(
        { 
          error: validationResult.errors.join(', '),
          code: ErrorCode.INVALID_INPUT
        },
        { status: 400 }
      );
    }

    // Валидация изображения
    const imageValidation = ValidationUtils.validateImage(image);
    if (!imageValidation.valid) {
      return NextResponse.json(
        { 
          error: imageValidation.error,
          code: ErrorCode.FILE_INVALID_FORMAT
        },
        { status: 400 }
      );
    }

    // Проверяем кабинет
    const cabinet = await prisma.cabinet.findUnique({
      where: { id: cabinetId }
    });

    if (!cabinet || !cabinet.isActive) {
      return NextResponse.json(
        { 
          error: 'Выбранный кабинет не найден или неактивен',
          code: ErrorCode.WB_UNAUTHORIZED
        },
        { status: 400 }
      );
    }

    // Валидация токена WB
    const tokenValidation = ValidationUtils.validateWBToken(cabinet.apiToken);
    if (!tokenValidation.valid) {
      return NextResponse.json(
        { 
          error: tokenValidation.error,
          code: ErrorCode.WB_UNAUTHORIZED
        },
        { status: 400 }
      );
    }

    let referenceData = null;

    // Если указана ссылка на аналог - парсим данные
    if (referenceUrl && referenceUrl.trim()) {
      try {
        const productId = wbParser.extractProductId(referenceUrl);
        if (productId) {
          referenceData = await wbParser.getProductData(productId);
          console.log('Данные аналога получены:', referenceData?.name);
        }
      } catch (error) {
        console.error('Ошибка парсинга аналога:', error);
        // Продолжаем без данных аналога
      }
    }

    // Загружаем изображение
    const imageUrl = await uploadImageToStorage(image);

    // Создаем продукт в БД
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

    // Создаем связь с кабинетом
    await prisma.productCabinet.create({
      data: {
        productId: product.id,
        cabinetId: cabinetId,
        isSelected: true
      }
    });

    // Запускаем полную ИИ-обработку и автопубликацию
    processProductWithGeminiAI(product.id, originalName, imageUrl, dimensions, price, referenceData, cabinet, autoPublish);

    return NextResponse.json({
      id: product.id,
      status: 'processing',
      message: 'Продукт создан и отправлен на полную обработку ИИ',
      hasReference: !!referenceData,
      referenceName: referenceData?.name || null,
      autoPublish
    });

  } catch (error: any) {
    const handledError = ErrorHandler.handleError(error, { endpoint: 'POST /api/products' });
    
    return NextResponse.json(
      { 
        error: handledError.userMessage,
        code: error.code || ErrorCode.UNKNOWN
      },
      { status: 500 }
    );
  }
}

// Получение списка продуктов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const where = status ? { status: status as any } : {};

    const products = await prisma.product.findMany({
      where,
      include: {
        productCabinets: {
          include: {
            cabinet: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const total = await prisma.product.count({ where });

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Ошибка получения продуктов:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Функция полной обработки продукта с Gemini AI и публикацией в WB
async function processProductWithGeminiAI(
  productId: string, 
  name: string, 
  imageUrl: string, 
  dimensions: any,
  price: number,
  referenceData: any, 
  cabinet: any,
  autoPublish: boolean = false
) {
  const logger = new ProcessLogger(productId);
  
  try {
    logger.logStep('START', 'Начинаем обработку продукта с помощью Gemini AI');

    // Шаг 1: Полный анализ товара с помощью Gemini
    logger.logStep('GEMINI_ANALYSIS', 'Запускаем анализ товара с помощью Gemini');
    
    const analysisInput = {
      productName: name,
      images: [imageUrl],
      referenceData: referenceData,
      dimensions: {
        length: dimensions.length?.toString(),
        width: dimensions.width?.toString(),
        height: dimensions.height?.toString(),
        weight: dimensions.weight?.toString()
      },
      price: price
    };

    const geminiAnalysis = await geminiService.analyzeProductForWB(analysisInput);
    logger.logStep('GEMINI_ANALYSIS', 'Анализ Gemini завершен успешно');

    // Шаг 2: Получение категорий WB
    logger.logStep('WB_CATEGORIES', 'Получаем категории Wildberries');
    const wbCategories = await getWBCategories(cabinet.apiToken);
    
    if (!wbCategories || wbCategories.length === 0) {
      throw ErrorHandler.createProcessingError(
        'Не удалось получить категории WB',
        ErrorCode.WB_API,
        productId,
        'WB_CATEGORIES'
      );
    }

    // Шаг 3: Поиск лучшей категории
    logger.logStep('CATEGORY_MATCHING', 'Подбираем лучшую категорию');
    const bestCategory = await findBestCategoryWithGemini(geminiAnalysis, wbCategories);
    
    // Шаг 4: Получение характеристик для выбранной категории
    logger.logStep('CATEGORY_CHARACTERISTICS', 'Получаем характеристики категории');
    const categoryCharacteristics = await getCategoryCharacteristics(bestCategory.id, cabinet.apiToken);
    
    // Шаг 5: Оптимизация характеристик
    logger.logStep('OPTIMIZE_CHARACTERISTICS', 'Оптимизируем характеристики');
    const optimizedCharacteristics = await optimizeCharacteristicsWithGemini(
      geminiAnalysis.characteristics,
      categoryCharacteristics,
      geminiAnalysis.visualAnalysis,
      dimensions
    );

    // Шаг 6: Подготовка данных для WB API
    logger.logStep('PREPARE_WB_DATA', 'Подготавливаем данные для WB API');
    const wbCardData = await prepareWBCardData(
      geminiAnalysis,
      bestCategory,
      optimizedCharacteristics,
      productId
    );

    // Обновляем продукт в БД с результатами ИИ
    logger.logStep('UPDATE_DATABASE', 'Сохраняем результаты анализа в БД');
    await prisma.product.update({
      where: { id: productId },
      data: {
        generatedName: geminiAnalysis.seoTitle,
        seoDescription: geminiAnalysis.seoDescription,
        suggestedCategory: bestCategory.name,
        colorAnalysis: geminiAnalysis.visualAnalysis.primaryColor,
        aiCharacteristics: toPrismaJson({
          geminiAnalysis: geminiAnalysis,
          wbData: wbCardData,
          category: bestCategory,
          keywords: geminiAnalysis.suggestedKeywords,
          competitiveAdvantages: geminiAnalysis.competitiveAdvantages,
          marketingInsights: geminiAnalysis.marketingInsights
        }),
        status: autoPublish ? ProductStatus.PUBLISHING : ProductStatus.READY
      }
    });

    // Шаг 7: Автопубликация если включена
    if (autoPublish) {
      logger.logStep('PUBLISH_TO_WB', 'Публикуем товар в Wildberries');
      const publishResult = await publishToWildberries(wbCardData, cabinet.apiToken);
      
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
          where: { productId },
          data: { isPublished: true, wbCardId: publishResult.nmId?.toString() }
        });

        logger.logSuccess(`Продукт успешно опубликован в WB. NM ID: ${publishResult.nmId}`);
      } else {
        const publishError = ErrorHandler.createProcessingError(
          `Ошибка публикации в WB: ${publishResult.error}`,
          ErrorCode.WB_API,
          productId,
          'PUBLISH_TO_WB'
        );
        throw publishError;
      }
    }

    logger.logSuccess('Обработка продукта завершена успешно');

  } catch (error: any) {
    logger.logError(error, error.step || 'UNKNOWN_STEP');
    
    const handledError = ErrorHandler.handleError(error, { productId });
    
    await prisma.product.update({
      where: { id: productId },
      data: { 
        status: handledError.status,
        errorMessage: handledError.userMessage
      }
    });
  }
}

// Получение категорий Wildberries
async function getWBCategories(apiToken: string) {
  try {
    const response = await fetch('https://suppliers-api.wildberries.ru/content/v2/object/all', {
      method: 'GET',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`WB API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка получения категорий WB:', error);
    return [];
  }
}

// Поиск лучшей категории для товара с помощью Gemini
async function findBestCategoryWithGemini(geminiAnalysis: any, wbCategories: any[]) {
  try {
    // Используем рекомендованную категорию от Gemini для поиска в WB
    const recommendedCategory = geminiAnalysis.wbCategory;
    
    // Ищем наиболее подходящую категорию в списке WB
    const categoryKeywords = recommendedCategory.toLowerCase().split(' > ').join(' ').split(' ');
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const category of wbCategories) {
      const categoryName = category.objectName.toLowerCase();
      let score = 0;
      
      // Подсчитываем совпадения ключевых слов
      for (const keyword of categoryKeywords) {
        if (categoryName.includes(keyword)) {
          score += 1;
        }
      }
      
      // Также учитываем тип товара из анализа
      const productType = geminiAnalysis.visualAnalysis.productType.toLowerCase();
      if (categoryName.includes(productType)) {
        score += 2;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = category;
      }
    }
    
    if (bestMatch) {
      return {
        id: bestMatch.objectId,
        name: bestMatch.objectName,
        confidence: Math.min(bestScore * 20, 100),
        reason: `Найдена категория с ${bestScore} совпадениями`
      };
    }

    // Если не найдена, возвращаем дефолтную
    return {
      id: 14727,
      name: "Товары для дома",
      confidence: 50,
      reason: "Дефолтная категория"
    };

  } catch (error) {
    console.error('Ошибка поиска категории:', error);
    return {
      id: 14727,
      name: "Товары для дома",
      confidence: 30,
      reason: "Ошибка поиска"
    };
  }
}

// Получение характеристик категории
async function getCategoryCharacteristics(categoryId: number, apiToken: string) {
  try {
    const response = await fetch(`https://suppliers-api.wildberries.ru/content/v2/object/characteristics/${categoryId}`, {
      method: 'GET',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`Не удалось получить характеристики для категории ${categoryId}`);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка получения характеристик:', error);
    return [];
  }
}

// Оптимизация характеристик от Gemini под требования WB API
async function optimizeCharacteristicsWithGemini(
  geminiCharacteristics: any[],
  wbCharacteristics: any[],
  visualAnalysis: any
) {
  try {
    const optimizedCharacteristics = [];
    
    // Сопоставляем характеристики от Gemini с доступными в WB
    for (const geminiChar of geminiCharacteristics) {
      const wbChar = wbCharacteristics.find(wb => wb.id === geminiChar.id);
      
      if (wbChar) {
        optimizedCharacteristics.push({
          id: geminiChar.id,
          value: geminiChar.value
        });
      }
    }

    // Добавляем обязательные характеристики WB, если их нет
    const requiredCharacteristics = wbCharacteristics.filter(char => char.required);
    
    for (const required of requiredCharacteristics) {
      const exists = optimizedCharacteristics.find(char => char.id === required.id);
      
      if (!exists) {
        optimizedCharacteristics.push({
          id: required.id,
          value: getDefaultCharacteristicValue(required, visualAnalysis)
        });
      }
    }

    return optimizedCharacteristics;

  } catch (error) {
    console.error('Ошибка оптимизации характеристик:', error);
    return geminiCharacteristics;
  }
}

// Подготовка данных для WB API
async function prepareWBCardData(
  geminiAnalysis: any, 
  category: any, 
  characteristics: any[], 
  productId: string
) {
  // Форматируем характеристики для WB API
  const formattedCharacteristics = WBCharacteristicsHelper.formatForWBAPI(characteristics);
  
  // Оптимизируем характеристики под категорию
  const optimizedCharacteristics = WBCharacteristicsHelper.optimizeForCategory(
    formattedCharacteristics,
    category.id
  );

  return {
    vendorCode: `AI-${productId.substring(0, 8)}`,
    title: geminiAnalysis.seoTitle,
    description: geminiAnalysis.seoDescription,
    brand: WBCharacteristicsHelper.getCharacteristicById(
      optimizedCharacteristics, 
      WB_CHARACTERISTICS_IDS.BRAND
    )?.value || 'NoName',
    imtId: category.id,
    characteristics: optimizedCharacteristics
  };
}

// Дефолтные значения для характеристик с учетом анализа Gemini
function getDefaultCharacteristicValue(characteristic: any, visualAnalysis: any): string {
  // Используем утилиту для получения дефолтного значения
  const defaultValue = WBCharacteristicsHelper.getDefaultValue(characteristic.id);
  
  // Переопределяем значения на основе анализа
  switch (characteristic.id) {
    case WB_CHARACTERISTICS_IDS.MAIN_COLOR:
      return visualAnalysis?.primaryColor || defaultValue;
    case WB_CHARACTERISTICS_IDS.MATERIAL:
      return visualAnalysis?.material || defaultValue;
    case WB_CHARACTERISTICS_IDS.BRAND:
      return 'NoName';
    case WB_CHARACTERISTICS_IDS.COUNTRY:
      return 'Россия';
    default:
      return defaultValue;
  }
}

// Публикация в Wildberries
async function publishToWildberries(cardData: any, apiToken: string) {
  try {
    const response = await fetch('https://suppliers-api.wildberries.ru/content/v2/cards/upload', {
      method: 'POST',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([cardData])
    });

    const data = await response.json();

    if (response.ok && data.length > 0 && !data[0].error) {
      return {
        success: true,
        nmId: data[0].nmId,
        data: data[0]
      };
    } else {
      return {
        success: false,
        error: data[0]?.error || data.message || 'Неизвестная ошибка WB API'
      };
    }

  } catch (error) {
    console.error('Ошибка публикации в WB:', error);
    return {
      success: false,
      error: 'Ошибка подключения к API Wildberries'
    };
  }
}

// Загрузка изображения
async function uploadImageToStorage(file: File): Promise<string> {
  try {
    // Валидируем файл
    const validation = uploadService.validateImage(file);
    if (!validation.valid) {
      throw ErrorHandler.createProcessingError(
        validation.error || 'Невалидное изображение',
        ErrorCode.FILE_INVALID_FORMAT,
        undefined,
        'UPLOAD_IMAGE'
      );
    }

    // Загружаем файл
    const filePath = await uploadService.uploadFile(file);
    
    // Возвращаем полный URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}${filePath}`;

  } catch (error: any) {
    console.error('Ошибка загрузки изображения:', error);
    
    // Если это уже ProcessingError, пробрасываем дальше
    if (error.name === 'ProcessingError') {
      throw error;
    }
    
    // Иначе создаем новую ошибку
    throw ErrorHandler.createProcessingError(
      'Ошибка загрузки изображения',
      ErrorCode.FILE_UPLOAD_ERROR,
      undefined,
      'UPLOAD_IMAGE',
      error
    );
  }
}