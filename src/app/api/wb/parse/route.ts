// app/api/wb/parse/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { wbParser } from '../../../../../lib/services/wbParser';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL товара обязателен' },
        { status: 400 }
      );
    }

    // Извлекаем ID товара из URL
    const productId = wbParser.extractProductId(url);
    
    if (!productId) {
      return NextResponse.json(
        { error: 'Неверный формат ссылки Wildberries' },
        { status: 400 }
      );
    }

    // Получаем данные товара
    const productData = await wbParser.getProductData(productId);
    
    if (!productData) {
      return NextResponse.json(
        { error: 'Товар не найден или недоступен' },
        { status: 404 }
      );
    }

    // Возвращаем спарсенные данные
    return NextResponse.json({
      success: true,
      data: productData
    });

  } catch (error) {
    console.error('Ошибка парсинга WB:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении данных товара' },
      { status: 500 }
    );
  }
}

// Получение трендовых товаров или поиск по запросу
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    let results = [];

    if (query) {
      // Анализируем SEO ключевые слова
      results = await wbParser.analyzeSEOKeywords(query);
      
      return NextResponse.json({
        success: true,
        data: results,
        type: 'keywords'
      });
    } else if (category) {
      // Получаем трендовые товары по категории
      results = await wbParser.getTrendingProducts(category);
      
      return NextResponse.json({
        success: true,
        data: results.slice(0, limit),
        type: 'trending',
        count: results.length
      });
    } else {
      // Получаем общие трендовые товары
      results = await wbParser.getTrendingProducts();
      
      return NextResponse.json({
        success: true,
        data: results.slice(0, limit),
        type: 'trending',
        count: results.length
      });
    }

  } catch (error) {
    console.error('Ошибка получения данных WB:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении данных' },
      { status: 500 }
    );
  }
}