// lib/utils/json.ts

// Простое преобразование объекта в JSON для Prisma
export function toPrismaJson(value: any): any {
  if (value === null || value === undefined) {
    return undefined;
  }
  
  if (typeof value === 'object') {
    return JSON.parse(JSON.stringify(value));
  }
  
  return value;
}

// Преобразование объекта в nullable JSON для Prisma
export function toPrismaNullableJson(value: any): any {
  if (value === null || value === undefined) {
    return undefined;
  }
  
  return toPrismaJson(value);
}

// Преобразование Prisma JSON в обычный объект
export function fromPrismaJson<T = any>(value: any): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  return value as T;
}

// Безопасное получение значения из Prisma JSON
export function getJsonValue<T = any>(value: any, defaultValue: T): T {
  const result = fromPrismaJson<T>(value);
  return result !== null ? result : defaultValue;
}

// Проверка валидности JSON
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
}

// Очистка объекта от undefined значений
export function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(cleanObject).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanObject(value);
      }
    }
    
    return cleaned;
  }
  
  return obj;
}