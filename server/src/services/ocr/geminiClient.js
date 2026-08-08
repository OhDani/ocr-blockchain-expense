/**
 * geminiClient.js
 * Khởi tạo Google Gemini API client.
 * Export hàm getModel() để các module khác dùng.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;

let genAI = null;

/**
 * Lấy Gemini model instance.
 * Lazy init — chỉ tạo client khi gọi lần đầu.
 * @param {string} modelName - Tên model (mặc định: gemini-2.5-flash)
 * @returns {GenerativeModel} Model instance sẵn sàng gọi API
 */
export function getModel(modelName = 'gemini-2.5-flash') {
    if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY chưa được cấu hình trong file .env');
    }

    if (!genAI) {
        genAI = new GoogleGenerativeAI(API_KEY);
    }

    return genAI.getGenerativeModel({ model: modelName });
}
