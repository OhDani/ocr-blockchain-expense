/**
 * imageCompressor.js
 * Nén ảnh tại trình duyệt (Client-side) bằng HTML5 Canvas.
 * - Giữ độ phân giải sắc nét Full HD (tối đa 1920x1080) để AI OCR đọc rõ 100%.
 * - Giảm dung lượng từ 5-8MB xuống ~300-500KB (giảm hơn 90%).
 * - Không phụ thuộc thư viện ngoài, chạy an toàn offline.
 */

export async function compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.85) {
    // Nếu không phải file ảnh hoặc file đã rất nhẹ (< 500KB), giữ nguyên
    if (!file || !file.type.startsWith('image/') || file.size <= 500 * 1024) {
        return {
            file,
            originalSize: file?.size || 0,
            compressedSize: file?.size || 0,
            isCompressed: false,
        };
    }

    const originalSize = file.size;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Giữ tỷ lệ khung hình (Aspect Ratio)
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                // Đổ nền trắng phòng trường hợp ảnh PNG trong suốt (tránh bị đen nền khi xuất JPEG)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob || blob.size >= originalSize) {
                            // Nếu nén xong không nhỏ hơn ảnh gốc thì giữ nguyên
                            resolve({
                                file,
                                originalSize,
                                compressedSize: originalSize,
                                isCompressed: false,
                            });
                        } else {
                            // Giữ nguyên tên file, chuẩn hóa đuôi .jpg
                            const baseName = file.name.replace(/\.[^/.]+$/, "");
                            const compressedFile = new File([blob], `${baseName}.jpg`, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve({
                                file: compressedFile,
                                originalSize,
                                compressedSize: compressedFile.size,
                                isCompressed: true,
                            });
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve({ file, originalSize, compressedSize: originalSize, isCompressed: false });
        };
        reader.onerror = () => resolve({ file, originalSize, compressedSize: originalSize, isCompressed: false });
    });
}

export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
