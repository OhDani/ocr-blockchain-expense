/**
 * ReportsPage.jsx — Báo cáo thống kê (cho tất cả role)
 * Admin: thống kê toàn công ty theo phòng ban
 * Employee/Manager: thống kê cá nhân
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminAPI } from '../../api/client.js';
import { BarChart3, TrendingUp, PieChart as PieIcon, DollarSign, FileText, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/** Palette khớp với Dashboard — PIE */
const PIE_COLORS = ['#2b9e9e', '#60a5fa', '#f59e0b', '#f87171', '#8b5cf6', '#34d399'];

/** Palette trạng thái — khớp với AdminDashboard STATUS_MAP */
const STATUS_COLORS = {
    PENDING: '#fbbf24',
    APPROVED: '#60a5fa',
    REJECTED: '#f87171',
    REIMBURSED: '#34d399',
};

const STATUS_LABELS = {
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Từ chối',
    REIMBURSED: 'Đã hoàn ứng',
};

const formatVND = (v) => `${Number(v).toLocaleString('vi-VN')}đ`;

/** Tooltip style khớp Dashboard — xóa phông xám khi hover */
const tooltipStyle = {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: 13,
};

/** Export PDF — tải font Roboto từ CDN để hỗ trợ tiếng Việt */
let _cachedFontBase64 = null; // Cache font sau lần tải đầu

