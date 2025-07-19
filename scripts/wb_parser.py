#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Обновленный Wildberries Parser 2025 - с улучшенным парсингом характеристик
Основан на анализе HTML структуры страниц WB
"""

import json
import time
import random
import sys
import re
import os
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, asdict
import logging
from urllib.parse import urlencode, urlparse, parse_qs

# Проверка доступности requests с fallback
try:
    import requests
    from bs4 import BeautifulSoup
    HAS_REQUESTS = True
    HAS_BS4 = True
except ImportError:
    HAS_REQUESTS = False
    HAS_BS4 = False
    # Простой fallback без requests
    class MockRequests:
        class Session:
            def __init__(self):
                self.headers = {}
            def get(self, *args, **kwargs):
                raise Exception("requests module not available")
            def head(self, *args, **kwargs):
                raise Exception("requests module not available")
        def Session(self):
            return MockRequests.Session()
    requests = MockRequests()
    BeautifulSoup = None

# Настройка кодировки для Windows
if sys.platform.startswith('win'):
    import codecs
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger(__name__)

@dataclass
class WBProductData:
    """Структура данных товара WB с полной совместимостью"""
    id: str
    name: str
    brand: str
    price: int
    rating: float
    reviewsCount: int
    description: str
    characteristics: List[Dict[str, str]]
    images: List[str]
    category: str
    categoryId: Optional[int] = None
    availability: bool = True
    vendorCode: str = ""
    supplierId: Optional[str] = None
    tnved: str = "8544429009"
    variantId: Optional[str] = None  # ID конкретного варианта (size parameter)

class WildberriesParser:
    """Улучшенный парсер Wildberries с парсингом характеристик из HTML"""
    
    def __init__(self):
        self.session = requests.Session() if HAS_REQUESTS else None
        
        if self.session:
            self.session.verify = True
        
        # Обновленные User-Agent для 2025
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ]
        
        # Обновленные заголовки
        self.base_headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        }
        
        # Обновленные параметры API (основано на анализе GitHub проектов)
        self.default_params = {
            'curr': 'rub',
            'dest': '-1257786',  # Москва
            'spp': '30',
            'appType': '1',
            'version': '2'
        }
        
        # Актуальные API endpoints
        self.endpoints = {
            'card_detail': 'https://card.wb.ru/cards/detail',
            'card_detail_v2': 'https://card.wb.ru/cards/v2/detail',
            'search_v5': 'https://search.wb.ru/exactmatch/ru/common/v5/search',
            'search_v4': 'https://search.wb.ru/exactmatch/ru/common/v4/search',
            'enrichment': 'https://card.wb.ru/cards/v1/detail',
            'basket_base': 'https://basket-{}.wbbasket.ru'
        }
        
        # Счетчики для статистики
        self.request_count = 0
        self.success_count = 0
        self.failure_count = 0
    
    def get_random_headers(self) -> Dict[str, str]:
        """Получение случайных заголовков с ротацией User-Agent"""
        headers = self.base_headers.copy()
        headers['User-Agent'] = random.choice(self.user_agents)
        headers['Referer'] = 'https://www.wildberries.ru/'
        return headers
    
    def apply_rate_limit(self, min_delay: float = 0.5, max_delay: float = 2.0):
        """Применение rate limiting с случайной задержкой"""
        delay = random.uniform(min_delay, max_delay)
        time.sleep(delay)
    
    def extract_product_id(self, url: str) -> Optional[str]:
        """Извлечение ID товара из URL"""
        patterns = [
            r'/catalog/(\d+)/detail\.aspx',
            r'/catalog/(\d+)(?:/|$|\?)',
            r'product/(\d+)',
            r'detail/(\d+)',
            r'nm[=:]?(\d+)',
            r'(?:^|\D)(\d{6,12})(?:\D|$)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                nm_id = match.group(1)
                if 6 <= len(nm_id) <= 12:
                    return nm_id
        return None
    
    def extract_size_parameter(self, url: str) -> Optional[str]:
        """Извлечение параметра size из URL для конкретного варианта товара"""
        try:
            parsed_url = urlparse(url)
            query_params = parse_qs(parsed_url.query)
            
            if 'size' in query_params:
                size_param = query_params['size'][0]
                if size_param and size_param.isdigit():
                    return size_param
            
            size_patterns = [
                r'size=(\d+)',
                r'size:(\d+)',
                r'sku=(\d+)',
                r'variant=(\d+)'
            ]
            
            for pattern in size_patterns:
                match = re.search(pattern, url)
                if match:
                    return match.group(1)
                    
        except Exception as e:
            logger.debug(f"Ошибка извлечения size параметра: {e}")
        
        return None
    
    def parse_html_page(self, url: str) -> Optional[WBProductData]:
        """Парсинг характеристик напрямую из HTML страницы товара"""
        if not HAS_REQUESTS or not HAS_BS4:
            logger.warning("BeautifulSoup не доступен для парсинга HTML")
            return None
        
        try:
            logger.info(f"🌐 Парсим HTML страницу: {url}")
            
            headers = self.get_random_headers()
            response = self.session.get(url, headers=headers, timeout=15)
            
            if response.status_code != 200:
                logger.warning(f"HTTP {response.status_code} при получении HTML страницы")
                return None
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Извлекаем данные из HTML
            product_data = self._extract_data_from_html(soup, url)
            
            if product_data:
                logger.info(f"✅ Успешно извлечены данные из HTML: {product_data.name}")
                return product_data
            
        except Exception as e:
            logger.warning(f"Ошибка парсинга HTML: {e}")
        
        return None
    
    def _extract_data_from_html(self, soup: BeautifulSoup, url: str) -> Optional[WBProductData]:
        """Извлечение данных товара из HTML"""
        try:
            nm_id = self.extract_product_id(url)
            size_param = self.extract_size_parameter(url)
            
            if not nm_id:
                return None
            
            # Извлекаем название товара
            name = self._extract_product_name(soup)
            
            # Извлекаем цену
            price = self._extract_price_from_html(soup)
            
            # Извлекаем рейтинг и отзывы
            rating, reviews_count = self._extract_rating_and_reviews(soup)
            
            # Извлекаем бренд
            brand = self._extract_brand_from_html(soup)
            
            # Главное - извлекаем характеристики из HTML
            characteristics = self._extract_characteristics_from_html(soup)
            
            # Извлекаем описание
            description = self._extract_description_from_html(soup, characteristics)
            
            # Извлекаем категорию
            category = self._extract_category_from_html(soup)
            
            # Генерируем изображения
            images = self._generate_image_urls(nm_id)
            
            return WBProductData(
                id=nm_id,
                name=name or f'Товар {nm_id}',
                brand=brand or 'NoName',
                price=price,
                rating=rating,
                reviewsCount=reviews_count,
                description=description,
                characteristics=characteristics,
                images=images,
                category=category or 'Товары для дома',
                categoryId=None,
                availability=True,
                vendorCode=nm_id,
                supplierId=None,
                tnved='8544429009',
                variantId=size_param
            )
            
        except Exception as e:
            logger.error(f"Ошибка извлечения данных из HTML: {e}")
            return None
    
    def _extract_product_name(self, soup: BeautifulSoup) -> Optional[str]:
        """Извлечение названия товара"""
        selectors = [
            'h1[data-link]',
            'h1.product-page__title',
            '.product-page__header h1',
            '[data-testid="product-title"]',
            '.goods-name',
            'h1'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element and element.get_text(strip=True):
                name = element.get_text(strip=True)
                # Очищаем название от лишних символов
                name = re.sub(r'\s+', ' ', name)
                if len(name) > 3:
                    return name
        
        return None
    
    def _extract_price_from_html(self, soup: BeautifulSoup) -> int:
        """Извлечение цены из HTML"""
        price_selectors = [
            '.price-block__final-price',
            '.product-page__price-final',
            '[data-testid="price-current"]',
            '.price__lower-price',
            '.price-current',
            '.mini-product__price-value'
        ]
        
        for selector in price_selectors:
            element = soup.select_one(selector)
            if element:
                price_text = element.get_text(strip=True)
                # Извлекаем числа из текста цены
                price_match = re.search(r'(\d+(?:\s?\d+)*)', price_text.replace('\xa0', ' '))
                if price_match:
                    price_str = price_match.group(1).replace(' ', '')
                    try:
                        return int(price_str)
                    except ValueError:
                        continue
        
        return 0
    
    def _extract_rating_and_reviews(self, soup: BeautifulSoup) -> Tuple[float, int]:
        """Извлечение рейтинга и количества отзывов"""
        rating = 0.0
        reviews_count = 0
        
        # Рейтинг
        rating_selectors = [
            '[data-testid="product-rating"]',
            '.product-review__rating',
            '.rating-number',
            '.product-page__rating-value'
        ]
        
        for selector in rating_selectors:
            element = soup.select_one(selector)
            if element:
                rating_text = element.get_text(strip=True)
                rating_match = re.search(r'(\d+[.,]\d+)', rating_text)
                if rating_match:
                    try:
                        rating = float(rating_match.group(1).replace(',', '.'))
                        break
                    except ValueError:
                        continue
        
        # Количество отзывов
        reviews_selectors = [
            '[data-testid="product-reviews-count"]',
            '.product-review__count',
            '.feedback-count',
            '.product-page__reviews-count'
        ]
        
        for selector in reviews_selectors:
            element = soup.select_one(selector)
            if element:
                reviews_text = element.get_text(strip=True)
                reviews_match = re.search(r'(\d+)', reviews_text)
                if reviews_match:
                    try:
                        reviews_count = int(reviews_match.group(1))
                        break
                    except ValueError:
                        continue
        
        return rating, reviews_count
    
    def _extract_brand_from_html(self, soup: BeautifulSoup) -> Optional[str]:
        """Извлечение бренда из HTML"""
        brand_selectors = [
            '[data-testid="product-brand"]',
            '.product-page__brand',
            '.brand-name',
            '.seller-name'
        ]
        
        for selector in brand_selectors:
            element = soup.select_one(selector)
            if element and element.get_text(strip=True):
                brand = element.get_text(strip=True)
                if len(brand) > 1 and len(brand) < 100:
                    return brand
        
        return None
    
    def _extract_characteristics_from_html(self, soup: BeautifulSoup) -> List[Dict[str, str]]:
        """Главная функция - извлечение характеристик из HTML"""
        characteristics = []
        
        try:
            # Метод 1: Поиск в таблицах характеристик
            tables_characteristics = self._extract_from_characteristic_tables(soup)
            characteristics.extend(tables_characteristics)
            
            # Метод 2: Поиск в popup-модалах с характеристиками
            popup_characteristics = self._extract_from_popup_details(soup)
            characteristics.extend(popup_characteristics)
            
            # Метод 3: Поиск в JSON данных на странице
            json_characteristics = self._extract_from_page_json(soup)
            characteristics.extend(json_characteristics)
            
            # Метод 4: Поиск в мета-данных
            meta_characteristics = self._extract_from_meta_data(soup)
            characteristics.extend(meta_characteristics)
            
            # Убираем дубликаты и очищаем данные
            characteristics = self._clean_and_deduplicate_characteristics(characteristics)
            
            logger.info(f"📋 Извлечено {len(characteristics)} характеристик из HTML")
            
            # Логируем найденные характеристики для отладки
            for char in characteristics:
                logger.debug(f"   • {char['name']}: {char['value']}")
            
        except Exception as e:
            logger.error(f"Ошибка извлечения характеристик: {e}")
        
        return characteristics
    
    def _extract_from_characteristic_tables(self, soup: BeautifulSoup) -> List[Dict[str, str]]:
        """Извлечение характеристик из таблиц product-params"""
        characteristics = []
        
        # Поиск таблиц с характеристиками
        table_selectors = [
            '.product-params__table',
            '.characteristics-table',
            '.product-characteristics__table',
            '.params-table'
        ]
        
        for selector in table_selectors:
            tables = soup.select(selector)
            for table in tables:
                # Извлекаем заголовок группы характеристик
                caption = table.select_one('caption, .product-params__caption')
                group_name = caption.get_text(strip=True) if caption else None
                
                # Извлекаем строки характеристик
                rows = table.select('tr.product-params__row, tr')
                for row in rows:
                    cells = row.select('td, th')
                    if len(cells) >= 2:
                        name_cell = cells[0]
                        value_cell = cells[1]
                        
                        name = name_cell.get_text(strip=True)
                        value = value_cell.get_text(strip=True)
                        
                        if name and value and len(name) > 1 and len(value) > 0:
                            # Очищаем название от декоративных элементов
                            name = re.sub(r'[^\w\s\-.,()]+', '', name).strip()
                            
                            characteristics.append({
                                'name': name,
                                'value': value,
                                'group': group_name
                            })
        
        return characteristics
    
    def _extract_from_popup_details(self, soup: BeautifulSoup) -> List[Dict[str, str]]:
        """Извлечение характеристик из popup-модалов"""
        characteristics = []
        
        # Поиск popup-модалов с характеристиками
        popup_selectors = [
            '.popup-product-details',
            '.product-details',
            '.characteristics-popup'
        ]
        
        for selector in popup_selectors:
            popups = soup.select(selector)
            for popup in popups:
                # Ищем таблицы характеристик внутри popup
                tables = popup.select('.product-params__table, table')
                for table in tables:
                    caption = table.select_one('caption')
                    group_name = caption.get_text(strip=True) if caption else 'Характеристики'
                    
                    rows = table.select('tr')
                    for row in rows:
                        cells = row.select('td, th')
                        if len(cells) >= 2:
                            name = cells[0].get_text(strip=True)
                            value = cells[1].get_text(strip=True)
                            
                            if name and value and len(name) > 1:
                                characteristics.append({
                                    'name': name,
                                    'value': value,
                                    'group': group_name
                                })
        
        return characteristics
    
    def _extract_from_page_json(self, soup: BeautifulSoup) -> List[Dict[str, str]]:
        """Извлечение характеристик из JSON данных на странице"""
        characteristics = []
        
        try:
            # Поиск script тегов с JSON данными
            scripts = soup.find_all('script', type='application/ld+json')
            scripts.extend(soup.find_all('script', string=re.compile(r'"characteristics"')))
            scripts.extend(soup.find_all('script', string=re.compile(r'"options"')))
            
            for script in scripts:
                if script.string:
                    try:
                        # Попытка парсинга JSON
                        json_data = json.loads(script.string)
                        
                        # Поиск характеристик в различных структурах JSON
                        chars = self._extract_characteristics_from_json(json_data)
                        characteristics.extend(chars)
                        
                    except json.JSONDecodeError:
                        # Если не JSON, ищем структуры данных в JavaScript
                        js_data = script.string
                        chars = self._extract_from_javascript_data(js_data)
                        characteristics.extend(chars)
            
        except Exception as e:
            logger.debug(f"Ошибка извлечения из JSON: {e}")
        
        return characteristics
    
    def _extract_characteristics_from_json(self, data: Any) -> List[Dict[str, str]]:
        """Рекурсивное извлечение характеристик из JSON структуры"""
        characteristics = []
        
        if isinstance(data, dict):
            # Прямой поиск характеристик
            if 'options' in data and isinstance(data['options'], list):
                for option in data['options']:
                    if isinstance(option, dict) and 'name' in option and 'value' in option:
                        characteristics.append({
                            'name': str(option['name']),
                            'value': str(option['value']),
                            'group': 'JSON данные'
                        })
            
            if 'characteristics' in data and isinstance(data['characteristics'], list):
                for char in data['characteristics']:
                    if isinstance(char, dict) and 'name' in char and 'value' in char:
                        characteristics.append({
                            'name': str(char['name']),
                            'value': str(char['value']),
                            'group': 'JSON данные'
                        })
            
            # Рекурсивный поиск в других ключах
            for key, value in data.items():
                if key not in ['options', 'characteristics']:
                    characteristics.extend(self._extract_characteristics_from_json(value))
        
        elif isinstance(data, list):
            for item in data:
                characteristics.extend(self._extract_characteristics_from_json(item))
        
        return characteristics
    
    def _extract_from_javascript_data(self, js_code: str) -> List[Dict[str, str]]:
        """Извлечение характеристик из JavaScript кода"""
        characteristics = []
        
        try:
            # Поиск структур с характеристиками в JS коде
            patterns = [
                r'"name"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"',
                r"'name'\s*:\s*'([^']+)'\s*,\s*'value'\s*:\s*'([^']+)'",
                r'name:\s*"([^"]+)"\s*,\s*value:\s*"([^"]+)"'
            ]
            
            for pattern in patterns:
                matches = re.finditer(pattern, js_code)
                for match in matches:
                    name = match.group(1)
                    value = match.group(2)
                    
                    if name and value and len(name) > 1:
                        characteristics.append({
                            'name': name,
                            'value': value,
                            'group': 'JavaScript данные'
                        })
        
        except Exception as e:
            logger.debug(f"Ошибка извлечения из JavaScript: {e}")
        
        return characteristics
    
    def _extract_from_meta_data(self, soup: BeautifulSoup) -> List[Dict[str, str]]:
        """Извлечение характеристик из мета-данных страницы"""
        characteristics = []
        
        try:
            # Open Graph и другие мета-теги
            meta_tags = soup.find_all('meta')
            
            for meta in meta_tags:
                property_name = meta.get('property', '') or meta.get('name', '')
                content = meta.get('content', '')
                
                if property_name and content:
                    # Преобразуем мета-свойства в понятные названия
                    if 'brand' in property_name.lower():
                        characteristics.append({
                            'name': 'Бренд',
                            'value': content,
                            'group': 'Мета-данные'
                        })
                    elif 'price' in property_name.lower():
                        characteristics.append({
                            'name': 'Цена',
                            'value': content,
                            'group': 'Мета-данные'
                        })
                    elif 'category' in property_name.lower():
                        characteristics.append({
                            'name': 'Категория',
                            'value': content,
                            'group': 'Мета-данные'
                        })
        
        except Exception as e:
            logger.debug(f"Ошибка извлечения мета-данных: {e}")
        
        return characteristics
    
    def _clean_and_deduplicate_characteristics(self, characteristics: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Очистка и удаление дубликатов характеристик"""
        seen = set()
        cleaned = []
        
        for char in characteristics:
            name = char.get('name', '').strip()
            value = char.get('value', '').strip()
            
            # Пропускаем пустые или некорректные характеристики
            if not name or not value or len(name) < 2 or len(value) < 1:
                continue
            
            # Очищаем название
            name = re.sub(r'[^\w\s\-.,()]+', '', name).strip()
            
            # Очищаем значение
            value = re.sub(r'\s+', ' ', value).strip()
            
            # Проверяем на дубликаты
            key = f"{name.lower()}:{value.lower()}"
            if key not in seen:
                seen.add(key)
                cleaned.append({
                    'name': name,
                    'value': value
                })
        
        return cleaned
    
    def _extract_description_from_html(self, soup: BeautifulSoup, characteristics: List[Dict[str, str]]) -> str:
        """Извлечение или генерация описания"""
        description_parts = []
        
        # Поиск готового описания
        description_selectors = [
            '.product-details__description',
            '.product-description',
            '.goods-description',
            '[data-testid="product-description"]'
        ]
        
        for selector in description_selectors:
            element = soup.select_one(selector)
            if element:
                desc_text = element.get_text(strip=True)
                if len(desc_text) > 10:
                    description_parts.append(desc_text)
                    break
        
        # Если описания нет, генерируем из характеристик
        if not description_parts and characteristics:
            description_parts.append("Характеристики товара:")
            for char in characteristics[:5]:  # Берем первые 5 характеристик
                description_parts.append(f"• {char['name']}: {char['value']}")
        
        # Добавляем стандартные элементы описания
        description_parts.extend([
            "",
            "✅ Высокое качество",
            "✅ Быстрая доставка",
            "✅ Гарантия качества"
        ])
        
        return '\n'.join(description_parts)
    
    def _extract_category_from_html(self, soup: BeautifulSoup) -> Optional[str]:
        """Извлечение категории из HTML"""
        category_selectors = [
            '.breadcrumbs a:last-child',
            '.product-page__category',
            '[data-testid="breadcrumb"] a:last-child',
            '.category-name'
        ]
        
        for selector in category_selectors:
            element = soup.select_one(selector)
            if element and element.get_text(strip=True):
                category = element.get_text(strip=True)
                if len(category) > 2:
                    return category
        
        return None
    
    def make_request(self, url: str, retries: int = 3, timeout: int = 15, as_html: bool = False) -> Optional[Dict]:
        """Выполнение HTTP запроса с улучшенной обработкой ошибок"""
        if not HAS_REQUESTS:
            logger.error("requests module not available")
            return None
            
        self.request_count += 1
        
        for attempt in range(retries):
            try:
                if attempt > 0:
                    delay = (2 ** attempt) * 0.5 + random.uniform(0, 0.5)
                    time.sleep(delay)
                else:
                    self.apply_rate_limit()
                
                headers = self.get_random_headers()
                
                response = self.session.get(
                    url, 
                    headers=headers, 
                    timeout=timeout,
                    allow_redirects=True
                )
                
                if response.status_code == 200:
                    self.success_count += 1
                    
                    if as_html:
                        return response
                    
                    try:
                        return response.json()
                    except ValueError as e:
                        logger.warning(f"Некорректный JSON ответ от {url}: {str(e)[:100]}")
                        return None
                        
                elif response.status_code == 404:
                    logger.info(f"Товар не найден (404): {url}")
                    return None
                    
                elif response.status_code == 403:
                    logger.warning(f"Доступ заблокирован (403): {url}")
                    if attempt < retries - 1:
                        delay = (2 ** attempt) * 2 + random.uniform(0, 1)
                        time.sleep(delay)
                    continue
                    
                elif response.status_code == 429:
                    retry_after = response.headers.get('retry-after')
                    delay = int(retry_after) if retry_after else (2 ** attempt) * 2
                    logger.warning(f"Rate limit (429), ждем {delay}с")
                    time.sleep(delay)
                    continue
                    
                elif response.status_code >= 500:
                    logger.warning(f"Серверная ошибка {response.status_code}, попытка {attempt + 1}")
                    if attempt < retries - 1:
                        time.sleep(random.uniform(1, 3))
                    continue
                else:
                    logger.error(f"HTTP {response.status_code}: {url}")
                    
            except Exception as e:
                if 'timeout' in str(e).lower():
                    logger.warning(f"Таймаут запроса к {url}, попытка {attempt + 1}")
                    continue
                    
                if self.is_network_error(e):
                    logger.warning(f"Сетевая ошибка: {str(e)[:100]}")
                    if attempt < retries - 1:
                        time.sleep(random.uniform(1, 2))
                    continue
                else:
                    logger.warning(f"Ошибка запроса: {str(e)[:100]}, попытка {attempt + 1}")
                    if attempt < retries - 1:
                        time.sleep(random.uniform(0.5, 1.5))
                    continue
        
        self.failure_count += 1
        return None
    
    def is_network_error(self, error: Exception) -> bool:
        """Проверка типа сетевой ошибки"""
        if not HAS_REQUESTS:
            return True
            
        error_str = str(error).lower()
        network_errors = [
            'connection error', 'timeout', 'network', 'unreachable',
            'name resolution failed', 'connection refused', 
            'ssl', 'certificate', 'dns', 'host'
        ]
        return any(net_err in error_str for net_err in network_errors)
    
    def get_product_data(self, url: str) -> Optional[WBProductData]:
        """Основной метод получения данных товара с приоритетом HTML парсинга"""
        if not HAS_REQUESTS:
            return self._create_fallback_product("000000", Exception("requests module not available"))
            
        nm_id = self.extract_product_id(url)
        if not nm_id:
            logger.error("Не удалось извлечь ID товара из URL")
            return None
        
        if len(nm_id) < 6:
            logger.error(f"Некорректный ID товара: {nm_id}")
            return None
        
        size_param = self.extract_size_parameter(url)
        if size_param:
            logger.info(f"Найден параметр размера/варианта: {size_param}")
        
        logger.info(f"Начинаем парсинг товара {nm_id}" + (f" (вариант: {size_param})" if size_param else ""))
        
        # ПРИОРИТЕТ 1: Парсинг HTML страницы (самый надежный для характеристик)
        if HAS_BS4:
            try:
                logger.info("🌐 Пробуем HTML парсинг (приоритетный метод)")
                html_result = self.parse_html_page(url)
                if html_result and html_result.name and len(html_result.name) > 3:
                    logger.info(f"✅ HTML парсинг успешен: {html_result.name}")
                    logger.info(f"📋 Найдено характеристик: {len(html_result.characteristics)}")
                    return html_result
            except Exception as e:
                logger.warning(f"HTML парсинг не удался: {str(e)[:100]}")
        
        # ПРИОРИТЕТ 2: Стандартные API стратегии
        strategies = [
            ('Card API v2', self._get_from_card_api_v2),
            ('Card API v1', self._get_from_card_api_v1),
            ('Enrichment API', self._get_from_enrichment_api),
            ('Search API v5', self._get_from_search_api_v5),
            ('Basket API', self._get_from_basket_api),
            ('Search API v4', self._get_from_search_api_v4)
        ]
        
        last_error = None
        
        for strategy_name, strategy_func in strategies:
            try:
                logger.info(f"📡 Пробуем стратегию: {strategy_name}")
                
                result = strategy_func(nm_id)
                if result and result.name and len(result.name) > 3 and result.name != f"Товар {nm_id}":
                    logger.info(f"✅ Успешно получены данные через {strategy_name}: {result.name}")
                    
                    # Если есть параметр size, пытаемся найти конкретный вариант
                    if size_param:
                        result = self._find_specific_variant(result, nm_id, size_param)
                    
                    return result
                    
            except Exception as e:
                last_error = e
                logger.warning(f"{strategy_name} не сработал: {str(e)[:100]}")
                
                if self.is_network_error(e):
                    time.sleep(random.uniform(1, 2))
                continue
        
        # ПРИОРИТЕТ 3: Fallback продукт если товар существует
        logger.warning('Все стратегии API не сработали, проверяем существование товара')
        if self._check_product_exists_basic(nm_id):
            logger.info(f"Товар {nm_id} существует, создаем fallback данные")
            return self._create_fallback_product(nm_id, last_error)
        
        logger.error(f"Товар {nm_id} не найден ни одним из методов")
        return None
    
    def _find_specific_variant(self, product_data: WBProductData, nm_id: str, size_param: str) -> WBProductData:
        """Поиск конкретного варианта товара по параметру size"""
        try:
            logger.info(f"Ищем конкретный вариант товара с size={size_param}")
            
            # Пытаемся получить дополнительные данные о вариантах
            variant_data = self._get_variant_data(nm_id, size_param)
            
            if variant_data:
                # Обновляем данные товара с учетом конкретного варианта
                product_data = self._apply_variant_data(product_data, variant_data, size_param)
                logger.info(f"Данные обновлены для варианта {size_param}")
            else:
                logger.info(f"Конкретный вариант {size_param} не найден, используем общие данные")
            
            # Устанавливаем ID варианта
            product_data.variantId = size_param
            
        except Exception as e:
            logger.warning(f"Ошибка поиска варианта: {str(e)}")
        
        return product_data
    
    def _get_variant_data(self, nm_id: str, size_param: str) -> Optional[Dict]:
        """Получение данных конкретного варианта товара через несколько API"""
        variant_data = None
        
        try:
            # Метод 1: Card API v2 с размером
            params = dict(self.default_params)
            params.update({
                'nm': nm_id,
                'size': size_param
            })
            url = f"{self.endpoints['card_detail_v2']}?{urlencode(params)}"
            
            data = self.make_request(url, retries=1, timeout=10)
            if data and data.get('data', {}).get('products'):
                products = data['data']['products']
                if products:
                    variant_data = products[0]
                    logger.info("Получены данные варианта через Card API v2")
            
            # Метод 2: Попытка через специальный endpoint для размеров
            if not variant_data:
                size_url = f"https://card.wb.ru/cards/v1/detail?nm={nm_id}&size={size_param}&spp=30"
                data = self.make_request(size_url, retries=1, timeout=10)
                if data and data.get('data', {}).get('products'):
                    products = data['data']['products']
                    if products:
                        variant_data = products[0]
                        logger.info("Получены данные варианта через size endpoint")
                        
        except Exception as e:
            logger.debug(f"Ошибка получения данных варианта: {e}")
        
        return variant_data
    
    def _apply_variant_data(self, base_product: WBProductData, variant_data: Dict, size_param: str) -> WBProductData:
        """Применение данных конкретного варианта к базовым данным товара"""
        try:
            # Обновляем цену (если доступна для конкретного варианта)
            if variant_data.get('salePriceU') or variant_data.get('priceU'):
                base_product.price = self._parse_price(
                    variant_data.get('salePriceU') or variant_data.get('priceU')
                )
            
            # Обновляем наличие
            if 'totalQty' in variant_data:
                base_product.availability = (variant_data.get('totalQty', 0) > 0)
            
            # Обновляем характеристики конкретного варианта
            variant_characteristics = self._extract_variant_characteristics(variant_data, size_param)
            if variant_characteristics:
                # Заменяем или дополняем характеристики
                existing_names = [char['name'].lower() for char in base_product.characteristics]
                
                for var_char in variant_characteristics:
                    char_name_lower = var_char['name'].lower()
                    
                    # Если характеристика уже есть, заменяем
                    replaced = False
                    for i, existing_char in enumerate(base_product.characteristics):
                        if existing_char['name'].lower() == char_name_lower:
                            base_product.characteristics[i] = var_char
                            replaced = True
                            break
                    
                    # Если не заменили, добавляем
                    if not replaced:
                        base_product.characteristics.append(var_char)
            
        except Exception as e:
            logger.warning(f"Ошибка применения данных варианта: {e}")
        
        return base_product
    
    def _extract_variant_characteristics(self, variant_data: Dict, size_param: str) -> List[Dict[str, str]]:
        """Извлечение характеристик конкретного варианта"""
        characteristics = []
        
        try:
            # 1. Поиск в стандартных размерах
            if variant_data.get('sizes'):
                for size in variant_data['sizes']:
                    size_ids = [
                        str(size.get('optionId', '')),
                        str(size.get('id', '')),
                        str(size.get('chrmId', '')),
                        str(size.get('skuId', ''))
                    ]
                    
                    if size_param in size_ids:
                        size_name = size.get('name', '')
                        if size_name:
                            characteristics.append({
                                'name': 'Размер',
                                'value': str(size_name)
                            })
                        break
            
            # 2. Поиск в цветах
            if variant_data.get('colors'):
                for color in variant_data['colors']:
                    color_ids = [
                        str(color.get('id', '')),
                        str(color.get('colorId', '')),
                        str(color.get('chrmId', ''))
                    ]
                    
                    if size_param in color_ids:
                        color_name = color.get('name', '')
                        if color_name:
                            characteristics.append({
                                'name': 'Цвет',
                                'value': str(color_name)
                            })
                        break
            
            # 3. Поиск в общих опциях/характеристиках
            for options_key in ['options', 'characteristics', 'attributes']:
                if variant_data.get(options_key):
                    for option in variant_data[options_key]:
                        option_ids = [
                            str(option.get('id', '')),
                            str(option.get('optionId', '')),
                            str(option.get('charId', '')),
                            str(option.get('chrmId', ''))
                        ]
                        
                        if (size_param in option_ids or 
                            str(option.get('valueId', '')) == size_param):
                            
                            option_name = option.get('name', '') or option.get('charName', '')
                            option_value = option.get('value', '') or option.get('charValue', '')
                            
                            if option_name and option_value:
                                characteristics.append({
                                    'name': str(option_name),
                                    'value': str(option_value)
                                })
            
            logger.info(f"Извлечено {len(characteristics)} характеристик для варианта {size_param}")
            
        except Exception as e:
            logger.warning(f"Ошибка извлечения характеристик варианта: {e}")
        
        return characteristics
    
    # API методы (сохраняем существующие)
    def _get_from_card_api_v2(self, nm_id: str) -> Optional[WBProductData]:
        """Парсинг через Card API v2"""
        params = dict(self.default_params)
        params['nm'] = nm_id
        url = f"{self.endpoints['card_detail_v2']}?{urlencode(params)}"
        
        data = self.make_request(url)
        if data and data.get('data', {}).get('products'):
            products = data['data']['products']
            if products and len(products) > 0:
                product = products[0]
                detailed_product = self._enrich_product_data(product, nm_id)
                return self._parse_card_response(detailed_product, nm_id)
        return None
    
    def _get_from_card_api_v1(self, nm_id: str) -> Optional[WBProductData]:
        """Парсинг через Card API v1"""
        params = dict(self.default_params)
        params['nm'] = nm_id
        url = f"{self.endpoints['card_detail']}?{urlencode(params)}"
        
        data = self.make_request(url)
        if data and data.get('data', {}).get('products'):
            products = data['data']['products']
            if products and len(products) > 0:
                return self._parse_card_response(products[0], nm_id)
        return None
    
    def _get_from_enrichment_api(self, nm_id: str) -> Optional[WBProductData]:
        """Парсинг через Enrichment API"""
        params = {'spp': '0', 'nm': nm_id}
        url = f"{self.endpoints['enrichment']}?{urlencode(params)}"
        
        data = self.make_request(url)
        if data and data.get('data', {}).get('products'):
            products = data['data']['products']
            if products and len(products) > 0:
                return self._parse_enrichment_response(products[0], nm_id)
        return None
    
    def _get_from_search_api_v5(self, nm_id: str) -> Optional[WBProductData]:
        """Парсинг через Search API v5"""
        params = dict(self.default_params)
        params.update({
            'query': nm_id,
            'resultset': 'catalog'
        })
        url = f"{self.endpoints['search_v5']}?{urlencode(params)}"
        
        data = self.make_request(url)
        if data and data.get('data', {}).get('products'):
            products = data['data']['products']
            for product in products:
                if str(product.get('id', '')) == nm_id or str(product.get('root', '')) == nm_id:
                    return self._parse_search_response(product, nm_id)
        return None
    
    def _get_from_basket_api(self, nm_id: str) -> Optional[WBProductData]:
        """Парсинг через Basket API"""
        if len(nm_id) < 6:
            return None
            
        vol = nm_id[:-5] if len(nm_id) > 5 else "0"
        part = nm_id[-5:-3] if len(nm_id) > 3 else "00"
        
        baskets = ['basket-01', 'basket-02', 'basket-03', 'basket-04']
        
        for basket in baskets:
            try:
                url = f"https://{basket}.wbbasket.ru/vol{vol}/part{part}/{nm_id}/info/ru/card.json"
                data = self.make_request(url, timeout=8)
                
                if data and (data.get('imt_name') or data.get('nm_id')):
                    return self._parse_basket_response(data, nm_id)
                    
            except Exception as e:
                logger.debug(f"Basket {basket} ошибка: {str(e)}")
                continue
        
        return None
    
    def _get_from_search_api_v4(self, nm_id: str) -> Optional[WBProductData]:
        """Парсинг через Search API v4"""
        params = dict(self.default_params)
        params.update({
            'query': nm_id,
            'resultset': 'catalog'
        })
        url = f"{self.endpoints['search_v4']}?{urlencode(params)}"
        
        data = self.make_request(url)
        if data and data.get('data', {}).get('products'):
            products = data['data']['products']
            for product in products:
                if str(product.get('id', '')) == nm_id or str(product.get('root', '')) == nm_id:
                    return self._parse_search_response(product, nm_id)
        return None
    
    def _enrich_product_data(self, product: Dict, nm_id: str) -> Dict:
        """Обогащение данных товара дополнительной информацией"""
        try:
            if len(nm_id) >= 6:
                basket_data = self._get_basket_description(nm_id)
                if basket_data:
                    if basket_data.get('description') and not product.get('description'):
                        product['description'] = basket_data['description']
                    
                    if basket_data.get('options'):
                        if not product.get('options'):
                            product['options'] = []
                        
                        existing_names = {opt.get('name', '').lower() for opt in product.get('options', [])}
                        for basket_opt in basket_data['options']:
                            if basket_opt.get('name') and basket_opt.get('name', '').lower() not in existing_names:
                                product['options'].append(basket_opt)
            
            enrichment_data = self._get_enrichment_data(nm_id)
            if enrichment_data:
                if enrichment_data.get('description') and not product.get('description'):
                    product['description'] = enrichment_data['description']
                
                if enrichment_data.get('options') and not product.get('options'):
                    product['options'] = enrichment_data['options']
        
        except Exception as e:
            logger.debug(f"Ошибка обогащения данных: {str(e)}")
        
        return product
    
    def _get_basket_description(self, nm_id: str) -> Optional[Dict]:
        """Получение описания из basket API"""
        if len(nm_id) < 6:
            return None
            
        vol = nm_id[:-5] if len(nm_id) > 5 else "0"
        part = nm_id[-5:-3] if len(nm_id) > 3 else "00"
        
        baskets = ['basket-01', 'basket-02', 'basket-03']
        
        for basket in baskets:
            try:
                url = f"https://{basket}.wbbasket.ru/vol{vol}/part{part}/{nm_id}/info/ru/card.json"
                data = self.make_request(url, timeout=5, retries=1)
                
                if data and (data.get('description') or data.get('options')):
                    return data
                    
            except Exception:
                continue
        
        return None
    
    def _get_enrichment_data(self, nm_id: str) -> Optional[Dict]:
        """Получение обогащенных данных"""
        try:
            params = {'spp': '0', 'nm': nm_id}
            url = f"{self.endpoints['enrichment']}?{urlencode(params)}"
            
            data = self.make_request(url, timeout=5, retries=1)
            if data and data.get('data', {}).get('products'):
                products = data['data']['products']
                if products and len(products) > 0:
                    return products[0]
        except Exception:
            pass
        
        return None
    
    # Парсеры ответов (упрощенные версии для экономии места)
    def _parse_card_response(self, product: Dict, nm_id: str) -> WBProductData:
        """Парсинг ответа Card API"""
        return WBProductData(
            id=nm_id,
            name=product.get('name', f'Товар {nm_id}'),
            brand=product.get('brand', 'NoName'),
            price=self._parse_price(product.get('salePriceU') or product.get('priceU')),
            rating=float(product.get('rating', 0)),
            reviewsCount=int(product.get('feedbacks', 0)),
            description=self._build_description(product),
            characteristics=self._extract_characteristics(product),
            images=self._generate_image_urls(nm_id),
            category=product.get('subjectName', 'Товары для дома'),
            categoryId=product.get('subjectId'),
            availability=(product.get('totalQty', 0) > 0),
            vendorCode=product.get('vendorCode', nm_id),
            supplierId=str(product.get('supplierId', '')) if product.get('supplierId') else None,
            tnved=product.get('tnved', '8544429009')
        )
    
    def _parse_enrichment_response(self, product: Dict, nm_id: str) -> WBProductData:
        """Парсинг ответа Enrichment API"""
        return WBProductData(
            id=nm_id,
            name=product.get('name', f'Товар {nm_id}'),
            brand=product.get('brand', 'NoName'),
            price=self._parse_price(product.get('priceU')),
            rating=float(product.get('rating', 0)),
            reviewsCount=int(product.get('feedbacks', 0)),
            description=self._build_description(product),
            characteristics=self._extract_characteristics(product),
            images=self._generate_image_urls(nm_id),
            category=product.get('subjectName', 'Товары для дома'),
            categoryId=product.get('subjectId'),
            availability=True,
            vendorCode=nm_id,
            supplierId=str(product.get('supplierId', '')) if product.get('supplierId') else None,
            tnved='8544429009'
        )
    
    def _parse_search_response(self, product: Dict, nm_id: str) -> WBProductData:
        """Парсинг ответа Search API"""
        return WBProductData(
            id=nm_id,
            name=product.get('name', f'Товар {nm_id}'),
            brand=product.get('brand', 'NoName'),
            price=self._parse_price(product.get('priceU')),
            rating=float(product.get('rating', 0)),
            reviewsCount=int(product.get('feedbacks', 0)),
            description=self._generate_default_description(product.get('name', f'Товар {nm_id}')),
            characteristics=self._extract_basic_characteristics(product),
            images=self._generate_image_urls(nm_id),
            category=product.get('subjectName', 'Товары для дома'),
            categoryId=product.get('subjectId'),
            availability=True,
            vendorCode=nm_id,
            supplierId=str(product.get('supplierId', '')) if product.get('supplierId') else None,
            tnved='8544429009'
        )
    
    def _parse_basket_response(self, data: Dict, nm_id: str) -> WBProductData:
        """Парсинг ответа Basket API"""
        return WBProductData(
            id=nm_id,
            name=data.get('imt_name', f'Товар {nm_id}'),
            brand=data.get('selling', {}).get('brand_name', 'NoName'),
            price=0,
            rating=0.0,
            reviewsCount=0,
            description=data.get('description', self._generate_default_description(data.get('imt_name', f'Товар {nm_id}'))),
            characteristics=self._parse_basket_characteristics(data),
            images=self._generate_image_urls(nm_id),
            category=data.get('subj_name', 'Товары для дома'),
            categoryId=data.get('subj_root_id'),
            availability=True,
            vendorCode=nm_id,
            supplierId=str(data.get('supplier_id', '')) if data.get('supplier_id') else None,
            tnved=data.get('tnved', '8544429009')
        )
    
    def _create_fallback_product(self, nm_id: str, error: Optional[Exception]) -> WBProductData:
        """Создание fallback продукта при частичном сбое парсинга"""
        return WBProductData(
            id=nm_id,
            name=f"Товар {nm_id}",
            brand='NoName',
            price=0,
            rating=0.0,
            reviewsCount=0,
            description='Данные о товаре временно недоступны. Информация будет обновлена автоматически.',
            characteristics=[
                {'name': 'Артикул', 'value': nm_id},
                {'name': 'Статус', 'value': 'Данные обновляются'},
                {'name': 'Источник', 'value': 'Python парсер (fallback)'}
            ],
            images=self._generate_image_urls(nm_id),
            category='Товары для дома',
            categoryId=14727,
            availability=True,
            vendorCode=nm_id,
            supplierId=None,
            tnved='8544429009'
        )
    
    def _parse_price(self, price_u: Optional[int]) -> int:
        """Парсинг цены из копеек в рубли"""
        if not price_u or price_u <= 0:
            return 0
        return int(price_u / 100)
    
    def _extract_characteristics(self, product: Dict) -> List[Dict[str, str]]:
        """Извлечение характеристик товара из API данных"""
        characteristics = []
        
        # 1. Опции товара (основные характеристики)
        if product.get('options'):
            for option in product['options']:
                if option.get('name') and option.get('value'):
                    name = str(option['name']).strip()
                    value = str(option['value']).strip()
                    
                    if name and value and len(value) < 200:
                        characteristics.append({
                            'name': name,
                            'value': value
                        })
        
        # 2. Цвета
        if product.get('colors') and product['colors']:
            color_names = []
            for color in product['colors']:
                color_name = color.get('name', '').strip()
                if color_name and color_name.lower() not in ['не указан', 'нет', 'отсутствует']:
                    color_names.append(color_name)
            
            if color_names:
                has_color = any(char['name'].lower() in ['цвет', 'color'] for char in characteristics)
                if not has_color:
                    characteristics.append({
                        'name': 'Цвет',
                        'value': ', '.join(color_names[:3])
                    })
        
        # 3. Размеры
        if product.get('sizes') and product['sizes']:
            sizes = []
            for size in product['sizes']:
                size_name = str(size.get('name', '')).strip()
                if size_name and size_name not in sizes and len(size_name) < 50:
                    sizes.append(size_name)
            
            if sizes:
                has_size = any(char['name'].lower() in ['размер', 'размеры', 'size'] for char in characteristics)
                if not has_size:
                    characteristics.append({
                        'name': 'Размеры',
                        'value': ', '.join(sizes[:5])
                    })
        
        # 4. Базовые характеристики если ничего не найдено
        if not characteristics:
            if product.get('brand') and product['brand'] not in ['NoName', 'Без бренда']:
                characteristics.append({'name': 'Бренд', 'value': str(product['brand'])})
            
            if product.get('vendorCode'):
                characteristics.append({'name': 'Артикул', 'value': str(product['vendorCode'])})
        
        return characteristics
    
    def _extract_basic_characteristics(self, product: Dict) -> List[Dict[str, str]]:
        """Извлечение базовых характеристик для Search API"""
        characteristics = []
        
        if product.get('brand') and product['brand'] != 'NoName':
            characteristics.append({'name': 'Бренд', 'value': str(product['brand'])})
            
        return characteristics
    
    def _parse_basket_characteristics(self, data: Dict) -> List[Dict[str, str]]:
        """Парсинг характеристик из Basket API"""
        characteristics = []
        
        if data.get('options'):
            for option in data['options']:
                if option.get('name') and option.get('value'):
                    characteristics.append({
                        'name': str(option['name']),
                        'value': str(option['value'])
                    })
        
        if data.get('selling', {}).get('brand_name'):
            characteristics.append({
                'name': 'Бренд',
                'value': str(data['selling']['brand_name'])
            })
        
        return characteristics
    
    def _build_description(self, product: Dict) -> str:
        """Построение описания товара"""
        parts = []
        
        if product.get('brand') and product['brand'] not in ['NoName', 'Без бренда']:
            parts.append(f"✅ Бренд: {product['brand']}")
        
        if product.get('rating', 0) > 0:
            parts.append(f"⭐ Рейтинг: {product['rating']}")
        
        if product.get('feedbacks', 0) > 0:
            parts.append(f"💬 Отзывов: {product['feedbacks']}")
        
        if product.get('description') and len(product['description'].strip()) > 10:
            parts.append('')
            parts.append(product['description'])
        
        parts.extend([
            '',
            '✅ Качественный товар',
            '✅ Быстрая доставка',
            '✅ Гарантия качества'
        ])
        
        return '\n'.join(parts)
    
    def _generate_default_description(self, name: str) -> str:
        """Генерация базового описания"""
        return f"""{name}

✅ Высокое качество
✅ Быстрая доставка  
✅ Выгодная цена
✅ Гарантия качества

Закажите прямо сейчас!"""
    
    def _generate_image_urls(self, nm_id: str) -> List[str]:
        """Генерация URL изображений"""
        if len(nm_id) < 6:
            return []
            
        vol = nm_id[:-5] if len(nm_id) > 5 else "0"
        part = nm_id[-5:-3] if len(nm_id) > 3 else "00"
        
        images = []
        hosts = ['images.wbstatic.net', 'basket-01.wbbasket.ru', 'basket-02.wbbasket.ru']
        
        for i in range(1, 6):
            host = hosts[i % len(hosts)]
            images.append(f"https://{host}/vol{vol}/part{part}/{nm_id}/images/c516x688/{i}.webp")
        
        return images
    
    def _check_product_exists_basic(self, nm_id: str) -> bool:
        """Базовая проверка существования товара"""
        if not HAS_REQUESTS:
            return True
            
        try:
            if len(nm_id) >= 6:
                vol = nm_id[:-5] if len(nm_id) > 5 else "0"
                part = nm_id[-5:-3] if len(nm_id) > 3 else "00"
                image_url = f"https://images.wbstatic.net/vol{vol}/part{part}/{nm_id}/images/c246x328/1.webp"
                
                response = self.session.head(
                    image_url, 
                    headers=self.get_random_headers(), 
                    timeout=5
                )
                if response.status_code == 200:
                    return True
            
            params = dict(self.default_params)
            params['nm'] = nm_id
            url = f"{self.endpoints['card_detail']}?{urlencode(params)}"
            
            data = self.make_request(url, retries=1, timeout=10)
            return bool(data and data.get('data', {}).get('products'))
            
        except Exception as e:
            logger.debug(f"Ошибка проверки существования: {str(e)}")
            return False
    
    def check_product_exists(self, nm_id: str) -> bool:
        """Публичный метод проверки существования товара"""
        return self._check_product_exists_basic(nm_id)
    
    def get_parser_stats(self) -> Dict[str, Any]:
        """Получение статистики парсера"""
        total_requests = self.request_count
        success_rate = (self.success_count / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'total_requests': total_requests,
            'successful_requests': self.success_count,
            'failed_requests': self.failure_count,
            'success_rate': round(success_rate, 2),
            'endpoints_used': list(self.endpoints.keys()),
            'has_requests_module': HAS_REQUESTS,
            'has_beautifulsoup': HAS_BS4,
            'html_parsing_available': HAS_REQUESTS and HAS_BS4
        }
    
    def reset_stats(self):
        """Сброс статистики"""
        self.request_count = 0
        self.success_count = 0
        self.failure_count = 0
        logger.info("Статистика парсера сброшена")

