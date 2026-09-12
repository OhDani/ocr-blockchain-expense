/**
 * UploadPage.jsx — Upload hóa đơn + xem kết quả
 */

import { useState, useRef, useEffect } from 'react';
import { tripAPI, expenseAPI } from '../../api/client.js';
import {
    Upload, FileImage, RefreshCw, Rocket, CheckCircle,
    ClipboardCheck, Bot, Link2, AlertTriangle, XCircle,
    Store, Hash, Calendar, Receipt, CreditCard, FileText,
    PenLine,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import './UploadPage.css';

export default function UploadPage() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [tripId, setTripId] = useState('');
    const [trips, setTrips] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [userNote, setUserNote] = useState('');
    const inputRef = useRef(null);
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'manual'
    const [manualForm, setManualForm] = useState({
        tripId: '', amount: '', invoiceType: 'food_drink',
        storeName: '', taxId: '', invoiceDate: '', userNote: '',
    });
    const [manualSubmitting, setManualSubmitting] = useState(false);
    const [manualResult, setManualResult] = useState(null);

    useEffect(() => {
        tripAPI.list().then((res) => setTrips(res.data)).catch(() => { });
    }, []);

    const handleFile = (f) => {
        if (!f) return;
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(f.type)) {
            setError('Chỉ hỗ trợ ảnh JPG, PNG, WEBP');
            return;
        }
        if (f.size > 5 * 1024 * 1024) {
            setError('File quá lớn (tối đa 5MB)');
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
        setError('');
        setResult(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('invoice', file);
            if (tripId) formData.append('tripId', tripId);
            if (userNote.trim()) formData.append('userNote', userNote.trim());

            const res = await expenseAPI.upload(formData);
            setResult(res.data);
            toast('Hóa đơn đã được xử lý thành công!', 'success');
        } catch (err) {
            setError(err.message || 'Upload thất bại');
            toast(err.message || 'Upload thất bại', 'error');
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setFile(null);
        setPreview(null);
        setResult(null);
        setError('');
        setTripId('');
        setUserNote('');
    };

    const formatMoney = (val) => {
        if (!val && val !== 0) return '—';
        return Number(val).toLocaleString('vi-VN') + 'đ';
    };

    // Extract OCR fields for display
    const ocrData = result?.ocr?.data || {};
    const policyStatus = result?.policy?.status?.toLowerCase();

    const INVOICE_TYPES = [
        { value: 'food_drink', label: 'Ăn uống' },
        { value: 'transport', label: 'Di chuyển' },
        { value: 'hotel', label: 'Khách sạn' },
        { value: 'office_supplies', label: 'Văn phòng phẩm' },
        { value: 'fuel', label: 'Xăng dầu' },
        { value: 'telecom', label: 'Viễn thông' },
        { value: 'other', label: 'Khác' },
    ];

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setManualSubmitting(true);
        setError('');
        try {
            const res = await expenseAPI.manual(manualForm);
            setManualResult(res.data);
            toast('Hóa đơn đã được lưu thành công!', 'success');
        } catch (err) {
            setError(err.message || 'Lỗi tạo hóa đơn');
            toast(err.message || 'Lỗi', 'error');
        } finally {
            setManualSubmitting(false);
        }
    };

    const resetManual = () => {
        setManualForm({ tripId: '', amount: '', invoiceType: 'food_drink', storeName: '', taxId: '', invoiceDate: '', userNote: '' });
        setManualResult(null);
        setError('');
    };

    return (
        <div className="upload-page">
            <div className="page-header">
                <h1>Upload hóa đơn</h1>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)', width: 'fit-content' }}>
                <button onClick={() => setActiveTab('upload')}
                    style={{
                        padding: '8px 20px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: activeTab === 'upload' ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: activeTab === 'upload' ? 'white' : 'var(--color-text-secondary)',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <Upload size={14} /> Upload ảnh
                </button>
                <button onClick={() => setActiveTab('manual')}
                    style={{
                        padding: '8px 20px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: activeTab === 'manual' ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: activeTab === 'manual' ? 'white' : 'var(--color-text-secondary)',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <PenLine size={14} /> Nhập tay
                </button>
            </div>

            {activeTab === 'manual' ? (
                /* ══════ FORM NHẬP TAY ══════ */
                <div className="card" style={{ maxWidth: 600 }}>
                    {manualResult ? (
                        <div style={{ textAlign: 'center', padding: 24 }}>
                            <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: 16 }} />
                            <h3 style={{ marginBottom: 8 }}>Hóa đơn đã được lưu!</h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
                                Trạng thái: <span className={`badge ${manualResult.expense?.status === 'PENDING' ? 'badge-warning' : 'badge-success'}`}>
                                    {manualResult.expense?.status === 'PENDING' ? 'Chờ duyệt' : 'Hoàn ứng'}
                                </span>
                            </p>
                            <button className="btn btn-primary" onClick={resetManual}>Nhập hóa đơn khác</button>
                        </div>
                    ) : (
                        <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}><PenLine size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Nhập thông tin hóa đơn</h3>
                            {error && <div style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{error}</div>}
                            <div className="form-group">
                                <label>Chuyến công tác *</label>
                                <select className="form-input" required value={manualForm.tripId} onChange={(e) => setManualForm({ ...manualForm, tripId: e.target.value })}>
                                    <option value="">-- Chọn chuyến --</option>
                                    {trips.map(t => <option key={t.id} value={t.id}>{t.destination} ({new Date(t.startDate).toLocaleDateString('vi-VN')})</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label>Loại hóa đơn *</label>
                                    <select className="form-input" value={manualForm.invoiceType} onChange={(e) => setManualForm({ ...manualForm, invoiceType: e.target.value })}>
                                        {INVOICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Số tiền (VNĐ) *</label>
                                    <input className="form-input" required placeholder="150.000"
                                        value={manualForm.amount ? Number(manualForm.amount).toLocaleString('vi-VN') : ''}
                                        onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value.replace(/\D/g, '') })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label>Tên cửa hàng</label>
                                    <input className="form-input" placeholder="VD: Grab, Highlands Coffee" value={manualForm.storeName}
                                        onChange={(e) => setManualForm({ ...manualForm, storeName: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Mã số thuế</label>
                                    <input className="form-input" placeholder="VD: 0312345678" value={manualForm.taxId}
                                        onChange={(e) => setManualForm({ ...manualForm, taxId: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label>Ngày hóa đơn</label>
                                    <input className="form-input" type="date" value={manualForm.invoiceDate}
                                        onChange={(e) => setManualForm({ ...manualForm, invoiceDate: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Ghi chú</label>
                                    <input className="form-input" placeholder="Thông tin thêm" value={manualForm.userNote}
                                        onChange={(e) => setManualForm({ ...manualForm, userNote: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={manualSubmitting} style={{ marginTop: 8 }}>
                                {manualSubmitting ? (
                                    <><span className="spinner" style={{ width: 16, height: 16 }} /> Đang xử lý...</>
                                ) : (
                                    <><Rocket size={16} /> Lưu hóa đơn</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            ) : (
            /* ══════ UPLOAD ẢNH (giữ nguyên) ══════ */
            <div className="upload-grid">
                {/* Cột trái: Upload + Preview */}
                <div className="upload-left">
                    {!result ? (
                        <>
                            <div
                                className={`upload-zone ${dragActive ? 'upload-zone--active' : ''} ${preview ? 'upload-zone--has-file' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={handleDrop}
                                onClick={() => !preview && inputRef.current?.click()}
                            >
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleFile(e.target.files[0])}
                                />
                                {preview ? (
                                    <div className="upload-preview">
                                        <img src={preview} alt="Hóa đơn" />
                                        <button className="btn btn-secondary btn-sm upload-change" onClick={(e) => { e.stopPropagation(); resetForm(); }}>
                                            <RefreshCw size={14} /> Đổi ảnh
                                        </button>
                                    </div>
                                ) : (
                                    <div className="upload-placeholder">
                                        <span className="upload-placeholder__icon">
                                            <FileImage size={48} strokeWidth={1} />
                                        </span>
                                        <p className="upload-placeholder__text">
                                            Kéo thả ảnh hóa đơn vào đây
                                        </p>
                                        <p className="upload-placeholder__sub">
                                            hoặc bấm để chọn file (JPG, PNG, WEBP — tối đa 5MB)
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginTop: 16 }}>
                                <label>Chuyến công tác <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                                <select
                                    className="form-input"
                                    value={tripId}
                                    onChange={(e) => setTripId(e.target.value)}
                                    required
                                >
                                    <option value="">— Chọn chuyến công tác —</option>
                                    {trips.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.destination} ({new Date(t.startDate).toLocaleDateString('vi-VN')})
                                        </option>
                                    ))}
                                </select>
                                {!tripId && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Vui lòng chọn chuyến công tác trước khi upload</div>}
                            </div>

                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label>Ghi chú <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(tùy chọn)</span></label>
                                <textarea
                                    className="form-input"
                                    placeholder="VD: Tiếp khách đối tác ABC, chi phí ăn trưa 3 người"
                                    value={userNote}
                                    onChange={(e) => setUserNote(e.target.value)}
                                    rows={2}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            {error && <div className="upload-error">{error}</div>}

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: 16, justifyContent: 'center', padding: '12px 20px' }}
                                onClick={handleUpload}
                                disabled={!file || !tripId || uploading}
                            >
                                {uploading ? (
                                    <>
                                        <span className="spinner" style={{ width: 16, height: 16 }} />
                                        Đang xử lý AI OCR...
                                    </>
                                ) : (
                                    <><Rocket size={16} /> Upload & Xử lý</>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="upload-success">
                            <div className="upload-success__icon"><CheckCircle size={48} strokeWidth={1.5} /></div>
                            <h3>Hóa đơn đã được xử lý!</h3>
                            <p>AI xử lý trong {result.ocr?.processingTime?.toFixed(1)}s</p>
                            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={resetForm}>
                                <Upload size={16} /> Upload hóa đơn mới
                            </button>
                        </div>
                    )}
                </div>

                {/* Cột phải: Kết quả */}
                <div className="upload-right">
                    {result ? (
                        <div className="result-cards">
                            {/* ── Card 1: Kết quả kiểm tra ── */}
                            <div className={`card result-policy result-policy--${policyStatus}`}>
                                <div className="result-policy__header">
                                    {policyStatus === 'valid' ? (
                                        <CheckCircle size={20} className="result-policy__icon result-policy__icon--valid" />
                                    ) : (
                                        <XCircle size={20} className="result-policy__icon result-policy__icon--invalid" />
                                    )}
                                    <div>
                                        <div className="result-policy__title">Kết quả kiểm tra</div>
                                        <div className="result-policy__message">{result.policy?.message}</div>
                                    </div>
                                </div>
                                <div className="result-policy__grid">
                                    <div className="result-policy__item">
                                        <span className="result-policy__label">Cấp bậc</span>
                                        <span className="result-policy__value">{result.policy?.details?.role_label || '—'}</span>
                                    </div>
                                    <div className="result-policy__item">
                                        <span className="result-policy__label">Hạn mức/ngày</span>
                                        <span className="result-policy__value">{formatMoney(result.policy?.details?.daily_limit)}</span>
                                    </div>
                                    <div className="result-policy__item">
                                        <span className="result-policy__label">Số tiền thực tế</span>
                                        <span className="result-policy__value" style={{ fontWeight: 700, color: policyStatus === 'valid' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                            {formatMoney(result.policy?.details?.actual_amount)}
                                        </span>
                                    </div>
                                    <div className="result-policy__item">
                                        <span className="result-policy__label">Trạng thái</span>
                                        <span className={`badge ${policyStatus === 'valid' ? 'badge-success' : policyStatus === 'over_budget' ? 'badge-warning' : 'badge-danger'}`}>
                                            {policyStatus === 'valid' ? 'Hợp lệ' : policyStatus === 'over_budget' ? 'Vượt hạn mức' : 'Không hợp lệ'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Card 2: Thông tin hóa đơn ── */}
                            <div className="card result-invoice">
                                <h3 className="result-invoice__title">
                                    <Receipt size={16} /> Thông tin hóa đơn
                                </h3>

                                {result.ocr?.warnings?.length > 0 && (
                                    <div className="upload-warnings">
                                        {result.ocr.warnings.map((w, i) => (
                                            <div key={i} className="upload-warning">
                                                <AlertTriangle size={12} /> {w}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="result-invoice__grid">
                                    <div className="result-invoice__row">
                                        <div className="result-invoice__field">
                                            <Store size={14} className="result-invoice__field-icon" />
                                            <span className="result-invoice__field-label">Cửa hàng</span>
                                        </div>
                                        <span className="result-invoice__field-value">{ocrData.store_name || ocrData.seller_name || '—'}</span>
                                    </div>

                                    <div className="result-invoice__row">
                                        <div className="result-invoice__field">
                                            <Hash size={14} className="result-invoice__field-icon" />
                                            <span className="result-invoice__field-label">Mã số thuế</span>
                                        </div>
                                        <span className="result-invoice__field-value">{ocrData.tax_id || ocrData.tax_code || '—'}</span>
                                    </div>

                                    <div className="result-invoice__row">
                                        <div className="result-invoice__field">
                                            <CreditCard size={14} className="result-invoice__field-icon" />
                                            <span className="result-invoice__field-label">Tổng tiền</span>
                                        </div>
                                        <span className="result-invoice__field-value result-invoice__field-value--highlight">
                                            {formatMoney(ocrData.total_amount || ocrData.grand_total)}
                                        </span>
                                    </div>

                                    <div className="result-invoice__row">
                                        <div className="result-invoice__field">
                                            <Calendar size={14} className="result-invoice__field-icon" />
                                            <span className="result-invoice__field-label">Ngày hóa đơn</span>
                                        </div>
                                        <span className="result-invoice__field-value">{ocrData.date || ocrData.invoice_date || '—'}</span>
                                    </div>

                                    <div className="result-invoice__row">
                                        <div className="result-invoice__field">
                                            <FileText size={14} className="result-invoice__field-icon" />
                                            <span className="result-invoice__field-label">Loại</span>
                                        </div>
                                        <span className="result-invoice__field-value">{ocrData.invoice_type || ocrData.type || '—'}</span>
                                    </div>
                                </div>

                                {/* Chi tiết items nếu có */}
                                {ocrData.items && Array.isArray(ocrData.items) && ocrData.items.length > 0 && (
                                    <div className="result-invoice__items">
                                        <div className="result-invoice__items-title">Chi tiết mục</div>
                                        {ocrData.items.map((item, i) => (
                                            <div key={i} className="result-invoice__item-row">
                                                <span className="result-invoice__item-name">{item.name || item.description || `Mục ${i + 1}`}</span>
                                                <span className="result-invoice__item-amount">{formatMoney(item.amount || item.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Card 3: Blockchain ── */}
                            {result.blockchain && (
                                <div className="card result-blockchain">
                                    <h3 className="result-invoice__title">
                                        <Link2 size={16} /> Trạng thái Blockchain
                                    </h3>
                                    <div className="result-blockchain__status">
                                        <CheckCircle size={16} className="result-blockchain__check" />
                                        <span>Đã ghi nhận on-chain</span>
                                    </div>
                                    <div className="result-blockchain__details">
                                        <div className="result-blockchain__row">
                                            <span className="result-blockchain__label">TX Hash</span>
                                            <a href={`https://sepolia.etherscan.io/tx/${result.blockchain.txHash}`} target="_blank" rel="noopener noreferrer"
                                                className="result-blockchain__hash" style={{ color: '#2b9e9e', textDecoration: 'none' }}>
                                                {result.blockchain.txHash} ↗
                                            </a>
                                        </div>
                                        <div className="result-blockchain__row">
                                            <span className="result-blockchain__label">Expense ID</span>
                                            <span className="result-blockchain__value">#{result.blockchain.expenseId}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card">
                            <div className="empty-state">
                                <div className="empty-state__icon"><Bot size={48} strokeWidth={1} /></div>
                                <div className="empty-state__text">
                                    Upload hóa đơn để AI tự động đọc và đối chiếu chính sách
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}
        </div>
    );
}
