/**
 * AdminUsers.jsx — Danh sách nhân viên (Admin only, view-only + filters)
 */

import { useState, useEffect, useMemo } from 'react';
import { adminAPI } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Users, Shield, UserCheck, Search, Plus, X, Save, Trash2, Link2, Loader2, CheckCircle2 } from 'lucide-react';
import Pagination, { usePagination } from '../../components/Pagination/Pagination.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const ROLE_MAP = {
    ADMIN: { label: 'Quản trị viên', icon: Shield, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
    MANAGER: { label: 'Trưởng phòng', icon: UserCheck, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    EMPLOYEE: { label: 'Nhân viên', icon: Users, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
};

export default function AdminUsers() {
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'ADMIN';
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterRole, setFilterRole] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const toast = useToast();

    // New User State
    const [showForm, setShowForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE', departmentId: '', walletAddress: '' });
    const [dbDepartments, setDbDepartments] = useState([]);

    // Blockchain registration state
    const [registeringBC, setRegisteringBC] = useState(null); // userId đang đăng ký
    const [registeredBC, setRegisteredBC] = useState(new Set()); // Set userId đã đăng ký xong

    const fetchUsers = () => {
        setLoading(true);
        adminAPI.users()
            .then((res) => {
                setUsers(res.data);
                const registeredSet = new Set(res.data.filter(u => u.isRegisteredOnChain).map(u => u.id));
                setRegisteredBC(registeredSet);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchUsers();
        adminAPI.departmentsList()
            .then(res => setDbDepartments(res.data))
            .catch(console.error);
    }, []);

    // Lấy danh sách phòng ban unique
    const departments = useMemo(() => {
        const depts = [...new Set(users.map(u => u.department?.name).filter(Boolean))];
        return depts.sort();
    }, [users]);

    // Lọc
    const filtered = useMemo(() => {
        return users.filter(u => {
            if (filterRole && u.role !== filterRole) return false;
            if (filterDept && u.department?.name !== filterDept) return false;
            if (search) {
                const q = search.toLowerCase();
                if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [users, filterRole, filterDept, search]);

    // Reset page on filter change
    useEffect(() => { setPage(1); }, [filterRole, filterDept, search]);

    const { totalPages, getPage } = usePagination(filtered, 10);
    const paginatedUsers = getPage(page);

    // Thống kê role
    const roleCounts = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {});

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const payload = { ...form };
            // Manager: tự gán phòng ban + role EMPLOYEE
            if (!isAdmin) {
                payload.departmentId = currentUser?.departmentId || '';
                payload.role = 'EMPLOYEE';
            }
            await adminAPI.createUser(payload);
            toast('Tạo nhân viên thành công!', 'success');
            setShowForm(false);
            setForm({ name: '', email: '', password: '', role: 'EMPLOYEE', departmentId: '', walletAddress: '' });
            fetchUsers();
        } catch (err) {
            toast(err.message || 'Lỗi tạo nhân viên', 'error');
        } finally {
            setCreating(false);
        }
    };

    // Tất cả phòng ban để list vô select (Lấy unique object nếu cần, hiện tại map từ users sẽ sót phòng ban trống)
    // Để có list chính xác nhất thì nên load từ config, nhưng tạm map array string:
    const departmentNames = [...new Set(users.map(u => u.department?.name).filter(Boolean))].sort();

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    const handleDeleteUser = async (user) => {
        const confirm = window.confirm(`Bạn chắc chắn muốn xóa nhân viên "${user.name}"?\n\nTất cả dữ liệu (hóa đơn, chuyến công tác, ...) của nhân viên này sẽ bị xóa vĩnh viễn.`);
        if (!confirm) return;
        try {
            await adminAPI.deleteUser(user.id);
            toast(`Đã xóa nhân viên ${user.name}`, 'success');
            fetchUsers();
        } catch (err) {
            toast(err.message || 'Lỗi xóa nhân viên', 'error');
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Danh sách nhân viên</h1>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                        {users.length} người dùng
                    </span>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    <Plus size={16} /> Thêm nhân viên
                </button>
            </div>

            {/* Modal Tạo User */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2 className="modal-header__title">Tạo tài khoản nhân viên</h2>
                            <button className="modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="form-group">
                                    <label>Họ và tên *</label>
                                    <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Email *</label>
                                    <input className="form-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Mật khẩu *</label>
                                    <input className="form-input" type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Vai trò *</label>
                                        {isAdmin ? (
                                            <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                                                <option value="EMPLOYEE">Nhân viên</option>
                                                <option value="MANAGER">Trưởng phòng</option>
                                                <option value="ADMIN">Quản trị viên</option>
                                            </select>
                                        ) : (
                                            <input className="form-input" value="Nhân viên" disabled />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Phòng ban</label>
                                        {isAdmin ? (
                                            <select className="form-input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                                                <option value="">-- Chưa phân phòng --</option>
                                                {dbDepartments.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input className="form-input" value={dbDepartments.find(d => d.id === currentUser?.departmentId)?.name || 'Phòng ban của bạn'} disabled />
                                        )}
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={creating} style={{ marginTop: 8 }}>
                                    {creating ? 'Đang tạo...' : 'Lưu tài khoản'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Role summary cards */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                {Object.entries(ROLE_MAP).map(([role, info]) => {
                    const Icon = info.icon;
                    return (
                        <div key={role} className="stat-card"
                            onClick={() => setFilterRole(filterRole === role ? '' : role)}
                            style={{ cursor: 'pointer', outline: filterRole === role ? `2px solid ${info.color}` : 'none', outlineOffset: -2 }}
                        >
                            <div className="stat-card__icon" style={{ background: info.bg, color: info.color }}>
                                <Icon size={20} />
                            </div>
                            <div className="stat-card__label">{info.label}</div>
                            <div className="stat-card__value">{roleCounts[role] || 0}</div>
                        </div>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Tìm theo tên hoặc email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8,
                                border: '1px solid var(--color-border)', fontSize: 13,
                                background: 'var(--color-bg)',
                            }}
                        />
                    </div>
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">Tất cả vai trò</option>
                        <option value="EMPLOYEE">Nhân viên</option>
                        <option value="MANAGER">Trưởng phòng</option>
                        <option value="ADMIN">Quản trị viên</option>
                    </select>
                    <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">Tất cả phòng ban</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {(filterRole || filterDept || search) && (
                        <button
                            onClick={() => { setFilterRole(''); setFilterDept(''); setSearch(''); }}
                            style={{
                                padding: '6px 12px', borderRadius: 8, border: 'none',
                                background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                fontSize: 12, cursor: 'pointer',
                            }}
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            </div>

            {/* Users table */}
            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                <th style={thStyle}>Người dùng</th>
                                <th style={thStyle}>Email</th>
                                <th style={thStyle}>Vai trò</th>
                                <th style={thStyle}>Phòng ban</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Hóa đơn</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Chuyến CT</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        Không tìm thấy nhân viên phù hợp
                                    </td>
                                </tr>
                            ) : paginatedUsers.map((u) => {
                                const roleInfo = ROLE_MAP[u.role] || ROLE_MAP.EMPLOYEE;
                                return (
                                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    background: 'var(--color-accent-bg)', color: 'var(--color-primary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 700, fontSize: 13, flexShrink: 0,
                                                }}>
                                                    {u.avatarUrl ? (
                                                        <img src={`http://localhost:3000${u.avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                    ) : u.name?.charAt(0)}
                                                </div>
                                                <span style={{ fontWeight: 500 }}>{u.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{u.email}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                background: roleInfo.bg, color: roleInfo.color,
                                                fontSize: 11, fontWeight: 600, padding: '3px 10px',
                                                borderRadius: 20, display: 'inline-block',
                                            }}>
                                                {roleInfo.label}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ color: u.department?.name ? 'inherit' : 'var(--color-text-muted)' }}>
                                                {u.department?.name || '—'}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{u._count?.expenses || 0}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{u._count?.trips || 0}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                {u.walletAddress && u.role !== 'ADMIN' && !registeredBC.has(u.id) && (
                                                    registeringBC === u.id ? (
                                                        <span style={{
                                                            fontSize: 11, color: '#8b5cf6', display: 'inline-flex',
                                                            alignItems: 'center', gap: 4, padding: '5px 8px',
                                                        }}>
                                                            <Loader2 size={13} className="spin" /> Đang ký...
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                setRegisteringBC(u.id);
                                                                try {
                                                                    const res = await adminAPI.registerBlockchain(u.id);
                                                                    toast(res.message || 'Đăng ký blockchain thành công!', 'success');
                                                                    setRegisteredBC(prev => new Set([...prev, u.id]));
                                                                } catch (err) {
                                                                    toast(err.message || 'Lỗi đăng ký blockchain', 'error');
                                                                } finally {
                                                                    setRegisteringBC(null);
                                                                }
                                                            }}
                                                            title="Đăng ký trên Blockchain"
                                                            style={{
                                                                background: 'rgba(139,92,246,0.08)', color: '#8b5cf6',
                                                                border: 'none', borderRadius: 6, padding: '5px 8px',
                                                                cursor: 'pointer', fontSize: 12, display: 'inline-flex',
                                                                alignItems: 'center', gap: 4,
                                                            }}
                                                        >
                                                            <Link2 size={13} /> BC
                                                        </button>
                                                    )
                                                )}
                                                {u.walletAddress && registeredBC.has(u.id) && (
                                                    <span style={{ fontSize: 11, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 8px' }}>
                                                        <CheckCircle2 size={13} /> Đã ký
                                                    </span>
                                                )}
                                                {u.id !== currentUser?.id && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }}
                                                        title="Xóa nhân viên"
                                                        style={{
                                                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                                            border: 'none', borderRadius: 6, padding: '5px 8px',
                                                            cursor: 'pointer', fontSize: 12, display: 'inline-flex',
                                                            alignItems: 'center', gap: 4,
                                                        }}
                                                    >
                                                        <Trash2 size={13} /> Xóa
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                {filtered.length > 0 && (
                    <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Hiển thị {filtered.length} / {users.length} nhân viên
                    </div>
                )}
            </div>
        </div>
    );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' };
const selectStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-bg)', minWidth: 140 };