def convert_to_dict(product: WBProductData) -> Dict[str, Any]:
    """Конвертация dataclass в словарь для JSON сериализации"""
    return {
        'id': product.id,
        'name': product.name,
        'brand': product.brand,
        'price': product.price,
        'rating': product.rating,
        'reviewsCount': product.reviewsCount,
        'description': product.description,
        'characteristics': product.characteristics,
        'images': product.images,
        'category': product.category,
        'categoryId': product.categoryId,
        'availability': product.availability,
        'vendorCode': product.vendorCode,
        'supplierId': product.supplierId,
        'tnved': product.tnved,
        'variantId': product.variantId
    }

def main():
    """Основная функция для CLI использования"""
    
    if len(sys.argv) < 2:
        result = {
            'success': False,
            'error': 'Использование: python wb_parser.py <URL_товара_или_--test>',
            'example': 'python wb_parser.py https://www.wildberries.ru/catalog/221501024/detail.aspx?size=351871410',
            'has_requests': HAS_REQUESTS,
            'has_beautifulsoup': HAS_BS4
        }
        print(json.dumps(result, ensure_ascii=False))
        return
    
    if sys.argv[1] == '--test':
        test_parser()
        return
    
    url = sys.argv[1]
    parser = WildberriesParser()
    
    if not HAS_REQUESTS:
        result = {
            'success': False,
            'error': 'Модуль requests не установлен. Установите: pip install requests beautifulsoup4',
            'fallback_mode': True,
            'recommendations': [
                'pip install requests beautifulsoup4',
                'pip3 install requests beautifulsoup4',
                'python -m pip install requests beautifulsoup4'
            ]
        }
        print(json.dumps(result, ensure_ascii=False))
        return
    
    if not HAS_BS4:
        logger.warning("⚠️ BeautifulSoup не установлен, HTML парсинг недоступен")
        logger.warning("Установите: pip install beautifulsoup4")
    
    try:
        logger.info(f"Начинаем парсинг: {url}")
        product_data = parser.get_product_data(url)
        
        if product_data:
            result = {
                'success': True,
                'data': convert_to_dict(product_data),
                'parsing_method': 'HTML' if HAS_BS4 and len(product_data.characteristics) > 2 else 'API',
                'characteristics_count': len(product_data.characteristics),
                'variant_id': product_data.variantId,
                'stats': parser.get_parser_stats()
            }
            logger.info(f"Парсинг завершен успешно: {product_data.name}")
            logger.info(f"Найдено характеристик: {len(product_data.characteristics)}")
            
            # Выводим характеристики для отладки
            if product_data.characteristics:
                logger.info("Найденные характеристики:")
                for char in product_data.characteristics:
                    logger.info(f"  • {char['name']}: {char['value']}")
        else:
            result = {
                'success': False,
                'error': 'Не удалось получить данные товара',
                'stats': parser.get_parser_stats()
            }
            logger.error("Парсинг завершен неудачно")
            
        print(json.dumps(result, ensure_ascii=False))
            
    except KeyboardInterrupt:
        result = {
            'success': False,
            'error': 'Парсинг прерван пользователем',
            'stats': parser.get_parser_stats()
        }
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        result = {
            'success': False,
            'error': str(e),
            'stats': parser.get_parser_stats()
        }
        print(json.dumps(result, ensure_ascii=False))
        logger.error(f"Критическая ошибка: {str(e)}")

