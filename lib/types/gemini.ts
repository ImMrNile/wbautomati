// lib/types/gemini.ts - ОБНОВЛЕННЫЕ ТИПЫ
// Экспорт всех типов для удобства
export * from './error';

// Существующие типы сохраняем без изменений
export enum ProductStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  ERROR = 'ERROR'
}

export interface ProductAnalysisResult {
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

export interface WBCategory {
  id: number;
  name: string;
}

export interface ProductCharacteristic {
  id: number;
  value: string;
}

export interface WBCardData {
  vendorCode: string;
  title: string;
  description: string;
  brand: string;
  imtId: number;
  characteristics: Array<{
    id: number;
    value: string | number;
  }>;
}

// НОВЫЕ ТИПЫ для улучшенного парсера

export interface WBProductData {
  id: string;
  name: string;
  brand: string;
  price: number;
  rating: number;
  reviewsCount: number;
  description: string;
  characteristics: Array<{ name: string; value: string }>;
  images: string[];
  category: string;
  availability: boolean;
  vendorCode: string;
  supplierId?: string;
}

export interface EnhancedParserConfig {
  useProxy?: boolean;
  proxyUrl?: string;
  delayMin?: number;
  delayMax?: number;
  maxRetries?: number;
  timeout?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

export interface ParseResult {
  success: boolean;
  data?: WBProductData;
  error?: string;
  parsingMethod: 'api' | 'page' | 'hybrid';
  responseTime: number;
  retryCount: number;
}

export interface ReferenceDataQuality {
  score: number;
  factors: {
    hasName: boolean;
    hasBrand: boolean;
    hasDescription: boolean;
    hasCharacteristics: boolean;
    hasImages: boolean;
    hasCategory: boolean;
    hasGoodRating: boolean;
  };
}

export interface EnhancedProductAnalysis extends ProductAnalysisResult {
  referenceData?: WBProductData;
  referenceQuality?: ReferenceDataQuality;
  parsingMethod: string;
  confidence: number;
  categoryMatchScore: number;
  characteristicsEnhanced: boolean;
}

// Типы для API ответов WB
export interface WBApiResponse<T = any> {
  data: T;
  error?: string;
  statusCode?: number;
}

export interface WBCategoryResponse {
  objectID: number;
  objectName: string;
  parentID?: number;
  isVisible: boolean;
}

export interface WBCharacteristicResponse {
  charcID: number;
  charcName: string;
  required: boolean;
  unitName?: string;
  maxCount?: number;
  charcType: 'string' | 'number' | 'boolean' | 'list';
  dictionary?: Array<{
    key: string;
    value: string;
  }>;
}

export interface WBCreateCardResponse {
  nmId?: number;
  error?: string;
  warnings?: string[];
  vendorCode?: string;
}

// Типы для системы очередей и обработки
export interface ProcessingJob {
  id: string;
  productId: string;
  type: 'parse' | 'analyze' | 'publish';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  maxAttempts: number;
  data: any;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ParsingMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  blockedRequests: number;
  retryCount: number;
  methodUsage: {
    api: number;
    page: number;
    hybrid: number;
  };
}

// Конфигурация для продакшена
export interface ProductionConfig {
  parser: {
    poolSize: number;
    maxConcurrentJobs: number;
    retryBackoff: number;
    healthCheckInterval: number;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsEndpoint?: string;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      blockRate: number;
    };
  };
  caching: {
    enabled: boolean;
    ttl: number;
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
  };
  rateLimit: {
    requestsPerMinute: number;
    burstLimit: number;
    backoffMultiplier: number;
  };
}

// Типы для кэширования
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  oldestEntry: number;
  newestEntry: number;
}

// Типы для мониторинга
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: {
    parser: ServiceHealth;
    database: ServiceHealth;
    cache: ServiceHealth;
    ai: ServiceHealth;
  };
  metrics: ParsingMetrics;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  lastCheck: number;
  error?: string;
}

// Типы для аналитики
export interface ProductAnalytics {
  productId: string;
  views: number;
  conversions: number;
  revenue: number;
  avgRating: number;
  competitorComparison: {
    pricePosition: 'lowest' | 'average' | 'highest';
    ratingPosition: 'below' | 'average' | 'above';
    featureAdvantages: string[];
  };
  seoMetrics: {
    titleScore: number;
    descriptionScore: number;
    keywordDensity: number;
    categoryMatch: number;
  };
}


// Дополнительные утилитарные типы
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Типы для валидации
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  suggestions?: string[];
}

export interface ValidationRule<T = any> {
  field: keyof T;
  type: 'required' | 'format' | 'range' | 'custom';
  message: string;
  validator?: (value: any) => boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

// Типы для API интеграций
export interface ApiIntegration {
  name: string;
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryCount: number;
  rateLimit: {
    requests: number;
    window: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  headers?: Record<string, string>;
  responseTime: number;
}

// Типы для обработки изображений
export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  watermark?: boolean;
  optimize?: boolean;
}

export interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  size: number;
  format: string;
  optimized: boolean;
}