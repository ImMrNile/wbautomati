// lib/services/uploadService.ts

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export class UploadService {
  private uploadDir = join(process.cwd(), 'public', 'uploads');

  // Загрузка файла в локальную папку
  async uploadFile(file: File): Promise<string> {
    try {
      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
        throw new Error('Поддерживаются только изображения');
      }

      // Генерируем уникальное имя файла
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${randomUUID()}.${fileExtension}`;
      
      // Создаем путь для сохранения
      const filePath = join(this.uploadDir, fileName);
      
      // Получаем данные файла
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Создаем папку, если она не существует
      await mkdir(this.uploadDir, { recursive: true });

      // Сохраняем файл
      await writeFile(filePath, buffer);
      
      // Возвращаем URL для доступа к файлу
      return `/uploads/${fileName}`;

    } catch (error) {
      console.error('Ошибка загрузки файла:', error);
      throw new Error('Не удалось загрузить файл');
    }
  }

  // Валидация изображения
  validateImage(file: File): { valid: boolean; error?: string } {
    // Проверяем размер (максимум 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { valid: false, error: 'Размер файла не должен превышать 10MB' };
    }

    // Проверяем тип файла
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Поддерживаются только форматы: JPEG, PNG, WebP' };
    }

    return { valid: true };
  }

  // Получение информации о файле
  getFileInfo(file: File) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };
  }
}

// Экспортируем экземпляр сервиса
export const uploadService = new UploadService();