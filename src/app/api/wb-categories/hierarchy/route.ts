// src/app/api/wb-categories/hierarchy/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '../../../../../lib/services/categoryService'; // Убедитесь, что путь правильный

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiToken } = body;

    if (!apiToken) {
      return NextResponse.json({ success: false, error: 'API токен обязателен' }, { status: 400 });
    }

    // Загружаем категории и строим дерево
    const categoryTree = await categoryService.loadCategoriesWithHierarchy(apiToken);

    return NextResponse.json({ success: true, data: categoryTree });

  } catch (error: any) {
    console.error('❌ Ошибка получения иерархии категорий:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}