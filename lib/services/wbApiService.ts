// lib/services/wbApiService.ts
import axios from 'axios';
export class WbApiService {
  private readonly BASE_URL = 'https://suppliers-api.wildberries.ru';

  private async makeRequest(endpoint: string, apiToken: string, options: RequestInit = {}) {
    const url = `${this.BASE_URL}${endpoint}`;
    const headers = {
      'Authorization': apiToken,
      'Content-Type': 'application/json',
      ...options.headers,
    };
const readClient = axios.create({
  baseURL: 'https://content-api.wildberries.ru',
  headers: { Authorization: process.env.WB_API_READ_TOKEN },
});

const writeClient = axios.create({
  baseURL: 'https://content-api.wildberries.ru',
  headers: { Authorization: process.env.WB_API_WRITE_TOKEN },
});

    console.log(`🌐 Отправляем запрос в WB API: ${url}`);
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка WB API (HTTP ${response.status}): ${errorText}`);
    }
    
    return response.json();
  }

  /**
   * Загрузка полного дерева категорий
   */
  async getAllCategories(apiToken: string): Promise<any[]> {
    const response = await this.makeRequest('/content/v1/object/all', apiToken);
    return response.data || [];
  }

  /**
   * Загрузка характеристик для конкретной категории
   */
  async getCategoryCharacteristics(subjectId: number, apiToken: string): Promise<any[]> {
    const response = await this.makeRequest(`/content/v1/object/charcs/${subjectId}`, apiToken);
    return response.data || [];
  }

  /**
   * Создание карточки товара по новому API v3
   */
  async createProductCard(cardData: any, apiToken: string): Promise<any> {
    // ВАЖНО: API v3 ожидает массив в поле 'characteristics' внутри каждого элемента 'nomenclatures'
    const payload = {
      imtID: cardData.imtID,
      nomenclatures: cardData.nomenclatures.map((nom: any) => ({
        ...nom,
        characteristics: cardData.characteristics, // Добавляем характеристики сюда
      })),
    };

    const response = await this.makeRequest('/content/v3/cards/upload', apiToken, {
      method: 'POST',
      body: JSON.stringify([payload]), // API ожидает массив
    });

    if (response?.error) {
        return { success: false, error: response.errorText || 'Неизвестная ошибка' };
    }
    
    return { success: true, data: response };
  }
}


export const wbApiService = new WbApiService();