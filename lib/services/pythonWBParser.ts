// lib/services/enhancedPythonWBParser.ts - Обновленный сервис для работы с улучшенным Python парсером

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface WBProductData {
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
  categoryId?: number;
  availability: boolean;
  vendorCode: string;
  supplierId?: string;
  tnved?: string;
  variantId?: string; // ID конкретного варианта (size parameter)
}

interface ParseResult {
  success: boolean;
  data?: WBProductData;
  error?: string;
  parsing_method?: 'HTML' | 'API';
  characteristics_count?: number;
  variant_id?: string;
  stats?: {
    total_requests: number;
    success_rate: number;
    html_parsing_available: boolean;
  };
}

interface ParserHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    pythonAvailable: boolean;
    venvExists: boolean;
    scriptExists: boolean;
    requestsInstalled: boolean;
    beautifulSoupInstalled: boolean;
    htmlParsingAvailable: boolean;
    testPassed: boolean;
  };
  capabilities: {
    htmlParsing: boolean;
    apiParsing: boolean;
    variantSupport: boolean;
    characteristicExtraction: boolean;
  };
}

export class PythonWBParser {
  private readonly pythonScriptPath: string;
  private readonly venvPath: string;
  private readonly timeout: number = 120000; // 2 минуты для HTML парсинга
  private isInitialized: boolean = false;
  private lastError: string | null = null;
  private htmlParsingAvailable: boolean = false;

  constructor() {
    this.pythonScriptPath = path.join(process.cwd(), 'scripts', 'wb_parser.py');
    this.venvPath = path.join(process.cwd(), 'venv');
  }

  /**
   * Инициализация улучшенного Python парсера
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Инициализация улучшенного Python парсера...');

      // Проверка Python
      const pythonAvailable = await this.checkPythonAvailability();
      if (!pythonAvailable) {
        this.lastError = 'Python не найден';
        console.error('❌ Python не найден. Установите Python 3.7+');
        return false;
      }

      // Проверка скрипта
      if (!fs.existsSync(this.pythonScriptPath)) {
        this.lastError = `Python скрипт не найден: ${this.pythonScriptPath}`;
        console.error(`❌ Python скрипт не найден: ${this.pythonScriptPath}`);
        return false;
      }

      // Проверка зависимостей
      const depsCheck = await this.checkDependencies();
      this.htmlParsingAvailable = depsCheck.requests && depsCheck.beautifulSoup;

      if (depsCheck.requests) {
        console.log('✅ Модуль requests доступен');
      } else {
        console.warn('⚠️ Модуль requests не найден');
      }

      if (depsCheck.beautifulSoup) {
        console.log('✅ Модуль BeautifulSoup доступен - HTML парсинг включен');
      } else {
        console.warn('⚠️ Модуль BeautifulSoup не найден - только API парсинг');
      }

      // Тестовый запуск
      const testPassed = await this.runTest();
      if (!testPassed) {
        this.lastError = 'Тестовый запуск не прошел';
        console.warn('⚠️ Тестовый запуск не прошел, но парсер может работать');
        // Не блокируем инициализацию при неудачном тесте
      }

      this.isInitialized = true;
      this.lastError = null;
      
      console.log('✅ Улучшенный Python парсер успешно инициализирован');
      console.log(`🌐 HTML парсинг: ${this.htmlParsingAvailable ? 'Доступен' : 'Недоступен'}`);
      
      return true;

    } catch (error: any) {
      this.lastError = error.message;
      console.error('❌ Ошибка инициализации улучшенного Python парсера:', error);
      return false;
    }
  }

  /**
   * Проверка доступности Python
   */
  async checkPythonAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const venvPythonPath = this.getVenvPythonPath();
        
