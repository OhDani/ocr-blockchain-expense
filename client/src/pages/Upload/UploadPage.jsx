/**
 * UploadPage.jsx — Upload hóa đơn + xem kết quả
 */

import { useState, useRef, useEffect } from 'react';
import { tripAPI, expenseAPI } from '../../api/client.js';
import {
    Upload, FileImage, RefreshCw, Rocket, CheckCircle,
    ClipboardCheck, Bot, Link2, AlertTriangle, XCircle,
    Store, Hash, Calendar, Receipt, CreditCard, FileText,
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

    return (
        <div className="upload-page">
            <div className="page-header">
                <h1>Upload hóa đơn</h1>
            </div>

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
        </div>
    );
}
