@echo off
chcp 65001 >nul
title FlexiTrip - Demo Launcher (DATN)
echo ================================================================
echo       FLEXITRIP - AI OCR ^& BLOCKCHAIN EXPENSE SYSTEM
echo           KHỞI ĐỘNG HỆ THỐNG DEMO BẢO VỆ ĐATN
echo ================================================================
echo.
echo [1/3] Đang kiểm tra cấu hình...
if not exist "server\.env" (
    echo [CANH BAO] Chua tim thay server\.env! Vui long kiem tra.
    pause
    exit /b 1
)

echo [2/3] Đang khởi động Backend Server (Port 3000)...
start "FlexiTrip - Backend Server" cmd /c "cd /d %~dp0server && npm run dev"

echo [3/3] Đang khởi động Frontend Client (Port 5173)...
start "FlexiTrip - Frontend Client" cmd /c "cd /d %~dp0client && npm run dev"

echo.
echo Đang chờ dịch vụ khởi động trong 4 giây...
timeout /t 4 /nobreak >nul

echo Đang mở trình duyệt demo...
start http://localhost:5173

echo.
echo ================================================================
echo   HỆ THỐNG ĐÃ SẴN SÀNG!
echo   - Web Demo: http://localhost:5173
echo   - API Health: http://localhost:3000/api/health
echo   - Tai khoan Demo:
echo       + Admin: admin@company.vn / admin123
echo       + Nhan vien: nguyenvana@company.vn / employee123
echo   (Nhan bat ky phim nao de dong cua so quan ly nay)
echo ================================================================
pause >nul
