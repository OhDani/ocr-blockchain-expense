/**
 * SetupPage.jsx — Trang khởi tạo hệ thống (lần đầu triển khai)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Building2, User, Mail, Lock, ArrowRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function SetupPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        companyName: '', adminName: '', email: '', password: '', confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1); // 1: company, 2: admin

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }
        if (form.password.length < 6) {
            setError('Mật khẩu tối thiểu 6 ký tự');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/auth/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: form.companyName,
                    adminName: form.adminName,
                    email: form.email,
                    password: form.password,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Redirect to login
            navigate('/login', { state: { setupSuccess: true } });
        } catch (err) {
            setError(err.message || 'Lỗi khởi tạo hệ thống');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            padding: 20,
        }}>
            <div style={{
                width: '100%', maxWidth: 520,
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: 40,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 16,
                        background: 'linear-gradient(135deg, #2b9e9e, #1a3a5c)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(43,158,158,0.3)',
                    }}>
                        <Shield size={32} color="white" />
                    </div>
                    <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                        Khởi tạo FlexiTrip
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                        Thiết lập hệ thống quản lý chi phí công tác cho doanh nghiệp
                    </p>
                </div>

                {/* Steps indicator */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28,
                }}>
                    {[1, 2].map(s => (
                        <div key={s} style={{
                            width: s === step ? 32 : 8, height: 8, borderRadius: 4,
                            background: s <= step ? '#2b9e9e' : 'rgba(255,255,255,0.1)',
                            transition: 'all 0.3s ease',
                        }} />
                    ))}
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                        color: '#fca5a5', fontSize: 13,
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {step === 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, display: 'block' }}>
                                    <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                    Tên công ty *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.companyName}
                                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                    placeholder="VD: Công ty TNHH ABC"
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: 10,
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', fontSize: 14, outline: 'none',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#2b9e9e'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => form.companyName ? setStep(2) : setError('Vui lòng nhập tên công ty')}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 10,
                                    background: 'linear-gradient(135deg, #2b9e9e, #1a8a8a)',
                                    color: 'white', border: 'none', fontSize: 15, fontWeight: 600,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: 8, marginTop: 8,
                                    transition: 'transform 0.1s, box-shadow 0.2s',
                                    boxShadow: '0 4px 16px rgba(43,158,158,0.3)',
                                }}
                                onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
                                onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                            >
                                Tiếp tục <ArrowRight size={16} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{
                                background: 'rgba(43,158,158,0.08)', border: '1px solid rgba(43,158,158,0.15)',
                                borderRadius: 10, padding: '10px 14px',
                                color: 'rgba(255,255,255,0.7)', fontSize: 13,
                            }}>
                                🏢 {form.companyName}
                                <span onClick={() => setStep(1)} style={{
                                    marginLeft: 8, color: '#2b9e9e', cursor: 'pointer', textDecoration: 'underline',
                                }}>Sửa</span>
                            </div>
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, display: 'block' }}>
                                    <User size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                    Tên quản trị viên *
                                </label>
                                <input
                                    type="text" required value={form.adminName}
                                    onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                                    placeholder="Nguyễn Văn Admin"
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: 10,
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', fontSize: 14, outline: 'none',
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#2b9e9e'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                            </div>
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, display: 'block' }}>
                                    <Mail size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                    Email đăng nhập *
                                </label>
                                <input
                                    type="email" required value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="admin@company.vn"
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: 10,
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', fontSize: 14, outline: 'none',
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#2b9e9e'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                            </div>
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, display: 'block' }}>
                                    <Lock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                    Mật khẩu *
                                </label>
                                <input
                                    type="password" required minLength={6} value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder="Tối thiểu 6 ký tự"
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: 10,
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', fontSize: 14, outline: 'none',
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#2b9e9e'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                            </div>
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, display: 'block' }}>
                                    <Lock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                    Xác nhận mật khẩu *
                                </label>
                                <input
                                    type="password" required minLength={6} value={form.confirmPassword}
                                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                    placeholder="Nhập lại mật khẩu"
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: 10,
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', fontSize: 14, outline: 'none',
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#2b9e9e'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 10,
                                    background: loading ? 'rgba(43,158,158,0.5)' : 'linear-gradient(135deg, #2b9e9e, #1a8a8a)',
                                    color: 'white', border: 'none', fontSize: 15, fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: 8, marginTop: 8,
                                    boxShadow: '0 4px 16px rgba(43,158,158,0.3)',
                                }}
                            >
                                {loading ? 'Đang khởi tạo...' : '🚀 Khởi tạo hệ thống'}
                            </button>
                        </div>
                    )}
                </form>

                <p style={{
                    textAlign: 'center', marginTop: 24,
                    color: 'rgba(255,255,255,0.3)', fontSize: 12,
                }}>
                    FlexiTrip — Hệ thống quản lý chi phí công tác
                </p>
            </div>
        </div>
    );
}
