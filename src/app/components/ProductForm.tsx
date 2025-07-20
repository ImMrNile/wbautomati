'use client';

import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Package, Zap, AlertCircle, CheckCircle, Loader, Eye, Brain, Sparkles, RefreshCw, Search } from 'lucide-react';
import SmartCategorySelector from './SmartCategorySelector'; // Импортируем умный селектор

// Правильные типы для кабинета
interface Cabinet {
  id: string;
  name: string;
  apiToken: string; // Добавляем это поле
  isActive: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WBCategory {
  objectID?: number;
  subjectID?: number;
  id?: number;
  objectName?: string;
  subjectName?: string;
  name?: string;
}

interface ProductFormProps {
  onSuccess: () => void;
}

interface ProcessingStatus {
  stage: 'uploading' | 'ai-analysis' | 'wb-validation' | 'publishing' | 'completed' | 'error';
  message: string;
  progress: number;
}

export default function EnhancedProductFormWithVendor({ onSuccess }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    packageContents: 'Кабель - 1 шт., упаковка',
    length: '',
    width: '',
    height: '',
    weight: '',
    referenceUrl: '',
    cabinetId: '',
    autoPublish: false,
    // НОВЫЕ ПОЛЯ
    vendorCode: '',
    autoGenerateVendorCode: true,
    selectedCategoryId: '',
    categorySearchQuery: '',
    barcode: '' // Добавляем поле для баркода
  });
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadCabinets();
  }, []);

  useEffect(() => {
    // Автогенерация артикула и баркода
    if (formData.autoGenerateVendorCode) {
      generateVendorCode();
      generateBarcode(); // Также генерируем баркод
    }
  }, [formData.autoGenerateVendorCode, formData.name]);

  const loadCabinets = async () => {
    try {
      const response = await fetch('/api/cabinets');
      const data = await response.json();
      const activeCabinets = data.cabinets.filter((c: Cabinet) => c.isActive);
      setCabinets(activeCabinets);
      
      if (activeCabinets.length > 0) {
        setFormData(prev => ({ ...prev, cabinetId: activeCabinets[0].id }));
      }
    } catch (error) {
      console.error('Ошибка загрузки кабинетов:', error);
    }
  };

  const generateVendorCode = () => {
    const prefix = 'WB';
    const timestamp = Date.now().toString().slice(-6);
    const productPrefix = formData.name ? formData.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') : 'PRD';
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    const newVendorCode = `${prefix}-${productPrefix || 'PRD'}-${timestamp}-${random}`;
    setFormData(prev => ({ ...prev, vendorCode: newVendorCode }));
  };

  const generateBarcode = () => {
    // Генерируем EAN-13 баркод
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    const baseCode = (timestamp + random).slice(0, 12);
    
    // Вычисляем контрольную цифру
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(baseCode[i], 10);
      if (i % 2 === 0) {
        sum += digit;
      } else {
        sum += digit * 3;
      }
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const barcode = baseCode + checkDigit;
    
    setFormData(prev => ({ ...prev, barcode }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите файл изображения');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setError('Размер файла не должен превышать 10MB');
        return;
      }

      setSelectedImage(file);
      setError('');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Введите название товара');
      return false;
    }
    
    if (formData.name.length > 60) {
      setError('Название товара не должно превышать 60 символов');
      return false;
    }
    
    if (!selectedImage) {
      setError('Выберите изображение товара');
      return false;
    }
    
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError('Введите корректную цену');
      return false;
    }
    
    if (!formData.packageContents.trim()) {
      setError('Укажите комплектацию товара');
      return false;
    }
    
    if (!formData.vendorCode.trim()) {
      setError('Укажите артикул товара');
      return false;
    }
    
    if (formData.vendorCode.length > 75) {
      setError('Артикул не должен превышать 75 символов');
      return false;
    }
    
    if (!formData.length || !formData.width || !formData.height || !formData.weight) {
      setError('Заполните все размеры и вес товара');
      return false;
    }
    
    if (!formData.cabinetId) {
      setError('Выберите кабинет для публикации');
      return false;
    }
    
    return true;
  };

  const simulateProcessing = () => {
    const stages: ProcessingStatus[] = [
      { stage: 'uploading', message: 'Загружаем изображение...', progress: 20 },
      { stage: 'ai-analysis', message: 'ИИ анализирует товар...', progress: 40 },
      { stage: 'wb-validation', message: 'Проверяем данные в Wildberries...', progress: 70 },
      { stage: 'publishing', message: 'Создаем карточку товара...', progress: 90 },
      { stage: 'completed', message: 'Готово!', progress: 100 }
    ];

    let currentStage = 0;
    
    const updateStatus = () => {
      if (currentStage < stages.length) {
        setProcessingStatus(stages[currentStage]);
        currentStage++;
        
        if (currentStage < stages.length) {
          setTimeout(updateStatus, 2000 + Math.random() * 3000);
        }
      }
    };
    
    updateStatus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    setProcessingStatus(null);

    simulateProcessing();

    try {
      const submitFormData = new FormData();
      
      // Добавляем все данные включая новые поля
      submitFormData.append('name', formData.name);
      submitFormData.append('price', formData.price);
      submitFormData.append('packageContents', formData.packageContents);
      submitFormData.append('cabinetId', formData.cabinetId);
      submitFormData.append('autoPublish', formData.autoPublish.toString());
      submitFormData.append('vendorCode', formData.vendorCode); // Новое поле
      
      if (formData.selectedCategoryId) {
        submitFormData.append('categoryId', formData.selectedCategoryId); // Новое поле
      }
      
      if (formData.referenceUrl) {
        submitFormData.append('referenceUrl', formData.referenceUrl);
      }
      
      if (selectedImage) {
        submitFormData.append('image', selectedImage);
      }
      
      const dimensions = {
        length: parseFloat(formData.length),
        width: parseFloat(formData.width),
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight)
      };
      submitFormData.append('dimensions', JSON.stringify(dimensions));

      const response = await fetch('/api/products', {
        method: 'POST',
        body: submitFormData
      });

      const data = await response.json();

      if (response.ok) {
        setProcessingStatus({ 
          stage: 'completed', 
          message: 'Товар успешно создан!', 
          progress: 100 
        });
        
        setSuccess(
          formData.autoPublish 
            ? 'Товар создан и отправлен на автопубликацию в Wildberries!' 
            : 'Товар создан и готов к ручной проверке!'
        );
        
        // Очистка формы
        setFormData({
          name: '',
          price: '',
          packageContents: 'Кабель - 1 шт., упаковка',
          length: '',
          width: '',
          height: '',
          weight: '',
          referenceUrl: '',
          cabinetId: cabinets[0]?.id || '',
          autoPublish: false,
          vendorCode: '',
          autoGenerateVendorCode: true,
          selectedCategoryId: '',
          categorySearchQuery: '',
          barcode: '' // Сбрасываем баркод
        });
        setSelectedImage(null);
        setImagePreview('');
        
        onSuccess();
        setTimeout(() => {
          setSuccess('');
          setProcessingStatus(null);
        }, 5000);
        
      } else {
        setProcessingStatus({ 
          stage: 'error', 
          message: 'Произошла ошибка', 
          progress: 0 
        });
        setError(data.error || 'Ошибка при создании товара');
      }

    } catch (error) {
      console.error('Ошибка отправки формы:', error);
      setProcessingStatus({ 
        stage: 'error', 
        message: 'Ошибка соединения', 
        progress: 0 
      });
      setError('Ошибка при отправке данных. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'uploading': return <Upload className="w-4 h-4" />;
      case 'ai-analysis': return <Brain className="w-4 h-4" />;
      case 'wb-validation': return <Eye className="w-4 h-4" />;
      case 'publishing': return <Sparkles className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Loader className="w-4 h-4 animate-spin" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Статус обработки */}
      {processingStatus && (
        <div className="mb-6 bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            {getStageIcon(processingStatus.stage)}
            <span className="font-medium">{processingStatus.message}</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                processingStatus.stage === 'error' ? 'bg-red-500' : 
                processingStatus.stage === 'completed' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${processingStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Основная информация */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Основная информация</h3>
          </div>
          
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">
                Название товара *
                <span className="text-sm text-gray-500 font-normal ml-2">
                  ({formData.name.length}/60)
                </span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Введите название товара"
                maxLength={60}
                required
              />
            </div>

            {/* НОВЫЙ БЛОК: АРТИКУЛ И БАРКОД */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Артикул товара *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="vendorCode"
                    value={formData.vendorCode}
                    onChange={handleInputChange}
                    className="form-input flex-1"
                    placeholder="Введите артикул или включите автогенерацию"
                    maxLength={75}
                    disabled={formData.autoGenerateVendorCode}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      generateVendorCode();
                      generateBarcode();
                    }}
                    className="btn-secondary"
                    title="Генерировать новый артикул и баркод"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Баркод (EAN-13)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleInputChange}
                    className="form-input flex-1"
                    placeholder="Автоматически сгенерируется"
                    maxLength={13}
                    disabled={formData.autoGenerateVendorCode}
                  />
                  <button
                    type="button"
                    onClick={generateBarcode}
                    className="btn-secondary"
                    title="Сгенерировать новый баркод"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Формат EAN-13, генерируется автоматически
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="autoGenerateVendorCode"
                checked={formData.autoGenerateVendorCode}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-600">Автоматически генерировать артикул и баркод</span>
            </div>

            <div className="form-group">
              <label className="form-label">Комплектация *</label>
              <textarea
                name="packageContents"
                value={formData.packageContents}
                onChange={handleInputChange}
                className="form-input min-h-[80px]"
                placeholder="Пример: Кабель USB-C - 1 шт., упаковка - 1 шт."
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Цена (₽) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                className="form-input"
                placeholder="0"
                min="1"
                max="999999999"
                step="0.01"
                required
              />
            </div>
          </div>
        </div>

        {/* УМНЫЙ БЛОК: ВЫБОР КАТЕГОРИИ С ИИ-ПРЕДЛОЖЕНИЯМИ */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Категория Wildberries</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              ИИ-предложения
            </span>
          </div>
          
          <div className="space-y-4">
            {formData.cabinetId ? (
              <SmartCategorySelector
                apiToken={cabinets.find(c => c.id === formData.cabinetId)?.apiToken || ''}
                productName={formData.name}
                onCategorySelect={(category) => {
                  setFormData(prev => ({
                    ...prev,
                    selectedCategoryId: category.objectID.toString(),
                    categorySearchQuery: category.objectName
                  }));
                }}
                selectedCategoryId={formData.selectedCategoryId}
                className="w-full"
              />
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-sm text-yellow-800">
                  Сначала выберите кабинет для загрузки категорий
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Изображение товара */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <ImageIcon className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Изображение товара</h3>
          </div>
          
          <div className="form-group">
            <label className="form-label">Фото товара *</label>
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="form-input"
                  required={!selectedImage}
                />
                <div className="form-hint mt-2">
                  Поддерживаются: JPG, PNG, WebP, GIF. Максимум 10MB
                </div>
              </div>
              {imagePreview && (
                <div className="w-32 h-32 border rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Размеры и вес */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-6">Размеры упаковки и вес</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="form-group">
              <label className="form-label">Длина (см) *</label>
              <input 
                type="number" 
                name="length" 
                value={formData.length} 
                onChange={handleInputChange} 
                className="form-input" 
                placeholder="0" 
                min="0.1" 
                max="1000"
                step="0.1" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ширина (см) *</label>
              <input 
                type="number" 
                name="width" 
                value={formData.width} 
                onChange={handleInputChange} 
                className="form-input" 
                placeholder="0" 
                min="0.1" 
                max="1000"
                step="0.1" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Высота (см) *</label>
              <input 
                type="number" 
                name="height" 
                value={formData.height} 
                onChange={handleInputChange} 
                className="form-input" 
                placeholder="0" 
                min="0.1" 
                max="1000"
                step="0.1" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Вес (кг) *</label>
              <input 
                type="number" 
                name="weight" 
                value={formData.weight} 
                onChange={handleInputChange} 
                className="form-input" 
                placeholder="0" 
                min="0.001" 
                max="1000"
                step="0.001" 
                required 
              />
            </div>
          </div>
          <div className="form-hint mt-4">
            Укажите размеры упакованного товара в том виде, в котором он будет отправлен покупателю
          </div>
        </div>

        {/* Дополнительные настройки */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Дополнительные настройки</h3>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showAdvanced ? 'Скрыть' : 'Показать дополнительные настройки'}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 mb-6">
              <div className="form-group">
                <label className="form-label">Ссылка на товар-аналог (опционально)</label>
                <input 
                  type="url" 
                  name="referenceUrl" 
                  value={formData.referenceUrl} 
                  onChange={handleInputChange} 
                  className="form-input" 
                  placeholder="https://www.wildberries.ru/catalog/123456/detail.aspx" 
                />
                <div className="form-hint">
                  Поможет ИИ лучше понять характеристики и категорию товара
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Кабинет Wildberries *</label>
              <select 
                name="cabinetId" 
                value={formData.cabinetId} 
                onChange={handleInputChange} 
                className="form-input" 
                required 
              >
                <option value="">Выберите кабинет</option>
                {cabinets.map(cabinet => (
                  <option key={cabinet.id} value={cabinet.id}>
                    {cabinet.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  name="autoPublish" 
                  checked={formData.autoPublish} 
                  onChange={handleInputChange} 
                  className="w-4 h-4 text-blue-600 mt-1" 
                />
                <div>
                  <span className="text-sm font-medium">Автоматически опубликовать в Wildberries</span>
                  <p className="text-sm text-gray-600 mt-1">
                    Товар будет сразу отправлен на модерацию. Если отключено, 
                    вы сможете проверить и отредактировать данные перед публикацией.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Сообщения об ошибках и успехе */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {/* Кнопки действий */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {cabinets.length === 0 && (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertCircle size={16} />
                Добавьте хотя бы один активный кабинет для продолжения
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            disabled={isSubmitting || cabinets.length === 0} 
            className="btn-primary min-w-[200px]"
          >
            {isSubmitting ? (
              <>
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Обрабатываем...
              </>
            ) : formData.autoPublish ? (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Создать и опубликовать
              </>
            ) : (
              <>
                <Package className="w-4 h-4 mr-2" />
                Создать товар
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}