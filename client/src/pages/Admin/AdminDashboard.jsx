/**
 * AdminDashboard.jsx — Trang quản trị tổng quan (với biểu đồ)
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/client.js';
import { Users, Plane, FileText, Wallet, Link2 } from 'lucide-react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const STATUS_COLORS = {
    PENDING: { label: 'Chờ duyệt', color: '#fbbf24' },
    APPROVED: { label: 'Đã duyệt', color: '#60a5fa' },
    REJECTED: { label: 'Từ chối', color: '#f87171' },
    REIMBURSED: { label: 'Đã hoàn ứng', color: '#34d399' },
};

const formatVND = (v) => v != null ? Number(v).toLocaleString('vi-VN') + 'đ' : '—';

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' };

const timeAgo = (date) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
};

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminAPI.dashboard()
            .then((res) => setStats(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;
    if (!stats) return <div className="card"><p>Không tải được dữ liệu</p></div>;

    // Pie chart data (theo số lượng)
    const pieData = stats.byStatus.map((s) => ({
        name: STATUS_COLORS[s.status]?.label || s.status,
        value: s.count,
        color: STATUS_COLORS[s.status]?.color || '#94a3b8',
    }));

    // Bar chart data (theo số tiền)
    const barData = stats.byStatus.map((s) => ({
        name: STATUS_COLORS[s.status]?.label || s.status,
        amount: s.amount,
        fill: STATUS_COLORS[s.status]?.color || '#94a3b8',
    }));

    return (
        <div>
            <div className="page-header">
                <h1>Bảng quản trị</h1>
            </div>

            {/* ── Stat cards ── */}
            <div className="stats-grid">
                <StatCard icon={Users} color="#60a5fa" bg="rgba(96,165,250,0.1)" label="Tổng nhân viên" value={stats.overview.totalUsers} />
                <StatCard icon={Plane} color="#2b9e9e" bg="rgba(43,158,158,0.1)" label="Tổng chuyến công tác" value={stats.overview.totalTrips} />
                <StatCard icon={FileText} color="#7c6cf0" bg="rgba(124,108,240,0.1)" label="Tổng hóa đơn" value={stats.overview.totalExpenses} />
                <StatCard icon={Wallet} color="#f59e0b" bg="rgba(251,191,36,0.12)" label="Tổng chi phí" value={formatVND(stats.overview.totalAmount)} />
            </div>

            {/* ── Charts row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>

                {/* Pie: Phân bổ theo trạng thái (số lượng) */}
                <div className="card">
                    <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Phân bổ theo trạng thái</h3>
                    {pieData.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 32 }}>Chưa có dữ liệu</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={90}
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
                                <Legend
                                    verticalAlign="bottom"
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: 12 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Bar: Chi phí theo trạng thái */}
                <div className="card">
                    <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Chi phí theo trạng thái</h3>
                    {barData.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 32 }}>Chưa có dữ liệu</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={barData} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(203,213,225,0.3)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                                    axisLine={{ stroke: 'rgba(203,213,225,0.3)' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v}
                                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={false}
                                    formatter={(value) => [formatVND(value), 'Chi phí']}
                                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13 }}
                                />
                                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                    {barData.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Blockchain Flow ── */}
            <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Link2 size={16} /> Dòng tiền Blockchain
                    <span className={`badge ${stats.blockchain.connected ? 'badge-success' : 'badge-neutral'}`}
                        style={{ fontSize: 11, marginLeft: 8 }}>
                        {stats.blockchain.connected ? '● Đã kết nối' : '○ Offline'}
                    </span>
                </h3>

                {/* 3 blockchain stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(43,158,158,0.08), rgba(59,130,246,0.06))', border: '1px solid rgba(43,158,158,0.15)' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>💰 Quỹ công ty</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>
                            {stats.blockchain.companyPoolBalance != null
                                ? `${stats.blockchain.companyPoolBalance.toLocaleString('vi-VN')} vVND`
                                : '—'}
                        </div>
                    </div>
                    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(52,211,153,0.06))', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>📤 Đã hoàn ứng</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>
                            {formatVND(stats.blockchain.totalReimbursed)}
                        </div>
                    </div>
                    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124,108,240,0.08), rgba(167,139,250,0.06))', border: '1px solid rgba(124,108,240,0.15)' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>🔗 Giao dịch on-chain</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#7c6cf0' }}>
                            {stats.blockchain.txCount} TX
                        </div>
                    </div>
                </div>

                {/* Recent transactions table */}
                <div className="card">
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Giao dịch blockchain gần đây</h4>
                    {(!stats.blockchain.recentTransactions || stats.blockchain.recentTransactions.length === 0) ? (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 24, fontSize: 13 }}>
                            Chưa có giao dịch nào trên blockchain
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={thStyle}>Nhân viên</th>
                                        <th style={thStyle}>Loại</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Số tiền</th>
                                        <th style={thStyle}>TX Hash</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Thời gian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.blockchain.recentTransactions.map((tx) => (
                                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={tdStyle}>
                                                <div style={{ fontWeight: 500 }}>{tx.userName}</div>
                                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tx.department}</div>
                                            </td>
                                            <td style={tdStyle}>{tx.invoiceType || '—'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                                                {formatVND(tx.amount)}
                                            </td>
                                            <td style={tdStyle}>
                                                <code style={{
                                                    fontSize: 11, padding: '2px 6px', borderRadius: 4,
                                                    background: 'rgba(124,108,240,0.08)', color: '#7c6cf0',
                                                }}>
                                                    {tx.txHash?.substring(0, 10)}...{tx.txHash?.substring(tx.txHash.length - 6)}
                                                </code>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-muted)', fontSize: 12 }}>
                                                {timeAgo(tx.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Tháng này ── */}
            <div style={{ marginTop: 24 }}>
                <div className="card">
                    <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Tháng này</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Số hóa đơn</div>
                            <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.monthly.count}</div>
                        </div>
                        <div style={{ width: 1, height: 48, background: 'var(--color-border-light)' }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Tổng chi</div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-lavender)' }}>{formatVND(stats.monthly.amount)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, color, bg, label, value }) {
    return (
        <div className="stat-card">
            <div className="stat-card__icon" style={{ background: bg, color }}>
                <Icon size={20} />
            </div>
            <div className="stat-card__label">{label}</div>
            <div className="stat-card__value">{value}</div>
        </div>
    );
}