        if (venvPythonPath && fs.existsSync(venvPythonPath)) {
          console.log('🐍 Проверяем Python в виртуальном окружении');
          const pythonProcess = spawn(venvPythonPath, ['--version'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000
          });

          pythonProcess.on('close', (code) => {
            resolve(code === 0);
          });

          pythonProcess.on('error', () => {
            console.log('⚠️ Ошибка venv Python, пробуем системный');
            this.checkSystemPython(resolve);
          });
        } else {
          console.log('📦 venv не найден, пробуем системный Python');
          this.checkSystemPython(resolve);
        }
      } catch (error) {
        console.log('❌ Ошибка проверки Python:', error);
        resolve(false);
      }
    });
  }

  /**
   * Проверка системного Python
   */
  private checkSystemPython(resolve: (value: boolean) => void): void {
    const pythonCommands = ['python', 'python3'];
    let currentIndex = 0;

    const tryNext = () => {
      if (currentIndex >= pythonCommands.length) {
        resolve(false);
        return;
      }

      const pythonCommand = pythonCommands[currentIndex];
      const pythonProcess = spawn(pythonCommand, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          currentIndex++;
          tryNext();
        }
      });

      pythonProcess.on('error', () => {
        currentIndex++;
        tryNext();
      });
    };

    tryNext();
  }

  /**
   * Получение пути к Python в виртуальном окружении
   */
  private getVenvPythonPath(): string | null {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      const windowsPath = path.join(this.venvPath, 'Scripts', 'python.exe');
      return fs.existsSync(windowsPath) ? windowsPath : null;
    } else {
      const unixPath = path.join(this.venvPath, 'bin', 'python');
      return fs.existsSync(unixPath) ? unixPath : null;
    }
  }

  /**
   * Получение команды Python
   */
  private getPythonCommand(): string {
    const venvPython = this.getVenvPythonPath();
    if (venvPython) {
      console.log('🐍 Используем Python из venv');
      return venvPython;
    }
    
    console.log('🐍 Используем системный Python');
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  /**
   * Проверка зависимостей Python
   */
  private async checkDependencies(): Promise<{
    requests: boolean;
    beautifulSoup: boolean;
  }> {
    const pythonCommand = this.getPythonCommand();
    
    const checkModule = (moduleName: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const pythonProcess = spawn(pythonCommand, ['-c', `import ${moduleName}; print("OK")`], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
          cwd: process.cwd()
        });

        pythonProcess.on('close', (code) => {
          resolve(code === 0);
        });

        pythonProcess.on('error', () => {
          resolve(false);
        });
      });
    };

    const [requests, beautifulSoup] = await Promise.all([
      checkModule('requests'),
      checkModule('bs4')
    ]);

    return { requests, beautifulSoup };
  }

  /**
   * Тестовый запуск парсера
   */
  private async runTest(): Promise<boolean> {
    try {
      console.log('🧪 Тестируем улучшенный Python парсер...');
      
      const result = await this.executePythonScript(['--test']);
      return result.success || (result.stats?.total_requests || 0) > 0;
      
    } catch (error) {
      console.warn('⚠️ Тест парсера не прошел:', error);
      return false;
    }
  }

  /**
   * Основной метод парсинга товара с поддержкой вариантов
   */
  async getProductData(url: string, options?: {
    forceHtmlParsing?: boolean;
    timeout?: number;
  }): Promise<WBProductData> {
    if (!this.isInitialized) {
      throw new Error('Улучшенный Python парсер не инициализирован');
    }

    console.log(`🔍 Запускаем улучшенный Python парсер для: ${url}`);
    
    // Извлекаем информацию о варианте из URL
    const variantInfo = this.extractVariantInfo(url);
    if (variantInfo.hasVariant) {
      console.log(`🎯 Обнаружен вариант товара: ${variantInfo.variantId}`);
    }
    
    try {
      const result = await this.executePythonScript([url], {
        timeout: options?.timeout || this.timeout
      });

      if (result.success && result.data) {
        console.log(`✅ Python парсер получил данные: ${result.data.name}`);
        console.log(`📋 Найдено характеристик: ${result.characteristics_count || 0}`);
        console.log(`🔧 Метод парсинга: ${result.parsing_method || 'unknown'}`);
        
        if (result.variant_id) {
          console.log(`🎯 Обработан вариант: ${result.variant_id}`);
        }

        // Логируем качество парсинга характеристик
        const charCount = result.data.characteristics?.length || 0;
        if (charCount > 5) {
          console.log(`🌟 Отличное качество парсинга: ${charCount} характеристик`);
        } else if (charCount > 0) {
          console.log(`⚠️ Базовое качество парсинга: ${charCount} характеристик`);
        } else {
          console.warn(`❌ Характеристики не извлечены`);
        }

        return result.data;
      } else {
        throw new Error(result.error || 'Python парсер не вернул данные');
      }

    } catch (error: any) {
      console.error(`❌ Ошибка улучшенного Python парсера: ${error.message}`);
      throw new Error(`Улучшенный Python парсер: ${error.message}`);
    }
  }

  /**
   * Извлечение информации о варианте из URL
   */
  private extractVariantInfo(url: string): {
    hasVariant: boolean;
    variantId?: string;
    productId?: string;
  } {
    try {
      const urlObj = new URL(url);
      const sizeParam = urlObj.searchParams.get('size');
      
      // Извлечение ID товара
      const productIdMatch = url.match(/\/catalog\/(\d+)\//);
      const productId = productIdMatch ? productIdMatch[1] : undefined;

      return {
        hasVariant: !!sizeParam,
        variantId: sizeParam || undefined,
        productId
      };
    } catch (error) {
      return { hasVariant: false };
    }
  }

  /**
   * Проверка существования товара
   */
  async checkProductExists(nmId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const testUrl = `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`;
      const result = await this.executePythonScript([testUrl], { timeout: 30000 });
      
      return result.success && !!result.data;
    } catch {
      return false;
    }
  }

  /**
   * Парсинг товара с конкретным вариантом
   */
  async getProductVariant(productId: string, variantId: string): Promise<WBProductData> {
    const url = `https://www.wildberries.ru/catalog/${productId}/detail.aspx?size=${variantId}`;
    return this.getProductData(url);
  }

  /**
   * Выполнение Python скрипта
   */
  private async executePythonScript(
    args: string[], 
    options?: { timeout?: number }
  ): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      const pythonCommand = this.getPythonCommand();
      const timeout = options?.timeout || this.timeout;
      
      console.log(`🐍 Выполняем: ${pythonCommand} ${this.pythonScriptPath} ${args.join(' ')}`);
      
      const pythonProcess = spawn(pythonCommand, [this.pythonScriptPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout,
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUNBUFFERED: '1'
        }
      });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      // Сбор данных из stdout
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString('utf8');
      });

      // Сбор ошибок из stderr (логи Python парсера)
      pythonProcess.stderr.on('data', (data) => {
        const stderrText = data.toString('utf8');
        stderr += stderrText;
        
        // Выводим важные логи Python в консоль Node.js
        const lines = stderrText.trim().split('\n');
       lines.forEach((line: string) => {
  if (line.includes('✅') || line.includes('❌') || line.includes('📋') || 
      line.includes('🌐') || line.includes('⚠️')) {
    console.log('🐍', line.trim());
  }
});
      });

      // Обработка завершения процесса
      pythonProcess.on('close', (code) => {
        if (isTimedOut) {
          reject(new Error(`Python процесс завершен по таймауту (${timeout}ms)`));
          return;
        }

        if (code === 0) {
          try {
            const cleanStdout = stdout.trim();
            
            if (!cleanStdout) {
              reject(new Error('Пустой ответ от Python парсера'));
              return;
            }
            
            const result: ParseResult = JSON.parse(cleanStdout);
            
            // Дополнительная валидация результата
            if (result.success && result.data) {
              this.validateProductData(result.data);
            }
            
            resolve(result);
          } catch (parseError) {
            console.error('❌ Ошибка парсинга JSON ответа:', parseError);
            console.error('Stdout (первые 500 символов):', stdout.substring(0, 500));
            
            // Попытка извлечь JSON из вывода (иногда есть лишний текст)
            const jsonMatch = stdout.match(/\{.*\}/);
            if (jsonMatch) {
              try {
                const result: ParseResult = JSON.parse(jsonMatch[0]);
                resolve(result);
                return;
              } catch {}
            }
            
            reject(new Error('Некорректный JSON ответ от Python парсера'));
          }
        } else {
          console.error(`❌ Python процесс завершился с кодом: ${code}`);
          if (stderr) {
            console.error('Stderr (первые 500 символов):', stderr.substring(0, 500));
          }
          reject(new Error(`Python процесс завершился с кодом ${code}`));
        }
      });

      // Обработка ошибок процесса
      pythonProcess.on('error', (error) => {
        console.error(`❌ Ошибка запуска Python:`, error.message);
        reject(new Error(`Ошибка запуска Python: ${error.message}`));
      });

      // Обработка таймаута
      pythonProcess.on('exit', (code, signal) => {
        if (signal === 'SIGTERM') {
          isTimedOut = true;
          reject(new Error(`Python процесс завершен по таймауту (${timeout}ms)`));
        }
      });

      // Установка таймера для принудительного завершения
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        pythonProcess.kill('SIGTERM');
        
        // Если через 5 секунд процесс не завершился, убиваем силой
        setTimeout(() => {
          if (!pythonProcess.killed) {
            pythonProcess.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      pythonProcess.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  /**
   * Валидация данных продукта
   */
  private validateProductData(data: WBProductData): void {
    if (!data.id || !data.name) {
      throw new Error('Некорректные данные товара: отсутствует ID или название');
    }

    if (data.name === `Товар ${data.id}`) {
      console.warn('⚠️ Получены fallback данные товара');
    }

    // Валидация характеристик
    if (data.characteristics) {
      data.characteristics = data.characteristics.filter(char => 
        char.name && char.value && 
        char.name.trim().length > 0 && 
        char.value.trim().length > 0
      );
    }

    // Валидация изображений
    if (data.images) {
      data.images = data.images.filter(img => 
        img && img.startsWith('http')
      );
    }
  }

  /**
   * Тестирование парсера с конкретным товаром
   */
  async test(testUrl?: string): Promise<{
    success: boolean;
    details: {
      productFound: boolean;
      characteristicsCount: number;
      parsingMethod?: string;
      variantSupport: boolean;
      htmlParsingWorked: boolean;
    };
    error?: string;
  }> {
    if (!this.isInitialized) {
      return {
        success: false,
        details: {
          productFound: false,
          characteristicsCount: 0,
          variantSupport: false,
          htmlParsingWorked: false
        },
        error: 'Парсер не инициализирован'
      };
    }

    try {
      // Тест с товаром, у которого есть характеристики
      const url = testUrl || 'https://www.wildberries.ru/catalog/221501024/detail.aspx?size=351871410';
      console.log(`🧪 Тестируем парсер с URL: ${url}`);
      
      const result = await this.getProductData(url);
      const characteristicsCount = result.characteristics?.length || 0;
      const htmlParsingWorked = characteristicsCount > 3; // HTML парсинг обычно дает больше характеристик
      
      const success = !!(result && result.name && result.name.length > 3);
      
      if (success) {
        console.log('✅ Тест улучшенного парсера прошел успешно');
        console.log(`📋 Характеристик найдено: ${characteristicsCount}`);
        console.log(`🌐 HTML парсинг: ${htmlParsingWorked ? 'Работает' : 'Не использовался'}`);
      } else {
        console.warn('⚠️ Тест парсера не прошел полностью');
      }
      
      return {
        success,
        details: {
          productFound: !!result,
          characteristicsCount,
          parsingMethod: htmlParsingWorked ? 'HTML' : 'API',
          variantSupport: !!result.variantId,
          htmlParsingWorked
        }
      };
    } catch (error: any) {
      console.error('❌ Тест парсера не прошел:', error);
      return {
        success: false,
        details: {
          productFound: false,
          characteristicsCount: 0,
          variantSupport: false,
          htmlParsingWorked: false
        },
        error: error.message
      };
    }
  }

  /**
   * Получение статуса парсера
   */
  getStatus(): {
    initialized: boolean;
    available: boolean;
    htmlParsingAvailable: boolean;
    lastError: string | null;
    scriptPath: string;
    venvPath: string;
    venvExists: boolean;
    capabilities: string[];
  } {
    const capabilities = [];
    if (this.isInitialized) {
      capabilities.push('API парсинг');
      if (this.htmlParsingAvailable) {
        capabilities.push('HTML парсинг');
        capabilities.push('Извлечение характеристик');
      }
      capabilities.push('Поддержка вариантов');
    }

    return {
      initialized: this.isInitialized,
      available: this.isInitialized,
      htmlParsingAvailable: this.htmlParsingAvailable,
      lastError: this.lastError,
      scriptPath: this.pythonScriptPath,
      venvPath: this.venvPath,
      venvExists: fs.existsSync(this.venvPath),
      capabilities
    };
  }

  /**
   * Комплексная проверка здоровья парсера
   */
  async healthCheck(): Promise<ParserHealth> {
    const details = {
      pythonAvailable: false,
      venvExists: false,
      scriptExists: false,
      requestsInstalled: false,
      beautifulSoupInstalled: false,
      htmlParsingAvailable: false,
      testPassed: false
    };

    try {
      // Проверка Python
      details.pythonAvailable = await this.checkPythonAvailability();
      
      // Проверка venv
      details.venvExists = fs.existsSync(this.venvPath);
      
      // Проверка скрипта
      details.scriptExists = fs.existsSync(this.pythonScriptPath);
      
      // Проверка зависимостей
      if (details.pythonAvailable) {
        const deps = await this.checkDependencies();
        details.requestsInstalled = deps.requests;
        details.beautifulSoupInstalled = deps.beautifulSoup;
        details.htmlParsingAvailable = deps.requests && deps.beautifulSoup;
        
        // Тест парсера
        if (details.scriptExists && details.requestsInstalled) {
          const testResult = await this.test();
          details.testPassed = testResult.success;
        }
      }

      // Определение общего статуса
      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (details.pythonAvailable && details.scriptExists && 
          details.requestsInstalled && details.testPassed) {
        if (details.beautifulSoupInstalled) {
          status = 'healthy';
        } else {
          status = 'degraded'; // Работает, но без HTML парсинга
        }
      } else if (details.pythonAvailable && details.scriptExists) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      // Определение возможностей
      const capabilities = {
        htmlParsing: details.htmlParsingAvailable,
        apiParsing: details.pythonAvailable && details.scriptExists && details.requestsInstalled,
        variantSupport: details.pythonAvailable && details.scriptExists,
        characteristicExtraction: details.htmlParsingAvailable
      };

      return { status, details, capabilities };

    } catch (error) {
      console.error('❌ Ошибка проверки здоровья парсера:', error);
      return { 
        status: 'unhealthy', 
        details,
        capabilities: {
          htmlParsing: false,
          apiParsing: false,
          variantSupport: false,
          characteristicExtraction: false
        }
      };
    }
  }

  /**
   * Получение рекомендаций по настройке
   */
  async getSetupRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    const health = await this.healthCheck();

    if (!health.details.pythonAvailable) {
      recommendations.push('Установите Python 3.7+ (https://python.org/downloads/)');
      recommendations.push('Убедитесь, что Python добавлен в PATH');
    }

    if (!health.details.venvExists) {
      recommendations.push('Создайте виртуальное окружение: python -m venv venv');
      recommendations.push('Активируйте venv: venv\\Scripts\\activate (Windows) или source venv/bin/activate (Linux/Mac)');
    }

    if (!health.details.scriptExists) {
      recommendations.push(`Создайте Python скрипт: ${this.pythonScriptPath}`);
      recommendations.push('Скопируйте обновленный код парсера в файл wb_parser.py');
    }

    if (health.details.pythonAvailable && !health.details.requestsInstalled) {
      recommendations.push('Установите базовые зависимости: pip install requests');
    }

    if (health.details.pythonAvailable && !health.details.beautifulSoupInstalled) {
      recommendations.push('Установите BeautifulSoup для HTML парсинга: pip install beautifulsoup4');
      recommendations.push('HTML парсинг значительно улучшает качество извлечения характеристик');
    }

    if (health.details.requestsInstalled && !health.details.testPassed) {
      recommendations.push('Проверьте сетевое подключение');
      recommendations.push('Убедитесь, что скрипт имеет права на выполнение');
      recommendations.push('Попробуйте запустить тест вручную: python wb_parser.py --test');
    }

    if (health.status === 'healthy') {
      recommendations.push('✅ Улучшенный Python парсер настроен корректно');
      recommendations.push('🌟 Доступны все функции: HTML парсинг, извлечение характеристик, поддержка вариантов');
    } else if (health.status === 'degraded') {
      recommendations.push('⚠️ Парсер работает в ограниченном режиме');
      if (!health.capabilities.htmlParsing) {
        recommendations.push('Для полного функционала установите: pip install beautifulsoup4');
      }
    }

    return recommendations;
  }

  /**
   * Переинициализация парсера
   */
  async reinitialize(): Promise<boolean> {
    console.log('🔄 Переинициализация улучшенного Python парсера...');
    
    this.isInitialized = false;
    this.lastError = null;
    this.htmlParsingAvailable = false;
    
    return await this.initialize();
  }

  /**
   * Установка зависимостей (экспериментально)
   */
  async installDependencies(): Promise<{
    success: boolean;
    installed: string[];
    failed: string[];
    message: string;
  }> {
    const installed: string[] = [];
    const failed: string[] = [];
    
    try {
      console.log('📦 Попытка установки зависимостей...');
      
      const result = await this.executePythonScript(['--install'], { timeout: 60000 });
      
      if (result.success) {
        // Проверяем что установилось
        const deps = await this.checkDependencies();
        if (deps.requests) installed.push('requests');
        if (deps.beautifulSoup) installed.push('beautifulsoup4');
        
        if (!deps.requests) failed.push('requests');
        if (!deps.beautifulSoup) failed.push('beautifulsoup4');
        
        return {
          success: installed.length > 0,
          installed,
          failed,
          message: installed.length > 0 
            ? `Установлено: ${installed.join(', ')}`
            : 'Установка не удалась'
        };
      } else {
        return {
          success: false,
          installed: [],
          failed: ['requests', 'beautifulsoup4'],
          message: 'Автоматическая установка не удалась. Установите вручную: pip install requests beautifulsoup4'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        installed: [],
        failed: ['requests', 'beautifulsoup4'],
        message: `Ошибка установки: ${error.message}`
      };
    }
  }

  /**
   * Очистка ресурсов
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    this.lastError = null;
    this.htmlParsingAvailable = false;
    console.log('🧹 Очистка улучшенного Python парсера завершена');
  }
}

// Создаем и экспортируем экземпляр
export const pythonWBParser = new PythonWBParser();