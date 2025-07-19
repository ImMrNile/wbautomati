// lib/services/geminiService.ts - ОБНОВЛЕННАЯ ВЕРСИЯ с безопасной обработкой изображений

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
  images: string[];
  packageContents?: string; 
  referenceData?: any;
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
    tnvedCode?: string;
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
  tnvedCode?: string;
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

  /**
   * Основной метод анализа товара с улучшенным определением категории
   */
   async analyzeProductForWB(input: ProductAnalysisInput): Promise<ProductAnalysisResult> {
    try {
      console.log('🤖 Начинаем анализ товара с запросом ТН ВЭД...');
      const prompt = this.createEnhancedAnalysisPrompt(input);
      const parts = await this.prepareParts(prompt, input.images);
      const text = await this.sendToOpenAI(parts);
      const analysisResult = this.parseGeminiResponse(text);
      const enhancedResult = this.enhanceAnalysisResult(analysisResult, input);
      return enhancedResult;
    } catch (error) {
      console.error('❌ Ошибка анализа товара:', error);
      throw new Error(`Ошибка ИИ-анализа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }

  private createEnhancedAnalysisPrompt(input: ProductAnalysisInput): string {
    return `Ты — эксперт по анализу товаров для Wildberries. Твоя задача — провести анализ товара, определить категорию WB и найти правильный 10-значный код ТН ВЭД.

ДАННЫЕ ТОВАРА:
- **Название:** ${input.productName}
- **Комплектация:** ${input.packageContents || 'Не указана'}
- **Цена:** ${input.price} ₽
${input.referenceData ? `- **ДАННЫЕ АНАЛОГА:**\n  * Категория: ${input.referenceData.category || 'Не указано'}` : ''}

ОСНОВНЫЕ КАТЕГОРИИ WILDBERRIES:
1. **Электроника** - зарядки, кабели, гаджеты
2. **Одежда и обувь**
3. **Товары для дома**
4. **Автотовары**

ЗАДАЧА:
1. **Изучи товар:** Проанализируй название, комплектацию и изображения.
2. **Определи код ТН ВЭД:** Найди в интернете и укажи наиболее подходящий 10-значный код ТН ВЭД для этого товара. Для USB-кабеля это обычно 8544429009.
3. **Определи категорию WB:** Выбери самую точную категорию из списка выше.
4. **Заполни все поля** в JSON-ответе.

ФОРМАТ ОТВЕТА - строго JSON:
{
  "visualAnalysis": {
    "productType": "точное определение типа товара",
    "primaryColor": "основной цвет",
    "material": "материал",
    "style": "стиль",
    "keyFeatures": ["особенность 1", "особенность 2"],
    "targetAudience": "целевая аудитория", 
    "confidence": 95
  },
  "wbCategory": "ТОЧНОЕ название категории WB",
  "tnvedCode": "10-значный код ТН ВЭД",
  "seoTitle": "SEO заголовок (до 60 символов)",
  "seoDescription": "SEO описание (до 1000 символов)",
  "characteristics": [],
  "suggestedKeywords": ["ключевое слово 1", "ключевое слово 2"],
  "competitiveAdvantages": ["преимущество 1", "преимущество 2"],
  "marketingInsights": {
    "pricePosition": "бюджетный/средний/премиум",
    "uniqueSellingPoints": ["УТП 1"],
    "targetAgeGroup": "возрастная группа",
    "seasonality": "сезонность"
  }
}

ВАЖНО: Поле "tnvedCode" обязательно к заполнению.`;
  }

  /**
   * Подготовка частей для запроса с безопасной обработкой изображений
   */
  private async prepareParts(prompt: string, imageUrls: string[]): Promise<ContentPart[]> {
    const parts: ContentPart[] = [{ text: prompt }];

    // Фильтруем только валидные URL изображений
    const validImageUrls = imageUrls
      .filter(url => url && typeof url === 'string')
      .filter(url => this.isValidImageUrl(url))
      .slice(0, 4); // Максимум 4 изображения

    console.log(`📸 Обрабатываем ${validImageUrls.length} изображений из ${imageUrls.length}`);

    for (const imageUrl of validImageUrls) {
      try {
        console.log(`🔄 Загружаем изображение: ${imageUrl.substring(0, 100)}...`);
        
        const imageData = await this.fetchImageAsBase64(imageUrl);
        parts.push({
          inlineData: {
            mimeType: this.getMimeTypeFromUrl(imageUrl),
            data: imageData
          }
        });
        
        console.log(`✅ Изображение загружено успешно`);
      } catch (error) {
        console.warn(`⚠️ Не удалось загрузить изображение ${imageUrl}:`, error);
        continue; // Продолжаем с другими изображениями
      }
    }

    console.log(`📸 Итого подготовлено ${parts.length - 1} изображений для анализа`);
    return parts;
  }

  /**
   * Безопасная загрузка изображения как base64
   */
  private async fetchImageAsBase64(imageUrl: string): Promise<string> {
    try {
      // Проверяем, не является ли это data URL
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        if (base64Data) {
          return base64Data;
        }
        throw new Error('Некорректный data URL');
      }

      // Проверяем, не является ли это placeholder URL
      if (imageUrl.includes('placeholder.example.com')) {
        throw new Error('Placeholder URL не может быть загружен');
      }

      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(10000), // 10 секунд таймаут
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WB-Image-Loader/1.0)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Проверяем размер файла (максимум 10MB)
      if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
        throw new Error('Изображение слишком большое (>10MB)');
      }
      
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    } catch (error) {
      throw new Error(`Не удалось загрузить изображение: ${error}`);
    }
  }

  /**
   * Определение MIME типа по URL
   */
  private getMimeTypeFromUrl(url: string): string {
    // Для data URLs извлекаем MIME тип
    if (url.startsWith('data:')) {
      const mimeMatch = url.match(/^data:([^;]+)/);
      return mimeMatch ? mimeMatch[1] : 'image/jpeg';
    }

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

  /**
   * Проверка валидности URL изображения
   */
  private isValidImageUrl(url: string): boolean {
    try {
      // Проверяем data URLs
      if (url.startsWith('data:image/')) {
        return true;
      }

      // Проверяем обычные URLs
      const urlObj = new URL(url);
      
      // Исключаем placeholder URLs
      if (urlObj.hostname.includes('placeholder') || urlObj.hostname.includes('example.com')) {
        return false;
      }

      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      return validExtensions.some(ext =>
        urlObj.pathname.toLowerCase().includes(ext)
      );
    } catch {
      return false;
    }
  }

  /**
   * Отправка запроса к OpenAI
   */
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
      ],
      temperature: 0.3, // Снижаем температуру для более точных результатов
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Парсинг ответа от ИИ
   */
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
        throw new Error('Отсутствуют обязательные поля в ответе ИИ');
      }

      return parsed as ProductAnalysisResult;

    } catch (error) {
      console.error('❌ Ошибка парсинга ответа ИИ:', error);
      console.error('Исходный текст:', text.substring(0, 500));
      
      return this.createFallbackResult();
    }
  }

  /**
   * Улучшение результата анализа на основе дополнительной логики
   */
  private enhanceAnalysisResult(result: ProductAnalysisResult, input: ProductAnalysisInput): ProductAnalysisResult {
    console.log('🔧 Улучшаем результат анализа...');

    // Если categoryAnalysis отсутствует, создаем его
    if (!result.categoryAnalysis) {
      result.categoryAnalysis = {
        primaryCategory: result.wbCategory,
        secondaryCategories: [],
        categoryConfidence: 75,
        reasonForCategory: 'Автоматически определено на основе анализа'
      };
    }

    // Проверяем и корректируем категорию на основе ключевых слов
    const correctedCategory = this.validateAndCorrectCategory(
      result.wbCategory,
      input.productName,
      result.visualAnalysis?.categoryKeywords || [],
      input.referenceData
    );

    if (correctedCategory !== result.wbCategory) {
      console.log(`🔄 Категория скорректирована: ${result.wbCategory} → ${correctedCategory}`);
      result.wbCategory = correctedCategory;
      result.categoryAnalysis.primaryCategory = correctedCategory;
      result.categoryAnalysis.reasonForCategory += ' (скорректировано алгоритмом)';
    }

    // Добавляем недостающие характеристики
    result.characteristics = this.enhanceCharacteristics(result.characteristics, input);

    // Улучшаем SEO заголовок с учетом категории
    result.seoTitle = this.enhanceSeoTitle(result.seoTitle, correctedCategory, input.productName);

    return result;
  }

  /**
   * Валидация и коррекция категории
   */
  private validateAndCorrectCategory(
    aiCategory: string,
    productName: string,
    categoryKeywords: string[],
    referenceData?: any
  ): string {
    const name = productName.toLowerCase();
    const keywords = categoryKeywords.map(k => k.toLowerCase());
    
    // Карта ключевых слов для категорий (с приоритетом для электроники)
    const categoryMappings = {
      'Электроника': [
        'кабель', 'cable', 'провод', 'шнур', 'usb', 'type-c', 'lightning', 'micro',
        'зарядное', 'зарядка', 'charger', 'адаптер', 'adapter', 'переходник',
        'наушники', 'headphones', 'bluetooth', 'колонка', 'speaker',
        'телефон', 'phone', 'смартфон', 'планшет', 'tablet',
        'электрический', 'электронный', 'electric', 'electronic',
        'гаджет', 'девайс', 'device', 'техника', 'technology'
      ],
      'Автотовары': [
        'автомобильный', 'авто', 'машина', 'автомобиль', 'для авто',
        'в машину', 'автомобильное', 'автозапчасти'
      ],
      'Одежда и обувь': [
        'футболка', 'рубашка', 'платье', 'джинсы', 'брюки', 'куртка',
        'свитер', 'кроссовки', 'ботинки', 'туфли', 'сапоги', 'одежда', 'обувь'
      ]
    };

    // Проверяем каждую категорию (электроника в приоритете)
    for (const [category, keywordsList] of Object.entries(categoryMappings)) {
      const matches = keywordsList.filter(keyword => 
        name.includes(keyword) || keywords.some(k => k.includes(keyword))
      );

      if (matches.length > 0) {
        console.log(`🎯 Найдены совпадения для категории "${category}": ${matches.join(', ')}`);
        return category;
      }
    }

    // Возвращаем исходную категорию ИИ, если коррекция не нужна
    return aiCategory;
  }

  /**
   * Улучшение характеристик
   */
  private enhanceCharacteristics(
    characteristics: Array<{ id: number; value: string }>,
    input: ProductAnalysisInput
  ): Array<{ id: number; value: string }> {
    const charMap = new Map<number, string>();

    // Добавляем существующие характеристики
    characteristics.forEach(char => {
      charMap.set(char.id, char.value);
    });

    // Обязательные характеристики
    const requiredDefaults = {
      8229: input.referenceData?.brand || 'NoName', // Бренд
      7919: 'Россия', // Страна производства
      14863: 'не указан' // Основной цвет (если не определен)
    };

    // Добавляем обязательные, если их нет
    Object.entries(requiredDefaults).forEach(([id, value]) => {
      const numId = Number(id);
      if (!charMap.has(numId)) {
        charMap.set(numId, value);
      }
    });

    // Размерные характеристики
    if (input.dimensions.length) charMap.set(16999, input.dimensions.length);
    if (input.dimensions.width) charMap.set(17001, input.dimensions.width);
    if (input.dimensions.height) charMap.set(17003, input.dimensions.height);
    if (input.dimensions.weight) {
      charMap.set(17005, String(Math.round(Number(input.dimensions.weight) * 1000)));
    }

    return Array.from(charMap, ([id, value]) => ({ id, value }));
  }

  /**
   * Улучшение SEO заголовка
   */
  private enhanceSeoTitle(currentTitle: string, category: string, productName: string): string {
    let title = currentTitle;

    // Добавляем категорию в начало, если её нет
    const categoryFirstWord = category.split(' ')[0].toLowerCase();
    if (!title.toLowerCase().includes(categoryFirstWord)) {
      title = `${categoryFirstWord} ${title}`;
    }

    // Обрезаем до 60 символов
    return title.substring(0, 60).trim();
  }

  /**
   * Создание запасного результата при ошибке
   */
  private createFallbackResult(): ProductAnalysisResult {
    return {
      visualAnalysis: {
        productType: 'Товар',
        primaryColor: 'Не определен',
        material: 'Не указан',
        style: 'Универсальный',
        keyFeatures: ['Качественное изготовление', 'Доступная цена'],
        targetAudience: 'Широкая аудитория',
        confidence: 50,
        detailedDescription: 'Анализ изображения недоступен',
        categoryKeywords: []
      },
      categoryAnalysis: {
        primaryCategory: 'Товары для дома',
        secondaryCategories: [],
        categoryConfidence: 50,
        reasonForCategory: 'Дефолтная категория из-за ошибки анализа'
      },
      seoTitle: 'Товар высокого качества по доступной цене',
      seoDescription: `✅ Качественный товар по выгодной цене
✅ Быстрая доставка по России
✅ Гарантия качества
✅ Отличные отзывы покупателей

Идеальный выбор для повседневного использования. Современный дизайн и надежность.

Закажите прямо сейчас и получите быструю доставку!`,
      characteristics: [
        { id: 14863, value: "не определен" },
        { id: 7174, value: "не указан" },
        { id: 8229, value: "NoName" },
        { id: 7919, value: "Россия" },
        { id: 16999, value: "30" },
        { id: 17001, value: "20" },
        { id: 17003, value: "10" },
        { id: 17005, value: "500" }
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

  /**
   * Анализ конкурентов
   */
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

  /**
   * Генерация вариантов заголовков
   */
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

  /**
   * Специальный анализ для определения точной категории
   */
  async analyzeProductCategory(
    productName: string,
    images: string[],
    referenceData?: any
  ): Promise<{
    category: string;
    confidence: number;
    alternatives: string[];
    reasoning: string;
  }> {
    try {
      const prompt = `Определи ТОЧНУЮ категорию Wildberries для этого товара.

ТОВАР: ${productName}
${referenceData ? `АНАЛОГ: ${referenceData.name} (категория: ${referenceData.category})` : ''}

ДОСТУПНЫЕ КАТЕГОРИИ WB:
- Электроника
- Одежда и обувь  
- Товары для дома
- Красота и здоровье
- Спорт и отдых
- Автотовары
- Детские товары
- Ювелирные изделия

ВАЖНО: Если в названии есть "кабель", "USB", "зарядка", "провод" - это ЭЛЕКТРОНИКА!

Проанализируй название товара. Ответь в JSON:
{
  "category": "точная категория",
  "confidence": 95,
  "alternatives": ["альтернатива1", "альтернатива2"],
  "reasoning": "подробное объяснение выбора"
}`;

      const parts = await this.prepareParts(prompt, images);
      const text = await this.sendToOpenAI(parts);
      
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Ошибка анализа категории:', error);
      return {
        category: 'Товары для дома',
        confidence: 50,
        alternatives: ['Электроника'],
        reasoning: 'Ошибка анализа, используется дефолтная категория'
      };
    }
  }

  /**
   * Оптимизация описания товара
   */
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

  /**
   * Анализ сезонности товара
   */
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