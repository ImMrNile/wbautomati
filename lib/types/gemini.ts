// lib/types/gemini.ts

export interface ProductDimensions {
  length?: string;
  width?: string;
  height?: string;
  weight?: string;
}

export interface ReferenceData {
  name?: string;
  price?: number;
  rating?: number;
  reviewsCount?: number;
  category?: string;
  brand?: string;
  characteristics?: Record<string, any>;
  description?: string;
}

export interface ProductAnalysisInput {
  productName: string;
  images: string[];
  referenceData?: ReferenceData;
  dimensions: ProductDimensions;
  price: number;
}

export interface VisualAnalysis {
  productType: string;
  primaryColor: string;
  material: string;
  style: string;
  keyFeatures: string[];
  targetAudience: string;
  confidence: number;
}

export interface ProductCharacteristic {
  id: number;
  value: string;
  required?: boolean;
}

export interface MarketingInsights {
  pricePosition: string;
  uniqueSellingPoints: string[];
  targetAgeGroup: string;
  seasonality: string;
}

export interface ProductAnalysisResult {
  visualAnalysis: VisualAnalysis;
  seoTitle: string;
  seoDescription: string;
  characteristics: ProductCharacteristic[];
  suggestedKeywords: string[];
  competitiveAdvantages: string[];
  wbCategory: string;
  marketingInsights: MarketingInsights;
}

export interface WBCategory {
  id: number;
  name: string;
  confidence?: number;
  reason?: string;
}

export interface WBCharacteristicDefinition {
  id: number;
  name: string;
  required: boolean;
  type?: string;
  values?: string[];
}

export interface WBCardData {
  vendorCode: string;
  title: string;
  description: string;
  brand: string;
  imtId: number;
  characteristics: ProductCharacteristic[];
}

export interface PublishResult {
  success: boolean;
  nmId?: number;
  data?: any;
  error?: string;
}

export interface Cabinet {
  id: string;
  name: string;
  apiToken: string;
  isActive: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProcessingStatus {
  id: string;
  status: ProductStatus;
  message?: string;
  progress?: number;
  currentStep?: string;
}

// Статусы обработки (соответствуют Prisma enum)
export enum ProductStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  ERROR = 'ERROR'
}

// Типы для анализа конкурентов
export interface CompetitorData {
  id: string;
  name: string;
  price: number;
  rating: number;
  reviewsCount: number;
  category: string;
  characteristics: Record<string, any>;
  keywords: string[];
  description: string;
  sales?: number;
  position?: number;
}

export interface CompetitorAnalysisResult {
  priceAnalysis: {
    averagePrice: number;
    priceRange: {
      min: number;
      max: number;
    };
    recommendation: string;
  };
  keywordAnalysis: {
    popularKeywords: string[];
    keywordFrequency: Record<string, number>;
    recommendation: string;
  };
  contentAnalysis: {
    commonPatterns: string[];
    averageDescriptionLength: number;
    recommendation: string;
  };
  overallRecommendations: string[];
}

// Типы для сезонности
export interface SeasonalityAnalysis {
  seasonality: 'круглогодичный' | 'сезонный' | 'праздничный';
  peakSeasons: string[];
  bestPublishTime: string;
  seasonalKeywords: string[];
  demandForecast: string;
}

// Типы для оптимизации
export interface OptimizationSuggestion {
  type: 'title' | 'description' | 'keywords' | 'price' | 'characteristics';
  current: string;
  suggested: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface OptimizationResult {
  suggestions: OptimizationSuggestion[];
  overallScore: number;
  estimatedImpact: string;
}

// Типы для ошибок
export interface GeminiError {
  code: string;
  message: string;
  details?: any;
}

export interface ProcessingError extends Error {
  code: string;
  productId?: string;
  step?: string;
  details?: any;
}

// Типы для API ответов
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ProductCreationResponse {
  id: string;
  status: ProductStatus;
  message: string;
  hasReference: boolean;
  referenceName?: string;
  autoPublish: boolean;
}

export interface ProductListResponse {
  products: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Типы для валидации
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Типы для конфигурации
export interface GeminiConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface ProcessingConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableAutoPublish: boolean;
  enableReferenceAnalysis: boolean;
}

// Типы для работы с Prisma моделями
export interface ProductModel {
  id: string;
  originalName: string;
  generatedName?: string;
  originalImage: string;
  dimensions: any; // JSON в Prisma
  price: number;
  referenceUrl?: string;
  referenceData?: any; // JSON в Prisma
  suggestedCategory?: string;
  colorAnalysis?: string;
  seoDescription?: string;
  aiCharacteristics?: any; // JSON в Prisma
  status: ProductStatus;
  errorMessage?: string;
  wbNmId?: number;
  publishedAt?: Date;
  wbData?: any; // JSON в Prisma
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCabinetModel {
  id: string;
  productId: string;
  cabinetId: string;
  isSelected: boolean;
  isPublished: boolean;
  wbCardId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryModel {
  id: string;
  name: string;
  wbId: number;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Утилитарные типы
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;