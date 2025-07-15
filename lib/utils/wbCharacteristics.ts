// lib/utils/wbCharacteristics.ts

// Стандартные ID характеристик Wildberries
export const WB_CHARACTERISTICS_IDS = {
  // Основные характеристики
  MAIN_COLOR: 14863,        // Основной цвет
  MATERIAL: 7174,           // Материал
  BRAND: 8229,              // Бренд
  COUNTRY: 7919,            // Страна производства
  GENDER: 7183,             // Пол

  // Размеры и вес
  LENGTH: 16999,            // Длина упаковки (см)
  WIDTH: 17001,             // Ширина упаковки (см)
  HEIGHT: 17003,            // Высота упаковки (см)
  WEIGHT: 17005,            // Вес товара с упаковкой (г)

  // Дополнительные характеристики
  COMPOSITION: 7175,        // Состав
  CARE_INSTRUCTIONS: 7176,  // Уход
  SEASON: 7177,             // Сезон
  STYLE: 7178,              // Стиль
  OCCASION: 7179,           // Повод

  // Размерные характеристики одежды
  SIZE: 7180,               // Размер
  SIZE_TYPE: 7181,          // Тип размера
} as const;

// Дефолтные значения для характеристик
export const DEFAULT_CHARACTERISTIC_VALUES: Record<number, string> = {
  [WB_CHARACTERISTICS_IDS.MAIN_COLOR]: 'не указан',
  [WB_CHARACTERISTICS_IDS.MATERIAL]: 'не указан',
  [WB_CHARACTERISTICS_IDS.BRAND]: 'NoName',
  [WB_CHARACTERISTICS_IDS.COUNTRY]: 'Россия',
  [WB_CHARACTERISTICS_IDS.GENDER]: 'унисекс',
  [WB_CHARACTERISTICS_IDS.LENGTH]: '30',
  [WB_CHARACTERISTICS_IDS.WIDTH]: '20',
  [WB_CHARACTERISTICS_IDS.HEIGHT]: '10',
  [WB_CHARACTERISTICS_IDS.WEIGHT]: '500',
  [WB_CHARACTERISTICS_IDS.COMPOSITION]: 'не указан',
  [WB_CHARACTERISTICS_IDS.SEASON]: 'всесезон',
  [WB_CHARACTERISTICS_IDS.STYLE]: 'универсальный',
};

// Маппинг названий характеристик на ID
export const CHARACTERISTIC_NAME_TO_ID: Record<string, number> = {
  'основной цвет': WB_CHARACTERISTICS_IDS.MAIN_COLOR,
  'цвет': WB_CHARACTERISTICS_IDS.MAIN_COLOR,
  'материал': WB_CHARACTERISTICS_IDS.MATERIAL,
  'бренд': WB_CHARACTERISTICS_IDS.BRAND,
  'страна производства': WB_CHARACTERISTICS_IDS.COUNTRY,
  'пол': WB_CHARACTERISTICS_IDS.GENDER,
  'длина упаковки': WB_CHARACTERISTICS_IDS.LENGTH,
  'ширина упаковки': WB_CHARACTERISTICS_IDS.WIDTH,
  'высота упаковки': WB_CHARACTERISTICS_IDS.HEIGHT,
  'вес': WB_CHARACTERISTICS_IDS.WEIGHT,
  'состав': WB_CHARACTERISTICS_IDS.COMPOSITION,
  'сезон': WB_CHARACTERISTICS_IDS.SEASON,
  'стиль': WB_CHARACTERISTICS_IDS.STYLE,
  'повод': WB_CHARACTERISTICS_IDS.OCCASION,
  'размер': WB_CHARACTERISTICS_IDS.SIZE,
};

// Интерфейс для характеристики
export interface WBCharacteristic {
  id: number;
  value: string;
  required?: boolean;
}

// Класс для работы с характеристиками WB
export class WBCharacteristicsHelper {
  // Создание характеристики
  static createCharacteristic(id: number, value: string): WBCharacteristic {
    return {
      id,
      value: value.toString(),
    };
  }

  // Получение ID характеристики по названию
  static getCharacteristicId(name: string): number | null {
    const normalizedName = name.toLowerCase().trim();
    return CHARACTERISTIC_NAME_TO_ID[normalizedName] || null;
  }

  // Получение дефолтного значения для характеристики
  static getDefaultValue(id: number): string {
    return DEFAULT_CHARACTERISTIC_VALUES[id] || 'не указан';
  }

  // Валидация характеристики
  static validateCharacteristic(characteristic: WBCharacteristic): boolean {
    return (
      typeof characteristic.id === 'number' &&
      characteristic.id > 0 &&
      typeof characteristic.value === 'string' &&
      characteristic.value.trim().length > 0
    );
  }

  // Слияние характеристик (приоритет у первого массива)
  static mergeCharacteristics(
    primary: WBCharacteristic[],
    secondary: WBCharacteristic[]
  ): WBCharacteristic[] {
    const result = [...primary];
    for (const char of secondary) {
      if (!result.find((c) => c.id === char.id)) {
        result.push(char);
      }
    }
    return result;
  }

