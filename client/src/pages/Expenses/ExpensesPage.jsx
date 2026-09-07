/**
 * ExpensesPage.jsx — Lịch sử chi phí (với tìm kiếm + lọc)
 */

import { useState, useEffect, useMemo } from 'react';
import { expenseAPI } from '../../api/client.js';
import { FileText, Eye, Search, AlertCircle, Trash2 } from 'lucide-react';
import ExpenseDetailModal from '../../components/ExpenseDetailModal/ExpenseDetailModal.jsx';
import Pagination, { usePagination } from '../../components/Pagination/Pagination.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const STATUS_MAP = {
    PENDING: { label: 'Chờ duyệt', className: 'badge-warning' },
    APPROVED: { label: 'Đã duyệt', className: 'badge-info' },
    REJECTED: { label: 'Từ chối', className: 'badge-danger' },
    REIMBURSED: { label: 'Đã hoàn ứng', className: 'badge-success' },
};

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [appealModal, setAppealModal] = useState(null); // { id }
    const [appealText, setAppealText] = useState('');
    const [appealLoading, setAppealLoading] = useState(false);
    const [page, setPage] = useState(1);
    const toast = useToast();

    const fetchExpenses = () => {
        expenseAPI.list()
            .then((res) => setExpenses(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchExpenses(); }, []);

    const handleAppeal = async () => {
        if (!appealText.trim() || !appealModal) return;
        setAppealLoading(true);
        try {
            await expenseAPI.appeal(appealModal.id, appealText.trim());
            toast('Khiếu nại đã gửi! Đơn sẽ được xem lại.', 'success');
            setAppealModal(null);
            setAppealText('');
            fetchExpenses();
        } catch (err) {
            toast(err.message || 'Gửi khiếu nại thất bại', 'error');
        } finally {
            setAppealLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bạn chắc chắn muốn xóa chi phí này?')) return;
        try {
            await expenseAPI.remove(id);
            toast('Đã xóa chi phí', 'success');
            fetchExpenses();
        } catch (err) {
            toast(err.message || 'Xóa thất bại', 'error');
        }
    };

    // Client-side filtering
    const filtered = useMemo(() => {
        let result = expenses;
        if (statusFilter) {
            result = result.filter((e) => e.status === statusFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter((e) =>
                (e.invoiceType || '').toLowerCase().includes(q) ||
                (e.trip?.destination || '').toLowerCase().includes(q) ||
                (e.amount + '').includes(q)
            );
        }
        return result;
    }, [expenses, search, statusFilter]);

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [search, statusFilter]);

    const { totalPages, getPage } = usePagination(filtered, 10);
    const paginatedExpenses = getPage(page);

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1>Lịch sử chi phí</h1>
            </div>

            {/* Search & Filter bar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    <input
                        className="form-input"
                        placeholder="Tìm kiếm theo loại, điểm đến..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: 36, width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {['', 'PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED'].map((f) => (
                        <button
                            key={f}
                            className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setStatusFilter(f)}
                        >
                            {f === '' ? 'Tất cả' : STATUS_MAP[f]?.label}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state__icon"><FileText size={48} strokeWidth={1} /></div>
                        <div className="empty-state__text">
                            {expenses.length > 0 ? 'Không tìm thấy chi phí phù hợp' : 'Chưa có chi phí nào'}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Loại hóa đơn</th>
                                <th>Số tiền</th>
                                <th>Trạng thái</th>
                                <th>Policy</th>
                                <th>Chuyến</th>
                                <th>Ngày</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedExpenses.map((exp) => {
                                const status = STATUS_MAP[exp.status] || STATUS_MAP.PENDING;
                                return (
                                    <tr key={exp.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(exp.id)}>
                                        <td>{exp.invoiceType || '—'}</td>
                                        <td style={{ fontWeight: 600 }}>{exp.amount.toLocaleString('vi-VN')}đ</td>
                                        <td><span className={`badge ${status.className}`}>{status.label}</span></td>
                                        <td>
                                            <span className={`badge ${exp.policyStatus === 'VALID' ? 'badge-success' :
                                                exp.policyStatus === 'OVER_BUDGET' ? 'badge-warning' : 'badge-danger'
                                                }`}>
                                                {exp.policyStatus === 'VALID' ? 'Hợp lệ' :
                                                    exp.policyStatus === 'OVER_BUDGET' ? 'Vượt hạn mức' :
                                                        exp.policyStatus === 'INVALID_TAX_ID' ? 'MST lỗi' : exp.policyStatus || '—'}
                                            </span>
                                        </td>
                                        <td>{exp.trip?.destination || '—'}</td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>
                                            {new Date(exp.createdAt).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setSelectedId(exp.id); }}>
                                                    <Eye size={14} />
                                                </button>
                                                {exp.status === 'PENDING' && (
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none' }}
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(exp.id); }}
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                                {exp.status === 'REJECTED' && !exp.appealNote && (
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ background: 'var(--color-warning)', color: 'white', border: 'none' }}
                                                        onClick={(e) => { e.stopPropagation(); setAppealModal({ id: exp.id }); }}
                                                        title="Khiếu nại"
                                                    >
                                                        <AlertCircle size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
            )}

            {/* Detail Modal */}
            {selectedId && (
                <ExpenseDetailModal
                    expenseId={selectedId}
                    onClose={() => setSelectedId(null)}
                />
            )}
            {/* Appeal Modal */}
            {appealModal && (
                <div className="modal-overlay" onClick={() => setAppealModal(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h2 className="modal-header__title">Khiếu nại chi phí</h2>
                            <button className="modal-close" onClick={() => setAppealModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                                Nhập lý do khiếu nại. Đơn sẽ được chuyển về <strong>Chờ duyệt</strong> để admin xem lại.
                            </p>
                            <textarea
                                className="form-input"
                                placeholder="VD: Số tiền đã được trưởng phòng phê duyệt trước"
                                value={appealText}
                                onChange={(e) => setAppealText(e.target.value)}
                                rows={3}
                                style={{ resize: 'vertical', marginBottom: 16 }}
                            />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setAppealModal(null)}>Hủy</button>
                                <button className="btn btn-primary" onClick={handleAppeal} disabled={!appealText.trim() || appealLoading}>
                                    {appealLoading ? 'Đang gửi...' : 'Gửi khiếu nại'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
