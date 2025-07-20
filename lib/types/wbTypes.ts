// lib/types/wbTypes.ts - Централизованные типы для WB API

export interface WBCategory {
  objectID: number;
  objectName: string;
  parentID?: number;
  isVisible: boolean;
}

export interface CategoryHierarchy {
  id: number;
  name: string;
  parentId?: number;
  children: CategoryHierarchy[];
  level: number;
  path: string[];
}

export interface CategoryCharacteristic {
  id: number;
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  values?: string[];
  units?: string[];
  description?: string;
}

export interface CategorySuggestion {
  category: WBCategory;
  confidence: number;
  reason: string;
  keywords: string[];
}

export interface WBApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  taskId?: string;
  statusCode?: number;
  warnings?: string[];
}

// ИСПРАВЛЕННЫЙ интерфейс для создания карточки WB
export interface WBCardCreateRequest {
  object: number; // ID категории (не subjectID!)
  vendorCode: string;
  title: string;
  description: string;
  brand: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  characteristics: Array<{
    id: number;
    value: string[];
  }>;
  composition?: string;
  barcode?: string;
}

// НОВЫЙ интерфейс для старого формата WB API (с variants)
export interface WBCardCreateRequestLegacy {
  subjectID: number;
  variants: Array<{
    vendorCode: string;
    title: string;
    description: string;
    brand: string;
    dimensions: {
      length: number;
      width: number;
      height: number;
      weightBrutto: number;
    };
    characteristics: Array<{
      id: number;
      value: string[];
    }>;
    sizes: Array<{
      techSize: string;
      wbSize: string;
      price: number;
      skus: string[];
    }>;
  }>;
}

export interface ProductCardData {
  vendorCode: string;
  title: string;
  description: string;
  brand: string;
  categoryId: number;
  price: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  characteristics: Record<string, any>;
  packageContents: string;
  barcode?: string;
}

// Совместимость с существующим кодом
export interface WBCategoryLegacy {
  objectID?: number;
  subjectID?: number;
  id?: number;
  objectName?: string;
  subjectName?: string;
  name?: string;
  parentID?: number;
  isVisible?: boolean;
}

/**
 * Утилита для нормализации категории из разных источников
 */
export function normalizeCategory(category: WBCategoryLegacy): WBCategory {
  return {
    objectID: category.objectID || category.subjectID || category.id || 0,
    objectName: category.objectName || category.subjectName || category.name || 'Без названия',
    parentID: category.parentID,
    isVisible: category.isVisible !== false
  };
}

/**
 * Утилита для получения ID категории из разных форматов
 */
export function getCategoryId(category: WBCategoryLegacy): number {
  return category.objectID || category.subjectID || category.id || 0;
}

/**
 * Утилита для получения названия категории из разных форматов
 */
export function getCategoryName(category: WBCategoryLegacy): string {
  return category.objectName || category.subjectName || category.name || 'Без названия';
}

// Константы для работы с WB API
export const WB_LIMITS = {
  VENDOR_CODE_MAX_LENGTH: 75,
  TITLE_MAX_LENGTH: 60,
  DESCRIPTION_MAX_LENGTH: 5000,
  COMPOSITION_MAX_LENGTH: 1000,
  CHARACTERISTICS_MAX_COUNT: 100
} as const;

export const WB_CATEGORY_DEFAULTS = {
  FALLBACK_CATEGORY_ID: 14727, // "Товары для дома"
  ELECTRONICS_CATEGORY_ID: 963, // "Кабели и адаптеры"
  ACCESSORIES_CATEGORY_ID: 964  // "Аксессуары для электроники"
} as const;