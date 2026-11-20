/**
 * LoginPage.jsx — Trang đăng nhập
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LogIn } from 'lucide-react';
import './LoginPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginPage() {
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const setupSuccess = location.state?.setupSuccess;

    // Kiểm tra hệ thống đã setup chưa + nạp script Google GIS
    useEffect(() => {
        fetch(`${API_BASE}/auth/check-setup`)
            .then(res => res.json())
            .then(data => {
                if (data.data?.needSetup) {
                    navigate('/setup', { replace: true });
                }
            })
            .catch(() => {})
            .finally(() => setChecking(false));

        // Nạp Google Identity Services script
        if (typeof window !== 'undefined' && !document.getElementById('google-gsi-client')) {
            const script = document.createElement('script');
            script.id = 'google-gsi-client';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
        } catch (err) {
            setError(err.message || 'Đăng nhập thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleClick = () => {
        setError('');

        if (!GOOGLE_CLIENT_ID) {
            setError('Chưa cấu hình VITE_GOOGLE_CLIENT_ID trong file client/.env. Vui lòng thêm Google Client ID để mở popup Google.');
            return;
        }

        if (!window.google?.accounts?.oauth2) {
            setError('Đang kết nối thư viện Google, vui lòng thử lại sau 1 giây...');
            return;
        }

        setGoogleLoading(true);

        // Lắng nghe khi người dùng quay lại tab chính (phòng trường hợp tắt popup)
        const onWindowFocus = () => {
            window.removeEventListener('focus', onWindowFocus);
            // Grace period 1.2s: nếu không có token trả về thì trả lại trạng thái ban đầu
            setTimeout(() => {
                setGoogleLoading(false);
            }, 1200);
        };
        window.addEventListener('focus', onWindowFocus);

        try {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'email profile openid',
                callback: async (tokenResponse) => {
                    window.removeEventListener('focus', onWindowFocus);
                    if (tokenResponse.error) {
                        setGoogleLoading(false);
                        if (tokenResponse.error !== 'access_denied') {
                            setError(`Lỗi Google: ${tokenResponse.error_description || tokenResponse.error}`);
                        }
                        return;
                    }

                    try {
                        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                        });
                        const profile = await res.json();

                        await loginWithGoogle({
                            email: profile.email,
                            name: profile.name,
                            picture: profile.picture,
                        });
                    } catch (err) {
                        setError(err.message || 'Đăng nhập Google thất bại');
                    } finally {
                        setGoogleLoading(false);
                    }
                },
                error_callback: (error) => {
                    window.removeEventListener('focus', onWindowFocus);
                    setGoogleLoading(false);
                    if (error?.type === 'popup_failed_to_open') {
                        setError('Trình duyệt đã chặn cửa sổ popup. Vui lòng cho phép mở popup trên trình duyệt.');
                    }
                    // Nếu error.type === 'popup_closed' (người dùng đóng cửa sổ):
                    // Tự động khôi phục nút về trạng thái bình thường mà không báo lỗi phiền toái.
                },
            });

            // Mở cửa sổ popup chọn tài khoản Google thật
            tokenClient.requestAccessToken({ prompt: 'select_account' });
        } catch (err) {
            window.removeEventListener('focus', onWindowFocus);
            setGoogleLoading(false);
            setError(err.message || 'Không thể khởi động cửa sổ Google OAuth');
        }
    };

    if (checking) return null;

    return (
        <div className="login-page">
            <div className="login-card">
                {/* Setup success message */}
                {setupSuccess && (
                    <div style={{
                        background: 'rgba(43,158,158,0.1)', border: '1px solid rgba(43,158,158,0.2)',
                        borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                        color: '#2b9e9e', fontSize: 13, textAlign: 'center',
                    }}>
                        ✅ Hệ thống đã khởi tạo thành công! Hãy đăng nhập bằng tài khoản Admin vừa tạo.
                    </div>
                )}
                {/* Logo */}
                <div className="login-logo">
                    <img src="/assets/logo.png" alt="FlexiTrip" className="login-logo__img" />
                    <h1 className="login-logo__text">FlexiTrip</h1>
                    <p className="login-logo__desc">Hệ thống quản lý chi phí công tác</p>
                </div>

                {/* Form */}
                <form className="login-form" onSubmit={handleSubmit}>
                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            placeholder="example@company.vn"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Mật khẩu</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary login-btn"
                        disabled={loading || googleLoading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" style={{ width: 16, height: 16 }} />
                                Đang đăng nhập...
                            </>
                        ) : (
                            <><LogIn size={16} /> Đăng nhập</>
                        )}
                    </button>
                </form>

                {/* Phân cách */}
                <div className="login-divider">
                    <span>hoặc đăng nhập bằng</span>
                </div>

                {/* Nút đăng nhập Google */}
                <button
                    type="button"
                    className="btn-google-login"
                    onClick={handleGoogleClick}
                    disabled={googleLoading || loading}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{googleLoading ? 'Đang kết nối Google...' : 'Đăng nhập với Google'}</span>
                </button>
            </div>
        </div>
    );
}
