/**
 * LoginPage.jsx — Trang đăng nhập
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { LogIn, ShieldCheck, User, Briefcase } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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

    return (
        <div className="login-page">
            <div className="login-card">
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

                {/* Demo accounts */}
                <div className="login-demo">
                    <p className="login-demo__title">Tài khoản demo</p>
                    <div className="login-demo__accounts">
                        <button
                            type="button"
                            className="login-demo__btn"
                            onClick={() => { setEmail('admin@company.vn'); setPassword('admin123'); }}
                        >
                            <ShieldCheck size={14} /> Admin
                        </button>
                        <button
                            type="button"
                            className="login-demo__btn"
                            onClick={() => { setEmail('nguyenvana@company.vn'); setPassword('employee123'); }}
                        >
                            <User size={14} /> Nhân viên A
                        </button>
                        <button
                            type="button"
                            className="login-demo__btn"
                            onClick={() => { setEmail('tranthib@company.vn'); setPassword('employee123'); }}
                        >
                            <Briefcase size={14} /> Trưởng phòng B
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
