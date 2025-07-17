// lib/services/geminiService.ts
import OpenAI from 'openai';

interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface ProductAnalysisInput {
  productName: string;
  images: string[]; // URLs изображений
  referenceData?: any; // Данные товара-аналога с WB
  dimensions: {
    length?: string;
    width?: string;
    height?: string;
    weight?: string;
  };
  price: number;
}

interface ProductAnalysisResult {
  visualAnalysis: {
    productType: string;
    primaryColor: string;
    material: string;
    style: string;
    keyFeatures: string[];
    targetAudience: string;
    confidence: number;
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

export class GeminiService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY не найден в переменных окружения');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
  }

  // Основной метод анализа товара для создания карточки
  async analyzeProductForWB(input: ProductAnalysisInput): Promise<ProductAnalysisResult> {
    try {
      console.log('Начинаем анализ товара с помощью Gemini...');

      // Создаем промпт для анализа
      const prompt = this.createAnalysisPrompt(input);
      
      // Подготавливаем части для запроса (текст + изображения)
      const parts = await this.prepareParts(prompt, input.images);

      const text = await this.sendToOpenAI(parts);

      console.log('Получен ответ от Gemini, парсим JSON...');

      // Парсим JSON ответ
      const analysisResult = this.parseGeminiResponse(text);
      
      console.log('Анализ товара завершен успешно');
      return analysisResult;

    } catch (error) {
      console.error('Ошибка анализа товара с Gemini:', error);
      throw new Error(`Ошибка ИИ-анализа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }

  // Создание промпта для анализа товара
  private createAnalysisPrompt(input: ProductAnalysisInput): string {
    return `Ты — высококвалифицированный эксперт по созданию карточек товаров для Wildberries с обширным опытом в e-commerce и глубоким пониманием алгоритмов ранжирования WB. Твоя основная задача — разработать детализированную, высококонверсионную и SEO-оптимизированную карточку товара, которая обеспечит максимальную видимость и высокие продажи на платформе Wildberries.

ИСХОДНЫЕ ДАННЫЕ ДЛЯ АНАЛИЗА:
- **Название товара:** ${input.productName}
- **Цена:** ${input.price} ₽
- **Габариты товара:** ${JSON.stringify(input.dimensions)}
${input.referenceData ? `- **ДАННЫЕ УСПЕШНОГО АНАЛОГА НА WB (для сравнительного анализа):**
  * **Название:** ${input.referenceData.name || 'Не указано'}
  * **Цена:** ${input.referenceData.price !== undefined ? input.referenceData.price : 'Не указано'} ₽
  * **Рейтинг:** ${input.referenceData.rating !== undefined ? input.referenceData.rating : 'Не указано'}
  * **Количество отзывов:** ${input.referenceData.reviewsCount !== undefined ? input.referenceData.reviewsCount : 'Не указано'}
  * **Категория:** ${input.referenceData.category || 'Не указано'}
  * **Характеристики:** ${input.referenceData.characteristics ? JSON.stringify(input.referenceData.characteristics) : 'Не указаны'}
  * **Описание:** ${input.referenceData.description || 'Не указано'}` : ''}

ТВОЯ ГЛАВНАЯ ЗАДАЧА ВКЛЮЧАЕТ:
1. **Всесторонний анализ предоставленных изображений товара:** Извлечение визуальных характеристик.
2. **Сравнительный анализ (если данные аналога доступны):** Сопоставление с данными успешного аналога на Wildberries для выявления конкурентных преимуществ и лучших практик.
3. **Генерация SEO-оптимизированной карточки товара:** Создание всех необходимых текстовых элементов для максимального ранжирования и привлечения покупателей.

ДЕТАЛЬНЫЕ ТРЕБОВАНИЯ К АНАЛИЗУ:
- **Определение ключевых характеристик:** Точное выявление типа товара, его основного цвета, материала изготовления, общего стиля и дизайна.
- **Выявление уникальных особенностей:** Определение всех ключевых особенностей и преимуществ, которые необходимо отразить в описании.
- **Определение целевой аудитории:** Уточнение основной демографической и психографической группы потенциальных покупателей.
- **Формулирование уникальных торговых предложений (УТП):** Определение отличительных преимуществ товара по сравнению с конкурентами.
- **Генерация релевантных ключевых слов:** Составление исчерпывающего списка высокочастотных и среднечастотных ключевых слов.
- **Предложение Wildberries категории:** Определи наиболее подходящую категорию WB.

ТРЕБОВАНИЯ К SEO-ЗАГОЛОВКУ:
- **Длина:** Максимум 60 символов.
- **Ключевые слова:** Обязательное включение 3-5 релевантных ключевых слов.
- **Структура:** Должен начинаться с точного типа товара, затем указывать на главную особенность.
- **Избегание:** Не использовать стоп-слова, общие фразы и дублирование информации.

ТРЕБОВАНИЯ К SEO-ОПИСАНИЮ:
- **Структура:** Четкий, логически структурированный текст.
- **Преимущества:** Ярко выделить ключевые преимущества товара.
- **Характеристики:** Включить все существенные технические характеристики.
- **Сценарии использования:** Описать различные сценарии применения товара.
- **Призыв к действию:** Завершить описание четким призывом к покупке.
- **Длина:** Максимум 1000 символов.

ТРЕБОВАНИЯ К ХАРАКТЕРИСТИКАМ ТОВАРА:
- **Полнота:** Заполнить все основные характеристики, которые можно определить.
- **Формат:** Массив объектов {"id": ID_характеристики, "value": "значение"}.
- **ID Характеристик:** Используй стандартные ID для WB API:
  * Основной цвет: 14863
  * Материал: 7174
  * Пол: 7183
  * Длина упаковки (см): 16999
  * Ширина упаковки (см): 17001
  * Высота упаковки (см): 17003
  * Вес товара с упаковкой (г): 17005
  * Бренд: 8229
  * Страна производства: 7919

ФОРМАТ ОТВЕТА:
Ответь СТРОГО в формате валидного JSON:

{
  "visualAnalysis": {
    "productType": "точный тип товара",
    "primaryColor": "основной цвет товара",
    "material": "материал изготовления",
    "style": "стиль или дизайн товара",
    "keyFeatures": ["особенность 1", "особенность 2", "особенность 3"],
    "targetAudience": "описание целевой аудитории",
    "confidence": 85
  },
  "seoTitle": "SEO-оптимизированный заголовок (до 60 символов)",
  "seoDescription": "Полное SEO-описание товара (до 1000 символов)",
  "characteristics": [
    {"id": 14863, "value": "красный"},
    {"id": 7174, "value": "хлопок"},
    {"id": 16999, "value": "${input.dimensions.length || '30'}"},
    {"id": 17001, "value": "${input.dimensions.width || '20'}"},
    {"id": 17003, "value": "${input.dimensions.height || '10'}"},
    {"id": 17005, "value": "${input.dimensions.weight || '500'}"}
  ],
  "suggestedKeywords": ["ключевое слово 1", "ключевое слово 2", "ключевое слово 3"],
  "competitiveAdvantages": ["преимущество 1", "преимущество 2", "преимущество 3"],
  "wbCategory": "рекомендуемая категория Wildberries",
  "marketingInsights": {
    "pricePosition": "позиционирование по цене",
    "uniqueSellingPoints": ["УТП 1", "УТП 2"],
    "targetAgeGroup": "возрастная группа",
    "seasonality": "сезонность товара"
  }
}`;
  }

  // Подготовка частей для запроса (текст + изображения)
  private async prepareParts(prompt: string, imageUrls: string[]): Promise<ContentPart[]> {
    const parts: ContentPart[] = [{ text: prompt }];

    // Обрабатываем максимум 4 изображения
    for (const imageUrl of imageUrls.slice(0, 4)) {
      try {
        if (this.isValidImageUrl(imageUrl)) {
          const imageData = await this.fetchImageAsBase64(imageUrl);
          parts.push({
            inlineData: {
              mimeType: this.getMimeTypeFromUrl(imageUrl),
              data: imageData
            }
          });
        }
      } catch (error) {
        console.warn(`Не удалось загрузить изображение ${imageUrl}:`, error);
      }
    }
    return parts;
  }

  // Загрузка изображения как base64
  private async fetchImageAsBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    } catch (error) {
      throw new Error(`Не удалось загрузить изображение: ${error}`);
    }
  }

  // Определение MIME типа по URL
  private getMimeTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/jpeg';
    }
  }

  // Проверка валидности URL изображения
  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      return validExtensions.some(ext =>
        urlObj.pathname.toLowerCase().includes(ext)
      );
    } catch {
      return false;
    }
  }

  private async sendToOpenAI(parts: ContentPart[]): Promise<string> {
    const content = parts.map(part => {
      if (part.text) {
        return { type: 'text' as const, text: part.text };
      }
      if (part.inlineData) {
        return {
          type: 'image_url' as const,
          image_url: {
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
          }
        };
      }
      return { type: 'text' as const, text: '' };
    });

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content
        }
      ]
    });

    return response.choices[0]?.message?.content || '';
  }

  // Парсинг ответа от Gemini
  private parseGeminiResponse(text: string): ProductAnalysisResult {
    try {
      // Очищаем текст от markdown разметки
      const cleanText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^[^{]*/, '')
        .replace(/[^}]*$/, '');

      const parsed = JSON.parse(cleanText);

      // Валидируем обязательные поля
      if (!parsed.visualAnalysis || !parsed.seoTitle || !parsed.seoDescription || 
          !parsed.wbCategory || !Array.isArray(parsed.characteristics)) {
        throw new Error('Отсутствуют обязательные поля в ответе Gemini');
      }

      // Проверяем структуру visualAnalysis
      if (!parsed.visualAnalysis.productType || !parsed.visualAnalysis.primaryColor) {
        throw new Error('Некорректная структура visualAnalysis');
      }

      // Проверяем, что characteristics содержит объекты с id и value
      if (!parsed.characteristics.every((char: any) => 
        typeof char.id === 'number' && typeof char.value === 'string')) {
        throw new Error('Некорректная структура characteristics');
      }

      return parsed as ProductAnalysisResult;

    } catch (error) {
      console.error('Ошибка парсинга ответа Gemini:', error);
      console.error('Исходный текст:', text);
      
      return this.createFallbackResult();
    }
  }

  // Создание запасного результата при ошибке парсинга
  private createFallbackResult(): ProductAnalysisResult {
    return {
      visualAnalysis: {
        productType: 'Товар',
        primaryColor: 'Не определен',
        material: 'Не указан',
        style: 'Универсальный',
        keyFeatures: ['Качественное изготовление', 'Доступная цена'],
        targetAudience: 'Широкая аудитория',
        confidence: 50
      },
      seoTitle: 'Товар высокого качества по доступной цене',
      seoDescription: `✅ Качественный товар по выгодной цене
✅ Быстрая доставка по России
✅ Гарантия качества
✅ Отличные отзывы покупателей

Идеальный выбор для повседневного использования. Современный дизайн и надежность.

Закажите прямо сейчас и получите быструю доставку!`,
      characteristics: [
        { id: 14863, value: "не определен" }, // Основной цвет
        { id: 7174, value: "не указан" },      // Материал
        { id: 8229, value: "NoName" },         // Бренд
        { id: 7919, value: "Россия" },         // Страна производства
        { id: 16999, value: "30" },            // Длина упаковки
        { id: 17001, value: "20" },            // Ширина упаковки
        { id: 17003, value: "10" },            // Высота упаковки
        { id: 17005, value: "500" }            // Вес товара с упаковкой
      ],
      suggestedKeywords: ['товар', 'качество', 'доставка', 'гарантия', 'цена'],
      competitiveAdvantages: ['Доступная цена', 'Быстрая доставка', 'Гарантия качества'],
      wbCategory: 'Товары для дома',
      marketingInsights: {
        pricePosition: 'Средний сегмент',
        uniqueSellingPoints: ['Соотношение цена-качество', 'Надежность'],
        targetAgeGroup: '18-65 лет',
        seasonality: 'Круглогодичный'
      }
    };
  }

  // Анализ конкурентов
  async analyzeCompetitors(competitorData: any[]): Promise<any> {
    try {
      const prompt = `Проанализируй данные конкурентов на Wildberries и дай рекомендации по оптимизации:

ДАННЫЕ КОНКУРЕНТОВ:
${JSON.stringify(competitorData, null, 2)}

Проанализируй следующие аспекты:
1. Ценовое позиционирование
2. Популярные ключевые слова в названиях
3. Структуру описаний
4. Основные характеристики
5. Рекомендации по улучшению

Ответь в JSON формате:
{
  "priceAnalysis": {
    "averagePrice": "средняя цена",
    "priceRange": "диапазон цен",
    "recommendation": "рекомендация по цене"
  },
  "keywordAnalysis": {
    "popularKeywords": ["популярные ключевые слова"],
    "recommendation": "рекомендации по ключевым словам"
  },
  "contentAnalysis": {
    "commonPatterns": ["общие паттерны в описаниях"],
    "recommendation": "рекомендации по контенту"
  },
  "overallRecommendations": ["общие рекомендации"]
}`;

      const text = await this.sendToOpenAI([{ text: prompt }]);

      return JSON.parse(text);
    } catch (error) {
      console.error('Ошибка анализа конкурентов:', error);
      return { 
        error: 'Не удалось проанализировать конкурентов',
        fallbackRecommendations: [
          'Проверьте актуальные цены конкурентов',
          'Оптимизируйте ключевые слова в названии',
          'Улучшите качество фотографий'
        ]
      };
    }
  }

  // Генерация вариантов заголовков
  async generateTitleVariations(productInfo: string, count: number = 5): Promise<string[]> {
    try {
      const prompt = `Создай ${count} вариантов SEO-заголовков для товара на Wildberries:

ИНФОРМАЦИЯ О ТОВАРЕ: ${productInfo}

ТРЕБОВАНИЯ:
- Максимум 60 символов
- Разные подходы к ключевым словам
- Высокая конверсия
- Включение главных преимуществ товара

Ответь массивом строк в JSON формате: ["заголовок1", "заголовок2", ...]`;

      const text = await this.sendToOpenAI([{ text: prompt }]);

      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Ошибка генерации вариантов заголовков:', error);
      return [
        'Товар высокого качества по доступной цене',
        'Качественный товар с быстрой доставкой',
        'Надежный товар для повседневного использования',
        'Современный дизайн и отличное качество',
        'Выгодная покупка с гарантией качества'
      ];
    }
  }

  // Оптимизация описания товара
  async optimizeDescription(
    currentDescription: string, 
    competitorData?: any[], 
    targetKeywords?: string[]
  ): Promise<string> {
    try {
      const prompt = `Оптимизируй описание товара для Wildberries:

ТЕКУЩЕЕ ОПИСАНИЕ:
${currentDescription}

${competitorData ? `ДАННЫЕ КОНКУРЕНТОВ:
${JSON.stringify(competitorData, null, 2)}` : ''}

${targetKeywords ? `ЦЕЛЕВЫЕ КЛЮЧЕВЫЕ СЛОВА:
${targetKeywords.join(', ')}` : ''}

ТРЕБОВАНИЯ:
- Максимум 1000 символов
- SEO-оптимизация
- Структурированный текст с пунктами
- Призыв к действию
- Уникальные торговые предложения

Верни только оптимизированный текст описания.`;

      const text = await this.sendToOpenAI([{ text: prompt }]);
      return text.trim();

    } catch (error) {
      console.error('Ошибка оптимизации описания:', error);
      return currentDescription;
    }
  }

  // Анализ сезонности товара
  async analyzeSeasonality(productType: string, category: string): Promise<any> {
    try {
      const prompt = `Проанализируй сезонность для товара:

ТИП ТОВАРА: ${productType}
КАТЕГОРИЯ: ${category}

Определи:
1. Основные сезоны продаж
2. Пики спроса
3. Рекомендации по времени публикации
4. Сезонные ключевые слова

Ответь в JSON формате:
{
  "seasonality": "круглогодичный|сезонный|праздничный",
  "peakSeasons": ["основные сезоны"],
  "bestPublishTime": "рекомендуемое время публикации",
  "seasonalKeywords": ["сезонные ключевые слова"],
  "demandForecast": "прогноз спроса"
}`;

      const text = await this.sendToOpenAI([{ text: prompt }]);

      return JSON.parse(text);
    } catch (error) {
      console.error('Ошибка анализа сезонности:', error);
      return {
        seasonality: 'круглогодичный',
        peakSeasons: ['весь год'],
        bestPublishTime: 'в любое время',
        seasonalKeywords: [],
        demandForecast: 'стабильный спрос'
      };
    }
  }
}

// Экспортируем экземпляр сервиса
export const geminiService = new GeminiService();