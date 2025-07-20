// lib/services/enhancedGeminiService.ts - УЛУЧШЕННЫЙ СЕРВИС ИИ ДЛЯ АНАЛИЗА ТОВАРОВ

import OpenAI from 'openai';
import { WB_API_CONFIG, DEFAULT_VALUES } from '../config/wbApiConfig';

// Результат анализа от ИИ
export interface EnhancedAiAnalysisResult {
  // Анализ изображения пользователя
  imageAnalysis: {
    productType: string;
    primaryColor: string;
    secondaryColors: string[];
    materials: string[];
    style: string;
    keyFeatures: string[];
    estimatedSize: string;
    condition: string;
    confidence: number;
    detectedText?: string;
    productCategory: string;
  };
  
  // Анализ товара-аналога
  referenceAnalysis: {
    extractedBrand: string;
    extractedCategory: string;
    extractedCharacteristics: { name: string; value: string }[];
    priceRange: string;
    marketPosition: string;
    qualityScore: number;
  };
  
  // Сгенерированный контент для WB
  wbContent: {
    title: string;
    description: string;
    characteristics: Array<{ id: number; value: string }>;
    categoryId: number;
    keywords: string[];
    seoKeywords: string[];
    sellingPoints: string[];
  };
  
  // Мета-информация
  metadata: {
    processingTime: number;
    confidence: number;
    suggestions: string[];
    warnings: string[];
    aiModel: string;
    analysisVersion: string;
  };
}

// Входные данные для анализа
interface EnhancedAnalysisInput {
  userImage: string; // base64 или URL изображения пользователя
  userProductName: string;
  packageContents: string;
  referenceUrl?: string;
  price: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
}

