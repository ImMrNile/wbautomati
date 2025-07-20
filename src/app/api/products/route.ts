// src/app/api/products/route.ts - ОБНОВЛЕННЫЙ С ПОДДЕРЖКОЙ АРТИКУЛА И КАТЕГОРИИ

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { uploadService } from '../../../../lib/services/uploadService';
import { enhancedGeminiService } from '../../../../lib/services/enhancedGeminiService';
import { updatedWbApiService } from '../../../../lib/services/updatedWbApiService';
import { WB_API_CONFIG, DEFAULT_VALUES } from '../../../../lib/config/wbApiConfig';
import { 
  WBCategory, 
  normalizeCategory, 
  getCategoryId, 
  WB_CATEGORY_DEFAULTS 
} from '../../../../lib/types/wbTypes';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Извлекаем данные из формы (включая новые поля)
    const cabinetId = formData.get('cabinetId') as string;
    const productName = formData.get('name') as string;
    const price = parseFloat(formData.get('price') as string);
    const packageContents = formData.get('packageContents') as string;
    const referenceUrl = formData.get('referenceUrl') as string;
    const autoPublish = formData.get('autoPublish') === 'true';
    const dimensions = JSON.parse(formData.get('dimensions') as string);
    
    // НОВЫЕ ПОЛЯ
    const vendorCode = formData.get('vendorCode') as string;
    const categoryId = formData.get('categoryId') as string;

    // Валидация обязательных полей
    if (!cabinetId || !productName || !price || !packageContents || !vendorCode) {
      return NextResponse.json({ 
        error: 'Обязательные поля: cabinetId, name, price, packageContents, vendorCode' 
      }, { status: 400 });
    }

    // Проверяем существование кабинета
    const cabinet = await prisma.cabinet.findUnique({ 
      where: { id: cabinetId } 
    });
    
    if (!cabinet || !cabinet.isActive) {
      return NextResponse.json({ 
        error: 'Активный кабинет не найден' 
      }, { status: 400 });
    }

    // Обрабатываем изображение
    const imageFile = formData.get('image') as File | null;
    let imageUrl = '';
    
    if (imageFile) {
      try {
        imageUrl = await uploadService.uploadFile(imageFile);
        console.log('✅ Изображение успешно загружено');
      } catch (error) {
        console.error('❌ Ошибка загрузки изображения:', error);
        return NextResponse.json({ 
          error: 'Ошибка загрузки изображения: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
        }, { status: 400 });
      }
    }

    // Создаем запись продукта в БД
    const product = await prisma.product.create({
      data: {
        originalName: productName,
        originalImage: imageUrl,
        price: price,
        dimensions: JSON.stringify(dimensions),
        referenceUrl: referenceUrl || null,
        status: 'PROCESSING',
        // Сохраняем пользовательские данные
        wbData: JSON.stringify({
          userVendorCode: vendorCode,
          userCategoryId: categoryId
        }),
        productCabinets: {
          create: {
            cabinetId: cabinetId,
            isSelected: true
          }
        }
      },
      include: {
        productCabinets: {
          include: { cabinet: true }
        }
      }
    });

    console.log(`📦 Продукт создан с ID: ${product.id}`);

    // Запускаем обработку асинхронно
    processProductAsync(product.id, {
      imageUrl,
      productName,
      packageContents,
      referenceUrl,
      price,
      dimensions,
      autoPublish,
      cabinet,
      vendorCode, // Новое поле
      categoryId  // Новое поле
    }).catch(error => {
      console.error(`❌ Ошибка асинхронной обработки продукта ${product.id}:`, error);
    });

    return NextResponse.json({ 
      id: product.id, 
      message: 'Продукт создан и отправлен на ИИ-анализ',
      status: 'PROCESSING'
    });

  } catch (error: any) {
    console.error('❌ Ошибка в API /products:', error);
    return NextResponse.json({ 
      error: 'Внутренняя ошибка сервера', 
      details: error.message 
    }, { status: 500 });
  }
}

