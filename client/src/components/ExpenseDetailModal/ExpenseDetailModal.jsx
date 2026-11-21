/**
 * ExpenseDetailModal.jsx — Modal chi tiết chi phí (AI, Policy, Blockchain)
 * Đọc data từ các bảng con: OcrResult, PolicyCheck, FraudAnalysis, BlockchainTx, ExpenseReview
 */

import { useState, useEffect } from 'react';
import { expenseAPI, API_BASE } from '../../api/client.js';
import {
    X, ClipboardCheck, Link2, Store, Hash,
    Calendar, CreditCard, FileText, CheckCircle, XCircle,
    AlertTriangle, Clock, Loader, ShieldAlert, Shield,
    ShieldCheck, ZoomIn, Copy, Check, Zap, ExternalLink,
} from 'lucide-react';
import ImagePreviewModal from '../ImagePreviewModal/ImagePreviewModal.jsx';
import { getTxUrl } from '../../utils/explorer.js';
import { getCategoryLabel } from '../../utils/categoryHelper.js';
import './ExpenseDetailModal.css';

const STATUS_MAP = {
    PENDING: { label: 'Chờ duyệt', className: 'badge-warning', icon: Clock },
    APPROVED: { label: 'Đã duyệt', className: 'badge-info', icon: CheckCircle },
    REJECTED: { label: 'Từ chối', className: 'badge-danger', icon: XCircle },
    REIMBURSED: { label: 'Đã hoàn ứng', className: 'badge-success', icon: CheckCircle },
};

const CHECK_TRANSLATIONS = {
    budget_ok: 'Ngân sách chuyến đi',
    policy_ok: 'Hạn mức theo hóa đơn',
    daily_ok: 'Hạn mức theo ngày',
    daily_limit_ok: 'Hạn mức theo ngày',
    per_trip_ok: 'Hạn mức theo chuyến',
    trip_limit_ok: 'Hạn mức theo chuyến',
    tax_id_ok: 'Mã số thuế doanh nghiệp',
    per_invoice_limit_ok: 'Hạn mức theo hóa đơn',
    duplicate_ok: 'Kiểm tra không trùng lặp hóa đơn',
    date_ok: 'Thời gian trong kỳ công tác',
    category_ok: 'Hạng mục chi tiêu hợp lệ',
    invoice_type_ok: 'Loại hóa đơn được chấp nhận',
};

