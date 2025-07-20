// components/CategorySelector.tsx

'use client';

import React, { useState, useEffect } from 'react';

// Тип для узла дерева категорий
interface CategoryNode {
  id: number;
  name: string;
  children: CategoryNode[];
  isLeaf: boolean;
  fullPath: string[];
}

// Компонент для отображения одного узла дерева
const CategoryTreeNode = ({ node, onSelect, selectedId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = node.id === selectedId;

  const handleToggle = () => {
    if (!node.isLeaf) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = () => {
    // Выбирать можно только конечные категории (у которых нет дочерних)
    if (node.isLeaf) {
      onSelect(node.id, node.fullPath.join(' / '));
    } else {
      // Если кликнули на родителя, просто открываем/закрываем его
      handleToggle();
    }
  };

  return (
    <div style={{ marginLeft: '20px' }}>
      <div 
        onClick={handleSelect} 
        style={{ 
          cursor: node.isLeaf ? 'pointer' : 'default', 
          color: isSelected ? 'blue' : 'black',
          fontWeight: isSelected ? 'bold' : 'normal',
          padding: '5px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {!node.isLeaf && (
          <span onClick={handleToggle} style={{ cursor: 'pointer', marginRight: '5px' }}>
            {isOpen ? '▼' : '►'}
          </span>
        )}
        {node.name} {node.isLeaf ? '' : `(${node.children.length})`}
      </div>
      {isOpen && !node.isLeaf && (
        <div>
          {node.children.map(child => (
            <CategoryTreeNode key={child.id} node={child} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
};

// Основной компонент выбора категорий
export const CategorySelector = ({ apiToken, onCategorySelect }) => {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');

  useEffect(() => {
    const fetchTree = async () => {
      if (!apiToken) {
        setLoading(false);
        setError("API токен не предоставлен.");
        return;
      }
      try {
        setLoading(true);
        const response = await fetch('/api/wb-categories/hierarchy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiToken })
        });
        const result = await response.json();
        if (result.success) {
          setTree(result.data);
        } else {
          throw new Error(result.error);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, [apiToken]);
  
  const handleSelect = (id, path) => {
    setSelectedId(id);
    setSelectedPath(path);
    onCategorySelect(id); // Передаем выбранный ID наверх
  };

  if (loading) return <div>Загрузка категорий...</div>;
  if (error) return <div style={{color: 'red'}}>Ошибка: {error}</div>;

  return (
    <div>
        <h4>Выберите категорию товара</h4>
        {selectedPath && <p><strong>Выбрано:</strong> {selectedPath}</p>}
        <div style={{ border: '1px solid #ccc', padding: '10px', maxHeight: '400px', overflowY: 'auto' }}>
            {tree.map(node => (
                <CategoryTreeNode key={node.id} node={node} onSelect={handleSelect} selectedId={selectedId} />
            ))}
        </div>
    </div>
  );
};