def test_parser():
    """Функция для тестирования парсера"""
    parser = WildberriesParser()
    
    print("🧪 Запуск тестирования WB парсера...")
    print(f"📦 Модуль requests: {'✅ Доступен' if HAS_REQUESTS else '❌ Не установлен'}")
    print(f"🌐 Модуль BeautifulSoup: {'✅ Доступен' if HAS_BS4 else '❌ Не установлен'}")
    
    if not HAS_REQUESTS:
        print("⚠️  Для полного функционала установите: pip install requests beautifulsoup4")
        return
    
    # Тестовые товары (включая товар с параметром size)
    test_urls = [
        'https://www.wildberries.ru/catalog/221501024/detail.aspx?size=351871410',  # Товар с вариантом
        'https://www.wildberries.ru/catalog/221501024/detail.aspx',                 # Тот же товар без варианта
        'https://www.wildberries.ru/catalog/68789915/detail.aspx',                  # Другой товар
        'https://www.wildberries.ru/catalog/999999999/detail.aspx'                  # Несуществующий товар
    ]
    
    results = []
    for i, url in enumerate(test_urls, 1):
        print(f"\n🔍 Тест {i}/4: {url}")
        try:
            start_time = time.time()
            product = parser.get_product_data(url)
            end_time = time.time()
            
            if product:
                parsing_method = 'HTML' if HAS_BS4 and len(product.characteristics) > 2 else 'API'
                results.append({
                    'test': i,
                    'url': url,
                    'success': True,
                    'name': product.name,
                    'brand': product.brand,
                    'price': product.price,
                    'characteristics_count': len(product.characteristics),
                    'variant_id': product.variantId,
                    'parsing_method': parsing_method,
                    'parse_time': round(end_time - start_time, 2)
                })
                print(f"✅ Успешно: {product.name} ({product.brand})")
                print(f"📋 Характеристик: {len(product.characteristics)}")
                print(f"🔧 Метод: {parsing_method}")
                if product.variantId:
                    print(f"🎯 Вариант: {product.variantId}")
                
                # Показываем первые несколько характеристик
                if product.characteristics:
                    print("Характеристики:")
                    for char in product.characteristics[:3]:
                        print(f"  • {char['name']}: {char['value']}")
                    if len(product.characteristics) > 3:
                        print(f"  ... и еще {len(product.characteristics) - 3}")
            else:
                results.append({
                    'test': i,
                    'url': url,
                    'success': False,
                    'error': 'Товар не найден',
                    'parse_time': round(end_time - start_time, 2)
                })
                print(f"❌ Товар не найден")
                
        except Exception as e:
            results.append({
                'test': i,
                'url': url,
                'success': False,
                'error': str(e)
            })
            print(f"❌ Ошибка: {str(e)[:100]}")
    
    # Итоги тестирования
    successful_tests = sum(1 for r in results if r['success'])
    print(f"\n📊 Результаты тестирования:")
    print(f"Успешных тестов: {successful_tests}/{len(results)}")
    print(f"HTML парсинг доступен: {'✅ Да' if HAS_BS4 else '❌ Нет'}")
    
    stats = parser.get_parser_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    # Полный JSON отчет
    final_report = {
        'test_summary': {
            'total_tests': len(results),
            'successful_tests': successful_tests,
            'success_rate': round(successful_tests / len(results) * 100, 2),
            'html_parsing_available': HAS_BS4
        },
        'test_results': results,
        'parser_stats': stats
    }
    
    print(f"\n📄 Полный отчет:")
    print(json.dumps(final_report, ensure_ascii=False, indent=2))

