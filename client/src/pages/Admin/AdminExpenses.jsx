/**
 * AdminExpenses.jsx — Duyệt chi phí (Admin/Manager)
 */

import { useState, useEffect } from 'react';
import { adminAPI, expenseAPI } from '../../api/client.js';
import { ClipboardCheck, Check, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import ExpenseDetailModal from '../../components/ExpenseDetailModal/ExpenseDetailModal.jsx';

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
            const res = await adminAPI.expenses(params);
            setExpenses(res.data);
            setPagination(res.pagination);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchExpenses(); }, [page, filter]);

    const handleApprove = async (id) => {
        setActionLoading(id);
        try {
            await expenseAPI.approve(id);
            toast('Đã duyệt chi phí thành công!', 'success');
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
            <div className="page-header">
                <h1>Duyệt chi phí</h1>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['', 'PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED'].map((f) => (
                        <button
                            key={f}
                            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => { setFilter(f); setPage(1); }}
                        >
                            {f === '' ? 'Tất cả' :
                                f === 'PENDING' ? 'Chờ duyệt' :
                                    f === 'APPROVED' ? 'Đã duyệt' :
                                        f === 'REJECTED' ? 'Từ chối' : 'Đã hoàn ứng'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card">
                {expenses.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon"><ClipboardCheck size={48} strokeWidth={1} /></div>
                        <div className="empty-state__text">Không có hóa đơn nào</div>
                    </div>
                ) : (
                    <>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nhân viên</th>
                                    <th>Phòng ban</th>
                                    <th>Số tiền</th>
                                    <th>Loại</th>
                                    <th>Trạng thái</th>
                                    <th>Ngày</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((exp) => {
                                    const status = STATUS_MAP[exp.status] || STATUS_MAP.PENDING;
                                    return (
                                        <tr key={exp.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(exp.id)}>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{exp.user?.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{exp.user?.email}</div>
                                            </td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{exp.user?.department || '—'}</td>
                                            <td style={{ fontWeight: 600 }}>{exp.amount.toLocaleString('vi-VN')}đ</td>
                                            <td>{exp.invoiceType || '—'}</td>
                                            <td><span className={`badge ${status.className}`}>{status.label}</span></td>
                                            <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                                                {new Date(exp.createdAt).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
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
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

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
