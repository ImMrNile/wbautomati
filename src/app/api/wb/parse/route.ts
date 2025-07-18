// src/app/api/wb/parse/route.ts

import { NextResponse } from 'next/server';
// ИСПРАВЛЕНО: Используем импорт по умолчанию
import wbParser from '../../../../../lib/services/wbParser';
import { ErrorHandler, ErrorCode } from '../../../../../lib/utils/errorHandler';

/**
 * @handler POST
 * @description Обрабатывает POST-запросы для парсинга данных о товаре с Wildberries.
 * @param {Request} request - Входящий объект запроса.
 * @returns {Promise<NextResponse>} - Промис, который разрешается в ответ.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nmId } = body;

        if (!nmId) {
            return NextResponse.json(
                { message: 'Product ID (nmId) is required.' },
                { status: 400 }
            );
        }

        // ИСПРАВЛЕНО: Вызываем существующий метод getProductData
        const productData = await wbParser.getProductData(nmId);

        return NextResponse.json(
            {
                message: 'Product parsed successfully',
                data: productData,
            },
            { status: 200 }
        );

    } catch (error) {
        // Здесь можно использовать ваш ErrorHandler для более детальной обработки
        const handledError = ErrorHandler.handleError(error as Error, { endpoint: 'POST /api/wb/parse' });
        return NextResponse.json(
            { message: handledError.userMessage },
            { status: 500 }
        );
    }
}