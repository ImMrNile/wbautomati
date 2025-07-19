// src/app/api/products/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Cabinet } from '@prisma/client';
import { WB_API_ENDPOINTS } from '../../../../../../lib/config/wbApiConfig';
const prisma = new PrismaClient();


interface WBCreateCardRequest {
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

// POST - публикация готового товара в Wildberries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, cabinetId, customData } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'ID продукта обязателен' },
        { status: 400 }
      );
    }

    // Получаем продукт из БД
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        productCabinets: {
          include: { cabinet: true }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Продукт не найден' },
        { status: 404 }
      );
    }

    if (product.status !== 'READY') {
      return NextResponse.json(
        { error: 'Продукт еще не готов к публикации' },
        { status: 400 }
      );
    }

    // Получаем кабинет для публикации
    let cabinet: Cabinet | null = null;
    if (cabinetId) {
      cabinet = await prisma.cabinet.findUnique({
        where: { id: cabinetId }
      });
    } else if (product.productCabinets.length > 0) {
      cabinet = product.productCabinets[0].cabinet;
    }

    if (!cabinet || !cabinet.isActive) {
      return NextResponse.json(
        { error: 'Не найден активный кабинет для публикации' },
        { status: 400 }
      );
    }

    // Обновляем статус на "публикация"
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'PUBLISHING' }
    });

    try {
      // Подготавливаем данные для WB
      const wbData = await prepareDataForWB(product, customData);
      
      // Создаем карточку в Wildberries
      const publishResult = await createWBCard(wbData, cabinet.apiToken);

      if (publishResult.success) {
        // Обновляем продукт после успешной публикации
        await prisma.product.update({
          where: { id: productId },
          data: {
            status: 'PUBLISHED',
            wbNmId: publishResult.nmId,
            publishedAt: new Date(),
            wbData: publishResult.cardData as any
          }
        });

        // Связываем с кабинетом, если еще не связан
        if (cabinetId && !product.productCabinets.find(pc => pc.cabinetId === cabinetId)) {
          await prisma.productCabinet.create({
            data: {
              productId,
              cabinetId
            }
          });
        }

        return NextResponse.json({
          success: true,
          nmId: publishResult.nmId,
          message: 'Товар успешно опубликован в Wildberries',
          productUrl: `https://www.wildberries.ru/catalog/${publishResult.nmId}/detail.aspx`
        });

      } else {
        // Обновляем статус на ошибку
        await prisma.product.update({
          where: { id: productId },
          data: {
            status: 'ERROR',
            errorMessage: publishResult.error
          }
        });

        return NextResponse.json(
          { error: publishResult.error },
          { status: 400 }
        );
      }

    } catch (error) {
      // Обновляем статус на ошибку
      await prisma.product.update({
        where: { id: productId },
        data: {
          status: 'ERROR',
          errorMessage: 'Ошибка при публикации в Wildberries'
        }
      });

      throw error;
    }

  } catch (error) {
    console.error('Ошибка публикации товара:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Подготовка данных для API Wildberries
async function prepareDataForWB(product: any, customData?: any) {
  const aiCharacteristics = product.aiCharacteristics as any;
  const referenceData = product.referenceData as any;

  // Генерируем артикул, если не указан
  const vendorCode = customData?.vendorCode || `AI-${product.id.substring(0, 8)}`;

  // Используем ИИ-генерированное название или кастомное
  const title = customData?.title || product.generatedName || product.originalName;

  // Используем ИИ-описание или кастомное
  const description = customData?.description || product.seoDescription || 'Качественный товар';

  // Определяем бренд из аналога или используем дефолтный
  const brand = customData?.brand || referenceData?.brand || 'NoName';

  // Определяем категорию
  let categoryId = customData?.categoryId;
  if (!categoryId && referenceData?.category) {
    categoryId = await getCategoryIdByName(referenceData.category);
  }
  if (!categoryId) {
    categoryId = 14727; // Дефолтная категория "Товары для дома"
  }

  // Подготавливаем характеристики
  const characteristics: Array<{ id: number; value: any }> = [];

  // Добавляем характеристики из ИИ-анализа
  if (aiCharacteristics?.vision) {
    if (aiCharacteristics.vision.color) {
      characteristics.push({
        id: 14863, // Основной цвет
        value: aiCharacteristics.vision.color
      });
    }
    if (aiCharacteristics.vision.material) {
      characteristics.push({
        id: 14864, // Материал верха
        value: aiCharacteristics.vision.material
      });
    }
  }

  // Добавляем характеристики из аналога
  if (referenceData?.characteristics) {
    for (const char of referenceData.characteristics) {
      const mappedChar = mapCharacteristicToWB(char);
      if (mappedChar) {
        characteristics.push(mappedChar);
      }
    }
  }

  // Добавляем кастомные характеристики
  if (customData?.characteristics) {
    characteristics.push(...customData.characteristics);
  }

  // Минимальные обязательные характеристики
  if (characteristics.length === 0) {
    characteristics.push({
      id: 14863, // Основной цвет
      value: aiCharacteristics?.vision?.color || "не указан"
    });
  }

  return {
    vendorCode,
    title: title.substring(0, 60), // WB лимит
    description: description.substring(0, 1000), // WB лимит
    brand,
    imtId: categoryId,
    characteristics
  };
}

// Создание карточки в Wildberries
async function createWBCard(cardData: WBCreateCardRequest, apiToken: string): Promise<{
  success: boolean;
  nmId?: number;
  cardData?: any;
  error?: string;
}> {
  try {
  const response = await fetch(WB_API_ENDPOINTS.uploadCard, {  method: 'POST',
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
        cardData: data[0]
      };
    } else {
      return {
        success: false,
        error: data[0]?.error || data.message || 'Неизвестная ошибка WB API'
      };
    }

  } catch (error) {
    console.error('Ошибка API Wildberries:', error);
    return {
      success: false,
      error: 'Ошибка подключения к API Wildberries'
    };
  }
}

// Получение ID категории по названию
async function getCategoryIdByName(categoryName: string): Promise<number | null> {
  try {
    const response = await fetch(WB_API_ENDPOINTS.getAllCategories, {     method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return null;

    const categories = await response.json();
    const category = categories.find((cat: any) => 
      cat.objectName?.toLowerCase().includes(categoryName.toLowerCase())
    );

    return category?.objectId || null;

  } catch (error) {
    console.error('Ошибка получения категорий:', error);
    return null;
  }
}

// Маппинг характеристик из аналога в формат WB
function mapCharacteristicToWB(characteristic: any): { id: number; value: string } | null {
  const charMap: { [key: string]: number } = {
    'цвет': 14863,
    'материал': 14864,
    'размер': 14865,
    'вес': 14866,
    'страна производства': 14867,
    'состав': 14868,
    'бренд': 14869,
    'коллекция': 14870,
    'сезон': 14871,
    'пол': 14872,
    'возраст': 14873
  };

  const lowerName = characteristic.name?.toLowerCase();
  for (const [key, id] of Object.entries(charMap)) {
    if (lowerName?.includes(key)) {
      return {
        id,
        value: characteristic.value?.toString() || ''
      };
    }
  }

  return null;
}