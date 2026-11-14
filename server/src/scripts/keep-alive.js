/**
 * keep-alive.js — Giữ cho Render Web Service luôn thức trong suốt ngày bảo vệ ĐATN.
 * Cách dùng: node src/scripts/keep-alive.js https://tên-service.onrender.com
 */

const targetUrl = process.argv[2] || process.env.RENDER_URL;

if (!targetUrl) {
    console.error('❌ Vui lòng truyền URL backend! Ví dụ:');
    console.error('   node src/scripts/keep-alive.js https://flexitrip-api.onrender.com');
    process.exit(1);
}

const pingUrl = targetUrl.replace(/\/$/, '') + '/api/health';
const INTERVAL_MS = 8 * 60 * 1000; // Ping mỗi 8 phút (Render sleep sau 15 phút)

console.log('====================================================');
console.log('🚀 FLEXITRIP - RENDER KEEP-ALIVE WATCHDOG');
console.log(`🎯 Mục tiêu: ${pingUrl}`);
console.log(`⏱️ Chu kỳ: Mỗi 8 phút`);
console.log('====================================================\n');

async function ping() {
    const time = new Date().toLocaleTimeString('vi-VN');
    try {
        const start = Date.now();
        const res = await fetch(pingUrl);
        const duration = Date.now() - start;
        if (res.ok) {
            console.log(`[${time}] ✅ Server phản hồi tốt (${res.status}) - ${duration}ms`);
        } else {
            console.warn(`[${time}] ⚠️ Server trả mã HTTP ${res.status} - ${duration}ms`);
        }
    } catch (err) {
        console.error(`[${time}] ❌ Ping thất bại: ${err.message}`);
    }
}

// Ping ngay lập tức khi khởi động
ping();

// Lặp lại mỗi 8 phút
setInterval(ping, INTERVAL_MS);
