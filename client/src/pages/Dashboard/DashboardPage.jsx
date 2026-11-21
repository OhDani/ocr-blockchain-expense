/**
 * DashboardPage.jsx — Tổng quan cho nhân viên & quản lý
 * Tích hợp Trợ lý nhắc việc thông minh, Ngữ cảnh chuyến đi & Ví hoàn ứng Web3
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { tripAPI, expenseAPI, userAPI } from '../../api/client.js';
import {
    Wallet, Clock, CheckCircle2, Plane, Camera,
    FileText, Eye, Copy, Check, ExternalLink,
    AlertCircle, ShieldCheck, ArrowRight, Plus, ChevronRight
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import ExpenseDetailModal from '../../components/ExpenseDetailModal/ExpenseDetailModal.jsx';
import { getCategoryLabel } from '../../utils/categoryHelper.js';
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
    const [walletInfo, setWalletInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function fetchData() {
            try {
                const [tripRes, expenseRes] = await Promise.all([
                    tripAPI.list(),
                    expenseAPI.list(),
                ]);
                if (isMounted) {
                    setTrips(tripRes.data || []);
                    setExpenses(expenseRes.data || []);
                }
                userAPI.walletStatus()
                    .then((res) => {
                        if (isMounted) setWalletInfo(res.data);
                    })
                    .catch(() => {});
            } catch (err) {
                console.error('Lỗi tải dữ liệu Dashboard:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchData();
        return () => { isMounted = false; };
    }, []);

    // Copy ví vào Clipboard
    const handleCopyAddress = (addr) => {
        if (!addr) return;
        navigator.clipboard.writeText(addr);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Địa chỉ ví nhận & số dư an toàn (hỗ trợ cả backend alias và fallback từ user)
    const activeWallet = walletInfo?.address || walletInfo?.walletAddress || user?.walletAddress;
    const walletBalance = walletInfo?.balance ?? walletInfo?.tokenBalance ?? 0;
    const isRegisteredOnChain = walletInfo?.isRegisteredOnChain || false;

    // Tính toán số liệu thống kê dòng tiền
    const totalAmount = useMemo(() => expenses.reduce((sum, e) => sum + (e.amount || 0), 0), [expenses]);
    const pendingExpenses = useMemo(() => expenses.filter(e => e.status === 'PENDING'), [expenses]);
    const pendingAmount = useMemo(() => pendingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0), [pendingExpenses]);
    const pendingCount = pendingExpenses.length;

    const reimbursedExpenses = useMemo(() => expenses.filter(e => e.status === 'REIMBURSED'), [expenses]);
    const reimbursedAmount = useMemo(() => reimbursedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0), [reimbursedExpenses]);
    const reimbursedCount = reimbursedExpenses.length;

    const approvedExpenses = useMemo(() => expenses.filter(e => e.status === 'APPROVED'), [expenses]);
    const approvedCount = approvedExpenses.length;

    const rejectedExpenses = useMemo(() => expenses.filter(e => e.status === 'REJECTED'), [expenses]);
    const rejectedCount = rejectedExpenses.length;

    // Chuyến công tác đang diễn ra hoặc chuyến gần nhất
    const activeTrip = useMemo(() => {
        if (!trips.length) return null;
        const now = new Date();
        const ongoing = trips.find(t => t.status === 'ONGOING');
        if (ongoing) return ongoing;
        const dateMatched = trips.find(t => {
            const start = new Date(t.startDate);
            const end = new Date(t.endDate);
            return start <= now && now <= end;
        });
        return dateMatched || trips[0];
    }, [trips]);

    // Ngân sách chuyến công tác hiện tại
    const tripStats = useMemo(() => {
        if (!activeTrip) return null;
        const tripExps = expenses.filter(e => e.tripId === activeTrip.id);
        const spent = tripExps.reduce((sum, e) => sum + (e.amount || 0), 0);
        const budget = activeTrip.budget || 0;
        const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
        return { spent, budget, percent };
    }, [activeTrip, expenses]);

    // Dữ liệu biểu đồ trạng thái (Donut Chart)
    const pieData = useMemo(() => {
        const counts = { PENDING: 0, APPROVED: 0, REIMBURSED: 0, REJECTED: 0 };
        expenses.forEach(e => {
            if (counts[e.status] !== undefined) counts[e.status]++;
        });
        return Object.entries(counts)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => ({
                status,
                name: STATUS_MAP[status]?.label || status,
                value: count,
                color: STATUS_MAP[status]?.color || '#94a3b8',
            }));
    }, [expenses]);

    // Trợ lý nhắc việc thông minh (Smart Action Digest)
    const smartDigest = useMemo(() => {
        if (rejectedCount > 0) {
            return {
                type: 'danger',
                icon: AlertCircle,
                text: `Có ${rejectedCount} hóa đơn bị từ chối cần bạn kiểm tra lại hoặc gửi khiếu nại`,
                link: '/expenses',
                linkText: 'Xem chi tiết →',
            };
        }
        if (pendingCount > 0) {
            return {
                type: 'warning',
                icon: Clock,
                text: `${pendingAmount.toLocaleString('vi-VN')}đ (${pendingCount} hóa đơn) đang chờ Quản lý phê duyệt`,
                link: '/expenses',
                linkText: 'Theo dõi tiến độ →',
            };
        }
        if (reimbursedCount > 0) {
            return {
                type: 'success',
                icon: ShieldCheck,
                text: `Tất cả hồ sơ đã giải quyết xong · ${reimbursedAmount.toLocaleString('vi-VN')}đ đã hoàn ứng on-chain`,
                link: '/expenses',
                linkText: 'Lịch sử thanh toán →',
            };
        }
        return {
            type: 'info',
            icon: CheckCircle2,
            text: 'Hệ thống đã sẵn sàng. Hãy tải lên hóa đơn đầu tiên để bắt đầu quy trình hoàn ứng tự động',
            link: '/upload',
            linkText: 'Tải lên ngay →',
        };
    }, [rejectedCount, pendingCount, pendingAmount, reimbursedCount, reimbursedAmount]);

    // Format ngày và thời gian chào hỏi
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const currentDateStr = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(new Date());

    if (loading) {
        return <div className="loading-center"><div className="spinner" /></div>;
    }

    const DigestIcon = smartDigest.icon;

    return (
        <div className="dashboard">
            {/* ── 1. Welcome Banner (Ý tưởng 1 & 2 kết hợp) ── */}
            <div className="welcome-banner">
                <div className="welcome-banner__top">
                    <span className="welcome-banner__date">{currentDateStr}</span>
                    <span className="welcome-banner__divider">·</span>
                    <span className="welcome-banner__greeting">{greeting}</span>
                </div>

                <div className="welcome-banner__body">
                    {/* Cột trái: Thông tin nhân viên & Nhắc việc thông minh */}
                    <div className="welcome-banner__left">
                        <h1 className="welcome-banner__name">{user?.name}</h1>
                        <p className="welcome-banner__sub">
                            {expenses.length === 0
                                ? 'Bắt đầu bằng cách quét hóa đơn chi phí công tác đầu tiên'
                                : `${expenses.length} hóa đơn kê khai · ${totalAmount.toLocaleString('vi-VN')}đ tổng chi phí`}
                        </p>

                        {/* Thẻ nhắc việc thông minh (Smart Status Pill) */}
                        <div className={`welcome-banner__digest welcome-banner__digest--${smartDigest.type}`}>
                            <DigestIcon size={16} className="welcome-banner__digest-icon" />
                            <span className="welcome-banner__digest-text">{smartDigest.text}</span>
                            <Link to={smartDigest.link} className="welcome-banner__digest-link">
                                {smartDigest.linkText}
                            </Link>
                        </div>
                    </div>

                    {/* Cột phải: Ngữ cảnh Chuyến công tác & Cụm nút thao tác */}
                    <div className="welcome-banner__right">
                        {activeTrip && tripStats && (
                            <div className="welcome-banner__trip-chip">
                                <div className="welcome-banner__trip-header">
                                    <div className="welcome-banner__trip-title">
                                        <Plane size={14} />
                                        <span>{activeTrip.destination}</span>
                                    </div>
                                    <span className="welcome-banner__trip-badge">
                                        {activeTrip.status === 'ONGOING' ? 'Đang diễn ra' : 'Chuyến gần nhất'}
                                    </span>
                                </div>
                                <div className="welcome-banner__trip-meta">
                                    <span>
                                        {new Date(activeTrip.startDate).toLocaleDateString('vi-VN')} – {new Date(activeTrip.endDate).toLocaleDateString('vi-VN')}
                                    </span>
                                    <span className="welcome-banner__trip-percent">{tripStats.percent}% hạn mức</span>
                                </div>
                                <div className="welcome-banner__trip-bar">
                                    <div
                                        className="welcome-banner__trip-progress"
                                        style={{
                                            width: `${tripStats.percent}%`,
                                            backgroundColor: tripStats.percent > 90 ? '#f87171' : '#34d399'
                                        }}
                                    />
                                </div>
                                <div className="welcome-banner__trip-budget">
                                    Đã chi: <strong>{tripStats.spent.toLocaleString('vi-VN')}đ</strong> / {tripStats.budget.toLocaleString('vi-VN')}đ
                                </div>
                            </div>
                        )}

                        <div className="welcome-banner__cta-group">
                            <Link to="/upload" className="btn btn-primary welcome-banner__cta">
                                <Camera size={16} /> Upload hóa đơn
                            </Link>
                            <Link to="/trips" className="btn welcome-banner__cta-sub">
                                <Plus size={14} /> Chuyến đi
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 2. Card Ví Web3 Hoàn ứng ── */}
            <div className={`wallet-card ${!activeWallet ? 'wallet-card--unlinked' : ''}`}>
                <div className="wallet-card__left">
                    <div className="wallet-card__icon-wrap">
                        <Wallet size={18} />
                    </div>
                    <div className="wallet-card__info">
                        <div className="wallet-card__title-row">
                            <span className="wallet-card__label">Ví hoàn ứng Web3:</span>
                            {activeWallet ? (
                                <div className="wallet-card__address-group">
                                    <span className="wallet-card__address" title={activeWallet}>
                                        {activeWallet.slice(0, 6)}...{activeWallet.slice(-4)}
                                    </span>
                                    <button
                                        type="button"
                                        className="wallet-card__copy-btn"
                                        onClick={() => handleCopyAddress(activeWallet)}
                                        title="Sao chép địa chỉ ví"
                                    >
                                        {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                    </button>
                                    <span className="wallet-card__network">Linea zkEVM</span>
                                    <span className={`badge ${isRegisteredOnChain ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                                        {isRegisteredOnChain ? '✓ On-chain Verified' : 'Chờ kích hoạt'}
                                    </span>
                                </div>
                            ) : (
                                <span className="wallet-card__warning-text">
                                    Chưa liên kết ví cá nhân. Kế toán & Smart Contract cần ví MetaMask của bạn để tự động chuyển tiền hoàn ứng.
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="wallet-card__right">
                    {activeWallet ? (
                        <div className="wallet-card__balance-block">
                            <span className="wallet-card__balance-label">Số dư khả dụng:</span>
                            <span className="wallet-card__balance-val">
                                {Number(walletBalance).toLocaleString('vi-VN')} <small>vVND</small>
                            </span>
                        </div>
                    ) : null}
                    <Link to="/settings" className="wallet-card__action-btn">
                        {activeWallet ? 'Quản lý ví' : 'Liên kết ví ngay'} <ChevronRight size={14} />
                    </Link>
                </div>
            </div>

            {/* ── 3. Thẻ thống kê 4 cột (Tập trung dòng tiền) ── */}
            <div className="stats-grid">
                {/* 1. Tổng chi phí */}
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(43,158,158,0.1)', color: '#2b9e9e' }}>
                        <Wallet size={20} />
                    </div>
                    <div className="stat-card__label">Tổng chi phí đã nộp</div>
                    <div className="stat-card__value">{totalAmount.toLocaleString('vi-VN')}đ</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {expenses.length} hóa đơn toàn thời gian
                    </div>
                </div>

                {/* 2. Đang chờ duyệt */}
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>
                        <Clock size={20} />
                    </div>
                    <div className="stat-card__label">Đang chờ phê duyệt</div>
                    <div className="stat-card__value" style={{ color: '#f59e0b' }}>
                        {pendingAmount.toLocaleString('vi-VN')}đ
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {pendingCount} hóa đơn đang xét duyệt
                    </div>
                </div>

                {/* 3. Đã hoàn ứng On-Chain */}
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                        <CheckCircle2 size={20} />
                    </div>
                    <div className="stat-card__label">Đã hoàn ứng On-Chain</div>
                    <div className="stat-card__value" style={{ color: '#10b981' }}>
                        {reimbursedAmount.toLocaleString('vi-VN')}đ
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {reimbursedCount} hóa đơn đã nhận qua Smart Contract
                    </div>
                </div>

                {/* 4. Chuyến công tác */}
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(96,165,250,0.12)', color: '#3b82f6' }}>
                        <Plane size={20} />
                    </div>
                    <div className="stat-card__label">Chuyến công tác</div>
                    <div className="stat-card__value">{trips.length}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {activeTrip ? `Điểm đến: ${activeTrip.destination}` : 'Chưa có chuyến mới'}
                    </div>
                </div>
            </div>

            {/* ── 4. Biểu đồ Donut & Bảng Chi phí gần đây ── */}
            <div style={{ display: 'grid', gridTemplateColumns: expenses.length > 0 ? '340px 1fr' : '1fr', gap: 24, marginTop: 24 }}>
                {/* Donut Chart: Trạng thái hồ sơ */}
                {pieData.length > 0 && (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <h2 className="card__title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Tình trạng hồ sơ</span>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                {expenses.length} đơn
                            </span>
                        </h2>

                        <div style={{ position: 'relative', width: '100%', height: 210 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        paddingAngle={4}
                                        dataKey="value"
                                        strokeWidth={0}
                                    >
                                        {pieData.map((entry) => (
                                            <Cell key={entry.status} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val, name) => [
                                            `${val} hóa đơn (${Math.round((val / (expenses.length || 1)) * 100)}%)`,
                                            name
                                        ]}
                                        contentStyle={{
                                            borderRadius: 12,
                                            border: 'none',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                            fontSize: 12
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Legend trực quan */}
                        <div className="status-legend-grid">
                            {Object.entries(STATUS_MAP).map(([key, item]) => {
                                const count = expenses.filter(e => e.status === key).length;
                                return (
                                    <div key={key} className="status-legend-item">
                                        <span className="status-legend-dot" style={{ backgroundColor: item.color }} />
                                        <span className="status-legend-label">{item.label}</span>
                                        <span className="status-legend-count">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Bảng Chi phí gần đây */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 className="card__title" style={{ margin: 0 }}>Chi phí gần đây</h2>
                        {expenses.length > 0 && (
                            <Link to="/expenses" className="dashboard__view-all-link">
                                Xem tất cả <ArrowRight size={13} />
                            </Link>
                        )}
                    </div>

                    {expenses.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon"><FileText size={48} strokeWidth={1} /></div>
                            <div className="empty-state__text">Chưa có chi phí nào</div>
                            <Link to="/upload" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                                <Camera size={14} /> Upload hóa đơn đầu tiên
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive" style={{ flex: 1 }}>
                            <table className="data-table" style={{ minWidth: 640 }}>
                                <thead>
                                    <tr>
                                        <th>Loại hóa đơn</th>
                                        <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Ngày nộp</th>
                                        <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Số tiền</th>
                                        <th style={{ minWidth: 125, whiteSpace: 'nowrap' }}>Trạng thái</th>
                                        <th>Chuyến công tác</th>
                                        <th style={{ width: 44 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.slice(0, 6).map((exp) => {
                                        const status = STATUS_MAP[exp.status] || STATUS_MAP.PENDING;
                                        return (
                                            <tr key={exp.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(exp.id)}>
                                                <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                    {getCategoryLabel(exp.invoiceType)}
                                                </td>
                                                <td style={{ color: 'var(--color-text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                                                    {new Date(exp.createdAt).toLocaleDateString('vi-VN')}
                                                </td>
                                                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    {exp.amount.toLocaleString('vi-VN')}đ
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <span className={`badge ${status.className}`}>{status.label}</span>
                                                </td>
                                                <td>{exp.trip?.destination || '—'}</td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedId(exp.id); }}
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
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
