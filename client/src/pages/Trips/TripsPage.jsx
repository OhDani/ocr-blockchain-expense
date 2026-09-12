/**
 * TripsPage.jsx — Danh sách chuyến công tác (với detail modal + kế hoạch)
 */

import { useState, useEffect } from 'react';
import { tripAPI, adminAPI } from '../../api/client.js';
import {
    Plane, Plus, X, MapPin, Eye, Calendar, Target, CreditCard, FileText, Filter,
    Clock, Trash2, Handshake, Car, Hotel, UtensilsCrossed, Compass, ClipboardList,
    CheckCircle2, Circle, DollarSign,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import ExpenseDetailModal from '../../components/ExpenseDetailModal/ExpenseDetailModal.jsx';

const TRIP_STATUS = {
    PLANNED: { label: 'Đã lên kế hoạch', className: 'badge-info' },
    ONGOING: { label: 'Đang diễn ra', className: 'badge-warning' },
    COMPLETED: { label: 'Hoàn thành', className: 'badge-success' },
    CANCELLED: { label: 'Đã hủy', className: 'badge-danger' },
};

const POPULAR_DESTINATIONS = [
    'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
    'Nha Trang', 'Đà Lạt', 'Huế', 'Quảng Ninh', 'Vũng Tàu',
    'Bình Dương', 'Đồng Nai', 'Hải Dương', 'Bắc Ninh', 'Thanh Hóa',
    'Nghệ An', 'Quy Nhơn', 'Phan Thiết', 'Phú Quốc', 'Sa Pa',
];

const ACTIVITY_TYPES = {
    meeting: { label: 'Họp / Gặp đối tác', Icon: Handshake, color: '#6366f1' },
    transport: { label: 'Di chuyển', Icon: Car, color: '#f59e0b' },
    accommodation: { label: 'Khách sạn', Icon: Hotel, color: '#10b981' },
    meal: { label: 'Ăn uống', Icon: UtensilsCrossed, color: '#ef4444' },
    sightseeing: { label: 'Khảo sát', Icon: Compass, color: '#8b5cf6' },
    other: { label: 'Khác', Icon: ClipboardList, color: '#6b7280' },
};

const formatNumber = (val) => {
    const num = val.toString().replace(/\D/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const EXP_STATUS = {
    PENDING: { label: 'Chờ duyệt', className: 'badge-warning' },
    APPROVED: { label: 'Đã duyệt', className: 'badge-info' },
    REJECTED: { label: 'Từ chối', className: 'badge-danger' },
    REIMBURSED: { label: 'Đã hoàn ứng', className: 'badge-success' },
};

export default function TripsPage() {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [tripDetail, setTripDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [expenseModalId, setExpenseModalId] = useState(null);
    const [deptFilter, setDeptFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [detailTab, setDetailTab] = useState('info');
    const toast = useToast();
    const { user: currentUser } = useAuth();
    const isManager = currentUser?.role === 'MANAGER';
    const [deptEmployees, setDeptEmployees] = useState([]);
    const [form, setForm] = useState({
        destination: '', workLocation: '', purpose: '',
        startDate: '', endDate: '', budget: '', userId: '',
    });

    const [showActivityForm, setShowActivityForm] = useState(false);
    const [actForm, setActForm] = useState({
        date: '', time: '', title: '', description: '', location: '',
        type: 'meeting', estimatedCost: '',
    });
    const [actLoading, setActLoading] = useState(false);

    const fetchTrips = async () => {
        try {
            const res = await tripAPI.list();
            setTrips(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrips();
        // Manager: load danh sách nhân viên phòng ban
        if (isManager) {
            adminAPI.users().then(res => {
                const myDeptId = currentUser?.departmentId;
                const employees = (res.data || []).filter(u => 
                    u.department?.id === myDeptId || u.departmentId === myDeptId
                );
                setDeptEmployees(employees);
            }).catch(console.error);
        }
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form };
            // Manager gửi userId nếu chọn nhân viên
            if (!payload.userId) delete payload.userId;
            await tripAPI.create(payload);
            setShowForm(false);
            setForm({ destination: '', workLocation: '', purpose: '', startDate: '', endDate: '', budget: '', userId: '' });
            toast('Tạo chuyến công tác thành công!', 'success');
            fetchTrips();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const viewTripDetail = async (tripId) => {
        setDetailLoading(true);
        setSelectedTrip(tripId);
        setDetailTab('info');
        try {
            const res = await tripAPI.get(tripId);
            setTripDetail(res.data);
        } catch (err) {
            toast('Không tải được chi tiết chuyến', 'error');
        } finally {
            setDetailLoading(false);
        }
    };

    const closeTripDetail = () => {
        setSelectedTrip(null);
        setTripDetail(null);
        setShowActivityForm(false);
    };

    const handleStatusChange = async (tripId, newStatus) => {
        try {
            await tripAPI.update(tripId, { status: newStatus });
            toast(`Đã cập nhật: ${TRIP_STATUS[newStatus]?.label}`, 'success');
            setTripDetail((prev) => prev ? { ...prev, status: newStatus } : prev);
            fetchTrips();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    // ── Activity handlers ──
    const handleAddActivity = async (e) => {
        e.preventDefault();
        if (!actForm.date || !actForm.title) return;
        setActLoading(true);
        try {
            const res = await tripAPI.addActivity(selectedTrip, {
                ...actForm,
                estimatedCost: actForm.estimatedCost || null,
            });
            setTripDetail(prev => ({
                ...prev,
                activities: [...(prev.activities || []), res.data].sort((a, b) =>
                    new Date(a.date) - new Date(b.date) || (a.time || '').localeCompare(b.time || '')
                ),
            }));
            setActForm({ date: '', time: '', title: '', description: '', location: '', type: 'meeting', estimatedCost: '' });
            setShowActivityForm(false);
            toast('Đã thêm hoạt động', 'success');
        } catch (err) {
            toast(err.message || 'Lỗi', 'error');
        } finally {
            setActLoading(false);
        }
    };

    const handleToggleComplete = async (act) => {
        try {
            await tripAPI.updateActivity(selectedTrip, act.id, { completed: !act.completed });
            setTripDetail(prev => ({
                ...prev,
                activities: prev.activities.map(a =>
                    a.id === act.id ? { ...a, completed: !a.completed } : a
                ),
            }));
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handleDeleteActivity = async (actId) => {
        if (!window.confirm('Xóa hoạt động này?')) return;
        try {
            await tripAPI.deleteActivity(selectedTrip, actId);
            setTripDetail(prev => ({
                ...prev,
                activities: prev.activities.filter(a => a.id !== actId),
            }));
            toast('Đã xóa', 'success');
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    // Group activities by date
    const groupedActivities = (tripDetail?.activities || []).reduce((groups, act) => {
        const dateKey = new Date(act.date).toLocaleDateString('vi-VN', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
        });
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(act);
        return groups;
    }, {});

    // Summary stats for plan tab
    const totalEstimated = (tripDetail?.activities || []).reduce((s, a) => s + (a.estimatedCost || 0), 0);
    const completedCount = (tripDetail?.activities || []).filter(a => a.completed).length;
    const totalActivities = tripDetail?.activities?.length || 0;

    const isOwner = tripDetail?.userId === currentUser?.id;

    return (
        <div>
            <div className="page-header">
                <h1>Chuyến công tác</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? <><X size={14} /> Đóng</> : <><Plus size={14} /> Tạo mới</>}
                </button>
            </div>

            {/* Form tạo mới */}
            {showForm && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group">
                            <label>Điểm đến *</label>
                            <input className="form-input" placeholder="Nhập hoặc chọn điểm đến" value={form.destination}
                                onChange={(e) => setForm({ ...form, destination: e.target.value })} required
                                list="dest-suggestions" />
                            <datalist id="dest-suggestions">
                                {POPULAR_DESTINATIONS.map((d) => <option key={d} value={d} />)}
                            </datalist>
                        </div>
                        <div className="form-group">
                            <label>Địa điểm làm việc</label>
                            <input className="form-input" placeholder="Công ty ABC, 123 Nguyễn Văn Linh" value={form.workLocation}
                                onChange={(e) => setForm({ ...form, workLocation: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Mục đích</label>
                            <input className="form-input" placeholder="Họp đối tác + khảo sát thị trường" value={form.purpose}
                                onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                        </div>
                        {isManager && deptEmployees.length > 0 && (
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Tạo cho nhân viên</label>
                                <select className="form-input" value={form.userId}
                                    onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                                    <option value="">Bản thân tôi</option>
                                    {deptEmployees.filter(e => e.id !== currentUser?.id).map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="form-group">
                            <label>Ngày đi *</label>
                            <input className="form-input" type="date" value={form.startDate}
                                onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label>Ngày về *</label>
                            <input className="form-input" type="date" value={form.endDate}
                                onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label>Ngân sách (VNĐ) *</label>
                            <input className="form-input" placeholder="5.000.000"
                                value={form.budget ? formatNumber(form.budget) : ''}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, '');
                                    setForm({ ...form, budget: raw });
                                }} required />
                        </div>
                        <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary" type="submit" style={{ marginTop: 'auto' }}>Tạo chuyến</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Danh sách */}
            {trips.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state__icon"><Plane size={48} strokeWidth={1} /></div>
                        <div className="empty-state__text">Chưa có chuyến công tác nào</div>
                    </div>
                </div>
            ) : (
                <div className="card">
                    {/* Filter bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
                        <select className="form-input" value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: 'auto', minWidth: 150, padding: '6px 10px', fontSize: 13 }}
                        >
                            <option value="">Tất cả trạng thái</option>
                            {Object.entries(TRIP_STATUS).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                        <select className="form-input" value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            style={{ width: 'auto', minWidth: 120, padding: '6px 10px', fontSize: 13 }}
                        >
                            <option value="">Tất cả tháng</option>
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={String(i + 1)}>Tháng {i + 1}</option>
                            ))}
                        </select>
                        <select className="form-input" value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            style={{ width: 'auto', minWidth: 100, padding: '6px 10px', fontSize: 13 }}
                        >
                            <option value="">Tất cả năm</option>
                            {[...new Set(trips.map(t => new Date(t.startDate).getFullYear()))].sort((a, b) => b - a).map(y => (
                                <option key={y} value={String(y)}>{y}</option>
                            ))}
                        </select>
                        {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                            <select className="form-input" value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                style={{ width: 'auto', minWidth: 180, padding: '6px 10px', fontSize: 13 }}
                            >
                                <option value="">Tất cả phòng ban</option>
                                {[...new Set(trips.map(t => t.user?.department?.name).filter(Boolean))].map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Điểm đến</th>
                                <th>Người tạo</th>
                                <th>Ngày</th>
                                <th>Ngân sách</th>
                                <th>Chi phí</th>
                                <th>Trạng thái</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {trips.filter(t => {
                                if (deptFilter && t.user?.department?.name !== deptFilter) return false;
                                if (statusFilter && t.status !== statusFilter) return false;
                                if (monthFilter && (new Date(t.startDate).getMonth() + 1) !== Number(monthFilter)) return false;
                                if (yearFilter && new Date(t.startDate).getFullYear() !== Number(yearFilter)) return false;
                                return true;
                            }).map((t) => {
                                const status = TRIP_STATUS[t.status] || TRIP_STATUS.PLANNED;
                                const totalExpenses = t.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
                                return (
                                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => viewTripDetail(t.id)}>
                                        <td style={{ fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <MapPin size={14} style={{ color: 'var(--color-text-muted)' }} />
                                                {t.destination}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{t.user?.name || '—'}</div>
                                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t.user?.department?.name || ''}</div>
                                        </td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>
                                            {new Date(t.startDate).toLocaleDateString('vi-VN')} → {new Date(t.endDate).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td>{t.budget.toLocaleString('vi-VN')}đ</td>
                                        <td>{totalExpenses.toLocaleString('vi-VN')}đ</td>
                                        <td><span className={`badge ${status.className}`}>{status.label}</span></td>
                                        <td>
                                            <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); viewTripDetail(t.id); }}>
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

            {/* ════════════ Trip Detail Modal ════════════ */}
            {selectedTrip && (
                <div className="modal-overlay" onClick={closeTripDetail}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h2 className="modal-header__title">Chi tiết chuyến công tác</h2>
                            <button className="modal-close" onClick={closeTripDetail}><X size={20} /></button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', padding: '0 24px' }}>
                            {[
                                { key: 'info', label: 'Thông tin' },
                                { key: 'plan', label: `Kế hoạch (${totalActivities})` },
                                { key: 'expenses', label: `Chi phí (${tripDetail?.expenses?.length || 0})` },
                            ].map(tab => (
                                <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                                    style={{
                                        padding: '10px 16px', fontSize: 13, fontWeight: 500,
                                        border: 'none', background: 'none', cursor: 'pointer',
                                        borderBottom: detailTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                                        color: detailTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                        marginBottom: -2,
                                    }}
                                >{tab.label}</button>
                            ))}
                        </div>

                        {detailLoading ? (
                            <div className="loading-center" style={{ minHeight: 200 }}><div className="spinner" /></div>
                        ) : tripDetail && (
                            <div className="modal-body">
                                {/* ── Tab: Thông tin ── */}
                                {detailTab === 'info' && (
                                    <div className="detail-grid">
                                        <div className="detail-row">
                                            <div className="detail-row__label"><MapPin size={14} /> Điểm đến</div>
                                            <div className="detail-row__value" style={{ fontWeight: 700 }}>{tripDetail.destination}</div>
                                        </div>
                                        {tripDetail.workLocation && (
                                            <div className="detail-row">
                                                <div className="detail-row__label"><Target size={14} /> Địa điểm làm việc</div>
                                                <div className="detail-row__value">{tripDetail.workLocation}</div>
                                            </div>
                                        )}
                                        {tripDetail.purpose && (
                                            <div className="detail-row">
                                                <div className="detail-row__label"><FileText size={14} /> Mục đích</div>
                                                <div className="detail-row__value">{tripDetail.purpose}</div>
                                            </div>
                                        )}
                                        <div className="detail-row">
                                            <div className="detail-row__label"><Calendar size={14} /> Thời gian</div>
                                            <div className="detail-row__value">
                                                {new Date(tripDetail.startDate).toLocaleDateString('vi-VN')} → {new Date(tripDetail.endDate).toLocaleDateString('vi-VN')}
                                            </div>
                                        </div>
                                        <div className="detail-row">
                                            <div className="detail-row__label"><CreditCard size={14} /> Ngân sách</div>
                                            <div className="detail-row__value detail-row__value--highlight">{tripDetail.budget.toLocaleString('vi-VN')}đ</div>
                                        </div>
                                        <div className="detail-row">
                                            <div className="detail-row__label"><Calendar size={14} /> Trạng thái</div>
                                            <div className="detail-row__value">
                                                {isOwner ? (
                                                    <select className="form-input" value={tripDetail.status}
                                                        onChange={(e) => handleStatusChange(tripDetail.id, e.target.value)}
                                                        style={{ padding: '6px 10px', fontSize: 13, width: 'auto', minWidth: 160 }}
                                                    >
                                                        <option value="PLANNED">Đã lên kế hoạch</option>
                                                        <option value="ONGOING">Đang diễn ra</option>
                                                        <option value="COMPLETED">Hoàn thành</option>
                                                        <option value="CANCELLED">Đã hủy</option>
                                                    </select>
                                                ) : (
                                                    <span className={`badge ${(TRIP_STATUS[tripDetail.status] || TRIP_STATUS.PLANNED).className}`}>
                                                        {(TRIP_STATUS[tripDetail.status] || TRIP_STATUS.PLANNED).label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Tab: Kế hoạch ── */}
                                {detailTab === 'plan' && (
                                    <div>
                                        {/* Summary bar */}
                                        {totalActivities > 0 && (
                                            <div style={{
                                                display: 'flex', gap: 16, marginBottom: 16, padding: '12px 16px',
                                                borderRadius: 12, background: 'rgba(238,242,247,0.5)',
                                                fontSize: 13, flexWrap: 'wrap',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                                                    <span>Hoàn thành: <strong>{completedCount}/{totalActivities}</strong></span>
                                                </div>
                                                {(() => {
                                                    const pct = totalActivities > 0 ? (completedCount / totalActivities) * 100 : 0;
                                                    return (
                                                        <div style={{ flex: 1, minWidth: 80, display: 'flex', alignItems: 'center' }}>
                                                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', borderRadius: 3, transition: 'width 0.3s' }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                {totalEstimated > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <DollarSign size={14} style={{ color: '#f59e0b' }} />
                                                        <span>Dự trù: <strong>{totalEstimated.toLocaleString('vi-VN')}đ</strong></span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Add button */}
                                        {isOwner && (
                                            <div style={{ marginBottom: 16 }}>
                                                {!showActivityForm ? (
                                                    <button className="btn btn-primary btn-sm" onClick={() => {
                                                        setShowActivityForm(true);
                                                        setActForm(prev => ({ ...prev, date: tripDetail.startDate?.split('T')[0] || '' }));
                                                    }}>
                                                        <Plus size={14} /> Thêm hoạt động
                                                    </button>
                                                ) : (
                                                    <form onSubmit={handleAddActivity} style={{
                                                        padding: 16, borderRadius: 12, background: 'rgba(238,242,247,0.5)',
                                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                                                    }}>
                                                        <div style={{ gridColumn: '1 / -1', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                                                            Thêm hoạt động mới
                                                        </div>
                                                        <input className="form-input" type="date" value={actForm.date}
                                                            onChange={(e) => setActForm(p => ({ ...p, date: e.target.value }))} required
                                                            style={{ fontSize: 13 }} />
                                                        <input className="form-input" type="time" value={actForm.time}
                                                            onChange={(e) => setActForm(p => ({ ...p, time: e.target.value }))}
                                                            style={{ fontSize: 13 }} />
                                                        <input className="form-input" value={actForm.title}
                                                            onChange={(e) => setActForm(p => ({ ...p, title: e.target.value }))}
                                                            placeholder="Tiêu đề hoạt động *" required
                                                            style={{ gridColumn: '1 / -1', fontSize: 13 }} />
                                                        <input className="form-input" value={actForm.location}
                                                            onChange={(e) => setActForm(p => ({ ...p, location: e.target.value }))}
                                                            placeholder="Địa điểm" style={{ fontSize: 13 }} />
                                                        <select className="form-input" value={actForm.type}
                                                            onChange={(e) => setActForm(p => ({ ...p, type: e.target.value }))}
                                                            style={{ fontSize: 13 }}>
                                                            {Object.entries(ACTIVITY_TYPES).map(([k, v]) => (
                                                                <option key={k} value={k}>{v.label}</option>
                                                            ))}
                                                        </select>
                                                        <input className="form-input"
                                                            placeholder="Dự trù chi phí (VNĐ)"
                                                            value={actForm.estimatedCost ? formatNumber(actForm.estimatedCost) : ''}
                                                            onChange={(e) => {
                                                                const raw = e.target.value.replace(/\D/g, '');
                                                                setActForm(p => ({ ...p, estimatedCost: raw }));
                                                            }}
                                                            style={{ fontSize: 13 }} />
                                                        <textarea className="form-input" value={actForm.description}
                                                            onChange={(e) => setActForm(p => ({ ...p, description: e.target.value }))}
                                                            placeholder="Ghi chú chi tiết..." rows={2}
                                                            style={{ gridColumn: '1 / -1', fontSize: 13, resize: 'vertical' }} />
                                                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowActivityForm(false)}>Hủy</button>
                                                            <button type="submit" className="btn btn-primary btn-sm" disabled={actLoading}>
                                                                {actLoading ? 'Đang lưu...' : 'Thêm'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        )}

                                        {/* Timeline */}
                                        {totalActivities === 0 ? (
                                            <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                <Calendar size={32} strokeWidth={1} style={{ marginBottom: 8, opacity: 0.5 }} />
                                                <div>Chưa có kế hoạch nào cho chuyến này</div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                                {Object.entries(groupedActivities).map(([dateLabel, acts]) => (
                                                    <div key={dateLabel}>
                                                        <div style={{
                                                            fontSize: 13, fontWeight: 600, color: 'var(--color-primary)',
                                                            marginBottom: 8, textTransform: 'capitalize',
                                                            display: 'flex', alignItems: 'center', gap: 6,
                                                        }}>
                                                            <Calendar size={14} /> {dateLabel}
                                                        </div>
                                                        <div style={{ borderLeft: '2px solid var(--color-border)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {acts.map((act) => {
                                                                const typeInfo = ACTIVITY_TYPES[act.type] || ACTIVITY_TYPES.other;
                                                                const TypeIcon = typeInfo.Icon;
                                                                return (
                                                                    <div key={act.id} style={{
                                                                        padding: '10px 14px', borderRadius: 10,
                                                                        background: act.completed ? 'rgba(16,185,129,0.04)' : 'rgba(238,242,247,0.5)',
                                                                        position: 'relative',
                                                                        opacity: act.completed ? 0.7 : 1,
                                                                    }}>
                                                                        {/* Timeline dot */}
                                                                        <div style={{
                                                                            position: 'absolute', left: -22, top: 14, width: 10, height: 10,
                                                                            borderRadius: '50%', background: act.completed ? '#10b981' : typeInfo.color,
                                                                            border: '2px solid white',
                                                                        }} />
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                            <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                                                                                {/* Checkbox */}
                                                                                {isOwner && (
                                                                                    <button onClick={() => handleToggleComplete(act)}
                                                                                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', marginTop: 1, flexShrink: 0 }}
                                                                                        title={act.completed ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
                                                                                    >
                                                                                        {act.completed
                                                                                            ? <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                                                                                            : <Circle size={18} style={{ color: 'var(--color-border)' }} />
                                                                                        }
                                                                                    </button>
                                                                                )}
                                                                                <div style={{ flex: 1 }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                                                        <TypeIcon size={14} style={{ color: typeInfo.color }} />
                                                                                        <span style={{
                                                                                            fontWeight: 600, fontSize: 14,
                                                                                            textDecoration: act.completed ? 'line-through' : 'none',
                                                                                        }}>
                                                                                            {act.title}
                                                                                        </span>
                                                                                        {act.time && (
                                                                                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                                                <Clock size={11} /> {act.time}
                                                                                            </span>
                                                                                        )}
                                                                                        {act.estimatedCost > 0 && (
                                                                                            <span style={{
                                                                                                fontSize: 11, color: '#f59e0b', fontWeight: 500,
                                                                                                background: 'rgba(245,158,11,0.1)', padding: '1px 8px',
                                                                                                borderRadius: 10,
                                                                                            }}>
                                                                                                ~{act.estimatedCost.toLocaleString('vi-VN')}đ
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    {act.location && (
                                                                                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                                            <MapPin size={11} /> {act.location}
                                                                                        </div>
                                                                                    )}
                                                                                    {act.description && (
                                                                                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{act.description}</div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            {isOwner && (
                                                                                <button onClick={() => handleDeleteActivity(act.id)}
                                                                                    style={{
                                                                                        border: 'none', background: 'rgba(239,68,68,0.08)',
                                                                                        color: '#ef4444', padding: 5, borderRadius: 6,
                                                                                        cursor: 'pointer', flexShrink: 0,
                                                                                    }}
                                                                                    title="Xóa"
                                                                                >
                                                                                    <Trash2 size={13} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Tab: Chi phí ── */}
                                {detailTab === 'expenses' && (
                                    <div>
                                        {/* Budget progress bar */}
                                        {(() => {
                                            const totalSpent = (tripDetail.expenses || []).reduce((sum, e) => sum + e.amount, 0);
                                            const pct = tripDetail.budget > 0 ? Math.min((totalSpent / tripDetail.budget) * 100, 100) : 0;
                                            const overBudget = totalSpent > tripDetail.budget;
                                            return (
                                                <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(238,242,247,0.5)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                                        <span>Đã chi: <strong>{totalSpent.toLocaleString('vi-VN')}đ</strong></span>
                                                        <span>Ngân sách: <strong>{tripDetail.budget.toLocaleString('vi-VN')}đ</strong></span>
                                                    </div>
                                                    <div style={{ height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: 4, width: `${pct}%`,
                                                            background: overBudget ? '#ef4444' : pct > 80 ? '#f59e0b' : '#10b981',
                                                            transition: 'width 0.3s',
                                                        }} />
                                                    </div>
                                                    <div style={{ fontSize: 11, color: overBudget ? '#ef4444' : 'var(--color-text-muted)', marginTop: 4 }}>
                                                        {overBudget ? `⚠️ Vượt ${(totalSpent - tripDetail.budget).toLocaleString('vi-VN')}đ` : `${pct.toFixed(0)}% ngân sách`}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {tripDetail.expenses?.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {tripDetail.expenses.map((exp) => {
                                                    const s = EXP_STATUS[exp.status] || EXP_STATUS.PENDING;
                                                    return (
                                                        <div key={exp.id} onClick={() => setExpenseModalId(exp.id)}
                                                            style={{
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                padding: '10px 14px', borderRadius: 10,
                                                                background: 'rgba(238,242,247,0.5)',
                                                                cursor: 'pointer', transition: 'background 0.2s',
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124,108,240,0.06)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(238,242,247,0.5)'}
                                                        >
                                                            <div>
                                                                <div style={{ fontWeight: 500, fontSize: 14 }}>{exp.invoiceType || 'Hóa đơn'}</div>
                                                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                                                    {new Date(exp.createdAt).toLocaleDateString('vi-VN')}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <span style={{ fontWeight: 600 }}>{exp.amount.toLocaleString('vi-VN')}đ</span>
                                                                <span className={`badge ${s.className}`}>{s.label}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                                                Chưa có chi phí nào gắn với chuyến này
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {expenseModalId && (
                <ExpenseDetailModal expenseId={expenseModalId} onClose={() => setExpenseModalId(null)} />
            )}
        </div>
    );
}
