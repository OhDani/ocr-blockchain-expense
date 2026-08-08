/**
 * DashboardPage.jsx — Tổng quan cho nhân viên (với biểu đồ)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { tripAPI, expenseAPI } from '../../api/client.js';
import { Wallet, Clock, CheckCircle, Plane, Camera, FileText, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ExpenseDetailModal from '../../components/ExpenseDetailModal/ExpenseDetailModal.jsx';
import './DashboardPage.css';

const STATUS_MAP = {
    PENDING: { label: 'Chờ duyệt', className: 'badge-warning', color: '#fbbf24' },
    APPROVED: { label: 'Đã duyệt', className: 'badge-info', color: '#60a5fa' },
    REJECTED: { label: 'Từ chối', className: 'badge-danger', color: '#f87171' },
    REIMBURSED: { label: 'Đã hoàn ứng', className: 'badge-success', color: '#34d399' },
};

export default function DashboardPage() {
    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [tripRes, expenseRes] = await Promise.all([
                    tripAPI.list(),
                    expenseAPI.list(),
                ]);
                setTrips(tripRes.data);
                setExpenses(expenseRes.data);
            } catch (err) {
                console.error('Lỗi tải dữ liệu:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return <div className="loading-center"><div className="spinner" /></div>;
    }

    // Tính thống kê
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const pending = expenses.filter(e => e.status === 'PENDING').length;
    const approved = expenses.filter(e => ['APPROVED', 'REIMBURSED'].includes(e.status)).length;

    // Pie chart data
    const statusGrouped = {};
    expenses.forEach((e) => {
        if (!statusGrouped[e.status]) statusGrouped[e.status] = 0;
        statusGrouped[e.status]++;
    });
    const pieData = Object.entries(statusGrouped).map(([status, count]) => ({
        name: STATUS_MAP[status]?.label || status,
        value: count,
        color: STATUS_MAP[status]?.color || '#94a3b8',
    }));

    // Dynamic greeting based on time
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const reimbursed = expenses.filter(e => e.status === 'REIMBURSED').length;
    const rejected = expenses.filter(e => e.status === 'REJECTED').length;

    // Pipeline progress
    const pipelineSteps = [
        { label: 'Đã nộp', value: expenses.length, color: '#94a3b8' },
        { label: 'Chờ duyệt', value: pending, color: '#fbbf24' },
        { label: 'Đã duyệt', value: approved, color: '#60a5fa' },
        { label: 'Hoàn ứng', value: reimbursed, color: '#34d399' },
    ];

    return (
        <div className="dashboard">
            {/* ── Welcome Banner ── */}
            <div className="welcome-banner">
                <div className="welcome-banner__content">
                    <div className="welcome-banner__text">
                        <p className="welcome-banner__greeting">{greeting}</p>
                        <h1 className="welcome-banner__name">{user?.name}</h1>
                        <p className="welcome-banner__sub">
                            {expenses.length === 0
                                ? 'Bắt đầu bằng cách upload hóa đơn đầu tiên'
                                : `${expenses.length} hóa đơn · ${totalAmount.toLocaleString('vi-VN')}đ tổng chi phí`}
                        </p>
                    </div>
                    <Link to="/upload" className="btn btn-primary welcome-banner__cta">
                        <Camera size={16} /> Upload hóa đơn
                    </Link>
                </div>

                {/* Pipeline progress */}
                {expenses.length > 0 && (
                    <div className="welcome-banner__pipeline">
                        {pipelineSteps.map((step, i) => (
                            <div key={step.label} className="pipeline-step">
                                <div className="pipeline-step__value" style={{ color: step.color }}>
                                    {step.value}
                                </div>
                                <div className="pipeline-step__label">{step.label}</div>
                                {i < pipelineSteps.length - 1 && (
                                    <div className="pipeline-step__arrow">→</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Thống kê */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(43,158,158,0.1)', color: '#2b9e9e' }}>
                        <Wallet size={20} />
                    </div>
                    <div className="stat-card__label">Tổng chi phí</div>
                    <div className="stat-card__value">{totalAmount.toLocaleString('vi-VN')}đ</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>
                        <Clock size={20} />
                    </div>
                    <div className="stat-card__label">Chờ duyệt</div>
                    <div className="stat-card__value">{pending}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div className="stat-card__label">Đã duyệt</div>
                    <div className="stat-card__value">{approved}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(43,158,158,0.1)', color: '#2b9e9e' }}>
                        <Plane size={20} />
                    </div>
                    <div className="stat-card__label">Chuyến công tác</div>
                    <div className="stat-card__value">{trips.length}</div>
                </div>
            </div>

            {/* Chart + Recent expenses row */}
            <div style={{ display: 'grid', gridTemplateColumns: expenses.length > 0 ? '300px 1fr' : '1fr', gap: 24, marginTop: 24 }}>
                {/* Pie chart */}
                {pieData.length > 0 && (
                    <div className="card">
                        <h2 className="card__title">Phân bổ chi phí</h2>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={75}
                                    paddingAngle={4}
                                    dataKey="value"
                                    strokeWidth={0}
                                >
                                    {pieData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value, name) => [`${value} hóa đơn`, name]}
                                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13 }}
                                />
                                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Recent expenses */}
                <div className="card">
                    <h2 className="card__title">Chi phí gần đây</h2>
                    {expenses.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon"><FileText size={48} strokeWidth={1} /></div>
                            <div className="empty-state__text">Chưa có chi phí nào</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Loại</th>
                                    <th>Số tiền</th>
                                    <th>Trạng thái</th>
                                    <th>Chuyến</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.slice(0, 8).map((exp) => {
                                    const status = STATUS_MAP[exp.status] || STATUS_MAP.PENDING;
                                    return (
                                        <tr key={exp.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(exp.id)}>
                                            <td>{exp.invoiceType || '—'}</td>
                                            <td style={{ fontWeight: 600 }}>
                                                {exp.amount.toLocaleString('vi-VN')}đ
                                            </td>
                                            <td>
                                                <span className={`badge ${status.className}`}>{status.label}</span>
                                            </td>
                                            <td>{exp.trip?.destination || '—'}</td>
                                            <td>
                                                <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setSelectedId(exp.id); }}>
                                                    <Eye size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Expense Detail Modal */}
            {selectedId && (
                <ExpenseDetailModal
                    expenseId={selectedId}
                    onClose={() => setSelectedId(null)}
                />
            )}
        </div>
    );
}
