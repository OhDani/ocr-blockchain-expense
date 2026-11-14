/**
 * ExpenseDetailModal.jsx — Modal chi tiết chi phí (AI, Policy, Blockchain)
 * Đọc data từ các bảng con: OcrResult, PolicyCheck, FraudAnalysis, BlockchainTx, ExpenseReview
 */

import { useState, useEffect } from 'react';
import { expenseAPI, API_BASE } from '../../api/client.js';
import {
    X, Bot, ClipboardCheck, Link2, Image as ImageIcon, Store, Hash,
    Calendar, CreditCard, FileText, CheckCircle, XCircle,
    AlertTriangle, Clock, Loader, ShieldAlert, RotateCcw,
} from 'lucide-react';
import ImagePreviewModal from '../ImagePreviewModal/ImagePreviewModal.jsx';
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
    const [showImagePreview, setShowImagePreview] = useState(false);

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

    // Đọc từ bảng con
    const ocr = expense?.ocrResult?.parsedData || {};
    const policy = expense?.policyCheck || {};
    const fraud = expense?.fraudAnalysis || {};
    const blockchain = expense?.blockchainTx || {};
    const reviews = expense?.reviews || [];
    const policyStatus = policy.status?.toLowerCase();
    const status = STATUS_MAP[expense?.status] || STATUS_MAP.PENDING;
    const StatusIcon = status.icon;

    // Ảnh hóa đơn từ DB (cần token trong query param vì img src không gửi header)
    const token = localStorage.getItem('token');
    const imageUrl = expense?.id ? `${API_BASE}/expenses/${expense.id}/image?token=${token}` : null;

    const tabs = [
        { id: 'info', label: 'Hóa đơn', icon: FileText },
        { id: 'policy', label: 'Chính sách', icon: ClipboardCheck },
        { id: 'fraud', label: 'Rủi ro', icon: ShieldAlert },
        { id: 'blockchain', label: 'Blockchain', icon: Link2 },
    ];

    return (
        <>
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
                                        {/* Invoice image từ DB */}
                                        {expense.imageId && (
                                            <div className="detail-image" style={{ cursor: 'zoom-in' }} onClick={() => setShowImagePreview(true)} title="Nhấn để xem lớn hơn">
                                                <img
                                                    src={imageUrl}
                                                    alt="Hóa đơn"
                                                    crossOrigin="anonymous"
                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                />
                                                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>🔍 Nhấn để phóng to / xoay</div>
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

                                        {/* Review history (reject reasons, appeals) */}
                                        {reviews.filter(r => r.action === 'REJECT').map((r, i) => (
                                            <div key={i} style={{
                                                padding: '12px 16px', borderRadius: 10,
                                                background: 'var(--color-danger-bg)',
                                                border: '1px solid rgba(248,113,113,0.2)',
                                                marginBottom: 16,
                                                display: 'flex', gap: 10, alignItems: 'flex-start',
                                            }}>
                                                <XCircle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-danger)' }}>Lý do từ chối</div>
                                                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{r.reason || '—'}</div>
                                                </div>
                                            </div>
                                        ))}

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

                                        {/* Appeal notes */}
                                        {reviews.filter(r => r.action === 'APPEAL').map((r, i) => (
                                            <div key={i} style={{
                                                padding: '12px 16px', borderRadius: 10,
                                                background: 'rgba(245,158,11,0.08)',
                                                border: '1px solid rgba(245,158,11,0.15)',
                                                marginBottom: 16,
                                                display: 'flex', gap: 10, alignItems: 'flex-start',
                                            }}>
                                                <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#f59e0b' }}>Khiếu nại</div>
                                                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{r.reason}</div>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="detail-grid">
                                            <DetailRow icon={ClipboardCheck} label="Cấp bậc" value={policy.details?.role_label} />
                                            <DetailRow icon={CreditCard} label="Hạn mức/ngày" value={formatMoney(policy.details?.daily_limit)} />
                                            <DetailRow icon={CreditCard} label="Số tiền thực tế" value={formatMoney(policy.details?.actual_amount)} highlight />
                                        </div>

                                        {/* Policy checks */}
                                        {policy.checks && typeof policy.checks === 'object' && (
                                            <div className="detail-checks">
                                                <div className="detail-items__title">Kiểm tra chi tiết</div>
                                                {Object.entries(policy.checks).map(([key, passed], i) => (
                                                    <div key={i} className="detail-check-row">
                                                        {passed ? (
                                                            <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                                                        ) : (
                                                            <XCircle size={14} style={{ color: 'var(--color-danger)' }} />
                                                        )}
                                                        <span>{key === 'budget_ok' ? 'Ngân sách' : key === 'policy_ok' ? 'Hạn mức' : key === 'tax_id_ok' ? 'Mã số thuế' : key}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Tab: Rủi ro (Fraud Detection) ── */}
                                {activeTab === 'fraud' && (
                                    <div className="modal-tab-content">
                                        {fraud.fraudScore !== undefined && fraud.fraudScore !== null ? (
                                            <>
                                                <div style={{
                                                    padding: '16px', borderRadius: '12px', marginBottom: '20px',
                                                    display: 'flex', alignItems: 'center', gap: '16px',
                                                    background: fraud.fraudScore > 40 ? 'var(--color-danger-bg)' : fraud.fraudScore > 0 ? 'var(--color-warning-bg)' : 'rgba(16, 185, 129, 0.08)',
                                                }}>
                                                    <div style={{
                                                        width: '56px', height: '56px', borderRadius: '50%',
                                                        background: fraud.fraudScore > 40 ? 'var(--color-danger)' : fraud.fraudScore > 0 ? 'var(--color-warning)' : '#10b981',
                                                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '20px', fontWeight: 'bold'
                                                    }}>
                                                        {fraud.fraudScore}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-text)' }}>
                                                            Điểm rủi ro (0-100)
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                                            {fraud.fraudScore > 40 ? 'Nguy cơ cao - Cần kiểm tra kỹ!' :
                                                                fraud.fraudScore > 0 ? 'Dấu hiệu đáng ngờ mờ nhạt - Lưu ý' :
                                                                    'Hóa đơn bình thường - Không phát hiện rủi ro giả mạo'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {fraud.fraudFlags && Array.isArray(fraud.fraudFlags) && fraud.fraudFlags.length > 0 ? (
                                                    <div className="detail-items">
                                                        <div className="detail-items__title" style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <AlertTriangle size={14} /> Cảnh báo chi tiết
                                                        </div>
                                                        {fraud.fraudFlags.map((flag, idx) => (
                                                            <div key={idx} style={{
                                                                padding: '10px 14px', background: 'rgba(239, 68, 68, 0.05)',
                                                                borderLeft: '3px solid var(--color-danger)', borderRadius: '0 8px 8px 0',
                                                                marginBottom: '8px', fontSize: '13px', color: 'var(--color-text)',
                                                                lineHeight: '1.5'
                                                            }}>
                                                                {flag}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                                                        <CheckCircle size={32} style={{ color: '#10b981', opacity: 0.5, marginBottom: '12px' }} />
                                                        <div>AI và hệ thống không phát hiện dấu hiệu bất thường nào.</div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="empty-state" style={{ padding: 32 }}>
                                                <div className="empty-state__icon"><ShieldAlert size={40} strokeWidth={1} /></div>
                                                <div className="empty-state__text">Chưa có dữ liệu đánh giá rủi ro</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Tab: Blockchain ── */}
                                {activeTab === 'blockchain' && (
                                    <div className="modal-tab-content">
                                        {blockchain?.txHash ? (
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
                                                            <a href={`https://sepolia.etherscan.io/tx/${blockchain.txHash}`} target="_blank" rel="noopener noreferrer"
                                                                style={{ color: '#2b9e9e', textDecoration: 'none' }}>
                                                                {blockchain.txHash} ↗
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <DetailRow icon={Link2} label="On-chain Expense ID" value={blockchain.blockchainId != null ? `#${blockchain.blockchainId}` : '—'} />
                                                    <DetailRow icon={Hash} label="Invoice Hash" value={expense.invoiceHash} mono />
                                                    {blockchain.gasUsed && (
                                                        <DetailRow icon={CreditCard} label="Gas Used" value={blockchain.gasUsed} />
                                                    )}
                                                </div>
                                            </>
                                        ) : blockchain?.status === 'FAILED' ? (
                                            <div style={{ textAlign: 'center', padding: 32 }}>
                                                <XCircle size={40} style={{ color: 'var(--color-danger)', opacity: 0.7, marginBottom: 12 }} />
                                                <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>
                                                    Ghi blockchain thất bại
                                                </div>
                                                {blockchain.errorMessage && (
                                                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                                                        {blockchain.errorMessage}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                                    Admin có thể bấm nút "Thử lại" trong danh sách duyệt chi phí.
                                                </div>
                                            </div>
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

            {/* Image Preview Modal */}
            {
                showImagePreview && imageUrl && (
                    <ImagePreviewModal
                        src={imageUrl}
                        alt="Hóa đơn"
                        onClose={() => setShowImagePreview(false)}
                    />
                )
            }
        </>);
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
