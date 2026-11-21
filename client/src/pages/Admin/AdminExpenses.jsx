/**
 * AdminExpenses.jsx — Duyệt chi phí (Admin/Manager)
 */

import { useState, useEffect } from 'react';
import { adminAPI, expenseAPI } from '../../api/client.js';
import { ClipboardCheck, Check, X, ChevronLeft, ChevronRight, Eye, RotateCcw, Search, Filter } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import ExpenseDetailModal from '../../components/ExpenseDetailModal/ExpenseDetailModal.jsx';
import { getCategoryLabel } from '../../utils/categoryHelper.js';

const STATUS_MAP = {
    PENDING: { label: 'Chờ duyệt', className: 'badge-warning' },
    APPROVED: { label: 'Đã duyệt', className: 'badge-info' },
    REJECTED: { label: 'Từ chối', className: 'badge-danger' },
    REIMBURSED: { label: 'Đã hoàn ứng', className: 'badge-success' },
};

export default function AdminExpenses() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [rejectModal, setRejectModal] = useState(null); // { id, name }
    const [rejectReason, setRejectReason] = useState('');
    const toast = useToast();

    const fetchExpenses = async () => {
        try {
            const params = { page, limit: 15 };
            if (filter) params.status = filter;
            if (search.trim()) params.q = search.trim();
            const res = await adminAPI.expenses(params);
            setExpenses(res.data);
            setPagination(res.pagination);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchExpenses(); }, [page, filter, search]);

    const handleApprove = async (id) => {
        setActionLoading(id);
        try {
            const res = await expenseAPI.approve(id);
            if (res.blockchain?.error) {
                toast(`Đã duyệt nhưng blockchain lỗi: ${res.blockchain.error}. Có thể thử lại sau.`, 'warning');
            } else if (res.data?.status === 'REIMBURSED') {
                toast('Đã duyệt và hoàn ứng thành công qua blockchain!', 'success');
            } else {
                toast('Đã duyệt chi phí thành công!', 'success');
            }
            fetchExpenses();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRetry = async (id) => {
        setActionLoading(id);
        try {
            const res = await expenseAPI.retry(id);
            if (res.blockchain?.error) {
                toast(`Thử lại thất bại: ${res.blockchain.error}`, 'error');
            } else if (res.data?.status === 'REIMBURSED') {
                toast('Hoàn ứng blockchain thành công!', 'success');
            } else {
                toast('Đã thử lại, kiểm tra trạng thái.', 'info');
            }
            fetchExpenses();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const openRejectModal = (id, name) => {
        setRejectModal({ id, name });
        setRejectReason('');
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        setActionLoading(rejectModal.id);
        try {
            await expenseAPI.reject(rejectModal.id, rejectReason);
            toast('Đã từ chối chi phí', 'warning');
            setRejectModal(null);
            fetchExpenses();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Duyệt chi phí</h1>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                        Kiểm tra, thẩm định và phê duyệt hóa đơn hoàn ứng tự động qua Smart Contract
                    </p>
                </div>
            </div>

            {/* ── Toolbar: Search & Filter Tabs ── */}
            <div className="card" style={{ padding: '12px 18px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
                        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Tìm theo tên nhân viên, email, loại chi phí..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            style={{
                                paddingLeft: 36,
                                paddingRight: search ? 32 : 12,
                                height: 38,
                                borderRadius: 8,
                                width: '100%',
                                fontSize: 13,
                                border: '1px solid var(--color-border)',
                            }}
                        />
                        {search && (
                            <button
                                onClick={() => { setSearch(''); setPage(1); }}
                                style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                                    color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center'
                                }}
                                title="Xóa tìm kiếm"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter Status Tabs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Filter size={13} /> Lọc:
                        </span>
                        {['', 'PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED'].map((f) => (
                            <button
                                key={f}
                                onClick={() => { setFilter(f); setPage(1); }}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: filter === f ? 600 : 400,
                                    border: filter === f ? '1px solid var(--color-primary, #2b9e9e)' : '1px solid var(--color-border-light, #e2e8f0)',
                                    background: filter === f ? 'rgba(43,158,158,0.1)' : 'transparent',
                                    color: filter === f ? 'var(--color-primary, #2b9e9e)' : 'var(--color-text-muted)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {f === '' ? 'Tất cả' :
                                    f === 'PENDING' ? 'Chờ duyệt' :
                                        f === 'APPROVED' ? 'Đã duyệt' :
                                            f === 'REJECTED' ? 'Từ chối' : 'Đã hoàn ứng'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card">
                {expenses.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon"><ClipboardCheck size={48} strokeWidth={1} /></div>
                        <div className="empty-state__text">{search ? 'Không tìm thấy hóa đơn phù hợp' : 'Không có hóa đơn nào'}</div>
                    </div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table className="data-table" style={{ minWidth: 900 }}>
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: 170 }}>Nhân viên</th>
                                        <th style={{ minWidth: 120 }}>Phòng ban</th>
                                        <th style={{ minWidth: 110 }}>Số tiền</th>
                                        <th style={{ minWidth: 110 }}>Loại</th>
                                        <th style={{ minWidth: 110 }}>Rủi ro AI</th>
                                        <th style={{ minWidth: 135 }}>Trạng thái</th>
                                        <th style={{ minWidth: 100 }}>Ngày</th>
                                        <th style={{ minWidth: 115, textAlign: 'center' }}>Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map((exp) => {
                                        const status = STATUS_MAP[exp.status] || STATUS_MAP.PENDING;
                                        const fraudScore = exp.fraudAnalysis?.fraudScore || 0;
                                        return (
                                            <tr key={exp.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(exp.id)}>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{exp.user?.name}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{exp.user?.email}</div>
                                                </td>
                                                <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{exp.user?.department?.name || '—'}</td>
                                                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{exp.amount.toLocaleString('vi-VN')}đ</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{getCategoryLabel(exp.invoiceType)}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    {fraudScore >= 50 ? (
                                                        <span className="badge badge-danger">Rủi ro: {fraudScore}</span>
                                                    ) : fraudScore >= 20 ? (
                                                        <span className="badge badge-warning">Lưu ý: {fraudScore}</span>
                                                    ) : (
                                                        <span className="badge badge-success">An toàn</span>
                                                    )}
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <span className={`badge ${status.className}`}>{status.label}</span>
                                                </td>
                                                <td style={{ color: 'var(--color-text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                                                    {new Date(exp.createdAt).toLocaleDateString('vi-VN')}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => setSelectedId(exp.id)} title="Xem chi tiết">
                                                            <Eye size={14} />
                                                        </button>
                                                        {exp.status === 'PENDING' && (
                                                            <>
                                                                <button
                                                                    className="btn btn-sm btn-primary"
                                                                    onClick={() => handleApprove(exp.id)}
                                                                    disabled={actionLoading === exp.id}
                                                                    title="Duyệt"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-danger"
                                                                    onClick={() => openRejectModal(exp.id, exp.user?.name)}
                                                                    disabled={actionLoading === exp.id}
                                                                    title="Từ chối"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {exp.status === 'APPROVED' && (
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                onClick={() => handleRetry(exp.id)}
                                                                disabled={actionLoading === exp.id}
                                                                title="Thử hoàn ứng lại (blockchain)"
                                                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                <RotateCcw size={14} />
                                                                <span style={{ fontSize: 12 }}>Thử lại</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination && pagination.totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                                <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                    <ChevronLeft size={14} /> Trước
                                </button>
                                <span style={{ padding: '6px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                                    Trang {pagination.page} / {pagination.totalPages}
                                </span>
                                <button className="btn btn-sm btn-secondary" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                                    Sau <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Reject Reason Modal */}
            {rejectModal && (
                <div className="modal-overlay" onClick={() => setRejectModal(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2 className="modal-header__title">Từ chối chi phí</h2>
                            <button className="modal-close" onClick={() => setRejectModal(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12, fontSize: 14 }}>
                                Từ chối chi phí của <strong>{rejectModal.name}</strong>. Vui lòng nhập lý do:
                            </p>
                            <div className="form-group">
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    placeholder="Ví dụ: Vượt hạn mức ngân sách ngày, thiếu thông tin MST..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>Hủy</button>
                                <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading}>
                                    <X size={14} /> Xác nhận từ chối
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedId && (
                <ExpenseDetailModal
                    expenseId={selectedId}
                    onClose={() => setSelectedId(null)}
                />
            )}
        </div>
    );
}