function translateFraudFlag(flag) {
    if (!flag) return '';
    const raw = String(flag).trim();

    const DICT = {
        'manual_entry': 'Hóa đơn nhập thủ công (không có ảnh gốc để AI quét OCR)',
        'duplicate_invoice': 'Phát hiện hóa đơn trùng lặp với hóa đơn đã có trong hệ thống',
        'duplicate_check': 'Trùng lặp với hóa đơn khác trong hệ thống',
        'high_amount': 'Số tiền chi tiêu cao bất thường so với mức thông thường',
        'round_number': 'Số tiền được làm tròn chẵn bất thường',
        'rounded_amount': 'Số tiền dịch vụ được làm tròn chẵn bất thường',
        'rounded_taxi_amount': 'Số tiền cước di chuyển/taxi được làm tròn chẵn bất thường',
        'weekend_expense': 'Hóa đơn phát sinh vào ngày nghỉ cuối tuần ngoài lịch trình',
        'night_expense': 'Hóa đơn dịch vụ xuất vào khung giờ đêm muộn (1h - 5h sáng)',
        'night_time_restaurant': 'Hóa đơn ăn uống/nhà hàng xuất vào ban đêm (1h - 5h sáng)',
        'unusual_time': 'Thời gian xuất hóa đơn bất thường',
        'foreign_currency': 'Đơn vị tiền tệ nước ngoài hoặc quy đổi chưa được xác thực',
        'tax_id_mismatch': 'Mã số thuế không khớp với cơ sở dữ liệu doanh nghiệp',
        'photoshop_edited': 'Phát hiện dấu hiệu chỉnh sửa hình ảnh bằng phần mềm đồ họa',
        'ai_generated': 'Ảnh hóa đơn có dấu hiệu được tạo giả bằng AI',
        'font_inconsistency': 'Kiểu chữ (font) trên hóa đơn không đồng nhất, nghi ngờ chắp vá số tiền',
        'pixel_distortion': 'Vùng số tiền có dấu hiệu sai lệch cấu trúc pixel so với nền giấy',
    };

    const lower = raw.toLowerCase().replace(/\s+/g, '_');
    if (DICT[lower]) return DICT[lower];

    let content = raw;
    let prefix = '';
    if (content.startsWith('[AI]')) {
        prefix = 'AI phân tích: ';
        content = content.replace(/^\[AI\]\s*/, '');
    } else if (content.startsWith('[Rule]')) {
        prefix = 'Quy tắc nghiệp vụ: ';
        content = content.replace(/^\[Rule\]\s*/, '');
    }

    // Dịch các câu nhận định cụ thể của AI Gemini
    if (/inconsistent unit of measurement/i.test(content)) {
        if (/cigarette|thuốc/i.test(content)) {
            return prefix + "Đơn vị tính bất hợp lý: sử dụng đơn vị 'ly' cho cả các mặt hàng thuốc lá ('Thuốc Mèo', 'Thuốc Jet') thay vì 'gói' hoặc 'bao'";
        }
        return prefix + "Đơn vị tính không đồng nhất hoặc không phù hợp với các mặt hàng trên hóa đơn";
    }
    if (/cigarette|tobacco|cigar/i.test(content) && /alcohol|beer|wine|liquor|drink|prohibited|not allowed|personal/i.test(content)) {
        return prefix + "Phát hiện mặt hàng không thuộc diện thanh toán công tác phí doanh nghiệp (thuốc lá, đồ uống có cồn)";
    }
    if (/photoshop|tamper|manipulat/i.test(content)) {
        return prefix + 'Phát hiện dấu hiệu chỉnh sửa ảnh (pixel lệch, màu không đều hoặc can thiệp đồ họa)';
    }
    if (/synthetic|ai[- ]generated|dall[- ]e|hallucinat/i.test(content)) {
        return prefix + 'Ảnh có dấu hiệu tạo giả bằng AI (bố cục nhân tạo, ký tự biến dạng, thiếu nếp gấp tự nhiên)';
    }
    if (/font inconsistency|mismatched font/i.test(content)) {
        return prefix + 'Kiểu chữ (font) trên hóa đơn không đồng nhất, có dấu hiệu chắp vá số tiền';
    }
    if (/pixel artifact|blurry total/i.test(content)) {
        return prefix + 'Vùng số tiền bị mờ hoặc có dấu hiệu làm mờ viền nhân tạo';
    }
    if (/duplicate|same invoice/i.test(content)) {
        return prefix + 'Trùng số hóa đơn hoặc thông tin với bản ghi đã tồn tại';
    }
    if (/outside trip|out of (the )?date range/i.test(content)) {
        return prefix + 'Ngày trên hóa đơn nằm ngoài thời gian công tác đã được duyệt';
    }
    if (/late night|unusual hour|night/i.test(content)) {
        return prefix + 'Thời gian xuất hóa đơn vào đêm khuya bất thường';
    }
    if (/rounded amount|round number/i.test(content)) {
        return prefix + 'Số tiền thanh toán được làm tròn chẵn bất thường';
    }
    if (/arithmetic|calculation|sum of items|total mismatch/i.test(content)) {
        return prefix + 'Tổng tiền chi tiết các món không khớp với tổng thanh toán trên hóa đơn';
    }

    // Dịch các từ khóa tiếng Anh thường gặp nếu câu còn sót tiếng Anh
    if (/\b(unit of measurement|cigarettes?|is used for|appropriate unit|pack or stick|glass\/cup)\b/i.test(content)) {
        return prefix + content
            .replace(/Inconsistent unit of measurement/gi, 'Đơn vị tính không hợp lý')
            .replace(/is used for all items/gi, 'áp dụng cho tất cả mặt hàng')
            .replace(/including cigarettes/gi, 'bao gồm cả thuốc lá')
            .replace(/where 'pack' or 'stick' would be the appropriate unit/gi, "(trong khi 'bao' hoặc 'gói' mới là đơn vị phù hợp)")
            .replace(/'ly' - glass\/cup/gi, "'ly'")
            .replace(/appropriate unit/gi, 'đơn vị phù hợp');
    }

    return prefix + content;
}

