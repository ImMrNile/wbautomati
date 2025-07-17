// lib/services/replicateService.ts
import Replicate from 'replicate';
import type { ProductAnalysisInput, ProductAnalysisResult } from '../types/gemini';

export class ReplicateService {
  private replicate: Replicate;
  private model: string;

  constructor() {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN not found in environment variables');
    }

    this.replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    this.model = process.env.REPLICATE_MODEL || 'meta/llama-2-70b-chat';
  }

  private async runModel(prompt: string): Promise<string> {
    const output = await this.replicate.run(this.model as any, { input: { prompt } });
    if (Array.isArray(output)) {
      return output.join('');
    }
    return String(output);
  }

  async analyzeProductForWB(input: ProductAnalysisInput): Promise<ProductAnalysisResult> {
    const prompt = this.createAnalysisPrompt(input);
    const result = await this.runModel(prompt);
    const clean = result.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(clean);
  }

  private createAnalysisPrompt(input: ProductAnalysisInput): string {
    return `Ты — высококвалифицированный эксперт по созданию карточек товаров для Wildberries. Тебе предоставлены следующие данные:\nНазвание: ${input.productName}\nЦена: ${input.price}\nГабариты: ${JSON.stringify(input.dimensions)}\n${input.referenceData ? `Данные аналога: ${JSON.stringify(input.referenceData)}` : ''}\nОтветь в формате JSON со структурой ProductAnalysisResult.`;
  }

  async generateTitleVariations(info: string, count = 5): Promise<string[]> {
    const prompt = `Создай ${count} вариантов SEO-заголовков для товара на Wildberries:\n${info}\nОтветь массивом JSON.`;
    const result = await this.runModel(prompt);
    const clean = result.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(clean);
  }

  async optimizeDescription(description: string, competitors?: any[], keywords?: string[]): Promise<string> {
    const prompt = `Оптимизируй описание товара для Wildberries:\nТекущее описание: ${description}\n${competitors ? `Данные конкурентов: ${JSON.stringify(competitors)}` : ''}\n${keywords ? `Ключевые слова: ${keywords.join(', ')}` : ''}\nВерни оптимизированный текст.`;
    return (await this.runModel(prompt)).trim();
  }

  async analyzeSeasonality(productType: string, category: string): Promise<any> {
    const prompt = `Проанализируй сезонность товара типа ${productType} в категории ${category}. Верни JSON со статистикой.`;
    const result = await this.runModel(prompt);
    const clean = result.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(clean);
  }
}

export const replicateService = new ReplicateService();
