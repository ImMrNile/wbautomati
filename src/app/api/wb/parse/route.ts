// src/app/api/wb/parse/route.ts - ПОЛНАЯ ФИНАЛЬНАЯ ВЕРСИЯ

import { NextResponse } from 'next/server';
import { wbSimpleParser } from '../../../../../lib/services/wbSimpleParser';
import { ErrorHandler, ErrorCode } from '../../../../../lib/utils/error';

/**
 * @handler POST
 * @description Обрабатывает POST-запросы для парсинга данных о товаре с Wildberries.
 * @param {Request} request - Входящий объект запроса.
 * @returns {Promise<NextResponse>} - Промис, который разрешается в ответ.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nmId, url } = body;

        // Проверяем входные данные
        if (!nmId && !url) {
            return NextResponse.json(
                { 
                    message: 'Требуется либо ID товара (nmId), либо URL товара', 
                    code: ErrorCode.INVALID_INPUT 
                },
                { status: 400 }
            );
        }

        console.log('🔍 Парсим товар WB:', nmId || url);

        // Определяем URL для парсинга
        let productUrl: string;
        if (url) {
            productUrl = url;
        } else {
            productUrl = `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`;
        }

        // Парсим товар
        const productData = await wbSimpleParser.getProductData(productUrl);

        if (!productData) {
            return NextResponse.json(
                { 
                    message: 'Не удалось получить данные товара',
                    code: ErrorCode.PRODUCT_NOT_FOUND
                },
                { status: 404 }
            );
        }

        console.log('✅ Товар успешно спарсен:', productData.name);

        return NextResponse.json(
            {
                message: 'Товар успешно спарсен',
                data: productData,
                success: true
            },
            { status: 200 }
        );

    } catch (error: any) {
        console.error('❌ Ошибка парсинга товара WB:', error);

        // Определяем тип ошибки
        let errorCode = ErrorCode.UNKNOWN;
        let statusCode = 500;
        let userMessage = 'Внутренняя ошибка сервера';

        if (error.message?.includes('не удалось извлечь ID')) {
            errorCode = ErrorCode.INVALID_INPUT;
            statusCode = 400;
            userMessage = 'Некорректный URL товара';
        } else if (error.message?.includes('Не удалось получить данные')) {
            errorCode = ErrorCode.PRODUCT_NOT_FOUND;
            statusCode = 404;
            userMessage = 'Товар не найден или недоступен';
        } else if (error.message?.includes('fetch')) {
            errorCode = ErrorCode.NETWORK;
            statusCode = 503;
            userMessage = 'Ошибка подключения к Wildberries';
        }

        return NextResponse.json(
            { 
                message: userMessage,
                code: errorCode,
                details: error.message,
                success: false
            },
            { status: statusCode }
        );
    }
}

/**
 * @handler GET
 * @description Обрабатывает GET-запросы для быстрой проверки товара
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const nmId = url.searchParams.get('nmId');
        const productUrl = url.searchParams.get('url');

        if (!nmId && !productUrl) {
            return NextResponse.json(
                { 
                    message: 'Требуется параметр nmId или url',
                    code: ErrorCode.INVALID_INPUT
                },
                { status: 400 }
            );
        }

        // Быстрая проверка существования товара
        if (nmId) {
            const exists = await wbSimpleParser.checkProductExists(nmId);
            return NextResponse.json({
                exists,
                nmId,
                message: exists ? 'Товар найден' : 'Товар не найден'
            });
        }

        // Если передан URL, извлекаем ID и проверяем
        if (productUrl) {
            const extractedId = wbSimpleParser.extractProductId(productUrl);
            if (!extractedId) {
                return NextResponse.json(
                    { 
                        message: 'Не удалось извлечь ID товара из URL',
                        code: ErrorCode.INVALID_INPUT
                    },
                    { status: 400 }
                );
            }

            const exists = await wbSimpleParser.checkProductExists(extractedId);
            return NextResponse.json({
                exists,
                nmId: extractedId,
                url: productUrl,
                message: exists ? 'Товар найден' : 'Товар не найден'
            });
        }

    } catch (error: any) {
        console.error('❌ Ошибка проверки товара WB:', error);
        
        return NextResponse.json(
            { 
                message: 'Ошибка проверки товара',
                code: ErrorCode.UNKNOWN,
                details: error.message
            },
            { status: 500 }
        );
    }
}