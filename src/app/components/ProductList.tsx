// app/components/ProductList.tsx

'use client';

import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, AlertCircle, ExternalLink, Edit3 } from 'lucide-react';
import PublishModal from './PublishModal';

interface Product {
  id: string;
  originalName: string;
  generatedName?: string;
  originalImage: string;
  price: number;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'PUBLISHED' | 'ERROR';
  suggestedCategory?: string;
  colorAnalysis?: string;
  seoDescription?: string;
  createdAt: string;
  productCabinets: Array<{
    id: string;
    isSelected: boolean;
    isPublished: boolean;
    wbCardId?: string;
    cabinet: {
      id: string;
      name: string;
    };
  }>;
}

interface ProductListProps {
  onUpdate: () => void;
}

export default function ProductList({ onUpdate }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadProducts();
  }, [filter]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? '/api/products' 
        : `/api/products?status=${filter}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Product['status']) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'PROCESSING':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'READY':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PUBLISHED':
        return <ExternalLink className="w-4 h-4 text-blue-500" />;
      case 'ERROR':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: Product['status']) => {
    switch (status) {
      case 'PENDING': return 'Ожидание';
      case 'PROCESSING': return 'Обработка ИИ';
      case 'READY': return 'Готов к публикации';
      case 'PUBLISHED': return 'Опубликован';
      case 'ERROR': return 'Ошибка';
      default: return 'Неизвестно';
    }
  };

  const getStatusColor = (status: Product['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-gray-100 text-gray-800';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800';
      case 'READY': return 'bg-green-100 text-green-800';
      case 'PUBLISHED': return 'bg-purple-100 text-purple-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePublish = (product: Product) => {
    setSelectedProduct(product);
    setShowPublishModal(true);
  };

  const handlePublishSuccess = () => {
    setShowPublishModal(false);
    setSelectedProduct(null);
    loadProducts();
    onUpdate();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <div className="flex space-x-4">
        {[
          { key: 'all', label: 'Все товары' },
          { key: 'PROCESSING', label: 'В обработке' },
          { key: 'READY', label: 'Готовые' },
          { key: 'PUBLISHED', label: 'Опубликованные' },
          { key: 'ERROR', label: 'С ошибками' }
        ].map((filterOption) => (
          <button
            key={filterOption.key}
            onClick={() => setFilter(filterOption.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === filterOption.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {filterOption.label}
          </button>
        ))}
      </div>

      {/* Список товаров */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'all' ? 'Нет товаров' : 'Нет товаров с выбранным статусом'}
          </h3>
          <p className="text-gray-500">
            {filter === 'all' 
              ? 'Загрузите первый товар через форму выше'
              : 'Попробуйте изменить фильтр'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow border overflow-hidden">
              <div className="p-6">
                <div className="flex items-start space-x-4">
                  {/* Изображение */}
                  <div className="flex-shrink-0">
                    <img
                      src={product.originalImage}
                      alt={product.originalName}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  </div>

                  {/* Основная информация */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                          {product.generatedName || product.originalName}
                        </h3>
                        
                        {product.generatedName && product.generatedName !== product.originalName && (
                          <p className="text-sm text-gray-600 mb-2">
                            Исходное: {product.originalName}
                          </p>
                        )}

                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                          <span className="font-medium text-lg text-gray-900">
                            {product.price.toLocaleString('ru-RU')} ₽
                          </span>
                          {product.suggestedCategory && (
                            <span>Категория: {product.suggestedCategory}</span>
                          )}
                          {product.colorAnalysis && (
                            <span>Цвет: {product.colorAnalysis}</span>
                          )}
                        </div>

                        {product.seoDescription && (
                          <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                            {product.seoDescription}
                          </p>
                        )}
                      </div>

                      {/* Статус */}
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                          {getStatusIcon(product.status)}
                          <span className="ml-1">{getStatusText(product.status)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Кабинеты */}
                    {product.productCabinets.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">Кабинеты:</p>
                        <div className="flex flex-wrap gap-2">
                          {product.productCabinets.map((pc) => (
                            <span
                              key={pc.id}
                              className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                                pc.isPublished
                                  ? 'bg-green-100 text-green-800'
                                  : pc.isSelected
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {pc.cabinet.name}
                              {pc.isPublished && <CheckCircle className="w-3 h-3 ml-1" />}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Действия */}
                    <div className="mt-4 flex items-center space-x-3">
                      {product.status === 'READY' && (
                        <button
                          onClick={() => handlePublish(product)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Опубликовать
                        </button>
                      )}
                      
                      {product.status === 'ERROR' && (
                        <button
                          onClick={() => {/* Retry logic */}}
                          className="inline-flex items-center px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 transition-colors"
                        >
                          Повторить
                        </button>
                      )}

                      <span className="text-xs text-gray-500">
                        Создан: {new Date(product.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модал публикации */}
      {showPublishModal && selectedProduct && (
        <PublishModal
          product={selectedProduct}
          onClose={() => setShowPublishModal(false)}
          onSuccess={handlePublishSuccess}
        />
      )}
    </div>
  );
}