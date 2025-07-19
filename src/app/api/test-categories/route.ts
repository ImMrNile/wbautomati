// src/app/api/test-categories/route.ts - Тестовый endpoint для проверки логики категорий

import { NextRequest, NextResponse } from 'next/server';

// Копируем типы и функции из основного роута
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
  marketingInsights: {
    pricePosition: string;
    uniqueSellingPoints: string[];
    targetAgeGroup: string;
    seasonality: string;
  };
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

// Тестовые категории
function getTestCategories(): any[] {
  return [
    { objectID: 1229, objectName: 'Электроника', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 5392, objectName: 'Кабели и адаптеры', parentID: 1229, parentName: 'Электроника', isLeaf: true },
    { objectID: 306, objectName: 'Женская одежда', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 566, objectName: 'Мужская одежда', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 14727, objectName: 'Товары для дома', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 1347, objectName: 'Автотовары', parentID: 0, parentName: 'Корень', isLeaf: true },
    { objectID: 1408, objectName: 'Спорт и отдых', parentID: 0, parentName: 'Корень', isLeaf: true }
  ];
}

// Копируем функции логики из основного роута
function findBestCategoryForProduct(
  geminiAnalysis: ProductAnalysisResult,
  wbCategories: any[],
  referenceData?: any
): CategoryMatch {
  console.log('🎯 === ТЕСТ АНАЛИЗА КАТЕГОРИИ ===');
  console.log(`🤖 ИИ предлагает: "${geminiAnalysis.wbCategory}"`);
  console.log(`📦 Тип товара: "${geminiAnalysis.visualAnalysis?.productType}"`);
  
  if (referenceData?.category) {
    console.log(`📋 Категория аналога: "${referenceData.category}"`);
  }

  const matches: CategoryMatch[] = [];

  // 1. ПРИОРИТЕТ 1: Точное совпадение с ИИ категорией
  const aiMatch = findByAICategory(geminiAnalysis.wbCategory, wbCategories);
  if (aiMatch) {
    matches.push(aiMatch);
    console.log(`✅ Найдено точное совпадение с ИИ: ${aiMatch.category.objectName} (${aiMatch.score} баллов)`);
  }

  // 2. ПРИОРИТЕТ 2: Поиск по ключевым словам из названия товара
  const keywordMatches = findByKeywords(
    geminiAnalysis.visualAnalysis?.productType || '',
    geminiAnalysis.visualAnalysis?.categoryKeywords || [],
    wbCategories
  );
  matches.push(...keywordMatches);

  // 3. ПРИОРИТЕТ 3: Категория аналога (только если она релевантна)
  if (referenceData?.category) {
    const referenceMatch = findByReferenceName(referenceData.category, wbCategories, geminiAnalysis);
    if (referenceMatch) {
      matches.push(referenceMatch);
      console.log(`📋 Найдено совпадение с аналогом: ${referenceMatch.category.objectName} (${referenceMatch.score} баллов)`);
    }
  }

  // Сортируем по приоритету: сначала по источнику, потом по скору
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
    console.log(`📊 Источник: ${bestMatch.source}, Оценка: ${bestMatch.score}, Причина: ${bestMatch.reason}`);
    
    return bestMatch;
  }

  // Fallback категория
  console.warn('⚠️ Не найдено подходящих категорий, используем fallback');
  return getFallbackCategory(geminiAnalysis);
}

function findByAICategory(aiCategory: string, categories: any[]): CategoryMatch | null {
  if (!aiCategory || aiCategory.length < 3) return null;

  const aiLower = aiCategory.toLowerCase().trim();
  
  // Точное совпадение
  for (const category of categories) {
    const categoryName = (category.objectName || '').toLowerCase();
    
    if (categoryName === aiLower) {
      return {
        category,
        score: 100,
        reason: 'Точное совпадение с ИИ категорией',
        source: 'ai'
      };
    }
  }

  // Частичное совпадение
  for (const category of categories) {
    const categoryName = (category.objectName || '').toLowerCase();
    
    if (categoryName.includes(aiLower) || aiLower.includes(categoryName)) {
      return {
        category,
        score: 90,
        reason: 'Частичное совпадение с ИИ категорией',
        source: 'ai'
      };
    }
  }

  return null;
}

