/**
 * SettingsPage.jsx — Cài đặt tài khoản
 */

import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { userAPI } from '../../api/client.js';
import { User, Mail, Briefcase, Building2, Wallet, Shield, Camera } from 'lucide-react';

const ROLE_LABELS = {
    ADMIN: 'Giám đốc / Quản trị viên',
    MANAGER: 'Trưởng phòng',
    EMPLOYEE: 'Nhân viên',
};

export default function SettingsPage() {
    const { user, updateUser } = useAuth();
    const toast = useToast();
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);

    if (!user) return null;

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast('Chỉ chấp nhận file ảnh', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast('File quá lớn (tối đa 2MB)', 'error');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await userAPI.uploadAvatar(formData);
            // Update user context with new avatar
            if (updateUser) updateUser(res.data);
            toast('Đổi avatar thành công!', 'success');
        } catch (err) {
            toast(err.message || 'Lỗi upload avatar', 'error');
        } finally {
            setUploading(false);
        }
    };

    const avatarSrc = user.avatarUrl ? `http://localhost:3000${user.avatarUrl}` : null;

    return (
        <div>
            <div className="page-header">
                <h1>Cài đặt</h1>
            </div>

            {/* Avatar + Profile */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Thông tin tài khoản</h3>

                {/* Avatar section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                    <div
                        style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: avatarSrc ? `url(${avatarSrc}) center/cover` : 'linear-gradient(135deg, #1a3a5c, #2b9e9e)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: 28, fontWeight: 700,
                            cursor: 'pointer', position: 'relative', overflow: 'hidden',
                            border: '3px solid var(--color-border)',
                        }}
                        onClick={() => fileRef.current?.click()}
                        title="Bấm để đổi avatar"
                    >
                        {!avatarSrc && (user.name?.charAt(0) || '?')}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.5)', padding: '4px 0',
                            display: 'flex', justifyContent: 'center',
                        }}>
                            <Camera size={12} color="white" />
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 18 }}>{user.name}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{user.email}</div>
                        <button
                            className="btn btn-sm btn-secondary"
                            style={{ marginTop: 8 }}
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? 'Đang tải...' : 'Đổi avatar'}
                        </button>
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                    />
                </div>

                <div className="detail-grid">
                    <div className="detail-row">
                        <div className="detail-row__label"><Shield size={14} /> Vai trò</div>
                        <div className="detail-row__value">
                            <span className="badge badge-info">{ROLE_LABELS[user.role] || user.role}</span>
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-row__label"><Building2 size={14} /> Phòng ban</div>
                        <div className="detail-row__value">{user.department || '—'}</div>
                    </div>
                    {user.walletAddress && (
                        <div className="detail-row">
                            <div className="detail-row__label"><Wallet size={14} /> Ví blockchain</div>
                            <div className="detail-row__value" style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                {user.walletAddress}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Policy limits */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Briefcase size={16} /> Hạn mức chi tiêu
                </h3>
                <div className="detail-grid">
                    {user.role === 'ADMIN' && (
                        <>
                            <InfoRow label="Ăn uống / ngày" value="1,000,000đ" />
                            <InfoRow label="Khách sạn / đêm" value="2,000,000đ" />
                            <InfoRow label="Tổng / chuyến" value="20,000,000đ" />
                        </>
                    )}
                    {user.role === 'MANAGER' && (
                        <>
                            <InfoRow label="Ăn uống / ngày" value="700,000đ" />
                            <InfoRow label="Khách sạn / đêm" value="1,500,000đ" />
                            <InfoRow label="Tổng / chuyến" value="15,000,000đ" />
                        </>
                    )}
                    {user.role === 'EMPLOYEE' && (
                        <>
                            <InfoRow label="Ăn uống / ngày" value="500,000đ" />
                            <InfoRow label="Khách sạn / đêm" value="1,000,000đ" />
                            <InfoRow label="Tổng / chuyến" value="10,000,000đ" />
                        </>
                    )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
                    Hạn mức do bộ phận HR quy định. Liên hệ quản lý để thay đổi.
                </p>
            </div>

            {/* System info */}
            <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Hệ thống</h3>
                <div className="detail-grid">
                    <InfoRow label="Phiên bản" value="FlexiTrip v1.0.0" />
                    <InfoRow label="AI Engine" value="Google Gemini Vision 2.0" />
                    <InfoRow label="Blockchain" value="Ethereum (Hardhat local)" />
                    <InfoRow label="Smart Contract" value="ExpenseManager + MockVND" />
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="detail-row">
            <div className="detail-row__label">{label}</div>
            <div className="detail-row__value">{value}</div>
        </div>
    );
}
