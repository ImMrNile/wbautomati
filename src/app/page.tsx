// src/app/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Upload, Settings, Package, TrendingUp } from 'lucide-react';
import ProductForm from './components/ProductForm';
import ProductList from './components/ProductList';
import CabinetManager from './components/CabinetManager';

type Tab = 'upload' | 'products' | 'cabinets' | 'analytics';

interface Stats {
  totalProducts: number;
  processingProducts: number;
  publishedProducts: number;
  activeCabinets: number;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    processingProducts: 0,
    publishedProducts: 0,
    activeCabinets: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [productsRes, cabinetsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/cabinets')
      ]);

      const productsData = await productsRes.json();
      const cabinetsData = await cabinetsRes.json();

      setStats({
        totalProducts: productsData.pagination?.total || 0,
        processingProducts: productsData.products?.filter((p: any) => p.status === 'PROCESSING').length || 0,
        publishedProducts: productsData.products?.filter((p: any) => p.status === 'PUBLISHED').length || 0,
        activeCabinets: cabinetsData.cabinets?.filter((c: any) => c.isActive).length || 0
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  const tabs = [
    { id: 'upload' as Tab, label: 'Загрузить товар', icon: Upload },
    { id: 'products' as Tab, label: 'Мои товары', icon: Package },
    { id: 'cabinets' as Tab, label: 'Кабинеты WB', icon: Settings },
    { id: 'analytics' as Tab, label: 'Аналитика', icon: TrendingUp }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'white', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
        borderBottom: '1px solid #e5e7eb' 
      }}>
        <div style={{ 
          maxWidth: '1280px', 
          margin: '0 auto', 
          padding: '0 16px' 
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            height: '64px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: '#111827',
                margin: 0
              }}>
                WB Automation
              </h1>
              <span style={{ 
                marginLeft: '12px', 
                padding: '2px 8px', 
                backgroundColor: '#dbeafe', 
                color: '#1e40af', 
                fontSize: '12px', 
                borderRadius: '9999px' 
              }}>
                v1.0
              </span>
            </div>
            
            {/* Stats Dashboard */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '24px' 
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                  {stats.totalProducts}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Товаров</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>
                  {stats.processingProducts}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Обработка</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                  {stats.publishedProducts}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Опубликовано</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
                  {stats.activeCabinets}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Кабинетов</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ 
          maxWidth: '1280px', 
          margin: '0 auto', 
          padding: '0 16px' 
        }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 12px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    backgroundColor: 'transparent',
                    borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                    color: activeTab === tab.id ? '#2563eb' : '#6b7280',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.color = '#374151';
                      e.currentTarget.style.borderBottomColor = '#d1d5db';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.color = '#6b7280';
                      e.currentTarget.style.borderBottomColor = 'transparent';
                    }
                  }}
                >
                  <Icon style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ 
        maxWidth: '1280px', 
        margin: '0 auto', 
        padding: '32px 16px' 
      }}>
        {activeTab === 'upload' && (
          <div style={{ maxWidth: '672px', margin: '0 auto' }}>
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px', margin: '0 0 24px 0' }}>
                Загрузить новый товар
              </h2>
              <ProductForm onSuccess={loadStats} />
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px' 
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Мои товары</h2>
              <button
                onClick={loadStats}
                className="btn-primary"
              >
                Обновить
              </button>
            </div>
            <ProductList onUpdate={loadStats} />
          </div>
        )}

        {activeTab === 'cabinets' && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px' 
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Кабинеты Wildberries</h2>
            </div>
            <CabinetManager onUpdate={loadStats} />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px', margin: '0 0 24px 0' }}>
              Аналитика
            </h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '24px', 
              marginBottom: '32px' 
            }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                padding: '24px', 
                borderRadius: '8px', 
                color: 'white' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0 0 4px 0' }}>Всего товаров</p>
                    <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{stats.totalProducts}</p>
                  </div>
                  <Package style={{ width: '32px', height: '32px', opacity: 0.8 }} />
                </div>
              </div>
              
              <div style={{ 
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                padding: '24px', 
                borderRadius: '8px', 
                color: 'white' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0 0 4px 0' }}>В обработке</p>
                    <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{stats.processingProducts}</p>
                  </div>
                  <TrendingUp style={{ width: '32px', height: '32px', opacity: 0.8 }} />
                </div>
              </div>
              
              <div style={{ 
                background: 'linear-gradient(135deg, #10b981, #059669)', 
                padding: '24px', 
                borderRadius: '8px', 
                color: 'white' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0 0 4px 0' }}>Опубликовано</p>
                    <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{stats.publishedProducts}</p>
                  </div>
                  <Upload style={{ width: '32px', height: '32px', opacity: 0.8 }} />
                </div>
              </div>
              
              <div style={{ 
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', 
                padding: '24px', 
                borderRadius: '8px', 
                color: 'white' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0 0 4px 0' }}>Активных кабинетов</p>
                    <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{stats.activeCabinets}</p>
                  </div>
                  <Settings style={{ width: '32px', height: '32px', opacity: 0.8 }} />
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <p style={{ margin: 0 }}>Расширенная аналитика будет доступна в следующих версиях</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