function findByKeywords(productType: string, categoryKeywords: string[], categories: any[]): CategoryMatch[] {
  const matches: CategoryMatch[] = [];
  
  const electronicsKeywords = [
    'кабель', 'cable', 'провод', 'шнур', 'usb', 'type-c', 'lightning', 'micro',
    'зарядное', 'зарядка', 'charger', 'адаптер', 'adapter', 'переходник',
    'наушники', 'headphones', 'bluetooth', 'колонка', 'speaker',
    'телефон', 'phone', 'смартфон', 'планшет', 'tablet',
    'электрический', 'электронный', 'electric', 'electronic'
  ];

  const searchText = `${productType} ${categoryKeywords.join(' ')}`.toLowerCase();

  // Проверяем электронику
  const electronicsMatches = electronicsKeywords.filter(keyword => 
    searchText.includes(keyword)
  );

  if (electronicsMatches.length > 0) {
    const electronicsCategory = categories.find(cat => 
      cat.objectName.toLowerCase().includes('электроника') ||
      cat.objectID === 1229 ||
      cat.objectName.toLowerCase().includes('кабел')
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

function findByReferenceName(referenceCategoryName: string, categories: any[], geminiAnalysis: ProductAnalysisResult): CategoryMatch | null {
  if (!referenceCategoryName) return null;

  const refLower = referenceCategoryName.toLowerCase();
  const productType = geminiAnalysis.visualAnalysis?.productType?.toLowerCase() || '';

  // НЕ используем "Товары для дома" если товар явно электронный
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

function getFallbackCategory(geminiAnalysis: ProductAnalysisResult): CategoryMatch {
  const productType = geminiAnalysis.visualAnalysis?.productType?.toLowerCase() || '';
  const aiCategory = geminiAnalysis.wbCategory?.toLowerCase() || '';
  
  // Для электроники
  if (productType.includes('кабел') || productType.includes('зарядк') || 
      productType.includes('usb') || aiCategory.includes('электрон')) {
    return {
      category: { objectID: 1229, objectName: 'Электроника', parentID: 0, parentName: '', isLeaf: true },
      score: 45,
      reason: 'Дефолтная категория для электроники',
      source: 'fallback'
    };
  }

  // Общая дефолтная категория
  return {
    category: { objectID: 14727, objectName: 'Товары для дома', parentID: 0, parentName: '', isLeaf: true },
    score: 25,
    reason: 'Общая дефолтная категория',
    source: 'fallback'
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const productName = url.searchParams.get('productName') || 'Кабель Type-C USB-C 1м';
    const aiCategory = url.searchParams.get('aiCategory') || 'Электроника';
    const referenceCategory = url.searchParams.get('referenceCategory') || 'Товары для дома';

    console.log('🧪 === ТЕСТ ЛОГИКИ КАТЕГОРИЙ ===');
    console.log(`📝 Тестируем товар: "${productName}"`);
    console.log(`🤖 ИИ категория: "${aiCategory}"`);
    console.log(`📋 Категория аналога: "${referenceCategory}"`);

    // Создаем mock анализ
    const mockAnalysis: ProductAnalysisResult = {
      wbCategory: aiCategory,
      visualAnalysis: {
        productType: productName,
        primaryColor: 'черный',
        material: 'пластик',
        style: 'современный',
        keyFeatures: ['быстрая зарядка', 'прочный'],
        targetAudience: 'взрослые',
        confidence: 0.9,
        categoryKeywords: ['кабель', 'usb', 'type-c']
      },
      seoTitle: productName,
      seoDescription: `${productName} высокого качества`,
      characteristics: [],
      suggestedKeywords: ['кабель', 'usb', 'type-c'],
      competitiveAdvantages: ['быстрая зарядка', 'надежность'],
      marketingInsights: {
        pricePosition: 'средний',
        uniqueSellingPoints: ['быстрая зарядка'],
        targetAgeGroup: '18-65',
        seasonality: 'круглогодично'
      }
    };

    // Mock данные аналога
    const mockReferenceData = {
      name: 'Кабель USB-C аналог',
      category: referenceCategory,
      brand: 'TestBrand'
    };

    // Получаем тестовые категории
    const categories = getTestCategories();
    
    // Тестируем логику
    const categoryMatch = findBestCategoryForProduct(
      mockAnalysis,
      categories,
      mockReferenceData
    );

    console.log('✅ === РЕЗУЛЬТАТ ТЕСТА ===');
    console.log(`🏆 Финальная категория: ${categoryMatch.category.objectName}`);
    console.log(`📊 Источник: ${categoryMatch.source}`);
    console.log(`💯 Оценка: ${categoryMatch.score}`);

    return NextResponse.json({
      success: true,
      testInput: {
        productName,
        aiCategory,
        referenceCategory
      },
      result: {
        finalCategory: categoryMatch.category.objectName,
        categoryId: categoryMatch.category.objectID,
        source: categoryMatch.source,
        score: categoryMatch.score,
        reason: categoryMatch.reason
      },
      analysis: {
        message: categoryMatch.category.objectName === 'Электроника' 
          ? '✅ ТЕСТ ПРОЙДЕН: Товар правильно определен как Электроника!'
          : `⚠️ ВНИМАНИЕ: Товар определен как "${categoryMatch.category.objectName}" вместо "Электроника"`,
        isCorrect: categoryMatch.category.objectName === 'Электроника',
        logicWorking: categoryMatch.source === 'ai' || categoryMatch.source === 'keywords'
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка тестирования',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testCases = [] } = body;

    const results = [];

    for (const testCase of testCases) {
      const { productName, aiCategory, referenceCategory } = testCase;

      const mockAnalysis: ProductAnalysisResult = {
        wbCategory: aiCategory,
        visualAnalysis: {
          productType: productName,
          primaryColor: 'не определен',
          material: 'не указан',
          style: 'современный',
          keyFeatures: [],
          targetAudience: 'взрослые',
          confidence: 0.8,
          categoryKeywords: productName.toLowerCase().split(' ')
        },
        seoTitle: productName,
        seoDescription: productName,
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

      const mockReferenceData = referenceCategory ? {
        name: 'Аналог',
        category: referenceCategory
      } : null;

      const categories = getTestCategories();
      const categoryMatch = findBestCategoryForProduct(
        mockAnalysis,
        categories,
        mockReferenceData
      );

      results.push({
        input: testCase,
        result: {
          finalCategory: categoryMatch.category.objectName,
          source: categoryMatch.source,
          score: categoryMatch.score,
          reason: categoryMatch.reason
        }
      });
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        electronics: results.filter(r => r.result.finalCategory === 'Электроника').length,
        correctClassification: results.filter(r => 
          (r.input.productName.toLowerCase().includes('кабель') || 
           r.input.productName.toLowerCase().includes('зарядка') ||
           r.input.productName.toLowerCase().includes('usb')) &&
          r.result.finalCategory === 'Электроника'
        ).length
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка массового тестирования',
      details: error.message
    }, { status: 500 });
  }
}