export class EnhancedGeminiService {
  private openai: OpenAI;
  private model: string;
  private visionModel: string;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY не найден в переменных окружения');
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    this.visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o'; // Модель с поддержкой изображений
  }

  async analyzeProductComprehensive(input: EnhancedAnalysisInput): Promise<EnhancedAiAnalysisResult> {
    const startTime = Date.now();
    console.log(`🤖 Начинаем комплексный ИИ-анализ продукта: ${input.userProductName}`);

    try {
      // Шаг 1: Глубокий анализ изображения пользователя
      console.log('📸 Глубокий анализ изображения пользователя...');
      const imageAnalysis = await this.analyzeUserImageAdvanced(input.userImage, input.userProductName, input.dimensions);

      // Шаг 2: Анализ товара-аналога (если есть ссылка)
      let referenceAnalysis = null;
      if (input.referenceUrl) {
        console.log('🔍 Анализ товара-аналога...');
        referenceAnalysis = await this.analyzeReferenceProduct(input.referenceUrl);
      }

      // Шаг 3: Синтез данных и генерация продающего контента для WB
      console.log('⚡ Генерация продающего контента для Wildberries...');
      const wbContent = await this.generateAdvancedWBContent({
        imageAnalysis,
        referenceAnalysis,
        userInput: input
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ Анализ завершен за ${processingTime}мс`);

      return {
        imageAnalysis,
        referenceAnalysis: referenceAnalysis || this.getDefaultReferenceAnalysis(),
        wbContent,
        metadata: {
          processingTime,
          confidence: this.calculateOverallConfidence(imageAnalysis, referenceAnalysis),
          suggestions: this.generateSuggestions(imageAnalysis, referenceAnalysis, input),
          warnings: this.generateWarnings(imageAnalysis, referenceAnalysis, input),
          aiModel: this.visionModel,
          analysisVersion: '2.0'
        }
      };

    } catch (error) {
      console.error('❌ Ошибка при комплексном анализе:', error);
      throw new Error(`Ошибка ИИ-анализа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }

  private async analyzeUserImageAdvanced(imageBase64: string, productName: string, dimensions: any) {
    const prompt = `
Вы - эксперт по анализу товаров для российского маркетплейса Wildberries. 
Проанализируйте это изображение товара максимально детально.

ТОВАР: ${productName}
РАЗМЕРЫ: ${dimensions.length}x${dimensions.width}x${dimensions.height} см, вес: ${dimensions.weight} кг

ЗАДАЧИ АНАЛИЗА:
1. Определите точный тип товара и его назначение
2. Проанализируйте цвета (основной и дополнительные)
3. Определите материалы изготовления
4. Выявите стиль и дизайн
5. Найдите ключевые особенности и преимущества
6. Оцените состояние товара
7. Определите целевую аудиторию
8. Найдите текст на изображении (если есть)
9. Предложите категорию для WB

ВАЖНЫЕ ЦВЕТА ДЛЯ WB:
черный, белый, красный, синий, зеленый, желтый, серый, коричневый, розовый, фиолетовый, оранжевый, золотой, серебряный, бежевый, мятный, лиловый

МАТЕРИАЛЫ:
пластик, металл, ткань, кожа, дерево, стекло, резина, силикон, нейлон, полиэстер, хлопок, шерсть, смешанные материалы

Верните результат СТРОГО в формате JSON:
{
  "productType": "детальный тип товара с назначением",
  "primaryColor": "основной цвет из списка выше",
  "secondaryColors": ["дополнительные цвета"],
  "materials": ["основные материалы"],
  "style": "стиль/дизайн (современный, классический, спортивный, минимализм и т.д.)",
  "keyFeatures": ["уникальные особенности и преимущества товара"],
  "estimatedSize": "размерная категория (компактный, средний, крупный)",
  "condition": "новый",
  "confidence": число_от_0_до_1,
  "detectedText": "текст на изображении если есть",
  "productCategory": "предполагаемая категория для WB"
}

БУДЬТЕ МАКСИМАЛЬНО ТОЧНЫМИ И ДЕТАЛЬНЫМИ!
`;

    const response = await this.openai.chat.completions.create({
      model: this.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high' // Высокое качество анализа
              }
            }
          ]
        }
      ],
      temperature: 0.1, // Низкая температура для точности
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('Пустой ответ от OpenAI при анализе изображения');

    try {
      const parsed = JSON.parse(result);
      console.log('✅ Анализ изображения завершен:', {
        productType: parsed.productType,
        confidence: parsed.confidence,
        category: parsed.productCategory
      });
      return parsed;
    } catch (error) {
      console.error('Ошибка парсинга JSON при анализе изображения:', result);
      throw new Error('Некорректный JSON ответ при анализе изображения');
    }
  }

  private async analyzeReferenceProduct(referenceUrl: string) {
    const prompt = `
Вы - эксперт по анализу товаров на маркетплейсах. Проанализируйте товар по ссылке Wildberries.

ССЫЛКА ДЛЯ АНАЛИЗА: ${referenceUrl}

ВАЖНО: Перейдите по ссылке и проанализируйте страницу товара полностью.

ЗАДАЧИ АНАЛИЗА:
1. Изучите название товара и извлеките бренд
2. Определите точную категорию товара на WB
3. Соберите все характеристики из описания
4. Проанализируйте цену и позиционирование
5. Оцените качество карточки и описания
6. Извлеките ключевые преимущества товара
7. Определите целевую аудиторию
8. Найдите уникальные особенности

ОСОБОЕ ВНИМАНИЕ:
- Изучите полное описание товара
- Проанализируйте характеристики в таблице
- Оцените качество фотографий
- Посмотрите отзывы покупателей (если есть)
- Определите ценовой сегмент относительно аналогов

Верните результат СТРОГО в формате JSON:
{
  "extractedBrand": "точное название бренда из карточки или NoName",
  "extractedCategory": "полная категория товара на WB",
  "extractedTitle": "полное название товара",
  "extractedDescription": "описание товара с ключевыми особенностями",
  "extractedCharacteristics": [
    {"name": "материал", "value": "конкретный материал"},
    {"name": "цвет", "value": "точный цвет"},
    {"name": "размер", "value": "размеры"},
    {"name": "вес", "value": "вес"}
  ],
  "priceRange": "бюджетный/средний/премиум",
  "extractedPrice": "цена_если_видна",
  "marketPosition": "детальное описание позиции и преимуществ товара",
  "qualityScore": число_от_1_до_10,
  "targetAudience": "целевая аудитория товара",
  "uniqueFeatures": ["уникальные", "особенности", "товара"],
  "competitiveAdvantages": ["конкурентные", "преимущества"]
}

АНАЛИЗИРУЙТЕ РЕАЛЬНУЮ СТРАНИЦУ ТОВАРА, НЕ ДЕЛАЙТЕ ПРЕДПОЛОЖЕНИЙ!
`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Низкая температура для точности
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('Пустой ответ от OpenAI при анализе товара по ссылке');

    try {
      const parsed = JSON.parse(result);
      console.log('✅ Анализ товара по ссылке завершен:', {
        brand: parsed.extractedBrand,
        category: parsed.extractedCategory,
        qualityScore: parsed.qualityScore,
        characteristicsCount: parsed.extractedCharacteristics?.length || 0
      });
      return parsed;
    } catch (error) {
      console.error('Ошибка парсинга JSON при анализе товара по ссылке:', result);
      throw new Error('Некорректный JSON ответ при анализе товара по ссылке');
    }
  }

  private async generateAdvancedWBContent({ imageAnalysis, referenceAnalysis, userInput }: {
    imageAnalysis: any;
    referenceAnalysis: any;
    userInput: EnhancedAnalysisInput;
  }) {
    const prompt = `
Создайте максимально продающий и SEO-оптимизированный контент для Wildberries.

ДАННЫЕ АНАЛИЗА ИЗОБРАЖЕНИЯ:
${JSON.stringify(imageAnalysis, null, 2)}

ДАННЫЕ АНАЛОГА:
${JSON.stringify(referenceAnalysis, null, 2)}

ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ:
- Название: ${userInput.userProductName}
- Комплектация: ${userInput.packageContents}
- Цена: ${userInput.price} руб
- Размеры: ${userInput.dimensions.length}x${userInput.dimensions.width}x${userInput.dimensions.height} см
- Вес: ${userInput.dimensions.weight} кг

ТРЕБОВАНИЯ К КОНТЕНТУ:
1. Заголовок: до 60 символов, с ключевыми словами
2. Описание: до 1000 символов, продающее, с эмоциями
3. Характеристики с правильными ID для WB API
4. Категория с реальным ID из справочника WB
5. SEO-ключевые слова для поиска
6. Уникальные преимущества товара

ПОПУЛЯРНЫЕ КАТЕГОРИИ WB (используйте эти ID):
- 963: Кабели и адаптеры
- 964: Аксессуары для электроники  
- 965: Аксессуары для телефонов
- 14727: Товары для дома
- 2674: Кухонная утварь
- 629: Мужская одежда
- 8126: Женская одежда

ОБЯЗАТЕЛЬНЫЕ ID ХАРАКТЕРИСТИК:
- 85: Бренд
- 91: Страна производства
- 14177449: Цвет
- 372: Состав/материал

Верните результат СТРОГО в формате JSON:
{
  "title": "продающий заголовок до 60 символов",
  "description": "эмоциональное продающее описание до 1000 символов",
  "characteristics": [
    {"id": 85, "value": "бренд"},
    {"id": 91, "value": "Россия"},
    {"id": 14177449, "value": "основной_цвет"},
    {"id": 372, "value": "материал"}
  ],
  "categoryId": реальный_ID_категории_из_списка_выше,
  "keywords": ["основные", "ключевые", "слова"],
  "seoKeywords": ["seo", "оптимизированные", "фразы"],
  "sellingPoints": ["уникальные", "преимущества", "товара"]
}

СОЗДАЙТЕ КОНТЕНТ, КОТОРЫЙ ЗАСТАВИТ КУПИТЬ!
`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Немного творчества для продающего текста
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('Пустой ответ от OpenAI при генерации контента');

    try {
      const parsed = JSON.parse(result);
      console.log('✅ Контент для WB сгенерирован:', {
        titleLength: parsed.title?.length,
        descriptionLength: parsed.description?.length,
        categoryId: parsed.categoryId,
        characteristicsCount: parsed.characteristics?.length
      });
      return parsed;
    } catch (error) {
      console.error('Ошибка парсинга JSON при генерации контента:', result);
      throw new Error('Некорректный JSON ответ при генерации контента');
    }
  }

  private getDefaultReferenceAnalysis() {
    return {
      extractedBrand: 'Нет бренда', // ИСПРАВЛЕНО: используем правильное название
      extractedCategory: 'Товары для дома',
      extractedCharacteristics: [],
      priceRange: 'средний',
      marketPosition: 'не определен',
      qualityScore: 5
    };
  }

  private calculateOverallConfidence(imageAnalysis: any, referenceAnalysis: any): number {
    let confidence = 0.6; // Базовая уверенность
    
    if (imageAnalysis?.confidence) {
      confidence = (confidence + imageAnalysis.confidence) / 2;
    }
    
    if (referenceAnalysis?.qualityScore && referenceAnalysis.qualityScore > 7) {
      confidence += 0.1;
    }
    
    if (imageAnalysis?.keyFeatures && imageAnalysis.keyFeatures.length > 2) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  private generateSuggestions(imageAnalysis: any, referenceAnalysis: any, userInput: any): string[] {
    const suggestions = [];
    
    if (imageAnalysis?.confidence < 0.7) {
      suggestions.push('Рекомендуется проверить качество изображения или сделать фото под лучшим освещением');
    }
    
    if (!referenceAnalysis || referenceAnalysis.qualityScore < 5) {
      suggestions.push('Добавьте ссылку на качественный товар-аналог для улучшения анализа');
    }
    
    if (userInput.price < 100) {
      suggestions.push('Для товаров низкой стоимости важно подчеркнуть экономичность и практичность');
    }
    
    if (userInput.price > 5000) {
      suggestions.push('Для дорогих товаров важно подчеркнуть качество, престижность и уникальные особенности');
    }
    
    if (!imageAnalysis?.detectedText) {
      suggestions.push('Рассмотрите добавление логотипа или текста на упаковку для лучшего брендинга');
    }
    
    return suggestions;
  }

  private generateWarnings(imageAnalysis: any, referenceAnalysis: any, userInput: any): string[] {
    const warnings = [];
    
    if (imageAnalysis?.condition !== 'новый') {
      warnings.push('Товар может не соответствовать требованиям WB к новым товарам');
    }
    
    if (imageAnalysis?.confidence < 0.4) {
      warnings.push('Очень низкая уверенность в анализе изображения - требуется ручная проверка всех данных');
    }
    
    if (userInput.userProductName.length > 60) {
      warnings.push('Название товара слишком длинное для заголовка WB - будет обрезано');
    }
    
    if (!userInput.packageContents || userInput.packageContents.length < 10) {
      warnings.push('Слишком краткое описание комплектации - добавьте больше деталей');
    }
    
    return warnings;
  }

  // Дополнительный метод для быстрого анализа только изображения
  async quickImageAnalysis(imageBase64: string): Promise<{ productType: string; confidence: number; category: string }> {
    const prompt = `
Быстро определите тип товара и категорию по изображению.

Верните JSON:
{
  "productType": "тип товара",
  "confidence": число_от_0_до_1,
  "category": "категория для WB"
}
`;

    const response = await this.openai.chat.completions.create({
      model: this.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low' // Быстрый анализ
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('Пустой ответ при быстром анализе');

    return JSON.parse(result);
  }
}

export const enhancedGeminiService = new EnhancedGeminiService();