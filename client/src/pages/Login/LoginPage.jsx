/**
 * LoginPage.jsx — Trang đăng nhập
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LogIn } from 'lucide-react';
import './LoginPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const setupSuccess = location.state?.setupSuccess;

    // Kiểm tra hệ thống đã setup chưa
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
                        disabled={loading}
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
            </div>
        </div>
    );
}