async function exportPDF(data, isAdmin, userName) {
    const doc = new jsPDF();

    // Tải font Roboto hỗ trợ tiếng Việt (Unicode) — cache lại sau lần đầu
    try {
        if (!_cachedFontBase64) {
            const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf';
            const res = await fetch(fontUrl);
            const buf = await res.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            _cachedFontBase64 = btoa(binary);
        }
        doc.addFileToVFS('Roboto-Regular.ttf', _cachedFontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
    } catch {
        console.warn('Không tải được font Roboto, dùng font mặc định');
    }

    const hasViFont = !!doc.getFontList()['Roboto'];
    const fontOpts = hasViFont ? { font: 'Roboto', fontStyle: 'normal' } : {};

    doc.setFontSize(16);
    doc.text('Báo cáo chi tiêu', 14, 20);
    doc.setFontSize(10);
    doc.text(`Người dùng: ${userName || '—'} | Ngày: ${new Date().toLocaleDateString('vi-VN')}`, 14, 28);

    let y = 36;
    const p = data.personal;
    if (p?.summary) {
        doc.setFontSize(12);
        doc.text('Tóm tắt cá nhân', 14, y);
        y += 6;
        autoTable(doc, {
            startY: y,
            head: [['Tổng chi', 'Số HĐ', 'Đã duyệt', 'Từ chối', 'Chờ duyệt', 'Đã hoàn ứng']],
            body: [[
                Number(p.summary.totalSpent).toLocaleString('vi-VN') + 'đ',
                p.summary.totalCount, p.summary.approved,
                p.summary.rejected, p.summary.pending, p.summary.reimbursed,
            ]],
            theme: 'grid',
            styles: { fontSize: 9, ...fontOpts },
            headStyles: fontOpts,
        });
        y = doc.lastAutoTable.finalY + 10;
    }

    if (p?.byMonth?.length) {
        doc.setFontSize(12);
        doc.text('Chi tiêu theo tháng', 14, y);
        y += 6;
        autoTable(doc, {
            startY: y,
            head: [['Tháng', 'Tổng chi', 'Số HĐ']],
            body: p.byMonth.map(m => [m.month, Number(m.total).toLocaleString('vi-VN') + 'đ', m.count]),
            theme: 'striped',
            styles: { fontSize: 9, ...fontOpts },
            headStyles: fontOpts,
        });
        y = doc.lastAutoTable.finalY + 10;
    }

    if (isAdmin && data.company?.byDepartment?.length) {
        doc.setFontSize(12);
        doc.text('Chi tiêu theo phòng ban', 14, y);
        y += 6;
        autoTable(doc, {
            startY: y,
            head: [['Phòng ban', 'Tổng chi', 'Số HĐ']],
            body: data.company.byDepartment.map(d => [d.name, Number(d.total).toLocaleString('vi-VN') + 'đ', d.count]),
            theme: 'striped',
            styles: { fontSize: 9, ...fontOpts },
            headStyles: fontOpts,
        });
    }

    doc.save(`bao-cao-chi-tieu-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Export Excel */
function exportExcel(data, isAdmin) {
    const wb = XLSX.utils.book_new();
    const p = data.personal;

    if (p?.byMonth?.length) {
        const ws = XLSX.utils.json_to_sheet(p.byMonth.map(m => ({
            'Tháng': m.month,
            'Tổng chi (đ)': m.total,
            'Số hóa đơn': m.count,
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Theo tháng');
    }

    if (p?.byCategory?.length) {
        const ws = XLSX.utils.json_to_sheet(p.byCategory.map(c => ({
            'Loại': c.name,
            'Tổng chi (đ)': c.total,
            'Số hóa đơn': c.count,
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Theo loại');
    }

    if (isAdmin && data.company?.byDepartment?.length) {
        const ws = XLSX.utils.json_to_sheet(data.company.byDepartment.map(d => ({
            'Phòng ban': d.name,
            'Tổng chi (đ)': d.total,
            'Số hóa đơn': d.count,
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Theo phòng ban');
    }

    if (isAdmin && data.company?.statusDistribution?.length) {
        const ws = XLSX.utils.json_to_sheet(data.company.statusDistribution.map(s => ({
            'Trạng thái': STATUS_LABELS[s.status] || s.status,
            'Số hóa đơn': s.count,
            'Tổng chi (đ)': s.total,
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Theo trạng thái');
    }

    XLSX.writeFile(wb, `bao-cao-chi-tieu-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function ReportsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                if (isAdmin) {
                    const [companyRes, personalRes] = await Promise.all([
                        adminAPI.reports(),
                        adminAPI.reportsPersonal(),
                    ]);
                    setData({ company: companyRes.data, personal: personalRes.data });
                } else {
                    const res = await adminAPI.reportsPersonal();
                    setData({ personal: res.data });
                }
            } catch (err) {
                console.error('Lỗi tải báo cáo:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [isAdmin]);

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;
    if (!data) return <div className="empty-state"><div className="empty-state__text">Không thể tải dữ liệu báo cáo</div></div>;

    const personal = data.personal;

    return (
        <div>
            <div className="page-header">
                <h1><BarChart3 size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Báo cáo thống kê</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    {isAdmin ? 'Tổng quan tài chính toàn công ty' : 'Thống kê chi tiêu cá nhân'}
                </p>
            </div>

            {/* Export buttons */}
            {data && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <button className="btn btn-secondary" onClick={() => exportPDF(data, isAdmin, user?.name)}>
                        <Download size={14} /> Xuất PDF
                    </button>
                    <button className="btn btn-secondary" onClick={() => exportExcel(data, isAdmin)}>
                        <Download size={14} /> Xuất Excel
                    </button>
                </div>
            )}

            {/* Tóm tắt — Admin: toàn công ty, Employee/Manager: cá nhân */}
            {(() => {
                const summary = isAdmin ? data.company?.summary : personal?.summary;
                if (!summary) return null;
                const totalSpentValue = isAdmin ? summary.totalAmount : summary.totalSpent;
                return (
                    <>
                        {isAdmin && <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>📊 Tổng hợp toàn công ty</h3>}
                        <div className="stats-grid" style={{ marginBottom: 24 }}>
                            <div className="stat-card">
                                <div className="stat-card__icon" style={{ background: 'rgba(43,158,158,0.1)', color: '#2b9e9e' }}><DollarSign size={20} /></div>
                                <div className="stat-card__label">Tổng chi tiêu</div>
                                <div className="stat-card__value">{formatVND(totalSpentValue)}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-card__icon" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}><Clock size={20} /></div>
                                <div className="stat-card__label">Chờ duyệt</div>
                                <div className="stat-card__value">{summary.pending}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-card__icon" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}><CheckCircle size={20} /></div>
                                <div className="stat-card__label">Đã duyệt</div>
                                <div className="stat-card__value">{summary.approved}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-card__icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}><XCircle size={20} /></div>
                                <div className="stat-card__label">Từ chối</div>
                                <div className="stat-card__value">{summary.rejected}</div>
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Chi tiêu theo tháng */}
                {(() => {
                    const monthData = isAdmin ? data.company?.byMonth : personal?.byMonth;
                    if (!monthData?.length) return null;
                    return (
                        <div className="card">
                            <h3 className="card__title"><TrendingUp size={16} style={{ marginRight: 6 }} /> Chi tiêu theo tháng {isAdmin ? '(toàn công ty)' : ''}</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={monthData} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(203,213,225,0.3)" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        axisLine={{ stroke: 'rgba(203,213,225,0.3)' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v}
                                    />
                                    <Tooltip
                                        cursor={false}
                                        formatter={(v) => [formatVND(v), 'Tổng chi']}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar dataKey="total" fill="#2b9e9e" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    );
                })()}

                {/* Phân bổ theo loại */}
                {personal?.byCategory?.length > 0 && (
                    <div className="card">
                        <h3 className="card__title"><PieIcon size={16} style={{ marginRight: 6 }} /> Phân bổ theo loại</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={personal.byCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="total" nameKey="name" strokeWidth={0}>
                                    {personal.byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip
                                    cursor={false}
                                    formatter={(v, name) => [formatVND(v), name]}
                                    contentStyle={tooltipStyle}
                                />
                                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Admin: Chi tiêu theo phòng ban */}
            {isAdmin && data.company && (
                <>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 32 }}>📊 Thống kê toàn công ty</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        {data.company.byDepartment?.length > 0 && (
                            <div className="card">
                                <h3 className="card__title">Chi tiêu theo phòng ban</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={data.company.byDepartment} layout="vertical" barCategoryGap="20%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(203,213,225,0.3)" />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            axisLine={{ stroke: 'rgba(203,213,225,0.3)' }}
                                            tickLine={false}
                                            tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={120}
                                        />
                                        <Tooltip
                                            cursor={false}
                                            formatter={(v) => [formatVND(v), 'Tổng chi']}
                                            contentStyle={tooltipStyle}
                                        />
                                        <Bar dataKey="total" fill="#60a5fa" radius={[0, 6, 6, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {data.company.statusDistribution?.length > 0 && (
                            <div className="card">
                                <h3 className="card__title">Phân bổ trạng thái</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={data.company.statusDistribution.map(s => ({
                                                ...s,
                                                name: STATUS_LABELS[s.status] || s.status,
                                                fill: STATUS_COLORS[s.status] || '#94a3b8',
                                            }))}
                                            cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="count" nameKey="name" strokeWidth={0}
                                        >
                                            {data.company.statusDistribution.map((s, i) => (
                                                <Cell key={i} fill={STATUS_COLORS[s.status] || '#94a3b8'} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            cursor={false}
                                            formatter={(value, name) => [`${value} hóa đơn`, name]}
                                            contentStyle={tooltipStyle}
                                        />
                                        <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