// Асинхронная обработка продукта (ИСПРАВЛЕНА)
async function processProductAsync(productId: string, data: {
  imageUrl: string;
  productName: string;
  packageContents: string;
  referenceUrl?: string;
  price: number;
  dimensions: any;
  autoPublish: boolean;
  cabinet: any;
  vendorCode: string;    // Новое поле
  categoryId?: string;   // Новое поле
}) {
  try {
    console.log(`🤖 Начинаем обработку продукта ${productId}`);

    // Обновляем статус
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'PROCESSING' }
    });

    // Шаг 1: Комплексный ИИ-анализ
    console.log('📸 Запуск ИИ-анализа...');
    const aiAnalysis = await enhancedGeminiService.analyzeProductComprehensive({
      userImage: data.imageUrl,
      userProductName: data.productName,
      packageContents: data.packageContents,
      referenceUrl: data.referenceUrl,
      price: data.price,
      dimensions: data.dimensions
    });

    console.log('✅ ИИ-анализ завершен:', {
      confidence: aiAnalysis.metadata.confidence,
      categoryId: aiAnalysis.wbContent.categoryId,
      warnings: aiAnalysis.metadata.warnings
    });

    // Шаг 2: Определение категории (приоритет пользовательскому выбору) - ИСПРАВЛЕНО
    console.log('🔍 Определение категории для товара...');
    let validCategoryId: number;
    
    if (data.categoryId) {
      // Пользователь выбрал категорию - используем её
      validCategoryId = parseInt(data.categoryId);
      console.log(`✅ Используем категорию, выбранную пользователем: ${validCategoryId}`);
    } else {
      // Используем категорию от ИИ и проверяем её в WB
      try {
        validCategoryId = aiAnalysis.wbContent.categoryId;
        
        // Проверяем, что категория существует в WB - ИСПРАВЛЕНО
        const categories = await updatedWbApiService.getAllCategories(data.cabinet.id);
        
        // Нормализуем категории для совместимости
        const normalizedCategories = categories.map(normalizeCategory);
        
        const foundCategory = normalizedCategories.find((cat: WBCategory) => {
          return cat.objectID === validCategoryId;
        });
        
        if (!foundCategory) {
          console.warn(`⚠️ Категория ${validCategoryId} от ИИ не найдена в WB`);
          
          // Пытаемся найти подходящую категорию по названию
          const aiCategoryName = "Кабели и адаптеры";
          const bestCategory = await updatedWbApiService.findBestCategory(
            aiCategoryName, 
            data.cabinet.id
          );
          
          if (bestCategory) {
            validCategoryId = getCategoryId(bestCategory);
            console.log(`✅ Найдена альтернативная категория: ${validCategoryId}`);
          } else {
            throw new Error('Не удалось найти подходящую категорию');
          }
        } else {
          console.log(`✅ Категория от ИИ подтверждена: ${validCategoryId}`);
        }
      } catch (error) {
        console.error('❌ Ошибка при определении категории:', error);
        
        // Последний fallback - ищем первую доступную категорию - ИСПРАВЛЕНО
        try {
          const categories = await updatedWbApiService.getAllCategories(data.cabinet.id);
          if (categories.length > 0) {
            const firstCategory = normalizeCategory(categories[0]);
            validCategoryId = firstCategory.objectID || WB_CATEGORY_DEFAULTS.FALLBACK_CATEGORY_ID;
            console.log(`⚠️ Используем первую доступную категорию: ${validCategoryId}`);
          } else {
            throw new Error('Список категорий WB пуст');
          }
        } catch (fallbackError) {
          console.error('❌ Критическая ошибка получения категорий:', fallbackError);
          // Используем дефолтную категорию как последний fallback
          validCategoryId = WB_CATEGORY_DEFAULTS.FALLBACK_CATEGORY_ID;
          console.log(`⚠️ Используем дефолтную категорию: ${validCategoryId}`);
        }
      }
    }

    // Шаг 3: Подготовка данных для WB
    console.log('📝 Подготовка данных для WB API...');
    const wbCardData = updatedWbApiService.prepareCardDataForWB({
      vendorCode: data.vendorCode, // Используем пользовательский артикул
      title: aiAnalysis.wbContent.title,
      description: aiAnalysis.wbContent.description,
      brand: aiAnalysis.referenceAnalysis.extractedBrand || DEFAULT_VALUES.BRAND,
      categoryId: validCategoryId,
      price: data.price,
      dimensions: data.dimensions,
      characteristics: aiAnalysis.wbContent.characteristics,
      packageContents: data.packageContents
    });

    // Сохраняем результаты анализа
    await prisma.product.update({
      where: { id: productId },
      data: {
        generatedName: aiAnalysis.wbContent.title,
        seoDescription: aiAnalysis.wbContent.description,
        aiCharacteristics: JSON.stringify(aiAnalysis),
        suggestedCategory: `${validCategoryId}`,
        colorAnalysis: aiAnalysis.imageAnalysis.primaryColor,
        status: 'READY'
      }
    });

    console.log('💾 Результаты анализа сохранены в БД');

    // Шаг 4: Автопубликация (если включена)
    if (data.autoPublish) {
      console.log('🚀 Запуск автопубликации...');
      
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'PUBLISHING' }
      });

      try {
        const publishResult = await updatedWbApiService.createProductCard(
          wbCardData, 
          data.cabinet.apiToken
        );

        if (publishResult.success) {
          await prisma.product.update({
            where: { id: productId },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              wbData: JSON.stringify({
                ...publishResult.data,
                userVendorCode: data.vendorCode,
                userCategoryId: data.categoryId,
                finalCategoryId: validCategoryId
              })
            }
          });

          console.log(`🎉 Продукт ${productId} успешно опубликован!`);
          
          if (publishResult.taskId) {
            console.log(`📋 Task ID для отслеживания: ${publishResult.taskId}`);
          }
        } else {
          throw new Error(publishResult.error || 'Неизвестная ошибка публикации');
        }
      } catch (publishError) {
        console.error('❌ Ошибка автопубликации:', publishError);
        
        await prisma.product.update({
          where: { id: productId },
          data: {
            status: 'ERROR',
            errorMessage: `Ошибка публикации: ${publishError instanceof Error ? publishError.message : 'Неизвестная ошибка'}`
          }
        });
      }
    }

    console.log(`✅ Обработка продукта ${productId} завершена`);

  } catch (error: any) {
    console.error(`❌ Критическая ошибка обработки продукта ${productId}:`, error);
    
    await prisma.product.update({
      where: { id: productId },
      data: {
        status: 'ERROR',
        errorMessage: error.message || 'Неизвестная ошибка обработки'
      }
    });
  }
}

// GET - получение списка продуктов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinetId = searchParams.get('cabinetId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const whereClause: any = {};
    
    if (cabinetId) {
      whereClause.productCabinets = {
        some: { cabinetId }
      };
    }
    
    if (status) {
      whereClause.status = status;
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        productCabinets: {
          include: { cabinet: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.product.count({ where: whereClause });

    return NextResponse.json({
      products,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error: any) {
    console.error('❌ Ошибка получения продуктов:', error);
    return NextResponse.json({ 
      error: 'Ошибка получения продуктов', 
      details: error.message 
    }, { status: 500 });
  }
}