  // Добавление обязательных характеристик с дефолтными значениями
  static addRequiredCharacteristics(
    characteristics: WBCharacteristic[],
    requiredIds: number[]
  ): WBCharacteristic[] {
    const result = [...characteristics];
    for (const id of requiredIds) {
      if (!result.find((c) => c.id === id)) {
        result.push(this.createCharacteristic(id, this.getDefaultValue(id)));
      }
    }
    return result;
  }

  // Фильтрация валидных характеристик
  static filterValidCharacteristics(
    characteristics: WBCharacteristic[]
  ): WBCharacteristic[] {
    return characteristics.filter((char) => this.validateCharacteristic(char));
  }

  // Создание базового набора характеристик
  static createBaseCharacteristics(
    color?: string,
    material?: string,
    brand?: string,
    dimensions?: { length?: string; width?: string; height?: string; weight?: string }
  ): WBCharacteristic[] {
    const characteristics: WBCharacteristic[] = [];

    if (color) {
      characteristics.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.MAIN_COLOR, color));
    }
    if (material) {
      characteristics.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.MATERIAL, material));
    }
    if (brand) {
      characteristics.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.BRAND, brand));
    }

    // Добавляем размеры
    if (dimensions) {
      if (dimensions.length) {
        characteristics.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.LENGTH, dimensions.length));
      }
      if (dimensions.width) {
        characteristics.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.WIDTH, dimensions.width));
      }
      if (dimensions.height) {
        characteristics.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.HEIGHT, dimensions.height));
      }
      if (dimensions.weight) {
        characteristics.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.WEIGHT, dimensions.weight));
      }
    }

    // Добавляем страну производства
    characteristics.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.COUNTRY, 'Россия'));

    return characteristics;
  }

  // Оптимизация характеристик под конкретную категорию
  static optimizeForCategory(
    characteristics: WBCharacteristic[],
    categoryId: number
  ): WBCharacteristic[] {
    let optimized = [...characteristics];
    // Для категории "Одежда" добавляем специфичные характеристики
    if (categoryId === 14727) {
      const hasGender = optimized.find((c) => c.id === WB_CHARACTERISTICS_IDS.GENDER);
      if (!hasGender) {
        optimized.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.GENDER, 'унисекс'));
      }
      const hasSeason = optimized.find((c) => c.id === WB_CHARACTERISTICS_IDS.SEASON);
      if (!hasSeason) {
        optimized.push(this.createCharacteristic(WB_CHARACTERISTICS_IDS.SEASON, 'всесезон'));
      }
    }
    return optimized;
  }

  // Преобразование характеристик в формат для WB API
  static formatForWBAPI(characteristics: WBCharacteristic[]): any[] {
    return characteristics
      .filter((char) => this.validateCharacteristic(char))
      .map((char) => ({
        id: char.id,
        value: char.value.trim(),
      }));
  }

  // Получение характеристики по ID
  static getCharacteristicById(
    characteristics: WBCharacteristic[],
    id: number
  ): WBCharacteristic | null {
    return characteristics.find((char) => char.id === id) || null;
  }

  // Обновление характеристики
  static updateCharacteristic(
    characteristics: WBCharacteristic[],
    id: number,
    newValue: string
  ): WBCharacteristic[] {
    return characteristics.map((char) =>
      char.id === id ? { ...char, value: newValue } : char
    );
  }

  // Удаление характеристики
  static removeCharacteristic(
    characteristics: WBCharacteristic[],
    id: number
  ): WBCharacteristic[] {
    return characteristics.filter((char) => char.id !== id);
  }

  // Группировка характеристик по типу
  static groupCharacteristics(
    characteristics: WBCharacteristic[]
  ): {
    basic: WBCharacteristic[];
    dimensions: WBCharacteristic[];
    specific: WBCharacteristic[];
  } {
    const basic: WBCharacteristic[] = [];
    const dimensions: WBCharacteristic[] = [];
    const specific: WBCharacteristic[] = [];

    const basicIds: number[] = [
      WB_CHARACTERISTICS_IDS.MAIN_COLOR,
      WB_CHARACTERISTICS_IDS.MATERIAL,
      WB_CHARACTERISTICS_IDS.BRAND,
      WB_CHARACTERISTICS_IDS.COUNTRY,
      WB_CHARACTERISTICS_IDS.GENDER
    ];

    const dimensionIds: number[] = [
      WB_CHARACTERISTICS_IDS.LENGTH,
      WB_CHARACTERISTICS_IDS.WIDTH,
      WB_CHARACTERISTICS_IDS.HEIGHT,
      WB_CHARACTERISTICS_IDS.WEIGHT
    ];

    for (const char of characteristics) {
      if (basicIds.includes(char.id)) {
        basic.push(char);
      } else if (dimensionIds.includes(char.id)) {
        dimensions.push(char);
      } else {
        specific.push(char);
      }
    }

    return { basic, dimensions, specific };
  }
}
    