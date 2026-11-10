/**
 * SettingsPage.jsx — Cài đặt tài khoản
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { userAPI } from '../../api/client.js';
import { User, Mail, Briefcase, Building2, Wallet, Shield, Camera, Edit2, Check } from 'lucide-react';

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

    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [changingPwd, setChangingPwd] = useState(false);

    const [editingDept, setEditingDept] = useState(false);
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [depts, setDepts] = useState([]);
    const [policyLimits, setPolicyLimits] = useState(null);

    useEffect(() => {
        userAPI.departments().then(res => setDepts(res.data)).catch(console.error);
        userAPI.policyLimits().then(res => setPolicyLimits(res.data)).catch(console.error);
    }, []);

    const formatLimit = (val) => {
        if (!val && val !== 0) return 'Không giới hạn';
        return Number(val).toLocaleString('vi-VN') + 'đ';
    };

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

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            return toast('Mật khẩu mới không khớp!', 'error');
        }
        setChangingPwd(true);
        try {
            await userAPI.changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            });
            toast('Đổi mật khẩu thành công!', 'success');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            toast(err.message || 'Lỗi đổi mật khẩu', 'error');
        } finally {
            setChangingPwd(false);
        }
    };

    const handleSaveDept = async () => {
        try {
            const res = await userAPI.updateProfile({ departmentId: selectedDeptId });
            if (updateUser) updateUser(res.data);
            setEditingDept(false);
            toast('Cập nhật phòng ban thành công!', 'success');
        } catch (err) {
            toast(err.message, 'error');
        }
    };

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
                    <div className="detail-row" style={{ alignItems: 'center' }}>
                        <div className="detail-row__label"><Building2 size={14} /> Phòng ban</div>
                        <div className="detail-row__value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {editingDept ? (
                                <>
                                    <select
                                        className="form-input"
                                        style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
                                        value={selectedDeptId}
                                        onChange={e => setSelectedDeptId(e.target.value)}
                                    >
                                        <option value="">-- Chọn phòng ban --</option>
                                        {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    <button onClick={handleSaveDept} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 4 }}><Check size={16} /></button>
                                </>
                            ) : (
                                <>
                                    {user.department?.name ? (
                                        <>
                                            <span>{user.department.name}</span>
                                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                                ({user.departmentSelfSelected ? 'Tự chọn' : 'Được phân bởi quản trị'})
                                            </span>
                                        </>
                                    ) : (
                                        <span style={{ color: 'var(--color-text-muted)' }}>Chưa phân phòng</span>
                                    )}
                                    <button onClick={() => { setEditingDept(true); setSelectedDeptId(user.department?.id || ''); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }} title="Chọn/Đổi phòng ban"><Edit2 size={14} /></button>
                                </>
                            )}
                        </div>
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
                    {user.role === 'ADMIN' ? (
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                            Quản trị viên không áp dụng hạn mức chi tiêu.
                        </div>
                    ) : (
                        <>
                            <InfoRow label="Hạn mức / ngày" value={policyLimits ? formatLimit(policyLimits.dailyLimit) : '—'} />
                            <InfoRow label="Hạn mức / hóa đơn" value={policyLimits ? formatLimit(policyLimits.perInvoiceLimit) : '—'} />
                            <InfoRow label="Hạn mức / chuyến" value={policyLimits ? formatLimit(policyLimits.totalPerTripLimit) : '—'} />
                        </>
                    )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
                    Hạn mức do bộ phận HR quy định. Liên hệ quản lý để thay đổi.
                </p>
            </div>

            {/* Change Password */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Đổi mật khẩu</h3>
                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
                    <div className="form-group">
                        <label>Mật khẩu hiện tại</label>
                        <input className="form-input" type="password" required
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Mật khẩu mới</label>
                        <input className="form-input" type="password" required minLength={6}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Xác nhận mật khẩu mới</label>
                        <input className="form-input" type="password" required minLength={6}
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={changingPwd} style={{ alignSelf: 'flex-start' }}>
                        {changingPwd ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                    </button>
                </form>
            </div>

            {/* System info */}
            <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Hệ thống</h3>
                <div className="detail-grid">
                    <InfoRow label="Phiên bản" value="FlexiTrip v1.0.0" />
                    <InfoRow label="AI Engine" value="Google Gemini Vision 2.0" />
                    <InfoRow label="Blockchain" value="Ethereum (Sepolia Testnet)" />
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
