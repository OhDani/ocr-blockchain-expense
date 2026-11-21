/**
 * SettingsPage.jsx — Cài đặt tài khoản
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { userAPI, getAssetUrl } from '../../api/client.js';
import { getAddressUrl, VVND_TOKEN_ADDRESS } from '../../utils/explorer.js';
import {
    Briefcase, Building2, Wallet, Shield, Camera, Edit2, Check,
    ExternalLink, Copy, CheckCircle2, AlertCircle, Link2, Loader2,
    RefreshCw, X, HelpCircle, PlusCircle, BookOpen, Info
} from 'lucide-react';

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

    // Web3 Wallet state
    const [walletStatus, setWalletStatus] = useState(null);
    const [loadingWalletStatus, setLoadingWalletStatus] = useState(false);
    const [linkingWallet, setLinkingWallet] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [showNoMetaMaskModal, setShowNoMetaMaskModal] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [guideTab, setGuideTab] = useState('steps'); // 'steps' | 'no-wallet' | 'faq'

    const fetchWalletStatus = useCallback(() => {
        setLoadingWalletStatus(true);
        userAPI.walletStatus()
            .then(res => {
                if (res.success && res.data) {
                    setWalletStatus(res.data);
                }
            })
            .catch(err => {
                console.warn('Lỗi kiểm tra ví on-chain:', err.message);
            })
            .finally(() => {
                setLoadingWalletStatus(false);
            });
    }, []);

    useEffect(() => {
        userAPI.departments().then(res => setDepts(res.data)).catch(console.error);
        userAPI.policyLimits().then(res => setPolicyLimits(res.data)).catch(console.error);
        fetchWalletStatus();
    }, [fetchWalletStatus]);

    const handleCopyAddress = (addr) => {
        if (!addr) return;
        navigator.clipboard.writeText(addr);
        setCopiedAddress(true);
        toast('Đã sao chép địa chỉ ví!', 'success');
        setTimeout(() => setCopiedAddress(false), 2000);
    };

    const handleConnectWallet = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            setShowNoMetaMaskModal(true);
            return;
        }

        setLinkingWallet(true);
        try {
            // 1. Yêu cầu MetaMask hiển thị bảng chọn tài khoản (cho phép chọn Account 1, Account 2...)
            let selectedAddress = null;
            try {
                // Buộc MetaMask mở popup chọn tài khoản (EIP-2255)
                await window.ethereum.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }],
                });
                const accs = await window.ethereum.request({ method: 'eth_accounts' });
                if (accs && accs.length > 0) selectedAddress = accs[0];
            } catch (permErr) {
                if (permErr.code === 4001) throw permErr; // Người dùng từ chối
                // Fallback nếu ví không hỗ trợ requestPermissions
                const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accs && accs.length > 0) selectedAddress = accs[0];
            }

            if (!selectedAddress) {
                throw new Error('Không có tài khoản nào được chọn trong ví MetaMask.');
            }

            // 2. Lấy Challenge Nonce từ Server
            const nonceRes = await userAPI.getWalletNonce(selectedAddress);
            if (!nonceRes.success || !nonceRes.data) {
                throw new Error('Không thể tạo mã xác thực từ máy chủ.');
            }
            const { message } = nonceRes.data;

            // 3. Yêu cầu ký chữ ký số mật mã EIP-191 (personal_sign)
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, selectedAddress],
            });

            // 4. Gửi chữ ký lên server để xác thực và liên kết
            const linkRes = await userAPI.linkWallet({
                address: selectedAddress,
                signature,
                message,
            });

            if (linkRes.success && linkRes.data) {
                if (updateUser) updateUser(linkRes.data);
                fetchWalletStatus();
                toast('Liên kết ví MetaMask thành công! Chữ ký mật mã đã được xác thực an toàn.', 'success');
            }
        } catch (err) {
            if (err.code === 4001) {
                toast('Bạn đã hủy yêu cầu ký xác thực trên MetaMask.', 'warning');
            } else {
                toast(err.message || 'Lỗi khi liên kết ví', 'error');
            }
        } finally {
            setLinkingWallet(false);
        }
    };

    const formatLimit = (val) => {
        if (!val && val !== 0) return 'Không giới hạn';
        return Number(val).toLocaleString('vi-VN') + 'đ';
    };

    const handleAddTokenToMetaMask = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            toast('Không tìm thấy tiện ích MetaMask trên trình duyệt.', 'warning');
            return;
        }
        try {
            const added = await window.ethereum.request({
                method: 'wallet_watchAsset',
                params: {
                    type: 'ERC20',
                    options: {
                        address: VVND_TOKEN_ADDRESS,
                        symbol: 'vVND',
                        decimals: 0,
                    },
                },
            });
            if (added) {
                toast('Đã thêm token vVND vào ví MetaMask thành công!', 'success');
            }
        } catch (err) {
            console.warn('Lỗi thêm token vVND vào MetaMask:', err);
            toast('Lỗi khi thêm token vào MetaMask: ' + (err.message || 'Lỗi không xác định'), 'error');
        }
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

    const avatarSrc = user.avatarUrl ? getAssetUrl(user.avatarUrl) : null;

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
                    {user?.role !== 'ADMIN' && user.walletAddress && (
                        <div className="detail-row">
                            <div className="detail-row__label"><Wallet size={14} /> Ví blockchain</div>
                            <div className="detail-row__value" style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                {user.walletAddress}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Ví nhận tiền hoàn ứng (Blockchain) — Ẩn đối với Admin */}
            {user?.role !== 'ADMIN' && (
                <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                        <Wallet size={18} /> Ví nhận tiền hoàn ứng (Blockchain)
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setShowGuideModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                background: 'rgba(43, 158, 158, 0.08)',
                                color: '#1a7575',
                                borderColor: 'rgba(43, 158, 158, 0.3)',
                                fontWeight: 600,
                                fontSize: 12
                            }}
                            title="Xem hướng dẫn chi tiết cách cài đặt & sử dụng ví Web3"
                        >
                            <BookOpen size={14} /> Cẩm nang tạo & liên kết ví
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={fetchWalletStatus}
                            disabled={loadingWalletStatus}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            title="Đồng bộ số dư và trạng thái ví từ Blockchain Linea Sepolia"
                        >
                            <RefreshCw size={13} className={loadingWalletStatus ? 'spin' : ''} />
                            {loadingWalletStatus ? 'Đang đồng bộ...' : 'Đồng bộ số dư'}
                        </button>
                    </div>
                </div>

                {/* Ghi chú nhắc nhở ngắn gọn */}
                <div style={{
                    background: 'var(--color-bg-secondary, #f8fafc)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    border: '1px solid var(--color-border)',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: 'var(--color-text-secondary)'
                }}>
                    <Info size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        Hệ thống giải ngân hoàn ứng tự động qua Smart Contract. Bạn chỉ cần liên kết ví MetaMask một lần để Kế toán có thể duyệt và chuyển tiền cho bạn.
                    </div>
                    <button
                        type="button"
                        onClick={() => { setShowGuideModal(true); setGuideTab('steps'); }}
                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                        Xem hướng dẫn &rarr;
                    </button>
                </div>

                <div style={{ background: 'var(--color-bg-secondary, #f8fafc)', borderRadius: 8, padding: '16px 20px', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ flex: 1, minWidth: 280 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>Địa chỉ ví nhận hoàn ứng:</span>
                                {user.walletAddress && (
                                    <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 8px' }}>
                                        ✓ Đang kích hoạt
                                    </span>
                                )}
                            </div>
                            <div style={{
                                fontFamily: 'monospace',
                                fontSize: 13,
                                fontWeight: 600,
                                wordBreak: 'break-all',
                                color: 'var(--color-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: 'var(--color-surface, #ffffff)',
                                padding: '10px 14px',
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                            }}>
                                <span style={{ flex: 1 }}>{user.walletAddress || 'Chưa liên kết ví'}</span>
                                {user.walletAddress && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyAddress(user.walletAddress)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: copiedAddress ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                                            title="Sao chép địa chỉ ví"
                                        >
                                            {copiedAddress ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                        </button>
                                        <a
                                            href={getAddressUrl(user.walletAddress)}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: 'var(--color-text-muted)', padding: 4, display: 'inline-flex' }}
                                            title="Xem ví trên Block Explorer (Lineascan)"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* On-chain balance & registration info */}
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Số dư vVND (1 vVND = 1 VNĐ)</div>
                                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-primary)' }}>
                                    {walletStatus?.balance !== undefined
                                        ? `${Number(walletStatus.balance).toLocaleString('vi-VN')} vVND`
                                        : '0 vVND'}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddTokenToMetaMask}
                                    style={{
                                        background: 'none',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 4,
                                        padding: '2px 8px',
                                        fontSize: 11,
                                        color: 'var(--color-primary)',
                                        cursor: 'pointer',
                                        marginTop: 4,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4
                                    }}
                                    title="Thêm token vVND vào ví MetaMask để hiển thị số dư trực tiếp trong ví"
                                >
                                    <PlusCircle size={11} /> Thêm vVND vào MetaMask
                                </button>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Hợp đồng thông minh (Smart Contract)</div>
                                <div>
                                    {walletStatus?.isRegisteredOnChain ? (
                                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                            <CheckCircle2 size={12} /> Sẵn sàng nhận giải ngân
                                        </span>
                                    ) : (
                                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                            <AlertCircle size={12} /> Đang đồng bộ Blockchain
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, maxWidth: 540, lineHeight: 1.5 }}>
                        🔒 <strong>An toàn tuyệt đối:</strong> Hệ thống KHÔNG BAO GIỜ yêu cầu bạn cung cấp Private Key hay 12 từ khóa bí mật. Bạn chỉ ký số xác thực chủ quyền ví (miễn phí 100%) khi muốn kết nối ví cá nhân.
                    </p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConnectWallet}
                        disabled={linkingWallet}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        {linkingWallet ? (
                            <>
                                <Loader2 size={15} className="spin" />
                                <span>Đang ký xác thực...</span>
                            </>
                        ) : (
                            <>
                                <Link2 size={15} />
                                <span>{user.walletAddress ? 'Đổi sang ví MetaMask cá nhân' : 'Liên kết ví MetaMask cá nhân'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
            )}

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
                    <InfoRow label="Blockchain" value="Linea Sepolia (Layer 2 zkEVM)" />
                    <InfoRow label="Smart Contract" value="ExpenseManager + MockVND" />
                </div>
            </div>

            {/* Modal hướng dẫn khi chưa có tiện ích MetaMask */}
            {showNoMetaMaskModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.45)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                    onClick={() => setShowNoMetaMaskModal(false)}
                >
                    <div
                        className="card"
                        style={{ maxWidth: 500, width: '100%', margin: 0, boxShadow: 'var(--shadow-lg)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <HelpCircle size={20} color="var(--color-primary)" /> Chưa cài đặt ví Web3
                            </h3>
                            <button
                                onClick={() => setShowNoMetaMaskModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <p style={{ margin: 0 }}>
                                Trình duyệt của bạn chưa cài đặt tiện ích mở rộng ví Web3 (ví dụ: <strong>MetaMask</strong>).
                            </p>
                            <div style={{ background: 'var(--color-bg-secondary, #f8fafc)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13 }}>
                                <strong style={{ color: 'var(--color-primary)' }}>💡 Bạn không bắt buộc phải cài đặt ví MetaMask:</strong>
                                <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-muted)' }}>
                                    FlexiTrip áp dụng mô hình <strong>Ví nội bộ (Embedded Wallet)</strong> cấp phát sẵn cho bạn. Tiền hoàn ứng chi phí công tác vẫn được chuyển và ghi nhận an toàn 100% vào tài khoản của bạn.
                                </p>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                                Nếu muốn tự quản lý token <strong>vVND</strong> và rút về tài khoản ngân hàng hoặc ví cá nhân, bạn có thể tải MetaMask cho Chrome / Edge / Brave.
                            </p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => { setShowNoMetaMaskModal(false); setShowGuideModal(true); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <BookOpen size={14} /> Mở cẩm nang hướng dẫn
                            </button>
                            <a
                                href="https://metamask.io/download/"
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <ExternalLink size={14} /> Tải MetaMask
                            </a>
                            <button className="btn btn-primary" onClick={() => setShowNoMetaMaskModal(false)}>
                                Đã hiểu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Cẩm nang: Hướng dẫn liên kết ví nhận hoàn ứng */}
            {showGuideModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.45)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                    onClick={() => setShowGuideModal(false)}
                >
                    <div
                        className="card"
                        style={{ maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', margin: 0, boxShadow: 'var(--shadow-lg)', borderRadius: 14, padding: 22 }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--color-border)', marginBottom: 14 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <BookOpen size={18} /> Cẩm nang liên kết ví nhận hoàn ứng
                            </h3>
                            <button
                                onClick={() => setShowGuideModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Tab Switcher */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                            <button
                                type="button"
                                onClick={() => setGuideTab('steps')}
                                style={{
                                    background: guideTab === 'steps' ? 'var(--color-primary)' : 'var(--color-bg-secondary, #f1f5f9)',
                                    color: guideTab === 'steps' ? '#fff' : 'var(--color-text)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Các bước liên kết (1 phút)
                            </button>
                            <button
                                type="button"
                                onClick={() => setGuideTab('faq')}
                                style={{
                                    background: guideTab === 'faq' ? 'var(--color-primary)' : 'var(--color-bg-secondary, #f1f5f9)',
                                    color: guideTab === 'faq' ? '#fff' : 'var(--color-text)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Giải đáp thắc mắc
                            </button>
                        </div>

                        {/* Tab 1: Các bước */}
                        {guideTab === 'steps' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
                                <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary, #f8fafc)' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                        1. Cài đặt tiện ích MetaMask
                                    </div>
                                    <p style={{ margin: '0 0 6px 0', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                                        Cài extension MetaMask trên Chrome / Edge / Brave và lưu giữ 12 từ khóa khôi phục bí mật.
                                    </p>
                                    <a
                                        href="https://metamask.io/download/"
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: 'var(--color-primary)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
                                    >
                                        Tải MetaMask chính thức <ExternalLink size={12} />
                                    </a>
                                </div>

                                <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary, #f8fafc)' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                        2. Bấm "Liên kết ví MetaMask"
                                    </div>
                                    <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12 }}>
                                        Bấm nút liên kết trên trang này, sau đó bấm <strong>Ký (Sign)</strong> trên popup MetaMask để xác thực chủ quyền ví. Thao tác ký là <strong>miễn phí 100% (0đ)</strong>.
                                    </p>
                                </div>

                                <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary, #f8fafc)' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                        3. Thêm token vVND vào ví
                                    </div>
                                    <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12 }}>
                                        Bấm nút <strong>"+ Thêm vVND vào MetaMask"</strong> dưới mục số dư để ví hiển thị số tiền hoàn ứng mỗi khi Kế toán duyệt chi.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Giải đáp thắc mắc */}
                        {guideTab === 'faq' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, lineHeight: 1.5 }}>
                                <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                    <strong style={{ fontSize: 12 }}>Tại sao tôi phải liên kết ví?</strong>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>
                                        Hệ thống hoàn ứng tự động bằng Hợp đồng thông minh. Smart Contract bắt buộc cần địa chỉ ví của bạn để chuyển tiền trực tiếp. Nếu chưa liên kết, Kế toán không thể duyệt hoàn ứng.
                                    </div>
                                </div>

                                <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                    <strong style={{ fontSize: 12 }}>Token vVND là gì?</strong>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>
                                        Là điểm hoàn ứng đại diện theo tỷ lệ 1 vVND = 1 VNĐ chạy trên mạng Linea Sepolia. Ví dụ công ty hoàn ứng 500.000đ thì bạn nhận 500.000 vVND.
                                    </div>
                                </div>

                                <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                    <strong style={{ fontSize: 12 }}>Có bị mất phí hay lộ thông tin ví không?</strong>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>
                                        Hoàn toàn không. Hệ thống chỉ dùng chữ ký điện tử mật mã (EIP-191) để xác nhận địa chỉ ví thuộc về bạn, tuyệt đối không hỏi mật khẩu hay 12 từ khóa bí mật.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                            <button className="btn btn-sm btn-primary" onClick={() => setShowGuideModal(false)}>
                                Đã hiểu
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
