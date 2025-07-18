/**
 * Конфигурация API хостов Wildberries
 * @see https://dev.wildberries.ru/openapi/api-information
 */
const WB_API_HOSTS = {
  /**
   * API для работы с контентом: карточки товаров, категории, характеристики.
   */
  CONTENT: 'https://content-api.wildberries.ru',
  /**
   * API для работы с маркетплейсом: цены, остатки.
   */
  MARKETPLACE: 'https://marketplace-api.wildberries.ru',
  /**
   * Статистический API: отчеты, продажи.
   */
  STATISTICS: 'https://statistics-api.wildberries.ru',
} as const;


/**
 * Полные URL-адреса для методов API Wildberries
 */
export const WB_API_ENDPOINTS = {
  // === Методы для работы с товарами (Content API) ===

  /**
   * Получение данных о товаре по артикулу (NM ID).
   * Используется для парсинга данных аналога.
   * @param {number} nmId - Артикул товара.
   * @returns {string} URL
   */
  getProductCard: (nmId: number): string => 
    `${WB_API_HOSTS.CONTENT}/content/v2/get/cards/list?nmID=${nmId}`,

  /**
   * Получение списка всех категорий товаров.
   */
  getAllCategories: `${WB_API_HOSTS.CONTENT}/content/v2/object/all`,

  /**
   * Получение характеристик для конкретной категории.
   * @param {number} categoryId - ID категории.
   * @returns {string} URL
   */
  getCategoryCharacteristics: (categoryId: number): string => 
    `${WB_API_HOSTS.CONTENT}/content/v2/object/charcs/${categoryId}`,

  /**
   * Создание/обновление карточки товара.
   */
  uploadCard: `${WB_API_HOSTS.CONTENT}/content/v2/cards/upload`,
};