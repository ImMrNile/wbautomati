'use client';

import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Package, Zap, AlertCircle, CheckCircle } from 'lucide-react';

interface Cabinet {
  id: string;
  name: string;
  isActive: boolean;
}

interface ProductFormProps {
  onSuccess: () => void;
}

export default function ProductForm({ onSuccess }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    // НОВОЕ ПОЛЕ для комплектации
    packageContents: 'Кабель - 1 шт., упаковка',
    length: '',
    width: '',
    height: '',
    weight: '',
    referenceUrl: '',
    cabinetId: '',
    autoPublish: false
  });
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadCabinets();
  }, []);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    if (!selectedImage) {
      setError('Выберите изображение товара');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError('Введите корректную цену');
      return false;
    }
    // Проверка нового поля
    if (!formData.packageContents.trim()) {
      setError('Укажите комплектацию товара');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const submitFormData = new FormData();
      
      // Добавляем все данные, включая новое поле
      submitFormData.append('name', formData.name);
      submitFormData.append('price', formData.price);
      submitFormData.append('packageContents', formData.packageContents); // Добавляем комплектацию
      submitFormData.append('cabinetId', formData.cabinetId);
      submitFormData.append('autoPublish', formData.autoPublish.toString());
      
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
        setSuccess(
          formData.autoPublish 
            ? 'Товар создан и отправлен на автопубликацию!' 
            : 'Товар создан и отправлен на обработку ИИ!'
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
          autoPublish: false
        });
        setSelectedImage(null);
        setImagePreview('');
        onSuccess();
        setTimeout(() => setSuccess(''), 3000);
        
      } else {
        setError(data.error || 'Ошибка при создании товара');
      }

    } catch (error) {
      console.error('Ошибка отправки формы:', error);
      setError('Ошибка при отправке данных');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Основная информация</h3>
        
        <div className="form-group">
          <label className="form-label">Название товара *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="form-input"
            placeholder="Введите название товара"
            required
          />
        </div>

        {/* НОВЫЙ БЛОК: КОМПЛЕКТАЦИЯ */}
        <div className="form-group">
          <label className="form-label">Комплектация *</label>
          <input
            type="text"
            name="packageContents"
            value={formData.packageContents}
            onChange={handleInputChange}
            className="form-input"
            placeholder="Пример: Кабель - 1 шт., упаковка"
            required
          />
          <div className="form-hint">
            Что именно получит покупатель? Это обязательное поле для Wildberries.
          </div>
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
            step="0.01"
            required
          />
        </div>
      </div>
      
      {/* Остальная часть формы без изменений... */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Изображение товара</h3>
        <div className="form-group">
          <label className="form-label">Фото товара *</label>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="form-input"
                required
              />
            </div>
            {imagePreview && (
              <div className="w-24 h-24 border rounded-lg overflow-hidden flex-shrink-0">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover"/>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Размеры и вес</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="form-group"><label className="form-label">Длина (см) *</label><input type="number" name="length" value={formData.length} onChange={handleInputChange} className="form-input" placeholder="0" min="0.1" step="0.1" required /></div>
          <div className="form-group"><label className="form-label">Ширина (см) *</label><input type="number" name="width" value={formData.width} onChange={handleInputChange} className="form-input" placeholder="0" min="0.1" step="0.1" required /></div>
          <div className="form-group"><label className="form-label">Высота (см) *</label><input type="number" name="height" value={formData.height} onChange={handleInputChange} className="form-input" placeholder="0" min="0.1" step="0.1" required /></div>
          <div className="form-group"><label className="form-label">Вес (кг) *</label><input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className="form-input" placeholder="0" min="0.001" step="0.001" required /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Аналог с Wildberries (опционально)</h3>
        <div className="form-group">
          <label className="form-label">Ссылка на похожий товар</label>
          <input type="url" name="referenceUrl" value={formData.referenceUrl} onChange={handleInputChange} className="form-input" placeholder="https://www.wildberries.ru/catalog/123456/detail.aspx" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Настройки публикации</h3>
        <div className="form-group">
          <label className="form-label">Кабинет Wildberries *</label>
          <select name="cabinetId" value={formData.cabinetId} onChange={handleInputChange} className="form-input" required >
            <option value="">Выберите кабинет</option>
            {cabinets.map(cabinet => (<option key={cabinet.id} value={cabinet.id}>{cabinet.name}</option>))}
          </select>
        </div>
        <div className="form-group">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="autoPublish" checked={formData.autoPublish} onChange={handleInputChange} className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Автоматически опубликовать в Wildberries</span>
          </label>
        </div>
      </div>

      {error && (<div className="alert alert-error"><AlertCircle size={16} />{error}</div>)}
      {success && (<div className="alert alert-success"><CheckCircle size={16} />{success}</div>)}

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting || cabinets.length === 0} className="btn-primary">
          {isSubmitting ? (<><div className="spinner mr-2" />Обработка...</>) : formData.autoPublish ? (<><Zap size={16} />Создать и опубликовать</>) : (<><Package size={16} />Создать товар</>)}
        </button>
      </div>

      {cabinets.length === 0 && (<div className="alert alert-warning"><AlertCircle size={16} />Добавьте хотя бы один активный кабинет</div>)}
    </form>
  );
}