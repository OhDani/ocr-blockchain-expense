/**
 * AdminDashboard.jsx — Bảng điều khiển quản trị tổng quan
 * Trung tâm giám sát vận hành chi phí, phê duyệt khẩn cấp & thanh khoản Smart Contract
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/client.js';
import ExpenseDetailModal from '../../components/ExpenseDetailModal/ExpenseDetailModal.jsx';
import {
    Wallet, Link2, Clock, CheckCircle, ShieldAlert,
    RefreshCw, ArrowUpRight, TrendingUp, ShieldCheck,
    AlertTriangle, Eye, ChevronRight,
    FileText, Shield
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';

const formatVND = (v) => v != null ? Number(v).toLocaleString('vi-VN') + 'đ' : '—';

const timeAgo = (date) => {
    if (!date) return '—';
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
};

const tooltipStyle = {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    fontSize: 13,
    backgroundColor: '#ffffff',
    color: '#1e293b',
};

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedExpenseId, setSelectedExpenseId] = useState(null);

    const loadData = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            const res = await adminAPI.dashboard();
            setStats(res.data);
        } catch (err) {
            console.error('Lỗi tải dữ liệu Dashboard:', err);
        } finally {
            setLoading(false);
            if (isManualRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="loading-center">
                <div className="spinner" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                <AlertTriangle size={36} color="#f87171" style={{ marginBottom: 12 }} />
                <h3>Không thể tải dữ liệu quản trị</h3>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>Vui lòng kiểm tra lại kết nối máy chủ.</p>
                <button className="btn btn-primary" onClick={() => loadData(true)}>Thử lại</button>
            </div>
        );
    }

    // Map status counts
    const statusMap = {};
    (stats.byStatus || []).forEach(s => { statusMap[s.status] = s; });
    const pendingCount = statusMap.PENDING?.count || 0;
    const approvedCount = (statusMap.APPROVED?.count || 0) + (statusMap.REIMBURSED?.count || 0);

    // Data for Monthly Trend Area Chart
    const trendChartData = (stats.monthlyTrend || []).map((m) => ({
        name: m.label,
        amount: m.amount,
        count: m.count,
    }));

    const radar = stats.fraudRadar || {
        totalAnalyzed: 0,
        complianceRate: 100,
        lowRiskCount: 0,
        mediumRiskCount: 0,
        highRiskCount: 0,
        nightExpenses: 0,
        roundedAmounts: 0,
    };

    return (
        <div>
            {/* ── Page Header ── */}
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Bảng quản trị</h1>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                        Tổng quan chi phí và xét duyệt hóa đơn hệ thống
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    >
                        <RefreshCw size={14} className={refreshing ? 'spin-animation' : ''} />
                        {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/admin/expenses')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    >
                        Danh sách chi phí <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* ── Stat Cards Grid (4 Cards) ── */}
            <div className="stats-grid">
                {/* 1. Tổng chi tiêu */}
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(43,158,158,0.12)', color: '#2b9e9e' }}>
                        <Wallet size={20} />
                    </div>
                    <div className="stat-card__label">Tổng chi tiêu</div>
                    <div className="stat-card__value" style={{ color: '#2b9e9e' }}>
                        {formatVND(stats.overview.totalAmount)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {stats.overview.totalExpenses || 0} hóa đơn
                    </div>
                </div>

                {/* 2. Chờ phê duyệt */}
                <div
                    className="stat-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/admin/expenses?status=PENDING')}
                    title="Nhấn để xem hóa đơn chờ duyệt"
                >
                    <div className="stat-card__icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                        <Clock size={20} />
                    </div>
                    <div className="stat-card__label">Chờ phê duyệt</div>
                    <div className="stat-card__value" style={{ color: '#f59e0b' }}>
                        {pendingCount}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {stats.pendingActionQueue?.length || 0} hóa đơn cần xử lý
                    </div>
                </div>

                {/* 3. Đã duyệt & Hoàn ứng */}
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div className="stat-card__label">Đã duyệt & Hoàn ứng</div>
                    <div className="stat-card__value" style={{ color: '#10b981' }}>
                        {approvedCount}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {stats.blockchain.txCount || 0} giao dịch on-chain
                    </div>
                </div>

                {/* 4. Cảnh báo gian lận */}
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                        <ShieldAlert size={20} />
                    </div>
                    <div className="stat-card__label">Cảnh báo rủi ro</div>
                    <div className="stat-card__value" style={{ color: stats.overview.fraudSuspectCount > 0 ? '#ef4444' : 'var(--color-text)' }}>
                        {stats.overview.fraudSuspectCount || 0}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        Điểm rủi ro ≥ 50
                    </div>
                </div>
            </div>

            {/* ── Row 1: Xu hướng chi tiêu & Giám sát Rủi ro AI ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 24 }}>
                {/* Area Chart: Xu hướng 6 tháng */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <TrendingUp size={18} color="#2b9e9e" /> Xu hướng chi tiêu 6 tháng
                            </h3>
                        </div>
                    </div>

                    {trendChartData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
                            Chưa có dữ liệu chi tiêu trong 6 tháng qua
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2b9e9e" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#2b9e9e" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(203,213,225,0.25)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
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
                                    cursor={{ stroke: '#2b9e9e', strokeWidth: 1, strokeDasharray: '3 3' }}
                                    formatter={(value, name, props) => [
                                        `${formatVND(value)} (${props.payload.count || 0} HĐ)`,
                                        'Chi phí duyệt'
                                    ]}
                                    contentStyle={tooltipStyle}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#2b9e9e"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#areaColor)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* AI Fraud & Policy Radar Widget */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ShieldCheck size={18} color="#2b9e9e" /> Kiểm soát rủi ro & Tuân thủ
                            </h3>
                        </div>
                        <span className={`badge ${radar.complianceRate >= 90 ? 'badge-success' : radar.complianceRate >= 75 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                            {radar.complianceRate}% Tuân thủ
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Mức độ tuân thủ toàn hệ thống</span>
                            <span style={{ fontWeight: 600 }}>{radar.complianceRate}%</span>
                        </div>
                        <div style={{ width: '100%', height: 8, background: 'rgba(203,213,225,0.3)', borderRadius: 4, overflow: 'hidden' }}>
                            <div
                                style={{
                                    width: `${radar.complianceRate}%`,
                                    height: '100%',
                                    background: radar.complianceRate >= 90 ? '#10b981' : radar.complianceRate >= 75 ? '#f59e0b' : '#ef4444',
                                    borderRadius: 4,
                                    transition: 'width 0.4s ease',
                                }}
                            />
                        </div>
                    </div>

                    {/* Risk Tiers (3 mini cards) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                        <div style={{ padding: '10px 8px', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 2 }}>An toàn</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{radar.lowRiskCount}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>&lt; 20 điểm</div>
                        </div>
                        <div style={{ padding: '10px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>Cần lưu ý</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{radar.mediumRiskCount}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>20-49 điểm</div>
                        </div>
                        <div style={{ padding: '10px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>Rủi ro cao</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{radar.highRiskCount}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>≥ 50 điểm</div>
                        </div>
                    </div>

                    {/* Policy Flag Summary */}
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, borderTop: '1px solid var(--color-border-light, #f1f5f9)', paddingTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                                <Clock size={13} color="#f59e0b" /> Ăn uống đêm khuya (&gt; 22h)
                            </span>
                            <span style={{ fontWeight: 600 }}>{radar.nightExpenses} hóa đơn</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                                <FileText size={13} color="#3b82f6" /> Số tiền tròn bất thường
                            </span>
                            <span style={{ fontWeight: 600 }}>{radar.roundedAmounts} hóa đơn</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                                <Shield size={13} color="#10b981" /> Hạn mức công tác (Policy Limits)
                            </span>
                            <span style={{ color: '#10b981', fontWeight: 500 }}>Đang giám sát</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Row 2: Operational Action Queue & zkEVM Liquidity ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 20 }}>
                {/* Action Queue: Top 5 Pending Expenses */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock size={18} color="#f59e0b" /> Hàng chờ duyệt
                                <span className="badge badge-warning" style={{ fontSize: 11, padding: '2px 8px' }}>
                                    {stats.pendingActionQueue?.length || 0} mới
                                </span>
                            </h3>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate('/admin/expenses?status=PENDING')}
                            style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            Xem tất cả <ChevronRight size={13} />
                        </button>
                    </div>

                    {(!stats.pendingActionQueue || stats.pendingActionQueue.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '36px 16px', background: 'rgba(16,185,129,0.04)', borderRadius: 12, border: '1px dashed rgba(16,185,129,0.2)' }}>
                            <ShieldCheck size={32} color="#10b981" style={{ marginBottom: 8 }} />
                            <div style={{ fontWeight: 600, color: '#10b981', fontSize: 14 }}>Hàng chờ trống</div>
                            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                                Tất cả hóa đơn đã được xử lý xong. Hệ thống không có yêu cầu đang ứ đọng!
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {stats.pendingActionQueue.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        border: '1px solid var(--color-border-light, rgba(226,232,240,0.8))',
                                        background: 'var(--color-bg-subtle, rgba(248,250,252,0.6))',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {/* Left: Info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #2b9e9e, #3b82f6)',
                                                color: '#fff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 600,
                                                fontSize: 14,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {item.userName ? item.userName.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {item.userName}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span>{item.department}</span>
                                                <span>•</span>
                                                <span>{timeAgo(item.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Center: Category & Risk */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                                            {item.categoryName}
                                        </span>
                                        {item.fraudScore >= 50 ? (
                                            <span className="badge badge-danger" style={{ fontSize: 11 }}>
                                                Rủi ro AI: {item.fraudScore}
                                            </span>
                                        ) : item.fraudScore >= 20 ? (
                                            <span className="badge badge-warning" style={{ fontSize: 11 }}>
                                                Lưu ý: {item.fraudScore}
                                            </span>
                                        ) : (
                                            <span className="badge badge-success" style={{ fontSize: 11 }}>
                                                An toàn
                                            </span>
                                        )}
                                    </div>

                                    {/* Right: Amount & Action */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                                            {formatVND(item.amount)}
                                        </div>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setSelectedExpenseId(item.id)}
                                            style={{ padding: '5px 9px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                                            title="Kiểm tra chi tiết"
                                        >
                                            <Eye size={13} /> Xem
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Blockchain zkEVM Liquidity Card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Link2 size={18} color="#7c6cf0" /> Thanh khoản Quỹ On-chain
                        </h3>
                        <span
                            className={`badge ${stats.blockchain.connected ? 'badge-success' : 'badge-neutral'}`}
                            style={{ fontSize: 11 }}
                        >
                            {stats.blockchain.connected ? '● Linea Sepolia L2' : '○ Sandbox Offline'}
                        </span>
                    </div>

                    {/* Main Pool Balance Card */}
                    <div
                        style={{
                            background: 'linear-gradient(135deg, rgba(43,158,158,0.1), rgba(124,108,240,0.1))',
                            border: '1px solid rgba(43,158,158,0.2)',
                            borderRadius: 12,
                            padding: '16px 18px',
                            marginBottom: 14,
                        }}
                    >
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                            Số dư Quỹ Smart Contract (Company Pool)
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primary, #2b9e9e)' }}>
                            {stats.blockchain.companyPoolBalance != null
                                ? `${stats.blockchain.companyPoolBalance.toLocaleString('vi-VN')} vVND`
                                : '—'}
                        </div>
                        <div style={{ fontSize: 11, color: '#10b981', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> Sẵn sàng hoàn ứng On-chain
                        </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-bg-subtle, #f8fafc)', border: '1px solid var(--color-border-light, #e2e8f0)' }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Đã giải ngân on-chain</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                                {formatVND(stats.blockchain.totalReimbursed)}
                            </div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-bg-subtle, #f8fafc)', border: '1px solid var(--color-border-light, #e2e8f0)' }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Tổng giao dịch</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#7c6cf0' }}>
                                {stats.blockchain.txCount} TX
                            </div>
                        </div>
                    </div>

                    {/* Footer link to Blockchain Ledger */}
                    <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate('/admin/blockchain')}
                            style={{ width: '100%', justifyContent: 'center', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            Xem sổ cái giao dịch Blockchain <ArrowUpRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Detail Modal ── */}
            {selectedExpenseId && (
                <ExpenseDetailModal
                    expenseId={selectedExpenseId}
                    onClose={() => setSelectedExpenseId(null)}
                />
            )}
        </div>
    );
}
