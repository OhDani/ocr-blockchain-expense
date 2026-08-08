/**
 * ExpenseDetailModal.jsx — Modal chi tiết chi phí (AI, Policy, Blockchain)
 */

import { useState, useEffect } from 'react';
import { expenseAPI } from '../../api/client.js';
import {
    X, Bot, ClipboardCheck, Link2, Image, Store, Hash,
    Calendar, CreditCard, FileText, CheckCircle, XCircle,
    AlertTriangle, Clock, Loader,
} from 'lucide-react';
import './ExpenseDetailModal.css';

const STATUS_MAP = {
    PENDING: { label: 'Chờ duyệt', className: 'badge-warning', icon: Clock },
    APPROVED: { label: 'Đã duyệt', className: 'badge-info', icon: CheckCircle },
    REJECTED: { label: 'Từ chối', className: 'badge-danger', icon: XCircle },
    REIMBURSED: { label: 'Đã hoàn ứng', className: 'badge-success', icon: CheckCircle },
};

export default function ExpenseDetailModal({ expenseId, onClose }) {
    const [expense, setExpense] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('info');

    useEffect(() => {
        if (!expenseId) return;
        setLoading(true);
        expenseAPI.get(expenseId)
            .then((res) => setExpense(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [expenseId]);

    if (!expenseId) return null;

    const formatMoney = (v) => v != null ? Number(v).toLocaleString('vi-VN') + 'đ' : '—';

    const ocr = expense?.ocrData || {};
    const policy = expense?.policyResult || {};
    const policyStatus = expense?.policyStatus?.toLowerCase();
    const status = STATUS_MAP[expense?.status] || STATUS_MAP.PENDING;
    const StatusIcon = status.icon;

    const tabs = [
        { id: 'info', label: 'Hóa đơn', icon: FileText },
        { id: 'policy', label: 'Chính sách', icon: ClipboardCheck },
        { id: 'blockchain', label: 'Blockchain', icon: Link2 },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-header__left">
                        <h2 className="modal-header__title">Chi tiết chi phí</h2>
                        <span className={`badge ${status.className}`}>
                            <StatusIcon size={12} /> {status.label}
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="loading-center" style={{ minHeight: 300 }}>
                        <Loader size={24} className="spinner-icon" />
                    </div>
                ) : !expense ? (
                    <div className="empty-state"><div className="empty-state__text">Không tìm thấy chi phí</div></div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="modal-tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    className={`modal-tab ${activeTab === tab.id ? 'modal-tab--active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <tab.icon size={14} /> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div className="modal-body">
                            {/* ── Tab: Hóa đơn ── */}
                            {activeTab === 'info' && (
                                <div className="modal-tab-content">
                                    {/* Invoice image */}
                                    {expense.imageUrl && (
                                        <div className="detail-image">
                                            <img
                                                src={`http://localhost:3000${expense.imageUrl}`}
                                                alt="Hóa đơn"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        </div>
                                    )}

                                    <div className="detail-grid">
                                        <DetailRow icon={Store} label="Cửa hàng" value={ocr.store_name || ocr.seller_name} />
                                        <DetailRow icon={Hash} label="Mã số thuế" value={ocr.tax_id || ocr.tax_code} />
                                        <DetailRow icon={CreditCard} label="Tổng tiền" value={formatMoney(expense.amount)} highlight />
                                        <DetailRow icon={Calendar} label="Ngày hóa đơn" value={ocr.date || ocr.invoice_date} />
                                        <DetailRow icon={FileText} label="Loại" value={expense.invoiceType} />
                                        <DetailRow icon={Calendar} label="Ngày tạo" value={new Date(expense.createdAt).toLocaleString('vi-VN')} />
                                    </div>

                                    {/* Items */}
                                    {ocr.items && Array.isArray(ocr.items) && ocr.items.length > 0 && (
                                        <div className="detail-items">
                                            <div className="detail-items__title">Chi tiết mục</div>
                                            {ocr.items.map((item, i) => (
                                                <div key={i} className="detail-items__row">
                                                    <span>{item.name || item.description || `Mục ${i + 1}`}</span>
                                                    <span className="detail-items__amount">{formatMoney(item.amount || item.total)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Tab: Chính sách ── */}
                            {activeTab === 'policy' && (
                                <div className="modal-tab-content">
                                    <div className={`detail-policy-banner detail-policy-banner--${policyStatus}`}>
                                        {policyStatus === 'valid' ? (
                                            <CheckCircle size={20} className="detail-policy-banner__icon--valid" />
                                        ) : (
                                            <AlertTriangle size={20} className="detail-policy-banner__icon--warn" />
                                        )}
                                        <div>
                                            <div className="detail-policy-banner__title">
                                                {policyStatus === 'valid' ? 'Hợp lệ' :
                                                    policyStatus === 'over_budget' ? 'Vượt hạn mức' : 'Không hợp lệ'}
                                            </div>
                                            <div className="detail-policy-banner__message">{policy.message}</div>
                                        </div>
                                    </div>

                                    {/* Reject reason */}
                                    {expense.status === 'REJECTED' && expense.rejectReason && (
                                        <div style={{
                                            padding: '12px 16px', borderRadius: 10,
                                            background: 'var(--color-danger-bg)',
                                            border: '1px solid rgba(248,113,113,0.2)',
                                            marginBottom: 16,
                                            display: 'flex', gap: 10, alignItems: 'flex-start',
                                        }}>
                                            <XCircle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-danger)' }}>Lý do từ chối</div>
                                                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{expense.rejectReason}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* User note */}
                                    {expense.userNote && (
                                        <div style={{
                                            padding: '12px 16px', borderRadius: 10,
                                            background: 'rgba(59,130,246,0.08)',
                                            border: '1px solid rgba(59,130,246,0.15)',
                                            marginBottom: 16,
                                            display: 'flex', gap: 10, alignItems: 'flex-start',
                                        }}>
                                            <FileText size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: '#3b82f6' }}>Ghi chú nhân viên</div>
                                                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{expense.userNote}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Appeal note */}
                                    {expense.appealNote && (
                                        <div style={{
                                            padding: '12px 16px', borderRadius: 10,
                                            background: 'rgba(245,158,11,0.08)',
                                            border: '1px solid rgba(245,158,11,0.15)',
                                            marginBottom: 16,
                                            display: 'flex', gap: 10, alignItems: 'flex-start',
                                        }}>
                                            <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: '#f59e0b' }}>Khiếu nại</div>
                                                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{expense.appealNote}</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="detail-grid">
                                        <DetailRow icon={ClipboardCheck} label="Cấp bậc" value={policy.details?.role_label} />
                                        <DetailRow icon={CreditCard} label="Hạn mức/ngày" value={formatMoney(policy.details?.daily_limit)} />
                                        <DetailRow icon={CreditCard} label="Số tiền thực tế" value={formatMoney(policy.details?.actual_amount)} highlight />
                                    </div>

                                    {/* Policy checks */}
                                    {policy.checks && Array.isArray(policy.checks) && (
                                        <div className="detail-checks">
                                            <div className="detail-items__title">Kiểm tra chi tiết</div>
                                            {policy.checks.map((check, i) => (
                                                <div key={i} className="detail-check-row">
                                                    {check.passed ? (
                                                        <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                                                    ) : (
                                                        <XCircle size={14} style={{ color: 'var(--color-danger)' }} />
                                                    )}
                                                    <span>{check.name || check.rule}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Tab: Blockchain ── */}
                            {activeTab === 'blockchain' && (
                                <div className="modal-tab-content">
                                    {expense.txHash ? (
                                        <>
                                            <div className="detail-blockchain-status">
                                                <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
                                                <span>Đã ghi nhận on-chain</span>
                                            </div>

                                            <div className="detail-grid">
                                                <div className="detail-row detail-row--full">
                                                    <div className="detail-row__label">
                                                        <Hash size={14} /> TX Hash
                                                    </div>
                                                    <div className="detail-row__value detail-row__value--mono">
                                                        {expense.txHash}
                                                    </div>
                                                </div>
                                                <DetailRow icon={Link2} label="On-chain Expense ID" value={`#${expense.blockchainId}`} />
                                                <DetailRow icon={Hash} label="Invoice Hash" value={expense.invoiceHash} mono />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="empty-state" style={{ padding: 32 }}>
                                            <div className="empty-state__icon"><Link2 size={40} strokeWidth={1} /></div>
                                            <div className="empty-state__text">Chưa ghi nhận trên blockchain</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function DetailRow({ icon: Icon, label, value, highlight, mono }) {
    return (
        <div className="detail-row">
            <div className="detail-row__label">
                <Icon size={14} /> {label}
            </div>
            <div className={`detail-row__value ${highlight ? 'detail-row__value--highlight' : ''} ${mono ? 'detail-row__value--mono' : ''}`}>
                {value || '—'}
            </div>
        </div>
    );
}
