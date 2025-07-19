// lib/services/uploadService.ts - ОБНОВЛЕННАЯ ВЕРСИЯ с безопасной обработкой файлов

export class UploadService {
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];

  /**
   * Загрузка файла с валидацией и безопасной обработкой
   */
  async uploadFile(file: File): Promise<string> {
    try {
      console.log('📤 Загружаем файл:', file.name, `(${this.formatFileSize(file.size)})`);
      
      // Валидация файла
      this.validateFile(file);
      
      // TODO: Implement real file upload (Supabase Storage, Cloudinary, AWS S3, etc.)
      // Для демонстрации конвертируем в data URL
      const dataUrl = await this.convertToDataUrl(file);
      
      console.log('✅ Файл успешно обработан');
      return dataUrl;
      
      // Альтернативный код для реальной загрузки:
      /*
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      const result = await response.json();
      return result.url;
      */
      
    } catch (error) {
      console.error('❌ Ошибка загрузки файла:', error);
      throw new Error(`Не удалось загрузить файл: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }

  /**
   * Валидация загружаемого файла
   */
  private validateFile(file: File): void {
    // Проверка размера
    if (file.size > this.maxFileSize) {
      throw new Error(`Файл слишком большой. Максимальный размер: ${this.formatFileSize(this.maxFileSize)}`);
    }

    // Проверка типа
    if (!this.allowedTypes.includes(file.type)) {
      throw new Error(`Неподдерживаемый тип файла. Разрешены: ${this.allowedTypes.join(', ')}`);
    }

    // Проверка расширения файла (дополнительная безопасность)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`Неподдерживаемое расширение файла: ${fileExtension}`);
    }

    console.log('✅ Файл прошел валидацию');
  }

  /**
   * Конвертация файла в data URL (для демонстрации)
   */
private async convertToDataUrl(file: File): Promise<string> {
    // Этот метод вызывается на сервере, где нет FileReader
    // Мы конвертируем файл в ArrayBuffer, затем в Buffer, затем в Base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    return `data:${file.type};base64,${base64}`;
  }

 
  /**
   * Форматирование размера файла для отображения
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Удаление файла (заглушка)
   */
  async deleteFile(url: string): Promise<boolean> {
    try {
      console.log('🗑️ Удаляем файл:', url);
      
      // TODO: Implement real file deletion
      // Для data URLs ничего не нужно делать
      if (url.startsWith('data:')) {
        return true;
      }
      
      // Для реальных URLs:
      /*
      const response = await fetch('/api/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      return response.ok;
      */
      
      return true;
    } catch (error) {
      console.error('❌ Ошибка удаления файла:', error);
      return false;
    }
  }

  /**
   * Получение информации о файле по URL
   */
  async getFileInfo(url: string): Promise<{
    exists: boolean;
    size?: number;
    type?: string;
    lastModified?: Date;
  }> {
    try {
      // Для data URLs
      if (url.startsWith('data:')) {
        const mimeMatch = url.match(/^data:([^;]+)/);
        const base64Data = url.split(',')[1];
        
        return {
          exists: true,
          type: mimeMatch ? mimeMatch[1] : 'unknown',
          size: base64Data ? Math.floor(base64Data.length * 0.75) : 0 // Примерный размер
        };
      }

      // Для обычных URLs
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        return { exists: false };
      }

      return {
        exists: true,
        size: parseInt(response.headers.get('content-length') || '0'),
        type: response.headers.get('content-type') || 'unknown',
        lastModified: response.headers.get('last-modified') 
          ? new Date(response.headers.get('last-modified')!) 
          : undefined
      };

    } catch (error) {
      console.warn('⚠️ Не удалось получить информацию о файле:', error);
      return { exists: false };
    }
  }

  /**
   * Массовая загрузка файлов
   */
  async uploadMultipleFiles(files: FileList | File[]): Promise<{
    successful: string[];
    failed: Array<{ file: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ file: string; error: string }> = [];

    const fileArray = Array.from(files);
    
    console.log(`📤 Загружаем ${fileArray.length} файлов...`);

    for (const file of fileArray) {
      try {
        const url = await this.uploadFile(file);
        successful.push(url);
        console.log(`✅ ${file.name} загружен успешно`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        failed.push({ file: file.name, error: errorMessage });
        console.error(`❌ ${file.name} не загружен:`, errorMessage);
      }
    }

    console.log(`📊 Результат загрузки: ${successful.length} успешно, ${failed.length} с ошибками`);

    return { successful, failed };
  }

  /**
   * Проверка доступности сервиса загрузки
   */
  async checkServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
  }> {
    try {
      // TODO: Implement real health check
      // Для заглушки всегда возвращаем healthy
      return {
        status: 'healthy',
        message: 'Сервис загрузки работает нормально (заглушка)'
      };

      /*
      // Реальная проверка здоровья:
      const response = await fetch('/api/upload/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        return {
          status: 'healthy',
          message: 'Сервис загрузки работает нормально'
        };
      } else {
        return {
          status: 'degraded',
          message: `Сервис работает с ограничениями: HTTP ${response.status}`
        };
      }
      */

    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Сервис недоступен: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      };
    }
  }

  /**
   * Получение настроек загрузки
   */
  getUploadSettings() {
    return {
      maxFileSize: this.maxFileSize,
      maxFileSizeFormatted: this.formatFileSize(this.maxFileSize),
      allowedTypes: this.allowedTypes,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    };
  }

  /**
   * Компрессия изображения (базовая реализация)
   */
  async compressImage(file: File, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Вычисляем новые размеры (максимум 1920x1080)
        const maxWidth = 1920;
        const maxHeight = 1080;
        
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Рисуем сжатое изображение
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Не удалось сжать изображение'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Не удалось загрузить изображение для сжатия'));
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

export const uploadService = new UploadService();