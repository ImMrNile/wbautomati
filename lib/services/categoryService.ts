// lib/services/categoryService.ts - Сервис для работы с категориями WB

export interface WBCategory {
  objectID: number;
  objectName: string;
  parentID?: number;
  isVisible: boolean;
  children?: WBCategory[];
  level?: number;
  path?: string[];
}

export interface CategoryTree {
  id: number;
  name: string;
  parentId?: number;
  children: CategoryTree[];
  level: number;
  isLeaf: boolean;
  fullPath: string[];
}

export class CategoryService {
  private categoriesCache: WBCategory[] = [];
  private categoryTree: CategoryTree[] = [];

  /**
   * Загрузка всех категорий и построение дерева
   */
  async loadCategoriesWithHierarchy(apiToken: string): Promise<CategoryTree[]> {
    try {
      console.log('📂 Загружаем иерархию категорий WB...');

      // Загружаем родительские категории
      const parentCategories = await this.fetchParentCategories(apiToken);
      
      // Загружаем все категории
      const allCategories = await this.fetchAllCategories(apiToken);

      // Строим дерево категорий
      this.categoryTree = this.buildCategoryTree(parentCategories, allCategories);
      
      console.log(`✅ Построено дерево из ${this.categoryTree.length} родительских категорий`);
      return this.categoryTree;

    } catch (error) {
      console.error('❌ Ошибка загрузки категорий:', error);
      throw new Error(`Не удалось загрузить категории: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }

  /**
   * Загрузка родительских категорий через API
   */
  private async fetchParentCategories(apiToken: string): Promise<WBCategory[]> {
    const response = await fetch('/api/wb-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/content/v2/object/parent/all?locale=ru',
        method: 'GET',
        apiToken,
        useCache: true
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Ошибка загрузки родительских категорий');
    }

    return result.data?.data || [];
  }

  /**
   * Загрузка всех категорий через API
   */
  private async fetchAllCategories(apiToken: string): Promise<WBCategory[]> {
    const response = await fetch('/api/wb-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/content/v2/object/all?locale=ru',
        method: 'GET',
        apiToken,
        useCache: true
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Ошибка загрузки всех категорий');
    }

    this.categoriesCache = result.data?.data || [];
    return this.categoriesCache;
  }

  /**
   * Построение дерева категорий
   */
  private buildCategoryTree(parentCategories: WBCategory[], allCategories: WBCategory[]): CategoryTree[] {
    const categoryMap = new Map<number, WBCategory>();
    
    // Создаем карту всех категорий
    allCategories.forEach(cat => {
      categoryMap.set(cat.objectID, cat);
    });

    // Строим дерево начиная с родительских категорий
    const tree: CategoryTree[] = [];

    parentCategories.forEach(parent => {
      const categoryNode = this.buildCategoryNode(parent, categoryMap, 0, [parent.objectName]);
      if (categoryNode) {
        tree.push(categoryNode);
      }
    });

    return tree;
  }

  /**
   * Построение узла дерева категорий
   */
  private buildCategoryNode(
    category: WBCategory, 
    categoryMap: Map<number, WBCategory>, 
    level: number,
    path: string[]
  ): CategoryTree | null {
    if (!category) return null;

    // Находим дочерние категории
    const children: CategoryTree[] = [];
    
    for (const [id, cat] of categoryMap) {
      if (cat.parentID === category.objectID) {
        const childPath = [...path, cat.objectName];
        const childNode = this.buildCategoryNode(cat, categoryMap, level + 1, childPath);
        if (childNode) {
          children.push(childNode);
        }
      }
    }

    return {
      id: category.objectID,
      name: category.objectName,
      parentId: category.parentID,
      children: children.sort((a, b) => a.name.localeCompare(b.name)),
      level,
      isLeaf: children.length === 0,
      fullPath: path
    };
  }

  /**
   * Поиск категорий по названию
   */
  searchCategories(query: string, maxResults: number = 20): CategoryTree[] {
    const results: CategoryTree[] = [];
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) return results;

    const searchInTree = (nodes: CategoryTree[]) => {
      for (const node of nodes) {
        // Проверяем название категории
        if (node.name.toLowerCase().includes(searchTerm)) {
          results.push(node);
          if (results.length >= maxResults) return;
        }

        // Рекурсивно ищем в дочерних категориях
        if (node.children.length > 0) {
          searchInTree(node.children);
          if (results.length >= maxResults) return;
        }
      }
    };

    searchInTree(this.categoryTree);
    return results;
  }

  /**
   * Получение пути к категории
   */
  getCategoryPath(categoryId: number): string[] {
    const findPath = (nodes: CategoryTree[], targetId: number, currentPath: string[] = []): string[] | null => {
      for (const node of nodes) {
        const newPath = [...currentPath, node.name];
        
        if (node.id === targetId) {
          return newPath;
        }
        
        if (node.children.length > 0) {
          const childPath = findPath(node.children, targetId, newPath);
          if (childPath) return childPath;
        }
      }
      return null;
    };

    return findPath(this.categoryTree, categoryId) || [];
  }

  /**
   * Получение категории по ID
   */
  getCategoryById(categoryId: number): CategoryTree | null {
    const findById = (nodes: CategoryTree[]): CategoryTree | null => {
      for (const node of nodes) {
        if (node.id === categoryId) {
          return node;
        }
        
        if (node.children.length > 0) {
          const found = findById(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    return findById(this.categoryTree);
  }

  /**
   * Получение популярных категорий
   */
  getPopularCategories(): CategoryTree[] {
    // ID популярных категорий на основе статистики WB
    const popularIds = [
      963,   // Кабели и адаптеры
      964,   // Аксессуары для электроники
      965,   // Аксессуары для телефонов
      2674,  // Кухонная утварь
      629,   // Мужская одежда
      8126,  // Женская одежда
      566,   // Детская одежда
      2808,  // Обувь
      14727, // Товары для дома
      1234,  // Косметика
    ];

    const popular: CategoryTree[] = [];
    
    for (const id of popularIds) {
      const category = this.getCategoryById(id);
      if (category) {
        popular.push(category);
      }
    }

    return popular;
  }

  /**
   * Получение рекомендаций категорий для ИИ
   */
  getCategoryRecommendationsForAI(productType: string): CategoryTree[] {
    const recommendations = this.searchCategories(productType, 10);
    
    // Если не нашли по точному совпадению, ищем по ключевым словам
    if (recommendations.length === 0) {
      const keywords = this.extractKeywords(productType);
      for (const keyword of keywords) {
        const keywordResults = this.searchCategories(keyword, 5);
        recommendations.push(...keywordResults);
        
        if (recommendations.length >= 10) break;
      }
    }

    // Удаляем дубликаты
    const unique = recommendations.filter((category, index, self) => 
      index === self.findIndex(c => c.id === category.id)
    );

    return unique.slice(0, 10);
  }

  /**
   * Извлечение ключевых слов из описания товара
   */
  private extractKeywords(text: string): string[] {
    const commonWords = ['для', 'и', 'в', 'на', 'с', 'по', 'из', 'к', 'от', 'до', 'или', 'но', 'а', 'при'];
    
    return text
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .slice(0, 5);
  }

  /**
   * Проверка валидности категории
   */
  async validateCategory(categoryId: number, apiToken: string): Promise<{ valid: boolean; category?: CategoryTree; error?: string }> {
    try {
      const category = this.getCategoryById(categoryId);
      
      if (!category) {
        return { 
          valid: false, 
          error: `Категория с ID ${categoryId} не найдена в дереве категорий` 
        };
      }

      // Дополнительная проверка через API
      const characteristics = await this.getCategoryCharacteristics(categoryId, apiToken);
      
      return { 
        valid: true, 
        category 
      };
    } catch (error) {
      return { 
        valid: false, 
        error: `Ошибка проверки категории: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` 
      };
    }
  }

  /**
   * Получение характеристик для категории
   */
  async getCategoryCharacteristics(categoryId: number, apiToken: string): Promise<any[]> {
    try {
      const response = await fetch('/api/wb-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/content/v2/object/charcs/${categoryId}?locale=ru`,
          method: 'GET',
          apiToken,
          useCache: true
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Ошибка загрузки характеристик');
      }

      return result.data?.data || [];
    } catch (error) {
      console.error(`❌ Ошибка получения характеристик для категории ${categoryId}:`, error);
      return [];
    }
  }

  /**
   * Экспорт дерева категорий для кеширования
   */
  exportCategoryTree(): CategoryTree[] {
    return this.categoryTree;
  }

  /**
   * Импорт дерева категорий из кеша
   */
  importCategoryTree(tree: CategoryTree[]): void {
    this.categoryTree = tree;
  }
}

export const categoryService = new CategoryService();