export default function ExpenseDetailModal({ expenseId, onClose }) {
    const [expense, setExpense] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('info');
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    const handleCopy = (text, fieldName) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

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
    const isBlockchainSuccess = blockchain?.status === 'SUCCESS' || (Boolean(blockchain?.txHash) && blockchain.txHash !== 'FAILED' && blockchain.status !== 'FAILED');
    const isBlockchainFailed = blockchain?.status === 'FAILED' || blockchain?.txHash === 'FAILED';

    // Ảnh hóa đơn từ DB (cần token trong query param vì img src không gửi header)
    const token = localStorage.getItem('token');
    const imageUrl = expense?.id ? `${API_BASE}/expenses/${expense.id}/image?token=${token}` : null;

    const tabs = [
        { id: 'info', label: 'Hóa đơn', icon: FileText },
        { id: 'policy', label: 'Chính sách', icon: ClipboardCheck },
        { id: 'fraud', label: 'Rủi ro', icon: ShieldAlert },
        { id: 'blockchain', label: 'Đối soát Blockchain', icon: Link2 },
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
                                                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                    <ZoomIn size={12} /> Nhấn để phóng to / xoay ảnh
                                                </div>
                                            </div>
                                        )}

                                        <div className="detail-grid">
                                            <DetailRow icon={Store} label="Cửa hàng" value={ocr.store_name || ocr.seller_name} />
                                            <DetailRow icon={Hash} label="Mã số thuế" value={ocr.tax_id || ocr.tax_code} />
                                            <DetailRow icon={CreditCard} label="Tổng tiền" value={formatMoney(expense.amount)} highlight />
                                            <DetailRow icon={Calendar} label="Ngày hóa đơn" value={ocr.date || ocr.invoice_date} />
                                            <DetailRow icon={FileText} label="Loại" value={getCategoryLabel(expense.invoiceType)} />
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

                                        {/* Duplicate Invoice Alert */}
                                        {policy.details?.duplicate_info && (
                                            <div style={{
                                                padding: '12px 16px', borderRadius: 10,
                                                background: 'var(--color-danger-bg)',
                                                border: '1px solid rgba(248,113,113,0.3)',
                                                marginBottom: 16,
                                                display: 'flex', gap: 10, alignItems: 'flex-start',
                                            }}>
                                                <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-danger)' }}>
                                                        Phát hiện hóa đơn trùng lặp trong hệ thống
                                                    </div>
                                                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                                                        Trùng khớp với <strong>Hóa đơn #{policy.details.duplicate_info.targetShortId}</strong> do nhân viên <strong>{policy.details.duplicate_info.employeeName}</strong> nộp ngày {policy.details.duplicate_info.date} (Số tiền: {Number(policy.details.duplicate_info.amount).toLocaleString('vi-VN')}đ).
                                                    </div>
                                                </div>
                                            </div>
                                        )}

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
                                                        <span>{CHECK_TRANSLATIONS[key] || key}</span>
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
                                                            Điểm rủi ro AI ({fraud.fraudScore}/100)
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                                            {fraud.fraudScore > 40 ? 'Nguy cơ cao — Cần kiểm tra kỹ trước khi phê duyệt!' :
                                                                fraud.fraudScore > 0 ? 'Có dấu hiệu lưu ý — Hãy đối chiếu thêm thông tin' :
                                                                    'Hóa đơn an toàn — Không phát hiện dấu hiệu giả mạo hay chỉnh sửa'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {fraud.fraudFlags && Array.isArray(fraud.fraudFlags) && fraud.fraudFlags.length > 0 ? (
                                                    <div className="detail-items">
                                                        <div className="detail-items__title" style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <AlertTriangle size={14} /> Cảnh báo chi tiết ({fraud.fraudFlags.length})
                                                        </div>
                                                        {fraud.fraudFlags.map((flag, idx) => (
                                                            <div key={idx} style={{
                                                                padding: '10px 14px', background: 'rgba(239, 68, 68, 0.05)',
                                                                borderLeft: '3px solid var(--color-danger)', borderRadius: '0 8px 8px 0',
                                                                marginBottom: '8px', fontSize: '13px', color: 'var(--color-text)',
                                                                lineHeight: '1.5'
                                                            }}>
                                                                {translateFraudFlag(flag)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                                                        <CheckCircle size={32} style={{ color: '#10b981', opacity: 0.7, marginBottom: '8px' }} />
                                                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>AI và hệ thống kiểm tra không phát hiện dấu hiệu bất thường nào.</div>
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

                                {/* ── Tab: Đối soát Blockchain ── */}
                                {activeTab === 'blockchain' && (
                                    <div className="modal-tab-content">
                                        {isBlockchainSuccess ? (
                                            <>
                                                <div className="detail-blockchain-status">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <CheckCircle size={20} style={{ color: '#065f46' }} />
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: '#065f46', fontSize: 14 }}>
                                                                Đã đối soát & Hoàn ứng On-Chain thành công
                                                            </div>
                                                            <div style={{ fontSize: 12, color: 'rgba(6, 95, 70, 0.8)', marginTop: 2 }}>
                                                                Mạng Linea Sepolia (Layer 2 zkEVM) • Token vVND
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="badge badge-success" style={{ fontSize: 11 }}>
                                                        Bất biến (Immutable)
                                                    </span>
                                                </div>

                                                <div className="detail-grid">
                                                    <div className="detail-row detail-row--full" style={{ padding: '12px 0' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                                            <div className="detail-row__label">
                                                                <Hash size={14} /> Mã giao dịch (Transaction Hash)
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                <button
                                                                    type="button"
                                                                    className="blockchain-copy-btn"
                                                                    onClick={() => handleCopy(blockchain.txHash, 'tx')}
                                                                >
                                                                    {copiedField === 'tx' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                                                    <span>{copiedField === 'tx' ? 'Đã sao chép' : 'Sao chép'}</span>
                                                                </button>
                                                                <a
                                                                    href={getTxUrl(blockchain.txHash)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="blockchain-copy-btn"
                                                                    style={{ color: '#2b9e9e', textDecoration: 'none', fontWeight: 600 }}
                                                                >
                                                                    <ExternalLink size={12} /> Lineascan ↗
                                                                </a>
                                                            </div>
                                                        </div>
                                                        <div className="detail-row__value detail-row__value--mono" style={{ marginTop: 4, width: '100%', textAlign: 'left' }}>
                                                            {blockchain.txHash}
                                                        </div>
                                                    </div>

                                                    <DetailRow
                                                        icon={Link2}
                                                        label="Mã phiếu Smart Contract"
                                                        value={blockchain.blockchainId != null ? `#${blockchain.blockchainId}` : '—'}
                                                        subtext="Mã định danh phiếu chi lưu trong Hợp đồng thông minh"
                                                    />

                                                    <div className="detail-row detail-row--full" style={{ padding: '12px 0' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                                            <div className="detail-row__label">
                                                                <ShieldCheck size={14} /> Dấu vân tay số hóa đơn (SHA-256 Hash)
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="blockchain-copy-btn"
                                                                onClick={() => handleCopy(expense.invoiceHash, 'hash')}
                                                            >
                                                                {copiedField === 'hash' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                                                <span>{copiedField === 'hash' ? 'Đã sao chép' : 'Sao chép'}</span>
                                                            </button>
                                                        </div>
                                                        <div className="detail-row__value detail-row__value--mono" style={{ marginTop: 4, width: '100%', textAlign: 'left' }}>
                                                            {expense.invoiceHash || '—'}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                            Mã băm mật mã học chứng minh hóa đơn không bị chỉnh sửa sau khi lưu
                                                        </div>
                                                    </div>

                                                    <DetailRow
                                                        icon={CreditCard}
                                                        label="Số tiền giải ngân"
                                                        value={`${formatMoney(expense.amount)}`}
                                                        highlight
                                                        subtext="Tương đương token vVND (1 vVND = 1 VNĐ)"
                                                    />

                                                    {blockchain.gasUsed && (
                                                        <DetailRow
                                                            icon={Zap}
                                                            label="Phí giao dịch mạng (Gas Used)"
                                                            value={`${Number(blockchain.gasUsed).toLocaleString('vi-VN')} gas`}
                                                            subtext="Năng lượng mạng Linea Sepolia đã tiêu thụ"
                                                        />
                                                    )}
                                                </div>

                                                <div style={{
                                                    marginTop: 16,
                                                    padding: '14px 16px',
                                                    background: 'rgba(43, 158, 158, 0.08)',
                                                    borderRadius: 10,
                                                    border: '1px solid rgba(43, 158, 158, 0.2)',
                                                    fontSize: 12,
                                                    color: 'var(--color-text)',
                                                    display: 'flex',
                                                    gap: 12,
                                                    alignItems: 'flex-start',
                                                    lineHeight: 1.6
                                                }}>
                                                    <ShieldCheck size={18} style={{ color: '#2b9e9e', flexShrink: 0, marginTop: 2 }} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: '#2b9e9e', marginBottom: 2 }}>
                                                            Bảo chứng minh bạch bằng Smart Contract:
                                                        </div>
                                                        <div>
                                                            Phiếu chi này đã được ghi nhận vào sổ cái <strong>Linea Sepolia (Layer 2 zkEVM)</strong>. Bất kỳ ai có thẩm quyền đều có thể đối chiếu mã băm và giao dịch trên Lineascan Explorer, đảm bảo 100% tính toàn vẹn và chống gian lận số liệu.
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : isBlockchainFailed ? (
                                            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                                                <XCircle size={44} style={{ color: 'var(--color-danger)', opacity: 0.8, marginBottom: 12 }} />
                                                <div style={{ fontWeight: 600, color: 'var(--color-danger)', fontSize: 16, marginBottom: 8 }}>
                                                    Ghi nhận Blockchain chưa hoàn tất
                                                </div>
                                                {blockchain.errorMessage && (
                                                    <div style={{
                                                        fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14,
                                                        background: 'var(--color-danger-bg)', padding: '10px 14px', borderRadius: 8,
                                                        maxWidth: 440, margin: '0 auto 14px'
                                                    }}>
                                                        {blockchain.errorMessage}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                                                    Quản trị viên hoặc Kế toán có thể bấm nút <strong>"Thử lại"</strong> trong danh sách Duyệt chi phí để thực hiện lại lệnh hoàn ứng on-chain.
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="blockchain-empty-box">
                                                <div className="blockchain-empty-icon">
                                                    <Link2 size={26} />
                                                </div>
                                                <h3 className="blockchain-empty-title">
                                                    Chưa ghi nhận trên Blockchain
                                                </h3>
                                                <p className="blockchain-empty-desc">
                                                    {expense.status === 'REJECTED'
                                                        ? 'Hóa đơn này đã bị từ chối phê duyệt nên hệ thống không tạo giao dịch giải ngân trên Blockchain.'
                                                        : expense.status === 'APPROVED'
                                                            ? 'Hóa đơn đã được phê duyệt hợp lệ. Lệnh chuyển token hoàn ứng on-chain sẽ được xử lý khi ví Web3 của nhân viên sẵn sàng.'
                                                            : 'Khi Quản lý hoặc Kế toán phê duyệt hóa đơn này, hệ thống Smart Contract sẽ tự động kích hoạt giao dịch và giải ngân token vVND về ví của nhân viên.'
                                                    }
                                                </p>
                                                <div className="blockchain-empty-badge">
                                                    <Shield size={13} style={{ color: '#2b9e9e' }} />
                                                    <span>Tự động đối soát on-chain qua Hợp đồng thông minh</span>
                                                </div>
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

function DetailRow({ icon: Icon, label, value, highlight, mono, subtext }) {
    return (
        <div className="detail-row">
            <div className="detail-row__label">
                <Icon size={14} /> {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span className={`detail-row__value ${highlight ? 'detail-row__value--highlight' : ''} ${mono ? 'detail-row__value--mono' : ''}`}>
                    {value || '—'}
                </span>
                {subtext && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{subtext}</span>
                )}
            </div>
        </div>
    );
}
