/**
 * ReportsPage.jsx — Báo cáo thống kê
 * Admin: overview tổng hợp (nhân viên, chuyến, hóa đơn, blockchain) + export (chọn phòng ban)
 * Manager: thống kê phòng ban mình + export phòng ban
 * Employee: không truy cập trang này
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminAPI } from '../../api/client.js';
import {
    BarChart3, TrendingUp, PieChart as PieIcon, FileText,
    Download, Building2,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PIE_COLORS = ['#2b9e9e', '#60a5fa', '#f59e0b', '#f87171', '#8b5cf6', '#34d399'];

const STATUS_LABELS = {
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Từ chối',
    REIMBURSED: 'Đã hoàn ứng',
};

const formatVND = (v) => v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—';

const tooltipStyle = {
    borderRadius: 12, border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13,
};

// ── PDF Font Helper ──
let _cachedFontBase64 = null;

async function loadViFont(doc) {
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
    return !!doc.getFontList()['Roboto'];
}

// ── Export PDF ──
async function exportPDF(deptData, title, userName) {
    const doc = new jsPDF();
    const hasViFont = await loadViFont(doc);
    const fontOpts = hasViFont ? { font: 'Roboto', fontStyle: 'normal' } : {};

    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Người xuất: ${userName || '—'} | Ngày: ${new Date().toLocaleDateString('vi-VN')}`, 14, 28);

    let y = 36;
    const s = deptData.summary;
    if (s) {
        doc.setFontSize(12);
        doc.text(`Phòng ban: ${deptData.departmentName || 'Tất cả'}`, 14, y);
        y += 6;
        autoTable(doc, {
            startY: y,
            head: [['Nhân viên', 'Số HĐ', 'Tổng chi', 'Đã duyệt', 'Từ chối', 'Chờ duyệt', 'Hoàn ứng']],
            body: [[
                s.totalUsers, s.totalExpenses,
                Number(s.totalAmount).toLocaleString('vi-VN') + 'đ',
                s.approved, s.rejected, s.pending, s.reimbursed,
            ]],
            theme: 'grid',
            styles: { fontSize: 9, ...fontOpts },
            headStyles: fontOpts,
        });
        y = doc.lastAutoTable.finalY + 10;
    }

    if (deptData.employees?.length) {
        doc.setFontSize(12);
        doc.text('Chi tiết nhân viên', 14, y);
        y += 6;
        autoTable(doc, {
            startY: y,
            head: [['Tên', 'Email', 'Chức vụ', 'Số HĐ', 'Tổng chi (đ)']],
            body: deptData.employees.map(e => [
                e.name, e.email, e.role,
                e.totalExpenses, Number(e.totalAmount).toLocaleString('vi-VN'),
            ]),
            theme: 'striped',
            styles: { fontSize: 9, ...fontOpts },
            headStyles: fontOpts,
        });
        y = doc.lastAutoTable.finalY + 10;
    }

    if (deptData.byMonth?.length) {
        doc.setFontSize(12);
        doc.text('Chi tiêu theo tháng', 14, y);
        y += 6;
        autoTable(doc, {
            startY: y,
            head: [['Tháng', 'Tổng chi', 'Số HĐ']],
            body: deptData.byMonth.map(m => [m.month, Number(m.total).toLocaleString('vi-VN') + 'đ', m.count]),
            theme: 'striped',
            styles: { fontSize: 9, ...fontOpts },
            headStyles: fontOpts,
        });
    }

    doc.save(`bao-cao-${(deptData.departmentName || 'tat-ca').replace(/\s/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Export Excel ──
function exportExcel(deptData, title) {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    if (deptData.summary) {
        const ws = XLSX.utils.json_to_sheet([{
            'Phòng ban': deptData.departmentName,
            'Số nhân viên': deptData.summary.totalUsers,
            'Số hóa đơn': deptData.summary.totalExpenses,
            'Tổng chi (đ)': deptData.summary.totalAmount,
            'Đã duyệt': deptData.summary.approved,
            'Từ chối': deptData.summary.rejected,
            'Chờ duyệt': deptData.summary.pending,
            'Hoàn ứng': deptData.summary.reimbursed,
        }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Tổng hợp');
    }

    if (deptData.employees?.length) {
        const ws = XLSX.utils.json_to_sheet(deptData.employees.map(e => ({
            'Tên': e.name, 'Email': e.email, 'Chức vụ': e.role,
            'Phòng ban': e.department, 'Số HĐ': e.totalExpenses, 'Tổng chi (đ)': e.totalAmount,
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Nhân viên');
    }

    if (deptData.byMonth?.length) {
        const ws = XLSX.utils.json_to_sheet(deptData.byMonth.map(m => ({
            'Tháng': m.month, 'Tổng chi (đ)': m.total, 'Số hóa đơn': m.count,
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Theo tháng');
    }

    if (deptData.byCategory?.length) {
        const ws = XLSX.utils.json_to_sheet(deptData.byCategory.map(c => ({
            'Loại': c.name, 'Tổng chi (đ)': c.total, 'Số hóa đơn': c.count,
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Theo loại');
    }

    XLSX.writeFile(wb, `bao-cao-${(deptData.departmentName || 'tat-ca').replace(/\s/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── StatCard (reusable) ──
function StatCard({ icon: Icon, color, bg, label, value }) {
    return (
        <div className="stat-card">
            <div className="stat-card__icon" style={{ background: bg, color }}><Icon size={20} /></div>
            <div className="stat-card__label">{label}</div>
            <div className="stat-card__value">{value}</div>
        </div>
    );
}

// ══════════════════════════════════════
//  ADMIN Reports
// ══════════════════════════════════════
function AdminReports({ user }) {
    const [deptData, setDeptData] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            adminAPI.reportsDepartment(),
            adminAPI.departmentsList(),
        ]).then(([deptRes, deptsRes]) => {
            setDeptData(deptRes.data);
            setDepartments(deptsRes.data || []);
        }).catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // Load department data when filter changes
    const handleDeptChange = async (deptId) => {
        setSelectedDept(deptId);
        try {
            const res = await adminAPI.reportsDepartment(deptId || undefined);
            setDeptData(res.data);
        } catch (err) {
            console.error('Lỗi tải báo cáo phòng ban:', err);
        }
    };

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;
    if (!deptData) return <div className="card"><p>Không tải được dữ liệu</p></div>;

    return (
        <div>
            <div className="page-header">
                <h1><BarChart3 size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Báo cáo tổng hợp</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    Thống kê theo phòng ban — hỗ trợ xuất PDF/Excel
                </p>
            </div>

            {/* ── Department filter + Export ── */}
            <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Building2 size={18} style={{ color: 'var(--color-text-muted)' }} />
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Thống kê theo phòng ban</h3>
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
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => exportPDF(deptData, `Báo cáo - ${deptData?.departmentName || 'Tất cả'}`, user?.name)}>
                            <Download size={14} /> Xuất PDF
                        </button>
                        <button className="btn btn-secondary" onClick={() => exportExcel(deptData, `Báo cáo - ${deptData?.departmentName || 'Tất cả'}`)}>
                            <Download size={14} /> Xuất Excel
                        </button>
                    </div>
                </div>

                {deptData && (
                    <>
                        {/* Department summary cards */}
                        {deptData.summary && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                                <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Nhân viên</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>{deptData.summary.totalUsers}</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Hóa đơn</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>{deptData.summary.totalExpenses}</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Tổng chi</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#2b9e9e' }}>{formatVND(deptData.summary.totalAmount)}</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Hoàn ứng</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#34d399' }}>{deptData.summary.reimbursed}</div>
                                </div>
                            </div>
                        )}

                        {/* Charts */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                            {deptData.byMonth?.length > 0 && (
                                <div className="card">
                                    <h3 className="card__title"><TrendingUp size={16} style={{ marginRight: 6 }} /> Chi tiêu theo tháng</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={deptData.byMonth} barCategoryGap="20%">
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(203,213,225,0.3)" />
                                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(203,213,225,0.3)' }} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                                                tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
                                            <Tooltip cursor={false} formatter={(v) => [formatVND(v), 'Tổng chi']} contentStyle={tooltipStyle} />
                                            <Bar dataKey="total" fill="#2b9e9e" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {deptData.byCategory?.length > 0 && (
                                <div className="card">
                                    <h3 className="card__title"><PieIcon size={16} style={{ marginRight: 6 }} /> Phân bổ theo loại</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie data={deptData.byCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="total" nameKey="name" strokeWidth={0}>
                                                {deptData.byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip cursor={false} formatter={(v, name) => [formatVND(v), name]} contentStyle={tooltipStyle} />
                                            <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Employee table */}
                        {deptData.employees?.length > 0 && (
                            <div className="card">
                                <h3 className="card__title">Chi tiết nhân viên</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Tên</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Email</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Chức vụ</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Số HĐ</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Tổng chi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deptData.employees.map((emp, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════
//  MANAGER Reports
// ══════════════════════════════════════
function ManagerReports({ user }) {
    const [deptData, setDeptData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminAPI.reportsDepartment()
            .then(res => setDeptData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;
    if (!deptData?.summary) return <div className="card"><p>Không có dữ liệu phòng ban</p></div>;

    return (
        <div>
            <div className="page-header">
                <h1><BarChart3 size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Báo cáo phòng ban</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    Thống kê {deptData.departmentName}
                </p>
            </div>

            {/* Export buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button className="btn btn-secondary" onClick={() => exportPDF(deptData, `Báo cáo ${deptData.departmentName}`, user?.name)}>
                    <Download size={14} /> Xuất PDF
                </button>
                <button className="btn btn-secondary" onClick={() => exportExcel(deptData, `Báo cáo ${deptData.departmentName}`)}>
                    <Download size={14} /> Xuất Excel
                </button>
            </div>

            {/* Summary cards */}
            <div className="stats-grid">
                <StatCard icon={Users} color="#60a5fa" bg="rgba(96,165,250,0.1)" label="Nhân viên" value={deptData.summary.totalUsers} />
                <StatCard icon={FileText} color="#7c6cf0" bg="rgba(124,108,240,0.1)" label="Số hóa đơn" value={deptData.summary.totalExpenses} />
                <StatCard icon={Wallet} color="#2b9e9e" bg="rgba(43,158,158,0.1)" label="Tổng chi phí" value={formatVND(deptData.summary.totalAmount)} />
                <StatCard icon={FileText} color="#34d399" bg="rgba(52,211,153,0.12)" label="Đã hoàn ứng" value={deptData.summary.reimbursed} />
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24, marginBottom: 24 }}>
                {deptData.byMonth?.length > 0 && (
                    <div className="card">
                        <h3 className="card__title"><TrendingUp size={16} style={{ marginRight: 6 }} /> Chi tiêu theo tháng</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={deptData.byMonth} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(203,213,225,0.3)" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(203,213,225,0.3)' }} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
                                <Tooltip cursor={false} formatter={(v) => [formatVND(v), 'Tổng chi']} contentStyle={tooltipStyle} />
                                <Bar dataKey="total" fill="#2b9e9e" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {deptData.byCategory?.length > 0 && (
                    <div className="card">
                        <h3 className="card__title"><PieIcon size={16} style={{ marginRight: 6 }} /> Phân bổ theo loại</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={deptData.byCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="total" nameKey="name" strokeWidth={0}>
                                    {deptData.byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip cursor={false} formatter={(v, name) => [formatVND(v), name]} contentStyle={tooltipStyle} />
                                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Employee table */}
            {deptData.employees?.length > 0 && (
                <div className="card">
                    <h3 className="card__title">Chi tiết nhân viên trong phòng</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Tên</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Email</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Chức vụ</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Số HĐ</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Tổng chi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deptData.employees.map((emp, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{emp.name}</td>
                                        <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{emp.email}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span className={`badge ${emp.role === 'MANAGER' ? 'badge-warning' : 'badge-neutral'}`}>
                                                {emp.role === 'MANAGER' ? 'Trưởng phòng' : 'Nhân viên'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{emp.totalExpenses}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#2b9e9e' }}>{formatVND(emp.totalAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════
//  Main Export
// ══════════════════════════════════════
export default function ReportsPage() {
    const { user } = useAuth();

    if (user?.role === 'ADMIN') return <AdminReports user={user} />;
    if (user?.role === 'MANAGER') return <ManagerReports user={user} />;

    // Employee should not reach here (removed from sidebar), but just in case
    return (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ color: 'var(--color-text-muted)' }}>Trang này chỉ dành cho Admin và Trưởng phòng.</p>
        </div>
    );
}
