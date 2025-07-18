// lib/utils/error.ts

/**
 * @description Enum for application error codes.
 * This provides a centralized and consistent way to handle specific error types.
 */
export enum ErrorCode {
    // General Errors
    UNKNOWN = 'UNKNOWN',
    NETWORK = 'NETWORK', // For general network issues like failed requests
    DATABASE_ERROR = 'DATABASE_ERROR',

    // Validation Errors
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',

    // WB Parser Specific Errors
    WB_API_ERROR = 'WB_API_ERROR', // For errors returned by the WB API
    WB_TIMEOUT = 'WB_TIMEOUT',     // For timeout errors when calling WB API
    WB_PARSING_ERROR = 'WB_PARSING_ERROR', // For errors during data parsing
    PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
}

/**
 * @class AppError
 * @description Custom error class for the application.
 * It extends the base Error class to include a specific error code.
 * @param {string} message - The error message.
 * @param {ErrorCode} code - The error code from the ErrorCode enum.
 */
export class AppError extends Error {
    public readonly code: ErrorCode;

    constructor(message: string, code: ErrorCode) {
        super(message);
        this.code = code;
        // This is necessary for custom errors in TypeScript
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
