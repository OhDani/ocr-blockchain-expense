/**
 * ReportsPage.jsx — Báo cáo thống kê & Đối soát tài chính (Admin)
 * Hỗ trợ bộ lọc thời gian, phân tích định mức ngân sách theo phòng ban,
 * chuẩn hóa danh mục chi phí tiếng Việt và cụm nút In / Xuất báo cáo tiện lợi.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminAPI } from '../../api/client.js';
import { getCategoryColor } from '../../utils/categoryHelper.js';
import {
    BarChart3, TrendingUp, PieChart as PieIcon,
    Download, Building2,
    ShieldCheck, Filter, Printer, Search, X, FileSpreadsheet, FileText
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'];

const PERIOD_OPTIONS = [
    { value: 'all', label: 'Tất cả thời gian' },
    { value: 'this_month', label: 'Tháng này' },
    { value: 'last_month', label: 'Tháng trước' },
    { value: 'this_quarter', label: 'Quý này' },
];

const formatVND = (v) => v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—';

const tooltipStyle = {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    fontSize: 13,
    backgroundColor: '#ffffff',
    color: '#1e293b',
};

// ── PDF Font Helper (Base64 cache) ──
let _cachedFontBase64 = null;

async function loadViFont(doc) {
    try {
        if (!_cachedFontBase64) {
            let res;
            try {
                res = await fetch('/fonts/Roboto-Regular.ttf');
                if (!res.ok) throw new Error('Local font not found');
            } catch {
                res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf');
            }
            const buf = await res.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            _cachedFontBase64 = btoa(binary);
        }
        doc.addFileToVFS('Roboto-Regular.ttf', _cachedFontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
        doc.setFont('Roboto');
        return true;
    } catch (e) {
        console.warn('Không tải được font Roboto, dùng font mặc định:', e);
        return false;
    }
}

// ── Sinh tài liệu PDF đồng bộ biểu mẫu A4 ──
async function generatePDFDoc(deptData, periodLabel, userName, companyInfo) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const hasViFont = await loadViFont(doc);
    const fontOpts = hasViFont ? { font: 'Roboto', fontStyle: 'normal' } : {};
    const compName = (companyInfo?.companyName || 'Công ty Cổ phần Công nghệ VKU Global').toUpperCase();
    const taxStr = companyInfo?.taxCode ? `MST: ${companyInfo.taxCode} · ` : '';

    // 1. Tiêu đề đơn vị & ngày
    doc.setFontSize(11);
    doc.text(compName, 14, 15);
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${taxStr}Hệ thống Quản lý Chi phí Công tác & Hoàn ứng Web3 (FlexiTrip)`, 14, 20);

    doc.text(`Ngày in: ${new Date().toLocaleDateString('vi-VN')}`, 196, 15, { align: 'right' });
    doc.text(`Người lập: ${userName || '—'}`, 196, 20, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 24, 196, 24);

    // 2. Tiêu đề chính
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(15);
    doc.text('BÁO CÁO TỔNG HỢP CHI PHÍ CÔNG TÁC', 105, 33, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(43, 158, 158);
    doc.text(`Phòng ban: ${deptData?.departmentName || 'Toàn hệ thống công ty'}`, 105, 39, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Kỳ báo cáo: ${periodLabel || 'Tất cả thời gian'}`, 105, 44, { align: 'center' });

    let y = 50;
    const s = deptData?.summary || {};

    // 3. Phần I: Bảng tổng hợp ngân sách & quyết toán
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('I. TỔNG HỢP NGÂN SÁCH & QUYẾT TOÁN', 14, y);
    y += 4;

    const summaryHead = [['Chỉ tiêu', 'Số liệu', 'Chỉ tiêu', 'Số liệu']];
    const summaryBody = [
        ['Tổng số nhân sự', `${s.totalUsers || 0} người`, 'Tổng số hóa đơn', `${s.totalExpenses || 0} HĐ`],
        ['Hạn mức định mức', s.budgetLimit ? formatVND(s.budgetLimit) : 'Không giới hạn', 'Tổng chi thực tế', formatVND(s.totalAmount)],
        ['Đã duyệt / Hoàn ứng', `${s.approved || 0} duyệt · ${s.reimbursed || 0} hoàn ứng`, 'Chờ duyệt / Từ chối', `${s.pending || 0} chờ · ${s.rejected || 0} từ chối`],
    ];

    autoTable(doc, {
        startY: y,
        head: summaryHead,
        body: summaryBody,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3, ...fontOpts },
        headStyles: { fillColor: [43, 158, 158], textColor: 255, ...fontOpts },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 45 },
            1: { cellWidth: 46 },
            2: { fontStyle: 'bold', cellWidth: 45 },
            3: { cellWidth: 46 },
        }
    });

    y = doc.lastAutoTable.finalY + 10;

    // 4. Phần II: Phân bổ chi phí theo danh mục
    if (deptData?.byCategory?.length) {
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text('II. PHÂN BỔ CHI PHÍ THEO DANH MỤC', 14, y);
        y += 4;

        const catRows = deptData.byCategory.map((c, i) => {
            const pct = s.totalAmount > 0 ? `${Math.round((c.total / s.totalAmount) * 100)}%` : '0%';
            return [i + 1, c.name, c.count, formatVND(c.total), pct];
        });

        autoTable(doc, {
            startY: y,
            head: [['STT', 'Danh mục chi tiêu', 'Số HĐ', 'Tổng chi (VNĐ)', 'Tỷ trọng']],
            body: catRows,
            theme: 'striped',
            styles: { fontSize: 8.5, cellPadding: 2.5, ...fontOpts },
            headStyles: { fillColor: [71, 85, 105], textColor: 255, ...fontOpts },
            columnStyles: {
                0: { halign: 'center', cellWidth: 14 },
                1: { cellWidth: 70 },
                2: { halign: 'center', cellWidth: 26 },
                3: { halign: 'right', cellWidth: 42 },
                4: { halign: 'right', cellWidth: 30 },
            }
        });

        y = doc.lastAutoTable.finalY + 10;
    }

    // 5. Phần III: Danh sách chi phí nhân viên
    if (deptData?.employees?.length) {
        if (y > 220) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text('III. DANH SÁCH CHI PHÍ NHÂN VIÊN', 14, y);
        y += 4;

        const empRows = deptData.employees.map((e, i) => {
            const role = e.role === 'ADMIN' ? 'Admin' : e.role === 'MANAGER' ? 'Trưởng phòng' : 'Nhân viên';
            return [i + 1, e.name, e.email, role, e.totalExpenses, formatVND(e.totalAmount)];
        });

        autoTable(doc, {
            startY: y,
            head: [['STT', 'Họ và tên', 'Email', 'Chức vụ', 'Số HĐ', 'Tổng chi (VNĐ)']],
            body: empRows,
            theme: 'striped',
            styles: { fontSize: 8.5, cellPadding: 2.5, ...fontOpts },
            headStyles: { fillColor: [71, 85, 105], textColor: 255, ...fontOpts },
            columnStyles: {
                0: { halign: 'center', cellWidth: 12 },
                1: { cellWidth: 45 },
                2: { cellWidth: 50 },
                3: { halign: 'center', cellWidth: 28 },
                4: { halign: 'center', cellWidth: 18 },
                5: { halign: 'right', cellWidth: 29 },
            }
        });

        y = doc.lastAutoTable.finalY + 14;
    }

    // 6. Phần IV: Khung chữ ký 3 cột
    if (y > 235) {
        doc.addPage();
        y = 25;
    }

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('NGƯỜI LẬP BIỂU', 35, y, { align: 'center' });
    doc.text('KẾ TOÁN TRƯỞNG', 105, y, { align: 'center' });
    doc.text('THỦ TRƯỞNG ĐƠN VỊ', 175, y, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('(Ký, ghi rõ họ tên)', 35, y + 4, { align: 'center' });
    doc.text('(Ký, ghi rõ họ tên)', 105, y + 4, { align: 'center' });
    doc.text('(Ký, đóng dấu)', 175, y + 4, { align: 'center' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text(userName || '—', 35, y + 24, { align: 'center' });
    doc.text('........................', 105, y + 24, { align: 'center' });
    doc.text('........................', 175, y + 24, { align: 'center' });

    return doc;
}

// ── Export Excel theo chuẩn form bảng tính Excel ──
function exportExcel(deptData, periodLabel, userName, companyInfo) {
    if (!deptData) return;
    const wb = XLSX.utils.book_new();
    const s = deptData.summary || {};

    // 1. Sheet "Tổng quan ngân sách"
    const s1Data = [
        { 'Chỉ tiêu đối soát': 'Đơn vị phát hành', 'Giá trị': companyInfo?.companyName || 'Công ty Cổ phần Công nghệ VKU Global', 'Ghi chú': companyInfo?.taxCode ? `MST: ${companyInfo.taxCode}` : '' },
        { 'Chỉ tiêu đối soát': 'Phòng ban', 'Giá trị': deptData.departmentName || 'Toàn hệ thống công ty', 'Ghi chú': '' },
        { 'Chỉ tiêu đối soát': 'Kỳ báo cáo', 'Giá trị': periodLabel || 'Tất cả thời gian', 'Ghi chú': '' },
        { 'Chỉ tiêu đối soát': 'Tổng nhân sự', 'Giá trị': s.totalUsers || 0, 'Ghi chú': 'Người' },
        { 'Chỉ tiêu đối soát': 'Tổng số hóa đơn đối soát', 'Giá trị': s.totalExpenses || 0, 'Ghi chú': 'Hóa đơn' },
        { 'Chỉ tiêu đối soát': 'Hạn mức định mức (VNĐ)', 'Giá trị': s.budgetLimit || 'Không giới hạn', 'Ghi chú': 'Định mức theo chính sách' },
        { 'Chỉ tiêu đối soát': 'Tổng chi thực tế (VNĐ)', 'Giá trị': s.totalAmount || 0, 'Ghi chú': 'Thực chi đã tổng hợp' },
        { 'Chỉ tiêu đối soát': 'Hóa đơn đã duyệt', 'Giá trị': s.approved || 0, 'Ghi chú': 'Hóa đơn hợp lệ' },
        { 'Chỉ tiêu đối soát': 'Hóa đơn đã hoàn ứng On-chain', 'Giá trị': s.reimbursed || 0, 'Ghi chú': 'Đã chuyển token vVND' },
        { 'Chỉ tiêu đối soát': 'Hóa đơn đang chờ duyệt', 'Giá trị': s.pending || 0, 'Ghi chú': 'Cần kiểm tra đối soát' },
        { 'Chỉ tiêu đối soát': 'Hóa đơn bị từ chối', 'Giá trị': s.rejected || 0, 'Ghi chú': 'Không đạt yêu cầu' },
        { 'Chỉ tiêu đối soát': 'Ngày xuất báo cáo', 'Giá trị': new Date().toLocaleDateString('vi-VN'), 'Ghi chú': '' },
        { 'Chỉ tiêu đối soát': 'Người lập báo cáo', 'Giá trị': userName || '—', 'Ghi chú': '' },
    ];
    const ws1 = XLSX.utils.json_to_sheet(s1Data);
    ws1['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Tổng quan ngân sách');

    // 2. Sheet "Theo danh mục chi tiêu"
    if (deptData.byCategory?.length) {
        const s2Data = deptData.byCategory.map((c, i) => {
            const pct = s.totalAmount > 0 ? `${Math.round((c.total / s.totalAmount) * 100)}%` : '0%';
            return {
                'STT': i + 1,
                'Danh mục chi tiêu': c.name,
                'Số lượng hóa đơn': c.count,
                'Tổng chi (VNĐ)': c.total,
                'Tỷ trọng': pct,
            };
        });
        s2Data.push({
            'STT': '',
            'Danh mục chi tiêu': 'Tổng cộng',
            'Số lượng hóa đơn': s.totalExpenses || 0,
            'Tổng chi (VNĐ)': s.totalAmount || 0,
            'Tỷ trọng': '100%',
        });
        const ws2 = XLSX.utils.json_to_sheet(s2Data);
        ws2['!cols'] = [{ wch: 8 }, { wch: 26 }, { wch: 18 }, { wch: 20 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Theo danh mục');
    }

    // 3. Sheet "Chi tiết nhân viên"
    if (deptData.employees?.length) {
        const s3Data = deptData.employees.map((e, i) => {
            const role = e.role === 'ADMIN' ? 'Admin' : e.role === 'MANAGER' ? 'Trưởng phòng' : 'Nhân viên';
            return {
                'STT': i + 1,
                'Họ và tên': e.name,
                'Email': e.email,
                'Chức vụ': role,
                'Phòng ban': e.department || deptData.departmentName || '—',
                'Số hóa đơn': e.totalExpenses,
                'Tổng chi tiêu (VNĐ)': e.totalAmount,
            };
        });
        const ws3 = XLSX.utils.json_to_sheet(s3Data);
        ws3['!cols'] = [{ wch: 8 }, { wch: 26 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, ws3, 'Chi tiết nhân viên');
    }

    // 4. Sheet "Theo tháng"
    if (deptData.byMonth?.length) {
        const s4Data = deptData.byMonth.map((m, i) => ({
            'STT': i + 1,
            'Tháng': m.month,
            'Số hóa đơn': m.count,
            'Tổng chi (VNĐ)': m.total,
        }));
        const ws4 = XLSX.utils.json_to_sheet(s4Data);
        ws4['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, ws4, 'Theo tháng');
    }

    const safeDept = (deptData.departmentName || 'tat-ca').toLowerCase().replace(/\s+/g, '-');
    XLSX.writeFile(wb, `bao-cao-${safeDept}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Budget Progress Indicator ──
function BudgetWidget({ totalAmount, budgetLimit }) {
    if (!budgetLimit || budgetLimit <= 0) return null;

    const percent = Math.min(Math.round((totalAmount / budgetLimit) * 100), 100);
    const rawPercent = ((totalAmount / budgetLimit) * 100).toFixed(1);
    const isExceeded = totalAmount > budgetLimit;
    const isWarning = rawPercent >= 80 && !isExceeded;

    const barColor = isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

    return (
        <div className="card" style={{ marginBottom: 24, border: `1px solid ${isExceeded ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={18} color={barColor} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Giám sát định mức ngân sách công tác</span>
                </div>
                <div>
                    {isExceeded ? (
                        <span className="badge badge-danger">Vượt định mức ({rawPercent}%)</span>
                    ) : isWarning ? (
                        <span className="badge badge-warning">Cảnh báo: Sắp chạm trần ({rawPercent}%)</span>
                    ) : (
                        <span className="badge badge-success">Trong định mức ({rawPercent}%)</span>
                    )}
                </div>
            </div>

            <div style={{ width: '100%', height: 10, background: 'rgba(203,213,225,0.3)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                <div
                    style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 5,
                        transition: 'width 0.4s ease',
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
                <span>Đã chi tiêu: <strong style={{ color: 'var(--color-text)' }}>{formatVND(totalAmount)}</strong></span>
                <span>Hạn mức tối đa theo Policy: <strong style={{ color: 'var(--color-text)' }}>{formatVND(budgetLimit)}</strong></span>
            </div>
        </div>
    );
}

// ── Reusable Category Breakdown Table ──
function CategoryBreakdownTable({ byCategory }) {
    if (!byCategory || byCategory.length === 0) return null;
    const total = byCategory.reduce((sum, c) => sum + c.total, 0);

    return (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 12 }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Danh mục</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Số HĐ</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tổng chi</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tỷ lệ</th>
                    </tr>
                </thead>
                <tbody>
                    {byCategory.map((cat, idx) => {
                        const pct = total > 0 ? ((cat.total / total) * 100).toFixed(1) : 0;
                        const catColor = getCategoryColor(cat.name) || PIE_COLORS[idx % PIE_COLORS.length];
                        return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light, #f1f5f9)' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                                    {cat.name}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>{cat.count}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatVND(cat.total)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{pct}%</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ══════════════════════════════════════
//  Main Admin Reports Component
// ══════════════════════════════════════
export default function ReportsPage() {
    const { user } = useAuth();
    const [deptData, setDeptData] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [period, setPeriod] = useState('all');
    const [loading, setLoading] = useState(true);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    // Bộ lọc & tìm kiếm cho bảng nhân viên
    const [empSearch, setEmpSearch] = useState('');
    const [empRoleFilter, setEmpRoleFilter] = useState('');
    const [empSortBy, setEmpSortBy] = useState('amount_desc');

    const fetchData = async (deptId, currentPeriod) => {
        try {
            const res = await adminAPI.reportsDepartment(deptId || undefined, currentPeriod);
            setDeptData(res.data);
        } catch (err) {
            console.error('Lỗi tải báo cáo:', err);
        }
    };

    useEffect(() => {
        Promise.all([
            adminAPI.reportsDepartment(undefined, 'all'),
            adminAPI.departmentsList(),
            adminAPI.company().catch(() => ({ data: null })),
        ]).then(([deptRes, deptsRes, compRes]) => {
            setDeptData(deptRes.data);
            setDepartments(deptsRes.data || []);
            if (compRes?.data) setCompanyInfo(compRes.data);
        }).catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleDeptChange = (deptId) => {
        setSelectedDept(deptId);
        fetchData(deptId, period);
    };

    const handlePrint = () => {
        const printContent = document.getElementById('report-print-area');
        if (!printContent) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Báo cáo chi phí - ${deptData?.departmentName || 'Toàn hệ thống'}</title>
                <style>
                    @page { size: A4; margin: 15mm; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                        color: #0f172a;
                        background: #ffffff;
                        font-size: 11pt;
                        line-height: 1.5;
                        margin: 0;
                        padding: 0;
                    }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 9.5pt; }
                    th, td { border: 1px solid #cbd5e1; padding: 6px 10px; }
                    th { background-color: #f1f5f9; font-weight: 600; text-align: left; }
                    .header-row { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                    .header-org { font-weight: 700; font-size: 11pt; text-transform: uppercase; }
                    .header-sub { font-size: 9pt; color: #64748b; }
                    .header-meta { text-align: right; font-size: 9pt; color: #64748b; }
                    .report-title-box { text-align: center; margin-bottom: 24px; }
                    .report-title { margin: 0 0 6px 0; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
                    .report-dept { font-size: 11pt; font-weight: 600; color: #088395; }
                    .report-period { font-size: 9.5pt; color: #64748b; margin-top: 2px; }
                    .sec-title { font-weight: 700; font-size: 10.5pt; text-transform: uppercase; margin: 18px 0 8px 0; color: #0f172a; }
                    .sign-grid { display: flex; justify-content: space-between; text-align: center; margin-top: 40px; page-break-inside: avoid; }
                    .sign-col { width: 30%; font-size: 9.5pt; }
                    .sign-role { font-weight: 700; text-transform: uppercase; }
                    .sign-hint { color: #94a3b8; font-style: italic; font-size: 8.5pt; }
                    .sign-name { margin-top: 48px; font-weight: 600; }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => {
                try {
                    document.body.removeChild(iframe);
                } catch { }
            }, 1000);
        }, 250);
    };

    const handleDownloadPDF = async () => {
        setIsDownloadingPdf(true);
        try {
            const doc = await generatePDFDoc(deptData, currentPeriodLabel, user?.name, companyInfo);
            const safeName = (companyInfo?.companyName || deptData?.departmentName || 'bao-cao')
                .toLowerCase()
                .replace(/[^a-z0-9]/gi, '-');
            doc.save(`bao-cao-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('Lỗi khi xuất PDF:', err);
            alert('Không thể tạo file PDF: ' + (err.message || ''));
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handleExportExcel = () => {
        exportExcel(deptData, currentPeriodLabel, user?.name, companyInfo);
    };

    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        fetchData(selectedDept, newPeriod);
    };

    const currentPeriodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || 'Tất cả';

    // Lọc và sắp xếp danh sách nhân viên
    const filteredEmployees = useMemo(() => {
        if (!deptData?.employees) return [];
        return deptData.employees
            .filter(emp => {
                if (empRoleFilter && emp.role !== empRoleFilter) return false;
                if (empSearch) {
                    const q = empSearch.toLowerCase();
                    const matchName = emp.name?.toLowerCase().includes(q);
                    const matchEmail = emp.email?.toLowerCase().includes(q);
                    return matchName || matchEmail;
                }
                return true;
            })
            .sort((a, b) => {
                if (empSortBy === 'amount_desc') return (b.totalAmount || 0) - (a.totalAmount || 0);
                if (empSortBy === 'amount_asc') return (a.totalAmount || 0) - (b.totalAmount || 0);
                if (empSortBy === 'count_desc') return (b.totalExpenses || 0) - (a.totalExpenses || 0);
                if (empSortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
                return 0;
            });
    }, [deptData?.employees, empSearch, empRoleFilter, empSortBy]);

    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                <p style={{ color: 'var(--color-text-muted)' }}>Trang này dành cho Quản trị viên và Quản lý phòng ban.</p>
            </div>
        );
    }

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;
    if (!deptData) return <div className="card"><p>Không tải được dữ liệu báo cáo</p></div>;

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={24} color="#2b9e9e" /> Báo cáo & Đối soát tài chính
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                        Phân tích chi phí theo phòng ban, đối chiếu định mức và trích xuất dữ liệu kế toán
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowPrintModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    >
                        <Printer size={15} /> In / Xuất báo cáo
                    </button>
                </div>
            </div>

            {/* ── Filter Toolbar ── */}
            <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    {/* Department Selector */}
                    {user?.role === 'ADMIN' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Building2 size={18} style={{ color: 'var(--color-text-muted)' }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>Phòng ban:</span>
                            <select
                                value={selectedDept}
                                onChange={(e) => handleDeptChange(e.target.value)}
                                className="form-select"
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, minWidth: 200 }}
                            >
                                <option value="">Tất cả phòng ban</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Building2 size={18} style={{ color: '#2b9e9e' }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>Phòng ban:</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#2b9e9e' }}>
                                {deptData?.departmentName || 'Phòng ban của tôi'}
                            </span>
                        </div>
                    )}

                    {/* Period Filter Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Filter size={16} style={{ color: 'var(--color-text-muted)', marginRight: 4 }} />
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handlePeriodChange(opt.value)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: period === opt.value ? 600 : 400,
                                    border: period === opt.value ? '1px solid var(--color-primary, #2b9e9e)' : '1px solid var(--color-border-light, #e2e8f0)',
                                    background: period === opt.value ? 'rgba(43,158,158,0.1)' : 'transparent',
                                    color: period === opt.value ? 'var(--color-primary, #2b9e9e)' : 'var(--color-text-muted)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Budget Widget (If available) ── */}
            {deptData.summary && (
                <BudgetWidget
                    totalAmount={deptData.summary.totalAmount}
                    budgetLimit={deptData.summary.budgetLimit}
                />
            )}

            {/* ── Summary Stat Cards ── */}
            {deptData.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Nhân sự</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{deptData.summary.totalUsers}</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Hóa đơn đối soát</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{deptData.summary.totalExpenses}</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Tổng chi phí</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#2b9e9e' }}>{formatVND(deptData.summary.totalAmount)}</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Đã hoàn ứng On-chain</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{deptData.summary.reimbursed}</div>
                    </div>
                </div>
            )}

            {/* ── Visual Analytics (Monthly + Category) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Monthly Bar Chart */}
                <div className="card">
                    <h3 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <TrendingUp size={16} color="#2b9e9e" /> Chi tiêu theo các tháng
                    </h3>
                    {(!deptData.byMonth || deptData.byMonth.length === 0) ? (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 48 }}>Không có dữ liệu trong khoảng thời gian này</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={deptData.byMonth} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(203,213,225,0.25)" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(203,213,225,0.3)' }} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
                                <Tooltip cursor={false} formatter={(v) => [formatVND(v), 'Tổng chi']} contentStyle={tooltipStyle} />
                                <Bar dataKey="total" fill="#2b9e9e" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Category Donut & Table */}
                <div className="card">
                    <h3 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <PieIcon size={16} color="#f59e0b" /> Cơ cấu danh mục chi phí
                    </h3>
                    {(!deptData.byCategory || deptData.byCategory.length === 0) ? (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 48 }}>Không có dữ liệu danh mục</p>
                    ) : (
                        <div>
                            <ResponsiveContainer width="100%" height={170}>
                                <PieChart>
                                    <Pie
                                        data={deptData.byCategory}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={75}
                                        paddingAngle={3}
                                        dataKey="total"
                                        nameKey="name"
                                        strokeWidth={0}
                                    >
                                        {deptData.byCategory.map((entry, i) => (
                                            <Cell key={i} fill={getCategoryColor(entry.name) || PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip cursor={false} formatter={(v, name) => [formatVND(v), name]} contentStyle={tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                            <CategoryBreakdownTable byCategory={deptData.byCategory} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Employee Breakdown Table ── */}
            {deptData.employees?.length > 0 && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                        <div>
                            <h3 className="card__title" style={{ margin: 0 }}>Chi tiết chi phí nhân viên</h3>
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                Hiển thị {filteredEmployees.length} / {deptData.employees.length} nhân sự
                            </span>
                        </div>

                        {/* Bộ lọc & Tìm kiếm riêng cho bảng nhân viên */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', width: 200 }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Tìm tên hoặc email..."
                                    value={empSearch}
                                    onChange={(e) => setEmpSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '6px 10px 6px 30px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        fontSize: 12,
                                        background: 'var(--color-bg)',
                                    }}
                                />
                            </div>

                            <select
                                value={empRoleFilter}
                                onChange={(e) => setEmpRoleFilter(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12, background: 'var(--color-bg)' }}
                            >
                                <option value="">Tất cả chức vụ</option>
                                <option value="EMPLOYEE">Nhân viên</option>
                                <option value="MANAGER">Trưởng phòng</option>
                                <option value="ADMIN">Admin</option>
                            </select>

                            <select
                                value={empSortBy}
                                onChange={(e) => setEmpSortBy(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12, background: 'var(--color-bg)' }}
                            >
                                <option value="amount_desc">Chi phí: Cao nhất</option>
                                <option value="amount_asc">Chi phí: Thấp nhất</option>
                                <option value="count_desc">Số HĐ: Nhiều nhất</option>
                                <option value="name_asc">Tên: A → Z</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Tên nhân viên</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Email</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Chức vụ</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Số HĐ</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Tổng chi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                                            Không tìm thấy nhân viên phù hợp với từ khóa
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployees.map((emp, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light, #f1f5f9)' }}>
                                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{emp.name}</td>
                                            <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{emp.email}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span className={`badge ${emp.role === 'ADMIN' ? 'badge-info' : emp.role === 'MANAGER' ? 'badge-warning' : 'badge-neutral'}`}>
                                                    {emp.role === 'ADMIN' ? 'Admin' : emp.role === 'MANAGER' ? 'Trưởng phòng' : 'Nhân viên'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>{emp.totalExpenses}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#2b9e9e' }}>{formatVND(emp.totalAmount)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Modal Xem trước Báo cáo (Khổ A4 chuẩn dạng Modal) ── */}
            {showPrintModal && (
                <div
                    onClick={() => setShowPrintModal(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: 860,
                            width: '95%',
                            maxHeight: '92vh',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: 0,
                            borderRadius: 16,
                            overflow: 'hidden',
                            background: '#ffffff',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        }}
                    >
                        {/* Header của Modal */}
                        <div style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid var(--color-border)',
                            background: 'var(--color-bg-card-solid, #ffffff)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileText size={18} color="#2b9e9e" />
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Xem trước Báo cáo (Khổ A4)</h3>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handlePrint}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    <Printer size={14} /> In ngay
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleDownloadPDF}
                                    disabled={isDownloadingPdf}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    {isDownloadingPdf ? (
                                        <>
                                            <span className="spinner" style={{ width: 12, height: 12 }} />
                                            <span>Đang tạo PDF...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={14} /> Tải PDF
                                        </>
                                    )}
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleExportExcel}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    <FileSpreadsheet size={14} /> Xuất Excel
                                </button>
                                <button
                                    onClick={() => setShowPrintModal(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-muted)' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Trang giấy A4 mô phỏng trong modal */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            background: '#f1f5f9',
                            padding: '24px 16px',
                            display: 'flex',
                            justifyContent: 'center',
                        }}>
                            <div
                                id="report-print-area"
                                style={{
                                    background: '#ffffff',
                                    color: '#0f172a',
                                    width: '100%',
                                    maxWidth: 720,
                                    minHeight: 880,
                                    padding: '40px 48px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                    borderRadius: 4,
                                    fontSize: 12,
                                    lineHeight: 1.6,
                                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                                }}
                            >
                                {/* Tiêu đề đơn vị & ngày */}
                                <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 24 }}>
                                    <div>
                                        <div className="header-org" style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            {companyInfo?.companyName || 'CÔNG TY CỔ PHẦN CÔNG NGHỆ VKU GLOBAL'}
                                        </div>
                                        <div className="header-sub" style={{ fontSize: 11, color: '#64748b' }}>
                                            {companyInfo?.taxCode ? `MST: ${companyInfo.taxCode} · ` : ''}Hệ thống Quản lý Chi phí Công tác & Hoàn ứng Web3 (FlexiTrip)
                                        </div>
                                    </div>
                                    <div className="header-meta" style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
                                        <div>Ngày in: {new Date().toLocaleDateString('vi-VN')}</div>
                                        <div>Người xuất: {user?.name || '—'}</div>
                                    </div>
                                </div>

                                {/* Tiêu đề chính */}
                                <div className="report-title-box" style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <h2 className="report-title" style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        BÁO CÁO TỔNG HỢP CHI PHÍ CÔNG TÁC
                                    </h2>
                                    <div className="report-dept" style={{ fontSize: 13, fontWeight: 600, color: '#088395' }}>
                                        Phòng ban: {deptData.departmentName || 'Toàn hệ thống công ty'}
                                    </div>
                                    <div className="report-period" style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        Kỳ báo cáo: {currentPeriodLabel}
                                    </div>
                                </div>

                                {/* I. Bảng số liệu tổng hợp */}
                                <div style={{ marginBottom: 24 }}>
                                    <div className="sec-title" style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', marginBottom: 8, color: '#0f172a' }}>
                                        I. Tổng hợp ngân sách & quyết toán
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: 11 }}>
                                        <tbody>
                                            <tr style={{ background: '#f8fafc' }}>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Tổng nhân sự:</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{deptData.summary?.totalUsers || 0} người</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Tổng số hóa đơn:</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{deptData.summary?.totalExpenses || 0} HĐ</td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Hạn mức định mức:</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{deptData.summary?.budgetLimit ? formatVND(deptData.summary.budgetLimit) : 'Không giới hạn'}</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Tổng chi thực tế:</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#0f766e' }}>{formatVND(deptData.summary?.totalAmount)}</td>
                                            </tr>
                                            <tr style={{ background: '#f8fafc' }}>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Đã duyệt / Hoàn ứng:</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{deptData.summary?.approved || 0} duyệt · {deptData.summary?.reimbursed || 0} hoàn ứng</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Chờ duyệt / Từ chối:</td>
                                                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{deptData.summary?.pending || 0} chờ · {deptData.summary?.rejected || 0} từ chối</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* II. Bảng cơ cấu chi phí */}
                                {deptData.byCategory?.length > 0 && (
                                    <div style={{ marginBottom: 24 }}>
                                        <div className="sec-title" style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', marginBottom: 8, color: '#0f172a' }}>
                                            II. Phân bổ chi phí theo danh mục
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: 11 }}>
                                            <thead>
                                                <tr style={{ background: '#f1f5f9' }}>
                                                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Danh mục</th>
                                                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center', width: 90 }}>Số HĐ</th>
                                                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Tổng chi</th>
                                                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: 80 }}>Tỷ trọng</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deptData.byCategory.map((cat, i) => (
                                                    <tr key={i}>
                                                        <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{cat.name}</td>
                                                        <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{cat.count}</td>
                                                        <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }}>{formatVND(cat.total)}</td>
                                                        <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                                                            {Math.round((cat.total / (deptData.summary?.totalAmount || 1)) * 100)}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* III. Bảng nhân viên */}
                                {deptData.employees?.length > 0 && (
                                    <div style={{ marginBottom: 36 }}>
                                        <div className="sec-title" style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', marginBottom: 8, color: '#0f172a' }}>
                                            III. Danh sách chi phí nhân viên
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: 11 }}>
                                            <thead>
                                                <tr style={{ background: '#f1f5f9' }}>
                                                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Họ và tên</th>
                                                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Email</th>
                                                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Số HĐ</th>
                                                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Tổng chi phí</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deptData.employees.map((emp, i) => (
                                                    <tr key={i}>
                                                        <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 500 }}>{emp.name}</td>
                                                        <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', color: '#64748b' }}>{emp.email}</td>
                                                        <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{emp.totalExpenses}</td>
                                                        <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }}>{formatVND(emp.totalAmount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* IV. Khung chữ ký 3 cột */}
                                <div className="sign-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', marginTop: 40, fontSize: 11 }}>
                                    <div className="sign-col">
                                        <div className="sign-role" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Người lập biểu</div>
                                        <div className="sign-hint" style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 10 }}>(Ký, ghi rõ họ tên)</div>
                                        <div className="sign-name" style={{ marginTop: 48, fontWeight: 600 }}>{user?.name || '—'}</div>
                                    </div>
                                    <div className="sign-col">
                                        <div className="sign-role" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Kế toán trưởng</div>
                                        <div className="sign-hint" style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 10 }}>(Ký, ghi rõ họ tên)</div>
                                        <div className="sign-name" style={{ marginTop: 48, color: '#cbd5e1' }}>........................</div>
                                    </div>
                                    <div className="sign-col">
                                        <div className="sign-role" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Thủ trưởng đơn vị</div>
                                        <div className="sign-hint" style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 10 }}>(Ký, đóng dấu)</div>
                                        <div className="sign-name" style={{ marginTop: 48, color: '#cbd5e1' }}>........................</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