def install_requirements():
    """Функция для установки зависимостей"""
    if HAS_REQUESTS and HAS_BS4:
        print("✅ Все необходимые модули уже установлены")
        return True
    
    missing_modules = []
    if not HAS_REQUESTS:
        missing_modules.append('requests')
    if not HAS_BS4:
        missing_modules.append('beautifulsoup4')
    
    print(f"📦 Попытка установки модулей: {', '.join(missing_modules)}...")
    
    import subprocess
    import sys
    
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install'] + missing_modules)
        print("✅ Модули установлены успешно")
        print("🔄 Перезапустите скрипт для использования")
        return True
    except subprocess.CalledProcessError:
        try:
            subprocess.check_call(['pip3', 'install'] + missing_modules)
            print("✅ Модули установлены через pip3")
            print("🔄 Перезапустите скрипт для использования")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ Не удалось установить модули автоматически")
            print("📝 Установите вручную:")
            print(f"   pip install {' '.join(missing_modules)}")
            print(f"   pip3 install {' '.join(missing_modules)}")
            print(f"   python -m pip install {' '.join(missing_modules)}")
            return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == '--install':
            install_requirements()
        elif sys.argv[1] == '--test':
            test_parser()
        elif sys.argv[1] == '--help':
            print("""
🛠️  WB Parser Enhanced - Парсер товаров Wildberries с поддержкой HTML

Использование:
  python wb_parser.py <URL>           - Парсинг товара по URL
  python wb_parser.py --test          - Запуск тестов парсера
  python wb_parser.py --install       - Установка зависимостей
  python wb_parser.py --help          - Показать эту справку

Примеры:
  python wb_parser.py https://www.wildberries.ru/catalog/221501024/detail.aspx?size=351871410
  python wb_parser.py --test

Требования:
  - Python 3.6+
  - requests (pip install requests)
  - beautifulsoup4 (pip install beautifulsoup4) - для HTML парсинга

Особенности:
  - Приоритетный HTML парсинг для извлечения характеристик
  - Поддержка вариантов товаров (параметр size)
  - Fallback на API методы при недоступности HTML
  - Автоматическое обогащение данных из разных источников
            """)
        else:
            main()
    else:
        main()