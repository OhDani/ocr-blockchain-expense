/**
 * ocrService.js
 * Đọc ảnh hóa đơn + gọi Gemini Vision API để trích xuất thông tin.
 * 
 * Adapted cho web: nhận Buffer thay vì file path.
 * Input:  { buffer, mimeType }
 * Output: { rawText, processingTime }
 */

import { getModel } from './geminiClient.js';
import { OCR_PROMPT } from './ocrPrompt.js';

// Giới hạn kích thước file: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// MIME types được hỗ trợ
const SUPPORTED_MIMES = [
    'image/jpeg',
    'image/png',
    'image/webp',
];

/**
 * Trích xuất thông tin hóa đơn từ buffer ảnh.
 * @param {Buffer} buffer - Buffer ảnh từ multer
 * @param {string} mimeType - MIME type của ảnh
 * @returns {Promise<{rawText: string, processingTime: number}>}
 */
export async function extractInvoice(buffer, mimeType) {
    // ① Validate MIME type
    if (!SUPPORTED_MIMES.includes(mimeType)) {
        throw new Error(
            `Định dạng "${mimeType}" không được hỗ trợ. Chỉ hỗ trợ: JPG, PNG, WEBP`
        );
    }

    // ② Validate kích thước
    if (buffer.length > MAX_FILE_SIZE) {
        const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
        throw new Error(
            `File quá lớn (${sizeMB}MB). Giới hạn tối đa 5MB.`
        );
    }

    // ③ Convert sang Base64
    const base64Data = buffer.toString('base64');

    // ④ Tạo parts cho Gemini API
    const imagePart = {
        inlineData: {
            data: base64Data,
            mimeType,
        },
    };

    const promptPart = { text: OCR_PROMPT };

    // ⑤ Gọi Gemini Vision API (retry tối đa 2 lần)
    const model = getModel();
    const startTime = Date.now();
    const MAX_RETRIES = 2;

    let result;
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = attempt * 2000;
                console.warn(`  Lần ${attempt} thất bại, đợi ${delay / 1000}s rồi thử lại...`);
                await new Promise((r) => setTimeout(r, delay));
            }
            result = await model.generateContent([imagePart, promptPart]);
            break;
        } catch (error) {
            lastError = error;
        }
    }

    if (!result) {
        if (lastError.message?.includes('API_KEY')) {
            throw new Error('API key không hợp lệ. Kiểm tra GEMINI_API_KEY trong file .env');
        }
        if (lastError.message?.includes('503') || lastError.message?.includes('high demand')) {
            throw new Error('Gemini API đang quá tải. Vui lòng đợi 1-2 phút rồi thử lại.');
        }
        throw new Error(`Lỗi gọi Gemini API: ${lastError.message}`);
    }

    const processingTime = (Date.now() - startTime) / 1000;

    // ⑥ Lấy response text
    const response = result.response;
    const rawText = response.text();

    return {
        rawText,
        processingTime,
    };
}
